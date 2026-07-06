The user is reporting that `ctrl+z` is not working correctly in the `fgshell`.

Here is a summary of the problem and the steps I have taken so far:

**Problem:**

*   When the user runs a command like `sleep 10` and presses `ctrl+z`, the `SIGTSTP` signal is not handled until after the command has finished executing.
*   The expected behavior is that the `sleep` command should be suspended immediately when `ctrl+z` is pressed.

**What I have tried:**

1.  **Verified the `ptctl` library:** I found that the `libptctl.so` library was missing, and I rebuilt it using the `build-ptctl.sh` script. This was successful, and the `ptctl.available` flag is now `true`.
2.  **Added debugging to the `SIGTSTP` handler:** I added `console.error` messages to the `SIGTSTP` handler in `src/fgshell.js` and confirmed that the handler is being called.
3.  **Tried different `stdio` options:** I tried changing the `stdio` option in the `spawn` call in `executePipeline` from `'inherit'` to `['inherit', 'inherit', 'inherit', 'ipc']` and adding `detached: true`. This did not solve the problem.

**My current hypothesis:**

The problem is that the parent shell's `readline` interface is still active and is capturing the `ctrl+z` signal. The `readline` interface only relinquishes control of the terminal after the child process has completed.

I have not been able to figure out how to properly pause the `readline` interface and give the child process exclusive control of the terminal.
