/**
 * fgshell - a simple interactive shell in Node.js
 *
 * Features:
 * - Parse commands with quotes and escapes
 * - Pipes, redirection: >, >>, <
 * - Background jobs with &
 * - Builtins: cd, mkcd, pwd, exit, export, unset, env, jobs, fg, bg, echo, ls, printf
 * - Environment variable expansion: $VAR
 * - Tab completion for files/dirs
 * - Job control with signal forwarding (SIGINT, SIGTSTP)
 * - Ctrl+Z to suspend shell at prompt, foreground jobs receive SIGTSTP naturally
 * - Ctrl+N file picker: Navigate and select files/directories
 *
 * Save as file, chmod +x, run: ./fgsh
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const os = require('os');
const glob = require('glob');
const minimist = require('minimist');
const SHELL = require('./shell');
const historyDB = require('./history-db');
const outputFormatter = require('./output-formatter');

let ptctl;
try {
  ptctl = require('./ptctl');
  if (process.env.FGSH_DEBUG) {
    if (!ptctl.available) {
      console.error(`[DEBUG] ptctl unavailable: ${ptctl.error?.message || 'unknown error'}`);
    } else {
      console.error(`[DEBUG] ptctl loaded successfully`);
    }
  }
} catch (e) {
  console.error(`[DEBUG] Failed to load ptctl module: ${e.message}`);
  ptctl = { available: false };
}

// Version resolution:
// 1. FGSH_VERSION is injected at build time: build-fgsh.js passes
//    --define FGSH_VERSION=... to `bun build --compile`, so the compiled
//    binary reports its version without reading package.json at runtime.
// 2. Fallback for running from source: read package.json next to src/.
let VERSION = 'unknown';
try {
  if (typeof FGSH_VERSION === 'string' && FGSH_VERSION) {
    VERSION = FGSH_VERSION;
  }
} catch (e) {}
if (VERSION === 'unknown') {
  const tryPaths = [
    path.join(__dirname, 'package.json'),          // same dir as this file (src/)
    path.join(__dirname, '..', 'package.json'),    // project root
    path.join(__dirname, '..', '..', 'package.json')
  ];
  for (const pkgPath of tryPaths) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg && pkg.version) {
        VERSION = pkg.version;
        break;
      }
    } catch (e) {}
  }
}
const help = {
  echo: `echo [-neE] [STRING]...
  Write arguments to standard output.

  Options:
  -n     do not output the trailing newline
  -e     enable interpretation of backslash escapes (default)
  -E     disable interpretation of backslash escapes

  Backslash escapes:
  \\a     alert (bell)
  \\b     backspace
  \\c     suppress further output
  \\e     an escape character
  \\f     form feed
  \\n     new line
  \\r     carriage return
  \\t     horizontal tab
  \\v     vertical tab
  \\\\     backslash
  \\0nnn  byte with octal value nnn
  \\xhh   byte with hexadecimal value hh

  Exit status:
  Always successful (0) unless a write error occurs.
  `,
  cd: `cd [-L|-P] [DIR]
  Change the shell working directory.

  Changes the current working directory to DIR. If DIR is not supplied,
  the value of HOME is used as the default.

  Options:
  -P     physical: resolve symlinks to get to the actual directory
  -L     logical: keep symlinks in the path (default)

  Special values:
  cd -   switches to the previous working directory
  cd ~   changes to the home directory
  cd ~user  changes to user's home directory

  Exit status:
  Returns 0 on successful change, non-zero if the directory cannot be accessed.
  `,
  mkcd: `mkcd [DIR]
  Create a directory and change into it.

  Creates DIR (and any missing parent directories) then changes the
  current working directory to DIR. Equivalent to mkdir -p DIR && cd DIR.

  Exit status:
  Returns 0 on success, non-zero if creation or directory change fails.
  `,
  pwd: `pwd [-LP]
  Print the current working directory.

  Options:
  -L     logical: include symlinks in the printed path (default)
  -P     physical: resolve symlinks to the actual directory

  Exit status:
  Always successful (0) unless an error occurs reading the directory.
  `,
  clear: `clear
  Clear the terminal screen.

  Exit status:
  Always successful (0).
  `,
  exit: `exit [n]
  Exit the shell with status n.

  Causes the shell to exit with a status of n. If n is omitted,
  the exit status is that of the last command executed.

  Note: If the shell is not interactive, SIGTERM is sent to all jobs
  before exiting.
  `,
  export: `export [-p] [name[=value] ...]
  Export variables to the environment.

  Marks each name for automatic export to the environment of subsequently
  executed commands. If value is supplied, it is assigned before exporting.

  Options:
  -p     print all exported variables in exportable form

  Exit status:
  Returns 0 unless an invalid option is supplied or assignment fails.
  `,
  unset: `unset [-fv] [name ...]
  Unset shell and environment variables.

  For each name, removes the variable or function definition.

  Options:
  -f     unset only function names
  -v     unset only variable names (default)

  Exit status:
  Returns 0 unless an invalid option is supplied or name is read-only.
  `,
  env: `env [NAME=VALUE ...] [COMMAND [ARGS ...]]
  Execute a command with modified environment.

  With no arguments, prints all environment variables.
  With NAME=VALUE, sets variables in the environment for a command.

  Options:
  --json               output as JSON
  --yaml, --yml        output as YAML

  Examples:
  env                  # print all variables
  env PATH=/bin        # print current environment with modified PATH
  env -i TERM=xterm    # clear environment and set only TERM
  env --json           # print as JSON
  `,
  jobs: `jobs [-lnprs] [JOBSPEC ...]
  Display the status of background jobs.

  Options:
  -l     list job IDs with process group IDs
  -n     show only changed jobs
  -p     list only process group IDs
  -r     show only running jobs
  -s     show only stopped jobs
  --json               output as JSON
  --yaml, --yml        output as YAML

  Exit status:
  Returns 0 unless an invalid option is supplied or JOBSPEC not found.
  `,
  fg: `fg [JOBSPEC]
  Move a job to the foreground.

  Resumes JOBSPEC in the foreground. If JOBSPEC is not supplied,
  the shell's notion of the current job is used.

  JOBSPEC can be:
  %n        nth job in the job list
  %string   job started with 'string'
  %%        current job
  %+        current job (same as %%)
  %-        previous job

  Exit status:
  Returns the exit status of the resumed job, or non-zero if not found.
  `,
  bg: `bg [JOBSPEC ...]
  Continue stopped jobs in the background.

  Resumes each JOBSPEC as a background job. If JOBSPEC is not supplied,
  the shell's notion of the current job is used.

  JOBSPEC can be:
  %n        nth job in the job list
  %string   job started with 'string'
  %%        current job
  %+        current job (same as %%)
  %-        previous job

  Exit status:
  Returns 0 unless an invalid JOBSPEC is given.
  `,
  history: `history [QUERY]
  Display the command history.

  With no arguments, displays the entire history with line numbers.
  With a QUERY, searches history using fuzzy matching.

  Options:
  --json               output as JSON
  --yaml, --yml        output as YAML
  --help               show this help message

  Exit status:
  Returns 0 unless an invalid option is supplied.
  `,
  ls: `ls [OPTION]... [FILE]...
  List information about files and directories.

  Options:
  -a, --all                 do not ignore entries starting with .
  -A, --almost-all          same as -a but do not list . and ..
  -C                        list entries by columns
  -d, --directory           list directories themselves, not their contents
  -h, --human-readable      with -l, print sizes in human readable format
  -l                        use a long listing format
  -1                        list one file per line
  -R, --recursive           list subdirectories recursively
  -r, --reverse             reverse the sort order
  -S                        sort by file size, largest first
  -t                        sort by time, newest first
  -u                        sort by access time
  -U                        do not sort; list in directory order
  -v                        sort by version numbers
  --color[=WHEN]            colorize the output (auto, always, never)
  -G, --no-group            in long listing, don't print group names
  --full-time               show full date and time
  --json                    output as JSON
  --yaml, --yml             output as YAML
  --help                    display this help and exit
  --version                 output version information and exit
  `,
  printf: `printf FORMAT [ARGUMENT]...
  Write the formatted arguments to the standard output under the control of the format.

  Format string escapes:
  \\a     alert (bell)
  \\b     backspace
  \\c     suppress further output
  \\e     escape character
  \\f     form feed
  \\n     new line
  \\r     carriage return
  \\t     horizontal tab
  \\v     vertical tab
  \\\\     backslash
  \\0nnn   character with octal value nnn

  Format conversions:
  %s     string
  %d, %i decimal integer
  %f     floating point
  %x     hexadecimal
  %o     octal
  %c     single character
  %%     literal %
  `,
  alias: `alias [-p] [name[=value] ...]
  Define or display aliases.

  An alias is an alternative name for a command. When a command is typed,
  the shell checks for aliases and substitutes the alias value before
  executing the command.

  Without arguments, prints all defined aliases in the form:
  alias name='value'

  Options:
  -p              print all aliases in exportable format

  Arguments:
  name             display the alias named 'name'
  name=value       define 'name' as an alias for 'value'
  name1=v1 ...    define multiple aliases at once

  Alias rules:
  - Aliases are expanded in non-interactive mode only if on a separate line
  - Aliases cannot be recursive (alias foo=foo)
  - An alias cannot reference another alias in expansion

  Examples:
  alias                      # list all aliases
  alias ls                   # show what 'ls' is aliased to
  alias ls='ls -l'           # alias ls to ls -l
  alias rm='rm -i'           # alias rm to rm -i (confirm deletions)
  alias mygrep='grep -n'     # create custom alias

  Exit status:
  Returns 0 unless name is invalid or assignment fails.
  `,
  unalias: `unalias [-a] [name ...]
  Remove aliases.

  Removes each named alias. The -a option removes all aliases.

  Options:
  -a              remove all defined aliases
  
  Without -a, removes only the specified aliases by name.
  Attempting to unalias a non-existent alias is not an error.

  Examples:
  unalias ls                 # remove 'ls' alias
  unalias rm cd              # remove multiple aliases
  unalias -a                 # remove all aliases at once

  Exit status:
  Returns 0 unless an invalid option is supplied.
  `,
  source: `source FILENAME [ARGUMENTS]
  Read and execute commands from a file in the current shell.

  The FILENAME is sourced (executed) in the current shell context,
  rather than in a subshell. This means all variable assignments,
  function definitions, and other changes are preserved after the
  file finishes executing.

  Differences from running as script:
  - Changes to environment variables persist
  - Changes to shell variables persist
  - Functions defined in the file are available in the current shell
  - No subshell is created

  Arguments passed to source are available as $1, $2, etc.

  Exit status:
  Returns the exit status of the last command executed in FILENAME,
  or non-zero if FILENAME cannot be read.

  Examples:
  source ~/.bashrc           # load shell configuration
  source setup.sh PARAM1     # run setup script with argument
  `,
  js: `js [CODE]
  Execute JavaScript code in the shell context.

  Executes JavaScript CODE and prints the result. The code has access
  to shell state through:
  - SHELL.env          object containing environment variables
  - SHELL.cwd          current working directory
  - SHELL.jobs         array of background jobs
  - process.env        Node.js environment variables
  - require()          load Node.js modules

  The result of the last expression is printed to stdout.

  Examples:
  js Math.sqrt(16)                       # prints 4
  js Object.keys(process.env).length     # count env variables
  js SHELL.env['PATH']                   # show PATH
  js SHELL.cwd                           # show current directory
  js require('fs').readdirSync('.')      # list files in directory

  Exit status:
  Returns 0 on success, non-zero if code throws an error.
  `,
  read: `read [-ers] [-p prompt] [-t timeout] [-n nchars] [-d delim] [VARIABLE ...]
  Read a line from standard input.

  Options:
  -p prompt     display prompt before reading
  -t timeout    read times out after timeout seconds
  -n nchars     read stops after nchars characters
  -d delim      read stops after delimiter character
  -e            use Readline for input
  -r            do not interpret backslash escapes
  -s            do not echo input (useful for passwords)

  If no VARIABLE is given, the input is assigned to REPLY.
  The input line is split into fields assigned to multiple variables.

  Exit status:
  Returns 0 unless EOF is encountered, a timeout expires, or invalid option.
  `,
  '[': `[ EXPRESSION ]
  Evaluate a conditional expression (POSIX test).

  File tests:
  -b FILE      true if FILE exists and is a block special file
  -c FILE      true if FILE exists and is a character special file
  -d FILE      true if FILE exists and is a directory
  -e FILE      true if FILE exists
  -f FILE      true if FILE exists and is a regular file
  -g FILE      true if FILE exists and has setgid bit set
  -h FILE      true if FILE exists and is a symbolic link
  -L FILE      true if FILE exists and is a symbolic link (same as -h)
  -k FILE      true if FILE exists and has sticky bit set
  -p FILE      true if FILE exists and is a named pipe
  -r FILE      true if FILE exists and is readable
  -s FILE      true if FILE exists and has size greater than 0
  -u FILE      true if FILE exists and has setuid bit set
  -w FILE      true if FILE exists and is writable
  -x FILE      true if FILE exists and is executable
  -O FILE      true if FILE is owned by the effective user ID
  -G FILE      true if FILE is owned by the effective group ID

  String tests:
  -n STRING    true if STRING is not empty (default)
  -z STRING    true if STRING is empty
  STRING1 = STRING2    true if strings are equal
  STRING1 != STRING2   true if strings are not equal
  STRING1 < STRING2    true if STRING1 sorts before STRING2
  STRING1 > STRING2    true if STRING1 sorts after STRING2

  Arithmetic tests:
  INT1 -eq INT2   equal
  INT1 -ne INT2   not equal
  INT1 -lt INT2   less than
  INT1 -le INT2   less than or equal
  INT1 -gt INT2   greater than
  INT1 -ge INT2   greater than or equal

  Logical:
  ! EXPR              true if EXPR is false
  EXPR1 -a EXPR2      true if both are true (AND, implied)
  EXPR1 -o EXPR2      true if either is true (OR)
  ( EXPR )            grouping

  Note: This form requires ] as the last argument.

  Exit status:
  Returns 0 if EXPRESSION is true, 1 if false or invalid.
  `,
  cat: `cat [-bEnstv] [FILE ...]
  Concatenate files and print to standard output.

  With no FILE or when FILE is -, reads from standard input.

  Options:
  -b      number only non-empty output lines
  -E      display $ at end of each line
  -n      number all output lines
  -s      suppress repeated empty lines
  -t      display tabs as ^I
  -v      display non-printing characters

  Exit status:
  Returns 0 on success, non-zero if FILE cannot be read.

  Examples:
  cat file.txt                # display file
  cat file1 file2             # concatenate and display
  cat > file.txt              # create file from stdin (Ctrl+D to end)
  cat << EOF                  # read until delimiter
  `,
  test: `test [EXPRESSION]
  Evaluate a conditional expression (same as [ ]).

  Identical to [ EXPRESSION ] but does not require ] as the last argument.

  All operators and syntax are the same as [ ], including:
  File tests, string tests, arithmetic tests, and logical operators.

  Exit status:
  Returns 0 if EXPRESSION is true, 1 if false or invalid.

  Examples:
  test -f /etc/passwd         # check if file exists
  test "$var" = "value"       # compare strings
  test -d /tmp                # check if directory exists
  test $x -gt 5               # arithmetic comparison
  `,
};

// ...

// Capture the real stdout writer up front: builtins temporarily swap
// process.stdout.write when their output is redirected or piped, but prompt
// clearing must always reach the terminal itself.
const ORIG_STDOUT_WRITE = process.stdout.write.bind(process.stdout);

// Helper to clear the current readline prompt line and output text properly
// addNewline=false lets builtins like printf emit partial lines.
function writeOutput(text, addNewline = true) {
  if (rl.terminal) {
    // Clear the current prompt line (always on the real terminal)
    ORIG_STDOUT_WRITE('\x1b[2K\r');
  }
  process.stdout.write(text);
  if (addNewline && !text.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

// Shell arrays storage
const SHELL_ARRAYS = {};

// Error formatting utility for better error messages with line numbers
function formatError(message, context, sourceSnippet, includeStack) {
  // context: { startLine, endLine, filename, content }
  if (!context || !context.filename) {
    return message;
  }
  
  const basename = path.basename(context.filename);
  let formatted = `${basename}:${context.startLine}`;
  if (context.startLine !== context.endLine) {
    formatted += `-${context.endLine}`;
  }
  formatted += `: error: ${message}`;
  
  // Add source snippet if available and context is provided
  if (sourceSnippet && context.content) {
    // Show just the first line of the content for inline errors
    const firstLine = context.content.split('\n')[0];
    formatted += `\n  ${firstLine}`;
  }
  
  // Add call stack if requested
  if (includeStack && CALL_STACK.length > 0) {
    formatted += formatCallStack();
  }
  
  return formatted;
}

let builtins;
try {
  builtins = {
  echo: function(args) {
    if (args.includes('--help')) {
      console.log(help.echo);
      return 0;
    }
    let interpretEscapes = false;
    let suppressNewline = false;
    let startIdx = 1;
    
    // Parse combined flags: -n, -e, -E, -ne, -en, ...
    while (startIdx < args.length && /^-[neE]+$/.test(args[startIdx])) {
      for (const ch of args[startIdx].slice(1)) {
        if (ch === 'n') suppressNewline = true;
        else if (ch === 'e') interpretEscapes = true;
        else if (ch === 'E') interpretEscapes = false;
      }
      startIdx++;
    }
    
    let output = args.slice(startIdx).join(' ');
    
    if (interpretEscapes) {
      // Interpret escape sequences
      output = output
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\033/g, '\033')
        .replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
    
    writeOutput(output, !suppressNewline);
    return 0;
  },
  cd: function(args) {
    if (args.includes('--help')) {
      console.log(help.cd);
      return 0;
    }
    const target = args[1] || SHELL.env.HOME || process.env.HOME || '/tmp';
    try {
      const newdir = path.resolve(SHELL.cwd, target);
      fs.accessSync(newdir);
      SHELL.cwd = newdir;
      process.chdir(SHELL.cwd); // align node process cwd
    } catch (e) {
      console.error('cd: ' + e.message);
      return 1;
    }
    return 0;
  },
  mkcd: function(args) {
    if (args.includes('--help')) {
      console.log(help.mkcd);
      return 0;
    }
    const target = args[1];
    if (!target) {
      console.error('mkcd: missing directory argument');
      return 1;
    }
    try {
      const newdir = path.resolve(SHELL.cwd, target);
      fs.mkdirSync(newdir, { recursive: true });
      fs.accessSync(newdir);
      SHELL.cwd = newdir;
      process.chdir(SHELL.cwd); // align node process cwd
    } catch (e) {
      console.error('mkcd: ' + e.message);
      return 1;
    }
    return 0;
  },
  pwd: function(args) {
    if (args.includes('--help')) {
      console.log(help.pwd);
      return 0;
    }
    console.log(SHELL.cwd);
    return 0;
  },
  clear: function(args) {
    if (args.includes('--help')) {
      console.log(help.clear);
      return 0;
    }
    console.clear();
    return 0;
  },
  exit: async function(args) {
    if (args.includes('--help')) {
      console.log(help.exit);
      return 0;
    }
    const code = args[1] ? Number(args[1]) || 0 : 0;
    await runExitTraps();
    process.exit(code);
  },
  export: function(args) {
    if (args.includes('--help')) {
      console.log(help.export);
      return 0;
    }
    // export KEY=VALUE or export KEY
    for (let i = 1; i < args.length; i++) {
      const part = args[i];
      const eq = part.indexOf('=');
      if (eq >= 0) {
        const key = part.slice(0, eq);
        const val = part.slice(eq+1);
        SHELL.env[key] = val;
      } else {
        SHELL.env[part] = process.env[part] || '';
      }
    }
    return 0;
  },
  unset: function(args) {
    if (args.includes('--help')) {
      console.log(help.unset);
      return 0;
    }
    for (let i = 1; i < args.length; i++) {
      delete SHELL.env[args[i]];
    }
    return 0;
  },
  env: function(args) {
    if (args.includes('--help')) {
      console.log(help.env);
      return 0;
    }
    
    // Detect output format
    const outputFormat = outputFormatter.detectOutputFormat(args);
    const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
    
    if (outputFormat) {
      const envData = SHELL.env;
      if (outputFormat === 'json') {
        console.log(outputFormatter.toJSON(envData));
      } else if (outputFormat === 'yaml') {
        console.log(outputFormatter.toYAML(envData));
      }
    } else {
      for (const k of Object.keys(SHELL.env)) {
        console.log(`${k}=${SHELL.env[k]}`);
      }
    }
    return 0;
  },
  jobs: function(args) {
    if (args.includes('--help')) {
      console.log(help.jobs);
      return 0;
    }
    
    // Detect output format
    const outputFormat = outputFormatter.detectOutputFormat(args);
    const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
    
    if (outputFormat) {
      const jobsData = SHELL.jobs.map(j => ({
        id: j.id,
        status: j.status,
        cmdline: j.cmdline,
        pids: j.pids,
        background: j.background || false
      }));
      if (outputFormat === 'json') {
        console.log(outputFormatter.toJSON(jobsData));
      } else if (outputFormat === 'yaml') {
        console.log(outputFormatter.toYAML(jobsData));
      }
    } else {
      for (const j of SHELL.jobs) {
        console.log(`[${j.id}] ${j.status}\t${j.cmdline}`);
      }
    }
    return 0;
  },
  fg: async function(args) {
    if (args.includes('--help')) {
      console.log(help.fg);
      return 0;
    }
    const id = args[1] ? Number(args[1].replace('%','')) : (SHELL.jobs.length ? SHELL.jobs[SHELL.jobs.length-1].id : null);
    if (!id) { console.error('fg: no job'); return 1; }
    const job = SHELL.jobs.find(j => j.id === id);
    if (!job) { console.error('fg: job not found'); return 1; }
    
    console.log(job.cmdline);
    job.background = false;
    job.suspended = false;
    job.status = 'running';

    // If job was started with pty, re-attach it
    if (job.pty) {
      rl.pause();
      try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
      
      const ptyInputHandler = (data) => job.pty.write(data.toString());
      process.stdin.on('data', ptyInputHandler);
      // rl.pause() released the stdin stream; a fresh 'data' listener does
      // not resume it, so pipe input to the job explicitly.
      try { process.stdin.resume(); } catch (e) { /* ignore */ }

      const resizeHandler = () => {
        if(job.pty) job.pty.resize(process.stdout.columns, process.stdout.rows);
      };
      process.stdout.on('resize', resizeHandler);
      resizeHandler(); // Initial resize

      // Resume the process
      try {
        process.kill(job.pty.pid, 'SIGCONT');
      } catch(e) {
        // process might have died already
      }

      // Wait for it to finish or get suspended again
      await new Promise(resolve => {
        const exitHandler = job.pty.onExit(() => {
          process.stdin.removeListener('data', ptyInputHandler);
          process.stdout.removeListener('resize', resizeHandler);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          resolve();
        });

        const checkSuspended = setInterval(() => {
          if (job.status === 'stopped') {
            process.stdin.removeListener('data', ptyInputHandler);
            process.stdout.removeListener('resize', resizeHandler);
            if (process.stdin.isTTY) process.stdin.setRawMode(false);
            clearInterval(checkSuspended);
            console.log(`\n[${job.id}] Stopped\t${job.cmdline}`);
            resolve();
          }
        }, 100);
      });
      
      // After job is done, restore shell terminal control
      if (ptctl.available) {
        try {
          debug(`fg: Restoring terminal to shell PGID ${shellPgid}`);
          ptctl.tcsetpgrp(0, shellPgid);
        } catch (e) {
          debug('fg: ptctl error restoring terminal:', e.message);
        }
      }
      
      // Resume shell
      if (rl.paused) {
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
        }
        rl.resume();
      }
    } else {
      // For non-pty jobs (background/suspended tasks), resume and wait
      try {
        // Pause readline first
        rl.pause();
        
        // Disable raw mode so the resumed job can receive signals normally
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        
        // Give terminal control to the job's process group
        if (ptctl.available && job.pids && job.pids.length > 0) {
          try {
            const jobPgid = ptctl.getpgid(job.pids[0]);
            debug(`fg: Setting terminal to job PGID ${jobPgid}`);
            
            // Retry a few times to handle potential race condition
            let retries = 0;
            while (retries < 10) {
              try {
                ptctl.tcsetpgrp(0, jobPgid);
                break;
              } catch (e) {
                retries++;
                const start = Date.now(); while(Date.now() - start < 1);
              }
            }
          } catch (e) {
            debug('fg: ptctl error setting terminal:', e.message);
          }
        }

        // Ensure terminal settings are correct for signals
        if (ptctl.available) {
          try { ptctl.enable_signals(0); } catch(e) {}
        }

        for (const pid of job.pids) {
          debug(`fg: Sending SIGCONT to PID ${pid}`);
          process.kill(pid, 'SIGCONT');
        }
      } catch(e) {
        console.error('fg:', e.message);
        
        // Restore terminal before returning
        if (ptctl.available) {
          try {
            ptctl.tcsetpgrp(0, shellPgid);
          } catch(e) {}
        }
        if (rl.paused) {
          if (process.stdin.isTTY && process.stdin.setRawMode) {
            try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
          }
          rl.resume();
        }
        return 1;
      }
      
      // Wait for job to complete or stop again
      await new Promise((resolve) => {
        let isDone = false;
        
        const cleanup = () => {
          if (isDone) return;
          isDone = true;
          clearInterval(checkStatus);
          
          // Restore terminal to shell
          if (ptctl.available) {
            try {
              ptctl.tcsetpgrp(0, shellPgid);
            } catch (e) {}
           }
           
               // Resume readline
            if (rl.paused) {
              if (process.stdin.isTTY && process.stdin.setRawMode) {
                try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
              }
              rl.resume();
              rl.line = '';
              rl.cursor = 0;
            }
            resolve();
         };

        // Polling loop to detect if child stopped (SIGTSTP) or finished
        const checkStatus = setInterval(() => {
          if (isDone) return;
          
          // Check if job still exists in SHELL.jobs
          const currentJob = SHELL.jobs.find(j => j.id === job.id);
          if (!currentJob) {
            cleanup();
            return;
          }

          try {
            // Check process state via /proc
            const pid = job.pids[0];
            const statFile = `/proc/${pid}/stat`;
            if (fs.existsSync(statFile)) {
              const stat = fs.readFileSync(statFile, 'utf8');
              const parts = stat.split(' ');
              const state = parts[2];
              
              if (state === 'T') {
                if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Detected job ${job.id} stopped (state T)`);
                job.status = 'stopped';
                job.suspended = true;
                console.log(`\n[${job.id}]+ Stopped\t${job.cmdline}`);
                cleanup();
              }
            } else {
              // Process gone
              markJobDone(job);
              cleanup();
            }
          } catch (e) {
            // Might have exited between checks
            markJobDone(job);
            cleanup();
          }
        }, 100);
      });
      
      return 0;
    }
    return 0;
  },
  bg: function(args) {
    if (args.includes('--help')) {
      console.log(help.bg);
      return 0;
    }
    const id = args[1] ? Number(args[1].replace('%','')) : (SHELL.jobs.length ? SHELL.jobs[SHELL.jobs.length-1].id : null);
    if (!id) { console.error('bg: no job'); return 1; }
    const job = SHELL.jobs.find(j => j.id === id);
    if (!job) { console.error('bg: job not found'); return 1; }
    // resume job in background
    try {
      for (const pid of job.pids) {
        process.kill(pid, 'SIGCONT');
      }
      job.status = 'running';
    } catch (e) {
      console.error('bg:', e.message);
      return 1;
    }
    return 0;
  },
  history: function(args) {
    if (args.includes('--help')) {
      console.log(help.history);
      return 0;
    }
    
    // Detect output format
    const outputFormat = outputFormatter.detectOutputFormat(args);
    const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
    
    let entries;
    // history [query] - search history, or list all if no query
    if (filteredArgs.length === 1) {
      // List all history
      entries = historyDB.getAll(1000);
    } else {
      // Search history
      const query = filteredArgs.slice(1).join(' ');
      entries = historyDB.search(query, 50);
    }
    
    if (outputFormat) {
      const historyData = entries.map(e => ({
        id: e.id,
        command: e.command,
        timestamp: new Date(e.timestamp * 1000).toISOString(),
        exit_code: e.exit_code
      }));
      if (outputFormat === 'json') {
        console.log(outputFormatter.toJSON(historyData));
      } else if (outputFormat === 'yaml') {
        console.log(outputFormatter.toYAML(historyData));
      }
    } else {
      if (entries.length === 0) {
        console.log('No matching commands found');
      } else {
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const timestamp = new Date(e.timestamp * 1000).toLocaleString();
          const exitCode = e.exit_code !== null ? ` [${e.exit_code}]` : '';
          console.log(`${e.id}\t${timestamp}${exitCode}\t${e.command}`);
        }
      }
    }
    return 0;
  },
  ls: function(args) {
    if (args.includes('--help')) {
      console.log(help.ls);
      return 0;
    }
    
    // Detect output format before parsing arguments
    const outputFormat = outputFormatter.detectOutputFormat(args);
    const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
    
    const argv = minimist(filteredArgs.slice(1), {
      alias: {
        all: 'a',
        'almost-all': 'A',
        long: 'l',
        'human-readable': 'h',
        reverse: 'r',
        recursive: 'R',
        sort: 'S',
        time: 't',
        directory: 'd',
        classify: 'F',
        inode: 'i',
        size: 's',
      },
      boolean: ['a', 'A', 'l', 'h', 'r', 'R', 'S', 't', 'c', 'C', 'd', 'D', 'f', 'F', 'g', 'G', 'i', 'k', 'L', 'm', 'n', 'N', 'o', 'p', 'q', 'Q', 's', 'U', 'v', 'x', 'X', 'Z', '1', 'G'],
      string: ['color'],
    });

    const longFormat = argv.l;
    const allFiles = argv.a;
    const almostAll = argv.A;
    const humanReadable = argv.h;
    const reverse = argv.r;
    const recursive = argv.R;
    const sortBySize = argv.S;
    const sortByTime = argv.t;
    const directory = argv.d;
    const classify = argv.F;
    const showInode = argv.i;
    const showSize = argv.s;
    
    // Color support - disabled for JSON/YAML output
    let useColor = !outputFormat && 
      (argv.color === true || argv.color === 'always' || 
       (argv.color !== 'never' && process.stdout.isTTY));
    
    const colorize = (name, stat) => {
      if (!useColor) return name;
      // Color codes
      const colors = {
        dir: '\x1b[34m',      // blue for directories
        link: '\x1b[36m',     // cyan for symlinks
        exe: '\x1b[32m',      // green for executables
        special: '\x1b[33m',  // yellow for special files
        reset: '\x1b[0m'
      };
      
      if (stat.isDirectory()) return colors.dir + name + colors.reset;
      if (stat.isSymbolicLink()) return colors.link + name + colors.reset;
      if (stat.mode & 0o111) return colors.exe + name + colors.reset;
      if (stat.isCharacterDevice() || stat.isBlockDevice() || stat.isFIFO() || stat.isSocket()) {
        return colors.special + name + colors.reset;
      }
      return name;
    };

    let paths = argv._;
    if (paths.length === 0) {
      paths.push(SHELL.cwd);
    }
    
    // Collect results for JSON/YAML output
    const allResults = [];

    const listPath = (targetPath) => {
      try {
        let stat;
        try {
          stat = fs.statSync(targetPath);
        } catch (statErr) {
          console.error(`ls: cannot access '${targetPath}': ${statErr.message}`);
          return;
        }

        if (directory) {
          printEntries([path.basename(targetPath)], path.dirname(targetPath), targetPath);
          return;
        }

        if (!stat.isDirectory()) {
          printEntries([path.basename(targetPath)], path.dirname(targetPath), targetPath);
          return;
        }

        if (!outputFormat && (paths.length > 1 || recursive)) {
          console.log(`${targetPath}:`);
        }

        let entries;
        try {
          entries = fs.readdirSync(targetPath);
        } catch (readErr) {
          console.error(`ls: cannot open directory '${targetPath}': ${readErr.message}`);
          return;
        }

        let filteredEntries = entries;
        if (!allFiles && !almostAll) {
          filteredEntries = entries.filter(e => !e.startsWith('.'));
        }
        if (almostAll) {
          filteredEntries = entries.filter(e => e !== '.' && e !== '..');
        }

        printEntries(filteredEntries, targetPath, targetPath);

        if (recursive) {
          for (const entry of filteredEntries) {
            const fullPath = path.join(targetPath, entry);
            const entryStat = fs.statSync(fullPath);
            if (entryStat.isDirectory()) {
              if (!outputFormat) console.log('');
              listPath(fullPath);
            }
          }
        }
      } catch (e) {
        console.error(`ls: cannot access '${targetPath}': ${e.message}`);
      }
    };

    const printEntries = (entries, basePath, originalPath) => {
      let files = entries.map(entry => {
        const fullPath = path.join(basePath, entry);
        try {
          const stat = fs.statSync(fullPath);
          return { name: entry, stat };
        } catch (e) {
          return { name: entry, stat: null };
        }
      }).filter(file => file.stat);

      if (sortBySize) {
        files.sort((a, b) => b.stat.size - a.stat.size);
      } else if (sortByTime) {
        files.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      } else {
        files.sort((a, b) => a.name.localeCompare(b.name));
      }

      if (reverse) {
        files.reverse();
      }

      // For JSON/YAML output, format structured data
      if (outputFormat) {
        const listing = outputFormatter.formatDirectoryListing(
          originalPath, 
          files, 
          { showInode, humanReadable }
        );
        allResults.push(listing);
        return;
      }

      const getIndicator = (stat) => {
        if (!classify) return '';
        if (stat.isDirectory()) return '/';
        if (stat.isSymbolicLink()) return '@';
        if (stat.isSocket()) return '=';
        if (stat.isFIFO()) return '|';
        if (stat.mode & 0o111) return '*';
        return '';
      };

      if (longFormat) {
         for (const file of files) {
           const { name, stat } = file;
           const inode = showInode ? `${stat.ino} ` : '';
           const sizeInBlocks = showSize ? `${Math.ceil(stat.size / 1024)} ` : '';
           const mode = stat.mode.toString(8).slice(-3);
           const size = humanReadable ? formatSize(stat.size) : stat.size.toString().padStart(10);
           const mtime = stat.mtime.toLocaleString();
           const indicator = getIndicator(stat);
           const coloredName = colorize(name, stat);
           console.log(`${inode}${sizeInBlocks}${mode} ${size} ${mtime} ${coloredName}${indicator}`);
         }
       } else if (argv.m) {
         const names = files.map(f => {
           const indicator = getIndicator(f.stat);
           const coloredName = colorize(f.name, f.stat);
           return `${coloredName}${indicator}`;
         });
         console.log(names.join(', '));
       } else if (argv['1']) {
         const names = files.map(f => {
           const indicator = getIndicator(f.stat);
           const coloredName = colorize(f.name, f.stat);
           return `${coloredName}${indicator}`;
         });
         for (const name of names) {
           const inode = showInode ? `${f.stat.ino} ` : '';
           const sizeInBlocks = showSize ? `${Math.ceil(f.stat.size / 1024)} ` : '';
           console.log(`${inode}${sizeInBlocks}${name}`);
         }
       } else if (argv.C || argv.x) {
         const names = files.map(f => {
           const indicator = getIndicator(f.stat);
           const inode = showInode ? `${f.stat.ino} ` : '';
           const sizeInBlocks = showSize ? `${Math.ceil(f.stat.size / 1024)} ` : '';
           const coloredName = colorize(f.name, f.stat);
           return `${inode}${sizeInBlocks}${coloredName}${indicator}`;
         });
         const termWidth = process.stdout.columns || 80;
         if (argv.x) {
           // list entries by lines
           let output = '';
           for (const name of names) {
             if (output.length + name.length + 2 > termWidth) {
               console.log(output);
               output = '';
             }
             output += name + '  ';
           }
           if (output) {
             console.log(output);
           }
         } else {
           // list entries by columns
           const maxNameLength = Math.max(...names.map(n => n.length)) + 2;
           const numCols = Math.floor(termWidth / maxNameLength);
           const numRows = Math.ceil(names.length / numCols);
           for (let i = 0; i < numRows; i++) {
             let line = '';
             for (let j = 0; j < numCols; j++) {
               const index = i + j * numRows;
               if (index < names.length) {
                 line += names[index].padEnd(maxNameLength);
               }
             }
             console.log(line);
           }
         }
       } else {
         const names = files.map(f => {
           const indicator = getIndicator(f.stat);
           const inode = showInode ? `${f.stat.ino} ` : '';
           const sizeInBlocks = showSize ? `${Math.ceil(f.stat.size / 1024)} ` : '';
           const coloredName = colorize(f.name, f.stat);
           return `${inode}${sizeInBlocks}${coloredName}${indicator}`;
         });
         for (const name of names) {
           console.log(name);
         }
       }
    };

    const formatSize = (bytes) => {
      if (bytes === 0) return '0B';
      const k = 1024;
      const sizes = ['B', 'K', 'M', 'G', 'T'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
    };

    for (let i = 0; i < paths.length; i++) {
      const targetPath = path.resolve(SHELL.cwd, paths[i]);
      listPath(targetPath);
    }
    
    // Output collected results in requested format
    if (outputFormat) {
      const output = allResults.length === 1 ? allResults[0] : allResults;
      if (outputFormat === 'json') {
        console.log(outputFormatter.toJSON(output));
      } else if (outputFormat === 'yaml') {
        console.log(outputFormatter.toYAML(output));
      }
    }
    
    return 0;
  },
  printf: function(args) {
    if (args.includes('--help')) {
      console.log(help.printf);
      return 0;
    }
    // printf format [args...]
    if (args.length < 2) {
      console.error('printf: not enough arguments');
      return 1;
    }
    
    const format = args[1];
    const values = args.slice(2);
    let output = '';
    let valueIdx = 0;
    
    for (let i = 0; i < format.length; i++) {
      if (format[i] === '\\' && i + 1 < format.length) {
        // Handle escape sequences
        const esc = format[i + 1];
        if (esc === 'n') {
          output += '\n';
          i++;
        } else if (esc === 't') {
          output += '\t';
          i++;
        } else if (esc === 'r') {
          output += '\r';
          i++;
        } else if (esc === 'b') {
          output += '\b';
          i++;
        } else if (esc === 'f') {
          output += '\f';
          i++;
        } else if (esc === 'v') {
          output += '\v';
          i++;
        } else if (esc === '\\') {
          output += '\\';
          i++;
        } else if (esc === '0') {
          output += '\0';
          i++;
        } else {
          output += format[i];
        }
      } else if (format[i] === '%' && i + 1 < format.length) {
        const spec = format[i + 1];
        if (spec === '%') {
          output += '%';
          i++;
        } else if (spec === 's') {
          output += values[valueIdx] || '';
          valueIdx++;
          i++;
        } else if (spec === 'd' || spec === 'i') {
          const val = parseInt(values[valueIdx] || '0', 10);
          output += val.toString();
          valueIdx++;
          i++;
        } else if (spec === 'f') {
          const val = parseFloat(values[valueIdx] || '0');
          output += val.toString();
          valueIdx++;
          i++;
        } else if (spec === 'x') {
          const val = parseInt(values[valueIdx] || '0', 10);
          output += val.toString(16);
          valueIdx++;
          i++;
        } else if (spec === 'o') {
          const val = parseInt(values[valueIdx] || '0', 10);
          output += val.toString(8);
          valueIdx++;
          i++;
        } else if (spec === 'c') {
          const val = values[valueIdx] || '';
          output += val.length > 0 ? val[0] : '';
          valueIdx++;
          i++;
        } else if (spec === 'n') {
          // %n is not supported (would require variable assignment)
          i++;
        } else {
          output += '%' + spec;
          i++;
        }
      } else {
        output += format[i];
      }
    }
    
    writeOutput(output, false);
    return 0;
  },
  alias: function(args) {
    if (args.includes('--help')) {
      console.log(help.alias);
      return 0;
    }
    if (args.length === 1) {
      for (const alias in SHELL.aliases) {
        console.log(`alias ${alias}='${SHELL.aliases[alias]}'`);
      }
    } else {
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        const eq = arg.indexOf('=');
        if (eq > 0) {
          const key = arg.slice(0, eq);
          const val = arg.slice(eq + 1);
          SHELL.aliases[key] = val;
        } else {
          if (arg in SHELL.aliases) {
            console.log(`alias ${arg}='${SHELL.aliases[arg]}'`);
          }
        }
      }
    }
    return 0;
  },
  unalias: function(args) {
    if (args.includes('--help')) {
      console.log(help.unalias);
      return 0;
    }
    if (args.length === 1) {
      console.error('unalias: usage: unalias [-a] name [name ...]');
      return 1;
    }
    for (let i = 1; i < args.length; i++) {
      delete SHELL.aliases[args[i]];
    }
    return 0;
  },
  source: async function(args) {
    if (args.includes('--help')) {
      console.log(help.source);
      return 0;
    }
    if (args.length < 2) {
      console.error('source: usage: source <file>');
      return 1;
    }
    const file = args[1];
    const filePath = path.resolve(SHELL.cwd, expandVars(file));
    try {
      const script = fs.readFileSync(filePath, 'utf8');
      const lines = script.split('\n');
      // Group multi-line functions and control structures into blocks so
      // their bodies are not executed line-by-line as separate commands.
      const blocks = await parseScriptBlocks(lines, filePath);
      for (const block of blocks) {
        if (block.content && block.content.trim()) {
          await runLine(block.content, block);
        }
        if (block._heredocTmpFile) {
          try { fs.unlinkSync(block._heredocTmpFile); } catch (e) {}
        }
      }
      return 0;
    } catch (e) {
      console.error(`source: ${e.message}`);
      return 1;
    }
  },
  js: async function(args) {
    if (args.includes('--help')) {
      console.log(help.js);
      return 0;
    }
    if (args.length < 2) {
      console.error('js: usage: js <code>');
      return 1;
    }
    
    const code = args.slice(1).join(' ');
    
    try {
      // Create context with shell access
      const context = {
        env: SHELL.env,
        cwd: SHELL.cwd,
        home: SHELL.env.HOME || process.env.HOME || '/tmp',
        user: (() => { try { return os.userInfo().username; } catch (e) { return SHELL.env.USER || SHELL.env.LOGNAME || 'user'; } })(),
        // Utility functions
        cd: (dir) => {
          const target = path.resolve(SHELL.cwd, expandVars(dir));
          try {
            fs.accessSync(target);
            SHELL.cwd = target;
            process.chdir(SHELL.cwd);
            return true;
          } catch (e) {
            return false;
          }
        },
        pwd: () => SHELL.cwd,
        ls: (dir) => {
          const target = dir ? path.resolve(SHELL.cwd, dir) : SHELL.cwd;
          try {
            return fs.readdirSync(target);
          } catch (e) {
            return [];
          }
        },
        readFile: (file) => {
          const target = path.resolve(SHELL.cwd, file);
          return fs.readFileSync(target, 'utf8');
        },
        writeFile: (file, content) => {
          const target = path.resolve(SHELL.cwd, file);
          fs.writeFileSync(target, content, 'utf8');
          return true;
        },
      };
      
      // Use Function constructor to create and execute code with context
      // This allows access to context properties while keeping it isolated
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);
      
      // Wrap in async IIFE to support both statements and expressions
      // Detect if code contains newlines or multiple statements
      const hasMultipleStatements = code.includes('\n') || (code.match(/;/g) || []).length > 1 || code.trim().endsWith(';');
      
      let result;
      let fn;
      
      if (hasMultipleStatements) {
        // For multi-statement blocks, use statement mode directly
        fn = new Function(
          ...contextKeys,
          `return (async () => { ${code} })()`
        );
        result = await fn(...contextValues);
      } else {
        // For single expressions, try expression mode first
        try {
          fn = new Function(
            ...contextKeys,
            `return (async () => { return ${code} })()`
          );
          result = await fn(...contextValues);
        } catch (e) {
          // Fall back to statement mode if expression fails
          fn = new Function(
            ...contextKeys,
            `return (async () => { ${code} })()`
          );
          result = await fn(...contextValues);
        }
      }
      
      // Only output if result is explicitly returned/awaited
      if (result !== undefined && result !== null) {
        if (typeof result === 'object') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result);
        }
      }
      
      return 0;
    } catch (e) {
      console.error(`js error: ${e.message}`);
      return 1;
    }
  },
  read: async function(args) {
    if (args.includes('--help')) {
      console.log(help.read);
      return 0;
    }
    // read VAR1 VAR2 ... 
    // Reads a line from stdin and stores it in the variables
    // Usage: read [-p "prompt"] VAR1 [VAR2 ...]
    if (args.length < 2) {
      console.error('read: usage: read [-p prompt] VAR1 [VAR2 ...]');
      return 1;
    }
    
    let varNames = [];
    let promptText = '';
    let i = 1;
    
    // Check for -p option
    if (args[i] === '-p' && i + 1 < args.length) {
      promptText = args[i + 1];
      i += 2;
    }
    
    // Collect variable names
    while (i < args.length) {
      varNames.push(args[i]);
      i++;
    }
    
    if (varNames.length === 0) {
      console.error('read: no variable names specified');
      return 1;
    }
    
    return new Promise((resolve) => {
      // Pause main readline if it's active
      if (!rl.paused) {
        rl.pause();
      }
      
      // Flush stdout before reading
      if (promptText) {
        process.stdout.write(promptText);
      }
      
      // Create a new readline interface for reading from stdin
      // Force terminal to false to prevent readline from printing its own prompt
      const rlLocal = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });
      
      let resolved = false;
      
      rlLocal.once('line', (line) => {
        if (!resolved) {
          resolved = true;
          const parts = line.split(/\s+/);
          for (let j = 0; j < varNames.length; j++) {
            SHELL.env[varNames[j]] = parts[j] || '';
          }
          rlLocal.close();
          resolve(0);
        }
      });
      
      rlLocal.once('close', () => {
        if (!resolved) {
          resolved = true;
          rlLocal.close();
          resolve(0);
        }
      });
      
      rlLocal.once('error', () => {
        if (!resolved) {
          resolved = true;
          rlLocal.close();
          resolve(1);
        }
      });
    });
  },
  '[': function(args) {
    if (args.includes('--help')) {
      console.log(help['[']);
      return 0;
    }
    // The test command: [ expression ]
    // Last argument must be ]
    if (args[args.length - 1] !== ']') {
      console.error('[: missing ]');
      return 1;
    }
    
    const expr = args.slice(1, -1);
    if (expr.length === 0) {
      return 1;
    }
    
    // Two-argument forms: file tests (-f FILE) and string tests (-z/-n STRING)
    if (expr.length === 2) {
      const [op, operand] = expr;
      if (op === '-z') return expandVars(operand).length === 0 ? 0 : 1;
      if (op === '-n') return expandVars(operand).length !== 0 ? 0 : 1;
      if (op.length === 2 && op[0] === '-') {
        const target = path.resolve(SHELL.cwd, expandVars(operand));
        const yes = (c) => (c ? 0 : 1);
        if (op === '-h' || op === '-L') {
          try { return yes(fs.lstatSync(target).isSymbolicLink()); } catch (e) { return 1; }
        }
        let st = null;
        try { st = fs.statSync(target); } catch (e) { st = null; }
        switch (op) {
          case '-e': return yes(st !== null);
          case '-f': return yes(st && st.isFile());
          case '-d': return yes(st && st.isDirectory());
          case '-s': return yes(st && st.size > 0);
          case '-p': return yes(st && st.isFIFO());
          case '-c': return yes(st && st.isCharacterDevice());
          case '-b': return yes(st && st.isBlockDevice());
          case '-g': return yes(st && (st.mode & 0o2000));
          case '-u': return yes(st && (st.mode & 0o4000));
          case '-k': return yes(st && (st.mode & 0o1000));
          case '-O': return yes(st && st.uid === process.getuid());
          case '-G': return yes(st && st.gid === process.getgid());
          case '-r': case '-w': case '-x': {
            if (!st) return 1;
            const want = op === '-r' ? fs.constants.R_OK
                       : op === '-w' ? fs.constants.W_OK
                       : fs.constants.X_OK;
            try { fs.accessSync(target, want); return 0; } catch (e) { return 1; }
          }
        }
      }
      return 1;
    }
    
    // Handle comparison operators
    if (expr.length === 3) {
      const [left, op, right] = expr;
      const lVal = expandVars(left);
      const rVal = expandVars(right);
      
      // Numeric comparisons
      const lNum = Number(lVal);
      const rNum = Number(rVal);
      
      let result = false;
      switch (op) {
        case '-eq': result = lNum === rNum; break;
        case '-ne': result = lNum !== rNum; break;
        case '-lt': result = lNum < rNum; break;
        case '-le': result = lNum <= rNum; break;
        case '-gt': result = lNum > rNum; break;
        case '-ge': result = lNum >= rNum; break;
        case '=':
        case '==': result = lVal === rVal; break;
        case '!=': result = lVal !== rVal; break;
        case '-z': result = lVal.length === 0; break;
        case '-n': result = lVal.length > 0; break;
      }
      return result ? 0 : 1;
    }
    
    // Handle single argument (check if non-empty)
    if (expr.length === 1) {
      const val = expandVars(expr[0]);
      return val.length > 0 ? 0 : 1;
    }
    
    return 1;
  },
  cat: function(args) {
    if (args.includes('--help')) {
      console.log(help.cat);
      return 0;
    }
    // Simple cat builtin - concatenate and print files
    if (args.length < 2) {
      console.error('cat: missing file operand');
      return 1;
    }
    for (let i = 1; i < args.length; i++) {
      try {
        const content = fs.readFileSync(args[i], 'utf8');
        process.stdout.write(content);
      } catch (e) {
        console.error(`cat: ${args[i]}: ${e.message}`);
        return 1;
      }
    }
    return 0;
  },
  test: function(args) {
    if (args.includes('--help')) {
      console.log(help.test);
      return 0;
    }
    // test is the same as [, but doesn't require ]
    return builtins['['](args.concat(']'));
  },
  declare: function(args) {
    // declare -a ARRAYNAME to create an array, or declare -a ARRAYNAME=(val1 val2 ...)
    if (args.includes('--help')) {
      console.log('declare [-a] NAME[=VALUE]\nDeclare or display shell variables and arrays.\nExample: declare -a myarr=(one two three)');
      return 0;
    }
    
    let i = 1;
    let isArray = false;
    
    // Parse options
    while (i < args.length && args[i].startsWith('-')) {
      if (args[i] === '-a') isArray = true;
      i++;
    }
    
    if (i >= args.length) {
      // Display all variables/arrays
      console.log('Variables:');
      for (const [key, val] of Object.entries(SHELL.env)) {
        console.log(`  ${key}=${val}`);
      }
      console.log('Arrays:');
      for (const [key, arr] of Object.entries(SHELL_ARRAYS)) {
        console.log(`  ${key}=(${arr.join(' ')})`);
      }
      return 0;
    }
    
    // Parse declaration: name or name=(values)
    const decl = args[i];
    const assignMatch = decl.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=\((.*)\)$/);
    
    if (assignMatch) {
      const arrName = assignMatch[1];
      const values = assignMatch[2].trim().split(/\s+/).filter(v => v);
      SHELL_ARRAYS[arrName] = values;
    } else if (decl.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      // Just create empty array
      if (isArray) {
        SHELL_ARRAYS[decl] = [];
      }
    }
    
    return 0;
  },
  trap: function(args) {
    // trap COMMAND SIGNAL or trap -l to list signals
    if (args.includes('--help')) {
      console.log('trap [COMMAND] [SIGNAL ...]\nSet up traps for signals. Example: trap "cleanup" EXIT');
      return 0;
    }
    
    if (args[1] === '-l') {
      console.log('Supported signals: EXIT INT TERM HUP QUIT');
      return 0;
    }
    
    if (args.length < 3) {
      // Display current traps
      for (const [sig, cmd] of Object.entries(SHELL_TRAPS)) {
        console.log(`trap -- '${cmd}' ${sig}`);
      }
      return 0;
    }
    
    const command = args[1];
    for (let i = 2; i < args.length; i++) {
      SHELL_TRAPS[args[i]] = command;
    }
    
    return 0;
  },
  ':': function(args) {
    // The no-op utility: used as a loop body, e.g. `for ((i=0;i<n;i++)); do :; done`.
    return 0;
  },
  'return': function(args) {
    if (args.includes('--help')) {
      console.log('return [N]\nExit from a function with status N (or the last status).');
      return 0;
    }
    let code = SHELL.lastExitCode;
    if (args.length > 1) {
      const n = Number(args[1]);
      code = isFinite(n) ? ((n % 256) + 256) % 256 : 0;
    }
    // Unwind to callFunction(); if there is no active frame this is caught by
    // the top level and simply ends the current line.
    throw newReturnSignal(code);
  },
  'break': function(args) {
    throw newBreakSignal();
  },
  'continue': function(args) {
    throw newContinueSignal();
  },
  'local': function(args) {
    // Simple local variable support (scoped to function calls)
    // For now, just set variables - proper scoping would require a scope stack
    if (args.includes('--help')) {
      console.log('local VAR=VALUE\nDeclare local variables (scope limited to current function).');
      return 0;
    }
    
    for (let i = 1; i < args.length; i++) {
      const assignMatch = args[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)$/);
      if (assignMatch) {
        SHELL.env[assignMatch[1]] = expandVars(assignMatch[2]);
      }
    }
    
    return 0;
  },
  dadjoke: async function(args) {
    // Easter egg: fetch a random dad joke from icanhazdadjoke.com
    try {
      const response = await fetch('https://icanhazdadjoke.com/', {
        headers: { 'Accept': 'text/plain' }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const joke = await response.text();
      writeOutput(joke.trim());
      return 0;
    } catch (e) {
      console.error(`dadjoke: ${e.message}`);
      return 1;
    }
  },
  true: function(args) {
    return 0;
  },
  false: function(args) {
    return 1;
  }
  };
} catch(e) {
  console.error('Failed to initialize builtins:', e);
}

// Debug logging (optional)
let logPath = null;
if (process.env.FGSH_LOG) {
  const logLocations = ['/tmp/fgshell-debug.log', '/var/tmp/fgshell-debug.log', (process.env.HOME || '/tmp') + '/fgshell-debug.log'];
  for (const loc of logLocations) {
    try {
      fs.appendFileSync(loc, '[SHELL START] ' + new Date().toISOString() + ' user=' + (process.env.USER || 'unknown') + ' PATH=' + (process.env.PATH || 'UNSET') + '\n');
      logPath = loc;
      break;
    } catch (e) {
      // Try next location
    }
  }
}

let currentReadlineInput = ''; // Track current readline input
let isLoadingRcFile = false; // Track if we're loading RC file
let isFilePickerActive = false; // Track if file picker is active
let commandStartTime = 0; // Track when command started for duration calculation
let commandCache = null; // Cached command list for completer
let commandCacheKeys = null;

// Shell process group control (for job control with Ctrl+Z)
 let shellPgid = process.pid;
// `fgsh --version` / `--help` are pure queries: they spawn no children and
// must never take the terminal away from whoever launched us. neofetch (and
// anything else that shells out to `$SHELL --version`) runs us from a
// background process group, so the tcsetpgrp below raised SIGTTOU while its
// disposition was still SIG_DFL, which stops this process forever - the
// caller then hangs waiting on a version string we already printed.
const isInfoInvocation = ['--version', '-v', '--help', '-h'].includes(process.argv[2]);
if (ptctl.available && !isInfoInvocation) {
  // Ignore SIGTTOU *before* the first terminal handoff: with a default or
  // caught disposition, tcsetpgrp() from a background process group stops
  // the shell (or fails), so the shell would never reach its own startup.
  try {
    ptctl.ignore_job_signals();
  } catch (e) {
    debug('Failed to ignore job-control signals:', e.message);
  }
  try {
    // Make shell its own process group leader (pgid = 0 means use own PID)
    ptctl.setpgid(0, 0);
    shellPgid = ptctl.getpgrp();
    if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Shell PGID: ${shellPgid}`);
  } catch (e) {
    debug('Failed to set shell process group:', e.message);
    shellPgid = process.pid;
  }
  
  try {
    ptctl.tcsetpgrp(0, shellPgid);
    ptctl.enable_signals(0);
    if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Claimed terminal for shell PGID ${shellPgid}`);
  } catch (e) {
    debug('Failed to claim terminal:', e.message);
  }
}

// Check if we're running as a login shell (stdin/stdout are TTY)
const isLoginShell = process.stdin.isTTY && process.stdout.isTTY;

const { LineEditor } = require('./line-editor');

const rl = new LineEditor({
  input: process.stdin,
  output: process.stdout,
  prompt: '',
});

// Flyline-style ghost text: best completion for current input, shown inline
// after the cursor and accepted with Tab. Only prefix matches — the fuzzy
// completer's substring hits (filenames, unrelated commands) are wrong here.

// ---- path helpers for inline prediction (handles ~ and subdirectories) ----

/** Expand a leading ~ to the user's home directory. */
function expandTilde(p) {
  const home = SHELL.env.HOME || os.homedir();
  if (p === '~') return home;
  if (p.startsWith('~/')) return home + p.slice(1);
  return p; // ~user needs a passwd lookup; leave it alone
}

/** Split a typed token like "~/src/ma" into its typed dir part and base. */
function splitTokenPath(word) {
  if (word === '~') return { dirPart: '~/', base: '' };
  const i = word.lastIndexOf('/');
  if (i < 0) return { dirPart: '', base: word };
  return { dirPart: word.slice(0, i + 1), base: word.slice(i + 1) };
}

/** Resolve the directory part of a token against the shell's cwd. */
function resolveCompletionDir(dirPart) {
  if (!dirPart) return SHELL.cwd;
  return path.resolve(SHELL.cwd, expandTilde(dirPart));
}

/**
 * Candidates for completing the current path token — the "next part of the
 * command". Returns { display, isDir, mtime } where display is what the
 * token should become (directories keep their trailing '/'). Directories
 * sort first, then files, both alphabetically: "cat ~/" lists the home dir.
 * Pass withMtime to stat each entry (only when the mtime column is on).
 */
function pathCandidates(word, withMtime = false) {
  const { dirPart, base } = splitTokenPath(word);
  const dir = resolveCompletionDir(dirPart);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const dirs = [];
  const files = [];
  for (const ent of entries) {
    const name = ent.name != null ? ent.name : String(ent);
    if (base && !name.startsWith(base)) continue;
    let isDir = typeof ent.isDirectory === 'function' ? ent.isDirectory() : false;
    let mtime = 0;
    // Stat only when we need the age, or to resolve a symlink's target
    if (withMtime || (!isDir && typeof ent.isSymbolicLink === 'function' && ent.isSymbolicLink())) {
      try {
        const st = fs.statSync(path.join(dir, name));
        if (!isDir) isDir = st.isDirectory();
        if (withMtime) mtime = st.mtimeMs;
      } catch (e) {}
    }
    (isDir ? dirs : files).push({ name, mtime });
  }
  const cmp = (a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
    a.name.localeCompare(b.name);
  dirs.sort(cmp);
  files.sort(cmp);
  const out = [];
  for (const d of dirs) out.push({ display: dirPart + d.name + '/', isDir: true, mtime: d.mtime });
  for (const f of files) out.push({ display: dirPart + f.name, isDir: false, mtime: f.mtime });
  return out;
}

/**
 * Optional mtime column in the prediction menu, configured in ~/.fgshrc:
 *   export FGSH_MENU_MTIME=1
 * Read from SHELL.env on every keystroke so the rc file (which runs through
 * runLine) and plain environment inheritance both work.
 */
function menuShowMtime() {
  const v = SHELL.env.FGSH_MENU_MTIME;
  return typeof v === 'string' && /^(1|true|yes|on)$/i.test(v);
}

/** Flyline-style relative age: now, 5min, 12hou, 3Day, 1Mon, 2Yea. */
function relTime(ms) {
  if (!ms) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}min`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}hou`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}Day`;
  const mo = d / 30;
  if (mo < 12) return `${Math.floor(mo)}Mon`;
  return `${Math.floor(mo / 12)}Yea`;
}

rl.setGhostProvider((line) => {
  if (!line || /\s/.test(line)) {
    // Mid-line: fall back to path completion for the current word
    if (line) {
      try {
        const word = line.slice(line.lastIndexOf(' ') + 1);
        if (word) {
          const hit = pathCandidates(word)[0];
          if (hit) return line.slice(0, line.length - word.length) + hit.display;
        }
      } catch (e) {}
    }
    return '';
  }
  let best = '';
  // Longest history entry that extends what was typed
  for (const h of rl.history) {
    if (h.length > line.length && h.startsWith(line) && h.length > best.length) best = h;
  }
  if (best) return best;
  // Longest command name that extends what was typed
  try {
    for (const name of getCommandList().keys) {
      if (name.length > line.length && name.startsWith(line) && name.length > best.length) best = name;
    }
  } catch (e) {}
  return best;
});

// Fuzzy completion menu: the list of matches shown below the prompt as you
// type. Up/Down move the selection, Tab accepts it, and Enter runs the line
// as typed — unless Up/Down picked an entry (or the menu has a single
// candidate), in which case Enter accepts it. Escape dismisses.
// At the start of a command (no space), shows prefix matches from history/commands.
// After a command with space (e.g., "cat ~/"), shows files for the current
// path token (tilde-expanded, so "~/" lists the home directory).
// When the argument starts with "--", shows matching long options for the command.
rl.setMenuProvider((line) => {
  if (!line) return [];
  
  // If line has no space, show prefix matches for commands/history
  if (!/\s/.test(line)) {
    try {
      const seen = new Set();
      const out = [];
      const add = (s) => {
        if (typeof s === 'string' && s && !seen.has(s)) {
          const right = commandFullPath(s.trim().split(/\s+/)[0]);
          // Skip an exact echo of what's typed unless the row carries the
          // command's full path — that's the whole point of showing it
          if (s === line && !right) return;
          seen.add(s);
          // Right column: the command's full path (for a history row, the
          // path of the command that row runs)
          out.push({ text: s, right });
        }
      };
      // History entries that extend what was typed
      for (const h of rl.history) {
        if (h.startsWith(line)) add(h);
      }
      // Command names that extend what was typed
      for (const name of getCommandList().keys) {
        if (name.startsWith(line)) add(name);
      }
      return out;
    } catch (e) {
      return [];
    }
  }
  
  // Line has spaces - show files for the last token, or options if "--"
  const parts = line.split(/\s+/);
  const lastToken = parts[parts.length - 1] || '';
  const cmd = parts[0];
  
  // If last token starts with "--", show matching long options
  if (lastToken.startsWith('--')) {
    const options = getCommandOptions(cmd);
    if (options.length > 0) {
      return options.filter(o => o.startsWith(lastToken));
    }
    return [];
  }
  
  try {
    // Path-aware file completion: "~/", "./", "/usr/" and plain names all
    // work, so typing "cat ~/" lists the home directory to pick from.
    // With FGSH_MENU_MTIME set (see ~/.fgshrc), every row also carries a
    // right-aligned relative mtime — display-only, never inserted on accept.
    const withMtime = menuShowMtime();
    return pathCandidates(lastToken, withMtime).map(c =>
      withMtime ? { text: c.display, right: relTime(c.mtime) } : c.display
    ).slice(0, 50);
  } catch (e) {
    return [];
  }
});

// Tab falls back to the fuzzy completer when there's no inline ghost.
rl.setTabHandler((line) => {
  try {
    const [suggestions] = completer(line);
    if (suggestions && suggestions.length === 1) return suggestions[0];
    return null;
  } catch (e) {
    return null;
  }
});

function isPickerNavKey(key) {
  if (!key) return false;
  return (
    key.name === 'up' ||
    key.name === 'down' ||
    key.name === 'left' ||
    key.name === 'right' ||
    key.name === 'return' ||
    key.name === 'escape'
  );
}

function getCommandOptions(cmd) {
  // Define common long options for various commands
  const options = {
    'cat': ['--help', '--version', '-n', '-s', '-E', '-T', '-A', '-b', '-e', '-v'],
    'ls': ['--help', '--version', '-a', '-A', '-l', '-h', '-S', '-t', '-u', '-c', '-r', '-F', '-G', '-R', '-d', '-i', '-l'],
    'cd': ['-L', '-P', '-e', '-'],
    'pwd': ['-L', '-P'],
    'mkdir': ['--help', '--version', '-m', '-p', '-v', '--mode', '--parents', '--verbose'],
    'rm': ['--help', '--version', '-f', '-i', '-r', '-R', '-d', '-v', '-I', '--no-preserve-root', '--preserve-root'],
    'cp': ['--help', '--version', '-a', '-R', '-L', '-P', '-H', '-i', '-f', '-n', '-v', '--backup', '--dereference', '--no-dereference', '--preserve-mode', '--preserve-links', '--symmetric', '--timestamp', '--update', '--strip-trailing-slashes'],
    'mv': ['--help', '--version', '-f', '-i', '-n', '-v', '--backup', '--dereference-chars', '--no-dereference', '--strip-trailing-slashes', '--update'],
    'grep': ['--help', '--version', '-i', '-v', '-c', '-l', '-n', '-H', '-h', '-U', '-a', '-I', '-o', '-a', '--color', '--context', '--exclude', '--exclude-dir', '--filename', '--files-with-matches', '--files-without-match', '--help', '--ignore-case', '--include', '--invert-match', '--max-count', '--mmap', '--null', '--only-matching', '--line-buffered', '--binary-files', '--devices', '--directories', '--dereference-action', '--dereference-command-line', '--directories', '--exclude', '--exclude-dir', '--exclude-from', '--extended-regexp', '--fixed-strings', '--follow-dir', '--fully-terminal', '--functions', '--grep', '--header', '--help', '--ignore-dir', '--ignore-case', '--include', '--init', '--initial', '--invert-match', '--line-buffered', '--line-number', '--lines', '--match', '--mmap', '--null', '--null-data-separator', '--only-matching', '--version', '--word-regexp', '--word-boundary'],
    'find': ['-name', '-path', '-regex', '-type', '-size', '-perm', '-empty', '-nouser', '-nogroup', '-newer', '-inum', '-sgroup', '-suser', '-newer', '-nover', '-newermt', '-exec', '-execdir', '-delete', '-quit', '-print', '-print0', '-printf', '-fprintf', '-pglob', '-P', '-L', '-H', '-a', '-o', '-prune', '-s', '-x', '-depth', '-d', '-maxdepth', '-mindepth', '-mount', '-xdev', '-follow', '-ignore_readdir_race', '-help', '-version'],
    'tar': ['-c', '-r', '-x', '-u', '-d', '-t', '--create', '--append', '--extract', '--list', '--update', '--catenate', '--delete', '--compare', '--diff', '--block-number', '--checkpoint', '--checkpoint-action', '--consecutive', '--directory', '--exclude', '--exclude-from', '--exclude-dir', '--force-local', '--ignore-failed-read', '--ignore-global-zeros', '--no-auto-compress', '--no-append', '--no-checkpoint', '--no-ignore-failed-read', '--no-mtime', '--no-overwrite-dir', '--no-same-owner', '--no-same-permissions', '--no-recursion', '--no-selinux', '--no-xattrs', '--file', '--force-local', '--directory', '--exclude', '--exclude-vcs', '--exclude-from', '--exclude-dir', '--gzip', '--bzip2', '--xz', '--zstd', '--auto-compress', '--no-auto-compress', '--verbose', '--totals', '--totals-silent', '--blocking-factor', '--checkpoint', '--checkpoint-action', '--checkpoint-directory', '--check-device', '--no-checking-device', '--no-same-owner', '--no-same-permissions', '--no-overwrite-destination', '--one-file-system', '--no-overwrite-destination', '--numeric-owner', '--no-same-owner', '--no-same-permissions', '--owner', '--group', '--numeric-owner', '--no-selinux', '--no-xattrs', '--xattrs', '--selinux', '--acls', '--attributes'],
    'chmod': ['-v', '-c', '-R', '-f', '-r', '-w', '-x', '-X', '--file', '--directory', '--help', '--version', '--change', '--reference', '--recursive', '--silent', '--verbose', '--no-preserve-root', '--preserve-root'],
    'chown': ['-v', '-c', '-R', '-h', '-L', '-i', '-f', '-r', '-D', '--file', '--directory', '--help', '--version', '--change', '--dereference', '--no-dereference', '--preserve-root', '--reference', '--chown', '--chgrp', '--from'],
    'chgrp': ['-v', '-c', '-R', '-h', '-L', '-i', '-f', '-r', '-D', '--file', '--directory', '--help', '--version', '--change', '--dereference', '--no-dereference', '--preserve-root', '--reference', '--from'],
    'touch': ['-a', '-c', '-d', '-r', '-t', '-m', '-h', '-A', '-B', '-d', '-t', '-c', '-f', '-h', '--date', '--date-time', '--no-date', '--no-dereference', '--no-time', '--time', '--reference', '--version', '--help'],
    'echo': ['-n', '-e', '-E', '--help', '--version'],
    'pwd': ['-L', '-P', '--help', '--version'],
    'printf': ['-v', '-d', '-i', '-n', '--help', '--version'],
    'test': ['-d', '-e', '-f', '-L', '-h', '-S', '-O', '-G', '-w', '-r', '-s', '-g', '-u', '-k', '-x', '-z', '-n', '-t', '-l', '-a', '-o', '--help', '--version', '--'],
    'yes': ['-y', '--help', '--version', '--'],
    'time': ['-f', '--format', '-o', '--output', '-a', '--append', '--help', '--version'],
    'sleep': ['-n', '--help', '--version'],
    'date': ['-u', '--utc', '--universal', '--help', '--version', '-r', '--reference', '-d', '--date', '-f', '--format', '-I', '--iso-8601', '-R', '--rfc-2822', '--rfc-3339', '-s', '--set', '-u', '--utc', '--universal', '-v', '--verbose', '--date', '--debug', '--iso-8601'],
    'cal': ['-m', '--month', '-y', '--year', '-1', '-3', '-4', '--help', '--version', '-w', '--week', '-h', '--header', '-j', '--julian-day', '--suppress-empty-line', '-C', '--columns', '-L', '--list'],
    'df': ['-a', '--all', '-B', '--block-size', '-b', '--bytes', '-h', '--human-readable', '-H', '--si', '-i', '--inodes', '-k', '--kilobytes', '-l', '--local', '-m', '--megabytes', '-T', '--print-type', '-t', '--type', '--help', '--version'],
    'du': ['-a', '--all', '-h', '--human-readable', '-H', '--hours', '-i', '--inodes', '-k', '--kilobytes', '-l', '--max-depth', '-m', '--megabytes', '-p', '--parent', '-s', '--summarize', '-t', '--time', '-u', '--ctime', '--apparent-size', '-x', '--one-file-system', '--help', '--version'],
    'head': ['-n', '--lines', '-c', '--bytes', '-f', '--follow', '-q', '--quiet', '-v', '--verbose', '--help', '--version'],
    'tail': ['-n', '--lines', '-c', '--bytes', '-f', '--follow', '-q', '--quiet', '-v', '--verbose', '--help', '--version'],
    'wc': ['-l', '--lines', '-w', '--words', '-c', '--bytes', '-m', '--multibyte', '-M', '--mime', '--help', '--version'],
    'sort': ['-n', '--numeric', '-h', '--human-numeric-sort', '-r', '--reverse', '-u', '--unique', '-f', '--ignore-case', '-d', '--dictionary-order', '-b', '--ignore-leading-blanks', '-k', '--key', '-m', '--merge', '-S', '--buffer-size', '-T', '--temporary-directory', '--compress-program', '--check', '--version', '--help'],
    'uniq': ['-c', '--count', '-d', '--repeated', '-D', '--all-repeated', '-u', '--unique', '--help', '--version'],
    'cut': ['-d', '--delimeter', '-f', '--fields', '-c', '--bytes', '-n', '--number', '-s', '--sentence-search', '--complement', '--help', '--version'],
    'tr': ['-d', '-s', '-t', '--delete', '--squeeze-repeats', '--translate', '--help', '--version'],
    'ln': ['-s', '--symbolic', '-f', '--force', '-n', '--no-dereference', '-v', '--verbose', '-t', '--target-directory', '-T', '--no-target-directory', '-r', '--relative', '--help', '--version'],
    'md5sum': ['-c', '--check', '-t', '--text', '-b', '--binary', '--help', '--version'],
    'sha256sum': ['-c', '--check', '-t', '--text', '-b', '--binary', '--help', '--version'],
    'basename': ['-a', '--multiple', '-m', '--massage', '-s', '--suffix', '--help', '--version'],
    'dirname': ['--help', '--version'],
    'env': ['-i', '--ignore-environment', '-0', '--null', '-u', '--unset', 'VAR=value', '-P', '--path', '-C', '--chdir', '--help', '--version'],
    'printenv': ['-P', '--partition', '--help', '--version', '-0', '--null'],
    'export': ['-n', '--nodetermination', '--help', '--version', '-f', '--functions'],
    'readonly': ['-a', '--array', '--help', '--version'],
    'shift': ['-n', '--number', '--help', '--version'],
    'set': ['-a', '--auto', '-b', '--braceexpand', '-e', '--errexit', '-E', '--errexit', '-f', '--noglob', '-h', '--hash', '-i', '--interactiveshell', '-k', '--command', '-m', '--monitor', '-n', '--nounset', '-o', '--oceanize', '-p', '--pipefail', '-r', '--restricted', '-s', '--source', '-u', '--errexit', '-v', '--verbose', '-x', '--errexit', '--help', '--version'],
    'unset': ['-f', '--function', '-v', '--variable', '--help', '--version'],
    'source': ['--help', '--version'],
    'exec': ['-l', '--login', '-c', '--command', '-a', '--argv0', '--help', '--version'],
    'eval': ['--help', '--version'],
    'trap': ['-l', '--list', '--help', '--version', '-p', '--pattern'],
    'ul': ['-t', '--bold', '-d', '--dollars', '-i', '--indent', '-l', '--left', '-r', '--right', '-x', '--exponents', '--help', '--version'],
    'read': ['-a', '--array', '-d', '--delimiter', '-e', '--editable', '-E', '--errexit', '-i', '--init', '-n', '--numchars', '-p', '--prompt', '-r', '--raw', '-s', '--shell', '-t', '--timeout', '-u', '--unit', '-A', '--array', '--assign', '--help', '--version', '--'],
    'fc': ['-e', '--editor', '-g', '--global', '-s', '--short', '-l', '--list', '-n', '--line-number', '-D', '--start-old-date', '--start-date', '-J', '--jump-old-date', '--start', '-i', '--include', '-m', '--mode', '-h', '--history', '--help', '--version'],
    'jobs': ['-l', '--list', '-p', '--pids', '-r', '--running', '-s', '--stopped', '-a', '--all', '--pid', '--verbose', '--help', '--version', '--column'],
    'wait': ['-n', '--notify', '--help', '--version'],
    'bg': ['-a', '--all', '--pid', '--verbose', '--help', '--version'],
    'fg': ['-a', '--all', '-l', '--list', '-p', '--predicate', '-n', '--notify', '-v', '--verbose', '--help', '--version'],
    'disown': ['-a', '--all', '-h', '--help', '-k', '--kill', '-n', '--notify', '-r', '--running', '-f', '--foreground', '--help', '--version'],
    'kill': ['-s', '--signal', '-l', '--list', '-L', '--long', '-q', '--queue', '-n', '--number', '-i', '--inspect', '-I', '--include', '-r', '--reference', '-p', '--pid', '--pending', '-u', '--user', '--help', '--version', '-9', '-15', '-18', '-19', '-20', '-24'],
    'newgrp': ['-l', '--login', '-m', '--mail', '--help', '--version'],
    'type': ['-a', '--all', '-f', '--function', '-p', '--path', '-t', '--type', '--help', '--version'],
    'ulimit': ['-a', '--all', '-c', '--core', '-d', '--data', '-e', '--enter', '-f', '--files', '-i', '--inherit', '-l', '--locks', '-m', '--max', '-n', '--open-files', '-p', '--process', '-q', '--quiet', '-r', '--resident', '-s', '--stack', '-S', '--stack-size', '-t', '--time', '-u', '--unlimited', '-v', '--virtual', '-x', '--exit', '--help', '--version'],
    'getopts': ['-o', '--options', '-w', '--word', '--help', '--version'],
    'times': ['--help', '--version'],
    'shuf': ['-n', '--head-count', '-r', '--random-source', '-i', '--input-range', '--o', '--output', '-n', '--number', '--help', '--version'],
    'shred': ['-u', '--unlink', '--zero', '--suicide', '--remove', '-v', '--verbose', '--help', '--version'],
    'shuf': ['-n', '--head-count', '-r', '--random-source', '-i', '--input-range', '-o', '--output', '-n', '--number', '--help', '--version'],
  };
  
  return options[cmd] || [];
}

function debug(...args) {
  const msg = '[DEBUG] ' + args.join(' ');
  if (process.env.FGSH_DEBUG) {
    console.error(msg);
  }
  // Also log to file for fgshuser debugging
  if (logPath) {
    try {
      fs.appendFileSync(logPath, msg + '\n');
    } catch (e) {
      // Ignore log file errors
    }
  }
}

// Enhanced completer with Fuse.js fuzzy matching across history, builtins,
// PATH executables, and filenames. Node.js readline only fires completion on
// Tab press, so we maximize what that single interaction can do.
function getCommandList() {
  const now = Date.now();
  if (commandCache && commandCacheKeys && (now - commandCache.ts < 5000)) {
    return commandCache;
  }

  const names = new Set();
  const paths = new Map(); // command name -> full path (first PATH hit wins)
  if (builtins && typeof builtins === 'object') {
    for (const k of Object.keys(builtins)) names.add(k);
  }
  for (const k of Object.keys(SHELL.aliases || {})) names.add(k);
  const PATH = (SHELL.env.PATH || process.env.PATH || '/usr/bin:/bin').split(':');
  for (const p of PATH) {
    try {
      if (!fs.existsSync(p)) continue;
      for (const entry of fs.readdirSync(p)) {
        if (entry.startsWith('.')) continue;
        try {
          if (fs.statSync(path.join(p, entry)).isFile()) {
            names.add(entry);
            if (!paths.has(entry)) paths.set(entry, path.join(p, entry));
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  commandCacheKeys = Array.from(names);
  commandCache = { keys: commandCacheKeys, paths, ts: now };
  return commandCache;
}

/**
 * Full path of a command for the menu's right column, like Flyline shows:
 * a PATH lookup (first hit wins), or the absolute path when the token
 * already contains a slash. '' when nothing resolves (shell-only builtins,
 * aliases, unknown names).
 */
function commandFullPath(name) {
  if (!name) return '';
  if (name.includes('/')) {
    try {
      const abs = path.resolve(SHELL.cwd, name);
      if (fs.statSync(abs).isFile()) return abs;
    } catch (e) {}
    return '';
  }
  try {
    return getCommandList().paths.get(name) || '';
  } catch (e) {
    return '';
  }
}

function fuzzyMatchFuse(items, query, keys, threshold = 0.4, limit = 50) {
  if (!items || items.length === 0) return [];
  const Fuse = require('fuse.js');
  const fuse = new Fuse(items, {
    keys: keys,
    threshold: threshold,
    ignoreFieldNorm: false,
    useExtendedScoring: true,
  });
  const results = fuse.search(query);
  return results.slice(0, limit).map(r => r.item);
}

function completer(line) {
  try {
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1] || '';
    const isStartOfToken = line === '' || /\s$/.test(line);

    if (isStartOfToken || last === '') {
      // Start of a new token: suggest commands + history + filenames.
      const query = last;
      const seen = new Set();
      const results = [];

      // 1. History fuzzy match (most valuable - what you've actually typed)
      try {
        const histEntries = historyDB.getAll(1000);
        if (histEntries && histEntries.length > 0) {
          const histItems = histEntries.map(e => e.command);
          const histMatches = fuzzyMatchFuse(histItems, query, ['command'], 0.45, 30);
          for (const m of histMatches) {
            if (!seen.has(m)) { seen.add(m); results.push(m); }
          }
        }
      } catch (e) {}

      // 2. Command fuzzy match (builtins + aliases + PATH executables)
      try {
        const cmdInfo = getCommandList();
        const cmdMatches = fuzzyMatchFuse(cmdInfo.keys, query, ['key'], 0.4, 30);
        for (const m of cmdMatches) {
          if (!seen.has(m)) { seen.add(m); results.push(m); }
        }
      } catch (e) {}

      // 3. Filename fuzzy match in cwd
      try {
        const list = fs.readdirSync(SHELL.cwd);
        const fileMatches = fuzzyMatchFuse(list, query, ['name'], 0.4, 30);
        for (const m of fileMatches) {
          if (!seen.has(m)) { seen.add(m); results.push(m); }
        }
      } catch (e) {}

      const unique = results.slice(0, 50);
      return [unique.length ? unique : [], last];
    }

    // Mid-token completion: filename completion with fuzzy matching
    const dir = path.dirname(last || '.');
    const base = path.basename(last || '');
    const resolvedDir = path.resolve(SHELL.cwd, dir === '.' ? '' : dir);

    let list = [];
    try {
      list = fs.readdirSync(resolvedDir);
    } catch (e) {
      return [[], last];
    }

    const hits = fuzzyMatchFuse(list, base, ['name'], 0.35, 100);
    const mapped = hits.map(f => (dir === '.' ? f : path.join(dir, f)));
    return [mapped.length ? mapped : list, last];
  } catch (e) {
    return [[], line];
  }
}

// ---------------------- Parsing ----------------------
function tokenize(input, preserveQuotes) {
  // returns array of tokens (not handling pipes/redir specially here)
  const tokens = [];
  let i = 0;
  const L = input.length;
  let cur = '';
  let state = 'normal'; // normal, single, double, esc
  while (i < L) {
    const ch = input[i];
    // Handle quote modes first (they disable escape processing)
    if (state === 'single') {
      if (ch === "'") {
        if (preserveQuotes) cur += ch;
        state = 'normal';
      }
      else cur += ch;
    } else if (state === 'double') {
      if (ch === '"') {
        if (preserveQuotes) cur += ch;
        state = 'normal';
      } else if (ch === '$') {
        // leave $ as is for expansion phase
        cur += ch;
      } else cur += ch;
    } else if (state === 'esc') {
      cur += ch;
      state = 'normal';
    } else if (ch === '\\') {
      // Escape character (only in normal or double-quote mode)
      state = 'esc';
    } else if (ch === "'") {
      if (preserveQuotes) cur += ch;
      state = 'single';
    } else if (ch === '"') {
      if (preserveQuotes) cur += ch;
      state = 'double';
    } else if (/\s/.test(ch)) {
      if (cur !== '') {
        tokens.push(cur);
        cur = '';
      }
    } else {
      // treat special single-char tokens as separate tokens where needed: | < > &
      if ('|&<>'.includes(ch)) {
        if (cur !== '') {
          tokens.push(cur);
          cur = '';
        }
        // handle >> as combined token
        if ((ch === '>' || ch === '<') && input[i+1] === '>') {
          tokens.push(ch + '>');
          i++;
        } else tokens.push(ch);
      } else cur += ch;
    }
    i++;
  }
  if (cur !== '') tokens.push(cur);
  return tokens;
}

function splitCommands(tokens) {
  // Convert tokens into a pipeline of command objects
  // each command: {args:[], stdin:null|file, stdout:null|file, stdoutAppend:false, background:false}
  const cmds = [];
  let cur = { args: [], stdin: null, stdout: null, stdoutAppend: false };
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '|') {
      cmds.push(cur);
      cur = { args: [], stdin: null, stdout: null, stdoutAppend: false };
    } else if (t === '>') {
      const file = tokens[++i];
      if (!file) throw new Error('No filename after >');
      cur.stdout = file;
      cur.stdoutAppend = false;
    } else if (t === '>>') {
      const file = tokens[++i];
      if (!file) throw new Error('No filename after >>');
      cur.stdout = file;
      cur.stdoutAppend = true;
    } else if (t === '<') {
      const file = tokens[++i];
      if (!file) throw new Error('No filename after <');
      cur.stdin = file;
    } else if (t === '&') {
      cur.background = true;
    } else {
      cur.args.push(t);
    }
    i++;
  }
  cmds.push(cur);
  // if last command had &, mark background
  if (cmds.length > 0) {
    const last = cmds[cmds.length - 1];
    if (last.background === undefined) last.background = false;
  }
  return cmds;
}

// expand $VAR in token (simple)
function expandVars(str) {
  // handle ~ expansion
  if (str === '~') {
    return SHELL.env.HOME || process.env.HOME || '/tmp';
  }
  if (str.startsWith('~/')) {
    return (SHELL.env.HOME || process.env.HOME || '/tmp') + str.slice(1);
  }
  
  // handle $((arithmetic)) expansion
  let arithMatch;
  while ((arithMatch = str.match(/\$\(\(/)) !== null) {
    if (process.env.FGSH_DEBUG) console.error('[DEBUG ARITH] match at', arithMatch.index);
    const start = arithMatch.index + 3;
    let depth = 0;
    let i = start;
    while (i < str.length) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        if (depth === 0 && i + 1 < str.length && str[i + 1] === ')') {
          const expr = str.slice(start, i);
          try {
            const expandedExpr = expr.replace(/([A-Za-z_]\w*)/g, (m) => (m in SHELL.env) ? SHELL.env[m] : '0');
            const result = Function('"use strict"; return (' + expandedExpr + ')')();
            str = str.slice(0, arithMatch.index) + result.toString() + str.slice(i + 2);
          } catch (e) {
            str = str.slice(0, arithMatch.index) + '0' + str.slice(i + 2);
          }
          break;
        }
        depth--;
      }
      i++;
    }
    if (i >= str.length) break;
  }
  
  // handle ${VAR} and $VAR, including array access ${ARR[i]}, ${ARR[@]}, etc.
  // A leading backslash escapes the dollar: "\$X" stays literally $X.
  return str.replace(/\\?\$(\?|\w+(?:\[[^\]]*\])?|\{([^}]+)\})/g, (match, a, b) => {
    if (match[0] === '\\') return match.slice(1);
    // $?, the exit status of the most recently executed command
    if (a === '?') {
      return String(typeof SHELL.lastExitCode === 'number' ? SHELL.lastExitCode : 0);
    }
    // If 'b' is set, we matched ${...}, so use b (which is the content inside braces)
    // If 'b' is not set, we matched $VAR, so use a
    const expr = b !== undefined ? b : a;
    
    // ${#arr[@]} / ${#arr[*]} - array length
    const lenMatch = expr.match(/^#(\w+)\[([@*])\]$/);
    if (lenMatch && lenMatch[1] in SHELL_ARRAYS) {
      return String(SHELL_ARRAYS[lenMatch[1]].length);
    }
    // ${#VAR} - string length
    if (expr.startsWith('#')) {
      const key = expr.slice(1);
      if (/^\w+$/.test(key)) {
        if (key in SHELL_ARRAYS) return String(SHELL_ARRAYS[key].length);
        const val = (key in SHELL.env) ? SHELL.env[key] : '';
        return String(String(val).length);
      }
    }
    
    // Check for array access: ARR[index], ARR[@], ARR[*], etc.
    const arrayMatch = expr.match(/^(\w+)\[([^\]]*)\]$/);
    if (arrayMatch) {
      const arrName = arrayMatch[1];
      const index = arrayMatch[2];
      
      if (arrName in SHELL_ARRAYS) {
        if (index === '@' || index === '*') {
          // Return all array elements
          return SHELL_ARRAYS[arrName].join(' ');
        }
        // Try to parse as number or expression
        const idx = parseInt(index);
        const arr = SHELL_ARRAYS[arrName];
        if (!isNaN(idx) && idx >= 0 && idx < arr.length) {
          return arr[idx];
        }
      }
      return '';
    }
    
    // Regular variable access
    const key = expr;
    return (key in SHELL.env) ? SHELL.env[key] : '';
  });
}

// expand $(command) - command substitution
async function expandCommandSubstitution(str) {
  const matches = [];
  const regex = /\$\(([^(][^)]*)\)/g;
  let match;
  let result = str;
  
  while ((match = regex.exec(str)) !== null) {
    matches.push({ full: match[0], cmd: match[1], index: match.index });
  }
  
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const output = await executeSubshellCommand(m.cmd);
    result = result.slice(0, m.index) + output.trim() + result.slice(m.index + m.full.length);
  }
  
  return result;
}

// Helper function to get an accessible CWD or fallback to a safe directory
function getAccessibleCwd() {
  try {
    fs.accessSync(SHELL.cwd, fs.constants.R_OK);
    return SHELL.cwd;
  } catch (e) {
    // Current directory is not accessible, try HOME
    if (SHELL.env.HOME) {
      try {
        fs.accessSync(SHELL.env.HOME, fs.constants.R_OK);
        return SHELL.env.HOME;
      } catch (e2) {
        // Fall back to /tmp
        return '/tmp';
      }
    }
    // Final fallback
    return '/tmp';
  }
}

async function executeSubshellCommand(cmdStr) {
  let tokens = tokenize(cmdStr);
  if (tokens.length === 0) {
    return '';
  }
  tokens = expandAliases(tokens);
  tokens = expandGlobs(tokens);
  const cmds = splitCommands(tokens);
  cmds.forEach(expandTokens);
  
  // For other builtins, we can't capture output
  if (cmds.length === 1 && isBuiltin(cmds[0].args[0])) {
    const name = cmds[0].args[0];
    builtins[name](cmds[0].args);
    return '';
  }
  
  // Execute the external command and capture output
  return new Promise((resolve) => {
    let output = '';
    const lastCmd = cmds[cmds.length - 1];
    const command = lastCmd.args[0];
    const args = lastCmd.args.slice(1);
    
    const exe = resolveExecutable(command);
    if (!exe) {
      resolve('');
      return;
    }
    
    const child = spawn(exe, args, {
      cwd: getAccessibleCwd(),
      env: SHELL.env,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('exit', () => {
      resolve(output);
    });
  });
}

function expandTokens(cmd) {
  cmd.args = cmd.args.map(a => expandVars(a));
  if (cmd.stdin) cmd.stdin = expandVars(cmd.stdin);
  if (cmd.stdout) cmd.stdout = expandVars(cmd.stdout);
}

// ---------------------- Job control helpers ----------------------
function addJob(pids, cmdline, background) {
  const job = { id: SHELL.nextJobId++, pids: Array.isArray(pids) ? pids : [pids], cmdline, status: 'running', background: !!background };
  SHELL.jobs.push(job);
  return job;
}
function removeJob(job) {
  SHELL.jobs = SHELL.jobs.filter(j => j !== job);
}
function findJobByPid(pid) {
  return SHELL.jobs.find(j => j.pids.includes(pid));
}
function markJobDone(job) {
  job.status = 'done';
  removeJob(job);
}

function waitForJob(job) {
  return new Promise((resolve) => {
    // wait until no pids left or status changed to done
    function check() {
      if (!SHELL.jobs.find(j => j.id === job.id)) {
        resolve(0);
      } else {
        setTimeout(check, 100);
      }
    }
    check();
  }).then(() => 0);
}

// ---------------------- History Expansion ----------------------
function resolveHistoryExpansion(input) {
  if (!input.includes('!')) return input;
  const lines = [];
  let i = 0;
  let state = null;
  let cur = '';
  while (i < input.length) {
    const ch = input[i];
    if (state === 'single') {
      cur += ch;
      if (ch === "'") state = null;
    } else if (state === 'double') {
      cur += ch;
      if (ch === '"') state = null;
    } else if (ch === "'") {
      cur += ch;
      state = 'single';
    } else if (ch === '"') {
      cur += ch;
      state = 'double';
    } else if (ch === '\\') {
      cur += ch;
      i++;
      if (i < input.length) cur += input[i];
    } else if (ch === '!') {
      const start = cur.length;
      i++;
      if (i < input.length && input[i] === '!') {
        const last = SHELL.history.length > 0 ? SHELL.history[SHELL.history.length - 1] : '';
        cur += last;
        i++;
      } else if (i < input.length && input[i] === '$') {
        const last = SHELL.history.length > 0 ? SHELL.history[SHELL.history.length - 1] : '';
        const parts = last.trim().split(/\s+/);
        const arg = parts.length > 1 ? parts[parts.length - 1] : last;
        cur += arg;
        i++;
      } else if (i < input.length && input[i] === '^') {
        const last = SHELL.history.length > 0 ? SHELL.history[SHELL.history.length - 1] : '';
        const parts = last.trim().split(/\s+/);
        const arg = parts.length > 1 ? parts[1] : last;
        cur += arg;
        i++;
      } else {
        let num = '';
        let neg = false;
        if (i < input.length && input[i] === '-') { neg = true; i++; }
        while (i < input.length && /[0-9]/.test(input[i])) {
          num += input[i];
          i++;
        }
        if (num) {
          const idx = neg ? SHELL.history.length - parseInt(num, 10) : parseInt(num, 10) - 1;
          cur += (SHELL.history[idx] || '');
        } else {
          let prefix = '';
          let contains = false;
          if (i < input.length && input[i] === '?') {
            contains = true;
            i++;
            while (i < input.length && input[i] !== '?') {
              prefix += input[i];
              i++;
            }
            if (i < input.length) i++;
          } else {
            while (i < input.length && /[A-Za-z0-9_\-]/.test(input[i])) {
              prefix += input[i];
              i++;
            }
          }
          const match = SHELL.history.slice().reverse().find(cmd => {
            if (contains) return cmd.includes(prefix);
            return cmd.startsWith(prefix);
          });
          cur += match || '';
        }
      }
    } else {
      cur += ch;
    }
    i++;
    if (ch === ';' && !state) {
      lines.push(cur);
      cur = '';
    }
  }
  if (cur) lines.push(cur);
  return lines.join(';');
}

// ---------------------- Execution ----------------------
async function runLine(line, context) {
  line = line.trim();
  if (!line) {
    return;
  }
  
  commandStartTime = Date.now();
  
  // Parse line for control flow structures and execute
  try {
    await executeControlFlow(line, context);
  } catch (e) {
    if (isSignal(e, 'return')) {
      SHELL.lastExitCode = typeof e.__fgshCode === 'number' ? e.__fgshCode : 0;
    } else if (isSignal(e, 'break') || isSignal(e, 'continue')) {
      console.error(`${e.__fgshSignal}: only meaningful in a loop`);
      SHELL.lastExitCode = 1;
    } else {
      console.error('Error:', e.message);
      SHELL.lastExitCode = 1;
    }
  }
  
  const isBuiltinCommand = !line.startsWith('history') && !line.startsWith('exit');
  // Record to history DB (but not commands from .fgshrc)
  if (isBuiltinCommand && !isLoadingRcFile) {
    const duration = Date.now() - commandStartTime;
    historyDB.addEntry(line, SHELL.lastExitCode, SHELL.cwd, duration);
  }
}

function splitTopLevel(str, sep) {
  // split on sep not in quotes
  const parts = [];
  let cur = '';
  let state = null;
  for (let i=0;i<str.length;i++) {
    const ch = str[i];
    if (ch === "'" && state !== 'double') { state = (state === 'single' ? null : 'single'); cur += ch; continue; }
    if (ch === '"' && state !== 'single') { state = (state === 'double' ? null : 'double'); cur += ch; continue; }
    if (ch === sep && !state) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur !== '') parts.push(cur);
  return parts;
}

function expandAliases(args) {
  if (args.length === 0) return args;
  const cmd = args[0];
  if (cmd in SHELL.aliases) {
    const aliasValue = SHELL.aliases[cmd];
    const aliasTokens = tokenize(aliasValue);
    return [...aliasTokens, ...args.slice(1)];
  }
  return args;
}

function expandGlobs(args) {
  const newArgs = [];
  for (const arg of args) {
    if (glob.hasMagic(arg)) {
      const files = glob.sync(arg, { cwd: SHELL.cwd });
      if (files.length > 0) {
        newArgs.push(...files);
      } else {
        newArgs.push(arg);
      }
    } else {
      newArgs.push(arg);
    }
  }
  return newArgs;
}

// ---------------------- SCRIPTING FEATURES ----------------------

// Function definitions storage
const SHELL_FUNCTIONS = {};

// Trap handlers
const SHELL_TRAPS = {};
let exitTrapsRun = false;
/** Run any `trap ... EXIT` handler exactly once. */
async function runExitTraps() {
  if (exitTrapsRun) return;
  const cmd = SHELL_TRAPS.EXIT;
  if (!cmd) return;
  exitTrapsRun = true;
  await executeControlFlow(cmd);
}

// Call stack for error reporting
const CALL_STACK = [];
function pushCallFrame(funcName, context) {
  CALL_STACK.push({
    type: 'function',
    name: funcName,
    context: context || {}
  });
}
function popCallFrame() {
  CALL_STACK.pop();
}
function formatCallStack() {
  if (CALL_STACK.length === 0) return '';
  let stack = '\nCall stack:\n';
  for (let i = CALL_STACK.length - 1; i >= 0; i--) {
    const frame = CALL_STACK[i];
    const ctx = frame.context;
    if (ctx && ctx.filename) {
      stack += `  at ${frame.name}() (${ctx.filename}:${ctx.startLine})\n`;
    } else {
      stack += `  at ${frame.name}()\n`;
    }
  }
  return stack;
}

// Execute control flow (handles if, while, for, &&, ||, case, etc.)
async function executeControlFlow(line, context) {
  // context: { startLine, endLine, filename, content }
  const trimmed = line.trim();
  if (!trimmed) return;
  
  // Loop control unwinds to the loop that owns it (break/continue inside an
  // if/case/function body still reaches the enclosing for/while).
  if (trimmed === 'break') throw newBreakSignal();
  if (trimmed === 'continue') throw newContinueSignal();
  
  // Subshell: ( ... ) - state is copied in and restored afterwards.
  if (trimmed.startsWith('(') && trimmed.endsWith(')') && parensBalanced(trimmed)) {
    await executeSubshell(trimmed.slice(1, -1), context);
    return;
  }
  
  // Control structures. Each returns any text that followed the construct
  // (e.g. the "; echo END" after a one-line `if ...; fi`), which runs next.
  const ctl = trimmed.match(/^(if|while|until|for|case)\b/i);
  if (ctl) {
    let rest = '';
    switch (ctl[1].toLowerCase()) {
      case 'if': rest = await executeIf(trimmed, context); break;
      case 'while':
      case 'until': rest = await executeWhile(trimmed, context); break;
      case 'for': rest = await executeFor(trimmed, context); break;
      case 'case': rest = await executeCase(trimmed, context); break;
    }
    if (rest && rest.trim()) await executeControlFlow(rest.trim(), context);
    return;
  }
  if (trimmed.startsWith('function ') || /^[a-zA-Z_][a-zA-Z0-9_-]*\s*\(\s*\)/.test(trimmed)) {
    const rest = await defineFunctionLine(trimmed, context);
    if (rest && rest.trim()) await executeControlFlow(rest.trim(), context);
    return;
  }
  
  // Handle && and || operators at top level
  const logicalChain = parseLogicalChain(line);
  if (logicalChain.length > 1) {
    for (let i = 0; i < logicalChain.length; i++) {
      const { command, operator } = logicalChain[i];
      // Recursively call executeControlFlow to handle nested control structures
      await executeControlFlow(command, context);
      
      if (operator === '&&' && SHELL.lastExitCode !== 0) {
        // Stop execution chain
        break;
      } else if (operator === '||' && SHELL.lastExitCode === 0) {
        // Stop execution chain
        break;
      }
    }
    return;
  }

  // Split on top-level ; and newlines only, so the ; inside
  // `if a; then b; fi` or `for x in y; do ...; done` never tears the
  // construct apart (which is what used to produce
  // "while: command not found" / "done: command not found").
  const sequences = splitStatements(line);
  if (sequences.length === 0) return;
  if (sequences.length === 1 && sequences[0] !== trimmed) {
    // Normalisation changed the text (e.g. a leading ";") - re-run on the
    // cleaned form rather than handing `; echo hi` to runSingle.
    await executeControlFlow(sequences[0], context);
    return;
  }
  if (sequences.length > 1) {
    for (const seq of sequences) {
      await executeControlFlow(seq, context);
    }
    return;
  }

  await runSingle(trimmed, context);
}

// Parse logical chain (&&, ||)
function parseLogicalChain(line) {
  const chain = [];
  let current = '';
  let i = 0;
  let state = null;
  
  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];
    
    if (ch === "'" && state !== 'double') {
      state = (state === 'single' ? null : 'single');
      current += ch;
      i++;
    } else if (ch === '"' && state !== 'single') {
      state = (state === 'double' ? null : 'double');
      current += ch;
      i++;
    } else if (!state && ch === '&' && next === '&') {
      if (current.trim()) {
        chain.push({ command: current.trim(), operator: '&&' });
      }
      current = '';
      i += 2;
    } else if (!state && ch === '|' && next === '|') {
      if (current.trim()) {
        chain.push({ command: current.trim(), operator: '||' });
      }
      current = '';
      i += 2;
    } else {
      current += ch;
      i++;
    }
  }
  
  if (current.trim()) {
    chain.push({ command: current.trim(), operator: null });
  }
  
  return chain;
}

// ---------------------- CONTROL-FLOW PARSING HELPERS ----------------------
// fgshell's control structures are parsed out of the raw line text, so they
// have to cope with both multi-line blocks and one-liners like
// `if a; then b; fi; echo next`. The helpers below scan the text while
// tracking nesting depth so that `;` and `done`/`fi` inside a nested block
// are never mistaken for the outer construct's delimiters.
const CTL_OPEN_WORDS = { if: 1, for: 1, while: 1, until: 1, case: 1 };
const CTL_CLOSE_WORDS = { fi: 1, done: 1, esac: 1 };

function isWordChar(ch) { return ch !== undefined && /[A-Za-z0-9_.]/.test(ch); }

/**
 * Find the first keyword in `keywords` that sits at nesting depth 0.
 * Returns { before, keyword, after } or { before, keyword: null, after: null }.
 */
function splitAtKeyword(text, keywords) {
  let depth = 0, state = null, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (state) { if (ch === state) state = null; i++; continue; }
    if (ch === "'" || ch === '"') { state = ch; i++; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < text.length && isWordChar(text[j])) j++;
      const word = text.slice(i, j).toLowerCase();
      if (depth === 0 && keywords[word]) {
        return { before: text.slice(0, i), keyword: word, after: text.slice(j) };
      }
      if (CTL_OPEN_WORDS[word]) depth++;
      else if (CTL_CLOSE_WORDS[word] && depth > 0) depth--;
      i = j; continue;
    }
    if (ch === '{' || ch === '(') { depth++; i++; continue; }
    if (ch === '}' || ch === ')') { if (depth > 0) depth--; i++; continue; }
    i++;
  }
  return { before: text, keyword: null, after: null };
}

/**
 * Split a line into statements on top-level `;` and newlines only.
 * `if a; then b; fi` stays whole; `n=0; while ...; done; echo $n` splits
 * into three statements.
 */
function splitStatements(text) {
  const out = [];
  let depth = 0, state = null, cur = '', i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (state) { cur += ch; if (ch === state) state = null; i++; continue; }
    if (ch === "'" || ch === '"') { state = ch; cur += ch; i++; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < text.length && isWordChar(text[j])) j++;
      const word = text.slice(i, j).toLowerCase();
      if (CTL_OPEN_WORDS[word]) depth++;
      else if (CTL_CLOSE_WORDS[word] && depth > 0) depth--;
      cur += text.slice(i, j); i = j; continue;
    }
    if (ch === '{' || ch === '(') { depth++; cur += ch; i++; continue; }
    if (ch === '}' || ch === ')') { if (depth > 0) depth--; cur += ch; i++; continue; }
    if ((ch === ';' || ch === '\n') && depth === 0) { out.push(cur); cur = ''; i++; continue; }
    cur += ch; i++;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(s => s !== '' && s !== '{' && s !== '}');
}

function parensBalanced(text) {
  let depth = 0, state = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state) { if (ch === state) state = null; continue; }
    if (ch === "'" || ch === '"') { state = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth < 0) return false; }
  }
  return depth === 0;
}

