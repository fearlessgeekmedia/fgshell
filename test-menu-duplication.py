#!/usr/bin/env python3
"""
PTY harness for fgsh's fuzzy completion menu rendering.

Spawns `bun src/fgshell.js` under a real pty, exercises the completion menu
(typing, arrow keys, Enter, Escape, submission) and replays everything the
shell wrote through a minimal ANSI screen model that also tracks reverse
video. It then asserts:

  * the prompt/line is never duplicated while typing (the original bug:
    _drawMenu moved the cursor back up n rows after writing n+1, so every
    repaint landed one row too low)
  * the menu is drawn directly below the prompt row as a bordered box
    (top border at prompt+1, first entry at prompt+2)
  * Down moves the reverse-video highlight, typing resets it to the top
  * the window scrolls with a scrollbar once more entries fit than rows
  * Enter runs the line as typed when the menu has several candidates and
    nothing was picked; it accepts an entry after Up/Down picked it (the
    "cat ~/" scroll test above), or when the menu holds a single candidate
    (e.g. "cat ~/.fgshr" + Enter). The submitted row shows exactly what
    ran — the inline ghost suggestion is never left behind on it.
  * accepting a path token keeps the command ("cat ~/" + entry ->
    "cat ~/entry"), including the "cat ~/.fgshrc" example
  * command rows show the executable's full path on the right of the box
  * Escape dismisses the menu without leaving residue
  * the optional mtime column is off by default and turns on through
    `export FGSH_MENU_MTIME=1` in ~/.fgshrc (display-only: accepting a
    entry inserts the path, never the age)
  * submitting a command keeps the typed line, prints output, and shows
    exactly one fresh prompt
  * the Ctrl+N file picker navigates with the arrow keys instead of
    closing (every arrow used to be parsed as Escape — the picker's key
    map was keyed '[B' but looked up with the ESC prefix, so navigation
    cancelled the picker), survives split escape-sequence writes, filters
    the list when printable keys are typed while open, and Escape cancels
    back to the prompt
  * a file picked after browsing into a subdirectory is inserted with the
    path relative to the shell's cwd ("docs/notes.md", not "notes.md"), a
    file in the cwd still inserts its bare name, and picker navigation
    never changes the shell's own directory (pwd is unchanged afterwards)
  * Enter always exits the picker with the highlighted entry — including a
    directory (it used to descend instead, so Enter "didn't exit") — and
    Right is the key that descends. Typing filters the list directly, the
    same as the history picker; there is no separate Ctrl+F filter mode.
    (Note: Ctrl+N+Enter delivered in a single read no longer auto-exits.
    The picker is an OpenTUI alt-screen app, and its renderer attaches to
    stdin asynchronously after Ctrl+N is handled, so an Enter that lands
    in the same read is consumed before the renderer's key listener exists.
    The Ctrl+R history picker behaves identically, so this is a property of
    the shared picker handoff, not of the file picker specifically.)
  * an image preview in a kitty session (KITTY_WINDOW_ID set) is drawn by
    OpenTUI's ImageRenderable, pinned to the kitty protocol rather than the
    default 'auto' (whose async capability probe is not answered by a bare
    pty). A kitty placement is not a text cell, so leaving the image or
    closing the picker must still tear the placement down rather than
    relying on a text-cell erase.
  * the Ctrl+R history picker (now an OpenTUI alt-screen app) opens,
    fuzzy-filters as you type, inserts the selected command on Enter,
    cancels on Escape without touching the line, and leaves the shell
    reading keyboard input afterwards (its teardown pauses stdin)
  * small windows — the line duplication/distortion regression (TODO.md
    2026-10-07): on a narrow window the wrapped input line never leaves a
    stale copy of the prompt on screen (repainting used to start from the
    last wrapped row, so every keystroke painted the prompt again one row
    down), a shrunken line clears its old wrapped rows, and on short
    terminals the fuzzy box survives drawing past the bottom (a scroll)
    with exactly one box below the live prompt, both borders, and no
    prompt row inside or below it
  * a powerline-style prompt ending in a zero-width space (U+200B, as
    built by fgsh-prompt): the cursor sits on the cell right after the
    painted text — string length counts the ZWSP as a column and put the
    cursor one space ahead of the text

Usage:  python3 test-menu-duplication.py
Exit code 0 = all checks passed, 1 = at least one failure.
"""

import base64
import fcntl
import os
import pty
import re
import select
import shutil
import signal
import struct
import sys
import tempfile
import termios
import time
import unicodedata

COLS, ROWS = 100, 40
PROMPT_MARKER = " > "        # default PS1 is "user:cwd > " (needs bun: bun:sqlite)
# A right-aligned relative-age cell rendered just inside the right border
# Note: raw_rows() are padded to full width, so this must not anchor on $
MTIME_RE = re.compile(r"(?:now|\d+(?:min|hou|Day|Mon|Yea)) [█┃]?│")
SETTLE_S = 0.45
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

failures = []


def check(cond, msg):
    print(("  ok  - " if cond else "  FAIL- ") + msg)
    if not cond:
        failures.append(msg)


