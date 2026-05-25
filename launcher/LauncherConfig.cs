using System.Text;
using System.Text.Json;

namespace Inventory.Launcher;

/// <summary>
/// Per-user configuration that the Nest server appends to the end of this
/// executable at download time.  Layout of the appended footer:
///
///     [ N bytes : UTF-8 JSON                                   ]
///     [ 4 bytes : little-endian uint32 = length of JSON (N)    ]
///     [ 8 bytes : magic string "INVCFG01"                      ]
///
/// The launcher reads its own file at runtime, validates the magic, and
/// deserialises the JSON.  PE images tolerate arbitrary trailing data after
/// the last section, so Windows still loads the EXE normally.
/// </summary>
public sealed record LauncherConfig(string ApiBaseUrl, string SetupToken)
{
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("INVCFG01");
    private const int FooterSize = 4 + 8; // length + magic

    /// <summary>
    /// Reads the appended footer from the running executable.  Throws an
    /// <see cref="InvalidOperationException"/> with a user-friendly message
    /// if the EXE was not configured by the server (e.g. someone downloaded
    /// the raw build artefact from GitHub instead of from the dashboard).
    /// </summary>
    public static LauncherConfig LoadFromSelf()
    {
        var exePath = Environment.ProcessPath
            ?? throw new InvalidOperationException("Unable to determine the current executable path.");

        using var stream = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.Read);

        if (stream.Length < FooterSize)
        {
            throw new InvalidOperationException(NotConfiguredMessage);
        }

        // Read the trailing 12 bytes: 4-byte length + 8-byte magic.
        stream.Seek(-FooterSize, SeekOrigin.End);
        Span<byte> tail = stackalloc byte[FooterSize];
        stream.ReadExactly(tail);

        var magicSpan = tail[4..];
        if (!magicSpan.SequenceEqual(Magic))
        {
            throw new InvalidOperationException(NotConfiguredMessage);
        }

        var jsonLength = BitConverter.ToUInt32(tail[..4]);
        if (jsonLength == 0 || jsonLength > 64 * 1024) // 64 KB sanity cap
        {
            throw new InvalidOperationException(NotConfiguredMessage);
        }

        // Seek backwards: footer + json
        stream.Seek(-(FooterSize + (long)jsonLength), SeekOrigin.End);
        var jsonBytes = new byte[jsonLength];
        stream.ReadExactly(jsonBytes);

        try
        {
            var config = JsonSerializer.Deserialize<LauncherConfig>(
                jsonBytes,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (config is null
                || string.IsNullOrWhiteSpace(config.ApiBaseUrl)
                || string.IsNullOrWhiteSpace(config.SetupToken))
            {
                throw new InvalidOperationException(NotConfiguredMessage);
            }

            return config;
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(NotConfiguredMessage, ex);
        }
    }

    private const string NotConfiguredMessage =
        "This setup program is missing its configuration.\r\n\r\n" +
        "Please download it again from the dashboard (the file you have was " +
        "not generated through the normal download flow).";
}
