# MySQL Backend - Quick Reference

## Environment Setup

```bash
# 1. Create .env file
cp backend/.env.example backend/.env

# 2. Edit .env with your MySQL credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fingerprint_attendance
JWT_SECRET=$(openssl rand -base64 32)  # Generate secure secret

# 3. Create database
mysql -u root -e "CREATE DATABASE fingerprint_attendance CHARACTER SET utf8mb4;"

# 4. Run schema
mysql -u root fingerprint_attendance < backend/migrations/001_init_schema.sql

# 5. Install & migrate
cd backend
npm install
npm run migrate  # Imports JSON data if it exists

# 6. Start
npm run dev
```

## API Endpoints (with JWT)

### Authentication

```bash
# Sign up (no auth required)
POST /api/auth/signup
Content-Type: application/json

{
  "username": "student1",
  "email": "student1@university.edu",
  "fullName": "Student One",
  "password": "securepass123"
}

# Login (no auth required)
POST /api/auth/login
Content-Type: application/json

{
  "username": "student1",
  "password": "securepass123"
}

# Response includes JWT token - save and use for authenticated requests
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "student1",
    "email": "student1@university.edu",
    "fullName": "Student One"
  }
}
```

### Attendance (authenticated requests)

```bash
# Include token in all requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# Get all students
GET /api/attendance/students

# Add/update student
POST /api/attendance/students
{
  "index_no": "STU001",
  "name": "John Doe",
  "programme": "Computer Science",
  "level": "200",
  "fingerprint_enrolled": true,
  "face_enrolled": false
}

# Verify attendance (fingerprint/face scan)
POST /api/attendance/verify
{
  "studentId": "STU001"
}

# Get attendance records
GET /api/attendance/attendance

# Get scan events
GET /api/attendance/scan-events
```

## Database Query Helpers

### In your routes

```typescript
import { query, exec, transaction } from '../db.js';

// Simple query (SELECT)
const results = await query(
  'SELECT * FROM students WHERE programme = ?',
  ['Computer Science']
);

// Execute (INSERT/UPDATE/DELETE)
await exec(
  'INSERT INTO students (index_no, name) VALUES (?, ?)',
  ['STU001', 'John Doe']
);

// Transaction (multiple operations, atomic)
await transaction(async (conn) => {
  await conn.execute('INSERT INTO attendance ...', [...]);
  await conn.execute('INSERT INTO scan_events ...', [...]);
  // Both succeed or both rollback
});
```

## Protect Routes with JWT Middleware

```typescript
import authMiddleware from '../middleware/auth.js';

// Protect a route
router.post('/sensitive', authMiddleware, async (req, res) => {
  console.log(req.user); // { id: 1, username: '...', email: '...' }
  // Handle request...
});

// Protect all routes in a router
router.use(authMiddleware);
```

## Database Schema Overview

```sql
-- Users (for login)
users (id, username, email, full_name, password_hash, created_at)

-- Students (enrolled)
students (id, index_no, name, programme, level, 
          fingerprint_enrolled, face_enrolled, photo_url)

-- Course Sessions
sessions (id, course, course_code, session_date, session_time, hall)

-- Attendance Records
attendance (id, student_id→students.id, course_code, 
           attendance_date, attendance_time, status)

-- Scan Logs (fingerprint/face attempts)
scan_events (id, student_id→students.id, course_code, 
            event_date, event_time, result, reason)
```

## Common Queries

```sql
-- Students present today
SELECT s.name, a.attendance_time
FROM attendance a
JOIN students s ON a.student_id = s.id
WHERE a.attendance_date = CURDATE()
AND a.status = 'Present'
ORDER BY a.attendance_time;

-- Attendance per course
SELECT course_code, COUNT(*) as present_count
FROM attendance
WHERE status = 'Present'
GROUP BY course_code;

-- Duplicate scan attempts
SELECT s.name, COUNT(*) as attempts
FROM scan_events e
JOIN students s ON e.student_id = s.id
WHERE e.result = 'duplicate'
AND e.event_date = CURDATE()
GROUP BY e.student_id
HAVING COUNT(*) > 1;

-- Student with most scans
SELECT s.index_no, s.name, COUNT(*) as total_scans
FROM scan_events e
JOIN students s ON e.student_id = s.id
GROUP BY e.student_id
ORDER BY total_scans DESC
LIMIT 10;
```

## Field Name Changes (Important!)

Update frontend if it uses these directly:

| Old (JSON) | New (MySQL) |
|-----------|-----------|
| `index` | `index_no` |
| `fullName` | `full_name` |
| `courseCode` | `course_code` |
| `date` (session) | `session_date` |
| `time` (session) | `session_time` |
| `date` (attendance) | `attendance_date` |
| `time` (attendance) | `attendance_time` |
| `fingerprintEnrolled` | `fingerprint_enrolled` |
| `faceEnrolled` | `face_enrolled` |
| `studentId` (string) | `student_id` (int FK) |

## Debugging

```bash
# Connect to MySQL directly
mysql -u root fingerprint_attendance

# Check schema
DESCRIBE students;
DESCRIBE attendance;

# Count records
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM attendance;

# Check for errors
mysql -u root fingerprint_attendance -e "SELECT * FROM students LIMIT 5;"
```

## Troubleshooting

**Token expired?** Tokens expire after 7 days. Login again.

**Duplicate student entry?** Database prevents duplicate `index_no`. Use UPDATE endpoint.

**Attendance not recording?** Ensure student exists and token is valid.

**Migration failed?** Check JSON file exists in `backend/data/`. Run again with `npm run migrate`.

## Security Notes

🔐 **Never:**
- Log tokens or passwords
- Store passwords in plaintext
- Expose JWT_SECRET in frontend
- Commit `.env` file (use `.env.example`)

✅ **Always:**
- Use HTTPS in production
- Rotate JWT_SECRET regularly
- Enable database backups
- Use strong passwords for DB user
- Validate input server-side

## Example: Full Auth Flow

```javascript
// Frontend
async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const { token, user } = await res.json();
  localStorage.setItem('token', token);
  
  return user;
}

// Subsequent requests
async function verifyStudent(studentId) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/attendance/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ studentId })
  });
  
  return await res.json();
}
```

## Performance Tips

- Indexes are already created on common queries
- Batch operations when possible
- Use pagination for large datasets:
  ```sql
  SELECT * FROM attendance LIMIT 100 OFFSET 200;
  ```
- Monitor slow queries:
  ```sql
  SET GLOBAL slow_query_log = 'ON';
  SET GLOBAL long_query_time = 2;
  ```