/** Evaluate an arithmetic expression using shell variables. Returns a number. */
function evalArithValue(expr) {
  try {
    const substituted = String(expr).replace(/([A-Za-z_]\w*)/g, (m) => {
      const v = SHELL.env[m];
      return (v === undefined || v === '') ? '0' : String(v);
    });
    const val = Function('"use strict"; return (' + substituted + ')')();
    return typeof val === 'number' && isFinite(val) ? val : 0;
  } catch (e) {
    return 0;
  }
}

/** Evaluate a C-style for-loop condition. Returns 0 (true) or 1 (false). */
function evalLoopCondition(expr) {
  try {
    const substituted = String(expr).replace(/([A-Za-z_]\w*)/g, (m) => {
      const v = SHELL.env[m];
      return (v === undefined || v === '') ? '0' : String(v);
    });
    return Function('"use strict"; return (' + substituted + ')')() ? 0 : 1;
  } catch (e) {
    return 1;
  }
}

/**
 * Apply a C-style for-loop init/increment statement: `i=0`, `i++`, `i--`,
 * `i+=2`, `i=i+1`. Returns false if the statement is not arithmetic.
 */
function applyArithStatement(stmt) {
  const s = String(stmt).trim().replace(/;$/, '');
  let m = s.match(/^([A-Za-z_]\w*)\s*(\+\+|--)$/);
  if (m) {
    const d = m[2] === '++' ? 1 : -1;
    SHELL.env[m[1]] = String((Number(SHELL.env[m[1]]) || 0) + d);
    return true;
  }
  m = s.match(/^([A-Za-z_]\w*)\s*(\+\+|--|\+=|-=|\*=|\/=|%=)\s*(.*)$/);
  if (m) {
    const cur = Number(SHELL.env[m[1]]) || 0;
    const rhs = evalArithValue(m[3] || '1');
    switch (m[2]) {
      case '++': SHELL.env[m[1]] = String(cur + 1); break;
      case '--': SHELL.env[m[1]] = String(cur - 1); break;
      case '+=': SHELL.env[m[1]] = String(cur + rhs); break;
      case '-=': SHELL.env[m[1]] = String(cur - rhs); break;
      case '*=': SHELL.env[m[1]] = String(cur * rhs); break;
      case '/=': SHELL.env[m[1]] = String(rhs === 0 ? cur : cur / rhs); break;
      case '%=': SHELL.env[m[1]] = String(rhs === 0 ? cur : cur % rhs); break;
    }
    return true;
  }
  m = s.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/);
  if (m && /[-+*/%()]/.test(m[2])) {
    // Arithmetic assignment such as `i=i+1`
    SHELL.env[m[1]] = String(evalArithValue(m[2]));
    return true;
  }
  return false;
}

