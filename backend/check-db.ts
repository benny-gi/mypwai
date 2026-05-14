import { loadEnv } from './env.js';
import mysql from 'mysql2/promise';

loadEnv();

async function checkDB() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    console.log('✅ Database connected!\n');

    // 1. Show all tables
    const [tables] = await conn.execute('SHOW TABLES');
    const tableNames = (tables as any[]).map((t: any) => Object.values(t)[0]);
    console.log('📋 Tables:', tableNames.join(', '));

    // 2. Describe each table and get row count
    for (const tname of tableNames) {
      console.log(`\n🔍 ${tname}:`);
      const [cols] = await conn.execute(`DESCRIBE \`${tname}\``);
      (cols as any[]).forEach((c: any) => {
        let info = `  - ${c.Field} (${c.Type})`;
        if (c.Key) info += ` [${c.Key}]`;
        if (c.Extra) info += ` ${c.Extra}`;
        console.log(info);
      });
      const [count] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${tname}\``);
      console.log(`  => ${(count as any[])[0].cnt} rows`);
    }

    // 3. Check migration SQL schema file
    console.log('\n📄 Migration schema files:');
    const fs = await import('fs');
    const migrationFiles = fs.readdirSync('./migrations');
    migrationFiles.forEach((f: string) => console.log(`  - ${f}`));

  } finally {
    await conn.end();
  }
}

checkDB();
