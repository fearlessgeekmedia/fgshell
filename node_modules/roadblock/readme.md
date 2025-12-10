# roadblock

A simple function for interrupting program flow if a condition isn’t met.

## Installation

Requires [Node.js](https://nodejs.org/) 4.0.0 or above.

```bash
npm i roadblock
```

## API

The module exposes a single function:

```javascript
module.exports = (shouldBlock, block, main) => shouldBlock ? block(main) : main()
```

If `shouldBlock` is true, then the `block` function is called and is given `main` as an argument, to be invoked when/if `block` is ready. If `shouldBlock` is false, `block` is bypassed and `main` is called immediately.

## Example

```javascript
const roadblock = require('roadblock')

roadblock(!loggedIn, main => {
  // show login form
  if (loginSuccessful) main()
}, () => {
  // show user-only page
})
```

In the above example, if `loggedIn` is false, the login function is invoked, and is given a callback which it can use once the login is successful. If, on the other hand, `loggedIn` is true, then the login function is bypassed and the main function is called directly.

### The Alternative

Without `roadblock`, the code for the previous example would look something like this:

```javascript
function login () {
  // show login form
  if (loginSuccessful) main()
}

function main () {
  // show user-only page
}

if (loggedIn) {
  main()
} else {
  login()
}
```

`roadblock` is intended to make your code more compact, more sequential, and less cluttered with named functions that are used only once or twice.