/** Execute the statements that make up a loop/if body. */
async function runBody(body, context) {
  for (const stmt of splitStatements(body)) {
    await executeControlFlow(stmt, context);
  }
}

// Execute if statement. Returns any text that followed the construct.
async function executeIf(line, context) {
  const ifMatch = line.match(/^if\b\s*([\s\S]*?)\bthen\b([\s\S]*)/i);
  if (!ifMatch) {
    const errMsg = formatError('if: syntax error - expected "then"', context, true);
    console.error(errMsg || 'if: syntax error');
    SHELL.lastExitCode = 1;
    return '';
  }
  
  const condition = ifMatch[1].trim().replace(/;+$/, '').trim();
  const tail = ifMatch[2];
  
  // Split the tail at the first depth-0 else / elif / fi
  const split = splitAtKeyword(tail, { else: 1, elif: 1, fi: 1 });
  const thenBody = split.before;
  let elseBody = '';
  let leftover = '';
  
  if (split.keyword === 'else') {
    const fin = splitAtKeyword(split.after, { fi: 1 });
    elseBody = fin.before;
    leftover = fin.keyword ? fin.after : '';
  } else if (split.keyword === 'elif') {
    // An elif chain is just a nested if in the else branch.
    elseBody = 'if ' + split.after;
  } else if (split.keyword === 'fi') {
    leftover = split.after;
  }
  
  // Evaluate condition
  await runSingle(condition, context);
  
  if (SHELL.lastExitCode === 0) {
    await runBody(thenBody, context);
  } else if (elseBody.trim()) {
    await runBody(elseBody, context);
  }
  
  return leftover;
}


