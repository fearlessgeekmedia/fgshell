#!/bin/bash

# Multi-line JavaScript Examples for fgshell
# This script demonstrates how to use multi-line JavaScript code with the js command
# Run with: bash example-multiline-js.sh

cd "$(dirname "$0")"

echo "=== Multi-line JavaScript Examples for fgshell ==="
echo

# Example 1: Working with arrays and map/filter
echo "Example 1: Array processing"
echo "Code: js \"(() => { let nums = [1,2,3,4,5]; console.log(nums.map(n => n * 2)); })()\""
./fgsh << 'EOF'
js "(() => { let nums = [1,2,3,4,5]; console.log(nums.map(n => n * 2)); })()"
EOF

echo
echo "Example 2: Object processing"
echo "Code: js \"(() => { let data = {name: 'test', count: 42}; console.log(JSON.stringify(data)); })()\""
./fgsh << 'EOF'
js "(() => { let data = {name: 'test', count: 42}; console.log(JSON.stringify(data)); })()"
EOF

echo
echo "Example 3: Accessing shell context"
echo "Code: js \"(() => { console.log('User:', user, 'Home:', home); })()\""
./fgsh << 'EOF'
js "(() => { console.log('User:', user, 'Home:', home); })()"
EOF

echo
echo "Example 4: Using environment variables"
echo "Code: js \"(() => { console.log('PATH length:', env.PATH.length); })()\""
./fgsh << 'EOF'
js "(() => { console.log('PATH length:', env.PATH.length); })()"
EOF

echo
echo "Example 5: Async operations with await"
echo "Code: js \"(async () => { let x = await Promise.resolve(123); console.log('Result:', x); })()\""
./fgsh << 'EOF'
js "(async () => { let x = await Promise.resolve(123); console.log('Result:', x); })()"
EOF

echo
echo "Example 6: Complex data transformation"
echo "Code: Transform array of objects"
./fgsh << 'EOF'
js "(() => { let items = [{id: 1, val: 10}, {id: 2, val: 20}, {id: 3, val: 30}]; let result = items.map(i => ({id: i.id, doubled: i.val * 2})); console.log(JSON.stringify(result, null, 2)); })()"
EOF

echo
echo "Done!"
