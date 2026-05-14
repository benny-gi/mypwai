import 'dotenv/config';
import mysql from 'mysql2/promise';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function migrateData() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'fingerprint_attendance',
        port: parseInt(process.env.DB_PORT || '3306'),
    });
    try {
        console.log('🔄 Starting data migration from JSON to MySQL...');
        // Load JSON data
        const usersPath = path.resolve(__dirname, '..', 'data', 'users.json');
        const dataPath = path.resolve(__dirname, '..', 'data', 'app-data.json');
        let users = [];
        let store = { students: [], sessions: [], attendance: [], scanEvents: [] };
        try {
            const usersContent = await fs.readFile(usersPath, 'utf8');
            users = JSON.parse(usersContent);
            console.log(`✓ Loaded ${users.length} users from JSON`);
        }
        catch (error) {
            console.log('⚠ No users.json file found');
        }
        try {
            const dataContent = await fs.readFile(dataPath, 'utf8');
            store = JSON.parse(dataContent);
            console.log(`✓ Loaded data: ${store.students.length} students, ${store.sessions.length} sessions, ${store.attendance.length} attendance records, ${store.scanEvents.length} scan events`);
        }
        catch (error) {
            console.log('⚠ No app-data.json file found');
        }
        // Clear existing data
        console.log('\n🗑️  Clearing existing data...');
        await connection.execute('DELETE FROM attendance');
        await connection.execute('DELETE FROM scan_events');
        await connection.execute('DELETE FROM sessions');
        await connection.execute('DELETE FROM students');
        await connection.execute('DELETE FROM users');
        // Migrate users
        if (users.length > 0) {
            console.log('\n👤 Migrating users...');
            for (const user of users) {
                const passwordHash = await bcrypt.hash(user.password, 10);
                try {
                    await connection.execute('INSERT INTO users (username, email, full_name, password_hash) VALUES (?, ?, ?, ?)', [user.username, user.email, user.fullName, passwordHash]);
                    console.log(`  ✓ ${user.username}`);
                }
                catch (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        console.log(`  ⚠ ${user.username} (duplicate, skipped)`);
                    }
                    else {
                        throw error;
                    }
                }
            }
        }
        // Create student index map (old index -> new id)
        const studentMap = new Map();
        // Migrate students
        if (store.students.length > 0) {
            console.log('\n🎓 Migrating students...');
            for (const student of store.students) {
                try {
                    const result = await connection.execute('INSERT INTO students (index_no, name, programme, level, fingerprint_enrolled, face_enrolled, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                        student.index,
                        student.name,
                        student.programme || null,
                        student.level || null,
                        student.fingerprintEnrolled || false,
                        student.faceEnrolled || false,
                        student.photo || null,
                    ]);
                    const insertResult = result[0];
                    studentMap.set(student.index, insertResult.insertId);
                    console.log(`  ✓ ${student.index} -> ${student.name}`);
                }
                catch (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        // Get the existing student id
                        const existing = await connection.execute('SELECT id FROM students WHERE index_no = ?', [student.index]);
                        const existingResult = existing[0];
                        if (existingResult.length > 0) {
                            studentMap.set(student.index, existingResult[0].id);
                            console.log(`  ⚠ ${student.index} (duplicate, using existing id)`);
                        }
                    }
                    else {
                        console.error(`  ✗ Failed to migrate student ${student.index}:`, error.message);
                    }
                }
            }
        }
        // Migrate sessions
        if (store.sessions.length > 0) {
            console.log('\n📅 Migrating sessions...');
            for (const session of store.sessions) {
                try {
                    await connection.execute('INSERT INTO sessions (course, course_code, session_date, session_time, hall) VALUES (?, ?, ?, ?, ?)', [
                        session.course || null,
                        session.courseCode,
                        session.date,
                        session.time,
                        session.hall || null,
                    ]);
                    console.log(`  ✓ ${session.courseCode} on ${session.date}`);
                }
                catch (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        console.log(`  ⚠ ${session.courseCode} on ${session.date} (duplicate, skipped)`);
                    }
                    else {
                        console.error(`  ✗ Failed to migrate session ${session.courseCode}:`, error.message);
                    }
                }
            }
        }
        // Migrate attendance records
        if (store.attendance.length > 0) {
            console.log('\n✅ Migrating attendance records...');
            let skipped = 0;
            for (const record of store.attendance) {
                const studentId = studentMap.get(record.studentId);
                if (!studentId) {
                    console.log(`  ⚠ Skipping attendance for unknown student ${record.studentId}`);
                    skipped++;
                    continue;
                }
                try {
                    await connection.execute('INSERT INTO attendance (student_id, course_code, attendance_date, attendance_time, status) VALUES (?, ?, ?, ?, ?)', [studentId, record.courseCode, record.date, record.time, record.status]);
                }
                catch (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        // Ignore duplicate entries
                    }
                    else {
                        console.error(`  ✗ Failed to migrate attendance record:`, error.message);
                    }
                }
            }
            console.log(`  ✓ Migrated ${store.attendance.length - skipped}/${store.attendance.length} records`);
        }
        // Migrate scan events
        if (store.scanEvents.length > 0) {
            console.log('\n📱 Migrating scan events...');
            let migrated = 0;
            for (const event of store.scanEvents) {
                const studentId = event.studentId ? studentMap.get(event.studentId) : null;
                try {
                    await connection.execute('INSERT INTO scan_events (student_id, course_code, event_date, event_time, result, reason) VALUES (?, ?, ?, ?, ?, ?)', [studentId || null, event.courseCode || null, event.date, event.time, event.result, event.reason || null]);
                    migrated++;
                }
                catch (error) {
                    console.error(`  ✗ Failed to migrate scan event:`, error.message);
                }
            }
            console.log(`  ✓ Migrated ${migrated}/${store.scanEvents.length} scan events`);
        }
        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Summary:');
        console.log(`   - Users: ${users.length}`);
        console.log(`   - Students: ${store.students.length}`);
        console.log(`   - Sessions: ${store.sessions.length}`);
        console.log(`   - Attendance: ${store.attendance.length}`);
        console.log(`   - Scan Events: ${store.scanEvents.length}`);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await connection.end();
    }
}
migrateData();
//# sourceMappingURL=migrate.js.map