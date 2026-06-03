import {
  MODAL_BACKDROP_STYLE, MODAL_PANEL_STYLE, MODAL_HEADER_STYLE, MODAL_BODY_STYLE,
  HELP_TWO_COL_STYLE, HELP_SECTION_HEADING_STYLE,
  HELP_KEY_CELL_STYLE, HELP_DESC_CELL_STYLE,
} from '../theme/styles';

// Read-only help overlay (HELP mode's overlay() output).
// SPEC §Help Modal: two-column layout — NORMAL keys left, command palette right.
// Closing is HelpMode.handleKey's responsibility (q/Esc).

interface Row { keys: string; desc: string; }
interface Section { heading: string; rows: Row[]; }

const NORMAL_SECTIONS: Section[] = [
  {
    heading: 'Grid navigation',
    rows: [
      { keys: 'h / ←',          desc: 'left' },
      { keys: 'j / ↓',          desc: 'down' },
      { keys: 'k / ↑',          desc: 'up' },
      { keys: 'l / →',          desc: 'right' },
      { keys: 'gg',             desc: 'first sticker' },
      { keys: 'G',              desc: 'last sticker' },
      { keys: '0',              desc: 'first in row' },
      { keys: '$',              desc: 'last in row' },
    ],
  },
  {
    heading: 'Pack navigation',
    rows: [
      { keys: 'p / Tab',                 desc: 'next pack' },
      { keys: 'P / Shift+Tab',           desc: 'previous pack' },
      { keys: '[n]p',                    desc: 'jump to nth pack' },
      { keys: 'Ctrl+N / Ctrl+P',         desc: 'next / prev pack (alias)' },
    ],
  },
  {
    heading: 'Sticker actions',
    rows: [
      { keys: 'yy / Enter / y',  desc: 'yank (copy)' },
      { keys: 'a',               desc: 'upload modal' },
      { keys: 'd',               desc: 'delete (confirm)' },
      { keys: 'r',               desc: 'rename' },
      { keys: 't',               desc: 'edit tags' },
      { keys: 'm',               desc: 'assign packs' },
      { keys: 'f',               desc: 'toggle favourite' },
    ],
  },
  {
    heading: 'Search & misc',
    rows: [
      { keys: '/',               desc: 'search' },
      { keys: 'n / N',           desc: 'next / prev match' },
      { keys: ':',               desc: 'command palette' },
      { keys: '?',               desc: 'this help' },
      { keys: 'Ctrl+T',          desc: 'toggle theme' },
    ],
  },
];

const COMMAND_SECTIONS: Section[] = [
  {
    heading: 'Packs',
    rows: [
      { keys: ':pack new <name>',     desc: 'create pack' },
      { keys: ':pack rename <name>',  desc: 'rename current pack' },
      { keys: ':pack delete',         desc: 'delete current pack' },
      { keys: ':pack move <name>',    desc: 'add focused to named pack' },
    ],
  },
  {
    heading: 'Tags',
    rows: [
      { keys: ':tag add <tag>',           desc: 'add tag to focused' },
      { keys: ':tag remove <tag>',        desc: 'remove tag from focused' },
      { keys: ':tag rename <old> <new>',  desc: 'rename tag globally' },
      { keys: ':tag clear',               desc: 'clear all tags on focused' },
    ],
  },
  {
    heading: 'Sort',
    rows: [
      { keys: ':sort recent',  desc: 'by last used (default)' },
      { keys: ':sort added',   desc: 'by created' },
      { keys: ':sort name',    desc: 'by name' },
    ],
  },
  {
    heading: 'Import / Export',
    rows: [
      { keys: ':export',  desc: 'download full DB as zip' },
      { keys: ':import',  desc: 'pick a zip and merge' },
    ],
  },
  {
    heading: 'Theme & help',
    rows: [
      { keys: ':theme toggle',  desc: 'flip theme' },
      { keys: ':theme dark',    desc: 'force dark' },
      { keys: ':theme light',   desc: 'force light' },
      { keys: ':help',          desc: 'this help' },
    ],
  },
];

function SectionView({ section }: { section: Section }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={HELP_SECTION_HEADING_STYLE}>{section.heading}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {section.rows.map(row => (
            <tr key={row.keys}>
              <td style={HELP_KEY_CELL_STYLE}>{row.keys}</td>
              <td style={HELP_DESC_CELL_STYLE}>{row.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HelpModal() {
  return (
    <div style={MODAL_BACKDROP_STYLE}>
      <div style={{ ...MODAL_PANEL_STYLE, width: 720, maxWidth: '95%' }}>
        <div style={MODAL_HEADER_STYLE}>HELP — keybindings & commands</div>
        <div style={MODAL_BODY_STYLE}>
          <div style={HELP_TWO_COL_STYLE}>
            <div>
              {NORMAL_SECTIONS.map(s => <SectionView key={s.heading} section={s} />)}
            </div>
            <div>
              {COMMAND_SECTIONS.map(s => <SectionView key={s.heading} section={s} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
