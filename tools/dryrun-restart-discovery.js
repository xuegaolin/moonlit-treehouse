// 干跑 restart-dev.js 的进程发现逻辑（只查不动）
// 目的：确认要杀的 pid 找得准，避免真执行时杀错或漏杀
const { execSync } = require('child_process');
const NL = String.fromCharCode(10);
const PORT = 8081;

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

function portPids(port) {
  const out = sh('netstat -ano -p TCP');
  const pids = [];
  out.split(NL).forEach(function (l) {
    if (l.indexOf(':' + port) < 0) return;
    if (l.indexOf('LISTENING') < 0) return;
    const parts = l.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pids.indexOf(pid) < 0) pids.push(pid);
  });
  return pids;
}

function mavenPids() {
  const Q = String.fromCharCode(39);
  const cmd = 'wmic process where "name=' + Q + 'java.exe' + Q + '" get ProcessId,CommandLine /format:csv';
  const out = sh(cmd);
  const pids = [];
  out.split(NL).forEach(function (l) {
    if (l.indexOf('moonlit-treehouse') < 0 && l.indexOf('plexus-classworlds') < 0) return;
    const parts = l.trim().split(',');
    const pid = parts[parts.length - 1];
    if (/^[0-9]+$/.test(pid) && pids.indexOf(pid) < 0) pids.push(pid);
  });
  return pids;
}

const a = portPids(PORT);
const b = mavenPids();
console.log('端口 ' + PORT + ' 监听 pid : ' + (a.join(', ') || '无'));
console.log('相关 java 进程 pid : ' + (b.join(', ') || '无'));

const all = [];
a.concat(b).forEach(function (p) { if (all.indexOf(p) < 0) all.push(p); });
console.log('将被 taskkill /T /F 的 pid : ' + (all.join(', ') || '无'));

console.log('');
console.log(all.length >= 2
  ? 'OK: 找到 maven 壳 + forked app，进程树覆盖完整'
  : (all.length === 1 ? '注意: 只找到 1 个，可能漏了 maven 壳' : '注意: 未找到进程'));
