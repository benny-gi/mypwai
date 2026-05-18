# MySQL Migration Guide

This guide helps you migrate from JSON file storage to MySQL database.

## Prerequisites

1. **MySQL installed** (8.0+)
   - Windows: Download from https://dev.mysql.com/downloads/mysql/
   - macOS: `brew install mysql`
   - Linux: `apt-get install mysql-server` (Ubuntu/Debian)

2. **Node.js dependencies installed**
   ```bash
   npm install
   ```

## Setup Steps

### 1. Create Database and User

Start MySQL and run these commands:

```sql
CREATE DATABASE fingerprint_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'attendance_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON fingerprint_attendance.* TO 'attendance_user'@'localhost';
FLUSH PRIVILEGES;
```

Or use a shortcut with root:
```sql
CREATE DATABASE fingerprint_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```bash
# For local development (MySQL on localhost, root user, no password):
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=fingerprint_attendance
JWT_SECRET=your-super-secret-jwt-key-change-this
```

Or if you created a dedicated user:
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=attendance_user
DB_PASSWORD=your_secure_password
DB_NAME=fingerprint_attendance
JWT_SECRET=your-super-secret-jwt-key
```

### Passwords & Secrets

Guidance for handling passwords and secrets used by the system.

- **Database user password:** Use a strong password for the MySQL user (`attendance_user`) and store it in your `.env` as `DB_PASSWORD`. Avoid committing `.env` to source control.
- **Admin account password:** The project provides a seed script that creates a default admin account. You can override the credentials by setting env vars and running the script from the `backend` folder:

```bash
# Set your desired admin email and password, then run the seed script
ADMIN_EMAIL=you@school.edu ADMIN_PASSWORD="StrongP@ssw0rd" npx tsx scripts/seed-admin.ts
```

The seed script stores the admin password securely using bcrypt hashing. The default seeded credentials are `admin@school.edu` / `admin123` unless you override them.

- **JWT secret:** Set a long, random value for `JWT_SECRET` in `.env`. You can generate one locally with:

```bash
# Example: generate a 32-byte base64 secret
openssl rand -base64 32
```

- **Password reset / rotation:** To rotate or reset an admin password, re-run the seed script with a new `ADMIN_PASSWORD` or update the `users` table directly (use bcrypt to hash the new password). For automated resets, consider adding an endpoint that issues password reset tokens (not included by default).

- **Do not store secrets in source control:** Keep `.env` files out of git and use platform-specific secret management for production (Vault, AWS Secrets Manager, Azure Key Vault, etc.).

**Invigilator passwords shown in the app**

When you create invigilator accounts (single or bulk) via the Admin UI, the backend generates a temporary password and returns it in the creation response. The frontend displays the generated password immediately after creation (or after a password reset) — copy it and deliver it to the invigilator, because the password is only shown once. For bulk imports, you can download a CSV containing the generated passwords.

The default seeded admin account (when you run the seed script without overrides) uses the credentials `admin@school.edu` / `admin123`. If you run the seed script with custom env vars, the chosen `ADMIN_PASSWORD` will be the initial password and is printed to the console by the script.

### 3. Create Database Schema

Run the migration SQL script:

**Option A: Using MySQL CLI**
```bash
mysql -u root -p fingerprint_attendance < migrations/001_init_schema.sql
```

**Option B: Using MySQL Workbench or GUI**
- Open `migrations/001_init_schema.sql`
- Execute it in your MySQL GUI tool

If your database already exists and you are updating an older install, also run:

```bash
npm run setup-db
```

This applies the later migrations, including the invigilator active/deleted state used for password reissue and access revocation.

### 4. Migrate Data from JSON

If you have existing data in JSON files:

```bash
# Run the migration script
npm run migrate
```

This will:
- Read your existing `data/users.json` and `data/app-data.json`
- Hash passwords with bcrypt (for security)
- Insert all data into MySQL
- Show a migration summary

**Note:** The migration script will warn you about:
- Duplicate entries (skipped, uses existing records)
- Missing student references (skipped with warning)
- Constraints violations (logged but continues)

### 5. Install Dependencies

```bash
npm install
```

New dependencies added:
- `mysql2` - MySQL driver with promise support
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT token generation

### 6. Start the Backend

```bash
npm run dev
```

The backend should now connect to MySQL instead of JSON files.

## Verification

Test the API:

```bash
# Test user signup
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "fullName": "Test User",
    "password": "password123"
  }'

# Test login
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

## Troubleshooting

### "Access denied for user 'root'@'localhost'"
- MySQL is running but credentials are wrong
- Check your `.env` file
- Verify MySQL user exists: `mysql -u root -p -e "SELECT user FROM mysql.user;"`

### "Can't connect to MySQL server"
- MySQL service is not running
  - Windows: Start MySQL Service
  - macOS: `brew services start mysql`
  - Linux: `sudo service mysql start`

### Migration fails with "Unknown database"
- Database doesn't exist
- Run: `CREATE DATABASE fingerprint_attendance;`

### Password mismatch after migration
- Old plaintext passwords are now hashed with bcrypt
- You need to use the original passwords, they're now securely stored

## Production Deployment

For production, use:

```bash
# Strong JWT secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-very-long-random-secret-here

# Use connection pooling
DB_CONNECTION_LIMIT=20

# Consider using managed MySQL:
# - AWS RDS
# - Google Cloud SQL
# - PlanetScale (serverless MySQL)
# - DigitalOcean Managed Database
```

## Rollback

If you need to roll back to JSON:
1. Keep your old `data/` directory as backup
2. The backend code still supports JSON if MySQL connection fails
3. Comment out MySQL imports and use old modules/auth.ts and modules/attendance.ts

## API Changes

Some field names changed from JSON to MySQL schema:

| JSON Field | MySQL Field |
|-----------|------------|
| `index` | `index_no` |
| `fullName` | `full_name` |
| `courseCode` | `course_code` |
| `date` (session) | `session_date` |
| `time` (session) | `session_time` |
| `date` (attendance) | `attendance_date` |
| `time` (attendance) | `attendance_time` |
| `fingerprintEnrolled` | `fingerprint_enrolled` |
| `faceEnrolled` | `face_enrolled` |
| `studentId` (string) | `student_id` (int, FK) |

Frontend API calls will need to be updated if they use these field names directly.

## Next Steps

1. ✅ Set up MySQL
2. ✅ Configure `.env`
3. ✅ Create schema
4. ✅ Migrate data
5. ✅ Start backend
6. Update frontend API calls to use new field names (if needed)
7. Add proper JWT validation middleware to protected routes
8. Enable HTTPS and secure cookies in production
