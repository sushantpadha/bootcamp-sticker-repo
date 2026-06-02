// ── HelpModal ─────────────────────────────────────────────────────────────────
//
// Read-only help overlay rendered only when HELP mode is active (M16).
//
// IMPORTANT: this component does NOT handle q/Esc. Closing the modal is driven
// entirely by HelpMode.handleKey (MODES.md §Decision B): the engine routes
// those keys there, which calls engine.transitionTo('NORMAL'), which causes
// AppRoot to stop rendering this overlay.

interface KeyRow {
  keys: string;
  desc: string;
}

const SECTIONS: Array<{ heading: string; rows: KeyRow[] }> = [
  {
    heading: 'Navigation',
    rows: [
      { keys: 'h / ←',          desc: 'move left' },
      { keys: 'l / →',          desc: 'move right' },
      { keys: 'k / ↑',          desc: 'move up' },
      { keys: 'j / ↓',          desc: 'move down' },
      { keys: 'gg',             desc: 'move to first' },
      { keys: 'G',              desc: 'move to last' },
      { keys: 'Tab / Ctrl-n',   desc: 'next pack' },
      { keys: 'Shift-Tab / Ctrl-p', desc: 'prev pack' },
      { keys: '[n]p',           desc: 'cycle pack n steps' },
    ],
  },
  {
    heading: 'Actions',
    rows: [
      { keys: 'y',  desc: 'yank (copy)' },
      { keys: 'f',  desc: 'toggle favourite' },
      { keys: 'd',  desc: 'delete (confirm)' },
      { keys: 'r',  desc: 'rename' },
      { keys: 't',  desc: 'edit tags' },
      { keys: 'p',  desc: 'assign packs' },
    ],
  },
  {
    heading: 'Modes',
    rows: [
      { keys: 'a',  desc: 'upload' },
      { keys: '/',  desc: 'search' },
      { keys: ':',  desc: 'command' },
      { keys: '?',  desc: 'help' },
    ],
  },
  {
    heading: 'Close',
    rows: [
      { keys: 'q / Esc', desc: 'close help' },
    ],
  },
];

export function HelpModal() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--bg-overlay-panel)',
          border: '1px solid var(--border)',
          width: 480,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: '16px 20px',
        }}
      >
        {/* Header */}
        <div
          style={{
            color: 'var(--mode-help)',
            fontWeight: 600,
            marginBottom: 12,
            fontSize: '0.9em',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          HELP — key bindings
        </div>

        {/* Two-column sections */}
        {SECTIONS.map(section => (
          <div key={section.heading} style={{ marginBottom: 12 }}>
            <div
              style={{
                color: 'var(--text-dim)',
                fontSize: '0.8em',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 4,
                borderBottom: '1px solid var(--border)',
                paddingBottom: 2,
              }}
            >
              {section.heading}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {section.rows.map(row => (
                  <tr key={row.keys}>
                    <td
                      style={{
                        width: '45%',
                        paddingRight: 12,
                        paddingTop: 2,
                        paddingBottom: 2,
                        color: 'var(--accent)',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'top',
                      }}
                    >
                      {row.keys}
                    </td>
                    <td
                      style={{
                        color: 'var(--text)',
                        paddingTop: 2,
                        paddingBottom: 2,
                        verticalAlign: 'top',
                      }}
                    >
                      {row.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Footer hint */}
        <div
          style={{
            color: 'var(--text-dim)',
            fontSize: '0.8em',
            marginTop: 8,
            borderTop: '1px solid var(--border)',
            paddingTop: 6,
          }}
        >
          q / Esc to close
        </div>
      </div>
    </div>
  );
}