// Execute while loop
// ---------------------- CONTROL-FLOW SIGNALS ----------------------
// break/continue/return are implemented as exceptions so they can unwind out
// of nested if/case/function bodies to the loop (or call) that owns them.
function makeSignal(name) {
  const Ctor = function (code) {
    const e = new Error(name);
    e.__fgshSignal = name;
    e.__fgshCode = code;
    return e;
  };
  return Ctor;
}
const newBreakSignal = makeSignal('break');
const newContinueSignal = makeSignal('continue');
const newReturnSignal = makeSignal('return');
function isSignal(e, name) { return !!e && e.__fgshSignal === name; }

/**
 * Run a loop body, absorbing break/continue. Returns
 *   'break'    -> caller should stop looping
 *   'continue' -> caller should start the next iteration
 *   null       -> normal completion
 */
async function runLoopBody(body, context) {
  try {
    await runBody(body, context);
    return null;
  } catch (e) {
    if (isSignal(e, 'break')) return 'break';
    if (isSignal(e, 'continue')) return 'continue';
    throw e;
  }
}

async function executeWhile(line, context) {
  const until = /^until\b/i.test(line);
  const kw = until ? 'until' : 'while';
  const whileMatch = line.match(new RegExp('^' + kw + '\\b\\s*([\\s\\S]*?)\\bdo\\b([\\s\\S]*)', 'i'));
  if (!whileMatch) {
    const errMsg = formatError(kw + ': syntax error - expected "do"', context, true);
    console.error(errMsg || kw + ': syntax error');
    SHELL.lastExitCode = 1;
    return '';
  }
  
  const condition = whileMatch[1].trim().replace(/;+$/, '').trim();
  const split = splitAtKeyword(whileMatch[2], { done: 1 });
  
  let bodyStatus = 0;
  try {
    while (true) {
      await runSingle(condition, context);
      const condFailed = SHELL.lastExitCode !== 0;
      // while loops run while the condition succeeds; until loops run while it fails.
      if (until ? !condFailed : condFailed) break;
      const signal = await runLoopBody(split.before, context);
      bodyStatus = SHELL.lastExitCode;
      if (signal === 'break') break;
    }
  } catch (e) {
    if (!isSignal(e, 'break')) throw e;
  }
  SHELL.lastExitCode = bodyStatus;
  return split.keyword ? split.after : '';
}

