# fgsh Script Language

fgsh is an interactive shell with support for shell scripting. Scripts are executed with control flow structures, variable assignment, and builtin commands.

## Running Scripts

Execute an fgsh script by passing it as an argument:

```bash
./fgsh myscript.fgsh
```

Scripts should have `#!/usr/bin/env fgsh` as the first line.

## Basic Syntax

### Comments
Lines starting with `#` are comments and are ignored.

```fgsh
# This is a comment
echo "Hello"
```

### Variable Assignment
Assign variables with `VAR=value` syntax. Variables are stored in the shell environment.

```fgsh
NAME="Alice"
AGE=30
echo "Name: $NAME, Age: $AGE"
```

### Variable Expansion
Access variables with `$VAR` or `${VAR}` syntax.

```fgsh
X=5
echo "X is $X"
echo "X is ${X}"
```

### Arithmetic Expansion
Use `$((expression))` for arithmetic evaluation.

```fgsh
X=5
Y=$((X + 3))
Z=$((Y * 2))
echo "Result: $Z"  # Output: Result: 16
```

## Control Flow

### While Loops
Execute a block of commands repeatedly while a condition is true.

```fgsh
X=0
while [ $X -lt 5 ]
do
  echo "X is $X"
  X=$((X + 1))
done
```

### If/Else Statements
Conditionally execute commands based on a test result.

```fgsh
if [ $X -gt 10 ]
then
  echo "X is greater than 10"
else
  echo "X is not greater than 10"
fi
```

## Test Command

The `[` test command evaluates conditions. The closing `]` is required.

### Numeric Comparisons
- `-eq` : equal
- `-ne` : not equal
- `-lt` : less than
- `-le` : less than or equal
- `-gt` : greater than
- `-ge` : greater than or equal

```fgsh
[ 5 -lt 10 ]  # true (exit code 0)
[ 5 -gt 10 ]  # false (exit code 1)
```

### String Comparisons
- `=` or `==` : equal
- `!=` : not equal
- `-z` : string is empty
- `-n` : string is not empty

```fgsh
[ "$NAME" = "Alice" ]
[ -n "$NAME" ]  # true if NAME is not empty
```

### Single Argument
Check if a value is non-empty:

```fgsh
[ $VAR ]  # true if VAR is not empty
```

## Builtin Commands

### echo
Print text to output. Use `-e` flag to interpret escape sequences.

```fgsh
echo "Hello World"
echo -e "Line 1\nLine 2"
```

### read
Read user input into variables.

```fgsh
read X                    # Read one word into X
read -p "Enter: " X Y     # Prompt and read multiple values
```

### cd
Change the current working directory.

```fgsh
cd /home/user
cd ..
cd ~
```

### pwd
Print the current working directory.

```fgsh
pwd
```

### export
Set environment variables for subprocess execution.

```fgsh
export PATH="/usr/bin:$PATH"
```

### js
Execute JavaScript code inline. Returns the result.

```fgsh
RESULT=$(js "console.log(5 + 3)")
VAL=$(js "Math.floor(Math.random() * 100)")
```

### Test/[
Test conditions. See "Test Command" section above.

```fgsh
test 5 -lt 10     # equivalent to: [ 5 -lt 10 ]
```

## Redirection

### Output Redirection
- `>` : redirect stdout to file (overwrite)
- `>>` : redirect stdout to file (append)
- `<` : redirect stdin from file

```fgsh
echo "data" > output.txt
echo "more" >> output.txt
cat < input.txt
```

## Pipes
Chain commands with `|` to pass output as input to the next command.

```fgsh
echo "hello world" | grep "world"
```

## Command Sequences
Run multiple commands separated by semicolons:

```fgsh
echo "first"; echo "second"; echo "third"
```

## Exit Codes
Commands return exit code 0 for success, non-zero for failure. Check `SHELL.lastExitCode` (usually accessed via exit code of previous command).

```fgsh
if [ 5 -lt 10 ]
then
  echo "condition was true"  # This executes because [ ] returned 0
fi
```

## Environment Variables

Common environment variables available:
- `$HOME` : user's home directory
- `$PWD` : current working directory
- `$PATH` : command search path
- `$USER` : current username

Access any variable with `$VAR` syntax.

## Script Example

```fgsh
#!/usr/bin/env fgsh

# Game loop example
SCORE=0
PLAYING="true"

while [ "$PLAYING" = "true" ]
do
  read -p "Enter command: " CMD
  
  if [ "$CMD" = "quit" ]
  then
    PLAYING="false"
  elif [ "$CMD" = "score" ]
  then
    echo "Your score: $SCORE"
  elif [ "$CMD" = "play" ]
  then
    POINTS=$(js "Math.floor(Math.random() * 100)")
    SCORE=$((SCORE + POINTS))
    echo "You earned $POINTS points!"
  else
    echo "Unknown command"
  fi
done

echo "Final score: $SCORE"
```

## Limitations

- fgsh does not support `for` loops or `case` statements
- Functions are not yet implemented
- Complex nested conditionals may not parse correctly
- Background job control is limited

## Tips

- Use `read -p "prompt text" VAR` to display prompts
- Use `$(command)` for command substitution
- Use `$((math))` for arithmetic
- Always quote variables: `"$VAR"` to avoid word splitting
