import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { loadEnv } from './env.js';

loadEnv();

async function testLogin() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    const [rows] = await conn.execute(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = ?',
      ['admin@school.edu']
    );

    if ((rows as any[]).length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const user = (rows as any[])[0];
    console.log('👤 Found user:', user.username);
    console.log('🔐 Password hash:', user.password_hash.substring(0, 20) + '...');

    // Test the password
    const testPassword = 'admin123';
    const passwordMatch = await bcrypt.compare(testPassword, user.password_hash);

    console.log(`\nTesting password "${testPassword}"`);
    console.log(passwordMatch ? '✅ Password matches!' : '❌ Password does NOT match');
  } finally {
    await conn.end();
  }
}

testLogin();