// Execute for loop (for var in list or for ((init; cond; incr)))
async function executeFor(line, context) {
  // C-style for loop: for ((i=0; i<10; i++)); do ... done
  const cStyleMatch = line.match(/^for\s*\(\(\s*([\s\S]+?);\s*([\s\S]+?);\s*([\s\S]+?)\s*\)\)\s*;?\s*do\b([\s\S]*)/i);
  if (cStyleMatch) {
    const [, init, cond, incr, rest] = cStyleMatch;
    
    // Execute init (i=0, i++, ...). A plain `i=0` is not an arithmetic
    // expression, so fall back to normal statement execution for it.
    if (!applyArithStatement(init.trim())) {
      await runSingle(init.trim(), context);
    }
    
    const split = splitAtKeyword(rest, { done: 1 });
    
    let bodyStatus = 0;
    try {
      while (true) {
        if (evalLoopCondition(cond.trim()) !== 0) break;
        const signal = await runLoopBody(split.before, context);
        bodyStatus = SHELL.lastExitCode;
        if (signal === 'break') break;
        // Execute increment
        if (!applyArithStatement(incr.trim())) {
          await runSingle(incr.trim(), context);
        }
      }
    } catch (e) {
      if (!isSignal(e, 'break')) throw e;
    }
    SHELL.lastExitCode = bodyStatus;
    return split.keyword ? split.after : '';
  }
  
  // Traditional for-in loop: for var in list; do ... done
  const forMatch = line.match(/^for\b\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\b\s*([\s\S]*?)\s*;?\s*do\b([\s\S]*)/i);
  if (!forMatch) {
    const errMsg = formatError('for: syntax error - expected "in" and "do"', context, true);
    console.error(errMsg || 'for: syntax error');
    SHELL.lastExitCode = 1;
    return '';
  }
  
  const varName = forMatch[1];
  const rest = forMatch[3];
  
  // Expand list expression (can be array, glob, command substitution, or variable)
  let listExpr = forMatch[2].trim();
  listExpr = await expandCommandSubstitution(listExpr);
  
  let items = [];
  
  // If it looks like an array variable
  if (listExpr.startsWith('$')) {
    const varVal = expandVars(listExpr);
    items = varVal.split(/\s+/).filter(s => s !== '');
  } else if (listExpr.includes('*') || listExpr.includes('?')) {
    // Glob expansion
    items = glob.sync(listExpr, { cwd: SHELL.cwd });
  } else {
    // Treat as space-separated list
    items = listExpr.trim().split(/\s+/).filter(s => s !== '');
  }
  
  const split = splitAtKeyword(rest, { done: 1 });
  
  let bodyStatus = 0;
  try {
    for (const item of items) {
      SHELL.env[varName] = item;
      const signal = await runLoopBody(split.before, context);
      bodyStatus = SHELL.lastExitCode;
      if (signal === 'break') break;
    }
  } catch (e) {
    if (!isSignal(e, 'break')) throw e;
  }
  
  SHELL.lastExitCode = items.length ? bodyStatus : 0;
  return split.keyword ? split.after : '';
}

