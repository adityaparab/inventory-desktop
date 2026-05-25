using System.Windows.Forms;
using System.Diagnostics;

namespace Inventory.Launcher;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        ApplicationConfiguration.Initialize();

        LauncherConfig config;
        try
        {
            config = LauncherConfig.LoadFromSelf();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.Message,
                "Inventory - Machine Setup",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        var form = new SetupForm();
        // Run the form on the UI thread; kick off the workflow in the background
        // as soon as the window is shown so the user immediately sees progress.
        form.Shown += async (_, _) => await RunWorkflowAsync(form, config);
        Application.Run(form);
        return 0;
    }

    private static async Task RunWorkflowAsync(SetupForm form, LauncherConfig config)
    {
        using var client = new SetupClient(config);
        var installationCompleted = false;

        try
        {
            // ── Step 1: Authenticate ──────────────────────────────────────────
            form.SetStep(0, SetupForm.StepState.Running);
            form.SetStatus("Authenticating...");
            form.AddLog("[step 1/7] Exchanging setup credentials with server...", SetupForm.LogKind.Info);
            form.AddLog($"           Server: {config.ApiBaseUrl}", SetupForm.LogKind.Normal);
            await client.AuthenticateAsync();
            form.AddLog("[step 1/7] Authenticated successfully.", SetupForm.LogKind.Ok);
            form.SetStep(0, SetupForm.StepState.Done);
            form.SetProgress(1);

            // ── Step 2: Detect UUID ──────────────────────────────────────────
            form.SetStep(1, SetupForm.StepState.Running);
            form.SetStatus("Detecting machine UUID...");
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("[step 2/7] Reading hardware UUID from WMI...", SetupForm.LogKind.Info);
            await client.DetectUuidAsync();
            form.AddLog($"[step 2/7] UUID detected: {client.MachineUuid}", SetupForm.LogKind.Ok);
            form.SetStep(1, SetupForm.StepState.Done);
            form.SetProgress(2);

            // ── Step 3: Detect hostname ───────────────────────────────────────
            form.SetStep(2, SetupForm.StepState.Running);
            form.SetStatus("Detecting hostname...");
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("[step 3/7] Reading computer name...", SetupForm.LogKind.Info);
            await client.DetectHostnameAsync();
            form.AddLog($"[step 3/7] Hostname: {client.Hostname}", SetupForm.LogKind.Ok);
            form.SetStep(2, SetupForm.StepState.Done);
            form.SetProgress(3);

            // ── Step 4: Register machine ─────────────────────────────────────
            form.SetStep(3, SetupForm.StepState.Running);
            form.SetStatus("Registering machine...");
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("[step 4/7] Registering machine with server...", SetupForm.LogKind.Info);
            form.AddLog($"           UUID: {client.MachineUuid}", SetupForm.LogKind.Normal);
            form.AddLog($"           Name: {client.MachineName}", SetupForm.LogKind.Normal);
            await client.RegisterMachineAsync();
            form.AddLog($"[step 4/7] Machine registered: {client.MachineName}", SetupForm.LogKind.Ok);
            form.SetStep(3, SetupForm.StepState.Done);
            form.SetProgress(4);

            // ── Step 5: Trigger build via SSE ────────────────────────────────
            form.SetStep(4, SetupForm.StepState.Running);
            form.SetStatus("Building installer (this may take a few minutes)...");
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("[step 5/7] Triggering build on the server...", SetupForm.LogKind.Info);
            form.AddLog($"           UUID: {client.MachineUuid}", SetupForm.LogKind.Normal);

            await client.StreamBuildAsync(
                client.MachineUuid!,
                onLog:    msg => form.AddLog("  build> " + msg, SetupForm.LogKind.Normal),
                onStderr: msg => form.AddLog("  build! " + msg, SetupForm.LogKind.Warn));

            form.AddLog("[step 5/7] Build completed successfully.", SetupForm.LogKind.Ok);
            form.SetStep(4, SetupForm.StepState.Done);
            form.SetProgress(5);

            // ── Step 6: Download installer ───────────────────────────────────
            form.SetStep(5, SetupForm.StepState.Running);
            form.SetStatus("Downloading installer...");
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("[step 6/7] Downloading compiled installer from server...", SetupForm.LogKind.Info);
            await client.DownloadInstallerAsync(client.MachineUuid!);
            form.AddLog($"[step 6/7] Installer saved to: {client.InstallerPath}", SetupForm.LogKind.Ok);
            form.SetStep(5, SetupForm.StepState.Done);
            form.SetProgress(6);

            // ── Step 7: Silent install ───────────────────────────────────────
            form.SetStep(6, SetupForm.StepState.Running);
            form.SetStatus("Installing...");
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("[step 7/7] Running installer silently (/S /NORESTART)...", SetupForm.LogKind.Info);
            form.AddLog($"           Path: {client.InstallerPath}", SetupForm.LogKind.Normal);
            form.AddLog("           Administrator approval may be required.", SetupForm.LogKind.Normal);
            await client.SilentInstallAsync(client.InstallerPath!);
            form.AddLog("[step 7/7] Installation completed successfully.", SetupForm.LogKind.Ok);
            form.SetStep(6, SetupForm.StepState.Done);
            form.SetProgress(7);
            installationCompleted = true;

            // ── Success summary ──────────────────────────────────────────────
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("==============================================", SetupForm.LogKind.Ok);
            form.AddLog("  Setup complete!",                             SetupForm.LogKind.Ok);
            form.AddLog("==============================================", SetupForm.LogKind.Ok);
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog($"  UUID:        {client.MachineUuid}",          SetupForm.LogKind.Info);
            form.AddLog($"  Machine:     {client.MachineName}",          SetupForm.LogKind.Info);
            form.AddLog($"  Installer:   {client.InstallerPath}",        SetupForm.LogKind.Info);
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("  The Inventory app has been installed.", SetupForm.LogKind.Normal);
            form.AddLog("  This window will close and remove itself automatically.", SetupForm.LogKind.Normal);

            // Count down so the user can read the log, then exit the process.
            for (int i = 5; i >= 1; i--)
            {
                form.SetStatus($"Setup complete. Closing in {i} second{(i != 1 ? "s" : "")}...");
                await Task.Delay(1000);
            }
            Application.Exit();
        }
        catch (SetupException sx)
        {
            MarkFailed(form);
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("ERROR: " + sx.Message, SetupForm.LogKind.Err);
            form.SetStatus("Setup failed. Review the log above, then close this window.");
        }
        catch (Exception ex)
        {
            MarkFailed(form);
            form.AddLog("", SetupForm.LogKind.Normal);
            form.AddLog("Unexpected error: " + ex.Message, SetupForm.LogKind.Err);
            form.AddLog("Stack trace:", SetupForm.LogKind.Err);
            form.AddLog(ex.StackTrace ?? "(no stack trace)", SetupForm.LogKind.Err);
            form.SetStatus("Setup failed. Review the log above, then close this window.");
        }
        finally
        {
            await client.TryRevokeTokenAsync();

            // Delete the downloaded installer — large temporary file no longer
            // needed once installation has completed (or failed before install).
            if (client.InstallerPath is { } tmp && System.IO.File.Exists(tmp))
            {
                try   { System.IO.File.Delete(tmp); }
                catch { /* best effort — don't obscure the real error */ }
            }

            if (installationCompleted)
            {
                TryScheduleSelfDeletion();
            }
        }
    }

    private static void TryScheduleSelfDeletion()
    {
        try
        {
            var executablePath = Application.ExecutablePath;

            if (string.IsNullOrWhiteSpace(executablePath) || !System.IO.File.Exists(executablePath))
            {
                return;
            }

            var command = $"/C ping 127.0.0.1 -n 3 > nul & del /F /Q \"{executablePath}\"";
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = command,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            Process.Start(psi);
        }
        catch
        {
            // Best effort only. A failed self-delete must not mask a successful install.
        }
    }

    private static void MarkFailed(SetupForm form)
    {
        // Mark the first non-Done step as failed so the user can see where it stopped.
        // (The currently-running step will already be highlighted as such.)
        // Simplest: try each step; if its label is still bold/white we know it was running.
        // Since we don't expose step state, just rely on the running step already being
        // visually distinct, and add a generic failure indication on the progress bar.
        form.SetProgress(0);
    }
}
