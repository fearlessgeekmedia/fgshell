# Line Duplication Issues — Status & Pickup Notes

Last updated: 2026-10-11. Status: **fixed (measurement-based), including the
kitty/zellij residue. One inherent limitation remains: a terminal that never
answers CPR *and* runs prompt width == window width cannot be measured (table
geometry is used there, unchanged).**

## 2026-10-11 session — the residue is diagnosed & fixed

Two further root causes were found with a recreated faithful harness (see C)
and fixed in `src/line-editor.js`:

### 6. Input rendered during the probe window (doc B hypothesis 1 — CONFIRMED)

**Measured**: at cols=55 with the CPR reply delayed 50–400ms (zellij
forwarding / fast typing), the first keystroke's repaint anchors against the
un-adopted boundary geometry: the real cursor (kitty/pyte: trailing ZWSP
resolves the pending wrap) sits one row below the model's anchor, so
cursorUp(0)+'\r' lands one row LOW, the repaint paints a fresh prompt there,
and the original prompt row is left stale above it. The post-adoption
corrective repaint then erases relative to the *drifted* home, so the stale
copy is never swept — it stays for the life of the prompt. This is the
"four prompt copies" residue.

**Fix**:

- `_onData` now **holds input while the probe is pending** (`_probeHold`) and
  replays it through `_onData` when the probe resolves (`_flushProbeHold`) —
  no paint ever runs against un-measured geometry. CPR replies inside held
  chunks are still consumed (probe can resolve mid-hold).
- The probe timeout is **extended (max 2×250ms) while input is waiting**
  (`_armCprTimeout`) — zellij forwarding past 250ms no longer releases the
  hold early; a CPR-less terminal with the user typing fast pays at most
  750ms once per prompt, then falls back to table geometry as before.
- **Late adoption** (`_cprLate`): a reply arriving after the timeout is still
  paired/adopted if it passes the plausibility guard and this prompt never
  adopted one; cleared after 600ms or on adoption. Late replies can no longer
  fall through to key parsing (they used to be parsed as keystrokes!).
- `_ctrlC` now calls `_clearMenu()` (hypothesis 3) — the box used to survive
  Ctrl+C and the next prompt painted over its first rows (visible in
  duplicaton-bug-2.png).

### 7. Multi-line ghosts break the row math (the actual residue in
`duplicaton-bug-2.png`)

**Measured**: the ghost provider returns whole history entries — e.g.
`function conspiracy-hacker-cow() {\n    conspiragen | …\n}` — i.e. the ghost
contains embedded newlines (exactly the 3 ghost lines visible in screenshot
2). `_render` computed rows as a flat cell count (`floor((V-1)/cols)`), which
cannot see the row jump of a `\n`: every repaint with a multi-line ghost
erased one row short **per newline**, re-anchored one row lower per paint and
stacked prompt+ghost copies — a residue the boundary-shift fix could never
address (it happens at any width, with any CPR delay, adopted or not).

**Fix**:

- New `_layoutRows(startCol, s)` walk models what the paint really does:
  `\n` drops a row (raw-mode semantics), `\r` returns to column 0, wide
  chars and the deferred wrap (boundary-ending display keeps the wrap pending
  on that row) are honored; for a wrapped prompt (cols < prompt width, e.g.
  cols=40) the start cell is normalized with the same deferred-wrap math.
  For single-line displays it is exactly the old flat arithmetic.
- `_render` uses the walk for `endRow`/`boundaryEnd`/cursor placement; the
  ghost is painted with its newlines normalized to CR LF so each line starts
  at column 0 (matches what the walk counted).
- `_requestMenu` flattens multi-line history items to one row — a raw `\n`
  inside the menu box added uncounted rows and broke the box's
  clear/erase arithmetic (stale box rows after the menu closed).

### Verification (all measurement-based, 2026-10-11)

- Duplication matrix: cols 40/55/72/80 × CPR delay 0/20/50/200/400ms,
  char-by-char typing and single-chunk paste, plus silent (no reply) at
  cols=80 → **0 failures** (single prompt row everywhere; the silent+cols=55
  combination is the known inherent limitation above, pre-existing).
- Scenario suite (screenshot-2 sequence): menu opens during probe, Ctrl+C,
  retype; submit + retype; late (400ms) adoption; slow typing — **0
  failures**; menu boxes single and correctly cleared.
- Tab-accepting a multi-line ghost at cols=80 then Ctrl+U: clean.
- `test-menu-duplication.py`: **PASS (all checks)**.

