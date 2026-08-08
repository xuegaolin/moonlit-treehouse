const fs = require('fs');
const path = require('path');
const dir = process.argv[2] || 'images';
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.png')) continue;
  const b = fs.readFileSync(path.join(dir, f));
  const sig = b.slice(0, 8).toString('hex');
  const ok = sig === '89504e470d0a1a0a';
  // parse IHDR
  let dims = '';
  if (ok) {
    dims = b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) + ' bitDepth=' + b[24] + ' colorType=' + b[25];
  }
  console.log(f, b.length + 'B', ok ? 'PNG-OK' : 'BAD-SIG(' + sig + ')', dims);
}
