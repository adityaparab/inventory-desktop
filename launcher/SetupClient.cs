using System.Management;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Inventory.Launcher;

/// <summary>
/// Thin HTTP/WMI client that performs the 4-step setup flow:
///
///   1. Exchange the embedded setup token for a short-lived JWT.
///   2. Detect the machine's hardware UUID via WMI.
///   3. Detect the hostname.
///   4. Register the machine with the server.
///
/// All steps throw <see cref="SetupException"/> on user-facing failures so
/// the UI can show a clean message without a stack trace.
/// </summary>
public sealed class SetupClient : IDisposable
{
    private static readonly TimeSpan ApiRequestTimeout = TimeSpan.FromSeconds(30);

    private readonly HttpClient _http;
    private readonly LauncherConfig _config;
    private string? _accessToken;

    public string? MachineUuid { get; private set; }
    public string? Hostname    { get; private set; }
    public string? MachineName { get; private set; }

    public SetupClient(LauncherConfig config)
    {
        _config = config;
        // AllowAutoRedirect=false: prevents HttpClient from silently converting
        // POST→GET on 301/302 redirects (which happens when the server returns
        // an http:// URL that redirects to https://).  The root cause is fixed
        // server-side (trust proxy → correct https URL), but this guards against
        // any future redirect scenario.
        var handler = new HttpClientHandler { AllowAutoRedirect = false };
        _http = new HttpClient(handler)
        {
            BaseAddress = new Uri(config.ApiBaseUrl.TrimEnd('/') + "/"),
            Timeout     = Timeout.InfiniteTimeSpan,
        };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("InventoryMachineSetup/1.0");
    }

    // -------------------------------------------------------------------------
    // Step 1: Exchange setup token for a short-lived JWT.
    // -------------------------------------------------------------------------
    public async Task AuthenticateAsync(CancellationToken ct = default)
    {
        var resp = await PostJsonAsync("setup/exchange",
            new { setupToken = _config.SetupToken }, requireAuth: false, ct);

        var token = resp.GetProperty("accessToken").GetString();
        if (string.IsNullOrEmpty(token))
        {
            throw new SetupException("Authentication succeeded but no token was returned.");
        }
        _accessToken = token;
    }

