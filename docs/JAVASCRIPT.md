# JavaScript in fgshell

fgshell seamlessly integrates JavaScript into your shell scripts and REPL, making it perfect for JavaScript developers who want to script without leaving their ecosystem.

## Basic Usage

Execute JavaScript expressions with the `js` builtin:

```bash
js "2 + 2"
js "console.log('Hello from JavaScript')"
js "[1,2,3].map(x => x * 2)"
```

All JavaScript is executed in an async context, so you can use `await`:

```bash
js "await fetch('https://example.com').then(r => r.text())"
```

## Shell Context

Access shell state and functions directly from JavaScript:

### Environment

```bash
js "env.USER"
js "env.HOME"
js "env.PATH"
```

### Working Directory

```bash
js "cwd"           # Current directory
js "pwd()"         # Get current directory
js "cd('/tmp')"    # Change directory
js "home"          # Home directory
```

### File Operations

```bash
js "ls()"                    # List files in current directory
js "ls('/tmp')"              # List files in specific directory
js "readFile('config.txt')"  # Read file contents
js "writeFile('out.txt', 'content')"  # Write to file
```

### User Info

```bash
js "user"  # Current username
```

## Mixing Shell and JavaScript

Combine shell commands with JavaScript in scripts:

```bash
#!/usr/bin/env fgsh

# Use JavaScript for computation
NUM_FILES=$(js "ls().length")
echo "Found $NUM_FILES files"

# JavaScript conditionals
js "if (env.USER === 'fearlessgeek') console.log('Hello chief')"

# Process data with JavaScript
js "
const files = ls();
const sizes = files.map(f => ({ name: f, upper: f.toUpperCase() }));
console.log(JSON.stringify(sizes, null, 2));
"
```

## Examples

### Script with JavaScript Logic

```bash
#!/usr/bin/env fgsh

echo "=== File Analysis ==="

# Count and display files
js "
const files = ls();
const count = files.length;
const types = {};

files.forEach(f => {
  const ext = f.includes('.') ? f.split('.').pop() : 'none';
  types[ext] = (types[ext] || 0) + 1;
});

console.log('Total files:', count);
console.log('By type:', types);
"
```

### Environment Inspection

```bash
js "
const env = env;
console.log('Shell Environment:');
console.log(JSON.stringify(env, null, 2));
"
```

### Dynamic Directory Operations

```bash
js "
const currentDir = pwd();
const files = ls();
console.log(`In ${currentDir}: ${files.join(', ')}`);
"
```

## Available Context

| Name | Type | Description |
|------|------|-------------|
| `env` | Object | Environment variables |
| `cwd` | String | Current working directory |
| `home` | String | Home directory path |
| `user` | String | Current username |
| `pwd()` | Function | Get current directory |
| `cd(dir)` | Function | Change directory (returns true/false) |
| `ls(dir?)` | Function | List files (default: current dir) |
| `readFile(path)` | Function | Read file as text |
| `writeFile(path, content)` | Function | Write text to file |

## Error Handling

If there's an error in your JavaScript code, fgshell will display it:

```bash
js "nonexistentFunction()"
# js error: nonexistentFunction is not a function
```

## Use Cases

### JavaScript Developer's Workflow

- Quick computations without dropping into Node
- File manipulation with familiar JS APIs
- Environment inspection and debugging
- Quick prototyping before writing proper scripts

### Data Processing

- Transform data with JavaScript
- Process JSON from other tools
- Batch file operations

### System Administration

- Conditional logic for deployments
- Configuration management
- Log analysis and filtering

## Multi-line JavaScript

Write multi-line JavaScript directly with proper quoting:

```bash
js 'console.log("hello");
console.log("world");'
```

The shell will show a `>` continuation prompt while waiting for the closing quote. Just close the quote on the final line to execute.

For more complex examples, see [example-multiline-js.sh](../example-multiline-js.sh).

## Quoting and Escaping

When passing JavaScript code to the `js` command, you need to be careful with quotes and escaping. Here are the common patterns:

### Double-quoted strings (simplest for most cases)

Use double quotes for the outer shell string. Inside the JavaScript code, use single quotes for strings, and escape any double quotes with backslashes:

```bash
js "console.log('Hello, world')"
js "console.log('I\'m on the Mexican radio.')"
js "console.log(\"quoted text\")"
```

### Single-quoted strings (for code with many double quotes)

Use single quotes for the outer shell string. Inside the JavaScript code, use double quotes freely:

```bash
js 'console.log("Hello, world")'
js 'console.log("I\'m on the Mexican radio.")'
```

Note: Single quotes in JavaScript strings still need to be escaped with a backslash when inside single-quoted shell strings.

### When NOT to use backslash escapes

Don't try to escape quotes using only backslashes in single-quoted shell strings:

```bash
# ✗ This doesn't work - the backslash is literal
js 'console.log("I\'m fine")'  # Wrong!

# ✓ Use this instead - double-quote the outer string
js "console.log('I\'m fine')"  # Correct!
```

### Quick reference

| Situation | Solution |
|-----------|----------|
| JavaScript with single quotes | `js "console.log('hello')"` |
| JavaScript with double quotes | `js 'console.log("hello")'` |
| JavaScript with apostrophes | `js "console.log('I\'m here')"` |
| JavaScript with both quote types | Break it into separate lines or variables |

## Tips

- Use `console.log()` for output, not bare expressions (though simple values will print)
- Leverage JavaScript's array methods: `.map()`, `.filter()`, `.reduce()`
- Remember `js` commands run in their own scope—variables don't persist between calls
- Use single or double quotes for multi-line code; the shell shows `>` as a continuation prompt

## Integration with Other Tools

Combine JavaScript with fgshell's other features:

```bash
# Use history search + JavaScript
history ls | js "..."

# Pipe shell output to JavaScript
echo "data" | js "..."  # Note: not yet implemented, but planned

# Use js in conditionals
if js "2 + 2 === 4"; then
  echo "Math works"
fi
```

This makes fgshell a powerful tool for developers who want the expressiveness of JavaScript with the convenience of a shell.
