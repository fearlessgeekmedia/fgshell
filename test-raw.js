const readline = require('readline');
const { spawnSync } = require('child_process');

process.stdin.setRawMode(true);
console.log('Raw mode ON. Press ctrl+z (should be ^Z).');

setTimeout(() => {
  console.log('Turning raw mode OFF.');
  process.stdin.setRawMode(false);
  console.log('Raw mode OFF. Press ctrl+z (should suspend).');
  
  setTimeout(() => {
    console.log('Exiting.');
    process.exit(0);
  }, 5000);
}, 5000);
