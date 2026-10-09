/**
 * Bun-native line editor with Flyline-style inline ghost text.
 *
 * Replaces Node's readline for fgsh's interactive prompt. Built for Bun:
 * takes over stdin in raw mode, parses key bytes directly, and renders the
 * prompt with ANSI escapes. Provides inline ghost text suggestions (dimmed
 * completion shown after the cursor, accepted with Tab).
 *
 * Exposes a readline-compatible surface so fgshell.js needs minimal changes:
 *   line, cursor, setPrompt(), prompt(), pause(), resume(), close(),
 *   on('line'|'close'|'SIGINT'), removeAllListeners(), history, terminal, paused
 */

const { EventEmitter } = require('events');

const ESC = '\x1b';
const BEL = '\x07';

// ANSI helpers
const A = {
  clearLine: '\x1b[2K',
  clearToEnd: '\x1b[0J',
  cursorLeft: n => (n > 0 ? `\x1b[${n}D` : ''),
  cursorUp: n => (n > 0 ? `\x1b[${n}A` : ''),
  cursorRight: n => (n > 0 ? `\x1b[${n}C` : ''),
  cursorTo: n => `\x1b[${n + 1}G`,
  saveCursor: '\x1b7',
  restoreCursor: '\x1b8',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  rev: '\x1b[7m',
};

// Codepoints a terminal paints in zero cells: C0/C1 controls, combining
// marks (main blocks), and invisible/format controls — notably the
// zero-width space (U+200B) that powerline prompts like fgsh-prompt end
// with. String length counts these as one and would put the edit cursor
// one cell ahead of the painted text.
const ZERO_WIDTH = /[\u0000-\u001f\u007f-\u009f\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7-\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e3-\u0902\u093a\u093c\u0941-\u0948\u094d\u0951-\u0957\u0962-\u0963\u1ab0-\u1aff\u1dc0-\u1dff\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\u20d0-\u20ff\u2cef-\u2cf1\u302a-\u302f\u3099-\u309a\ufe00-\ufe0f\ufe20-\ufe2f\ufeff\ufff9-\ufffb]/u;

// Codepoints painted in two cells: East Asian wide/fullwidth ranges and
// common emoji planes. Private-use glyphs (Nerd Font icons) stay at one.
const WIDE = /[\u1100-\u115f\u2329-\u232a\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]|[\u{1f000}-\u{1faff}\u{20000}-\u{3fffd}]/u;

// Display width of a single codepoint.
function cpWidth(cp) {
  const ch = String.fromCodePoint(cp);
  if (ZERO_WIDTH.test(ch)) return 0;
  if (WIDE.test(ch)) return 2;
  return 1;
}

