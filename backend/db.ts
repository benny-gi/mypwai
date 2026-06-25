import mysql from 'mysql2/promise';
import type { Connection, Pool } from 'mysql2/promise';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  return pool;
}

export const query = async (sql: string, values: any[] = []) => {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.execute(sql, values || []);
    return rows;
  } finally {
    connection.release();
  }
};

export const exec = async (sql: string, values: any[] = []) => {
  const connection = await getPool().getConnection();
  try {
    const [result] = await connection.execute(sql, values || []);
    return result;
  } finally {
    connection.release();
  }
};

export const transaction = async (callback: (conn: Connection) => Promise<void>) => {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await callback(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
