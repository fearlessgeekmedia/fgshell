#!/usr/bin/env bun
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
 * - Basic job control and signal forwarding (SIGINT only after removal of SIGTSTP)
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
  ptctl = require('./ptctl.node');
} catch (e) {
  ptctl = { available: false };
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

  Examples:
  env                  # print all variables
  env PATH=/bin        # print current environment with modified PATH
  env -i TERM=xterm    # clear environment and set only TERM
  `,
  jobs: `jobs [-lnprs] [JOBSPEC ...]
  Display the status of background jobs.

  Options:
  -l     list job IDs with process group IDs
  -n     show only changed jobs
  -p     list only process group IDs
  -r     show only running jobs
  -s     show only stopped jobs

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
  history: `history [-c] [-w] [-r] [FILENAME] or history [-n] [COUNT]
  Display the command history.

  With no options, displays the entire history with line numbers.

  Options:
  -c     clear the history list
  -w     write history to FILENAME (or ~/.bash_history)
  -r     read history from FILENAME (or ~/.bash_history)
  -n N   display the last N commands

  Exit status:
  Returns 0 unless an invalid option is supplied or file cannot be accessed.
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

// Helper to clear the current readline prompt line and output text properly
function writeOutput(text) {
  if (rl.terminal) {
    // Clear the current prompt line
    process.stdout.write('\x1b[2K\r');
  }
  process.stdout.write(text);
  if (!text.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

// Shell arrays storage
const SHELL_ARRAYS = {};

let builtins;
try {
  builtins = {
  echo: function(args) {
    if (args.includes('--help')) {
      console.log(help.echo);
      return 0;
    }
    let interpretEscapes = false;
    let startIdx = 1;
    
    // Check for -e flag
    if (args[1] === '-e') {
      interpretEscapes = true;
      startIdx = 2;
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
    
    writeOutput(output);
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
  exit: function(args) {
    if (args.includes('--help')) {
      console.log(help.exit);
      return 0;
    }
    const code = args[1] ? Number(args[1]) || 0 : 0;
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
    job.status = 'running';

    // If job was started with pty, re-attach it
    if (job.pty) {
      rl.pause();
      process.stdin.setRawMode(true);
      
      const ptyInputHandler = (data) => job.pty.write(data.toString());
      process.stdin.on('data', ptyInputHandler);

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
      
      // After job is done, resume shell
      if (rl.paused) {
        rl.resume();
        prompt().catch(() => {});
      }
    } else {
      // For non-pty jobs (background tasks), just bring them to foreground and wait
      try {
        for (const pid of job.pids) {
          process.kill(pid, 'SIGCONT');
        }
      } catch(e) {
        console.error('fg:', e.message);
        return 1;
      }
      await waitForJob(job);
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
    
    writeOutput(output);
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
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (line.trim() && !line.trim().startsWith('#')) {
          await runLine(line);
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
      // Try to evaluate as expression first, fall back to statement
      const fn = new Function(
        ...contextKeys,
        `return (async () => { return ${code} })()`
      );
      
      let result;
      try {
        result = await fn(...contextValues);
      } catch (e) {
        // If it fails (e.g., statements), try without the return
        const fn2 = new Function(
          ...contextKeys,
          `return (async () => { ${code} })()`
        );
        result = await fn2(...contextValues);
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
let filePickerState = null; // { files, selectedIndex, maxVisible }
let filePickerResolve = null; // Promise resolver for file picker
let commandStartTime = 0; // Track when command started for duration calculation

// Shell process group control (for job control with Ctrl+Z)
let shellPgid = process.pid;
if (ptctl.available) {
  try {
    // Make shell its own process group leader (pgid = 0 means use own PID)
    ptctl.setpgid(0, 0);
    shellPgid = ptctl.getpgrp();
  } catch (e) {
    debug('Failed to set shell process group:', e.message);
    shellPgid = process.pid;
  }
}

// Check if we're running as a login shell (stdin/stdout are TTY)
const isLoginShell = process.stdin.isTTY && process.stdout.isTTY;

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '',
  completer: completer,
  terminal: isLoginShell && (!process.argv[2] || process.argv[2] === '-c'),  // Only terminal mode in interactive TTY
  historySize: 1000,
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

const originalTtyWrite = rl._ttyWrite.bind(rl);

rl._ttyWrite = function(s, key) {
  if (isFilePickerActive) {
    // When picker is active, suppress echo but still allow keypress events
    return;
  }
  return originalTtyWrite(s, key);
};

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

function completer(line) {
  // simple completion: complete filenames in cwd or after space complete nothing fancy.
  try {
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1];
    const dir = path.dirname(last || '.');
    const base = path.basename(last || '');
    const list = fs.readdirSync(path.resolve(SHELL.cwd, dir === '.' ? '' : dir));
    const hits = list.filter(f => f.startsWith(base)).map(f => (dir === '.' ? f : path.join(dir, f)));
    return [hits.length ? hits : list, last];
  } catch (e) {
    return [[], line];
  }
}

// ---------------------- Parsing ----------------------
function tokenize(input) {
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
      if (ch === "'") state = 'normal';
      else cur += ch;
    } else if (state === 'double') {
      if (ch === '"') state = 'normal';
      else if (ch === '$') {
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
      state = 'single';
    } else if (ch === '"') {
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
  str = str.replace(/\$\(\(([^)]+)\)\)/g, (_, expr) => {
    try {
      // Replace variable references with their values
      const expandedExpr = expr.replace(/([A-Za-z_]\w*)/g, (match) => {
        return (match in SHELL.env) ? SHELL.env[match] : '0';
      });
      // Evaluate the expression
      const result = Function('"use strict"; return (' + expandedExpr + ')')();
      return result.toString();
    } catch (e) {
      return '0';
    }
  });
  
  // handle ${VAR} and $VAR, including array access ${ARR[i]}, ${ARR[@]}, etc.
  return str.replace(/\$(\w+(?:\[[^\]]*\])?|\{([^}]+)\})/g, (match, a, b) => {
    // If 'b' is set, we matched ${...}, so use b (which is the content inside braces)
    // If 'b' is not set, we matched $VAR, so use a
    const expr = b !== undefined ? b : a;
    
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
  // Find all $(...) patterns
  const regex = /\$\(([^)]+)\)/g;
  let result = str;
  let match;
  
  const matches = [];
  while ((match = regex.exec(str)) !== null) {
    matches.push({ full: match[0], cmd: match[1], index: match.index });
  }
  
  // Execute each command and replace from right to left to preserve indices
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

// ---------------------- Execution ----------------------
async function runLine(line) {
  line = line.trim();
  if (!line) {
    return;
  }
  
  const isBuiltinCommand = !line.startsWith('history') && !line.startsWith('exit');
  if (isBuiltinCommand) {
    SHELL.history.push(line);
    if (rl.history) {
      rl.history.push(line);
    }
  }
  
  commandStartTime = Date.now();
  
  // Parse line for control flow structures and execute
  await executeControlFlow(line);
  
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

// Execute control flow (handles if, while, for, &&, ||, case, etc.)
async function executeControlFlow(line) {
  const trimmed = line.trim();
  
  // Check for multi-line control structures first
  if (trimmed.startsWith('if ')) {
    await executeIf(line);
    return;
  } else if (trimmed.startsWith('while ')) {
    await executeWhile(line);
    return;
  } else if (trimmed.startsWith('for ')) {
    await executeFor(line);
    return;
  } else if (trimmed.startsWith('case ')) {
    await executeCase(line);
    return;
  } else if (trimmed.startsWith('function ') || trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/)) {
    await defineFunctionLine(line);
    return;
  }
  
  // Handle && and || operators at top level
  const logicalChain = parseLogicalChain(line);
  if (logicalChain.length > 1) {
    for (let i = 0; i < logicalChain.length; i++) {
      const { command, operator } = logicalChain[i];
      // Recursively call executeControlFlow to handle nested control structures
      await executeControlFlow(command);
      
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

  // Handle ; sequences (but only for non-control-structure lines)
  const sequences = splitTopLevel(line, ';');
  for (const seq of sequences) {
    const seqTrimmed = seq.trim();
    if (!seqTrimmed) continue;
    
    if (seqTrimmed === '{' || seqTrimmed === '}') {
      // Skip braces (handled in block parsing)
      continue;
    } else {
      await runSingle(seqTrimmed);
    }
  }
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

// Execute if statement
async function executeIf(line) {
  const ifMatch = line.match(/^if\s+(.*?)\s*[;]?\s*then\s*([\s\S]*)/i);
  if (!ifMatch) {
    console.error('if: syntax error');
    SHELL.lastExitCode = 1;
    return;
  }
  
  const condition = ifMatch[1].trim();
  const rest = ifMatch[2];
  
  let thenBody = '';
  let elseBody = '';
  let inElse = false;
  
  // Parse then/else/fi
  const lines = rest.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === 'fi') break;
    if (l === 'else' || l === 'elif') {
      inElse = true;
      continue;
    }
    if (inElse) elseBody += lines[i] + '\n';
    else thenBody += lines[i] + '\n';
  }
  
  // Evaluate condition
  await runSingle(condition);
  
  if (SHELL.lastExitCode === 0) {
    const statements = thenBody.split('\n').filter(l => l.trim());
    for (const stmt of statements) {
      await executeControlFlow(stmt);
    }
  } else if (elseBody.trim()) {
    const statements = elseBody.split('\n').filter(l => l.trim());
    for (const stmt of statements) {
      await executeControlFlow(stmt);
    }
  }
}

// Execute while loop
async function executeWhile(line) {
  const whileMatch = line.match(/^while\s+(.*?)\s*[;]?\s*do\s*([\s\S]*)/i);
  if (!whileMatch) {
    console.error('while: syntax error');
    SHELL.lastExitCode = 1;
    return;
  }
  
  const condition = whileMatch[1].trim();
  const rest = whileMatch[2];
  
  let body = '';
  const lines = rest.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === 'done') break;
    body += lines[i] + '\n';
  }
  
  // Execute loop
  while (true) {
    await runSingle(condition);
    if (SHELL.lastExitCode !== 0) break;
    
    const statements = body.split('\n').filter(l => l.trim());
    for (const stmt of statements) {
      await executeControlFlow(stmt);
    }
  }
}

// Execute for loop (for var in list or for ((init; cond; incr)))
async function executeFor(line) {
  // C-style for loop: for ((i=0; i<10; i++))
  const cStyleMatch = line.match(/^for\s*\(\s*(.+?);(.+?);(.+?)\s*\)\s*do\s*([\s\S]*)/i);
  if (cStyleMatch) {
    const [, init, cond, incr, rest] = cStyleMatch;
    
    // Execute init
    await runSingle(init.trim());
    
    let body = '';
    const lines = rest.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l === 'done') break;
      body += lines[i] + '\n';
    }
    
    // Execute loop
    while (true) {
      // Evaluate condition
      await runSingle(`[ ${cond.trim()} ]`);
      if (SHELL.lastExitCode !== 0) break;
      
      const statements = body.split('\n').filter(l => l.trim());
      for (const stmt of statements) {
        await executeControlFlow(stmt);
      }
      
      // Execute increment
      await runSingle(incr.trim());
    }
    return;
  }
  
  // Traditional for-in loop: for var in list
  const forMatch = line.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.*?)\s*[;]?\s*do\s*([\s\S]*)/i);
  if (!forMatch) {
    console.error('for: syntax error');
    SHELL.lastExitCode = 1;
    return;
  }
  
  const varName = forMatch[1];
  const listExpr = forMatch[2].trim();
  const rest = forMatch[3];
  
  let body = '';
  const lines = rest.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === 'done') break;
    body += lines[i] + '\n';
  }
  
  // Expand list expression (can be array, glob, or variable)
  let items = [];
  
  // If it looks like an array variable
  if (listExpr.startsWith('$')) {
    const varVal = expandVars(listExpr);
    items = varVal.split(/\s+/);
  } else if (listExpr.includes('*') || listExpr.includes('?')) {
    // Glob expansion
    items = glob.sync(listExpr, { cwd: SHELL.cwd });
  } else {
    // Treat as space-separated list
    items = listExpr.trim().split(/\s+/);
  }
  
  // Execute loop
  for (const item of items) {
    SHELL.env[varName] = item;
    
    const statements = body.split('\n').filter(l => l.trim());
    for (const stmt of statements) {
      await executeControlFlow(stmt);
    }
  }
  
  SHELL.lastExitCode = 0;
}

// Execute case statement
async function executeCase(line) {
  const caseMatch = line.match(/^case\s+(.+?)\s+in\s*([\s\S]*?)esac/i);
  if (!caseMatch) {
    console.error('case: syntax error');
    SHELL.lastExitCode = 1;
    return;
  }
  
  // Evaluate the expression to remove quotes
  let exprStr = caseMatch[1].trim();
  if ((exprStr.startsWith('"') && exprStr.endsWith('"')) ||
      (exprStr.startsWith("'") && exprStr.endsWith("'"))) {
    exprStr = exprStr.slice(1, -1);
  }
  const expr = exprStr;
  const cases = caseMatch[2];
  
  // Parse case patterns
  const patterns = [];
  let current = '';
  for (const line of cases.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.endsWith(')')) {
      // This is a pattern line
      const pattern = trimmed.slice(0, -1);
      patterns.push({ pattern, body: '' });
      current = patterns.length - 1;
    } else if (trimmed === ';;') {
      current = -1;
    } else if (current >= 0) {
      patterns[current].body += line + '\n';
    }
  }
  
  // Match and execute
  for (const p of patterns) {
    if (matchPattern(expr, p.pattern)) {
      const statements = p.body.split('\n').filter(l => l.trim());
      for (const stmt of statements) {
        await executeControlFlow(stmt);
      }
      break;
    }
  }
  
  SHELL.lastExitCode = 0;
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
async function defineFunctionLine(line) {
  // Parse function definition: function name { ... } or name() { ... }
  const funcMatch = line.match(/^(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)\s*{/);
  if (!funcMatch) {
    console.error('function: syntax error');
    SHELL.lastExitCode = 1;
    return;
  }
  
  const funcName = funcMatch[1];
  
  // Find the closing brace (simple parsing)
  let depth = 1;
  let bodyStart = line.indexOf('{') + 1;
  let bodyEnd = bodyStart;
  
  for (let i = bodyStart; i < line.length; i++) {
    if (line[i] === '{') depth++;
    if (line[i] === '}') {
      depth--;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }
  
  const body = line.slice(bodyStart, bodyEnd).trim();
  
  // Store function
  SHELL_FUNCTIONS[funcName] = {
    name: funcName,
    body: body,
    params: [] // Shell functions don't have typed params
  };
  
  SHELL.lastExitCode = 0;
}

// Call a function
async function callFunction(funcName, args) {
  if (!(funcName in SHELL_FUNCTIONS)) {
    return null; // Not a function
  }
  
  const func = SHELL_FUNCTIONS[funcName];
  
  // Set up positional parameters ($1, $2, ...)
  const savedParams = {};
  for (let i = 1; i <= 9; i++) {
    savedParams[`${i}`] = SHELL.env[i];
  }
  
  // Set new parameters
  for (let i = 0; i < args.length; i++) {
    SHELL.env[`${i + 1}`] = args[i];
  }
  
  // Execute function body
  await executeControlFlow(func.body);
  
  // Restore parameters
  for (let i = 1; i <= 9; i++) {
    if (savedParams[`${i}`] !== undefined) {
      SHELL.env[`${i}`] = savedParams[`${i}`];
    } else {
      delete SHELL.env[`${i}`];
    }
  }
  
  return SHELL.lastExitCode;
}

// Parse and execute here-documents
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
      return {
        delimiter,
        content,
        endIdx: i
      };
    }
    content += currentLine + '\n';
    i++;
  }
  
  return null;
}

// Execute subshell command (handles ( ) syntax)
async function executeSubshell(cmd) {
  // Simple subshell execution - for now, just execute in current context
  // Proper subshell would need to fork and have isolated state
  const savedEnv = { ...SHELL.env };
  const savedCwd = SHELL.cwd;
  
  try {
    await executeControlFlow(cmd);
  } finally {
    // Restore environment (subshell isolation)
    SHELL.env = savedEnv;
    SHELL.cwd = savedCwd;
  }
}

async function runSingle(line) {
  try {
    // Check for array assignment (arr=(values))
    const arrayMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\((.*)\)$/);
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
    
    let tokens = tokenize(line);
    if (tokens.length === 0) return;
    
    // Check if first token is a user-defined function
    if (tokens[0] in SHELL_FUNCTIONS) {
      const funcName = tokens[0];
      const funcArgs = tokens.slice(1);
      const code = await callFunction(funcName, funcArgs);
      if (code !== null) {
        SHELL.lastExitCode = code;
        return;
      }
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

async function executePipeline(cmds) {
  const n = cmds.length;
  const procs = [];
  let pids = [];

  for (let i = 0; i < n; i++) {
    const c = cmds[i];
    const argv = c.args.map(a => a);
    if (argv.length === 0) continue;

    const command = argv[0];
    const args = argv.slice(1);

    const isInteractive = !c.stdin && !c.stdout && !c.background && n === 1 && !isLoadingRcFile;

    let child;
    
    // Check if this is a builtin command (before trying to resolve as executable)
    if (typeof builtins === 'object' && command in builtins && typeof builtins[command] === 'function') {
      const res = builtins[command]([command, ...args]);
      if (typeof res === 'number') SHELL.lastExitCode = res;
      else if (res && typeof res.then === 'function') {
        const code = await res;
        SHELL.lastExitCode = code || 0;
      }
      continue;
    }
    
    if (isInteractive) {
      // Check if executable exists first
      const exe = resolveExecutable(command);
      if (!exe) {
        console.error(`${command}: command not found`);
        SHELL.lastExitCode = 127;
        return;
      }
      
      // *** FIX FOR BLANK SCREEN ISSUE WITH TUI APPS LIKE NEOVIM ***
      
      // 1. Pause readline to yield control of the TTY
      rl.pause();
      
      debug(`Shell PGID: ${shellPgid}, spawning: ${command}`);
      
      // 2. Spawn child with inherited stdio and in a new process group
      // TUI apps require 'inherit' to take full control of the terminal
      // (including raw mode and alternate screen buffer).
      // Use 'detached: true' to create a new process group for the child
      // HOWEVER: sudo needs to stay attached to the TTY to read passwords from /dev/tty
      let childProcess;
      let actualExe = exe;
      let actualArgs = args;
      
      // Check if this is a script that needs an interpreter
      const scriptExecutor = getScriptExecutor(exe);
      if (scriptExecutor) {
        actualExe = scriptExecutor.interpreter;
        actualArgs = [...scriptExecutor.args, ...args];
      }
      
      try {
        childProcess = spawn(actualExe, actualArgs, {
          cwd: getAccessibleCwd(),
          env: SHELL.env,
          stdio: 'inherit', // *** CHANGED: Revert to 'inherit' for full TTY support ***
          detached: command !== 'sudo',   // *** Don't detach sudo - it needs /dev/tty access ***
        });
      } catch (spawnErr) {
        // Resume readline if spawn fails
        rl.resume();
        console.error(`Error executing ${command}: ${spawnErr.message}`);
        SHELL.lastExitCode = 127;
        return;
      }

      debug(`Child spawned PID: ${childProcess.pid}`);

      // REMOVED: Manual raw mode setting and keypress handler that broke TUI apps.
      
      // 3. Set up proper job control if ptctl is available and process is detached
      //    This allows Ctrl+Z to properly suspend the child without corrupting terminal state
      //    (Note: sudo is not detached so it can access /dev/tty for password prompts)
      if (ptctl.available && command !== 'sudo') {
        try {
          // Get the child's actual process group (created by detached: true)
          const childPgid = ptctl.getpgid(childProcess.pid);
          debug(`Child process group: ${childPgid}`);
          
          // Give terminal control to the child process group
          ptctl.tcsetpgrp(1, childPgid); // fd 1 = stdout
          const termFgpg = ptctl.tcgetpgrp(1);
          debug(`Terminal foreground process group: ${termFgpg}`);
        } catch (e) {
          debug('ptctl job control setup error:', e.message);
          // Continue anyway - TTY will still work without proper job control
        }
      }
      
      // Register job before waiting
      const cmdline = args.length ? [command, ...args].join(' ') : command;
      const job = addJob([childProcess.pid], cmdline, false);
      pids.push(childProcess.pid);

      // Wait for process to exit
      await new Promise((resolve) => {
        childProcess.on('exit', (code, signal) => {
          debug(`Child exited with code ${code}, signal ${signal}`);
          SHELL.lastExitCode = code || 0;
          
          const job = findJobByPid(childProcess.pid);
          if (job) {
            markJobDone(job);
          }
          
          // 4. Restore terminal control to the shell if ptctl is available and we transferred it
          if (ptctl.available && command !== 'sudo') {
            try {
              debug(`Restoring terminal to shell PGID: ${shellPgid}`);
              ptctl.tcsetpgrp(1, shellPgid); // Restore shell's process group to terminal
              const termFgpg = ptctl.tcgetpgrp(1);
              debug(`Terminal foreground process group after restore: ${termFgpg}`);
            } catch (e) {
              debug('ptctl restore error:', e.message);
            }
          }
          
          // 5. Resume readline after process exits
          if (rl.paused) {
            debug('Resuming readline');
            rl.resume();
            rl.line = '';
            rl.cursor = 0;
          }
          
          resolve();
        });

        childProcess.on('error', (err) => {
          console.error(`Error executing ${command}:`, err.message);
          SHELL.lastExitCode = 1;
          
          const job = findJobByPid(childProcess.pid);
          if (job) {
            markJobDone(job);
          }
          
          if (rl.paused) {
            rl.resume();
          }
          
          resolve();
        });
      });
      
      await prompt();
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
        return;
      }
      
      try {
        child = spawn(exe, args, options);
      } catch (spawnErr) {
        console.error(`Error executing ${command}: ${spawnErr.message}`);
        SHELL.lastExitCode = 127;
        if (isSingleCommand && rl.paused) {
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
    
    procs.push(child);
    pids.push(child.pid);

    // handle piping for regular child_process.spawn (skip if stdio is inherited)
    const stdioIsInherited = child._cmdOptions && (child._cmdOptions.stdio === 'inherit' || (Array.isArray(child._cmdOptions.stdio) && child._cmdOptions.stdio[1] === 'inherit'));
    if (!isInteractive && child._cmdOptions && !stdioIsInherited) {
      try {
        if (i > 0) {
          const prev = procs[i-1];
          if (prev.stdout && child.stdin) {
            prev.stdout.pipe(child.stdin);
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
      // Resume readline for single commands
      if (child._resumeRl && rl.paused) {
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

// reap children to update job table even if not foreground
process.on('exit', () => {
  historyDB.closeDB();
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

// Helper to get preview text for a file (text or fallback)
async function getFilePreview(filePath, maxLines = 20) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      return '[Directory]';
    }
    
    const sizeStr = (stat.size / 1024).toFixed(1) + ' KB';
    
    // Skip preview for very large files
    if (stat.size > 50000) {
      return '[File: ' + sizeStr + ']';
    }
    
    // Skip known binary file extensions
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = ['.db', '.sqlite', '.sqlite3', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.exe', '.bin', '.so', '.dylib', '.o', '.a', '.node'];
    if (binaryExts.includes(ext)) {
      return '[Binary: ' + sizeStr + ']';
    }
    
    // Skip files that look like databases or binary
    const baseName = path.basename(filePath);
    if (baseName.startsWith('.') && baseName.includes('history')) {
      return '[Database: ' + sizeStr + ']';
    }
    
    // Try to read as text
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      
      // Check if content looks binary (contains null bytes or control chars)
      if (content.indexOf('\0') !== -1 || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 1000))) {
        return '[Binary: ' + sizeStr + ']';
      }
      
      // It's text, show preview - strip any remaining escape sequences
      const lines = content.split('\n').slice(0, maxLines);
      return lines.map(l => l.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')).join('\n');
    } catch (readErr) {
      // Failed to read as text, likely binary
      return '[Binary: ' + sizeStr + ']';
    }
  } catch (e) {
    return '[Cannot read file]';
  }
}

function renderFilePickerOverlay() {
  if (!isFilePickerActive || !filePickerState) return;

  const { files, selectedIndex, maxVisible, filterMode, filterQuery } = filePickerState;
  const displayFiles = files;
  const terminalCols = process.stdout.columns || 80;

  // Clear previous overlay by moving cursor up and deleting lines
  if (!filePickerState.firstRender && filePickerState.lastLineCount > 0) {
    // Move up N lines and clear each
    for (let i = 0; i < filePickerState.lastLineCount; i++) {
      process.stdout.write('\x1b[A'); // Move cursor up
      process.stdout.write('\x1b[K'); // Clear line
    }
  } else if (filePickerState.firstRender) {
    filePickerState.firstRender = false;
  }

  // Build output
  let output = '';
  let lineCount = 0;

  const modeIndicator = filterMode ? ' [FILTER MODE]' : '';
  output += `\x1b[1mSelect file from ${SHELL.cwd}\x1b[0m${modeIndicator}\n`;
  lineCount++;
  
  output += `(Ctrl+F: filter, arrows: navigate, Enter: select, Esc: cancel)\n`;
  lineCount++;
  
  if (filterMode) {
    output += `Filter: ${filterQuery}\n`;
    lineCount++;
  }
  
  output += '-'.repeat(Math.min(80, terminalCols)) + '\n';
  lineCount++;

  const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), displayFiles.length - maxVisible));
  const endIdx = Math.min(startIdx + maxVisible, displayFiles.length);

  if (displayFiles.length === 0) {
    output += '(no files)\n';
    lineCount++;
  } else {
    for (let i = startIdx; i < endIdx; i++) {
      const item = displayFiles[i];
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? '> ' : '  ';
      const icon = item.isDirectory ? '[D] ' : '[F] ';
      let line = `${prefix}${icon} ${item.name}`;

      if (line.length > terminalCols) {
        line = line.slice(0, terminalCols - 1) + '...';
      }
      if (isSelected) {
        line = `\x1b[7m${line}\x1b[0m`;
      }
      output += line + '\n';
      lineCount++;
    }
  }

  // Write all at once and track line count
  process.stdout.write(output);
  filePickerState.lastLineCount = lineCount;
}

function clearFilePickerOverlay() {
  // Use a safe upper bound for the number of lines to clear. 
  // The terminal height (or a safe default like 25) is a good upper bound.
  const MAX_LINES_TO_CLEAR = process.stdout.rows || 25; 

  process.stdout.write('\x1b7'); // 1. Save cursor (current prompt position)
  
  // 2. Move to the start of the line *below* the prompt (where the overlay starts)
  process.stdout.write('\r\n'); 
  
  // 3. Explicitly delete the maximum possible number of lines, removing the overlay content
  process.stdout.write(`\x1b[${MAX_LINES_TO_CLEAR}M`); 
  
  process.stdout.write('\x1b8'); // 4. Restore cursor (back to the prompt position)
}

function handleFilePickerKey(str, key) {
  if (!filePickerState) return;
  const { files } = filePickerState;

  // Handle filter mode
  if (filePickerState.filterMode) {
    if (key.name === 'escape') {
      filePickerState.filterMode = false;
      filePickerState.filterQuery = '';
      filePickerState.files = [...filePickerState.allFiles];
      filePickerState.selectedIndex = 0;
      renderFilePickerOverlay();
      return;
    }
    
    if (key.name === 'backspace') {
      if (filePickerState.filterQuery.length > 0) {
        filePickerState.filterQuery = filePickerState.filterQuery.slice(0, -1);
      }
      // Refilter with updated query using fuzzy search with fallback
      if (filePickerState.filterQuery.length > 0) {
        const Fuse = require('fuse.js');
        const fuse = new Fuse(filePickerState.allFiles, {
          keys: ['name'],
          threshold: 0.3,
        });
        let results = fuse.search(filePickerState.filterQuery).map(r => r.item);
        
        // Fallback to substring match if fuzzy search finds nothing
        if (results.length === 0) {
          const lowerQuery = filePickerState.filterQuery.toLowerCase();
          results = filePickerState.allFiles.filter(f => 
            f.name.toLowerCase().includes(lowerQuery)
          );
        }
        filePickerState.files = results;
      } else {
        filePickerState.files = [...filePickerState.allFiles];
      }
      filePickerState.selectedIndex = 0;
      renderFilePickerOverlay();
      return;
    }
    
    if (key.name === 'return') {
      const selected = filePickerState.files[filePickerState.selectedIndex];
      if (!selected) return;
      if (selected.isDirectory) {
        SHELL.cwd = path.resolve(SHELL.cwd, selected.name);
        readDirAsync(SHELL.cwd).then(newFiles => {
          filePickerState.files = newFiles;
          filePickerState.allFiles = newFiles;
          filePickerState.filterQuery = '';
          filePickerState.filterMode = false;
          filePickerState.selectedIndex = 0;
          renderFilePickerOverlay();
        });
      } else {
        if (filePickerResolve) filePickerResolve(selected.name);
      }
      return;
    }
    
    // Handle regular character input in filter mode
    if (str) {
      filePickerState.filterQuery += str;
      // Fuzzy search using Fuse.js with fallback to substring match
      if (filePickerState.filterQuery.length > 0) {
        const Fuse = require('fuse.js');
        const fuse = new Fuse(filePickerState.allFiles, {
          keys: ['name'],
          threshold: 0.3,
        });
        let results = fuse.search(filePickerState.filterQuery).map(r => r.item);
        
        // Fallback to substring match if fuzzy search finds nothing
        if (results.length === 0) {
          const lowerQuery = filePickerState.filterQuery.toLowerCase();
          results = filePickerState.allFiles.filter(f => 
            f.name.toLowerCase().includes(lowerQuery)
          );
        }
        filePickerState.files = results;
      } else {
        filePickerState.files = [...filePickerState.allFiles];
      }
      filePickerState.selectedIndex = 0;
      renderFilePickerOverlay();
      return;
    }
    
    if (key && (key.name === 'up' || key.name === 'down')) {
      if (key.name === 'up') {
        filePickerState.selectedIndex = Math.max(0, filePickerState.selectedIndex - 1);
      } else {
        filePickerState.selectedIndex = Math.min(files.length - 1, filePickerState.selectedIndex + 1);
      }
      renderFilePickerOverlay();
      return;
    }
    return;
  }

  // Normal mode
  if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
    if (filePickerResolve) filePickerResolve(null);
    return;
  }
  
  if (key.ctrl && key.name === 'f') {
    filePickerState.filterMode = true;
    filePickerState.filterQuery = '';
    filePickerState.allFiles = [...files];
    renderFilePickerOverlay();
    return;
  }

  if (key.name === 'up') {
    filePickerState.selectedIndex = Math.max(0, filePickerState.selectedIndex - 1);
    renderFilePickerOverlay();
  } else if (key.name === 'down') {
    filePickerState.selectedIndex = Math.min(filePickerState.files.length - 1, filePickerState.selectedIndex + 1);
    renderFilePickerOverlay();
  } else if (key.name === 'left') {
    const parentDir = path.dirname(SHELL.cwd);
    if (parentDir !== SHELL.cwd) {
      SHELL.cwd = parentDir;
      readDirAsync(SHELL.cwd).then(newFiles => {
        filePickerState.files = newFiles;
        filePickerState.allFiles = newFiles;
        filePickerState.selectedIndex = 0;
        renderFilePickerOverlay();
      });
    }
  } else if (key.name === 'right' || key.name === 'return') {
    const selected = filePickerState.files[filePickerState.selectedIndex];
    if (!selected) return;
    if (selected.isDirectory) {
      SHELL.cwd = path.resolve(SHELL.cwd, selected.name);
      readDirAsync(SHELL.cwd).then(newFiles => {
        filePickerState.files = newFiles;
        filePickerState.allFiles = newFiles;
        filePickerState.filterQuery = '';
        filePickerState.selectedIndex = 0;
        renderFilePickerOverlay();
      });
    } else {
      if (filePickerResolve) filePickerResolve(selected.name);
    }
  }
}

async function showFilePicker() {
  if (isFilePickerActive || !process.stdin.isTTY) {
    return null;
  }
  isFilePickerActive = true;

  let files;
  try {
    files = await readDirAsync(SHELL.cwd);
  } catch (e) {
    isFilePickerActive = false;
    return null;
  }

  const terminalRows = process.stdout.rows || 24;
  const maxVisible = Math.min(Math.floor(terminalRows * 0.6), terminalRows - 5);

  filePickerState = {
    files,
    allFiles: files,
    selectedIndex: 0,
    maxVisible,
    filterMode: false,
    filterQuery: '',
    firstRender: true,
    lastLineCount: 0,
  };

  return new Promise((resolve) => {
    filePickerResolve = (result) => {
      isFilePickerActive = false;
      clearFilePickerOverlay(); // Clear before nulling state for maximum compatibility
      filePickerState = null;
      filePickerResolve = null;
      rl._refreshLine();
      resolve(result);
    };

    renderFilePickerOverlay();
  });
}

function showHistoryPicker() {
  return new Promise(async (resolve) => {
    if (isFilePickerActive || !process.stdin.isTTY) {
      return resolve(null);
    }
    isFilePickerActive = true;

    let allEntries = historyDB.getAll(500);
    let filteredEntries = [...allEntries];
    let searchQuery = '';

    let selectedIndex = 0;
    const terminalRows = process.stdout.rows || 24;
    const terminalCols = process.stdout.columns || 80;
    const maxVisible = Math.min(Math.floor(terminalRows * 0.8), terminalRows - 4);
    
    // Clear screen and hide cursor
    process.stdout.write('\x1b[2J\x1b[H');
    process.stdout.write('\x1b[?25l');

    async function renderPicker() {
      // Clear screen and reset cursor
      process.stdout.write('\x1b[2J\x1b[H');
      process.stdout.write(`\x1b[1mHistory Search (Ctrl+F to search, Ctrl+C to cancel)\x1b[0m\n`);
      process.stdout.write(`Filter: ${searchQuery}\n`);
      process.stdout.write('-'.repeat(Math.min(80, terminalCols)) + '\n');
      
      const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), filteredEntries.length - maxVisible));
      const endIdx = Math.min(startIdx + maxVisible, filteredEntries.length);

      // Render history list
      for (let i = startIdx; i < endIdx; i++) {
        const entry = filteredEntries[i];
        const isSelected = i === selectedIndex;
        const prefix = isSelected ? '> ' : '  ';
        const timestamp = new Date(entry.timestamp * 1000).toLocaleString();
        const exitCode = entry.exit_code !== null ? ` [${entry.exit_code}]` : '';
        let cmd = entry.command;
        
        // Truncate command to fit in terminal
        const maxCmdLength = Math.max(20, terminalCols - 40);
        if (cmd.length > maxCmdLength) {
          cmd = cmd.slice(0, maxCmdLength - 3) + '...';
        }
        
        let line = `${prefix}${timestamp}${exitCode}  ${cmd}`;
        
        // Ensure we don't exceed terminal width
        if (line.length > terminalCols) {
          line = line.slice(0, terminalCols);
        }
        
        // Apply highlight if selected
        if (isSelected) {
          line = `\x1b[7m${line}\x1b[0m`;
        }
        
        process.stdout.write(line + '\n');
      }
      
      if (filteredEntries.length === 0) {
        process.stdout.write('(no commands found)\n');
      }
    }

    await renderPicker();
    
    let pickerDone = false;
    const keypressHandler = (str, key) => {
      if (pickerDone) return;

      const finalize = (result) => {
        pickerDone = true;
        process.stdin.removeAllListeners('keypress');
        process.stdout.write('\x1b[?25h'); // Show cursor
        isFilePickerActive = false;
        resolve(result);
      }

      if (key && (key.name === 'escape' || (key.ctrl && key.name === 'c'))) {
        finalize(null);
      } else if (key && key.ctrl && key.name === 'f') {
        // Ctrl+F to activate search - just position cursor in search field (already active)
        // This is more of a confirmation that search is active
        renderPicker().catch(() => {});
      } else if (key && key.name === 'up') {
        selectedIndex = Math.max(0, selectedIndex - 1);
        renderPicker().catch(() => {});
      } else if (key && key.name === 'down') {
        selectedIndex = Math.min(filteredEntries.length - 1, filteredEntries.length + 1);
        renderPicker().catch(() => {});
      } else if (key && key.name === 'return') {
        const selected = filteredEntries[selectedIndex];
        if (selected) {
          finalize(selected.command);
        }
      } else if (key && key.name === 'backspace') {
        if (searchQuery.length > 0) {
          searchQuery = searchQuery.slice(0, -1);
          // Re-filter based on search query
          if (searchQuery.length === 0) {
            filteredEntries = [...allEntries];
          } else {
            const Fuse = require('fuse.js');
            const fuse = new Fuse(allEntries, {
              keys: ['command'],
              threshold: 0.3,
            });
            filteredEntries = fuse.search(searchQuery).map(r => r.item);
          }
          selectedIndex = 0;
          renderPicker().catch(() => {});
        }
      } else if (str && str.match(/^[a-zA-Z0-9\-_./]$/)) {
        // Add printable characters to search
        searchQuery += str;
        // Re-filter based on search query
        const Fuse = require('fuse.js');
        const fuse = new Fuse(allEntries, {
          keys: ['command'],
          threshold: 0.3,
        });
        filteredEntries = fuse.search(searchQuery).map(r => r.item);
        selectedIndex = 0;
        renderPicker().catch(() => {});
      }
    };
    
    // Remove all keypress listeners temporarily
    const listeners = process.stdin.listeners('keypress');
    listeners.forEach(l => process.stdin.removeListener('keypress', l));
    
    // Add only our handler
    process.stdin.on('keypress', keypressHandler);
    
    // When done, restore original listeners
    const originalResolve = resolve;
    return new Promise((res) => {
      resolve = (result) => {
        // Restore original keypress listeners
        listeners.forEach(l => process.stdin.on('keypress', l));
        originalResolve(result);
        res(result);
      };
    });
  });
}

// Handle Ctrl+N for file picker and Ctrl+R for history picker
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', (str, key) => {
    // Route ALL input to file picker when active
    if (isFilePickerActive) {
      handleFilePickerKey(str, key);
      return;
    }

    if (key && key.ctrl && key.name === 'n') {
      // Prevent re-entrancy from multiple rapid key presses
      if (isFilePickerActive) return;
      (async () => {
        try {
          const selectedFile = await showFilePicker();
          
          if (selectedFile) {
            const line = rl.line;
            const cursor = rl.cursor;
            const needsSpace = line.length > 0 && !line.endsWith(' ');
            const insertText = (needsSpace ? ' ' : '') + selectedFile.replace(/ /g, '\\ ');
            
            const left = line.slice(0, cursor);
            const right = line.slice(cursor);
            
            rl.line = left + insertText + right;
            rl.cursor = left.length + insertText.length;
            rl._refreshLine();
          }
        } catch (e) {
          console.error('Picker error:', e);
        }
      })();
    } else if (key && key.ctrl && key.name === 'r') {
      // Prevent re-entrancy from multiple rapid key presses
      if (isFilePickerActive) return;

      const savedLine = rl.line;
      const savedCursor = rl.cursor;
      
      // Spawn history picker in a separate context
      (async () => {
        try {
          const selectedCommand = await showHistoryPicker();
          
          // After picker completes, replace the entire line with selected command
          rl.line = '';
          rl.cursor = 0;
          
          if (selectedCommand) {
            rl.line = selectedCommand;
            rl.cursor = selectedCommand.length;
          } else {
            // User cancelled, restore original line
            rl.line = savedLine;
            rl.cursor = savedCursor;
          }
          
          // Force redraw
          rl._refreshLine();
        } catch (e) {
          console.error('History picker error:', e);
        }
      })();
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
// (not running a script or -c command)
const isScriptMode = process.argv[2] && process.argv[2] !== '-c';
const isCommandMode = process.argv[2] === '-c' && process.argv[3];

if (!isScriptMode && !isCommandMode) {
  rl.on('line', async (line) => {
    rl.pause();
    await runLine(line);
    rl.resume();
    await prompt();
  });

  rl.on('SIGINT', () => {
    // handled above by process SIGINT; do nothing
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
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (line.trim() && !line.trim().startsWith('#')) {
          await runLine(line);
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
    await runLine(process.argv[3]);
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
    
    // Parse script into blocks (handles multi-line control structures)
    function parseScriptBlocks(lines) {
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
            trimmed.startsWith('for ') || trimmed.startsWith('case ')) {
          const block = collectBlock(lines, idx);
          blocks.push(block.content);
          idx = block.endIdx + 1;
        } else if (trimmed.startsWith('function ') || trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/)) {
          // Function definition block
          const block = collectBlock(lines, idx);
          blocks.push(block.content);
          idx = block.endIdx + 1;
        } else {
          // Single-line command
          blocks.push(line);
          idx++;
        }
      }
      
      return blocks;
    }
    
    // Collect a complete block (if/while/for/case/function)
    function collectBlock(lines, startIdx) {
      const firstLine = lines[startIdx].trim();
      let content = firstLine;
      let idx = startIdx + 1;
      let depth = 0;
      
      // Determine expected closing keyword
      let closeKeyword = null;
      if (firstLine.startsWith('if ')) closeKeyword = 'fi';
      else if (firstLine.startsWith('while ')) closeKeyword = 'done';
      else if (firstLine.startsWith('for ')) closeKeyword = 'done';
      else if (firstLine.startsWith('case ')) closeKeyword = 'esac';
      else if (firstLine.startsWith('function ') || firstLine.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/)) {
        // Function: collect until closing brace
        depth = 0;
        if (firstLine.includes('{')) depth = countBraces(firstLine);
      }
      
      // For functions, count braces
      if (depth !== null && (firstLine.startsWith('function ') || firstLine.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/))) {
        while (idx < lines.length && depth > 0) {
          content += '\n' + lines[idx];
          depth += countBraces(lines[idx]);
          idx++;
        }
      } else if (closeKeyword) {
        // For if/while/for/case, look for closing keyword
        while (idx < lines.length) {
          const line = lines[idx];
          const trimmed = line.trim();
          content += '\n' + line;
          
          if (trimmed === closeKeyword) {
            idx++;
            break;
          }
          idx++;
        }
      }
      
      return { content, endIdx: idx - 1 };
    }
    
    function countBraces(line) {
      let count = 0;
      for (const ch of line) {
        if (ch === '{') count++;
        if (ch === '}') count--;
      }
      return count;
    }
    
    // Execute script
    (async () => {
      try {
        const blocks = parseScriptBlocks(lines);
        for (const block of blocks) {
          if (block.trim()) {
            await executeControlFlow(block);
          }
        }
      } catch (e) {
        console.error('Script error:', e.message);
        process.exit(1);
      }
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