// Execute case statement. Returns any text that followed `esac`.
async function executeCase(line, context) {
  const caseMatch = line.match(/^case\s+(.+?)\s+in\s*([\s\S]*?)esac\b([\s\S]*)/i);
  if (!caseMatch) {
    const errMsg = formatError('case: syntax error - expected "in" and "esac"', context, true);
    console.error(errMsg || 'case: syntax error');
    SHELL.lastExitCode = 1;
    return '';
  }
  const leftover = caseMatch[3] || '';
  
  // Evaluate the expression to remove quotes
  let exprStr = caseMatch[1].trim();
  if ((exprStr.startsWith('"') && exprStr.endsWith('"')) ||
      (exprStr.startsWith("'") && exprStr.endsWith("'"))) {
    exprStr = exprStr.slice(1, -1);
  }
  // Expand variables in the matched expression (case "$x" in ...)
  const expr = expandVars(exprStr);
  const cases = caseMatch[2];
  
  // Parse case patterns
  const patterns = [];
  // Must be -1, not '': '' >= 0 is true in JS, so the first body line used to
  // evaluate patterns[''].body and throw a TypeError.
  let current = -1;
  for (const line of cases.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed === ';;') {
      current = -1;
    } else if (trimmed.endsWith(')')) {
      // This is a pattern line
      const pattern = trimmed.slice(0, -1);
      patterns.push({ pattern, body: '' });
      current = patterns.length - 1;
    } else {
      // Inline form: "pattern) body ;;" - the pattern sits at the start of the
      // line rather than on a line of its own.
      const cut = trimmed.indexOf(')');
      const head = cut > 0 ? trimmed.slice(0, cut) : '';
      if (cut > 0 && head.length > 0 && !/\s/.test(head)) {
        const body = trimmed.slice(cut + 1).replace(/;;\s*$/, '').trim();
        patterns.push({ pattern: head, body: body ? body + '\n' : '' });
        // A trailing `;;` closes the arm, so a body line after it belongs to
        // the next pattern, not this one.
        current = /;;\s*$/.test(trimmed) ? -1 : patterns.length - 1;
      } else if (current >= 0) {
        patterns[current].body += line + '\n';
      }
    }
  }
  
  // Match and execute
  for (const p of patterns) {
    if (matchPattern(expr, p.pattern)) {
      await runBody(p.body, context);
      break;
    }
  }
  
  SHELL.lastExitCode = 0;
  return leftover;
}

