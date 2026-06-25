import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { loadEnv } from './env.js';

loadEnv();

async function updateAdminPassword() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    const newPassword = 'iamadmin888';
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await conn.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [passwordHash, 'admin@school.edu']
    );

    console.log('✅ Admin password updated successfully!');
    console.log(`   Email:    admin@school.edu`);
    console.log(`   Password: ${newPassword}`);
  } finally {
    await conn.end();
  }
}

updateAdminPassword();
