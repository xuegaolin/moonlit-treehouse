// 清理所有测试种子数据（上线前 / 重置环境用）
// 匹配 openid 前缀：test_seed_ / test_filler_ / test_openid_
// 默认 dry-run，加 --confirm 才真删
const { execFileSync } = require('child_process');
process.env.MYSQL_PWD = 'root';

const CONFIRM = process.argv.indexOf('--confirm') > -1;

function sql(stmt) {
  return execFileSync('mysql',
    ['-uroot', '-D', 'treehouse', '--default-character-set=utf8mb4', '-e', stmt],
    { encoding: 'utf8' });
}

const LIKE = "(u.openid LIKE 'test_seed_%' OR u.openid LIKE 'test_filler_%' OR u.openid LIKE 'test_openid_%')";

console.log('=== 待清理统计 ===');
console.log(sql(
  "SELECT COUNT(*) AS test_users FROM t_user u WHERE " + LIKE + ";"
));
console.log(sql(
  "SELECT COUNT(*) AS test_bottles FROM t_bottle b JOIN t_user u ON u.id = b.user_id WHERE " + LIKE + ";"
));
console.log(sql(
  "SELECT COUNT(*) AS test_warms FROM t_bottle_warm w JOIN t_user u ON u.id = w.user_id WHERE " + LIKE + ";"
));

if (!CONFIRM) {
  console.log('');
  console.log('*** DRY RUN ***  未执行删除');
  console.log('确认后执行： node tools/clean-test-data.js --confirm');
  process.exit(0);
}

console.log('');
console.log('=== 执行删除（按外键顺序）===');

// 1. 温暖明细（测试用户温暖的 + 测试瓶子被温暖的）
sql("DELETE w FROM t_bottle_warm w JOIN t_user u ON u.id = w.user_id WHERE " + LIKE + ";");
sql("DELETE w FROM t_bottle_warm w JOIN t_bottle b ON b.id = w.bottle_id JOIN t_user u ON u.id = b.user_id WHERE " + LIKE + ";");
console.log('1. t_bottle_warm 已清');

// 2. 瓶子
sql("DELETE b FROM t_bottle b JOIN t_user u ON u.id = b.user_id WHERE " + LIKE + ";");
console.log('2. t_bottle 已清');

// 3. 其他模块的测试用户数据
['t_letter', 't_wish', 't_bailan_license', 't_tarot_reading', 't_coin_log', 't_mokugyo_log'].forEach(function (tb) {
  try {
    sql("DELETE x FROM " + tb + " x JOIN t_user u ON u.id = x.user_id WHERE " + LIKE + ";");
    console.log('3. ' + tb + ' 已清');
  } catch (e) {
    console.log('3. ' + tb + ' 跳过（' + String(e.stdout || e.message).split(String.fromCharCode(10))[0] + '）');
  }
});

// 4. 用户
sql("DELETE u FROM t_user u WHERE " + LIKE + ";");
console.log('4. t_user 已清');

console.log('');
console.log('=== 清理后剩余 ===');
console.log(sql("SELECT COUNT(*) AS users FROM t_user; SELECT COUNT(*) AS bottles FROM t_bottle; SELECT COUNT(*) AS warms FROM t_bottle_warm;"));
