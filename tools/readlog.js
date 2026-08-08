// 共享读模式读日志（文件被 Maven 独占时也能读）
const fs = require('fs');

const LOG = process.argv[2] || 'D:\\clawd_workspace\\boot5.log';const KEY = process.argv[3] || 'GlobalExceptionHandler';

const fd = fs.openSync(LOG, 'r');
const size = fs.fstatSync(fd).size;
const buf = Buffer.alloc(size);
fs.readSync(fd, buf, 0, size, 0);
fs.closeSync(fd);

const txt = buf.toString('utf8');
const idx = txt.lastIndexOf(KEY);
if (idx < 0) {
  console.log('key not found: ' + KEY + ' (log ' + size + ' bytes)');
  const errIdx = txt.lastIndexOf('ERROR');
  if (errIdx >= 0) console.log(txt.substr(errIdx, 1200));
} else {
  console.log(txt.substr(idx, 1800));
}
