# MySQL Database Migration - Implementation Summary

## What Changed

Your fingerprint attendance system has been migrated from **JSON file storage** to **MySQL database**. This provides:

✅ **Concurrency Safety** - No more lost writes from simultaneous requests  
✅ **Password Security** - Plaintext passwords replaced with bcrypt hashing  
✅ **Better Auth** - JWT tokens instead of ad-hoc tokens  
✅ **Scalability** - Indexed queries instead of full-file reads  
✅ **Data Integrity** - Foreign keys and constraints at DB level  
✅ **Transactions** - Atomic multi-table operations  

## Files Created/Modified

### New Files
- `backend/db.ts` - MySQL connection pooling and query helpers
- `backend/middleware/auth.ts` - JWT authentication middleware
- `backend/scripts/migrate.ts` - Data migration script (JSON → MySQL)
- `backend/migrations/001_init_schema.sql` - Database schema
- `MYSQL_MIGRATION.md` - Complete setup and deployment guide

### Modified Files
- `backend/modules/auth.ts` - Now uses MySQL + bcrypt + JWT
- `backend/modules/attendance.ts` - Now uses MySQL for all operations
- `backend/package.json` - Added mysql2, bcrypt, jsonwebtoken

## Database Schema

**Tables created:**
- `users` - User accounts with hashed passwords
- `students` - Student enrollment data
- `sessions` - Course sessions
- `attendance` - Attendance records (with uniqueness constraints)
- `scan_events` - Fingerprint/face scan logs

## Quick Start

### 1. Install MySQL
- Download from https://dev.mysql.com/downloads/mysql/ (or use package manager)

### 2. Create Database
```sql
CREATE DATABASE fingerprint_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Configure Backend
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your MySQL credentials
```

### 4. Set Up Schema
```bash
mysql -u root -p fingerprint_attendance < backend/migrations/001_init_schema.sql
```

### 5. Install Dependencies & Migrate Data
```bash
cd backend
npm install
npm run migrate
```

### 6. Start Backend
```bash
npm run dev
```

## Key Features

### 🔐 Password Security
- Old plaintext passwords are hashed with bcrypt (10 rounds)
- Passwords are never logged or returned in API responses
- Use the original passwords for login after migration

### 🎫 JWT Authentication
- Login now returns a signed JWT token
- Include token in `Authorization: Bearer <token>` header
- Tokens expire after 7 days

### ⚡ Transactions
- `/attendance/verify` endpoint uses transactions
- Ensures attendance + scan_event are recorded atomically

### 🔄 Data Integrity
- Foreign keys prevent orphaned records
- Unique constraints prevent duplicate attendance for same student/course/day
- Database enforces business rules (not just in code)

## API Changes

### Field Name Mapping

Some field names changed from JSON to MySQL:

```javascript
// OLD (JSON)
{
  index: "STU001",
  courseCode: "CS101",
  date: "2024-05-05"
}

// NEW (MySQL)
{
  index_no: "STU001",
  course_code: "CS101",
  attendance_date: "2024-05-05"
}
```

**All field name changes:**
- `index` → `index_no`
- `fullName` → `full_name`
- `courseCode` → `course_code`
- `fingerprintEnrolled` → `fingerprint_enrolled`
- `faceEnrolled` → `face_enrolled`
- `studentId` → `student_id` (now an integer ID, not string)

### Updated Frontend

If your frontend directly references these field names, update them:

```typescript
// OLD
const response = await fetch('/api/attendance/students');
// response[0] = { index: "STU001", ... }

// NEW
const response = await fetch('/api/attendance/students');
// response[0] = { id: 1, index_no: "STU001", ... }
```

## Login Flow

### Before (JSON)
```javascript
POST /auth/login
{
  "username": "student1",
  "password": "pass123"
}
// Returns: { token: "auth-token-1714994400000" }
```

### After (MySQL + JWT)
```javascript
POST /auth/login
{
  "username": "student1",
  "password": "pass123"
}
// Returns: {
//   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   user: {
//     id: 1,
//     username: "student1",
//     email: "student1@university.edu",
//     fullName: "Student One"
//   }
// }
```

## Production Checklist

- [ ] Set strong JWT_SECRET (use `openssl rand -base64 32`)
- [ ] Use managed MySQL (AWS RDS, Google Cloud SQL, PlanetScale)
- [ ] Enable HTTPS for all API calls
- [ ] Set secure cookies (HttpOnly, SameSite)
- [ ] Configure database backups
- [ ] Add monitoring/alerting
- [ ] Rate limiting on auth endpoints
- [ ] CORS configuration for frontend domain
- [ ] Regular password rotation for DB user
- [ ] Audit logging for attendance operations

## Troubleshooting

### "Access denied for user 'root'@'localhost'"
- Check `.env` file DB credentials
- Verify MySQL is running

### "Unknown database 'fingerprint_attendance'"
- Create database: `CREATE DATABASE fingerprint_attendance;`

### Migration fails
- Ensure all JSON files exist in `backend/data/`
- Check for permission issues with file access
- Review migration script output for specific errors

### Old students not appearing after migration
- Run migration script again: `npm run migrate`
- Check database for duplicate entries

### Tokens not working
- Ensure JWT_SECRET is set in `.env`
- Token must be in `Authorization: Bearer <token>` header
- Check token expiration (7 days default)

## Next Steps

1. ✅ Follow Quick Start steps above
2. ✅ Test API endpoints with new field names
3. ✅ Update frontend if using direct field access
4. ✅ Add JWT auth middleware to sensitive endpoints (see `middleware/auth.ts`)
5. ✅ Set up automated database backups
6. ✅ Load testing before production

## Support Resources

- MySQL Setup: https://dev.mysql.com/doc/
- BCrypt: https://github.com/kelektiv/node.bcrypt.js
- JWT: https://jwt.io/
- MySQL2 Driver: https://github.com/sidorares/node-mysql2

---

**Questions?** Check `MYSQL_MIGRATION.md` for detailed setup instructions.
