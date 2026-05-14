import { loadEnv } from './env.js';
import mysql from 'mysql2/promise';

loadEnv();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[SET]' : '[EMPTY]');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);

async function test() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fingerprint_attendance',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
    console.log('✅ Connected successfully!');
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('Query result:', rows);
    await connection.end();
  } catch (error: any) {
    console.error('❌ Connection failed:', error.code, error.sqlMessage);
  }
}

test();
