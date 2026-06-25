import mysql from 'mysql2/promise';
import { loadEnv } from '../env.js';

loadEnv();
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface JsonUser {
  username: string;
  email: string;
  fullName: string;
  password: string;
}

interface JsonStudent {
  index: string;
  name: string;
  programme: string;
  level: string;
  fingerprintEnrolled?: boolean;
  faceEnrolled?: boolean;
  photo?: string;
}

const hasPhoto = (photo?: string | null) => typeof photo === 'string' && photo.trim().length > 0;

interface JsonSession {
  id: number;
  course: string;
  courseCode: string;
  date: string;
  time: string;
  hall: string;
}

interface JsonAttendance {
  id?: number;
  studentId: string;
  courseCode: string;
  date: string;
  time: string;
  status: 'Present' | 'Absent';
}

interface JsonScanEvent {
  id?: number;
  studentId?: string;
  courseCode?: string;
  date: string;
  time: string;
  result: 'success' | 'failed' | 'duplicate' | 'enrollment';
  reason?: string;
}

interface DataStore {
  students: JsonStudent[];
  sessions: JsonSession[];
  attendance: JsonAttendance[];
  scanEvents: JsonScanEvent[];
}

type ImportIssueType = 'duplicate' | 'mismatch' | 'invalid';

interface ImportIssue {
  type: ImportIssueType;
  entity: string;
  identifier: string;
  details: string;
}

