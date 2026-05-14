import mysql from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
declare const pool: mysql.Pool;
export declare const query: (sql: string, values?: any[]) => Promise<mysql.QueryResult>;
export declare const exec: (sql: string, values?: any[]) => Promise<mysql.QueryResult>;
export declare const transaction: (callback: (conn: Connection) => Promise<void>) => Promise<void>;
export default pool;
//# sourceMappingURL=db.d.ts.map