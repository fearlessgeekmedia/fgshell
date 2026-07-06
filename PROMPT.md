# fgshell Prompt Customization

## Overview

The fgshell prompt can be customized using the `PS1` environment variable, following standard shell conventions. When `PS1` is not set, fgshell uses a default prompt of the form `username:directory$ `.

## Basic Usage

### Default Prompt
If no `PS1` is set, fgshell displays: `fearlessgeek:fgshell$ `

### Custom Static Prompt
```bash
export PS1="> "
./fgsh
```

### Prompt with Variables

fgshell expands environment variables in `PS1`:

```bash
export PS1="[\$USER@\$HOSTNAME]:\$PWD> "
./fgsh
```

Common variables:
- `$USER` - current username
- `$HOSTNAME` - system hostname
- `$HOME` - home directory
- `$PWD` - current working directory
- `$UID` - user ID

### Prompt with Command Substitution

fgshell supports command substitution in `PS1`:

```bash
export PS1="[\$(whoami)]> "
./fgsh
```

This executes the command inside `$()` and uses its output in the prompt.

## Integration with Other Tools

Since fgshell respects the `PS1` environment variable, it can work with prompt generators like **starship**, **oh-my-posh**, or any other tool that sets `PS1`.

### Example with Starship

```bash
export PS1="$(starship prompt)"
./fgsh
```

Or in your shell's rc file (e.g., `.bashrc`, `.zshrc`):

```bash
eval "$(starship init bash)"
./fgsh
```

## Notes

- The prompt is evaluated each time it's displayed, so dynamic content (like command output) will be re-evaluated for each command.
- For performance-critical prompts, consider using variable expansion instead of command substitution.
- The prompt is only displayed in interactive mode. Non-interactive/piped input skips prompt display as expected.
