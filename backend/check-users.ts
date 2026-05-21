import mysql from 'mysql2/promise';
import { loadEnv } from './env.js';

loadEnv();

async function checkUsers() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    const [rows] = await conn.execute('SELECT id, username, email, role, is_active FROM users');
    console.log('👥 Users in database:');
    (rows as any[]).forEach((u) => {
      console.log(
        `  ID: ${u.id}, Username: ${u.username}, Email: ${u.email}, Role: ${u.role}, Active: ${u.is_active}`
      );
    });
  } finally {
    await conn.end();
  }
}

checkUsers();
