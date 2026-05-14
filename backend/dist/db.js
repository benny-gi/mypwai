import mysql from 'mysql2/promise';
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
export const query = async (sql, values = []) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(sql, values || []);
        return rows;
    }
    finally {
        connection.release();
    }
};
export const exec = async (sql, values = []) => {
    const connection = await pool.getConnection();
    try {
        const [result] = await connection.execute(sql, values || []);
        return result;
    }
    finally {
        connection.release();
    }
};
export const transaction = async (callback) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await callback(connection);
        await connection.commit();
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
};
export default pool;
//# sourceMappingURL=db.js.map