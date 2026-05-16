/**
 * Run all SQL migration files against the database.
 * Usage: cd backend && npx tsx scripts/run-migrations.ts
 *
 * Reads .env for DB credentials (same as the backend).
 */
import mysql from 'mysql2/promise';
import { loadEnv } from '../env.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbPort = parseInt(process.env.DB_PORT || '3306');
  const dbName = process.env.DB_NAME || 'fingerprint_attendance';

  // Step 1: Connect without a database to create it if needed
  const conn1 = await mysql.createConnection({
    host: dbHost, user: dbUser, password: dbPass, port: dbPort,
    multipleStatements: true,
  });

  try {
    console.log(`📦 Ensuring database "${dbName}" exists...`);
    await conn1.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log('   ✓ Database ready\n');
  } finally {
    await conn1.end();
  }

  // Step 2: Reconnect with the database selected
  const connection = await mysql.createConnection({
    host: dbHost, user: dbUser, password: dbPass, port: dbPort,
    database: dbName,
    multipleStatements: true,
  });

  try {
    // Run each migration file in order
    const migrationsDir = path.resolve(__dirname, '..', 'migrations');
    const files = (await fs.readdir(migrationsDir))
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      console.log(`📄 Running ${file}...`);
      try {
        await connection.query(sql);
        console.log(`   ✓ Done\n`);
      } catch (err: any) {
        console.error(`   ⚠ Warning in ${file}: ${err.message}\n`);
      }
    }

    console.log('✅ All migrations complete.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
