const fs = require('fs');
const path = require('path');

async function test() {
  const file = 'test.png';
  if (!fs.existsSync(file)) {
    // Create a simple 1x1 red PNG for testing if not exists
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(file, buffer);
  }

  const data = fs.readFileSync(file);
  const base64 = data.toString('base64');
  const size = base64.length;
  const chunkSize = 4096;
  
  console.log('Sending image...');
  
  // Try sending as PNG (f=100)
  process.stdout.write('\x1b7'); // Save cursor
  
  let offset = 0;
  let isFirst = true;
  
  while (offset < size) {
    const chunk = base64.slice(offset, offset + chunkSize);
    offset += chunkSize;
    const m = offset < size ? 1 : 0;
    
    if (isFirst) {
      // f=100 for PNG
      process.stdout.write(`\x1b_Ga=T,t=d,f=100,m=${m},q=2;${chunk}\x1b\\`);
      isFirst = false;
    } else {
      process.stdout.write(`\x1b_Gm=${m};${chunk}\x1b\\`);
    }
  }
  
  process.stdout.write('\x1b8'); // Restore cursor
  console.log('\nDone.');
}

test();