    // -------------------------------------------------------------------------
    // Step 2: Detect machine UUID via WMI.
    // -------------------------------------------------------------------------
    public Task DetectUuidAsync(CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            string? uuid = null;
            try
            {
                using var searcher = new ManagementObjectSearcher(
                    "SELECT UUID FROM Win32_ComputerSystemProduct");
                foreach (ManagementObject obj in searcher.Get())
                {
                    uuid = obj["UUID"]?.ToString();
                    obj.Dispose();
                    if (!string.IsNullOrWhiteSpace(uuid)) break;
                }
            }
            catch (Exception ex)
            {
                throw new SetupException("Unable to read machine UUID via WMI.", ex);
            }

            uuid = uuid?.Trim().ToUpperInvariant();

            if (string.IsNullOrEmpty(uuid)
                || uuid == "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"
                || uuid == "00000000-0000-0000-0000-000000000000")
            {
                throw new SetupException(
                    $"Machine UUID could not be reliably determined (value: '{uuid ?? "<null>"}').");
            }

            MachineUuid = uuid;
        }, ct);
    }

    // -------------------------------------------------------------------------
    // Step 3: Detect hostname.
    // -------------------------------------------------------------------------
    public Task DetectHostnameAsync(CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            var hostname = Environment.MachineName;
            if (string.IsNullOrWhiteSpace(hostname))
            {
                throw new SetupException("Unable to read the computer name.");
            }
            Hostname    = hostname;
            MachineName = $"{hostname}'s computer";
        }, ct);
    }

    // -------------------------------------------------------------------------
    // Step 4: Register the machine.
    // -------------------------------------------------------------------------
    public async Task RegisterMachineAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(MachineUuid) || string.IsNullOrEmpty(MachineName))
        {
            throw new InvalidOperationException(
                "DetectUuidAsync and DetectHostnameAsync must run before RegisterMachineAsync.");
        }
        await PostJsonAsync("machines",
            new { uuid = MachineUuid, name = MachineName }, requireAuth: true, ct);
    }

    // -------------------------------------------------------------------------
    // Step 5: Stream the build over SSE (GET /generate/:uuid).
    //
    // Calls the SSE endpoint and reads each Server-Sent Event line-by-line.
    // Forwards log / stderr lines to the supplied callbacks, returns on
    // "complete", and throws SetupException on "error" or if the stream ends
    // without a terminal event.
    // -------------------------------------------------------------------------
    public async Task StreamBuildAsync(
        string uuid,
        Action<string> onLog,
        Action<string> onStderr,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_accessToken))
        {
            throw new InvalidOperationException(
                "AuthenticateAsync must run before StreamBuildAsync.");
        }

        var path = $"generate/{Uri.EscapeDataString(uuid)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
        req.Headers.Accept.ParseAdd("text/event-stream");

        HttpResponseMessage resp;
        try
        {
            // ResponseHeadersRead: returns once headers arrive; body is streamed.
            resp = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new SetupException(
                $"Could not reach the server to start the build.\r\nDetails: {ex.Message}", ex);
        }

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            var msg  = ExtractServerMessage(body) ?? $"HTTP {(int)resp.StatusCode}";
            throw new SetupException($"Build request to /{path} failed: {msg}");
        }

        using var stream = await resp.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream);

        // SSE payload: each event is one or more lines; events separated by blank lines.
        // Our server always emits single-line events of the form:
        //   data: {"type":"log","message":"..."}
        string? line;
        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            if (!line.StartsWith("data:", StringComparison.Ordinal))
                continue;

            var json = line["data:".Length..].TrimStart();
            if (string.IsNullOrWhiteSpace(json))
                continue;

            JsonElement root;
            try { root = JsonDocument.Parse(json).RootElement; }
            catch (JsonException) { continue; }

            var type    = root.TryGetProperty("type",    out var tp) ? tp.GetString()        : null;
            var message = root.TryGetProperty("message", out var mp) ? mp.GetString() ?? "" : "";

            switch (type)
            {
                case "complete":
                    // Build finished — stream will close naturally.
                    return;
                case "error":
                    throw new SetupException("Build failed on the server: " + message);
                case "stderr":
                    onStderr(message);
                    break;
                default:
                    onLog(message);
                    break;
            }
        }

        throw new SetupException(
            "Build stream ended before a completion event was received.\r\n" +
            "The server may have restarted mid-build. Please try again.");
    }

    // -------------------------------------------------------------------------
    // Step 6: Download the compiled installer (GET /download/:uuid).
    //
    // Saves the EXE to a temporary file and stores the path in InstallerPath.
    // -------------------------------------------------------------------------

    /// <summary>
    /// Path where the downloaded installer was saved.  Set after a successful
    /// call to <see cref="DownloadInstallerAsync"/>.
    /// </summary>
    public string? InstallerPath { get; private set; }

    public async Task DownloadInstallerAsync(string uuid, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_accessToken))
        {
            throw new InvalidOperationException(
                "AuthenticateAsync must run before DownloadInstallerAsync.");
        }

        var path = $"download/{Uri.EscapeDataString(uuid)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);

        HttpResponseMessage resp;
        try
        {
            resp = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new SetupException(
                $"Could not download the installer.\r\nDetails: {ex.Message}", ex);
        }

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            var msg  = ExtractServerMessage(body) ?? $"HTTP {(int)resp.StatusCode}";
            throw new SetupException($"Installer download from /{path} failed: {msg}");
        }

        // Derive filename from Content-Disposition; fall back to a safe default.
        var cd       = resp.Content.Headers.ContentDisposition;
        var rawName  = cd?.FileNameStar ?? cd?.FileName;
        var filename = rawName?.Trim('"', '\'') ?? $"inventory_{uuid}.exe";

        var tempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), filename);

        using var file    = new System.IO.FileStream(tempPath, System.IO.FileMode.Create,
                                                      System.IO.FileAccess.Write,
                                                      System.IO.FileShare.None, 81920);
        using var content = await resp.Content.ReadAsStreamAsync(ct);
        await content.CopyToAsync(file, ct);

        InstallerPath = tempPath;
    }

    // -------------------------------------------------------------------------
    // Step 7: Silently install the downloaded EXE.
    //
    // Passes /S /NORESTART to the NSIS installer.  Waits for the process to
    // exit and throws SetupException on a non-zero exit code.
    // -------------------------------------------------------------------------
    public async Task SilentInstallAsync(string installerPath, CancellationToken ct = default)
    {
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName         = installerPath,
            Arguments        = "/S /NORESTART",
            UseShellExecute  = true,
            Verb             = "runas",
        };

        System.Diagnostics.Process proc;
        try
        {
            proc = System.Diagnostics.Process.Start(psi)
                   ?? throw new SetupException("The installer process could not be started.");
        }
        catch (Exception ex) when (ex is not SetupException)
        {
            if (ex is System.ComponentModel.Win32Exception { NativeErrorCode: 1223 })
            {
                throw new SetupException(
                    "Installation requires administrator approval, but the elevation prompt was cancelled.",
                    ex);
            }

            throw new SetupException(
                $"Failed to launch installer: {ex.Message}\r\n" +
                $"Path: {installerPath}", ex);
        }

        using (proc)
        {
            await proc.WaitForExitAsync(ct);
            if (proc.ExitCode != 0)
            {
                throw new SetupException(
                    $"Installer exited with code {proc.ExitCode}.\r\n" +
                    "Try running it manually: " + installerPath);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Best-effort: revoke the setup token so it cannot be re-used.
    // Called from a finally block; never throws to the caller.
    // -------------------------------------------------------------------------
    public async Task TryRevokeTokenAsync(CancellationToken ct = default)
    {
        try
        {
            await PostJsonAsync("setup/revoke",
                new { setupToken = _config.SetupToken }, requireAuth: false, ct);
        }
        catch
        {
            // Intentionally swallowed.
        }
    }

    // -------------------------------------------------------------------------
    private async Task<JsonElement> PostJsonAsync(
        string path, object body, bool requireAuth, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body),
        };
        if (requireAuth)
        {
            if (string.IsNullOrEmpty(_accessToken))
            {
                throw new InvalidOperationException(
                    "AuthenticateAsync must run before authenticated requests.");
            }
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
        }

        HttpResponseMessage resp;
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(ApiRequestTimeout);
            resp = await _http.SendAsync(req, timeoutCts.Token);
        }
        catch (HttpRequestException ex)
        {
            throw new SetupException(
                $"Could not reach the server at {_http.BaseAddress}. " +
                $"Check your internet connection and try again.\r\n\r\nDetails: {ex.Message}",
                ex);
        }
        catch (OperationCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new SetupException(
                $"Request to /{path} timed out after {ApiRequestTimeout.TotalSeconds:0} seconds.",
                ex);
        }

        var responseBody = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            var message = ExtractServerMessage(responseBody) ?? $"HTTP {(int)resp.StatusCode}";
            throw new SetupException($"Request to /{path} failed: {message}");
        }

        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return default;
        }

        try
        {
            return JsonDocument.Parse(responseBody).RootElement.Clone();
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private static string? ExtractServerMessage(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            var root = JsonDocument.Parse(body).RootElement;
            if (root.TryGetProperty("message", out var msg))
            {
                return msg.ValueKind switch
                {
                    JsonValueKind.String => msg.GetString(),
                    JsonValueKind.Array  => string.Join("; ",
                        msg.EnumerateArray().Select(e => e.ToString())),
                    _ => msg.ToString(),
                };
            }
        }
        catch (JsonException) { /* ignore — fall through */ }
        return body.Length > 300 ? body[..300] + "..." : body;
    }

    public void Dispose() => _http.Dispose();
}

public sealed class SetupException : Exception
{
    public SetupException(string message) : base(message) { }
    public SetupException(string message, Exception inner) : base(message, inner) { }
}