// Pattern matching for case statements (supports *, ?, and |)
function matchPattern(str, pattern) {
  if (pattern === '*') return true;
  
  // Handle | for multiple patterns
  if (pattern.includes('|')) {
    return pattern.split('|').some(p => matchPattern(str, p.trim()));
  }
  
  // Simple glob matching
  const regex = new RegExp('^' + pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.') + '$');
  
  return regex.test(str);
}

// Define a function
async function defineFunctionLine(line, context) {
  // Parse function definition: function name { ... } or name() { ... }
  const funcMatch = line.match(/^(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_-]*)\s*\(\s*\)\s*{/);
  if (!funcMatch) {
    const errMsg = formatError('function: syntax error - expected "{ ... }"', context, true);
    console.error(errMsg || 'function: syntax error');
    SHELL.lastExitCode = 1;
    return '';
  }
  
  const funcName = funcMatch[1];
  
  // Find the closing brace, ignoring braces inside quotes and comments.
  let depth = 1;
  const bodyStart = line.indexOf('{') + 1;
  let bodyEnd = bodyStart;
  let state = null;
  for (let i = bodyStart; i < line.length; i++) {
    const ch = line[i];
    if (state) {
      if (ch === '\\' && state === '"') { i++; continue; }
      if (ch === state) state = null;
      continue;
    }
    if (ch === "'" || ch === '"') { state = ch; continue; }
    if (ch === '#' && (i === 0 || /[\s;]/.test(line[i - 1]))) {
      const nl = line.indexOf('\n', i);
      i = nl === -1 ? line.length : nl;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }
  
  if (depth !== 0) {
    // Never saw the closing `}` - report it instead of silently storing an
    // empty function whose body would never run.
    const errMsg = formatError(`function ${funcName}: syntax error - missing closing "}"`, context, true);
    console.error(errMsg || `function ${funcName}: syntax error - missing closing "}"`);
    SHELL.lastExitCode = 1;
    return '';
  }
  
  const body = line.slice(bodyStart, bodyEnd).trim();
  
  // Store function
  SHELL_FUNCTIONS[funcName] = {
    name: funcName,
    body: body,
    params: [] // Shell functions don't have typed params
  };
  
  SHELL.lastExitCode = 0;
  // Anything after the closing `}` (e.g. "; greet" on a one-liner) still runs.
  return line.slice(bodyEnd + 1);
}

// Call a function
async function callFunction(funcName, args, context) {
  if (!(funcName in SHELL_FUNCTIONS)) {
    return null; // Not a function
  }
  
  const func = SHELL_FUNCTIONS[funcName];
  
  // Push call frame for stack traces
  pushCallFrame(funcName, context);
  
  try {
    // Set up positional parameters ($1, $2, ...)
    const savedParams = {};
    for (let i = 1; i <= 9; i++) {
      savedParams[`${i}`] = SHELL.env[i];
    }
    
    // Set new parameters
    for (let i = 0; i < args.length; i++) {
      SHELL.env[`${i + 1}`] = args[i];
    }
    
    // Execute function body. `return` unwinds out of it via a signal.
    let code = 0;
    try {
      await executeControlFlow(func.body, context);
      code = SHELL.lastExitCode;
    } catch (e) {
      if (isSignal(e, 'return')) {
        code = typeof e.__fgshCode === 'number' ? e.__fgshCode : 0;
      } else {
        throw e;
      }
    }
    
    // Restore parameters
    for (let i = 1; i <= 9; i++) {
      if (savedParams[`${i}`] !== undefined) {
        SHELL.env[`${i}`] = savedParams[`${i}`];
      } else {
        delete SHELL.env[`${i}`];
      }
    }
    
    SHELL.lastExitCode = code;
    return SHELL.lastExitCode;
  } finally {
    popCallFrame();
  }
}

// Parse and execute here-documents
const HEREDOC_TMP_PREFIX = 'fgsh-herodc-';
let heredocCounter = 0;

async function parseHereDocument(lines, startIdx) {
  // Look for <<EOF or <<'EOF' or <<-EOF patterns
  const line = lines[startIdx];
  const heredocMatch = line.match(/<<\s*-?\s*([A-Za-z_][A-Za-z0-9_]*)/);
  
  if (!heredocMatch) {
    return null;
  }
  
  const delimiter = heredocMatch[1];
  let content = '';
  let i = startIdx + 1;
  
  // Collect lines until we hit the delimiter
  while (i < lines.length) {
    const currentLine = lines[i];
    if (currentLine.trim() === delimiter) {
      // Create a temp file with the heredoc content
      const tmpFile = path.join(os.tmpdir(), HEREDOC_TMP_PREFIX + (++heredocCounter) + '.txt');
      fs.writeFileSync(tmpFile, content, 'utf8');
      return {
        delimiter,
        content,
        endIdx: i,
        tmpFile
      };
    }
    content += currentLine + '\n';
    i++;
  }
  
  return null;
}

// Execute subshell command (handles ( ) syntax)
async function executeSubshell(cmd, context) {
  // Subshells get a copy of the shell state; whatever they change is dropped
  // when they finish, so `(X=inner)` cannot clobber the parent's X.
  const savedEnv = { ...SHELL.env };
  const savedCwd = SHELL.cwd;
  const savedArrays = { ...SHELL_ARRAYS };
  
  try {
    await executeControlFlow(cmd, context);
  } finally {
    // Restore environment (subshell isolation)
    for (const k of Object.keys(SHELL.env)) {
      if (!(k in savedEnv)) delete SHELL.env[k];
    }
    Object.assign(SHELL.env, savedEnv);
    for (const k of Object.keys(SHELL_ARRAYS)) {
      if (!(k in savedArrays)) delete SHELL_ARRAYS[k];
    }
    Object.assign(SHELL_ARRAYS, savedArrays);
    if (SHELL.cwd !== savedCwd) {
      SHELL.cwd = savedCwd;
      try { process.chdir(savedCwd); } catch (e) { /* dir may be gone */ }
    }
  }
}

async function runSingle(line, context) {
  // context: { startLine, endLine, filename, content } - optional, used for error reporting
  
  // Expand history shortcuts before tokenization so sequences like "a; !!" 
  // see the history populated by earlier commands in the same line.
  line = resolveHistoryExpansion(line);
  
  const trimmedLine = line.trim();
  
  // Track in history for history expansion (skip history/exit)
  const isBuiltinCommand = !trimmedLine.startsWith('history') && !trimmedLine.startsWith('exit');
  if (isBuiltinCommand && trimmedLine) {
    if (rl && rl.history) {
      rl.history.push(trimmedLine);
    }
    SHELL.history.push(trimmedLine);
  }
  
  try {
    // Check for array assignment (arr=(values)), with or without `declare -a`
    const arrayMatch = line.match(/^(?:declare\s+(?:-[aA]\s+)?|)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\((.*)\)$/);
    if (arrayMatch) {
      const arrName = arrayMatch[1];
      const valuesStr = arrayMatch[2].trim();
      const values = valuesStr ? valuesStr.split(/\s+/) : [];
      SHELL_ARRAYS[arrName] = values;
      SHELL.lastExitCode = 0;
      return;
    }
    
    // Check for variable assignment (VAR=value)
    const assignMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (assignMatch) {
      const varName = assignMatch[1];
      let value = assignMatch[2];
      // Expand variables in the value
      value = expandVars(value);
      SHELL.env[varName] = value;
      SHELL.lastExitCode = 0;
      return;
    }
    
    // First expand command substitutions
    line = await expandCommandSubstitution(line);
    
    // Expand variables before tokenization so $((...)) stays together
    line = expandVars(line);
    
    let tokens = tokenize(line);
    if (tokens.length === 0) return;
    
    // Check if first token is a user-defined function
    if (tokens[0] in SHELL_FUNCTIONS) {
      const funcName = tokens[0];
      const funcArgs = tokens.slice(1);
      const code = await callFunction(funcName, funcArgs, context);
      if (code !== null) {
        SHELL.lastExitCode = code;
        return;
      }
    }
    
    // Re-tokenize with preserved quotes for js builtin so string literals
    // inside code like console.log("hi") keep their quotes
    if (tokens[0] === 'js') {
      tokens = tokenize(line, true);
    }
    
    tokens = expandAliases(tokens);
    tokens = expandGlobs(tokens);
    const cmds = splitCommands(tokens);
    cmds.forEach(expandTokens);
    // Check for simple builtin-only (no pipes, no redir)
    if (cmds.length === 1 && cmds[0].args[0] && typeof builtins === 'object' && cmds[0].args[0] in builtins && !cmds[0].stdin && !cmds[0].stdout && !cmds[0].background) {
      const name = cmds[0].args[0];
      const res = builtins[name](cmds[0].args);
      if (typeof res === 'number') SHELL.lastExitCode = res;
      else if (res && typeof res.then === 'function') {
        const code = await res;
        SHELL.lastExitCode = code || 0;
      }
      return;
    }
    // otherwise execute pipeline
    await executePipeline(cmds);
  } catch (e) {
    // break/continue/return are control-flow signals, not errors - rethrow so
    // the loop or function that owns them can act on them.
    if (isSignal(e, 'break') || isSignal(e, 'continue') || isSignal(e, 'return')) {
      throw e;
    }
    console.error('Error:', e.message);
    SHELL.lastExitCode = 1;
  }
}

function isBuiltin(name) {
  return name && (name in builtins);
}

function spawnCommand(cmd, args, options) {
  // options: stdio mapping
  debug('spawn', cmd, args, options);
  try {
    return spawn(cmd, args, options);
  } catch (e) {
    return null;
  }
}

// Ignore SIGTTOU to allow background process group (the shell) to change terminal ownership.
// A caught JS handler is NOT sufficient: with a caught (or default) disposition,
// tcsetpgrp() called from the shell's background process group fails with ENOTTY,
// leaving the terminal owned by the dead child's pgrp, after which setRawMode()
// fails with EIO and the shell dies. Real shells set SIGTTOU to SIG_IGN.
process.on('SIGTTOU', () => {});
process.on('SIGTTIN', () => {});
if (ptctl.available) {
  try {
    const rcIGN = ptctl.ignore_job_signals();
    if (process.env.FGSH_DEVEL && rcIGN !== 0) console.error(`[DEBUG] ignore_job_signals rc=${rcIGN}`);
  } catch (e) {
    if (process.env.FGSH_DEVEL) console.error(`[DEBUG] ignore_job_signals failed: ${e.message}`);
  }
}
if (process.env.FGSH_DEVEL) {
  process.stdin.on('end', () => console.error('[DEBUG] stdin end event'));
  process.stdin.on('close', () => console.error('[DEBUG] stdin close event'));
}
// A tty read/setattr can fail with EIO while a child owns the terminal
// (background process group). Without this handler the 'error' event is
// uncaught and the whole shell dies mid-cleanup.
process.stdin.on('error', (e) => {
  if (process.env.FGSH_DEVEL) {
    console.error(`[DEBUG] stdin error: ${e.message}`);
    try {
      const fg = ptctl.available ? ptctl.tcgetpgrp(0) : -1;
      console.error(`[DEBUG] tcgetpgrp(0)=${fg} shellPgid=${shellPgid} pid=${process.pid} rawModeState=${process.stdin.isRaw}`);
    } catch (err) {}
  }
});

// Builtins that read their input from files rather than a stream: when such
// a builtin is the target of `< file`, the file path is passed as an operand.
const STDIN_AS_OPERAND = new Set(['cat']);

async function executePipeline(cmds) {
  const n = cmds.length;
  const procs = [];
  let pids = [];
  // Output captured from builtin stages, indexed by stage. Builtins run in
  // this process, so their stdout has to be buffered and handed to the next
  // stage when it is spawned.
  const stageOut = new Array(n).fill(null);
  
  if (process.env.FGSH_DEVEL) console.error(`[DEBUG] executePipeline called with ${n} command(s)`);

  for (let i = 0; i < n; i++) {
    const c = cmds[i];
    const argv = c.args.map(a => a);
    if (argv.length === 0) continue;

    const command = argv[0];
    const args = argv.slice(1);

    const isInteractive = !c.stdin && !c.stdout && !c.background && n === 1 && !isLoadingRcFile;
    if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Command: ${command}, isInteractive=${isInteractive}`);

    let child;
    
    // Builtins run in-process. They only stay on this path when they are not
    // being used as a filter (`... | cat | ...`), in which case the external
    // executable is used instead so the pipeline's stdin plumbing is real.
    const isBuiltinCmd = typeof builtins === 'object' && command in builtins && typeof builtins[command] === 'function';
    const asFilter = isBuiltinCmd && i > 0 && resolveExecutable(command);
    if (isBuiltinCmd && !asFilter) {
      if (process.env.FGSH_DEVEL) console.error(`[DEBUG] builtin branch: ${command} args=${JSON.stringify(args)} stdin=${c.stdin} stdout=${c.stdout}`);
      
      const builtinArgs = [command, ...args];
      // `cat < file` and friends read files, so hand them the redirect target
      // as an operand - they have no way to read a redirected stdin.
      if (c.stdin && STDIN_AS_OPERAND.has(command) && builtinArgs.length === 1) {
        builtinArgs.push(path.resolve(SHELL.cwd, c.stdin));
      }
      
      let outFd = null;
      if (c.stdout) {
        try {
          outFd = fs.openSync(path.resolve(SHELL.cwd, c.stdout), c.stdoutAppend ? 'a' : 'w');
        } catch (e) {
          console.error(`${c.stdout}: ${e.message}`);
          SHELL.lastExitCode = 1;
          continue;
        }
      }
      const capture = (i < n - 1);   // a later stage needs this output
      const chunks = [];
      
      const writeChunk = (buf) => {
        if (outFd !== null) fs.writeSync(outFd, buf);
        else if (capture) chunks.push(buf);
        else ORIG_STDOUT_WRITE(buf);
      };
      
      const origWrite = process.stdout.write;
      process.stdout.write = function (chunk, enc, cb) {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(String(chunk), typeof enc === 'string' ? enc : 'utf8');
        writeChunk(buf);
        if (typeof enc === 'function') enc();
        else if (typeof cb === 'function') cb();
        return true;
      };
      
      try {
        const res = builtins[command](builtinArgs);
        if (typeof res === 'number') SHELL.lastExitCode = res;
        else if (res && typeof res.then === 'function') {
          const code = await res;
          SHELL.lastExitCode = code || 0;
        }
      } finally {
        process.stdout.write = origWrite;
        if (outFd !== null) { try { fs.closeSync(outFd); } catch (e) { /* ignore */ } }
      }
      
      if (capture) stageOut[i] = Buffer.concat(chunks);
      if (process.env.FGSH_DEVEL) console.error(`[DEBUG] builtin done: ${command}`);
      continue;
    }
    
    if (isInteractive) {
      const exe = resolveExecutable(command);
      if (!exe) {
        console.error(`${command}: command not found`);
        SHELL.lastExitCode = 127;
        if (rl.paused) {
          if (process.stdin.isTTY && process.stdin.setRawMode) {
            try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
          }
          rl.resume();
        }
        return;
      }
      
      // *** FIX FOR BLANK SCREEN ISSUE WITH TUI APPS LIKE NEOVIM ***
      
      // Disable raw mode so ctrl+z can be processed as a signal by the kernel
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      
      // Pause readline so child gets exclusive control of stdin
      rl.pause();
      
      debug(`Shell PGID: ${shellPgid}, spawning: ${command}`);
      
      // 2. Spawn child with inherited stdio and in a new process group
      // TUI apps require 'inherit' to take full control of the terminal
      // (including raw mode and alternate screen buffer).
      // Use 'detached: true' to create a new process group for the child
      // HOWEVER: sudo needs to stay attached to the TTY to read passwords from /dev/tty
      let childProcess;
      
       // Check if this is a script that needs an interpreter
       const scriptExecutor = getScriptExecutor(exe);
       let actualExe = exe;
       let actualArgs = args;
       if (scriptExecutor) {
         actualExe = scriptExecutor.interpreter;
         actualArgs = [...scriptExecutor.args, ...args];
       }
       
       // Explicitly enable signals using native C function (termios)
       // This ensures ISIG is set so the kernel generates SIGTSTP on Ctrl+Z
       if (ptctl.available) {
         try {
           ptctl.enable_signals(0); // 0 = stdin
           if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Enabled signals (ISIG) on stdin via ptctl`);
         } catch (e) {
           if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Failed to enable signals via ptctl: ${e.message}`);
         }
       } else if (process.stdin.isTTY) {
         // Fallback for when ptctl is not available (though it should be)
         try {
           if (process.stdin.setRawMode) process.stdin.setRawMode(false);
         } catch (e) {}
       }
      
        try {
          if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Spawning: ${actualExe} ${actualArgs.join(' ')}`);
          childProcess = spawn(actualExe, actualArgs, {
            cwd: getAccessibleCwd(),
            env: SHELL.env,
            stdio: 'inherit',
          });
          if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Child PID: ${childProcess.pid}`);

          if (ptctl.available) {
            try {
              const rcSp = ptctl.setpgid(childProcess.pid, childProcess.pid);
              if (process.env.FGSH_DEVEL) console.error(`[DEBUG] setpgid(${childProcess.pid}) rc=${rcSp}`);
            } catch (e) {
              debug('Error moving child to new process group:', e.message);
            }
            try {
              const childPgid = ptctl.getpgid(childProcess.pid);
              debug(`Setting terminal to child PGID ${childPgid}`);
              const rcT = ptctl.tcsetpgrp(0, childPgid);
              const rcE = ptctl.enable_signals(0);
              if (process.env.FGSH_DEVEL) console.error(`[DEBUG] spawn tcsetpgrp(${childPgid}) rc=${rcT} enable_signals rc=${rcE} errno=${ptctl.get_errno ? ptctl.get_errno() : -1}`);
            } catch (e) {
              debug('ptctl error setting terminal to child:', e.message);
            }
          }
      } catch (spawnErr) {
        console.error(`Error executing ${command}: ${spawnErr.message}`);
        SHELL.lastExitCode = 127;
        
        // Restore terminal to shell and resume readline
        if (ptctl.available) {
          try {
            ptctl.tcsetpgrp(0, shellPgid);
          } catch (e) {}
        }
        if (rl.paused) {
          if (process.stdin.isTTY && process.stdin.setRawMode) {
            try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
          }
          rl.resume();
        }
        return;
      }

      debug(`Child spawned PID: ${childProcess.pid}`);
      
      // Register job before waiting
      const cmdline = args.length ? [command, ...args].join(' ') : command;
      const job = addJob([childProcess.pid], cmdline, false);
      pids.push(childProcess.pid);
      
      // Track for SIGTSTP forwarding
      currentChild = childProcess;

      // Wait for process to exit or stop
      await new Promise((resolve) => {
        let isDone = false;
        // The SIGTSTP handler needs a way to release this wait. Without it the
        // shell stayed blocked inside runLine() after Ctrl+Z, so prompt() never
        // ran, the line buffer was never cleared, and the next line the user
        // typed got appended to the suspended one ("sleep 30\necho hi").
        childProcess._resolve = resolve;
        
        const cleanup = () => {
           if (isDone) return;
           isDone = true;
            clearInterval(checkStatus);
            if (process.env.FGSH_DEVEL) console.error('[DEBUG] cleanup: start');
            
                // Restore terminal to shell
                if (ptctl.available) {
                  try {
                    const rc = ptctl.tcsetpgrp(0, shellPgid);
                    if (process.env.FGSH_DEVEL) {
                      const fg = ptctl.tcgetpgrp(0);
                      const err = ptctl.get_errno ? ptctl.get_errno() : -1;
                      console.error(`[DEBUG] cleanup: tcsetpgrp(${shellPgid}) rc=${rc} tcgetpgrp=${fg} errno=${err} fgpid=${process.pid}`);
                    }
                  } catch (e) {
                    if (process.env.FGSH_DEVEL) console.error(`[DEBUG] cleanup: tcsetpgrp threw ${e.message}`);
                  }
                } else if (process.env.FGSH_DEVEL) console.error('[DEBUG] cleanup: ptctl NOT available');
                
                // Resume readline
                if (rl.paused) {
                  if (process.stdin.isTTY && process.stdin.setRawMode) {
                    try {
                      process.stdin.setRawMode(true);
                      if (process.env.FGSH_DEVEL) console.error('[DEBUG] cleanup: setRawMode(true) ok');
                    } catch (e) {
                      if (process.env.FGSH_DEVEL) console.error(`[DEBUG] cleanup: setRawMode threw ${e.message}`);
                    }
                  }
                  rl.resume();
                  rl.line = '';
                  rl.cursor = 0;
                  if (process.env.FGSH_DEVEL) console.error('[DEBUG] cleanup: rl resumed');
                } else if (process.env.FGSH_DEVEL) console.error('[DEBUG] cleanup: rl NOT paused');
            
             currentChild = null;
             if (process.env.FGSH_DEVEL) console.error('[DEBUG] cleanup: resolving');
             resolve();
          };

        childProcess.on('exit', (code, signal) => {
          if (isDone) return;
          if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Child exit event: code=${code}, signal=${signal}`);
          debug(`Child exited with code ${code}, signal ${signal}`);
          SHELL.lastExitCode = code || 0;
          
          const job = findJobByPid(childProcess.pid);
          if (job) {
            markJobDone(job);
          }
          
          cleanup();
        });

        childProcess.on('error', (err) => {
          if (isDone) return;
          console.error(`Error executing ${command}:`, err.message);
          SHELL.lastExitCode = 1;
          
          const job = findJobByPid(childProcess.pid);
          if (job) {
            markJobDone(job);
          }
          
          cleanup();
        });

      // Polling loop to detect if child stopped (SIGTSTP)
      const checkStatus = setInterval(() => {
          if (isDone) return;
          try {
            const statFile = `/proc/${childProcess.pid}/stat`;
            if (fs.existsSync(statFile)) {
              const stat = fs.readFileSync(statFile, 'utf8');
              const parts = stat.split(' ');
              const state = parts[2];
              
              if (state === 'T') {
                if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Detected child PID ${childProcess.pid} stopped (state T)`);
                
                const job = findJobByPid(childProcess.pid);
                if (job) {
                  job.status = 'stopped';
                  job.suspended = true;
                  console.log(`\n[${job.id}]+ Stopped\t${job.cmdline}`);
                }
                
                cleanup();
              }
            }
          } catch (e) {
            // Process might have exited already
          }
        }, 100);
      });
      
      return;
      // *** END FIX ***

    } else {
      // Fallback to child_process.spawn for non-interactive commands or pipelines
      // For single commands without redirects or pipes, inherit stdio for proper interaction
      const isSingleCommand = n === 1 && !c.stdin && !c.stdout && !c.background;
      // sudo always needs TTY access to read passwords, so treat it like a single command
      const isSudo = command === 'sudo';
      let stdio;
      if (isSingleCommand || isSudo) {
        // During RC file loading, close stdin to prevent reading from piped input
        if (isLoadingRcFile) {
          stdio = ['ignore', 'inherit', 'inherit'];
        } else {
          stdio = 'inherit';
        }
        // Pause readline even during RC file loading to prevent state corruption
        rl.pause();
      } else {
        // prepare stdio array for spawn: [stdin, stdout, stderr]
        stdio = ['pipe', 'pipe', 'pipe'];
        // set up input redirection for first cmd
        if (i === 0 && c.stdin) {
          try {
            stdio[0] = fs.openSync(path.resolve(SHELL.cwd, c.stdin), 'r');
          } catch (e) {
            console.error('Input redirect error:', e.message);
            return;
          }
        }
        // set up output redirection for last cmd
        if (i === n - 1 && c.stdout) {
          try {
            const flags = c.stdoutAppend ? 'a' : 'w';
            stdio[1] = fs.openSync(path.resolve(SHELL.cwd, c.stdout), flags);
          } catch (e) {
            console.error('Output redirect error:', e.message);
            return;
          }
        }
      }

      const options = {
        cwd: getAccessibleCwd(),
        env: SHELL.env,
        stdio: stdio,
        detached: false,
      };

      const exe = resolveExecutable(command);
      if (!exe) {
        console.error(`${command}: command not found`);
        SHELL.lastExitCode = 127;
        if (rl.paused) {
          if (process.stdin.isTTY && process.stdin.setRawMode) {
            try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
          }
          rl.resume();
        }
        return;
      }
      
      try {
        child = spawn(exe, args, options);
      } catch (spawnErr) {
        console.error(`Error executing ${command}: ${spawnErr.message}`);
        SHELL.lastExitCode = 127;
        if (isSingleCommand && rl.paused) {
          if (process.stdin.isTTY && process.stdin.setRawMode) {
            try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
          }
          rl.resume();
        }
        return;
      }
      
      if (!child) {
        console.error('Failed to spawn', exe);
        SHELL.lastExitCode = 1;
        return;
      }
      

      
      // Store options for later piping check
      child._cmdOptions = options;
      
      // Store resume handler for single commands to be called after child exits
      if (isSingleCommand) {
        child._resumeRl = true;
      }
    }
    
    procs[i] = child;
    pids.push(child.pid);

    // handle piping for regular child_process.spawn (skip if stdio is inherited)
    const stdioIsInherited = child._cmdOptions && (child._cmdOptions.stdio === 'inherit' || (Array.isArray(child._cmdOptions.stdio) && child._cmdOptions.stdio[1] === 'inherit'));
    if (!isInteractive && child._cmdOptions && !stdioIsInherited) {
      try {
        // A downstream reader can exit early (`yes | head -3`); without these
        // the EPIPE surfaced as an uncaught exception and killed the shell.
        if (child.stdin) child.stdin.on('error', () => {});
        if (child.stdout) child.stdout.on('error', () => {});
        if (child.stderr) child.stderr.on('error', () => {});

        if (i > 0) {
          const prev = procs[i - 1];
          if (prev && prev.stdout && child.stdin) {
            if (prev.stdout) prev.stdout.on('error', () => {});
            prev.stdout.pipe(child.stdin);
            // Remember the upstream reader so it can be closed if this stage
            // exits early. The shell holds its own copy of that pipe's read
            // end; if it stays open, a writer like `yes` blocks on a full pipe
            // forever instead of taking SIGPIPE, and the shell hangs with it.
            child._upstream = prev.stdout;
          } else if (stageOut[i - 1] && child.stdin) {
            // Previous stage was a builtin: hand over what it produced.
            child.stdin.end(stageOut[i - 1]);
          }
        }

        if (i === n-1) {
          if (!c.stdout && child.stdout) {
            child.stdout.pipe(process.stdout);
          }
        }
        if (i === 0 && !c.stdin && procs.length === 1 && !c.background) {
          if (process.stdin.isTTY && child.stdin) {
            process.stdin.pipe(child.stdin);
          }
        }
        if (child.stderr) {
          child.stderr.pipe(process.stderr);
        }
      } catch (e) {
        debug('Piping error:', e.message);
      }
    }
    
    // handle child exit
    child.on('exit', (code, signal) => {
      // Release the upstream pipe read end we were feeding this stage from.
      if (child._upstream) {
        try { child._upstream.destroy(); } catch (e) { /* ignore */ }
        child._upstream = null;
      }
      if (child._resumeRl && rl.paused) {
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
        }
        rl.resume();
      }
      const job = findJobByPid(child.pid);
      if (job) {
        job.pids = job.pids.filter(p => p !== child.pid);
        if (job.pids.length === 0) {
          markJobDone(job);
        }
      }
    });
  }

  // Nothing was spawned (every stage was a builtin), so there is no job to
  // wait for. Adding an empty job here made waitForJob poll forever - that is
  // what turned `echo hi > file` into a hang.
  if (pids.length === 0) {
    return;
  }

  // register job
  const cmdline = cmds.map(c => c.args.join(' ')).join(' | ');
  const background = cmds[cmds.length-1].background;
  const job = addJob(pids, cmdline, background);

  if (background) {
    console.log(`[${job.id}] ${job.pids[0]}`);
    return;
  } else {
    await waitForJob(job).catch(() => {});
    return;
  }
}

function resolveExecutable(cmd) {
  // If absolute or relative path, test it
  if (cmd.startsWith('/') || cmd.startsWith('./') || cmd.startsWith('../')) {
    try {
      fs.accessSync(cmd, fs.constants.X_OK);
      return cmd;
    } catch (e) {
      return null;
    }
  }
  // search PATH
  const PATH = (SHELL.env.PATH || process.env.PATH || '/usr/bin:/bin').split(':');
  for (const p of PATH) {
    const full = path.join(p, cmd);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch (e) {}
  }
  return null;
}

// Helper to detect if a file is a shell script and return the interpreter + args if needed
function getScriptExecutor(exePath) {
  try {
    const fd = fs.openSync(exePath, 'r');
    const buf = Buffer.alloc(256);
    const bytesRead = fs.readSync(fd, buf, 0, 256);
    fs.closeSync(fd);
    
    const content = buf.toString('utf8', 0, bytesRead);
    const firstLine = content.split('\n')[0];
    
    // Check for shebang
    if (firstLine.startsWith('#!')) {
      const shebang = firstLine.substring(2).trim();
      // Parse shebang line: can be like #!/bin/sh or #!/usr/bin/env python3
      const parts = shebang.split(/\s+/);
      const interpreter = parts[0];
      const interpreterArgs = parts.slice(1);
      
      return {
        interpreter: interpreter,
        args: [...interpreterArgs, exePath]
      };
    }
  } catch (e) {
    // If we can't read the file, just try to execute it normally
  }
  
  // No shebang detected or couldn't read file, return null to use direct execution
  return null;
}

// ---------------------- Signal handling ----------------------
process.on('SIGINT', () => {
  // forward SIGINT to foreground jobs (all jobs not background)
  for (const j of SHELL.jobs) {
    if (!j.background) {
      for (const pid of j.pids) {
        try { process.kill(pid, 'SIGINT'); } catch(e){}
      }
    }
  }
  // redisplay prompt via setImmediate to allow signal handling to complete
  setImmediate(() => {
    prompt().catch(() => {});
  });
});

// Track current child process
let currentChild = null;

// Handle SIGTSTP: forward to child and let it suspend
process.on('SIGTSTP', () => {
  if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Shell received SIGTSTP`);
  
  if (currentChild && !currentChild.killed) {
    const child = currentChild;
    // Forward SIGTSTP to the child process directly
    if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Forwarding SIGTSTP to child PID ${child.pid}`);
    try {
      // Mark as suspended BEFORE sending signal to avoid race conditions with exit handler
      child.suspended = true;
      
      let killErr = null;
      try { process.kill(child.pid, 'SIGTSTP'); } catch (e) { killErr = e.message; }
      if (process.env.FGSH_DEVEL && killErr) console.error(`[DEBUG] SIGTSTP to ${child.pid} failed: ${killErr}`);
      
      const job = findJobByPid(child.pid);
      if (job) {
        job.status = 'stopped';
        job.suspended = true;
        // Move cursor to new line if we're in a terminal
        if (process.stdout.isTTY) process.stdout.write('\n');
        console.log(`[${job.id}]+ Stopped\t${job.cmdline}`);
      }
      
      // Restore terminal to shell if ptctl is available
      if (ptctl.available) {
        try {
          ptctl.tcsetpgrp(0, shellPgid);
          if (process.env.FGSH_DEBUG) console.error('[DEBUG] tcsetpgrp to shell ok');
        } catch (e) {
          if (process.env.FGSH_DEBUG) console.error('[DEBUG] tcsetpgrp to shell failed:', e.message);
        }
      }
      
      // Resume readline so the shell can take input again
      if (rl.paused) {
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          try { process.stdin.setRawMode(true); } catch (e) { /* ignore: EIO possible while child owns tty */ }
        }
        rl.resume();
        rl.line = '';
        rl.cursor = 0;
      }
      
       // Clear current child tracking
       currentChild = null;
       
       // Trigger resolution of the wait in executePipeline
       if (child._resolve) {
         child._resolve();
       }
    } catch (e) {
      if (process.env.FGSH_DEVEL) console.error(`[DEBUG] Failed to forward SIGTSTP: ${e.message}`);
    }
  }
  // Don't suspend the shell - let the child handle it
});

// reap children to update job table even if not foreground
process.on('exit', () => {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    try {
      process.stdin.setRawMode(false);
    } catch (e) {}
  }
  historyDB.closeDB();
  // Clean up any remaining heredoc temp files
  try {
    const files = fs.readdirSync(os.tmpdir());
    for (const file of files) {
      if (file.startsWith(HEREDOC_TMP_PREFIX)) {
        try { fs.unlinkSync(path.join(os.tmpdir(), file)); } catch (e) {}
      }
    }
  } catch (e) {}
});

// Clean up terminal raw mode on termination signals
const terminationSignals = ['SIGTERM', 'SIGHUP', 'SIGQUIT'];
terminationSignals.forEach(sig => {
  process.on(sig, () => {
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch (e) {}
    }
    process.removeAllListeners(sig);
    process.kill(process.pid, sig);
  });
});

// Helper to read directory asynchronously without blocking
function readDirAsync(dirPath) {
  return fs.promises.readdir(dirPath, { withFileTypes: true })
    .then(entries => {
      return entries
        .map(dirent => ({
          name: dirent.name,
          isDirectory: dirent.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    });
}

function getImageSupport() {
  // Check SHELL.env first as it's the source of truth for the shell session
  const term = (SHELL.env.TERM || process.env.TERM || '').toLowerCase();
  const kittyId = SHELL.env.KITTY_WINDOW_ID || process.env.KITTY_WINDOW_ID;
  
  if (term.includes('kitty') || kittyId) return 'kitty';
  return 'none';
}

// Helper to get preview info for a file. Returns a description of the file
// for the preview pane; the OpenTUI picker renders images via ImageRenderable,
// so this only reports that an image is present plus its metadata.
async function getFilePreview(filePath, maxLines = 20, baseDir = SHELL.cwd) {
  try {
    const resolvedPath = path.resolve(baseDir, filePath);
    const stat = await fs.promises.stat(resolvedPath);
    if (stat.isDirectory()) {
      return { type: 'text', content: '[Directory]' };
    }
    
    const sizeStr = (stat.size / 1024).toFixed(1) + ' KB';
    
    // Check for image
    const ext = path.extname(resolvedPath).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico'];
    if (imageExts.includes(ext)) {
      return { type: 'image', path: resolvedPath, sizeStr };
    }
    
    // Skip preview for very large files
    if (stat.size > 50000) {
      return { type: 'text', content: '[File: ' + sizeStr + ']' };
    }
    
    // Skip known binary file extensions
    const binaryExts = ['.db', '.sqlite', '.sqlite3', '.pdf', '.zip', '.gz', '.tar', '.exe', '.bin', '.so', '.dylib', '.o', '.a', '.node'];
    if (binaryExts.includes(ext)) {
      return { type: 'text', content: '[Binary: ' + sizeStr + ']' };
    }
    
    // Skip files that look like databases or binary
    const baseName = path.basename(resolvedPath);
    if (baseName.startsWith('.') && baseName.includes('history')) {
      return { type: 'text', content: '[Database: ' + sizeStr + ']' };
    }
    
    // Try to read as text
    try {
      const content = await fs.promises.readFile(resolvedPath, 'utf8');
      
      // Check if content looks binary (contains null bytes or control chars)
      if (content.indexOf('\0') !== -1 || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 1000))) {
        return { type: 'text', content: '[Binary: ' + sizeStr + ']' };
      }
      
      // It's text
      const lines = content.split('\n').slice(0, maxLines);
      return { type: 'text', content: lines.map(l => l.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')).join('\n') };
    } catch (readErr) {
      return { type: 'text', content: '[Binary: ' + sizeStr + ']' };
    }
  } catch (e) {
    return { type: 'text', content: '[Cannot read file]' };
  }
}

// OpenTUI file picker: two-pane browser with fuzzy filter and live preview.
// Mirrors showHistoryPicker's structure (lazily imported renderer, one
// renderer per invocation, idempotent finish) but adds directory navigation
// and inline image previews. Resolves to the absolute path of the selected
// file/directory, or null on cancel.
async function showFilePicker() {
  if (isFilePickerActive || !process.stdin.isTTY) {
    return null;
  }
  isFilePickerActive = true;

  let browseDir = SHELL.cwd;
  let allFiles = [];
  try {
    allFiles = await readDirAsync(browseDir);
  } catch (e) {
    isFilePickerActive = false;
    return null;
  }
  let filteredFiles = [...allFiles];
  let searchQuery = '';

  let renderer = null;
  let done = false;
  let resolvePromise = null;
  const promise = new Promise((resolve) => { resolvePromise = resolve; });

  // Every exit path tears down the renderer, clears the shared picker flag
  // and settles the promise exactly once.
  const finish = (result) => {
    if (done) return;
    done = true;
    try { if (renderer) renderer.destroy(); } catch (e) { /* ignore */ }
    isFilePickerActive = false;
    resolvePromise(result);
  };

  try {
    // Loaded lazily so the shell only pays for the native core when the
    // user actually opens the picker. useKittyKeyboard stays off: the line
    // editor parses stdin itself once the picker closes, and kitty-encoded
    // keys (e.g. Enter as CSI-u) would not be understood by it.
    const { createCliRenderer, BoxRenderable, TextRenderable, SelectRenderable, ImageRenderable } =
      await import('@opentui/core');

    renderer = await createCliRenderer({
      exitOnCtrlC: false,  // Ctrl+C cancels the picker, it never kills the shell
      useKittyKeyboard: null,
      useMouse: true,      // wheel/click scrolling and selection in the list
      targetFps: 30,
    });

    const toOption = (file) => ({
      name: (file.isDirectory ? '[D] ' : '[F] ') + file.name + (file.isDirectory ? '/' : ''),
      value: file,
    });

    const title = new TextRenderable(renderer, {
      content: 'File Picker  (type to filter, ←: parent dir, →: enter dir, Enter: select, Esc: cancel)',
      fg: '#FFFFFF',
    });
    const dirText = new TextRenderable(renderer, { content: '', fg: '#AAAAAA' });
    const select = new SelectRenderable(renderer, {
      options: filteredFiles.map(toOption),
      width: '60%',
      height: '100%',
      showSelectionIndicator: true,
      wrapSelection: false,
      selectedBackgroundColor: '#3A60C0',
    });
    const previewMeta = new TextRenderable(renderer, { content: '', fg: '#8A8A9A' });
    const previewBody = new TextRenderable(renderer, {
      content: '', fg: '#FFFFFF', wrapMode: 'word',
    });
    // Inline image preview. Only shown for terminals where getImageSupport()
    // detects Kitty (the same gate the old picker used); OpenTUI handles
    // transmission, scaling to the pane, and cleanup on destroy. We pin the
    // protocol to 'kitty' rather than leaving it at the default 'auto',
    // because 'auto' resolves to 'blocks' unless the renderer's async
    // kitty_graphics capability probe is answered — which KITTY_WINDOW_ID
    // already implies but the probe cannot confirm inside a bare pty.
    const imagePreview = new ImageRenderable(renderer, {
      width: '100%',
      flexGrow: 1,
      fit: 'fit',
      protocol: 'kitty',
      visible: false,
    });
    const previewPane = new BoxRenderable(renderer, {
      width: '40%',
      height: '100%',
      flexDirection: 'column',
      paddingX: 1,
      gap: 1,
    });
    previewPane.add(previewMeta);
    previewPane.add(previewBody);
    previewPane.add(imagePreview);

    const body = new BoxRenderable(renderer, {
      width: '100%',
      flexGrow: 1,
      flexDirection: 'row',
    });
    body.add(select);
    body.add(previewPane);

    const column = new BoxRenderable(renderer, {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      padding: 1,
      gap: 1,
    });
    column.add(title);
    column.add(dirText);
    column.add(body);
    renderer.root.add(column);

    // getFilePreview is async, so a burst of arrow presses can have several
    // previews in flight at once; the token drops any that resolve after
    // the selection moved on.
    let previewToken = 0;

    const updatePreview = async () => {
      const token = ++previewToken;
      const option = select.getSelectedOption();
      const file = option ? option.value : null;
      if (!file) {
        previewMeta.content = '';
        previewBody.content = filteredFiles.length === 0 ? '(no files)' : '';
        imagePreview.visible = false;
        return;
      }
      const fullPath = path.resolve(browseDir, file.name);
      if (file.isDirectory) {
        if (token !== previewToken) return;
        previewMeta.content = fullPath;
        previewBody.content = '[Directory]';
        imagePreview.visible = false;
        return;
      }
      let stat = null;
      try { stat = await fs.promises.stat(fullPath); } catch (e) { /* unreadable */ }
      if (token !== previewToken) return;
      const sizeStr = stat ? (stat.size / 1024).toFixed(1) + ' KB' : '';
      const mtimeStr = stat ? stat.mtime.toLocaleString() : '';
      const preview = await getFilePreview(file.name, 40, browseDir);
      if (token !== previewToken) return;
      if (preview.type === 'image' && getImageSupport() === 'kitty') {
        previewMeta.content = `${fullPath}  ${sizeStr}  ${mtimeStr}`;
        previewBody.content = '';
        imagePreview.source = preview.path;
        imagePreview.visible = true;
      } else {
        previewMeta.content = `${fullPath}${sizeStr ? '  ' + sizeStr : ''}`;
        imagePreview.visible = false;
        previewBody.content = preview.type === 'image'
          ? `[Image: ${preview.sizeStr}]`   // terminal can't show images
          : (preview.content || '');
      }
    };

    const applyFilter = () => {
      if (searchQuery.length === 0) {
        filteredFiles = [...allFiles];
      } else {
        const Fuse = require('fuse.js');
        const fuse = new Fuse(allFiles, {
          keys: ['name'],
          threshold: 0.3,
        });
        const results = fuse.search(searchQuery).map(r => r.item);
        // Fall back to a substring match when fuzzy search finds nothing,
        // like the history picker does for commands.
        filteredFiles = results.length > 0 ? results
          : allFiles.filter(f =>
              f.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
      }
      select.options = filteredFiles.map(toOption);
      select.selectedIndex = 0;
      dirText.content = browseDir + (searchQuery ? `  Filter: ${searchQuery}` : '');
      updatePreview();
    };

    // Load a new directory into the list. Unreadable directories are
    // ignored (stay put), matching the old picker's behavior.
    const changeDir = async (newDir) => {
      let newFiles;
      try {
        newFiles = await readDirAsync(newDir);
      } catch (e) {
        return;
      }
      browseDir = newDir;
      allFiles = newFiles;
      searchQuery = '';
      applyFilter();
    };

    select.on('selectionChanged', updatePreview);
    select.on('itemSelected', (_index, option) => {
      finish(option && option.value ? path.resolve(browseDir, option.value.name) : null);
    });

    renderer.keyInput.on('keypress', (key) => {
      if (done || !key) return;
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        finish(null);
        return;
      }
      // Enter selects the highlighted entry — file OR directory — and
      // closes the picker, handled here (not via the Select's own binding)
      // so the behavior is the same whatever key encoding the terminal
      // uses. An empty list closes with nothing selected. Right is the
      // key that descends into a directory.
      if (key.name === 'return' || key.name === 'enter') {
        const option = select.getSelectedOption();
        finish(option && option.value ? path.resolve(browseDir, option.value.name) : null);
        return;
      }
      if (key.name === 'left') {
        const parent = path.dirname(browseDir);
        if (parent !== browseDir) {
          changeDir(parent).catch(() => {});
        }
        return;
      }
      if (key.name === 'right') {
        const option = select.getSelectedOption();
        if (option && option.value && option.value.isDirectory) {
          changeDir(path.resolve(browseDir, option.value.name)).catch(() => {});
        }
        return;
      }
      if (key.name === 'backspace') {
        if (searchQuery.length > 0) {
          searchQuery = searchQuery.slice(0, -1);
          applyFilter();
        }
        return;
      }
      // Printable characters extend the filter query. Prefer the raw
      // sequence; fall back to single-character key names (e.g. space).
      // Up/down are left to the Select's own bindings.
      const ch = (key.sequence && key.sequence.length === 1)
        ? key.sequence
        : (key.name && key.name.length === 1 ? key.name : null);
      if (ch && !key.ctrl && !key.meta && ch >= '\x20' && ch <= '\x7e') {
        searchQuery += ch;
        applyFilter();
      }
    });

    applyFilter();
    select.focus();
  } catch (e) {
    console.error('File picker error:', e);
    finish(null);
  }
  return promise;
}

async function showHistoryPicker() {
  if (isFilePickerActive || !process.stdin.isTTY) {
    return null;
  }
  isFilePickerActive = true;

  let allEntries = [];
  try {
    allEntries = historyDB.getAll(500);
  } catch (e) {
    isFilePickerActive = false;
    return null;
  }
  let filteredEntries = [...allEntries];
  let searchQuery = '';

  let renderer = null;
  let done = false;
  let resolvePromise = null;
  const promise = new Promise((resolve) => { resolvePromise = resolve; });

  // Every exit path tears down the renderer, clears the shared picker flag
  // and settles the promise exactly once.
  const finish = (result) => {
    if (done) return;
    done = true;
    try { if (renderer) renderer.destroy(); } catch (e) { /* ignore */ }
    isFilePickerActive = false;
    resolvePromise(result);
  };

  try {
    // Loaded lazily so the shell only pays for the native core when the
    // user actually opens the picker. useKittyKeyboard stays off: the line
    // editor parses stdin itself once the picker closes, and kitty-encoded
    // keys (e.g. Enter as CSI-u) would not be understood by it.
    const { createCliRenderer, BoxRenderable, TextRenderable, SelectRenderable } =
      await import('@opentui/core');

    renderer = await createCliRenderer({
      exitOnCtrlC: false,  // Ctrl+C cancels the picker, it never kills the shell
      useKittyKeyboard: null,
      useMouse: true,      // wheel/click scrolling in the list
      targetFps: 30,
    });

    const toOption = (entry) => ({
      name: entry.command,
      description: `${new Date(entry.timestamp * 1000).toLocaleString()}` +
        (entry.exit_code !== null ? ` [${entry.exit_code}]` : ''),
      value: entry,
    });

    const title = new TextRenderable(renderer, {
      content: 'History Search  (type to filter, arrows: move, Enter: insert, Esc: cancel)',
      fg: '#FFFFFF',
    });
    const filterText = new TextRenderable(renderer, { content: 'Filter: ', fg: '#AAAAAA' });
    const select = new SelectRenderable(renderer, {
      options: filteredEntries.map(toOption),
      width: '60%',
      height: '100%',
      showDescription: true,
      showSelectionIndicator: true,
      wrapSelection: false,
      selectedBackgroundColor: '#3A60C0',
    });
    const previewMeta = new TextRenderable(renderer, { content: '', fg: '#8A8A9A' });
    const previewCmd = new TextRenderable(renderer, {
      content: '', fg: '#FFFFFF', wrapMode: 'word',
    });
    const previewPane = new BoxRenderable(renderer, {
      width: '40%',
      height: '100%',
      flexDirection: 'column',
      paddingX: 1,
      gap: 1,
    });
    previewPane.add(previewMeta);
    previewPane.add(previewCmd);

    const body = new BoxRenderable(renderer, {
      width: '100%',
      flexGrow: 1,
      flexDirection: 'row',
    });
    body.add(select);
    body.add(previewPane);

    const column = new BoxRenderable(renderer, {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      padding: 1,
      gap: 1,
    });
    column.add(title);
    column.add(filterText);
    column.add(body);
    renderer.root.add(column);

    const updatePreview = () => {
      const option = select.getSelectedOption();
      const entry = option ? option.value : null;
      if (!entry) {
        previewMeta.content = '';
        previewCmd.content = filteredEntries.length === 0 ? '(no commands found)' : '';
        return;
      }
      const exit = entry.exit_code === null ? '-' : String(entry.exit_code);
      previewMeta.content =
        `${new Date(entry.timestamp * 1000).toLocaleString()}  exit ${exit}  ` +
        `${entry.duration}ms  ${entry.cwd || ''}`;
      previewCmd.content = entry.command;
    };

    const applyFilter = () => {
      if (searchQuery.length === 0) {
        filteredEntries = [...allEntries];
      } else {
        const Fuse = require('fuse.js');
        const fuse = new Fuse(allEntries, {
          keys: ['command'],
          threshold: 0.3,
        });
        const results = fuse.search(searchQuery).map(r => r.item);
        // Fall back to a substring match when fuzzy search finds nothing,
        // like the file picker's filter does.
        filteredEntries = results.length > 0 ? results
          : allEntries.filter(e =>
              e.command.toLowerCase().includes(searchQuery.toLowerCase())
            );
      }
      select.options = filteredEntries.map(toOption);
      select.selectedIndex = 0;
      filterText.content = `Filter: ${searchQuery}`;
      updatePreview();
    };

    select.on('selectionChanged', updatePreview);
    select.on('itemSelected', (_index, option) => {
      finish(option && option.value ? option.value.command : null);
    });

    renderer.keyInput.on('keypress', (key) => {
      if (done || !key) return;
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        finish(null);
        return;
      }
      // Enter inserts the selected command and closes the picker — handled
      // here (not via the Select's own binding) so the behavior is the same
      // whatever key encoding the terminal uses. An empty list closes with
      // nothing inserted, like the file picker.
      if (key.name === 'return' || key.name === 'enter') {
        const option = select.getSelectedOption();
        finish(option && option.value ? option.value.command : null);
        return;
      }
      if (key.name === 'backspace') {
        if (searchQuery.length > 0) {
          searchQuery = searchQuery.slice(0, -1);
          applyFilter();
        }
        return;
      }
      // Printable characters extend the filter query. Prefer the raw
      // sequence; fall back to single-character key names (e.g. space).
      const ch = (key.sequence && key.sequence.length === 1)
        ? key.sequence
        : (key.name && key.name.length === 1 ? key.name : null);
      if (ch && !key.ctrl && !key.meta && ch >= '\x20' && ch <= '\x7e') {
        searchQuery += ch;
        applyFilter();
      }
    });

    updatePreview();
    select.focus();
  } catch (e) {
    console.error('History picker error:', e);
    finish(null);
  }
  return promise;
}

// Handle Ctrl+N for file picker and Ctrl+R for history picker
// The line editor owns stdin and routes these keys via callbacks.
if (process.stdin.isTTY) {
  rl.onCtrlN(async () => {
    if (isFilePickerActive) return;
    const savedLine = rl.line;
    const savedCursor = rl.cursor;
    rl.pause();
    // The picker needs live key input, so make sure raw mode is on.
    rl.ensureRawMode();
    try {
      const selectedFile = await showFilePicker();
      if (selectedFile) {
        rl.resume();
        // The picker resolves the selection to an absolute path (it may
        // have browsed away from the shell's cwd). Insert it relative to
        // the shell's cwd when it lives underneath it, otherwise insert
        // the absolute path.
        let insertPath = selectedFile;
        if (path.isAbsolute(selectedFile)) {
          const rel = path.relative(SHELL.cwd, selectedFile);
          if (rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)) {
            insertPath = rel;
          }
        }
        const line = rl.line;
        const cursor = rl.cursor;
        const needsSpace = line.length > 0 && !line.endsWith(' ');
        const insertText = (needsSpace ? ' ' : '') + insertPath.replace(/ /g, '\\ ');
        const left = line.slice(0, cursor);
        const right = line.slice(cursor);
        rl.line = left + insertText + right;
        rl.cursor = left.length + insertText.length;
      } else {
        // Resume before touching line/cursor: those setters only repaint
        // while the editor is unpaused, and the prompt must come back
        // immediately now that the picker has erased its overlay.
        rl.resume();
        rl.line = savedLine;
        rl.cursor = savedCursor;
      }
    } catch (e) {
      console.error('Picker error:', e);
      rl.resume();
    }
  });

  rl.onCtrlR(async () => {
    if (isFilePickerActive) return;
    const savedLine = rl.line;
    const savedCursor = rl.cursor;
    rl.pause();
    rl.ensureRawMode();
    try {
      const selectedCommand = await showHistoryPicker();
      rl.resume();
      if (selectedCommand) {
        rl.line = selectedCommand;
        rl.cursor = selectedCommand.length;
      } else {
        rl.line = savedLine;
        rl.cursor = savedCursor;
      }
    } catch (e) {
      console.error('History picker error:', e);
      rl.resume();
    }
  });
}

// ---------------------- REPL ----------------------
async function prompt() {
  let ps1 = SHELL.env.PS1;
  
  // Color codes
  const cyan = '\x1b[1;36m';
  const green = '\x1b[1;32m';
  const red = '\x1b[1;31m';
  const yellow = '\x1b[1;33m';
  const reset = '\x1b[0m';
  let uname;
  try {
    uname = os.userInfo().username;
  } catch (e) {
    uname = SHELL.env.USER || SHELL.env.LOGNAME || 'user';
  }
  const base = path.basename(SHELL.cwd);
  
  // Get hostname
  let hostname;
  try {
    hostname = os.hostname();
  } catch (e) {
    hostname = SHELL.env.HOSTNAME || 'localhost';
  }
  
  if (!ps1) {
    // Default prompt with colors if PS1 not set
    ps1 = `${cyan}${uname}${reset}:${green}${base}${reset} > `;
  } else {
    // Replace placeholders and expand variables
    ps1 = ps1
      .replace(/%user%/g, uname)
      .replace(/%host%/g, hostname)
      .replace(/%pwd%/g, SHELL.cwd)
      .replace(/%dir%/g, base)
      .replace(/%cyan%/g, cyan)
      .replace(/%green%/g, green)
      .replace(/%red%/g, red)
      .replace(/%yellow%/g, yellow)
      .replace(/%reset%/g, reset);
    
    // Expand variables and command substitutions
    ps1 = expandVars(ps1);
    ps1 = await expandCommandSubstitution(ps1);
  }
  
  rl.setPrompt(ps1);
  rl.prompt(true);
}

// Only set up interactive handlers if we're in interactive mode
// Helper to detect if a string has unclosed quotes
function hasUnclosedQuotes(str) {
  let inSingle = false;
  let inDouble = false;
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === '\\') {
      i += 2;  // Skip escaped character
      continue;
    }
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    i++;
  }
  return inSingle || inDouble;
}

// Helper to detect whether multi-line input still has an open block:
// an unfinished function definition (unbalanced braces) or a control
// structure (if/while/until/for/case) that is missing its closer.
function hasOpenBlock(text) {
  const trimmed = text.trimStart();
  if (!trimmed) return false;
  if (/^function\b/.test(trimmed) || /^[a-zA-Z_][a-zA-Z0-9_-]*\s*\(\s*\)/.test(trimmed)) {
    return countBraces(text) > 0;
  }
  if (/^(if|while|until|for|case)\b/.test(trimmed)) {
    return countBlockDepth(text) > 0;
  }
  return false;
}

// Handle --version and --help flags
if (process.argv[2] === '--version' || process.argv[2] === '-v') {
  console.log(`fgsh version ${VERSION}`);
  process.exit(0);
}

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log('Usage: fgsh [OPTIONS] [SCRIPT] [-c COMMAND]');
  console.log('');
  console.log('A simple interactive shell in Node.js');
  console.log('');
  console.log('Options:');
  console.log('  --version, -v     Display version information and exit');
  console.log('  --help, -h        Display this help message and exit');
  console.log('  -c COMMAND        Execute a command and exit');
  console.log('  SCRIPT            Execute a shell script');
  console.log('');
  console.log('Interactive mode starts if no SCRIPT or -c is specified.');
  process.exit(0);
}

// (not running a script or -c command)
const isScriptMode = process.argv[2] && process.argv[2] !== '-c';
const isCommandMode = process.argv[2] === '-c' && process.argv[3];

let accumulatedInput = '';  // For multi-line input with unclosed quotes

if (!isScriptMode && !isCommandMode) {
  rl.on('line', async (line) => {
    rl.pause();
    
    // Accumulate input if we have unclosed quotes
    accumulatedInput += (accumulatedInput ? '\n' : '') + line;
    
    if (hasUnclosedQuotes(accumulatedInput) || hasOpenBlock(accumulatedInput)) {
      // Still have unclosed quotes or an open block, wait for more input.
      // resume() must precede prompt(): prompt() early-returns while paused
      // and _render() skips paused state, so the old order (prompt then
      // resume) silently dropped the continuation prompt from the screen.
      rl.setPrompt('> ');  // Show continuation prompt
      rl.resume();
      rl.prompt();
    } else {
      // Quotes are closed, execute the accumulated input
      await runLine(accumulatedInput);
      if (process.env.FGSH_DEVEL) console.error('[DEBUG] line-handler: runLine returned');
      accumulatedInput = '';  // Reset for next command
      rl.setPrompt(SHELL.prompt);
      rl.resume();
      if (process.env.FGSH_DEVEL) console.error('[DEBUG] line-handler: calling prompt()');
      await prompt();
      if (process.env.FGSH_DEVEL) console.error('[DEBUG] line-handler: prompt() done');
    }
  });

  rl.on('SIGINT', () => {
    // Abandon any multi-line input being collected; the process SIGINT
    // handler redisplays the prompt.
    accumulatedInput = '';
  });
}

rl.on('close', () => {
  console.log();
  process.exit(0);
});



function loadHistory() {
  historyDB.initDB();
  const entries = historyDB.getAll(1000);
  for (const e of entries) {
    SHELL.history.push(e.command);
  }
  if (rl.history) {
    rl.history.push(...SHELL.history);
    debug('Loaded', entries.length, 'history entries from database');
  }
}

// ---------------------- BLOCK PARSER (script / rc / source) ----------------------
// Parse source lines into blocks: multi-line functions and control
// structures stay together, here-documents are rewritten to temp files.
// Returns blocks with line-number metadata for error reporting.
async function parseScriptBlocks(lines, filename) {
  const blocks = [];
  let idx = 0;
  
  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      idx++;
      continue;
    }
    
    // Check if this is the start of a control structure
    if (trimmed.startsWith('if ') || trimmed.startsWith('while ') || 
        trimmed.startsWith('until ') ||
        trimmed.startsWith('for ') || trimmed.startsWith('case ')) {
      const block = collectBlock(lines, idx);
      blocks.push({
        content: block.content,
        startLine: idx + 1,  // 1-indexed line numbers
        endLine: block.endIdx + 1,
        filename: filename
      });
      idx = block.endIdx + 1;
    } else if (trimmed.startsWith('function ') || /^[a-zA-Z_][a-zA-Z0-9_-]*\s*\(\s*\)/.test(trimmed)) {
      // Function definition block
      const block = collectBlock(lines, idx);
      blocks.push({
        content: block.content,
        startLine: idx + 1,
        endLine: block.endIdx + 1,
        filename: filename
      });
      idx = block.endIdx + 1;
    } else {
      // Check for here-document
      const heredocMatch = line.match(/<<\s*-?\s*([A-Za-z_][A-Za-z0-9_]*)/);
      if (heredocMatch) {
        const heredoc = await parseHereDocument(lines, idx);
        if (heredoc) {
          const commandLine = line.replace(/<<\s*-?\s*[A-Za-z_][A-Za-z0-9_]*/, heredoc.tmpFile);
          blocks.push({
            content: commandLine,
            startLine: idx + 1,
            endLine: heredoc.endIdx + 1,
            filename: filename,
            _heredocTmpFile: heredoc.tmpFile
          });
          idx = heredoc.endIdx + 1;
        } else {
          blocks.push({
            content: line,
            startLine: idx + 1,
            endLine: idx + 1,
            filename: filename
          });
          idx++;
        }
      } else {
        // Single-line command
        blocks.push({
          content: line,
          startLine: idx + 1,
          endLine: idx + 1,
          filename: filename
        });
        idx++;
      }
    }
  }
  
  return blocks;
}

// Collect a complete block (if/while/for/case/function)
function collectBlock(lines, startIdx) {
  const firstLine = lines[startIdx].trim();
  let content = firstLine;
  let idx = startIdx + 1;
  
  const isFunction = firstLine.startsWith('function ') ||
    /^[a-zA-Z_][a-zA-Z0-9_-]*\s*\(\s*\)/.test(firstLine);
  
  if (isFunction) {
    // Collect until the braces balance.
    let depth = countBraces(firstLine);
    while (idx < lines.length && depth > 0) {
      content += '\n' + lines[idx];
      depth += countBraces(lines[idx]);
      idx++;
    }
  } else {
    // Collect until this block's own keywords balance. Stopping at the
    // first fi/done (the old behaviour) truncated every nested block and
    // made `if` inside `for` a parse error.
    let depth = countBlockDepth(firstLine);
    while (idx < lines.length && depth > 0) {
      content += '\n' + lines[idx];
      depth += countBlockDepth(lines[idx]);
      idx++;
    }
  }
  
  return { content, endIdx: idx - 1 };
}

// Net brace delta for a line, ignoring braces inside quotes and comments.
function countBraces(line) {
  let count = 0;
  let state = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (state) {
      if (ch === '\\' && state === '"') { i++; continue; }
      if (ch === state) state = null;
      continue;
    }
    if (ch === "'" || ch === '"') { state = ch; continue; }
    if (ch === '#' && (i === 0 || /[\s;]/.test(line[i - 1]))) break;
    if (ch === '{') count++;
    else if (ch === '}') count--;
  }
  return count;
}

// Depth delta for a line of shell source: +1 for each block opener
// (if/for/while/until/case) and -1 for each closer (fi/done/esac).
// Nesting matters: the `fi` of an inner if must not close an outer one.
function countBlockDepth(text) {
  let depth = 0, state = null, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (state) { if (ch === state) state = null; i++; continue; }
    if (ch === "'" || ch === '"') { state = ch; i++; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_.]/.test(text[j])) j++;
      const w = text.slice(i, j).toLowerCase();
      if (CTL_OPEN_WORDS[w]) depth++;
      else if (CTL_CLOSE_WORDS[w]) depth--;
      i = j; continue;
    }
    i++;
  }
  return depth;
}

async function loadRcFile() {
  let rcFile = path.join(SHELL.env.HOME || process.env.HOME || '/tmp', '.fgshrc');
  
  // If the rc file exists but is not readable, try looking in the user's actual home
  // (this can happen when HOME is inherited from a different user)
  try {
    fs.accessSync(rcFile, fs.constants.R_OK);
  } catch (e) {
    // Try to find .fgshrc in the actual user's home directory
    try {
      const uid = process.getuid();
      const passwdContent = fs.readFileSync('/etc/passwd', 'utf8');
      const lines = passwdContent.split('\n');
      for (const line of lines) {
        const parts = line.split(':');
        if (parseInt(parts[2]) === uid) {
          const userHome = parts[5];
          const userRcFile = path.join(userHome, '.fgshrc');
          try {
            fs.accessSync(userRcFile, fs.constants.R_OK);
            rcFile = userRcFile;
            break;
          } catch (e2) {
            // User's rc file also not readable, continue with original path
          }
          break;
        }
      }
    } catch (e2) {
      // Can't determine user home, continue with original path
    }
  }
  
  if (fs.existsSync(rcFile)) {
    try {
      isLoadingRcFile = true;
      const script = fs.readFileSync(rcFile, 'utf8');
      const lines = script.split('\n');
      // Group multi-line functions and control structures into blocks so
      // their bodies are not executed line-by-line as separate commands.
      const blocks = await parseScriptBlocks(lines, rcFile);
      for (const block of blocks) {
        if (block.content && block.content.trim()) {
          await runLine(block.content, block);
        }
        if (block._heredocTmpFile) {
          try { fs.unlinkSync(block._heredocTmpFile); } catch (e) {}
        }
      }
      isLoadingRcFile = false;
      // Ensure readline is resumed and in a clean state after RC file
      if (!rl.terminal) {
        rl.resume();
      }
    } catch (e) {
      console.error('Error loading .fgshrc:', e.message);
      isLoadingRcFile = false;
      if (!rl.terminal) {
        rl.resume();
      }
    }
  }
}



// Start
if (process.argv[2] === '-c' && process.argv[3]) {
  // command mode
  (async () => {
    try {
      await runLine(process.argv[3]);
    } catch (e) {
      console.error('Error:', e.message);
      SHELL.lastExitCode = 1;
    }
    await runExitTraps();
    process.exit(SHELL.lastExitCode);
  })();
} else if (process.argv[2]) {
  // script mode
  const scriptPath = path.resolve(SHELL.cwd, process.argv[2]);
  try {
    const script = fs.readFileSync(scriptPath, 'utf8');
    const lines = script.split('\n');
    
    // For script mode, remove the readline event handlers to prevent interference
    rl.removeAllListeners('line');
    rl.pause();
    
    // Execute script
    (async () => {
      try {
        const blocks = await parseScriptBlocks(lines, scriptPath);
        for (const block of blocks) {
          if (block.content && block.content.trim()) {
            await executeControlFlow(block.content, block);
          }
          // Clean up heredoc temp files
          if (block._heredocTmpFile) {
            try { fs.unlinkSync(block._heredocTmpFile); } catch (e) {}
          }
        }
      } catch (e) {
        console.error('Script error:', e.message);
        process.exit(1);
      }
      await runExitTraps();
      process.exit(SHELL.lastExitCode);
    })();
  } catch (e) {
    console.error('Error running script:', e.message);
    process.exit(1);
  }
} else {
  // interactive mode
  (async () => {
    try {
      loadHistory();
      // Only load RC file if stdin is a TTY (not piped input)
      if (process.stdin.isTTY) {
        await loadRcFile();
      }
      await new Promise(r => setTimeout(r, 50)); // Let output flush
      await prompt();
    } catch (e) {
      console.error('FATAL ERROR in interactive mode:', e.message);
      console.error(e.stack);
      process.exit(1);
    }
  })();
}
