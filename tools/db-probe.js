// tools/db-probe.js — 探测数据库状态，幂等可重复跑
const mysql = require('mysql2/promise')

async function main() {
  const c = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: 'root', database: 'treehouse'
  })
  try {
    const [tables] = await c.query("SHOW TABLES")
    console.log('所有表:', tables.map(r => Object.values(r)[0]).join(','))
    const [t] = await c.query("SHOW TABLES LIKE 't_letter_subscribe_log'")
    console.log('t_letter_subscribe_log 存在:', t.length > 0)
    if (t.length > 0) {
      const [cols] = await c.query('DESCRIBE t_letter_subscribe_log')
      console.log('字段:', cols.map(x => x.Field).join(','))
      const [idx] = await c.query('SHOW INDEX FROM t_letter_subscribe_log')
      console.log('索引:', idx.map(i => i.Key_name).join(','))
    }
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error('err:', e.message); process.exit(1) })
