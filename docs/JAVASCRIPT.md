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

For complex logic, wrap your code in an IIFE (Immediately Invoked Function Expression):

```bash
js "(() => { 
  let x = [1, 2, 3];
  let doubled = x.map(n => n * 2);
  console.log(doubled);
})()"
```

When using `js` in shell scripts, use heredocs to avoid quote escaping issues:

```bash
./fgsh << 'EOF'
js "(() => { let nums = [1,2,3]; console.log(nums.reduce((a,b) => a+b, 0)); })()"
EOF
```

For a complete example with various multi-line patterns, see [example-multiline-js.sh](../example-multiline-js.sh).

## Tips

- Use `console.log()` for output, not bare expressions (though simple values will print)
- Leverage JavaScript's array methods: `.map()`, `.filter()`, `.reduce()`
- Remember `js` commands run in their own scope—variables don't persist between calls
- Wrap multi-line code in an IIFE `(() => { ... })()` to execute it as a block
- In shell scripts, use heredocs with `./fgsh << 'EOF'` to safely pass complex JavaScript

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
