# fgsh Script Language Guide

fgsh is a modern shell with comprehensive scripting support. This guide covers everything you need to write scripts with control flow, functions, arrays, and more.

## Running Scripts

Execute an fgsh script by passing it as an argument:

```bash
./fgsh myscript.sh
./fgsh -c "echo 'inline command'"
```

Scripts should have `#!/usr/bin/env fgsh` as the first line for direct execution.

## Basic Syntax

### Comments
Lines starting with `#` are comments and are ignored.

```bash
# This is a comment
echo "Hello"
```

### Variable Assignment
Assign variables with `VAR=value` syntax. Variables are stored in the shell environment.

```bash
NAME="Alice"
AGE=30
echo "Name: $NAME, Age: $AGE"
```

### Variable Expansion
Access variables with `$VAR` or `${VAR}` syntax.

```bash
X=5
echo "X is $X"
echo "X is ${X}"
```

### Arithmetic Expansion
Use `$((expression))` for arithmetic evaluation.

```bash
X=5
Y=$((X + 3))
Z=$((Y * 2))
echo "Result: $Z"  # Output: Result: 16
```

## Arrays

Create and manipulate arrays with parenthesis syntax.

### Array Assignment
```bash
# Create array
numbers=(1 2 3 4 5)
words=("apple" "banana" "cherry")

# Assign single element
arr[0]="first"
arr[1]="second"
```

### Array Expansion
```bash
# Expand entire array
echo "${numbers[@]}"  # Output: 1 2 3 4 5

# Access element by index
echo "${numbers[0]}"  # Output: 1
echo "${numbers[2]}"  # Output: 3

# Get array length (using word count)
len=$(echo ${numbers[@]} | wc -w)
```

### Array Iteration
Use `for-in` loops to iterate over arrays:

```bash
arr=("apple" "banana" "cherry")
for item in "${arr[@]}"; do
  echo "Item: $item"
done
```

## Control Flow

### If/Else Statements
Conditionally execute commands based on a test result.

```bash
if [ $X -gt 10 ]; then
  echo "X is greater than 10"
elif [ $X -eq 10 ]; then
  echo "X is equal to 10"
else
  echo "X is less than 10"
fi
```

### While Loops
Execute a block of commands repeatedly while a condition is true.

```bash
X=0
while [ $X -lt 5 ]; do
  echo "X is $X"
  X=$((X + 1))
done
```

### For Loops (C-style)
Iterate a specific number of times.

```bash
for ((i=0; i<5; i++)); do
  echo "Iteration $i"
done
```

### For Loops (for-in)
Iterate over items in a list or array.

```bash
for item in one two three; do
  echo "Item: $item"
done

# With arrays
arr=(10 20 30)
for num in "${arr[@]}"; do
  echo "Number: $num"
done
```

### Case Statements
Match a value against multiple patterns.

```bash
case "$1" in
  start)
    echo "Starting..."
    ;;
  stop)
    echo "Stopping..."
    ;;
  *)
    echo "Usage: $0 {start|stop}"
    ;;
esac
```

Case patterns support:
- `pattern)` - exact match
- `*` - matches anything
- `pat1|pat2)` - multiple patterns (OR)
- `?` wildcard in patterns

## Functions

Define and call reusable functions.

### Function Definition
```bash
# Syntax 1: function keyword
function greet() {
  echo "Hello, $1!"
}

# Syntax 2: name() syntax
hello() {
  echo "Hi there!"
}
```

### Function Calls
```bash
greet "Alice"      # Output: Hello, Alice!
hello              # Output: Hi there!
```

### Function Parameters
Access function arguments with `$1`, `$2`, etc. `$0` is the function name.

```bash
add() {
  echo $((($1) + ($2)))
}

result=$(add 5 3)
echo "5 + 3 = $result"
```

### Function Return Codes
Functions set `SHELL.lastExitCode` based on their exit status.

```bash
is_even() {
  [ $(($1 % 2)) -eq 0 ]
}

if is_even 4; then
  echo "4 is even"
fi
```

## Logical Operators

Chain commands with conditional execution.

### AND Operator (&&)
Execute the next command only if the previous one succeeded (exit code 0).

```bash
echo "Hello" && echo "World"
test -f file.txt && cat file.txt
```

### OR Operator (||)
Execute the next command only if the previous one failed (non-zero exit code).

```bash
cd /nonexistent || cd /tmp
test -f file.txt || echo "File not found"
```

### Command Chaining
Combine multiple operators:

```bash
true && echo "First" && echo "Second"
false || echo "Failed" || echo "Backup"
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

```bash
[ 5 -lt 10 ]  # true (exit code 0)
[ 5 -gt 10 ]  # false (exit code 1)
```

### String Comparisons
- `=` or `==` : equal (always quote strings)
- `!=` : not equal
- `-z` : string is empty
- `-n` : string is not empty

```bash
[ "$NAME" = "Alice" ]     # true if NAME equals "Alice"
[ -z "$EMPTY" ]           # true if EMPTY is empty
[ -n "$NONEMPTY" ]        # true if NONEMPTY is not empty
```

### Single Argument
Check if a value is non-empty:

```bash
[ $VAR ]    # true if VAR is not empty
[ "$VAR" ]  # same, but safer with quotes
```

## Subshells

Execute commands in an isolated subprocess environment.

```bash
# Subshell doesn't affect parent environment
(cd /tmp && echo "In subshell")
echo "Back in parent"

# Useful for grouping commands with redirection
(echo "Line 1"; echo "Line 2") > output.txt
```

## Traps

Set handlers for signals and special conditions.

```bash
# Clean up on exit
trap 'rm -f /tmp/tempfile' EXIT