class LineEditor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.input = options.input || process.stdin;
    this.output = options.output || process.stdout;
    this.promptText = options.prompt || '';
    this.terminal = this.input.isTTY === true;

    this._line = '';
    this._cursor = 0;
    this._paused = false;
    this._closed = false;
    this._active = false;
    this._rawModeSet = false;

    // History
    this.history = [];
    this._historyIndex = -1;
    this._historyStash = null;

    // Ghost text (Flyline-style inline suggestions)
    this._ghost = '';
    this._ghostProvider = null; // (line) => string
    // Fuzzy completion menu
    this._menuProvider = null;  // (line) => string[]
    this._menuItems = [];
    this._menuIndex = 0;
    this._menuOpen = false;
    this._menuLines = 0;
    this._menuBase = '';        // input text the menu was built for
    this._menuNavigated = false; // user picked an entry with Up/Down
    this._menuScroll = 0;       // index of the first visible entry
    this._menuMaxRows = 10;     // entries visible before the scrollbar kicks in
    this._menuDirty = false;    // menu must be redrawn after the next _render
    // Anchor of the last paint (see _render): the rows it occupied and the
    // edit cursor's cell inside it, both relative to the prompt's home row
    // (top-left of the prompt). Every rendering operation starts and ends
    // on that edit cell, so each one can walk back to the home row first.
    this._paintedRows = 0;
    this._cursorRow = 0;
    this._editCol = 0;
    this._suppressRender = false;
    this._tabHandler = null;    // (line) => string|null
    this._onCtrlN = null;       // shell hook: file picker
    this._onCtrlR = null;       // shell hook: history picker
    this._onCtrlZ = null;       // shell hook: job control suspend

    // Input received while paused but before a picker attaches its listener
    this._pausedInput = [];

    // Kill sequence: Ctrl+C twice exits
    this._ctrlCCount = 0;

    this._onData = this._onData.bind(this);
    this._onExit = this._onExit.bind(this);

    this.input.on('exit', this._onExit);
  }

  // ---- readline-compatible surface ----

  get line() { return this._line; }
  set line(v) {
    this._line = v == null ? '' : String(v);
    if (this._cursor > this._line.length) this._cursor = this._line.length;
    if (!this._suppressRender) this._render();
  }

  get cursor() { return this._cursor; }
  set cursor(v) {
    this._cursor = Math.max(0, Math.min(Number(v) || 0, this._line.length));
    if (!this._suppressRender) this._render();
  }
  
  /** Temporarily suppress renders for batch updates. Returns a function to restore. */
  _batchRender(fn) {
    this._suppressRender = true;
    try {
      return fn();
    } finally {
      this._suppressRender = false;
      this._render();
    }
  }

  setPrompt(p) {
    this.promptText = p == null ? '' : String(p);
    if (this._active) this._render();
  }
  getPrompt() { return this.promptText; }

  get paused() { return this._paused; }
  get closed() { return this._closed; }

  pause() {
    if (this._paused) return;
    if (process.env.FGSH_DEVEL) console.error('[DEBUG] rl.pause() -> paused');
    this._paused = true;
    // Release stdin completely while paused. When the shell pauses for a
    // foreground child (job control), the child owns the terminal: keeping
    // our data listener attached and the stream flowing made the shell race
    // the child for every input byte and steal its terminal query replies
    // (e.g. neofetch's \e[14t response), hanging the child until unrelated
    // input arrived. Raw mode is left alone here — callers that hand the
    // terminal to a child already switch it to the right mode themselves.
    // Pickers re-attach via ensureRawMode(); resume()/prompt() re-arm both
    // the stream and the data listener.
    if (this.terminal) {
      if (this._rawModeSet) {
        try { this.input.off('data', this._onData); } catch (e) { /* ignore */ }
        this._rawModeSet = false;
      }
      try { if (typeof this.input.pause === 'function') this.input.pause(); } catch (e) { /* ignore */ }
    }
  }

  resume() {
    if (!this._paused) {
      if (process.env.FGSH_DEVEL) console.error('[DEBUG] rl.resume() early-return (not paused)');
      return;
    }
    if (process.env.FGSH_DEVEL) console.error('[DEBUG] rl.resume() -> running');
    this._paused = false;
    this._pausedInput = [];
    // Always take stdin back, whatever _active says: pause() released the
    // stream and the data listener on a terminal, and callers resume in
    // states where _active is not set yet (e.g. the continuation prompt),
    // which would otherwise leave input dead until the next prompt().
    // Pickers that drive the terminal themselves (OpenTUI) pause stdin
    // and may restore raw mode off on teardown, while _setRawMode
    // early-returns below because _rawModeSet is still true. Re-assert
    // both explicitly or the shell never reads another key after Ctrl+R.
    if (this.terminal && this.input.setRawMode) {
      try { this.input.setRawMode(true); } catch (e) { /* ignore */ }
    }
    try { if (typeof this.input.resume === 'function') this.input.resume(); } catch (e) { /* ignore */ }
    this._setRawMode(true);
    // Rendering is caller's responsibility (prompt(), etc.)
  }

  prompt() {
    if (process.env.FGSH_DEVEL) console.error(`[DEBUG] rl.prompt() paused=${this._paused} active=${this._active} terminal=${this.terminal}`);
    if (this._paused) {
      if (process.env.FGSH_DEVEL) console.error('[DEBUG] rl.prompt() EARLY RETURN (paused)');
      return;
    }
    this._line = '';
    this._cursor = 0;
    this._historyIndex = -1;
    this._historyStash = null;
    this._ghost = '';
    this._menuItems = [];
    this._menuIndex = 0;
    this._menuOpen = false;
    this._menuLines = 0;
    this._menuScroll = 0;
    this._menuNavigated = false;
    this._menuDirty = false;
    this._paintedRows = 0;   // this prompt starts a fresh anchor at the
    this._cursorRow = 0;     // cursor's current position
    this._editCol = 0;
    this._active = true;
    this._setRawMode(true);
    this._render();
  }

  close() {
    if (this._closed) return;
    this._cleanup();
    this._closed = true;
    this.emit('close');
  }

  /** Readline calls this to force a redraw. */
  _refreshLine() { this._render(); }

  write(data) { this._onData(Buffer.from(data)); }

  // ---- ghost text ----

  /**
   * Set the function that produces a ghost suggestion for the current input.
   * @param {(line: string) => string | Promise<string>} provider
   */
  setGhostProvider(provider) {
    this._ghostProvider = provider;
  }

  setTabHandler(handler) {
    this._tabHandler = handler;
  }

  /**
   * Set the function that produces the fuzzy match list shown in the menu.
   * Each item is either a plain string or { text, right } where `right` is
   * an optional secondary column rendered right-aligned (e.g. a relative
   * mtime). Only `text` is inserted into the line on accept.
   * @param {(line: string) => (string | {text: string, right?: string})[]} provider
   */
  setMenuProvider(provider) {
    this._menuProvider = provider;
  }

  /** Shell hook: Ctrl+N opens the file picker. */
  onCtrlN(fn) { this._onCtrlN = fn; }

  /** Shell hook: Ctrl+R opens the history picker. */
  onCtrlR(fn) { this._onCtrlR = fn; }

  get ghost() { return this._ghost; }

  // ---- raw mode plumbing ----

  /** Force raw mode + stdin flowing. Used before handing stdin to a picker. */
  ensureRawMode() {
    if (!this.terminal || !this.input.setRawMode) return;
    try {
      this.input.setRawMode(true);
      this.input.resume();
      if (!this._rawModeSet) {
        this.input.on('data', this._onData);
        this._rawModeSet = true;
      }
    } catch (e) { /* ignore */ }
  }

  _setRawMode(on) {
    if (!this.terminal || !this.input.setRawMode) return;
    if (on) {
      if (this._rawModeSet) return;
      try {
        this.input.setRawMode(true);
        this.input.resume();
        this.input.on('data', this._onData);
        this._rawModeSet = true;
      } catch (e) { /* ignore */ }
    } else {
      if (!this._rawModeSet) return;
      try {
        this.input.off('data', this._onData);
        this.input.setRawMode(false);
        this.input.pause();
      } catch (e) { /* ignore */ }
      this._rawModeSet = false;
    }
  }

  _cleanup() {
    this._setRawMode(false);
    try { this.output.write(A.showCursor); } catch (e) { /* ignore */ }
    try { this.input.off('exit', this._onExit); } catch (e) { /* ignore */ }
  }

  _onExit() {
    this._cleanup();
    this._closed = true;
    this.emit('close');
  }

  // ---- rendering ----

  /**
   * Erase any previously drawn completion menu.
   *
   * The box lives on the rows directly below the input's last painted
   * row, so erasing is one ESC[0J from that row — see _eraseBoxBelow().
   * The cursor ends back on the edit cell so the _render() anchor stays
   * valid.
   */
  _clearMenu() {
    if (!this._menuLines) return;
    this._eraseBoxBelow();
    this._menuLines = 0;
    this._menuOpen = false;
    this._menuNavigated = false;
    this._menuDirty = false;
  }

  /**
   * Erase everything from the row below the input down to the bottom of
   * the screen, then return to the edit cell (where _render() left the
   * cursor).
   *
   * Row moves use '\n' rather than CUD: at the bottom row a newline
   * scrolls the screen while CUD would clamp in place. Scrolling shifts
   * the screen content and the cursor by the same amount, so the matching
   * cursorUp() on the way back lands on the edit cell whether or not a
   * scroll happened — and ESC[0J is a single operation that cannot lose
   * rows the way stepping down one newline at a time did on short
   * terminals (the old clear loop scrolled instead of moving, leaving
   * stale menu rows behind).
   */
  _eraseBoxBelow() {
    const down = Math.max(1, this._paintedRows - this._cursorRow);
    let out = '';
    for (let i = 0; i < down; i++) out += '\n' + '\r';
    out += '\x1b[0J';
    out += A.cursorUp(down);
    out += '\r';
    if (this._editCol > 0) out += A.cursorTo(this._editCol);
    try { this.output.write(out); } catch (e) { /* ignore */ }
  }

  /**
   * Draw the fuzzy completion menu below the prompt line as a bordered box
   * with a scrollbar, like Flyline's prediction list.
   *
   * Layout (border rows are counted in _menuLines so _clearMenu erases
   * them too):
   *
   *   ╭────────────╮
   *   │ entry      │
   *   │ selected   │█  <- scrollbar thumb (only when there are more
   *   │ entry      ││     entries than fit in the window)
   *   ╰────────────╯
   *
   * The box is hung off the input's anchor (the row below the input's
   * last painted row), never off the cursor: with a wrapped line the
   * cursor sits mid-display, and hanging the box there pushed it up into
   * the input on every redraw.
   */
  _drawMenu() {
    if (!this.terminal || this._paused || !this._active) return;
    if (!this._menuOpen || !this._menuItems || !this._menuItems.length) return;
    if (!this._paintedRows) return; // no anchor yet — nowhere to hang the box

    const total = this._menuItems.length;
    // Visible window: a fixed size for this terminal — at most
    // _menuMaxRows entries, shrunk only by the terminal's height. It
    // deliberately does NOT depend on how long the typed command is or
    // how many rows its wrap occupies; when input + box exceed the space
    // left, the draw sequence below scrolls the screen cleanly (content
    // and cursor shift together) instead of corrupting rows.
    const termRows = this.output.rows || process.stdout.rows || 24;
    const maxRows = Math.max(1, Math.min(this._menuMaxRows, termRows - 6));
    const rows = Math.min(total, maxRows);

    // Keep the highlighted entry inside the window (this is what scrolls)
    if (this._menuIndex < this._menuScroll) this._menuScroll = this._menuIndex;
    if (this._menuIndex >= this._menuScroll + rows) this._menuScroll = this._menuIndex - rows + 1;
    this._menuScroll = Math.max(0, Math.min(this._menuScroll, Math.max(0, total - rows)));

    const window = this._menuItems.slice(this._menuScroll, this._menuScroll + rows);
    const hasBar = total > rows;
    const cols = this.output.columns || process.stdout.columns || 80;

    // Optional right-aligned column (command full path, or a relative
    // mtime), when any visible entry carries one
    const hasRight = window.some(it => it.right);
    let rW = 0;
    if (hasRight) {
      for (const it of window) rW = Math.max(rW, this._visibleLength(it.right));
      // Command paths can run long: cap the column at ~40% of the terminal
      rW = Math.min(rW, Math.max(8, Math.floor(cols * 0.4)));
    }

    // Inner text width: widest visible entry, clamped so the box never
    // wraps onto the next row (which would corrupt the cursor arithmetic)
    let w = 4;
    for (const it of window) w = Math.max(w, this._visibleLength(it.text));
    let maxW = cols - (hasBar ? 5 : 4); // 2 borders + 2 pads + bar + margin
    if (hasRight) maxW -= rW + 2;       // right column + gutter
    if (w > maxW) w = Math.max(4, maxW);
    const inner = w + 2 + (hasRight ? rW + 2 : 0); // 1 pad each side + gutter
    const boxW = inner + (hasBar ? 1 : 0);  // width between the two borders

    // Scrollbar: thumb sized/positioned proportionally to the window
    const bar = [];
    if (hasBar) {
      const size = Math.max(1, Math.floor((rows * rows) / total));
      const room = rows - size;
      const pos = Math.round((room * this._menuScroll) / Math.max(1, total - rows));
      for (let r = 0; r < rows; r++) {
        bar.push(r >= pos && r < pos + size ? '█' : '┃');
      }
    }

    const G = '\x1b[90m'; // dim structural color (matches the picker separator)
    const Z = '\x1b[0m';
    const drawn = [`${G}╭${'─'.repeat(boxW)}╮${Z}`];
    for (let r = 0; r < rows; r++) {
      const selected = this._menuScroll + r === this._menuIndex;
      const item = window[r];
      let text = item.text;
      if (this._visibleLength(text) > w) {
        text = [...text].slice(0, Math.max(1, w - 1)).join('') + '…';
      }
      const pad = ' '.repeat(Math.max(0, w - this._visibleLength(text)));
      let body = ' ' + text + pad;
      if (hasRight) {
        let right = item.right;
        // Long paths keep their tail (the command name) behind an ellipsis
        if (this._visibleLength(right) > rW) right = '…' + right.slice(-(rW - 1));
        body += '  ' + right.padStart(rW);
      }
      body += ' ';
      const line = selected ? `\x1b[7m${body}${Z}` : body;
      drawn.push(`${G}│${Z}${line}${hasBar ? G + bar[r] + Z : ''}${G}│${Z}`);
    }
    drawn.push(`${G}╰${'─'.repeat(boxW)}╯${Z}`);

    // From the edit cell: back to the anchor's home row, down to the row
    // below the input, and erase whatever the previous box left there.
    let out = A.cursorUp(this._cursorRow) + '\r';
    for (let i = 0; i < this._paintedRows; i++) out += '\n' + '\r';
    out += '\x1b[0J';
    // Draw the new box starting on that row. Every subsequent row is
    // preceded by '\n' + '\r' so it starts at column 0 with ONLCR off
    // (raw mode). A newline written at the bottom row scrolls the screen
    // instead of moving the cursor down — that is fine: the scroll shifts
    // the content and the cursor together, and the return path below moves
    // by the exact same row count, so the cursor lands on the edit cell
    // whether or not a scroll happened.
    for (let r = 0; r < drawn.length; r++) {
      if (r > 0) out += '\n' + '\r';
      out += drawn[r];
    }
    // Back from (home + _paintedRows + drawn.length - 1) to the edit cell.
    out += A.cursorUp(this._paintedRows + drawn.length - 1 - this._cursorRow);
    out += '\r';
    if (this._editCol > 0) out += A.cursorTo(this._editCol);
    this._menuLines = drawn.length;
    try { this.output.write(out); } catch (e) { /* ignore */ }
    // The input rows are untouched and the cursor is restored, so there is
    // nothing to repaint here (the old trailing _render() did that work
    // twice).
  }

  /**
   * Repaint the prompt line (prompt + typed text + ghost) in place.
   *
   * The paint is anchored on the prompt's home row: _paintedRows/
   * _cursorRow/_editCol record where the previous paint ended, and every
   * rendering operation starts and ends on that edit cell, so a repaint
   * can always walk back up to the home row and clear exactly the rows
   * the old paint covered.
   *
   * This is what fixes the duplication seen on small windows (or with a
   * long command): the old code repainted from wherever the cursor
   * happened to be — once the line wrapped, that was the *last* wrapped
   * row — so every keystroke painted a fresh copy of the prompt one row
   * down and left the stale one above it. It also cleared only the row
   * under the cursor, so a line that shrank kept its old wrapped rows.
   * Row moves are '\n'/cursor-up pairs whose counts cancel even when
   * writing past the bottom row scrolls the screen, so the geometry also
   * holds when the input plus menu is taller than a short terminal.
   */
  _render() {
    if (!this.terminal || this._paused || !this._active) {
      if (process.env.FGSH_DEVEL) console.error(`[DEBUG] _render skip: terminal=${this.terminal} paused=${this._paused} active=${this._active}`);
      return;
    }
    const text = this._line;
    const cursor = this._cursor;
    const cols = this.output.columns || process.stdout.columns || 80;

    // Build the ghost portion if any
    let ghost = '';
    let ghostLen = 0;
    if (this._ghost && this._ghost.startsWith(text) && this._ghost.length > text.length) {
      ghost = this._ghost.slice(text.length);
      ghostLen = this._visibleLength(ghost);
    }

    // Visible display: prompt (ANSI stripped) + text + ghost — all in
    // terminal cells, not string length (a combining char or ZWSP paints
    // narrower than it counts).
    const promptLen = this._visibleLength(this.promptText);
    const textW = this._visibleLength(text);
    const visible = promptLen + textW + ghostLen;

    // Row counts relative to the home row. A V-column display occupies
    // floor((V-1)/cols)+1 rows: terminals defer the wrap after the last
    // column, so a display ending exactly on the boundary still sits on
    // the previous row.
    const endRow = visible > 0 ? Math.floor((visible - 1) / cols) : 0;
    const newRows = endRow + 1;

    // Where the edit cursor goes: prompt + the display width of the text
    // before the cursor (cursor is a string index; wide/zero-width chars
    // make index and column differ).
    const editIdx = promptLen + this._visibleLength(text.slice(0, cursor));
    let editRow = Math.floor(editIdx / cols);
    let editCol = editIdx % cols;
    if (editIdx === visible && visible > 0 && visible % cols === 0) {
      // Cursor at the very end of a display ending on a wrap boundary:
      // the terminal sits on the previous row with the wrap pending.
      editRow = visible / cols - 1;
      editCol = cols - 1;
    }

    let out = '';
    if (this._paintedRows > 0) {
      // Back to the home row of the previous paint...
      out += A.cursorUp(this._cursorRow) + '\r';
      // ...and erase exactly the rows it covered — not just the row under
      // the cursor, or a shrunken line left its old wrapped rows behind.
      for (let i = 0; i < this._paintedRows; i++) {
        out += A.clearLine;
        if (i < this._paintedRows - 1) out += '\n' + '\r';
      }
      out += A.cursorUp(this._paintedRows - 1) + '\r';
    } else {
      out += '\r';
    }

    // Paint from the home row; the terminal wraps it as needed. (The menu
    // box below is deliberately not touched: 2K per input row leaves it
    // intact, and _drawMenu re-hangs it below the new last row right
    // after this when the input grew.)
    out += this.promptText + text;
    if (ghost) out += A.dim + ghost + A.reset;

    // Place the edit cursor relative to the end of the paint. Never walk
    // backwards with CUB across rows — cursorBack stops at column 0.
    out += A.cursorUp(endRow - editRow);
    out += '\r';
    if (editCol > 0) out += A.cursorTo(editCol);

    this._paintedRows = newRows;
    this._cursorRow = editRow;
    this._editCol = editCol;

    try { this.output.write(out); } catch (e) {
      if (process.env.FGSH_DEVEL) console.error('[DEBUG] _render write failed:', e.message);
    }
  }

  _visibleLength(s) {
    // Terminal display width: strip ANSI sequences (CSI, OSC, and the
    // two-character escapes _escapeLen knows), then sum per-codepoint
    // cell widths. Plain .length is wrong for prompts like the powerline
    // fgsh-prompt — its trailing zero-width space counts as one character
    // but paints in zero cells, which put the cursor one space ahead.
    const plain = String(s)
      .replace(/\x1b\[[0-9;?]*[a-zA-Z@`~]/g, '')
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      .replace(/\x1b_[\s\S]*?\x1b\\/g, '')
      .replace(/\x1b[@-Z\\^_]/g, '');
    let w = 0;
    for (const ch of plain) w += cpWidth(ch.codePointAt(0));
    return w;
  }

  // ---- input parsing ----

  // Escape sequences can arrive split across reads (a terminal may flush
  // "\x1b" and "[B" as separate chunks). Buffer a trailing partial sequence
  // until the rest arrives, otherwise a bare ESC is mistaken for the user
  // pressing Escape — which closes the pickers.
  _pending = '';
  _pendingTimer = null;

  /** Length of a complete escape sequence at s[i], or 0 if incomplete, -1 if not one. */
  _escapeLen(s, i) {
    if (s[i] !== ESC) return -1;
    const rest = s.slice(i);
    if (/^\x1b\[[0-9;?]*[a-zA-Z@`~]/.test(rest)) return rest.match(/^\x1b\[[0-9;?]*[a-zA-Z@`~]/)[0].length;
    if (/^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/.test(rest)) return rest.match(/^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/)[0].length;
    if (/^\x1b_[\s\S]*?\x1b\\/.test(rest)) return rest.match(/^\x1b_[\s\S]*?\x1b\\/)[0].length;
    if (/^\x1bP[\s\S]*?\x1b\\/.test(rest)) return rest.match(/^\x1bP[\s\S]*?\x1b\\/)[0].length;
    // Could still be a complete short sequence (Alt+key) or a lone ESC.
    // Treat a trailing ESC (nothing after it) as incomplete only if more
    // input is likely; callers decide via _isPartialTail.
    return -1;
  }

  /** True if s ends with the start of an escape sequence that isn't finished. */
  _isPartialTail(s) {
    if (!s) return false;
    const lastEsc = s.lastIndexOf(ESC);
    if (lastEsc < 0) return false;
    const tail = s.slice(lastEsc);
    if (tail.length === 1) return true;               // bare trailing ESC
    // ESC [ ... with no final byte yet
    if (/^\x1b\[[0-9;?]*$/.test(tail)) return true;
    // OSC with no terminator
    if (/^\x1b\][^\x07\x1b]*$/.test(tail)) return true;
    return false;
  }

  _onData(chunk) {
    if (this._closed) return;
    // While paused, input belongs to the file/history picker. The picker
    // attaches its keypress listener asynchronously (it awaits a directory
    // read first), so buffer anything that arrives before then and replay it.
    if (this._paused) {
      this._pausedInput.push(chunk);
      this._flushPausedInput();
      return;
    }
    let s = this._pending + chunk.toString('utf8');
    // Hold back a trailing partial escape sequence
    if (this._pending) {
      this._pending = '';
    } else if (this._isPartialTail(s)) {
      // A lone ESC is ambiguous: it could be the Escape key or the start of
      // a sequence split across reads. Hold it briefly; if nothing follows,
      // treat it as a real Escape.
      const keep = s.slice(s.lastIndexOf(ESC));
      this._pending = keep;
      s = s.slice(0, s.lastIndexOf(ESC));
      this._armPendingTimer();
    }
    if (!s) return;
    let i = 0;
    while (i < s.length) {
      if (this._paused) {
        // A key earlier in this chunk paused the editor (Ctrl+N/Ctrl+R
        // open a picker). The rest of the chunk belongs to the picker: queue
        // it as picker input instead of running it through _handleKey,
        // where Enter used to be swallowed by _submit() and the picker
        // never saw it (Ctrl+N+Enter arriving in one read never closed).
        this._pausedInput.push(Buffer.from(s.slice(i)));
        this._flushPausedInput();
        break;
      }
      const consumed = this._handleKey(s, i);
      i += consumed > 0 ? consumed : 1;
    }
    // Repaint first, then (re)draw the menu against the fresh anchor —
    // drawing before the repaint positioned the box against stale
    // geometry whenever the keystroke changed how many rows the line
    // wrapped into.
    this._render();
    if (this._menuDirty) {
      this._menuDirty = false;
      this._drawMenu();
    }
  }

  /** Start (or restart) the flush window for a held partial escape sequence. */
  _armPendingTimer() {
    clearTimeout(this._pendingTimer);
    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = null;
      if (!this._pending) return;
      const lone = this._pending;
      this._pending = '';
      this._deliverLoneEscape(lone);
    }, 40);
  }

  /** A lone ESC survived the flush window: deliver it as a real Escape key. */
  _deliverLoneEscape(lone) {
    if (this._paused) {
      // While a picker is open Escape must reach it (it cancels the picker).
      // If the picker hasn't attached its listener yet, queue the byte so it
      // is replayed as soon as it does.
      if (!this.listenerCount('keypress')) {
        this._pausedInput.push(Buffer.from(lone));
        return;
      }
      this._emitKeypressFor(lone);
      return;
    }
    // At the line editor, Escape dismisses the menu, then clears the line.
    if (this._menuOpen) {
      this._menuDismiss();
      this._render();
      return;
    }
    if (this._line) {
      this._batchRender(() => {
        this._line = '';
        this._cursor = 0;
        this._ghost = '';
      });
    }
  }

  _flushPausedInput() {
    if (!this._pausedInput.length) return;
    if (!this.listenerCount('keypress')) return; // picker not listening yet
    const queued = this._pausedInput;
    this._pausedInput = [];
    let s = this._pending + Buffer.concat(queued).toString('utf8');
    this._pending = '';
    if (this._isPartialTail(s)) {
      // Still incomplete — put it back for the next flush, and arm the same
      // 40ms window as the unpaused path so a genuinely lone Escape reaches
      // the picker instead of being held forever.
      this._pending = s.slice(s.lastIndexOf(ESC));
      s = s.slice(0, s.lastIndexOf(ESC));
      this._armPendingTimer();
    }
    if (s) this._emitKeypressFor(s);
  }

  /** Called when a picker attaches a keypress listener. */
  notifyKeypressListener() {
    this._flushPausedInput();
  }

  on(event, listener) {
    super.on(event, listener);
    if (event === 'keypress') this._flushPausedInput();
    return this;
  }

  /**
   * Parse raw bytes into readline-compatible (str, key) pairs and emit
   * them as a 'keypress' event. The file/history pickers listen for this.
   * Kept separate from _handleKey so picker input doesn't mutate the line.
   */
  _emitKeypressFor(data) {
    const s = data.toString('utf8');
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      let str = ch;
      let key = { name: ch, ctrl: false, meta: false, shift: false, sequence: ch };

      if (ch === ESC) {
        const rest = s.slice(i);
        const arrows = {
          '[A': 'up', '[B': 'down', '[C': 'right', '[D': 'left',
          '[H': 'home', '[F': 'end', '[3~': 'delete', '[1;5C': 'c', '[1;5D': 'd',
        };
        let m;
        if ((m = rest.match(/^\x1b\[[0-9;?]*[a-zA-Z@`~]/)) ||
            (m = rest.match(/^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/)) ||
            (m = rest.match(/^\x1b_[\s\S]*?\x1b\\/)) ||
            (m = rest.match(/^\x1bP[\s\S]*?\x1b\\/))) {
          str = m[0];
          // The map is keyed without the ESC prefix ('[B'), so strip it —
          // looking up the full sequence never matched and every arrow key
          // fell through to 'escape', which made the pickers treat
          // navigation as "cancel" and close. Also normalize the
          // application-cursor form (\x1bOB -> \x1b[B).
          let seq = str.slice(1);
          if (seq[0] === 'O') seq = '[' + seq.slice(1);
          const name = arrows[seq] || 'unknown';
          key = { name, ctrl: false, meta: false, shift: false, sequence: str };
          i += str.length;
          this.emit('keypress', str, key);
          continue;
        }
        i += 1;
        this.emit('keypress', ESC, { name: 'escape', ctrl: false, meta: true, shift: false, sequence: ESC });
        continue;
      }

      if (ch === '\r' || ch === '\n') {
        key = { name: 'return', ctrl: false, meta: false, shift: false, sequence: ch };
      } else if (ch === '\t') {
        key = { name: 'tab', ctrl: false, meta: false, shift: false, sequence: ch };
      } else if (ch === '\x7f' || ch === '\b') {
        key = { name: 'backspace', ctrl: false, meta: false, shift: false, sequence: ch };
      } else if (ch === '\x03') {
        key = { name: 'c', ctrl: true, meta: false, shift: false, sequence: ch };
      } else if (ch === '\x0e') {
        key = { name: 'n', ctrl: true, meta: false, shift: false, sequence: ch };
      } else if (ch === '\x12') {
        key = { name: 'r', ctrl: true, meta: false, shift: false, sequence: ch };
      } else if (ch < ' ') {
        // Readline-compatible control-key names: \x06 -> 'f', \x01 -> 'a',
        // etc. Using the raw byte as the name meant `key.name === 'f'`
        // never matched, so Ctrl+F never activated the pickers' filter
        // mode and typed filter text was silently dropped.
        const letter = (ch >= '\x01' && ch <= '\x1a')
          ? String.fromCharCode(ch.charCodeAt(0) + 96)
          : ch;
        key = { name: letter, ctrl: true, meta: false, shift: false, sequence: ch };
      }
      i += ch.length;
      this.emit('keypress', str, key);
    }
  }

  _handleKey(s, i) {
    const ch = s[i];

    // ESC-prefixed sequences
    if (ch === ESC) {
      const rest = s.slice(i);

      // Alt+Enter etc — ignore unknown escapes
      // Arrow keys — navigate the menu when it's open, else history/cursor
      if (rest.startsWith(ESC + '[A')) { if (!this._menuMove(-1)) this._historyPrev(); return 3; }   // Up
      if (rest.startsWith(ESC + '[B')) { if (!this._menuMove(1)) this._historyNext(); return 3; }    // Down
      if (rest.startsWith(ESC + '[C')) { this._cursorRight(); return 3; }    // Right
      if (rest.startsWith(ESC + '[D')) { this._cursorLeft(); return 3; }     // Left
      if (rest.startsWith(ESC + '[H')) { this._cursor = 0; return 3; }       // Home
      if (rest.startsWith(ESC + '[F')) { this._cursor = this._line.length; return 3; } // End
      // Ctrl+Arrow (word movement)
      if (rest.startsWith(ESC + '[1;5C')) { this._wordRight(); return 6; }
      if (rest.startsWith(ESC + '[1;5D')) { this._wordLeft(); return 6; }
      // Delete
      if (rest.startsWith(ESC + '[3~')) { this._delete(); return 4; }
      // Shift+Tab / BackTab
      if (rest.startsWith(ESC + '[Z')) { this._acceptGhost(); return 3; }
      // CSI sequences we don't handle — skip the whole sequence
      const csi = rest.match(/^\x1b\[[0-9;?]*[a-zA-Z@`~]/);
      if (csi) return csi[0].length;
      // OSC sequences (terminal replies to color/capability queries).
      // These arrive on stdin when the terminal responds to queries sent by
      // fgsh or rc-file tools (chafa). They are not user input — skip them.
      const osc = rest.match(/^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/);
      if (osc) return osc[0].length;
      // APC (kitty graphics) and DCS sequences
      const apc = rest.match(/^\x1b_[\s\S]*?\x1b\\/);
      if (apc) return apc[0].length;
      const dcs = rest.match(/^\x1bP[\s\S]*?\x1b\\/);
      if (dcs) return dcs[0].length;
      // ESC alone (Alt prefix) — drop it
      return 1;
    }

    switch (ch) {
      case '\r':
      case '\n':
        // Enter runs the line as typed. It only accepts a menu entry when
        // the entry was picked deliberately (moved with Up/Down) or when the
        // menu holds a single candidate. Without that, typing "ls" + Enter
        // silently swapped in the highlighted row ("ls -la" from history)
        // instead of running "ls" — forcing an Escape first.
        if (this._menuOpen && this._menuAcceptsOnEnter() && this._menuAccept()) return 1;
        this._submit();
        return 1;

      case '\x7f': // Backspace
      case '\b':
        this._backspace();
        return 1;

      case '\t':
        this._tab();
        return 1;

      case '\x01': // Ctrl+A — home
        this._cursor = 0;
        return 1;
      case '\x05': // Ctrl+E — end
        this._cursor = this._line.length;
        return 1;
      case '\x0b': // Ctrl+K — kill to end
        this._line = this._line.slice(0, this._cursor);
        return 1;
      case '\x15': // Ctrl+U — kill line
        this._line = this._line.slice(this._cursor);
        this._cursor = 0;
        return 1;
      case '\x17': // Ctrl+W — delete word
        this._deleteWord();
        return 1;
      case '\x03': // Ctrl+C
        this._ctrlC();
        return 1;
      case '\x04': // Ctrl+D
        this._ctrlD();
        return 1;
      case '\x02': // Ctrl+B — left
        this._cursorLeft();
        return 1;
      case '\x06': // Ctrl+F — right
        this._cursorRight();
        return 1;
      case '\x0c': // Ctrl+L — clear screen
        this._clearScreen();
        return 1;
      case '\x0e': // Ctrl+N — delegated to the shell (file picker)
        if (this._onCtrlN) this._onCtrlN();
        return 1;
      case '\x12': // Ctrl+R — delegated to the shell (history picker)
        if (this._onCtrlR) this._onCtrlR();
        return 1;
      case '\x10': // Ctrl+P — history prev
        this._historyPrev();
        return 1;
      case '\x13': // Ctrl+Y — paste
        return 1;

      // Ignore other control characters
      default:
        if (ch < ' ' && ch !== ' ') return 1;
        // Printable character — insert
        this._insert(ch);
        return ch.length; // may be multi-byte
    }
  }

  // ---- editing primitives ----

  _insert(str) {
    this._line = this._line.slice(0, this._cursor) + str + this._line.slice(this._cursor);
    this._cursor += str.length;
    this._requestGhost();
  }

  _backspace() {
    if (this._cursor <= 0) return;
    // Delete one character before the cursor (handle surrogate pairs)
    const before = this._line.slice(0, this._cursor);
    const after = this._line.slice(this._cursor);
    if (before.length === 0) return;
    // Take one code point
    const codePoints = [...before];
    codePoints.pop();
    const newBefore = codePoints.join('');
    this._line = newBefore + after;
    this._cursor = newBefore.length;
    this._requestGhost();
  }

  _delete() {
    if (this._cursor >= this._line.length) return;
    this._line = this._line.slice(0, this._cursor) + this._line.slice(this._cursor + 1);
    this._requestGhost();
  }

  _cursorLeft() { if (this._cursor > 0) this._cursor--; }
  _cursorRight() { if (this._cursor < this._line.length) this._cursor++; }

  _wordLeft() {
    let c = this._cursor;
    while (c > 0 && /\s/.test(this._line[c - 1])) c--;
    while (c > 0 && !/\s/.test(this._line[c - 1])) c--;
    this._cursor = c;
  }

  _wordRight() {
    let c = this._cursor;
    const len = this._line.length;
    while (c < len && !/\s/.test(this._line[c])) c++;
    while (c < len && /\s/.test(this._line[c])) c++;
    this._cursor = c;
  }

  _deleteWord() {
    const start = this._cursor;
    this._wordLeft();
    this._line = this._line.slice(0, this._cursor) + this._line.slice(start);
  }

  _clearScreen() {
    try { this.output.write('\x1b[2J\x1b[H'); } catch (e) {}
    // The screen — and any box below the input — is gone and the cursor
    // is at the top-left: start a fresh anchor instead of walking back
    // up to rows that no longer exist.
    this._paintedRows = 0;
    this._cursorRow = 0;
    this._editCol = 0;
    this._menuLines = 0;
    this._render();
  }

  _tab() {
    // Tab with the menu open: accept the highlighted entry. A no-op accept
    // (the row already is the line) falls through, so Tab can still take
    // the ghost suggestion or complete via the shell's completer.
    if (this._menuOpen && this._menuAccept()) return;
    // Tab: accept ghost if present, else insert spaces for indent
    if (this._ghost && this._ghost.startsWith(this._line) && this._ghost.length > this._line.length) {
      this._acceptGhost();
      return;
    }
    // Fall back to the shell's completer (readline-style) via a hook
    if (this._tabHandler) {
      const completion = this._tabHandler(this._line);
      if (completion && completion !== this._line) {
        this._line = completion;
        this._cursor = completion.length;
        this._requestGhost();
        return;
      }
    }
    // Insert two spaces
    this._insert('  ');
  }

  _acceptGhost() {
    if (!this._ghost) return;
    if (this._ghost.startsWith(this._line)) {
      this._batchRender(() => {
        this._line = this._ghost;
        this._cursor = this._line.length;
        this._ghost = '';
      });
    }
  }

  _ctrlC() {
    this._ctrlCCount++;
    if (this._ctrlCCount === 1) {
      // Clear the line, show feedback
      // Repaint without the ghost suggestion first — the aborted line stays
      // on screen and should show exactly what was typed.
      this._ghost = '';
      this._render();
      this._line = '';
      this._cursor = 0;
      this._active = false;
      try { this.output.write('\n' + A.clearLine); } catch (e) {}
      this.emit('SIGINT');
      // Re-show prompt after a beat
      setTimeout(() => {
        if (!this._closed && this._paused) this._setRawMode(true);
        else if (!this._closed) this.prompt();
      }, 50);
    } else {
      this._cleanup();
      process.exit(130);
    }
  }

  _ctrlD() {
    if (this._line.length > 0) {
      this._delete();
      return;
    }
    // EOF on empty line — exit
    this._cleanup();
    this._closed = true;
    this.emit('close');
  }

  _submit() {
    const line = this._line;
    // Erase the menu before the newline so it doesn't scroll into the output.
    // _clearMenu returns the cursor to the prompt line, which is then left
    // intact (matching the menu-closed path): the submitted line stays
    // visible and output starts on the row below it.
    this._clearMenu();
    this._menuItems = [];
    // Repaint the prompt row as the plain typed line before leaving it
    // behind: the ghost suggestion is not part of what was submitted and
    // must not linger on the executed line ("ls" + Enter used to leave
    // "ls -la" printed as if it had run).
    this._ghost = '';
    this._render();
    this._line = '';
    this._cursor = 0;
    this._active = false;
    this._historyIndex = -1;
    this._historyStash = null;
    try { this.output.write('\n'); } catch (e) {}
    if (line.trim()) {
      this.emit('line', line);
    } else {
      // Empty line — just redisplay
      this.prompt();
    }
  }

  // ---- history ----

  _historyPrev() {
    if (!this.history.length) return;
    if (this._historyIndex === -1) {
      this._historyStash = this._line;
      this._historyIndex = this.history.length;
    }
    if (this._historyIndex > 0) {
      this._historyIndex--;
      this._line = this.history[this._historyIndex];
      this._cursor = this._line.length;
    }
  }

  _historyNext() {
    if (!this.history.length || this._historyIndex === -1) return;
    if (this._historyIndex < this.history.length - 1) {
      this._historyIndex++;
      this._line = this.history[this._historyIndex];
    } else {
      this._historyIndex = -1;
      this._line = this._historyStash || '';
      this._historyStash = null;
    }
    this._cursor = this._line.length;
  }

  // ---- ghost text ----

  _requestGhost() {
    this._requestGhostText();
    this._requestMenu();
  }

  _requestGhostText() {
    if (!this._ghostProvider) {
      this._ghost = '';
      return;
    }
    const input = this._line;
    if (!input) {
      this._ghost = '';
      return;
    }
    let result;
    try {
      result = this._ghostProvider(input);
    } catch (e) {
      result = '';
    }
    if (result && typeof result.then === 'function') {
      // Async provider — resolve and update if input hasn't changed
      const gen = this._line;
      result.then(s => {
        if (this._line === gen) {
          this._ghost = s || '';
          this._render();
          // The ghost can add a wrapped row: re-hang the box below it.
          if (this._menuOpen) this._drawMenu();
        }
      }).catch(() => {});
    } else {
      this._ghost = result || '';
    }
  }

  _requestMenu() {
    if (!this._menuProvider) return;
    const input = this._line;
    // Only offer the menu once there's something to match against
    if (!input.trim()) {
      if (this._menuOpen) { this._clearMenu(); }
      this._menuItems = [];
      return;
    }
    let raw;
    try {
      raw = this._menuProvider(input) || [];
    } catch (e) {
      raw = [];
    }
    // Normalize items: plain strings become { text, right: '' }
    const items = [];
    for (const x of raw) {
      if (items.length >= 50) break;
      if (typeof x === 'string') {
        if (x.length) items.push({ text: x, right: '' });
      } else if (x && typeof x.text === 'string' && x.text.length) {
        items.push({ text: x.text, right: x.right ? String(x.right) : '' });
      }
    }
    // Don't echo what the user already typed — unless the row carries a
    // detail (the command's full path) that makes it worth showing
    const matches = items.filter(it => it.text !== input || it.right);
    if (!matches.length) {
      if (this._menuOpen) this._clearMenu();
      this._menuItems = [];
      this._menuBase = input;
      return;
    }
    // Reset selection when the query changed. Compare before overwriting
    // _menuBase — assigning first made this condition always false, so the
    // highlight carried over to the new match list instead of resetting.
    const queryChanged = this._menuBase !== input;
    this._menuItems = matches;
    this._menuBase = input;
    if (!this._menuOpen || queryChanged) {
      this._menuIndex = 0;
      this._menuScroll = 0;
      // Typing resets the selection, so any earlier Up/Down pick is void.
      this._menuNavigated = false;
    }
    this._menuOpen = true;
    // Defer the draw until after _render(): the box must hang below the
    // freshly painted input rows, not the previous ones.
    this._menuDirty = true;
  }

  /** Move the menu selection. Moving marks the choice as deliberate. */
  _menuMove(delta) {
    if (!this._menuOpen || !this._menuItems.length) return;
    const n = this._menuItems.length;
    this._menuIndex = (this._menuIndex + delta + n) % n;
    this._menuNavigated = true;
    this._drawMenu();
  }

  /**
   * Whether Enter should accept the highlighted entry instead of submitting
   * the typed line: only when the user moved the selection with Up/Down, or
   * when the menu offers exactly one candidate (an unambiguous completion).
   */
  _menuAcceptsOnEnter() {
    return this._menuNavigated || this._menuItems.length === 1;
  }

  /** Put the highlighted menu entry on the command line. */
  _menuAccept() {
    if (!this._menuOpen || !this._menuItems.length) return false;
    const choice = this._menuItems[this._menuIndex];
    if (!choice || !choice.text) return false;
    // Replace only the token being completed (the whole line when the
    // query had no space), so "cat ~/" + ".fgshrc" becomes
    // "cat ~/.fgshrc" instead of dropping the command. The secondary
    // column (path/mtime) is display-only and never inserted.
    let start = this._line.length;
    while (start > 0 && !/\s/.test(this._line[start - 1])) start--;
    const line = this._line.slice(0, start) + choice.text;
    // Highlighted row already IS the line (a command shown for its path):
    // report "no change" so Enter submits instead of swallowing the key
    if (line === this._line) return false;
    this._clearMenu();
    this._menuItems = [];
    this._batchRender(() => {
      this._ghost = '';
      this._line = line;
      this._cursor = line.length;
    });
    // A completed directory keeps predicting: show what's inside it
    if (choice.text.endsWith('/')) this._requestGhost();
    return true;
  }

  _menuDismiss() {
    if (!this._menuOpen) return;
    this._clearMenu();
    this._menuItems = [];
  }
}

module.exports = { LineEditor };
