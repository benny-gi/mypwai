-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'invigilator',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  index_no VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  programme VARCHAR(255),
  level VARCHAR(50),
  fingerprint_enrolled BOOLEAN DEFAULT false,
  face_enrolled BOOLEAN DEFAULT false,
  photo_url LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course VARCHAR(255),
  course_code VARCHAR(50),
  session_date DATE,
  session_time TIME,
  hall VARCHAR(100),
  UNIQUE KEY unique_session (course_code, session_date, session_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_code VARCHAR(50) NOT NULL,
  attendance_date DATE NOT NULL,
  attendance_time TIME NOT NULL,
  status ENUM('Present', 'Absent') NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attendance (student_id, course_code, attendance_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create scan_events table
CREATE TABLE IF NOT EXISTS scan_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT,
  course_code VARCHAR(50),
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  result ENUM('success', 'failed', 'duplicate', 'enrollment') NOT NULL,
  reason VARCHAR(255),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for performance if they do not already exist
SET @index_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'attendance'
    AND index_name = 'idx_attendance_student_date'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_attendance_student_date ON attendance(student_id, attendance_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'attendance'
    AND index_name = 'idx_attendance_course'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_attendance_course ON attendance(course_code, attendance_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sessions'
    AND index_name = 'idx_sessions_date'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_sessions_date ON sessions(session_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'scan_events'
    AND index_name = 'idx_scan_events_date'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_scan_events_date ON scan_events(event_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'idx_users_email'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_users_email ON users(email)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