# ---------------------------------------------------------------- screen model
class Screen:
    # Set by spawn() so the screen model can answer terminal queries the
    # same way a real terminal would (OpenTUI asks for the cursor position
    # before taking over the screen and restores it on teardown).
    reply_fd = None

    def __init__(self, cols=COLS, rows=ROWS):
        self.cols, self.rows = cols, rows
        # Untouched terminal output, for asserting on escape-level traffic
        # (kitty graphics sequences) that the cell model swallows.
        self.raw_bytes = bytearray()
        self.buf = [[" "] * cols for _ in range(rows)]
        self.rev = [[False] * cols for _ in range(rows)]
        self.row = self.col = 0
        self.saved = (0, 0)
        self.saved_screen = None  # main-screen snapshot while alt-screen is active
        self.reverse = False

    def _scroll(self):
        self.buf.pop(0); self.buf.append([" "] * self.cols)
        self.rev.pop(0); self.rev.append([False] * self.cols)

    def put(self, ch):
        if ch == "\n":
            self.row += 1
            if self.row >= self.rows:
                self.row = self.rows - 1
                self._scroll()
        elif ch == "\r":
            self.col = 0
        elif ch == "\b":
            self.col = max(0, self.col - 1)
        elif ch == "\t":
            self.col = min(self.cols - 1, (self.col // 8 + 1) * 8)
        elif ch >= " ":
            # Zero-width codepoints (combining marks, format controls like
            # the U+200B a powerline prompt ends with, variation selectors)
            # advance nothing in a real terminal; painting them as cells
            # would make the model disagree with actual terminals.
            if unicodedata.combining(ch) or unicodedata.category(ch) in ("Mn", "Me", "Cf"):
                return
            if self.col >= self.cols:
                self.col = 0
                self.row += 1
                if self.row >= self.rows:
                    self.row = self.rows - 1
                    self._scroll()
            self.buf[self.row][self.col] = ch
            self.rev[self.row][self.col] = self.reverse
            self.col += 1

    def clear_line(self, mode):
        if mode == 0:
            rng = range(self.col, self.cols)
        elif mode == 1:
            rng = range(0, min(self.col + 1, self.cols))
        else:
            rng = range(0, self.cols)
        for c in rng:
            self.buf[self.row][c] = " "
            self.rev[self.row][c] = False

    def clear_display(self, mode):
        if mode == 2:
            self.buf = [[" "] * self.cols for _ in range(self.rows)]
            self.rev = [[False] * self.cols for _ in range(self.rows)]
        elif mode == 0:
            self.clear_line(0)
            for r in range(self.row + 1, self.rows):
                self.buf[r] = [" "] * self.cols
                self.rev[r] = [False] * self.cols
        elif mode == 1:
            self.clear_line(1)
            for r in range(0, self.row):
                self.buf[r] = [" "] * self.cols
                self.rev[r] = [False] * self.cols

    def csi(self, params, final):
        if final == "n" and params in ("6", "?6"):
            # CPR: cursor position report — a real terminal replies on stdin.
            if self.reply_fd is not None:
                prefix = "?" if params == "?6" else ""
                reply = f"\x1b[{prefix}{self.row + 1};{self.col + 1}R"
                try:
                    os.write(self.reply_fd, reply.encode())
                except OSError:
                    pass
            return
        n = int(params.split(";")[0]) if params.split(";")[0].isdigit() else None
        if final == "A":
            self.row = max(0, self.row - (n or 1))
        elif final == "B":
            self.row = min(self.rows - 1, self.row + (n or 1))
        elif final == "C":
            self.col = min(self.cols - 1, self.col + (n or 1))
        elif final == "D":
            self.col = max(0, self.col - (n or 1))
        elif final == "G":
            self.col = max(0, min(self.cols - 1, (n or 1) - 1))
        elif final in ("H", "f"):
            parts = (params or "1;1").split(";")
            r = int(parts[0]) if parts[0].isdigit() else 1
            c = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 1
            self.row = max(0, min(self.rows - 1, r - 1))
            self.col = max(0, min(self.cols - 1, c - 1))
        elif final == "s":  # save cursor (ANSI.SYS)
            self.saved = (self.row, self.col)
        elif final == "u":  # restore cursor (ANSI.SYS)
            self.row, self.col = self.saved
        elif final == "K":
            self.clear_line(int(params) if params.isdigit() else 0)
        elif final == "J":
            self.clear_display(int(params) if params.isdigit() else 0)
        elif final == "m":
            for p in (params or "0").split(";"):
                if p in ("", "0"):
                    self.reverse = False
                elif p == "7":
                    self.reverse = True
                elif p == "27":
                    self.reverse = False
        # other finals (h/l/ etc): no visual text effect

    def alt_screen(self, on):
        """CSI ?1049 h/l: swap to/from the alternate screen buffer."""
        if on and self.saved_screen is None:
            self.saved_screen = (self.buf, self.rev, self.row, self.col)
            self.buf = [[" "] * self.cols for _ in range(self.rows)]
            self.rev = [[False] * self.cols for _ in range(self.rows)]
            self.row = self.col = 0
        elif not on and self.saved_screen is not None:
            self.buf, self.rev, self.row, self.col = self.saved_screen
            self.saved_screen = None

    def feed(self, data: bytes):
        self.raw_bytes += data
        s = data.decode("utf-8", errors="replace")
        i, n = 0, len(s)
        while i < n:
            ch = s[i]
            if ch == "\x1b":
                # Broadened parameter class: terminals also send query/
                # response forms like [?1016$p, [>0q, [?1004;0$y which a
                # real terminal consumes silently — the old [0-9;?]* class
                # missed them and the tail was painted as literal text.
                m = re.match(r"\x1b\[([0-9;?<>=!$'*\"]*)([A-Za-z@`~])", s[i:])
                if m:
                    if m.group(1) == "?1049" and m.group(2) in ("h", "l"):
                        self.alt_screen(m.group(2) == "h")
                    elif re.fullmatch(r"[0-9;]*", m.group(1)) or m.group(1) in ("6", "?6"):
                        self.csi(m.group(1), m.group(2))
                    # else: capability query/response — swallowed like a
                    # real terminal would (it replies on stdin instead).
                    i += m.end()
                    continue
                m = re.match(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)", s[i:])
                if m:
                    i += m.end()
                    continue
                m = re.match(r"\x1b[P_^].*?\x1b\\", s[i:], re.S)
                if m:
                    i += m.end()
                    continue
                if s[i:i + 2] in ("\x1b7", "\x1b8"):
                    if s[i:i + 2] == "\x1b7":
                        self.saved = (self.row, self.col)
                    else:
                        self.row, self.col = self.saved
                    i += 2
                    continue
                i += 2  # unknown ESC sequence: skip it
                continue
            self.put(ch)
            i += 1

    def lines(self):
        return ["".join(r).rstrip() for r in self.buf]

    def raw_rows(self):
        return ["".join(r) for r in self.buf]

    def prompt_rows(self):
        return [r for r in self.raw_rows() if PROMPT_MARKER in r]

    def prompt_index(self):
        for i, r in enumerate(self.raw_rows()):
            if PROMPT_MARKER in r:
                return i
        return -1

    def menu_row_count(self):
        idx = self.prompt_index()
        if idx < 0:
            return 0
        return len([ln for ln in self.lines()[idx + 1:] if ln.strip()])

    def selected_menu_row(self):
        """Index of the reverse-video row below the prompt, or -1."""
        idx = self.prompt_index()
        if idx < 0:
            return -1
        for i in range(idx + 1, self.rows):
            if any(self.rev[i]):
                return i
        return -1

    def line_text(self):
        """What's currently on the input line after the prompt marker."""
        idx = self.prompt_index()
        if idx < 0:
            return None
        return self.raw_rows()[idx].split(PROMPT_MARKER, 1)[1].rstrip()

    def picker_open(self):
        """True while the Ctrl+N file picker's header is on screen (OpenTUI)."""
        return any("File Picker" in r for r in self.raw_rows())

    def picker_sel_row(self):
        """Row index of the picker's selected entry (OpenTUI '▶' marker), or -1."""
        for i, r in enumerate(self.raw_rows()):
            if re.search(r"▶ \[[DF]\]", r):
                return i
        return -1

    def picker_sel_index(self):
        """Position of the highlighted entry within the list (0-based), or -1.

        The OpenTUI list pads each entry with a blank spacer row, so screen
        rows are not contiguous. Counting only entry rows makes up/down
        assertions stable across that spacing.
        """
        n = -1
        for r in self.raw_rows():
            if re.search(r"▶ \[[DF]\]", r) or re.search(r"^\s*\[[DF]\] ", r):
                n += 1
                if "▶" in r:
                    return n
        return -1

    def picker_path(self):
        """The absolute directory the picker is browsing.

        The OpenTUI picker renders the title and the browsed path on
        separate lines, so the path is the bare line right under the title.
        """
        rows = [r.strip() for r in self.raw_rows()]
        for i, r in enumerate(rows):
            if "File Picker" in r:
                # The path is the next non-blank line (the layout leaves a
                # blank spacer row between the title and the path).
                for nxt in rows[i + 1:]:
                    if nxt:
                        return nxt
        return ""


# ----------------------------------------------------------------- pty driver
def spawn(rc_line=None, start_dir=None, kitty=False, cols=None, rows=None):
    cols = COLS if cols is None else cols
    rows = ROWS if rows is None else rows
    home = tempfile.mkdtemp(prefix="fgsh-home-")
    # Fixture files: a directory, two plain names, and enough fileNN entries
    # to overflow the menu's 10-row window (which forces the scrollbar).
    os.mkdir(os.path.join(home, "docs"))
    os.mkdir(os.path.join(home, "emptydir"))  # Enter with nothing listed must still close
    open(os.path.join(home, "docs", "notes.md"), "w").write("# notes\n")
    for name in (".fgshrc", "alpha.txt"):
        open(os.path.join(home, name), "w").close()
    for i in range(1, 16):
        open(os.path.join(home, "file%02d" % i), "w").close()
    if kitty:
        # Fixture image for the kitty preview session: a 1x1 PNG, sorted
        # right after .fgshrc among the files (directories come first).
        open(os.path.join(home, "a.png"), "wb").write(base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
            "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="))
    if rc_line:
        with open(os.path.join(home, ".fgshrc"), "w") as fh:
            fh.write(rc_line + "\n")
    env = dict(os.environ)
    env.pop("FGSH_MENU_MTIME", None)  # configured only via .fgshrc here
    env.update({
        "HOME": home,
        "TERM": "xterm-256color",
        "PS1": "",           # force the default colored prompt
        "FGSH_DEBUG": "",
        # bun drops a .bun cache dir into $HOME on startup, which then
        # shows up as the picker's first entry and breaks the fixture's
        # "docs/ is first" expectations — keep it outside the fixture home.
        "XDG_CACHE_HOME": os.path.join(tempfile.gettempdir(), "fgsh-bun-cache"),
    })
    if kitty:
        env["KITTY_WINDOW_ID"] = "1"  # getImageSupport() => 'kitty'
    if start_dir == "HOME":
        start_dir = home
    pid, fd = pty.fork()
    if pid == 0:  # child
        os.chdir(start_dir or PROJECT_DIR)
        # Absolute script path: start_dir may be outside the project.
        os.execvpe("bun", ["bun", os.path.join(PROJECT_DIR, "src", "fgshell.js")], env)
    Screen.reply_fd = fd  # let the screen model answer CPR queries
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    return pid, fd, home


def read_until_idle(fd, idle=SETTLE_S, timeout=15.0):
    out = b""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r, _, _ = select.select([fd], [], [], idle)
        if not r:
            break
        try:
            chunk = os.read(fd, 65536)
        except OSError:
            break
        if not chunk:
            break
        out += chunk
    return out


def dump(screen, label):
    print(f"== {label} ==")
    for i, ln in enumerate(screen.lines()):
        if ln.strip():
            marker = " <<" if PROMPT_MARKER in screen.raw_rows()[i] else ""
            print(f"  {i:2d} | {ln}{marker}")


def wait_for_prompt(fd, screen, idle=0.4):
    """Wait for the shell to actually draw its prompt before typing,
    otherwise keystrokes land while bun is booting."""
    deadline = time.time() + 20
    while time.time() < deadline and not screen.prompt_rows():
        r, _, _ = select.select([fd], [], [], 0.3)
        if r:
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                break
            if not chunk:
                break
            screen.feed(chunk)
    screen.feed(read_until_idle(fd, idle=idle))


def cleanup(pid, fd, home):
    Screen.reply_fd = None
    try:
        os.kill(pid, signal.SIGKILL)
    except OSError:
        pass
    try:
        os.close(fd)
    except OSError:
        pass
    shutil.rmtree(home, ignore_errors=True)


def send(fd, screen, data, label, expect_single_prompt=True):
    if isinstance(data, str):
        data = data.encode()
    os.write(fd, data)
    screen.feed(read_until_idle(fd))
    dump(screen, label)
    rows = screen.prompt_rows()
    # The Ctrl+N/Ctrl+R pickers take over the alternate screen, so there is
    # no shell prompt row to count while they are open. Asserting a single
    # prompt there would fail by design, so skip it until the picker closes.
    if expect_single_prompt and not screen.picker_open():
        check(len(rows) == 1, f"single prompt {label!r} (got {len(rows)})")
    return rows


def main():
    pid, fd, home = spawn()
    screen = Screen()
    try:
        wait_for_prompt(fd, screen)
        dump(screen, "startup")
        check(len(screen.prompt_rows()) == 1, "exactly one prompt after startup")

        # --- typing opens the menu; prompt must never duplicate -------------
        send(fd, screen, "e", "type 'e'")
        check(screen.menu_row_count() >= 1, "menu drawn below prompt")
        check(screen.selected_menu_row() == screen.prompt_index() + 2,
              "first menu entry highlighted below the top border")

        # --- Down arrow moves the highlight --------------------------------
        send(fd, screen, "\x1b[B", "down arrow")
        pidx = screen.prompt_index()
        check(screen.selected_menu_row() == pidx + 3,
              f"highlight moved to second entry (row {screen.selected_menu_row()})")

        # --- typing more resets the highlight to the top --------------------
        send(fd, screen, "c", "type 'c' (line='ec')")
        pidx = screen.prompt_index()
        check(screen.selected_menu_row() == pidx + 2,
              "highlight reset to first entry after query changed")
        check(screen.menu_row_count() >= 1, "menu still drawn for 'ec'")

        # --- keep typing; the menu refilters, prompt stays single -----------
        send(fd, screen, "h", "type 'h' (line='echo'...)")
        send(fd, screen, "o", "type 'o' (line='echo')")
        check(screen.line_text() == "echo", f"line is 'echo' ({screen.line_text()!r})")

        # --- backspace refilters --------------------------------------------
        # (Can't assert the raw line here: ghost text makes the rendered
        # row longer than the line. The menu proves the refilter: 'echo' has
        # only an exact match, which is filtered out, while 'ech' still
        # offers 'echo'.)
        send(fd, screen, "\x7f", "backspace (line='ech')")
        check(screen.menu_row_count() >= 1, "menu redrawn after backspace (line='ech')")

        # --- Enter accepts a single-candidate menu -------------------------
        # ('ech' has exactly one match, so Enter completes it to 'echo'.)
        send(fd, screen, "\r", "enter (accept single candidate)")
        pidx = screen.prompt_index()
        check(screen.menu_row_count() == 0, "menu erased after accept")
        check(bool(screen.line_text()), f"line filled by accept ({screen.line_text()!r})")

        # --- Escape dismisses the menu, second Escape clears the line --------
        send(fd, screen, "\x1b", "escape (clear accepted line)")
        check(screen.line_text() == "", "line cleared after accept")
        send(fd, screen, "e", "type 'e'")
        check(screen.menu_row_count() >= 1, "menu open again")
        send(fd, screen, "\x1b", "escape (dismiss menu)")
        check(screen.menu_row_count() == 0, "menu dismissed with no residue")
        check((screen.line_text() or "").startswith("e"), "line kept after dismissing menu")
        send(fd, screen, "\x1b", "escape again (clear line)")
        check(screen.line_text() == "", "line cleared")

        # --- bordered box, scrollbar, and "~/" path prediction --------------
        send(fd, screen, "cat ~/", "type 'cat ~/'")
        pidx = screen.prompt_index()
        raw = screen.raw_rows()
        below = raw[pidx + 1] if pidx >= 0 else ""
        check("\u256d" in below and "\u256e" in below,
              "top border drawn directly below the prompt")
        check(screen.selected_menu_row() == pidx + 2,
              "first entry highlighted below the border")
        check(any("\u2570" in r and "\u256f" in r for r in raw[pidx:]),
              "bottom border drawn")
        check(any(".fgshrc" in r for r in raw[pidx:]),
              "home files listed after 'cat ~/'")
        check((screen.line_text() or "").startswith("cat ~/"),
              f"line starts with 'cat ~/' ({screen.line_text()!r})")
        n_rows = screen.menu_row_count()
        check(n_rows == 12,
              f"box capped at 10 entries + 2 border rows ({n_rows})")
        check(any("\u2588" in r for r in raw[pidx:]), "scrollbar thumb present")

        # Down scrolls the window once the highlight hits the bottom row
        send(fd, screen, "\x1b[B" * 9, "down x9")
        pidx = screen.prompt_index()
        check(screen.selected_menu_row() == pidx + 11,
              f"highlight on last visible entry (row {screen.selected_menu_row() - pidx})")
        hl_before = screen.raw_rows()[screen.selected_menu_row()]
        send(fd, screen, "\x1b[B", "down x10 (scrolls)")
        pidx = screen.prompt_index()
        check(screen.selected_menu_row() == pidx + 11,
              "highlight stays on bottom row while the list scrolls")
        hl_after = screen.raw_rows()[screen.selected_menu_row()]
        check(hl_before != hl_after, "window scrolled to the next entries")

        # Accept replaces only the token under completion, keeping the command
        send(fd, screen, "\r", "accept highlighted path")
        txt = screen.line_text() or ""
        check(txt.startswith("cat ~/") and len(txt) > len("cat ~/"),
              f"token replaced in place ({txt!r})")
        check(screen.menu_row_count() == 0, "menu erased after path accept")

        # The goal example: cat ~/.fgshrc via a narrowed prediction.
        # (.fgshell_history.db lands in the same temp HOME, so the prefix
        # has to be longer than ".fg" to leave exactly one candidate.)
        send(fd, screen, "\x1b", "escape (clear line)")
        check(screen.line_text() == "", "line cleared before example")
        send(fd, screen, "cat ~/.fgshr", "type 'cat ~/.fgshr'")
        check(screen.menu_row_count() == 3,
              "single candidate boxed (entry + 2 border rows)")
        pidx = screen.prompt_index()
        check(not any(MTIME_RE.search(r) for r in screen.raw_rows()[pidx:]),
              "no mtime column by default")
        send(fd, screen, "\r", "accept '.fgshrc'")
        check(screen.line_text() == "cat ~/.fgshrc",
              f"completed to cat ~/.fgshrc ({screen.line_text()!r})")
        check(screen.menu_row_count() == 0, "menu erased after accept")
        send(fd, screen, "\x1b", "escape (clear line)")
        check(screen.line_text() == "", "line cleared")

        # --- command rows show the executable's full path on the right -----
        send(fd, screen, "cat", "type 'cat'")
        pidx = screen.prompt_index()
        check(any(re.search(r"/\S*/cat [█┃]?│", r)
                  for r in screen.raw_rows()[pidx:]),
              "full path of the command shown on the right of the box")
        send(fd, screen, "\x1b", "escape (dismiss menu)")
        send(fd, screen, "\x1b", "escape (clear line)")
        check(screen.line_text() == "", "line cleared after path check")

        # --- submit a command ------------------------------------------------
        # 'pwd' still has menu candidates (pwdecrypt, pwdx), but nothing was
        # picked with Up/Down, so Enter submits it as typed.
        send(fd, screen, "pwd", "type 'pwd'")
        send(fd, screen, "\x1b", "escape (dismiss menu before submit)")
        check(screen.menu_row_count() == 0, "menu dismissed before submit")
        send(fd, screen, "\r", "submit 'pwd'", expect_single_prompt=False)
        raw = screen.raw_rows()
        marker_rows = [i for i, r in enumerate(raw) if PROMPT_MARKER in r]
        fresh = [i for i in marker_rows if raw[i].rstrip().endswith(">")]
        check(len(marker_rows) == 2,
              f"submitted line kept once + one fresh prompt ({len(marker_rows)} rows)")
        check(len(fresh) == 1, "exactly one fresh (empty) prompt")
        check(any(PROJECT_DIR in ln for ln in screen.lines()),
              "command output present below the submitted line")

    finally:
        cleanup(pid, fd, home)

    # --- optional mtime column, configured through ~/.fgshrc -------------
    mtime_session()
    picker_session()
    picker_subdir_session()
    kitty_preview_session()
    history_session()
    small_window_sessions()
    cursor_session()

    print()
    if failures:
        print(f"RESULT: FAIL ({len(failures)} check(s) failed)")
        return 1
    print("RESULT: PASS (all checks)")
    return 0


def mtime_session():
    """Second shell whose ~/.fgshrc enables the optional mtime column.

    The box gains a right-aligned relative age next to the border, and
    accepting an entry still inserts only the path — never the age.
    """
    pid, fd, home = spawn(rc_line="export FGSH_MENU_MTIME=1")
    screen = Screen()
    try:
        wait_for_prompt(fd, screen)

        send(fd, screen, "cat ~/", "mtime: type 'cat ~/'")
        pidx = screen.prompt_index()
        raw = screen.raw_rows()
        check(0 <= pidx + 1 < len(raw) and "\u256d" in raw[pidx + 1],
              "mtime: box drawn below prompt")
        check(any(MTIME_RE.search(r) for r in raw[pidx:]),
              "mtime column shown when enabled via ~/.fgshrc")

        # Narrow to the one candidate, then accept it
        send(fd, screen, ".fgshr", "mtime: narrow to .fgshrc")
        check(screen.menu_row_count() == 3, "mtime: single candidate boxed")
        send(fd, screen, "\r", "mtime: accept '.fgshrc'")
        check(screen.line_text() == "cat ~/.fgshrc",
              f"mtime: accepted line has no mtime ({screen.line_text()!r})")
        check(screen.menu_row_count() == 0, "mtime: menu erased after accept")

        # Enter with the exact-command row highlighted must SUBMIT: a no-op
        # accept (row already is the line) may not swallow the keypress.
        send(fd, screen, "\x1b", "mtime: clear line")
        check(screen.line_text() == "", "mtime: line cleared before submit")
        send(fd, screen, "pwd", "mtime: type 'pwd'")
        send(fd, screen, "\r", "mtime: Enter on exact row",
             expect_single_prompt=False)
        raw = screen.raw_rows()
        marker_rows = [i for i, r in enumerate(raw) if PROMPT_MARKER in r]
        fresh = [i for i in marker_rows if raw[i].rstrip().endswith(">")]
        check(len(marker_rows) == 2,
              f"Enter submitted instead of being swallowed ({len(marker_rows)} marker rows)")
        check(len(fresh) == 1, "exactly one fresh prompt after Enter-submit")
        check(any(PROJECT_DIR in ln for ln in screen.lines()),
              "pwd output present after Enter-submit")

        # --- Enter runs the typed line; only a picked entry is accepted ----
        # ('pw' matches pwd/pwdx/pwsh/...; the highlighted row is not what
        #  you typed, but Enter must submit 'pw' — the original "type ls,
        #  run ls -la" bug.) Note: marker rows from the pwd submit above are
        #  still on screen, so prompt counts are relative.
        send(fd, screen, "pw", "mtime: type 'pw' (several candidates)",
             expect_single_prompt=False)
        marker = [i for i, r in enumerate(screen.raw_rows()) if PROMPT_MARKER in r]
        live = marker[-1]
        check("\u256d" in screen.raw_rows()[live + 1],
              "menu open below the live prompt for 'pw'")
        send(fd, screen, "\r", "mtime: Enter without a pick",
             expect_single_prompt=False)
        marker = [i for i, r in enumerate(screen.raw_rows()) if PROMPT_MARKER in r]
        check(len(marker) == 3,
              f"pw submitted + one fresh prompt ({len(marker)} marker rows)")
        submitted = screen.raw_rows()[marker[1]].split(PROMPT_MARKER, 1)[1].rstrip()
        check(submitted == "pw", f"Enter ran what was typed ({submitted!r})")
    finally:
        cleanup(pid, fd, home)


def picker_session():
    """Fresh shell: Ctrl+N file picker navigation.

    Arrow keys must move the selection while the picker stays open. They
    used to be emitted with key.name 'escape' (the key-name map was keyed
    without the ESC prefix and never matched), so the first arrow quit the
    picker and dropped the user back at the prompt.
    """
    pid, fd, home = spawn()
    screen = Screen()
    try:
        wait_for_prompt(fd, screen)

        send(fd, screen, "\x0e", "ctrl+N opens the file picker")
        check(screen.picker_open(), "picker opens on the alternate screen")
        base = screen.picker_sel_index()
        check(base == 0, f"first entry highlighted on open (index {base})")

        send(fd, screen, "\x1b[B", "picker: down arrow")
        check(screen.picker_open(), "picker still open after down arrow")
        check(screen.picker_sel_index() == base + 1,
              f"selection moved down (index {screen.picker_sel_index()})")

        send(fd, screen, "\x1b[B", "picker: down arrow again")
        check(screen.picker_sel_index() == base + 2,
              f"selection moved down twice (index {screen.picker_sel_index()})")
        send(fd, screen, "\x1b[A", "picker: up arrow")
        check(screen.picker_sel_index() == base + 1,
              f"selection moved back up (index {screen.picker_sel_index()})")

        # Terminals may split an escape sequence across two writes
        os.write(fd, b"\x1b")
        time.sleep(0.01)
        os.write(fd, b"[B")
        screen.feed(read_until_idle(fd))
        check(screen.picker_open(), "picker open after split-write arrow")
        check(screen.picker_sel_index() == base + 2,
              f"split-write arrow still navigates (index {screen.picker_sel_index()})")

        # Printable keys filter the list directly (like the history picker);
        # the picker must stay open rather than dropping back to the prompt.
        send(fd, screen, "z", "picker: printable key while open")
        check(screen.picker_open(), "picker filters and stays open on a printable key")
        check(any("Filter: z" in r for r in screen.raw_rows()),
              "picker records the filter query")

        # Escape cancels the picker and returns to the prompt
        send(fd, screen, "\x1b", "picker: escape cancels")
        send(fd, screen, "y", "type at the prompt again")
        check(not screen.picker_open(), "picker closed by escape")
        check((screen.line_text() or "").startswith("y"),
              f"typing works at the prompt ({screen.line_text()!r})")
    finally:
        cleanup(pid, fd, home)


def picker_subdir_session():
    """Fresh shell started in the fixture HOME.

    Enter must exit the picker with the highlighted entry (file OR
    directory) — descending is Right's job. Picking a file after browsing
    into a subdirectory must insert the path relative to the shell's cwd
    (docs/notes.md, not the bare notes.md), a file that lives in the cwd
    still inserts its bare name, Ctrl+F opens filter mode, a Ctrl+N+Enter
    single-chunk write still exits, and browsing inside the picker must
    never change the shell's own directory.
    """
    pid, fd, home = spawn(start_dir="HOME")
    screen = Screen()
    try:
        wait_for_prompt(fd, screen)

        # --- the picker opens rooted at the shell's cwd --------------------
        send(fd, screen, "\x0e", "subdir: ctrl+N opens the file picker")
        check(screen.picker_open(), "subdir: picker header drawn")
        check(screen.picker_path() == home,
              f"subdir: picker rooted at the shell cwd ({screen.picker_path()!r})")
        sel = screen.raw_rows()[screen.picker_sel_row()]
        check("[D] docs" in sel,
              f"subdir: docs/ is the first (highlighted) entry ({sel.strip()!r})")

        # --- Enter on a directory EXITS with it (it used to descend, so
        # pressing Enter in a list topped by a directory never closed) -----
        send(fd, screen, "\r", "subdir: Enter on the highlighted directory")
        check(not screen.picker_open(),
              "subdir: Enter exits the picker even on a directory")
        check(screen.line_text() == "docs",
              f"subdir: directory path inserted ({screen.line_text()!r})")
        send(fd, screen, "\x1b", "subdir: clear the line")
        check(screen.line_text() == "", "subdir: line cleared")

        # --- Right descends into the subdirectory --------------------------
        send(fd, screen, "\x0e", "subdir: reopen the file picker")
        send(fd, screen, "\x1b[C", "subdir: right arrow descends into docs/")
        check(screen.picker_path() == os.path.join(home, "docs"),
              f"subdir: picker path follows into docs/ ({screen.picker_path()!r})")
        sel = screen.raw_rows()[screen.picker_sel_row()]
        check("[F] notes.md" in sel,
              f"subdir: notes.md listed and highlighted ({sel.strip()!r})")

        # --- selecting the file inserts the cwd-relative path --------------
        send(fd, screen, "\r", "subdir: select notes.md")
        check(not screen.picker_open(), "subdir: picker closed after selection")
        check(screen.line_text() == "docs/notes.md",
              f"subdir: inserted cwd-relative path ({screen.line_text()!r})")

        # --- a file in the cwd still inserts its bare name -----------------
        send(fd, screen, "\x1b", "subdir: clear the line")
        check(screen.line_text() == "", "subdir: line cleared")
        send(fd, screen, "\x0e", "subdir: reopen the file picker")
        check(screen.picker_open(), "subdir: picker reopened at HOME")
        found = False
        for _ in range(25):  # walk the list until the known file is selected
            row = screen.raw_rows()[screen.picker_sel_row()]
            if "] alpha.txt" in row:
                found = True
                break
            os.write(fd, b"\x1b[B")
            screen.feed(read_until_idle(fd))
        check(found, "subdir: located alpha.txt in the picker")
        send(fd, screen, "\r", "subdir: select alpha.txt")
        check(screen.line_text() == "alpha.txt",
              f"subdir: bare name inserted for a file in the cwd ({screen.line_text()!r})")

        # --- Enter with an empty list still closes the picker --------------
        send(fd, screen, "\x1b", "subdir: clear the line")
        send(fd, screen, "\x0e", "subdir: reopen the file picker")
        send(fd, screen, "\x1b[B", "subdir: down to emptydir")
        sel = screen.raw_rows()[screen.picker_sel_row()]
        check("[D] emptydir" in sel,
              f"subdir: emptydir highlighted ({sel.strip()!r})")
        send(fd, screen, "\x1b[C", "subdir: right descends into emptydir")
        check(screen.picker_open(), "subdir: picker now lists an empty directory")
        check(any("(no files)" in r for r in screen.raw_rows()),
              "subdir: empty directory shown")
        send(fd, screen, "\r", "subdir: Enter with no entries")
        check(not screen.picker_open(),
              "subdir: Enter closes the picker even with an empty list")
        check(screen.line_text() == "",
              f"subdir: empty-list Enter selects nothing ({screen.line_text()!r})")

        # --- typing filters the list directly (no Ctrl+F mode), like history
        send(fd, screen, "\x1b", "subdir: clear the line")
        send(fd, screen, "\x0e", "subdir: reopen the file picker")
        send(fd, screen, "alpha", "subdir: type filters the list directly")
        check(any("Filter: alpha" in r for r in screen.raw_rows()),
              "subdir: filter query recorded")
        check(screen.picker_open(), "subdir: typing filters without closing the picker")
        sel = screen.raw_rows()[screen.picker_sel_row()]
        check("alpha.txt" in sel,
              f"subdir: filter narrows to alpha.txt ({sel.strip()!r})")
        send(fd, screen, "\r", "subdir: Enter selects the filtered entry")
        check(not screen.picker_open(), "subdir: Enter exits after filtering")
        check(screen.line_text() == "alpha.txt",
              f"subdir: filtered selection inserted ({screen.line_text()!r})")

        # --- Enter on a directory, opened as two writes: the old picker
        # swallowed the Enter while pausing the line editor, leaving it
        # open. The OpenTUI picker attaches its key listener asynchronously,
        # so the same key must be sent after the picker has drawn.
        send(fd, screen, "\x1b", "subdir: clear the line")
        send(fd, screen, "\x0e", "subdir: reopen the picker (two-write open)")
        check(screen.picker_open(), "subdir: picker open before the Enter")
        send(fd, screen, "\r", "subdir: Enter after the picker drew")
        check(not screen.picker_open(),
              "subdir: Enter exits the picker opened as two writes")
        check(screen.line_text() == "docs",
              f"subdir: Enter selected the highlighted dir ({screen.line_text()!r})")

        # --- the shell's own directory never changed -----------------------
        send(fd, screen, "\x1b", "subdir: clear the line")
        send(fd, screen, "pwd", "subdir: type pwd")
        send(fd, screen, "\x1b", "subdir: dismiss menu before submit")
        send(fd, screen, "\r", "subdir: submit pwd", expect_single_prompt=False)
        check(home in screen.lines(),
              "subdir: pwd still shows the original cwd after picker browsing")
        check(not any(ln.rstrip() == os.path.join(home, "docs")
                      for ln in screen.lines()),
              "subdir: shell cwd did not drift into the browsed directory")
    finally:
        cleanup(pid, fd, home)


def kitty_preview_session():
    """Fresh shell with KITTY_WINDOW_ID: image previews must not linger.

    The image itself is drawn by OpenTUI's ImageRenderable (the picker pins
    it to the kitty protocol, since a bare pty never answers the async
    capability probe that 'auto' waits on). OpenTUI transmits with a=t and
    places with a=p; a kitty placement is not a text cell, so leaving the
    image or closing the picker must still emit a graphics delete — OpenTUI
    does this by image id (a=d,d=I,i=<id>).
    """
    DELETE = b"a=d,d=I"      # OpenTUI's delete-by-id teardown
    TRANSMIT = b"a=t"        # OpenTUI transmits lowercase (old picker used a=T)

    pid, fd, home = spawn(kitty=True, start_dir="HOME")
    screen = Screen()

    def at_image():
        """True when the highlighted entry is the image file."""
        rows = [r.strip() for r in screen.raw_rows() if r.strip()]
        return any("a.png" in r and "▶" in r for r in rows)

    def walk_to_image(tag):
        for i in range(10):
            if at_image():
                return True
            send(fd, screen, "\x1b[B", f"kitty: {tag} down x{i + 1}",
                 expect_single_prompt=False)
        return at_image()

    try:
        wait_for_prompt(fd, screen)
        raw = lambda: bytes(screen.raw_bytes)

        send(fd, screen, "\x0e", "kitty: ctrl+N opens the picker",
             expect_single_prompt=False)
        check(screen.picker_open(), "kitty: picker open")

        check(walk_to_image("toward image"),
              "kitty: a.png highlighted for preview")
        check(TRANSMIT in raw(), "kitty: image transmitted (a=t)")
        check(DELETE not in raw(),
              "kitty: no delete while the preview is on screen")

        # --- moving off the image must delete the placement ---------------
        send(fd, screen, "\x1b[B", "kitty: move past the image",
             expect_single_prompt=False)
        check(not at_image(),
              "kitty: selection moved off the image")
        check(raw().count(DELETE) >= 1,
              "kitty: placement deleted when moving past the image")
        check(raw().rfind(DELETE) > raw().rfind(TRANSMIT),
              "kitty: delete emitted after the transmit")

        send(fd, screen, "\x1b", "kitty: escape closes (no preview shown)",
             expect_single_prompt=False)
        check(not screen.picker_open(), "kitty: picker closed")

        # --- closing while a preview is on screen must delete it too ------
        send(fd, screen, "\x0e", "kitty: reopen the picker",
             expect_single_prompt=False)
        check(screen.picker_open(), "kitty: picker reopened")
        check(walk_to_image("re-toward image"),
              "kitty: a.png highlighted again")
        deletes_before = raw().count(DELETE)
        send(fd, screen, "\x1b", "kitty: escape closes with preview on screen",
             expect_single_prompt=False)
        check(not screen.picker_open(), "kitty: picker closed")
        check(raw().count(DELETE) > deletes_before,
              "kitty: placement deleted when the picker closes")

        # The shell still reads input normally afterwards.
        send(fd, screen, "y", "kitty: type at the prompt after closing")
        check((screen.line_text() or "").startswith("y"),
              f"kitty: input works after the picker ({screen.line_text()!r})")
    finally:
        cleanup(pid, fd, home)


def history_session():
    """Fresh shell: the Ctrl+R history picker (an OpenTUI app).

    It must open over the alternate screen, fuzzy-filter as you type,
    insert the selected command into the line on Enter, cancel on Escape
    without altering the line, and — because OpenTUI pauses stdin on
    teardown — leave the line editor reading keyboard input again.
    """
    pid, fd, home = spawn()
    screen = Screen()
    try:
        wait_for_prompt(fd, screen)

        # Seed the history database with two commands. No Escape before
        # Enter: the menu is already closed at the end of the line, so
        # Escape would clear the line and submit nothing.
        for cmd in ("echo one", "echo two"):
            send(fd, screen, cmd, f"hist: type {cmd!r}", expect_single_prompt=False)
            send(fd, screen, "\r", f"hist: submit {cmd!r}", expect_single_prompt=False)

        # --- the picker opens -------------------------------------------
        send(fd, screen, "\x12", "hist: ctrl+R opens the picker",
             expect_single_prompt=False)
        check(any("History Search" in r for r in screen.raw_rows()),
              "hist: picker header shown")
        check(any("Filter:" in r for r in screen.raw_rows()),
              "hist: filter line shown")

        # --- typing filters the list -------------------------------------
        send(fd, screen, "one", "hist: type filter 'one'",
             expect_single_prompt=False)
        check(any("Filter: one" in r for r in screen.raw_rows()),
              "hist: filter query recorded")

        # --- Enter inserts the selected command --------------------------
        send(fd, screen, "\r", "hist: Enter inserts the selection",
             expect_single_prompt=False)
        check(not any("History Search" in r for r in screen.raw_rows()),
              "hist: picker gone after Enter")
        raw = screen.raw_rows()
        marker_rows = [i for i, r in enumerate(raw) if PROMPT_MARKER in r]
        live = (raw[marker_rows[-1]].split(PROMPT_MARKER, 1)[1].rstrip()
                if marker_rows else None)
        check(live == "echo one",
              f"hist: selected command inserted on the live prompt ({live!r})")

        # --- Escape cancels and leaves the line alone ---------------------
        send(fd, screen, "\x1b", "hist: clear the inserted line",
             expect_single_prompt=False)
        send(fd, screen, "\x12", "hist: ctrl+R again", expect_single_prompt=False)
        check(any("History Search" in r for r in screen.raw_rows()),
              "hist: picker reopened")
        send(fd, screen, "\x1b", "hist: Escape cancels", expect_single_prompt=False)
        check(not any("History Search" in r for r in screen.raw_rows()),
              "hist: picker closed by Escape")
        raw = screen.raw_rows()
        marker_rows = [i for i, r in enumerate(raw) if PROMPT_MARKER in r]
        live = (raw[marker_rows[-1]].split(PROMPT_MARKER, 1)[1].rstrip()
                if marker_rows else None)
        check(live == "", f"hist: line unchanged after cancel ({live!r})")

        # --- input still works after OpenTUI tore down stdin --------------
        send(fd, screen, "echo alive", "hist: type after the picker",
             expect_single_prompt=False)
        raw = screen.raw_rows()
        marker_rows = [i for i, r in enumerate(raw) if PROMPT_MARKER in r]
        live = (raw[marker_rows[-1]].split(PROMPT_MARKER, 1)[1].rstrip()
                if marker_rows else None)
        check(bool(live) and live.startswith("echo alive"),
              f"hist: line editor still reads keys after the picker ({live!r})")
    finally:
        cleanup(pid, fd, home)


# ------------------------------------------------ small-window regression
def _box_geometry_ok(screen):
    """True when the fuzzy box on screen is sane: at most one box, below
    the live prompt row, with both borders, entries between them, and no
    prompt row inside or below it. Also rejects entries without borders
    (a box whose border rows were scrolled/overwritten away)."""
    raw = screen.raw_rows()
    markers = [i for i, r in enumerate(raw) if PROMPT_MARKER in r]
    live = markers[-1] if markers else -1
    tops = [i for i, r in enumerate(raw) if "╭" in r]
    bots = [i for i, r in enumerate(raw) if "╰" in r]
    entries = [i for i, r in enumerate(raw) if r.lstrip().startswith("│")]
    if not tops and not bots and not entries:
        return True          # no menu on screen — nothing to judge
    if len(tops) != 1 or len(bots) != 1:
        return False         # duplicated or partially erased box
    if not entries:
        return False         # border without content: broken box
    if tops[0] >= bots[0]:
        return False         # top/bottom borders out of order
    if live < 0 or tops[0] <= live:
        return False         # box overlapping or above the live prompt
    if any(m > tops[0] for m in markers):
        return False         # a prompt row inside/after the box
    return True


def narrow_session():
    """50x40: prompt + line wrap onto three rows while typing.

    Every repaint must return to the prompt's home row. The old code
    started each repaint where the cursor was — the last wrapped row —
    so every keystroke painted a fresh copy of the prompt below the
    previous one (the duplication in duplication-bug.png)."""
    cols, rows = 50, 40
    pid, fd, home = spawn(cols=cols, rows=rows)
    screen = Screen(cols, rows)
    try:
        wait_for_prompt(fd, screen)
        check(len(screen.prompt_rows()) == 1, "narrow: one prompt at startup")

        send(fd, screen, 'echo "line duplication/distortion issue when the wind',
             "narrow: type until the line wraps")
        raw = screen.raw_rows()
        check(len(screen.prompt_rows()) == 1,
              "narrow: prompt stays single while the line wraps")
        check(sum(1 for r in raw if "ortion issue" in r) == 1,
              "narrow: wrapped continuation row exists exactly once")

        send(fd, screen, 'ow is small and the fuzzy box grows',
             "narrow: keep typing (three wrapped rows)",
             expect_single_prompt=False)
        check(len(screen.prompt_rows()) == 1, "narrow: still a single prompt")

        # A line that shrinks below the wrap must clear its old rows
        send(fd, screen, "\x7f" * 70, "narrow: backspace past the wrap",
             expect_single_prompt=False)
        check(len(screen.prompt_rows()) == 1,
              "narrow: single prompt after the line shrinks")
        check(not any("ortion issue" in r for r in screen.raw_rows()),
              "narrow: stale wrapped rows cleared when the line shrinks")

        send(fd, screen, "\x1b[F", "narrow: end of line",
             expect_single_prompt=False)
        send(fd, screen, '"', "narrow: close the quote",
             expect_single_prompt=False)
        send(fd, screen, "\r", "narrow: submit the wrapped line",
             expect_single_prompt=False)
        check(len(screen.prompt_rows()) == 2,
              "narrow: submitted line + exactly one fresh prompt")

        send(fd, screen, "ec", "narrow: type at the fresh prompt",
             expect_single_prompt=False)
        check(len(screen.prompt_rows()) == 2,
              "narrow: no prompt copies appear while typing again")
        check(_box_geometry_ok(screen),
              "narrow: box hangs below the wrapped input, borders intact")
    finally:
        cleanup(pid, fd, home)


def short_window_session():
    """100x12: push the live prompt near the bottom, then open the fuzzy
    box so that prompt + box no longer fit — drawing past the last row
    scrolls the screen. The old row-by-row erase lost rows during the
    scroll (the newline scrolled instead of moving the cursor), leaving a
    corrupted box and duplicated prompt rows."""
    cols, rows = 100, 12
    pid, fd, home = spawn(cols=cols, rows=rows)
    screen = Screen(cols, rows)
    try:
        wait_for_prompt(fd, screen)
        # Four no-output submits stack cmd rows 0-3 and leave the live
        # prompt on row 4 of 12; the 8-row box then overflows the bottom.
        for n in range(4):
            send(fd, screen, "true", f"short: type true #{n + 1}",
                 expect_single_prompt=False)
            send(fd, screen, "\r", f"short: submit true #{n + 1}",
                 expect_single_prompt=False)
        before = len(screen.prompt_rows())
        check(before == 5,
              f"short: four kept lines + one fresh prompt ({before})")

        send(fd, screen, "e", "short: open the menu near the bottom",
             expect_single_prompt=False)
        raw = screen.raw_rows()
        live = [i for i, r in enumerate(raw) if PROMPT_MARKER in r][-1]
        check(live < rows - 1, f"short: live prompt still visible (row {live})")
        check(_box_geometry_ok(screen),
              "short: box intact after drawing past the bottom")
        check(len(screen.prompt_rows()) <= before,
              "short: scrolling drops old rows, never adds prompt copies")

        send(fd, screen, "c", "short: refilter the menu",
             expect_single_prompt=False)
        check(_box_geometry_ok(screen), "short: box intact after refilter")
        check(len(screen.prompt_rows()) <= before,
              "short: no prompt copies after refilter")

        send(fd, screen, "\x1b[B", "short: down arrow",
             expect_single_prompt=False)
        check(_box_geometry_ok(screen), "short: box intact after navigation")
        check(len(screen.prompt_rows()) <= before,
              "short: no prompt copies after navigation")
    finally:
        cleanup(pid, fd, home)


def tiny_window_session():
    """80x6: a six-row terminal. The box's row window used to be floored
    at three entries (five box rows) regardless of height, so even the
    prompt-on-top case overflowed; the floor is one entry now, and the
    scroll-consistent draw keeps the geometry right either way."""
    cols, rows = 80, 6
    pid, fd, home = spawn(cols=cols, rows=rows)
    screen = Screen(cols, rows)
    try:
        wait_for_prompt(fd, screen)
        send(fd, screen, "true", "tiny: type true")
        send(fd, screen, "\r", "tiny: submit true", expect_single_prompt=False)
        check(len(screen.prompt_rows()) == 2,
              "tiny: submitted line + one fresh prompt")

        send(fd, screen, "e", "tiny: open the menu",
             expect_single_prompt=False)
        raw = screen.raw_rows()
        live = [i for i, r in enumerate(raw) if PROMPT_MARKER in r][-1]
        check(live < rows - 1, f"tiny: live prompt still visible (row {live})")
        check(_box_geometry_ok(screen),
              "tiny: box fits the six-row terminal")
        check(len(screen.prompt_rows()) == 2,
              "tiny: no prompt copies on a tiny terminal")
    finally:
        cleanup(pid, fd, home)


def small_window_sessions():
    """Fresh shells on small windows — the line duplication/distortion
    regression (TODO.md 'line duplication and distortion when terminal
    windows are smaller or the fuzzy search is too large')."""
    narrow_session()
    short_window_session()
    tiny_window_session()


def cursor_session():
    r"""Prompt with a zero-width space (U+200B) — the powerline prompt
    fgsh-prompt builds ends with one.

    String length counts the ZWSP as a column; a terminal paints it in
    zero cells. If the editor measures the prompt by string length, the
    edit cursor lands one space ahead of the painted text (the bug with
    PS1=$(fgsh-prompt \$?)). Width must come from display cells."""
    cols, rows = 80, 24
    zwsp = "\u200b"
    pid, fd, home = spawn(rc_line=f'PS1="e{zwsp}:fgshell > "',
                          cols=cols, rows=rows)
    screen = Screen(cols, rows)
    try:
        wait_for_prompt(fd, screen)
        # The .fgshrc prompt is active (it carries 'e:fgshell', which the
        # default "fearlessgeek:fgshell" prompt does not contain). The ZWSP
        # itself never appears as a cell — terminals paint it in zero.
        check(any("e:fgshell" in r for r in screen.raw_rows()),
              "zwsp: ZWSP prompt from .fgshrc is active")
        check(len(screen.prompt_rows()) == 1, "zwsp: one prompt at startup")

        send(fd, screen, "true", "zwsp: type 'true'")
        # Painted prompt width: where the typed text actually starts.
        painted = screen.raw_rows()[screen.prompt_index()].index("true")
        check(screen.col == painted + 4,
              f"zwsp: cursor right after the painted text "
              f"(col {screen.col}, want {painted + 4})")
        check(screen.row == screen.prompt_index(),
              "zwsp: cursor stays on the prompt row")

        send(fd, screen, "\x1b[D", "zwsp: left arrow")
        check(screen.col == painted + 3,
              f"zwsp: left arrow moves the cursor one cell "
              f"(col {screen.col}, want {painted + 3})")

        send(fd, screen, "\x15", "zwsp: ctrl-u clears the line")
        check(screen.col == painted,
              f"zwsp: cleared cursor sits after the prompt "
              f"(col {screen.col}, want {painted})")
    finally:
        cleanup(pid, fd, home)


if __name__ == "__main__":
    sys.exit(main())
