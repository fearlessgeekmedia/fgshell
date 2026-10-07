# fgshell History Management

## Overview

fgshell uses SQLite to store command history with rich metadata, similar to Atuin. Each command entry includes:

- **Command** - the executed command string
- **Timestamp** - when it was executed (Unix timestamp)
- **Exit Code** - the command's exit status
- **Working Directory** - the directory it was run in
- **Duration** - how long it took to execute (in milliseconds)

History is stored in `~/.fgshell_history.db` and persists across sessions.

## Using History

### List All Commands

```bash
history
```

Shows all commands with IDs, timestamps, exit codes, and commands:
```
1       12/8/2025, 10:52:58 PM [0]      pwd
2       12/8/2025, 10:52:58 PM [0]      echo "hello world"
3       12/8/2025, 10:52:58 PM [0]      ls
```

### Search History (Fuzzy)

```bash
history echo
```

Searches for commands matching "echo" using fuzzy search:
```
2       12/8/2025, 10:52:58 PM [0]      echo "hello world"
3       12/8/2025, 10:52:58 PM [0]      echo "test string"
5       12/8/2025, 10:53:04 PM [0]      echo "test"
```

Multi-word searches:
```bash
history ls tmp
```

## History Database

- **Location**: `~/.fgshell_history.db`
- **Format**: SQLite 3
- **Persists**: Across all fgsh sessions
- **Retention**: All commands until manually cleared

### Manual Cleanup

To permanently delete history older than N days, you can directly manage the database (coming in a future builtin command).

For now, you can use SQLite tools:
```bash
sqlite3 ~/.fgshell_history.db "DELETE FROM history WHERE timestamp < strftime('%s', 'now', '-30 days')"
```

### Interactive Picker

Press **Ctrl+R** to open the two-pane history picker (built with OpenTUI):
the left pane lists commands newest-first, the right pane previews the
selection with time, exit code, duration, and directory. Typing fuzzy-filters
the list; Enter inserts the selected command into the prompt line.

## Future Features

Planned enhancements:
- `history-by-exit-code` - filter by exit status
- `history-by-directory` - show commands run in a specific directory
- Configurable history retention policy
- Export history for use with external tools (the built-in Ctrl+R picker covers interactive selection)
