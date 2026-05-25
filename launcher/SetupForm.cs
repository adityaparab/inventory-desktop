using System.Drawing;
using System.Windows.Forms;

namespace Inventory.Launcher;

/// <summary>
/// Dark-themed setup window with a sidebar of 4 steps, a log panel on the right,
/// a progress bar and status line at the bottom.  Mirrors the look of the
/// previous PowerShell WinForms script.
/// </summary>
public sealed class SetupForm : Form
{
    // -- Palette --------------------------------------------------------------
    private static readonly Color C_FORM    = Color.FromArgb(14,  14,  24);
    private static readonly Color C_HEADER  = Color.FromArgb(22,  22,  38);
    private static readonly Color C_SIDEBAR = Color.FromArgb(18,  18,  32);
    private static readonly Color C_LOG_BG  = Color.FromArgb(10,  10,  20);
    private static readonly Color C_SEP     = Color.FromArgb(40,  40,  60);
    private static readonly Color C_PENDING = Color.FromArgb(70,  70,  95);
    private static readonly Color C_RUNNING = Color.FromArgb(86,  156, 214);
    private static readonly Color C_DONE    = Color.FromArgb(78,  201, 176);
    private static readonly Color C_FAIL    = Color.FromArgb(244, 71,  71);
    private static readonly Color C_TEXT    = Color.FromArgb(212, 212, 212);
    private static readonly Color C_DIM     = Color.FromArgb(100, 100, 130);
    private static readonly Color C_LOG_N   = Color.FromArgb(180, 180, 210);
    private static readonly Color C_LOG_W   = Color.FromArgb(220, 200, 80);

    // -- Fonts ----------------------------------------------------------------
    private static readonly Font F_TITLE   = new("Segoe UI",        13F, FontStyle.Bold);
    private static readonly Font F_SUB     = new("Segoe UI",         9F);
    private static readonly Font F_STEP    = new("Segoe UI",         9F);
    private static readonly Font F_STEP_AC = new("Segoe UI",         9F, FontStyle.Bold);
    private static readonly Font F_ICON    = new("Segoe UI Symbol", 11F);
    private static readonly Font F_LOG     = new("Consolas",         9F);

    // -- Step strings ---------------------------------------------------------
    private static readonly string[] StepNames =
    {
        "Authenticate",
        "Detect Machine UUID",
        "Detect Hostname",
        "Register Machine",
        "Trigger Build",
        "Download Installer",
        "Install",
    };

    // -- Glyphs ---------------------------------------------------------------
    private const string GLYPH_PENDING = "\u25CB"; // ○
    private const string GLYPH_RUNNING = "\u25B6"; // ▶
    private const string GLYPH_DONE    = "\u2713"; // ✓
    private const string GLYPH_FAILED  = "\u2717"; // ✗

    // -- Controls -------------------------------------------------------------
    private readonly Label[]      _stepDots;
    private readonly Label[]      _stepLabels;
    private readonly ProgressBar  _progress;
    private readonly Label        _status;
    private readonly RichTextBox  _log;

