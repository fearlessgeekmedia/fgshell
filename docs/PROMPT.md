# Customizing the fgshell Prompt

## Overview

The fgshell prompt is fully customizable using the `PS1` environment variable. By default (when `PS1` is not set), fgshell displays a colorful prompt showing the current user and directory.

## Default Prompt

When no `PS1` is set, fgshell displays:
```
user:directory »
```
With colors: cyan username, green directory.

## Setting a Custom Prompt

Set `PS1` in your `~/.fgshrc` file:

```bash
export PS1="your_custom_prompt"
```

## Prompt Placeholders

fgshell provides special placeholders that are replaced when the prompt is displayed:

| Placeholder | Description |
|-------------|-------------|
| `%user%` | Current username |
| `%pwd%` | Full working directory path |
| `%dir%` | Directory basename (last component of path) |
| `%cyan%` | Cyan color code (ANSI bold cyan) |
| `%green%` | Green color code (ANSI bold green) |
| `%red%` | Red color code (ANSI bold red) |
| `%yellow%` | Yellow color code (ANSI bold yellow) |
| `%reset%` | Reset color code |

## Examples

### Simple Prompt with User and Directory

```bash
export PS1="%user%:%dir% > "
```
Output: `fearlessgeek:fgshell > `

### Colored Prompt

```bash
export PS1="%cyan%%user%%reset%:%green%%dir%%reset% » "
```
Output: `fearlessgeek:fgshell »` (with colors)

### Full Path Prompt

```bash
export PS1="%user%@%pwd% $ "
```
Output: `fearlessgeek@/home/fearlessgeek/fgshell $ `

### Fancy Multi-Color Prompt

```bash
export PS1="%yellow%[%cyan%%user%%yellow%]%reset%:%green%%dir%%yellow%%reset% » "
```

### Environment Variables

You can also use standard environment variables in PS1:

```bash
export PS1="$USER:$PWD > "
```

These will be expanded once when `PS1` is set. For dynamic updates (e.g., when you `cd`), use placeholders instead.

## Command Substitution

fgshell supports command substitution in PS1:

```bash
export PS1="[$(date +%H:%M)] $USER > "
```

This will execute the date command each time the prompt is displayed.

## Tips

- Use `%cyan%`, `%green%`, `%red%`, `%yellow%` for colors, always paired with `%reset%` at the end
- Placeholders like `%user%` are more efficient than `$(whoami)` since they don't spawn processes
- The prompt is re-evaluated each time it's displayed, so command substitutions happen on every command
- For a responsive shell, prefer placeholders over command substitutions in the prompt

## Default ~/.fgshrc

The default `~/.fgshrc` includes an example:

```bash
#!/usr/bin/env fgsh

echo "This is an experimental shell"
fastfetch

# Customize prompt using color placeholders:
# Available: %user%, %pwd%, %dir%, %cyan%, %green%, %red%, %yellow%, %reset%
export PS1="%cyan%%user%%reset%:%green%%dir%%reset% » "
```

Edit this file to customize your prompt to your preference.