# Handle Ctrl+C
trap 'echo "Interrupted"; exit' INT

# Multiple handlers
trap 'echo "Cleaning up..."' EXIT INT TERM
```

Signal names: EXIT, INT (Ctrl+C), TERM, etc.

## Builtin Commands

### echo
Print text to output.

```bash
echo "Hello World"
echo -e "Line 1\nLine 2"        # -e interprets escape sequences
```

### read
Read user input into variables.

```bash
read X                          # Read one word
read -p "Enter: " X Y           # Prompt and read multiple values
```

### cd
Change the current working directory.

```bash
cd /home/user
cd ..
cd ~
```

### pwd
Print the current working directory.

```bash
pwd
```

### export
Set environment variables for subprocess execution.

```bash
export PATH="/usr/bin:$PATH"
export NODE_ENV="production"
```

### unset
Remove a variable from the environment.

```bash
unset OLDVAR
```

### env
Display or manipulate environment variables.

```bash
env                         # List all environment variables
env --json                  # List as JSON
env --yaml                  # List as YAML
```

### declare
Display or create arrays.

```bash
declare                     # List all variables and arrays
arr=(1 2 3)
declare                     # Shows arr=(1 2 3)
```

### test / [
Test conditions (same as `[ ]`).

```bash
test 5 -lt 10               # equivalent to: [ 5 -lt 10 ]
```

### alias / unalias
Create command shortcuts.

```bash
alias ll='ls -l'
alias la='ls -a'
unalias ll
```

### history
View command history.

```bash
history                     # List recent commands
history --json              # Show as JSON
history --yaml              # Show as YAML
```

### jobs
List background jobs.

```bash
jobs                        # List current jobs
jobs --json                 # Show as JSON
jobs --yaml                 # Show as YAML
```

### fg / bg
Manage background jobs.

```bash
fg %1                       # Bring job 1 to foreground
bg %1                       # Resume job 1 in background
```

### true / false
Always succeed or fail.

```bash
true && echo "Executed"     # Prints "Executed"
false || echo "Not executed"  # Prints "Not executed"
```

### js
Execute JavaScript code inline.

```bash
result=$(js "5 + 3")
echo "Result: $result"

# More complex expressions
random=$(js "Math.floor(Math.random() * 100)")
```

## Input/Output

### Output Redirection
- `>` : redirect stdout to file (overwrite)
- `>>` : redirect stdout to file (append)
- `2>` : redirect stderr to file

```bash
echo "data" > output.txt
echo "more" >> output.txt
echo "error" 2> errors.txt
```

### Input Redirection
- `<` : redirect stdin from file

```bash
cat < input.txt
```

### Pipes
Chain commands with `|` to pass output as input.

```bash
echo "hello world" | grep "world"
cat file.txt | sort | uniq
```

## Command Sequences

### Semicolon
Run multiple commands sequentially:

```bash
echo "first"; echo "second"; echo "third"
```

### Logical Operators
Already covered in "Logical Operators" section above.

## Exit Codes

Commands return exit code 0 for success, non-zero for failure.

```bash
if [ 5 -lt 10 ]; then
  echo "Condition was true"  # Executes because [ ] returned 0
fi

# Check exit code of previous command
mycmd
if [ $? -eq 0 ]; then
  echo "Command succeeded"
fi
```

## Environment Variables

Common environment variables:
- `$HOME` : user's home directory
- `$PWD` : current working directory
- `$USER` : current username
- `$PATH` : command search path
- `$SHELL` : path to this shell

Access any variable with `$VAR` or `${VAR}` syntax.

## Complete Script Examples

### Example 1: Loop and Conditionals
```bash
#!/usr/bin/env fgsh

for i in 1 2 3 4 5; do
  if [ $((i % 2)) -eq 0 ]; then
    echo "$i is even"
  else
    echo "$i is odd"
  fi
done
```

### Example 2: Functions and Arrays
```bash
#!/usr/bin/env fgsh

# Function to greet people
greet_all() {
  for person in "$@"; do
    echo "Hello, $person!"
  done
}

# Create array and use function
names=("Alice" "Bob" "Charlie")
greet_all "${names[@]}"
```

### Example 3: Error Handling
```bash
#!/usr/bin/env fgsh

backup_file() {
  if [ ! -f "$1" ]; then
    echo "Error: File not found" >&2
    return 1
  fi
  
  cp "$1" "$1.backup" && echo "Backup created" || echo "Backup failed"
}

backup_file "important.txt"
```

### Example 4: Data Processing
```bash
#!/usr/bin/env fgsh

# Count lines in a file
count_lines() {
  local file="$1"
  local count=0
  
  while IFS= read -r line; do
    count=$((count + 1))
  done < "$file"
  
  echo "Total lines: $count"
}

count_lines "data.txt"
```

## Tips & Best Practices

- **Quote variables**: Always use `"$VAR"` to prevent word splitting
- **Use functions**: Keep scripts DRY with reusable functions
- **Error checking**: Use `&&` and `||` or `if [ $? -eq 0 ]` to check status
- **Escape sequences**: Use `echo -e` for special characters like `\n`, `\t`
- **Array iteration**: Always quote array expansion: `"${arr[@]}"`
- **Command substitution**: Use `$(command)` instead of backticks
- **Exit codes**: Commands naturally set exit codes; use them for control flow

## Limitations

- Here-documents (`<<EOF`) are parsed but content isn't yet passed to commands
- Pattern matching in case statements is basic (no full regex support)
- Some advanced bash features aren't implemented (process substitution, etc.)
