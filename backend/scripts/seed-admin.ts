/**
 * Seed script: creates a default admin user.
 *
 * Usage:
 *   cd backend && npx tsx scripts/seed-admin.ts
 *
 * This creates the built-in admin account:
 *   Email:    admin@school.edu
 *   Password: admin123
 * 
 * You can override via env vars:
 *   ADMIN_EMAIL=you@school.edu ADMIN_PASSWORD=yourpass npx tsx scripts/seed-admin.ts
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { loadEnv } from '../env.js';

loadEnv();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@school.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || 'System Admin';

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    // Ensure role column exists (safety, in case 002 migration wasn't run)
    try {
      await connection.execute(
        `ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'invigilator' AFTER password_hash`
      );
      console.log('✓ Added role column to users table');
    } catch {
      // Column already exists — fine
    }

    // Ensure account state columns exist for login and revocation
    try {
      await connection.execute(
        `ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role`
      );
      console.log('✓ Added is_active column to users table');
    } catch {
      // Column already exists — fine
    }

    try {
      await connection.execute(
        `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_active`
      );
      console.log('✓ Added deleted_at column to users table');
    } catch {
      // Column already exists — fine
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await connection.execute(
      `INSERT INTO users (username, email, full_name, password_hash, role, is_active, deleted_at)
       VALUES (?, ?, ?, ?, 'admin', 1, NULL)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         password_hash = VALUES(password_hash),
         role = 'admin',
         is_active = 1,
         deleted_at = NULL`,
      [ADMIN_EMAIL, ADMIN_EMAIL, ADMIN_FULL_NAME, passwordHash]
    );

    console.log(`✓ Admin account ready:`);
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Role:     admin`);
    console.log(`\n  → Sign in at http://localhost:3000/login`);
  } catch (error) {
    console.error('❌ Failed to seed admin:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