function flagIssue(issues: ImportIssue[], type: ImportIssueType, entity: string, identifier: string, details: string) {
  issues.push({ type, entity, identifier, details });
  const prefix = type === 'duplicate' ? '⚠ DUPLICATE' : type === 'mismatch' ? '⚠ MISMATCH' : '⚠ INVALID';
  console.log(`  ${prefix} ${entity} ${identifier} - ${details}`);
}

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
    const issues: ImportIssue[] = [];

    // Load JSON data
    const usersPath = path.resolve(__dirname, '..', 'data', 'users.json');
    const dataPath = path.resolve(__dirname, '..', 'data', 'app-data.json');

    let users: JsonUser[] = [];
    let store: DataStore = { students: [], sessions: [], attendance: [], scanEvents: [] };

    try {
      const usersContent = await fs.readFile(usersPath, 'utf8');
      users = JSON.parse(usersContent);
      console.log(`✓ Loaded ${users.length} users from JSON`);
    } catch (error) {
      console.log('⚠ No users.json file found');
    }

    try {
      const dataContent = await fs.readFile(dataPath, 'utf8');
      store = JSON.parse(dataContent);
      console.log(`✓ Loaded data: ${store.students.length} students, ${store.sessions.length} sessions, ${store.attendance.length} attendance records, ${store.scanEvents.length} scan events`);
    } catch (error) {
      console.log('⚠ No app-data.json file found');
    }

        console.log('\n📋 Existing data will be preserved. Duplicates will be flagged and skipped.');

    // Migrate users
    if (users.length > 0) {
      console.log('\n👤 Migrating users...');
      const seenUsers = new Set<string>();
      for (const user of users) {
        const userKey = `${user.username.toLowerCase()}|${user.email.toLowerCase()}`;
        if (seenUsers.has(userKey)) {
          flagIssue(issues, 'duplicate', 'user', user.username, 'duplicate username/email found in import file');
          continue;
        }
        seenUsers.add(userKey);

        if (!user.username || !user.email || !user.fullName || !user.password) {
          flagIssue(issues, 'invalid', 'user', user.username || '(missing username)', 'required fields are missing');
          continue;
        }

        const passwordHash = await bcrypt.hash(user.password, 10);
        try {
          await connection.execute(
            'INSERT INTO users (username, email, full_name, password_hash) VALUES (?, ?, ?, ?)',
            [user.username, user.email, user.fullName, passwordHash]
          );
          console.log(`  ✓ ${user.username}`);
        } catch (error: any) {
          if (error.code === 'ER_DUP_ENTRY') {
            flagIssue(issues, 'duplicate', 'user', user.username, 'username or email already exists in the database');
          } else {
            throw error;
          }
        }
      }
    }

    // Create student index map (old index -> new id)
    const studentMap = new Map<string, number>();

    // Migrate students
    if (store.students.length > 0) {
      console.log('\n🎓 Migrating students...');
      const seenStudents = new Set<string>();
      for (const student of store.students) {
        if (!student.index || !student.name) {
          flagIssue(issues, 'invalid', 'student', student.index || '(missing index)', 'index or name is missing');
          continue;
        }

        if (seenStudents.has(student.index)) {
          flagIssue(issues, 'duplicate', 'student', student.index, 'duplicate index found in import file');
          continue;
        }
        seenStudents.add(student.index);

        try {
          const result = await connection.execute(
            'INSERT INTO students (index_no, name, programme, level, fingerprint_enrolled, face_enrolled, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              student.index,
              student.name,
              student.programme || null,
              student.level || null,
              student.fingerprintEnrolled || false,
              Boolean(student.faceEnrolled || hasPhoto(student.photo)),
              student.photo || null,
            ]
          );
          const insertResult = result[0] as any;
          studentMap.set(student.index, insertResult.insertId);
          console.log(`  ✓ ${student.index} -> ${student.name}`);
        } catch (error: any) {
          if (error.code === 'ER_DUP_ENTRY') {
            // Get the existing student id
            const existing = await connection.execute('SELECT id FROM students WHERE index_no = ?', [student.index]);
            const existingResult = existing[0] as any;
            if (existingResult.length > 0) {
              studentMap.set(student.index, existingResult[0].id);
              flagIssue(issues, 'duplicate', 'student', student.index, 'student already exists in the database');
            }
          } else {
            console.error(`  ✗ Failed to migrate student ${student.index}:`, error.message);
          }
        }
      }
    }

    // Migrate sessions
    if (store.sessions.length > 0) {
      console.log('\n📅 Migrating sessions...');
      const seenSessions = new Set<string>();
      for (const session of store.sessions) {
        if (!session.courseCode || !session.date || !session.time) {
          flagIssue(issues, 'invalid', 'session', session.courseCode || '(missing course code)', 'course code, date, or time is missing');
          continue;
        }

        const sessionKey = `${session.courseCode}|${session.date}|${session.time}`;
        if (seenSessions.has(sessionKey)) {
          flagIssue(issues, 'duplicate', 'session', `${session.courseCode} on ${session.date}`, 'duplicate session found in import file');
          continue;
        }
        seenSessions.add(sessionKey);

        try {
          await connection.execute(
            'INSERT INTO sessions (course, course_code, session_date, session_time, hall) VALUES (?, ?, ?, ?, ?)',
            [
              session.course || null,
              session.courseCode,
              session.date,
              session.time,
              session.hall || null,
            ]
          );
          console.log(`  ✓ ${session.courseCode} on ${session.date}`);
        } catch (error: any) {
          if (error.code === 'ER_DUP_ENTRY') {
            flagIssue(issues, 'duplicate', 'session', `${session.courseCode} on ${session.date}`, 'session already exists in the database');
          } else {
            console.error(`  ✗ Failed to migrate session ${session.courseCode}:`, error.message);
          }
        }
      }
    }

    // Migrate attendance records
    if (store.attendance.length > 0) {
      console.log('\n✅ Migrating attendance records...');
      let skipped = 0;
      const seenAttendance = new Set<string>();
      for (const record of store.attendance) {
        const studentId = studentMap.get(record.studentId);
        if (!studentId) {
          flagIssue(issues, 'mismatch', 'attendance', `${record.studentId} / ${record.courseCode}`, 'student reference does not match any imported student');
          skipped++;
          continue;
        }

        const attendanceKey = `${record.studentId}|${record.courseCode}|${record.date}|${record.status}`;
        if (seenAttendance.has(attendanceKey)) {
          flagIssue(issues, 'duplicate', 'attendance', `${record.studentId} / ${record.courseCode} / ${record.date}`, 'duplicate attendance row found in import file');
          skipped++;
          continue;
        }
        seenAttendance.add(attendanceKey);

        try {
          await connection.execute(
            'INSERT INTO attendance (student_id, course_code, attendance_date, attendance_time, status) VALUES (?, ?, ?, ?, ?)',
            [studentId, record.courseCode, record.date, record.time, record.status]
          );
        } catch (error: any) {
          if (error.code === 'ER_DUP_ENTRY') {
            flagIssue(issues, 'duplicate', 'attendance', `${record.studentId} / ${record.courseCode} / ${record.date}`, 'attendance already exists in the database');
            skipped++;
          } else {
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
        if (event.studentId && !studentId) {
          flagIssue(issues, 'mismatch', 'scan_event', `${event.studentId} / ${event.courseCode || 'no-course'}`, 'student reference does not match any imported student');
        }

        try {
          await connection.execute(
            'INSERT INTO scan_events (student_id, course_code, event_date, event_time, result, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [studentId || null, event.courseCode || null, event.date, event.time, event.result, event.reason || null]
          );
          migrated++;
        } catch (error: any) {
          console.error(`  ✗ Failed to migrate scan event:`, error.message);
        }
      }
      console.log(`  ✓ Migrated ${migrated}/${store.scanEvents.length} scan events`);
    }

    console.log('\n✅ Migration completed successfully!');
    if (issues.length > 0) {
      console.log(`\n⚠ Import completed with ${issues.length} flagged issue(s):`);
      const counts = issues.reduce(
        (acc, issue) => {
          acc[issue.type] = (acc[issue.type] || 0) + 1;
          return acc;
        },
        {} as Record<ImportIssueType, number>
      );
      console.log(`   - Duplicates: ${counts.duplicate || 0}`);
      console.log(`   - Mismatches: ${counts.mismatch || 0}`);
      console.log(`   - Invalid: ${counts.invalid || 0}`);
    }
    console.log('\n📝 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Students: ${store.students.length}`);
    console.log(`   - Sessions: ${store.sessions.length}`);
    console.log(`   - Attendance: ${store.attendance.length}`);
    console.log(`   - Scan Events: ${store.scanEvents.length}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrateData();
