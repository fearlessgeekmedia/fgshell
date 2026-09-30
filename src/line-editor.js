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
    this._render();
  }

  get cursor() { return this._cursor; }
  set cursor(v) {
    this._cursor = Math.max(0, Math.min(Number(v) || 0, this._line.length));
    this._render();
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
    this._paused = true;
    // Keep raw mode and the data listener attached. The file/history pickers
    // read keys from stdin while paused, and the shell's own rl.pause() calls
    // (job control) are paired with resume(), which re-asserts raw mode.
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._pausedInput = [];
    // Re-assert raw mode: the shell may have disabled it for a child process.
    if (this._active) this._setRawMode(true);
    this._requestGhost();
    this._render();
  }

  prompt() {
    if (this._paused) return;
    this._line = '';
    this._cursor = 0;
    this._historyIndex = -1;
    this._historyStash = null;
    this._ghost = '';
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

  _render() {
    if (!this.terminal || this._paused || !this._active) return;
    const text = this._line;
    // Ghost text is the suggestion suffix after the cursor
    let ghost = '';
    if (this._ghost && this._ghost.startsWith(text)) {
      ghost = this._ghost.slice(text.length);
    }

    // Two-pass render:
    //   1. draw prompt + text + dimmed ghost (cursor ends up at the far right)
    //   2. redraw without ghost, then move the cursor back to the input position
    // Using relative cursor-left movement keeps this correct when the line
    // wraps, which absolute column positioning (CSI n G) does not.
    let out = '\r' + A.clearLine;
    out += this.promptText + text;
    if (ghost) {
      out += A.dim + ghost + A.reset;
    }
    // Second pass: redraw without the ghost
    out += '\r' + A.clearLine + this.promptText + text;
    // Cursor is now just past the input text. Move it back to the insert point.
    const back = text.length - this._cursor;
    if (back > 0) out += A.cursorLeft(back);
    try { this.output.write(out); } catch (e) { /* ignore */ }
  }

  _visibleLength(s) {
    // Strip ANSI sequences for width calculation
    return s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').length;
  }

  // ---- input parsing ----

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
    const s = chunk.toString('utf8');
    let i = 0;
    while (i < s.length) {
      const consumed = this._handleKey(s, i);
      i += consumed > 0 ? consumed : 1;
    }
    this._render();
  }

  _flushPausedInput() {
    if (!this._pausedInput.length) return;
    if (!this.listenerCount('keypress')) return; // picker not listening yet
    const queued = this._pausedInput;
    this._pausedInput = [];
    for (const chunk of queued) this._emitKeypressFor(chunk);
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
          key = { name: arrows[str] || 'escape', ctrl: false, meta: false, shift: false, sequence: str };
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
        key = { name: ch, ctrl: true, meta: false, shift: false, sequence: ch };
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
      // Arrow keys
      if (rest.startsWith(ESC + '[A')) { this._historyPrev(); return 3; }   // Up
      if (rest.startsWith(ESC + '[B')) { this._historyNext(); return 3; }   // Down
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
    this._render();
  }

  _tab() {
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
      this._line = this._ghost;
      this._cursor = this._line.length;
      this._ghost = '';
    }
  }

  _ctrlC() {
    this._ctrlCCount++;
    if (this._ctrlCCount === 1) {
      // Clear the line, show feedback
      this._line = '';
      this._cursor = 0;
      this._ghost = '';
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
    this._line = '';
    this._cursor = 0;
    this._ghost = '';
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
        }
      }).catch(() => {});
    } else {
      this._ghost = result || '';
    }
  }
}

module.exports = { LineEditor };
