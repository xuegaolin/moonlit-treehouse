// tools/apply-letter-subscribe-ddl.js
// 建表 V5__letter_subscribe_log.sql（幂等）
const mysql = require('mysql2/promise')
const fs = require('fs')

const SQL_PATH = 'D:/clawd_workspace/projects/moonlit-treehouse/backend/src/main/resources/db/V5__letter_subscribe_log.sql'\n\nasync function main() {\n  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'treehouse',
    multipleStatements: true
  })
  try {
    await conn.query(sql)
    console.log('V5 DDL 执行成功')
    const [rows] = await conn.query('SHOW TABLES LIKE "t_letter_subscribe_log"')
    console.log('表存在:', rows.length > 0)
    const [cols] = await conn.query('DESCRIBE t_letter_subscribe_log')
    console.log('字段数:', cols.length)
    console.log('字段:', cols.map(c => c.Field).join(','))
    const [idx] = await conn.query('SHOW INDEX FROM t_letter_subscribe_log')
    console.log('索引数:', idx.length)
    console.log('索引:', idx.map(i => i.Key_name).join(','))
  } finally {
    await conn.end()
  }
}

main().catch(e => { console.error('建表失败：', e.message); process.exit(1) })