Symptom originally reported: stacked copies of the powerline prompt while
typing (ghost/autocomplete active), reproducible in kitty, zellij, small
windows — multiplexer-independent.

---

## A. Fixed & verified (all measurement-based)

### 1. Wrap-boundary row drift (the main duplication)

**Root cause** (measured in a pyte xterm emulator with the real 55-cell
fgsh-prompt): when the prompt's paint ends **exactly on a wrap boundary**
(prompt width == terminal width, e.g. 55 cols), terminals disagree about the
trailing U+200B (ZWSP):

- some keep the wrap *pending* on the last row (xterm-style), others let the
  zero-width ZWSP **resolve the pending wrap** and drop the cursor one row
  (pyte measured 2026-10-10; the user's kitty@55 shows the same signature).

The editor then believed the cursor was on row N while the real terminal left
it on row N+1, so every repaint erased one row short and painted a fresh
prompt below the stale one (screen ended with prompt copies at rows 0/1/3).

The CPR width probe could **not** catch it: both semantics report a plausible
width ("55 == 55" — exactly what the user's kitty logged). Only the probe
reply's **row delta** distinguishes them.

**Fix** (`src/line-editor.js`):

- `_handleCpr()` now measures the paint's end row: `rowFix = (row-r0) -
  endRowModel`. `rowFix === 1` sets `_rowEndShift = 1` (this terminal resolves
  boundary-ending paints one row lower); `0` clears it; bigger = implausible,
  keep previous. The existing width plausibility guard (`|width-model| <= 2`)
  still gates adoption.
- Before re-rendering, the stored anchor is **re-anchored**:
  `_cursorRow = _lastEditRow + (_lastBoundary ? rowFix - prevShift : 0)` and
  `_paintedRows = max(paintedRows, _cursorRow+1, measured+1)` — otherwise the
  corrective repaint would paint yet another copy instead of clearing.
- `_render()` applies the shift only when the paint ends on a boundary
  (`visible % cols === 0`): `endRow = baseEndRow + shift`, `newRows = endRow+1`
  (includes the cursor's real row), and the cursor-at-end special case uses
  `editRow = endRow; editCol = cols-1`.

**A/B proof**: with the shift adoption disabled the faithful harness
reproduces the stack (cols=55 → marker_rows=2, FAILURES: 3); enabled →
FAILURES: 0.

### 2. CPR probe fidelity (harness lesson — IMPORTANT)

The first-generation pyte harnesses answered `ESC[6n` with the cursor **after
the whole write chunk was fed** — a real terminal answers with the position at
the moment it *processes the query* (mid-write). The unfaithful answer garbled
the probe (width 109) and masked the row signal. All /tmp pyte harnesses now
split the stream at each `6n` and reply from the cursor at that point.
`test-menu-duplication.py`'s custom Screen cannot reproduce this bug class at
all (synchronous CPR + table-matching wrap model) — that's why its 224 checks
passed while the user still saw the bug.

### 3. `VAR=value cmd` prefix assignments (`src/fgshell.js`)

`peelLeadingAssignments()` + scoped env merge in `runSingle()` (merge into
`SHELL.env`, run command recursively with `noHistory`, restore in `finally`).
Verified: `MYVAR=hello printenv MYVAR` → hello, no leak; `FOO=bar BAZ=qux
printenv FOO BAZ` → bar/qux; `MSG="a b"` → `a b`; bare `X=5` still persists.

### 4. `0): command not found` on every startup (regression from #3, fixed)

`peelLeadingAssignments` split `PS1=$(fgsh-prompt \$?)` (from `~/.fgshrc`) at
the space **inside `$( … )`** and executed the leftover `\$?)` as a command →
`$?` expanded → command `0)` → "0): command not found", exit 127, printed
before the BIOS banner on every start. **Fixed** by making the bare-value
matcher substitution-aware (`SUBST`/`BARE` regexes keep balanced `$( … )` with
one nesting level). Verified: full real `.fgshrc` + every line individually →
0 "command not found" cases; env-prefix feature unaffected.

### 5. Other earlier-session fixes (already in tree)

- ZWSP cursor fix (U+200B = zero cells, measured in tmux).
- CPR-based prompt-width calibration (`_beginPromptProbe`), 250ms fallback.
- Fallback non-OpenTUI pickers (Ctrl+R/Ctrl+N), Ctrl+L screen-clear anchoring.

---## B. Remaining issue

None reported against the 2026-10-11 fixes. If duplication ever reappears,
re-run the harness matrix (C) first, then capture from the duplicating
session:

```
FGSH_ANCHOR_DEBUG=/tmp/anchor.log FGSH_DEVEL=1 ./fgsh
```

reproduce, then `cat /tmp/anchor.log` in the same session (the `[SESSION]`
stamp guarantees attribution). Interpretation guide:

- duplicated renders with `endShift=0 boundary=true` → probe rejected/failed:
  look for `[DEBUG] prompt width: rejected implausible …` (garbled reply) or
  no width line (no reply / timeout — inherent limitation at cols==prompt).
- `endShift=1`, consistent geometry, still stacking → the paint isn't coming
  from `_render` (check for writes from elsewhere, e.g. a TUI component).

---

## C. Key files

- `src/line-editor.js` — rendering: `_render` (anchor geometry, boundary
  shift, newline-aware `_layoutRows`, `FGSH_ANCHOR_DEBUG` block), `_drawMenu`,
  `_eraseBoxBelow`, `_ctrlC` (now clears the menu); calibration:
  `_beginPromptProbe`, `_armCprTimeout` (hold-aware timeout),
  `_flushProbeHold`, `_handleCpr` (plausibility guard + row measurement +
  re-anchor + late adoption `_cprLate`); input: `_onData` (CPR consumption
  + probe-window hold); state: `_rowEndShift`, `_lastEditRow`,
  `_lastBoundary`, `_promptPaintWidth`, `_probeHold`, `_probeExtends`.
- `src/fgshell.js` — `peelLeadingAssignments` (~line 3755, substitution-aware
  regex), `runSingle` env-prefix branch, `expandCommandSubstitution` (2678),
  `loadRcFile` (6036), ghost provider, `rl.prompt()`.
- `test-menu-duplication.py` — 224-check pty harness (PASS; cannot reproduce
  the boundary bug class by design — see A.2).
- `~/utility-scripts/fgsh-prompt` — builds the 55-cell powerline prompt
  (56 codepoints: 55 printable + trailing U+200B). `~/.fgshrc` sets
  `PS1=$(fgsh-prompt \$?)` and runs `bios boot --flavour luchador`.

### Canonical pyte harness (recreated 2026-10-11 in /tmp)

- `/tmp/pytevenv/` — venv with pyte (system pip is PEP 668 blocked).
- `/tmp/harness.py` — the faithful harness (`run_session`): pty + pyte,
  splits the stream at every `ESC[6n` and replies from the cursor *at that
  point* (doc A.2 fidelity), with configurable `cpr_delay`, `cpr_mode=
  "silent"` (never answer), paste support, write-level trace, and
  `FGSH_ANCHOR_DEBUG` pass-through. Run fgsh from src with **bun**
  (`bun src/fgshell.js` — `bun:sqlite` in history-db).
- `/tmp/matrix.py` — cols 40/55/72/80 × delay 0/20/50/200/400ms + paste +
  silent; asserts a single prompt-marker row. Current: FAILURES: 0.
- `/tmp/scenarios.py` — screenshot-2 sequences (menu+Ctrl+C+retype, submit,
  late adoption, slow typing). Current: SCENARIO FAILURES: 0.

**Harness fidelity lesson #2 (2026-10-11)**: pyte's `Screen.draw()` breaks
out of a printable run at any zero-width non-combining char (the prompt's
trailing U+200B) — everything after it **in the same run** is discarded, so
at boundary widths the typed text after the prompt is invisible in pyte.
Real terminals (kitty) draw it. Harness checks must therefore count prompt
marker rows, never expect the typed text to be visible. The text/ghost
themselves arrive in a separate run after the dim-SGR switch, but the char
right after the ZWSP (the first typed char) is always eaten in pyte.

---

## D. Repo state

Uncommitted (user chose "don't commit yet"; two logical commits were offered:
env-prefix feature / duplication fix + docs + harness — unresolved):
`.gitignore, README.md, TODO.md, docs/FGSH.md, docs/HISTORY.md,
src/fgshell.js, src/line-editor.js, test-menu-duplication.py`,
plus built `fgsh` (current build includes everything above — startup `0):`
error is gone), `duplication-bug*.png`.

Docs already updated: `docs/FGSH.md` § Prompt Width Calibration (boundary
row-delta paragraph), `TODO.md` follow-up bullet (2026-10-10).