    public SetupForm()
    {
        Text            = "Inventory - Machine Setup";
        ClientSize      = new Size(820, 548);
        StartPosition   = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox     = false;
        BackColor       = C_FORM;
        ForeColor       = C_TEXT;

        // -- Header (58 px) --
        var header = new Panel
        {
            Dock = DockStyle.Top, Height = 58, BackColor = C_HEADER,
        };
        Controls.Add(header);
        header.Controls.Add(new Label
        {
            Text = "Inventory - Machine Setup",
            Font = F_TITLE, ForeColor = Color.White,
            AutoSize = true, Location = new Point(18, 10),
        });
        header.Controls.Add(new Label
        {
            Text = "Registers this machine, builds its installer, and installs Inventory.",
            Font = F_SUB, ForeColor = C_DIM,
            AutoSize = true, Location = new Point(20, 36),
        });

        // -- Bottom (52 px) --
        var bottom = new Panel
        {
            Dock = DockStyle.Bottom, Height = 52, BackColor = C_HEADER,
        };
        Controls.Add(bottom);

        _progress = new ProgressBar
        {
            Location = new Point(16, 8),
            Size     = new Size(788, 12),
            Minimum  = 0, Maximum = 7, Value = 0,
            Style    = ProgressBarStyle.Continuous,
        };
        bottom.Controls.Add(_progress);

        _status = new Label
        {
            Location  = new Point(16, 26),
            Size      = new Size(788, 18),
            Font      = F_SUB,
            ForeColor = C_DIM,
            Text      = "Preparing...",
        };
        bottom.Controls.Add(_status);

        // -- Sidebar (left 260 px) --
        const int sidebarHeight = 548 - 58 - 52;
        var sidebar = new Panel
        {
            Location  = new Point(0, 58),
            Size      = new Size(260, sidebarHeight),
            BackColor = C_SIDEBAR,
        };
        Controls.Add(sidebar);

        Controls.Add(new Panel
        {
            Location = new Point(260, 58),
            Size = new Size(1, sidebarHeight),
            BackColor = C_SEP,
        });

        _stepDots   = new Label[StepNames.Length];
        _stepLabels = new Label[StepNames.Length];
        int y = 14;
        for (int i = 0; i < StepNames.Length; i++)
        {
            _stepDots[i] = new Label
            {
                Location  = new Point(16, y + 1),
                Size      = new Size(22, 22),
                Font      = F_ICON,
                ForeColor = C_PENDING,
                Text      = GLYPH_PENDING,
                TextAlign = ContentAlignment.MiddleCenter,
            };
            sidebar.Controls.Add(_stepDots[i]);

            _stepLabels[i] = new Label
            {
                Location  = new Point(44, y),
                Size      = new Size(206, 24),
                Font      = F_STEP,
                ForeColor = C_PENDING,
                Text      = $"{i + 1}.  {StepNames[i]}",
                TextAlign = ContentAlignment.MiddleLeft,
            };
            sidebar.Controls.Add(_stepLabels[i]);
            y += 52;
        }

        // -- Log panel (right) --
        var logPanel = new Panel
        {
            Location  = new Point(261, 58),
            Size      = new Size(559, sidebarHeight),
            BackColor = C_LOG_BG,
        };
        Controls.Add(logPanel);

        _log = new RichTextBox
        {
            Location    = new Point(8, 8),
            Size        = new Size(543, sidebarHeight - 16),
            ReadOnly    = true,
            BackColor   = C_LOG_BG,
            ForeColor   = C_LOG_N,
            Font        = F_LOG,
            BorderStyle = BorderStyle.None,
            ScrollBars  = RichTextBoxScrollBars.Vertical,
            WordWrap    = false,
        };
        logPanel.Controls.Add(_log);
    }

    // -------------------------------------------------------------------------
    // UI mutators — all marshalled onto the UI thread so callers can invoke
    // freely from background tasks.
    // -------------------------------------------------------------------------

    public enum StepState { Running, Done, Failed }

    public void SetStep(int index, StepState state) => OnUiThread(() =>
    {
        var dot   = _stepDots[index];
        var label = _stepLabels[index];
        switch (state)
        {
            case StepState.Running:
                dot.ForeColor   = C_RUNNING;
                dot.Text        = GLYPH_RUNNING;
                label.ForeColor = Color.White;
                label.Font      = F_STEP_AC;
                break;
            case StepState.Done:
                dot.ForeColor   = C_DONE;
                dot.Text        = GLYPH_DONE;
                label.ForeColor = C_TEXT;
                label.Font      = F_STEP;
                break;
            case StepState.Failed:
                dot.ForeColor   = C_FAIL;
                dot.Text        = GLYPH_FAILED;
                label.ForeColor = C_FAIL;
                label.Font      = F_STEP;
                break;
        }
    });

    public void SetStatus(string message) => OnUiThread(() => _status.Text = message);

    public void SetProgress(int value) => OnUiThread(() =>
        _progress.Value = Math.Min(Math.Max(value, _progress.Minimum), _progress.Maximum));

    public enum LogKind { Normal, Info, Ok, Warn, Err }

    public void AddLog(string message, LogKind kind = LogKind.Normal) => OnUiThread(() =>
    {
        _log.SelectionStart  = _log.TextLength;
        _log.SelectionLength = 0;
        _log.SelectionColor  = kind switch
        {
            LogKind.Info => C_RUNNING,
            LogKind.Ok   => C_DONE,
            LogKind.Warn => C_LOG_W,
            LogKind.Err  => C_FAIL,
            _            => C_LOG_N,
        };
        _log.AppendText(message + "\r\n");
        _log.ScrollToCaret();
    });

    private void OnUiThread(Action a)
    {
        if (IsDisposed) return;
        if (InvokeRequired) Invoke(a);
        else a();
    }
}
