import React, { useEffect, useState } from 'react';
import { fetchDashboardStats, fetchMonitoring, fetchAllFromMySQL, pushAllToMySQL } from '../apiExtra';
import { initDB, persistDBBackup } from '../db';
import { useNavigate } from 'react-router-dom';

const cardStyle: React.CSSProperties = {
  padding: '2rem',
  borderRadius: '16px',
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  cursor: 'pointer',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
};

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<{ sessions: number; students: number; attendance: number } | null>(null);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [username, setUsername] = useState('Admin');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleClearDB = async () => {
    if (window.confirm('DANGER: This will delete all students, sessions, and attendance records. Are you sure?')) {
      const db = await initDB();
      await Promise.all([db.clear('students'), db.clear('sessions'), db.clear('attendance')]);
      await persistDBBackup();
      alert('Database cleared successfully.');
      window.location.reload(); // Reload to reflect changes
    }
  };

  const handleExportDB = async () => {
    try {
      // Fetch from MySQL (falls back to IndexedDB if unavailable)
      const { students, sessions, attendance } = await fetchAllFromMySQL();
      
      const JSZip = await import('jszip');
      const zip = new JSZip.default();
      
      const XLSX = await import('xlsx');
      
      // Track flags for export
      const exportIssues: { type: string; entity: string; id: string; details: string }[] = [];
      const noPhotoStudents: string[] = [];

      // --- Students sheet ---
      // Normalise: MySQL uses index_no / photo_url; IndexedDB uses index / photo
      const studentRows = (students || []).map((s: any) => {
        const index = s.index_no || s.index || '';
        const hasPhoto = !!(s.photo_url || s.photo);
        if (!hasPhoto && index) {
          noPhotoStudents.push(index);
        }
        return {
          'Index': index,
          'Name': s.name,
          'Programme': s.programme,
          'Level': s.level,
          'Fingerprint Enrolled': s.fingerprint_enrolled ?? s.fingerprintEnrolled ? 'Yes' : 'Pending',
          'Face Enrolled': s.face_enrolled ?? s.faceEnrolled ? 'Yes' : 'No',
          'Photo': hasPhoto ? `${index}.jpg` : '',
        };
      });
      const studentSheet = XLSX.utils.json_to_sheet(studentRows);
      const studentWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(studentWb, studentSheet, 'Students');
      zip.file('students.xlsx', XLSX.write(studentWb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
      
      // --- Sessions sheet ---
      const seenSessions = new Set<string>();
      const sessionRows = (sessions || []).map((s: any) => {
        const sessionKey = `${s.course_code || s.courseCode}|${s.session_date || s.date}|${s.session_time || s.time}`;
        if (seenSessions.has(sessionKey)) {
          exportIssues.push({ type: 'duplicate', entity: 'session', id: `${s.course_code || s.courseCode}`, details: `Duplicate session on ${s.session_date || s.date}` });
        }
        seenSessions.add(sessionKey);
        return {
          'ID': s.id,
          'Course Code': s.course_code || s.courseCode,
          'Course': s.course,
          'Date': s.session_date || s.date,
          'Time': s.session_time || s.time,
          'Hall': s.hall,
        };
      });
      const sessionSheet = XLSX.utils.json_to_sheet(sessionRows);
      const sessionWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(sessionWb, sessionSheet, 'Sessions');
      zip.file('sessions.xlsx', XLSX.write(sessionWb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
      
      // --- Attendance sheet ---
      const attendanceRows = (attendance || []).map((a: any) => ({
        'Student ID': a.student_id || a.studentId,
        'Course Code': a.course_code || a.courseCode,
        'Date': a.attendance_date || a.date,
        'Time': a.attendance_time || a.time,
        'Status': a.status,
      }));
      const attendanceSheet = XLSX.utils.json_to_sheet(attendanceRows);
      const attendanceWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(attendanceWb, attendanceSheet, 'Attendance');
      zip.file('attendance.xlsx', XLSX.write(attendanceWb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
      
      // --- Photos folder ---
      const photosFolder = zip.folder('photos');
      let photosExported = 0;
      if (photosFolder) {
        for (const s of students || []) {
          const photo = s.photo_url || s.photo;
          if (photo && typeof photo === 'string' && photo.startsWith('data:')) {
            const matches = photo.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (matches) {
              const ext = matches[1].includes('png') ? 'png' : 'jpg';
              const binaryStr = atob(matches[2]);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              photosFolder.file(`${s.index_no || s.index}.${ext}`, bytes);
              photosExported++;
            }
          }
        }
      }
      
      // Generate ZIP and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `examsys_backup_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show flag summary after download
      let exportMsg = `✅ Export complete: ${(students || []).length} students, ${(sessions || []).length} sessions, ${(attendance || []).length} attendance records, ${photosExported} photos exported.`;
      if (noPhotoStudents.length > 0) {
        exportMsg += `\n\n⚠️ FLAGGED — ${noPhotoStudents.length} student(s) have NO photo: ${noPhotoStudents.slice(0, 15).join(', ')}${noPhotoStudents.length > 15 ? ` ...and ${noPhotoStudents.length - 15} more` : ''}`;
      }
      if (exportIssues.length > 0) {
        const dupSessions = exportIssues.filter(i => i.type === 'duplicate').length;
        exportMsg += `\n⚠️ ${dupSessions} duplicate session(s) found in database.`;
      }
      alert(exportMsg);
    } catch (error) {
      console.error('Export failed', error);
      alert('Failed to export database');
    }
  };

  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Import will add new records and flag duplicates. Existing data will NOT be overwritten. Continue?')) {
      e.target.value = '';
      return;
    }

    const issues: { type: string; entity: string; id: string }[] = [];
    const flaggedNoFace: string[] = [];

    try {
      const db = await initDB();
      let addedCount = 0;

      // Helper: check existence by primary key
      const exists = async (store: 'students' | 'attendance' | 'sessions' | 'users' | 'scanEvents', key: any) => {
        try {
          const result = await db.get(store, key);
          return result !== undefined;
        } catch {
          return false;
        }
      };

      // Helper: read a file from ZIP as base64 data URI
      const readZipFileAsDataUri = async (zip: any, path: string): Promise<string | null> => {
        const fileEntry = zip.file(path);
        if (!fileEntry) return null;
        const blob = await fileEntry.async('blob');
        return new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.readAsDataURL(blob);
        });
      };

      if (file.name.endsWith('.zip')) {
        // --- ZIP import (with photos) ---
        const JSZip = await import('jszip');
        const zip = await JSZip.default.loadAsync(file);

        // Extract photos from photos/ folder
        const photoMap: Record<string, string> = {};
        const photoFiles = zip.folder('photos');
        if (photoFiles) {
          const entries: { name: string; dir: boolean }[] = [];
          photoFiles.forEach((relPath: string, entry: any) => {
            if (!entry.dir) entries.push({ name: relPath, dir: false });
          });
          for (const entry of entries) {
            const key = entry.name.replace(/\.[^/.]+$/, ''); // filename without extension = student index
            const dataUri = await readZipFileAsDataUri(zip, `photos/${entry.name}`);
            if (dataUri) {
              photoMap[key] = dataUri;
            }
          }
        }

        // Read the spreadsheet files
        const XLSX = await import('xlsx');

        // Students
        const studentFile = zip.file('students.xlsx');
        if (studentFile) {
          const studentBuf = await studentFile.async('arraybuffer');
          const studentWb = XLSX.read(studentBuf, { type: 'array' });
          const sheet = studentWb.Sheets['Students'] || studentWb.Sheets[studentWb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);
          for (const row of rows) {
            const index = String(row.Index || row.index || row['Student ID'] || row.studentId || row.id || '').trim();
            if (!index) continue;

            if (await exists('students', index)) {
              issues.push({ type: 'duplicate', entity: 'student', id: index });
              continue;
            }

            const name = String(row.Name || row.name || row['Full Name'] || row.fullName || '').trim();
            const programme = String(row.Programme || row.programme || row.Course || row.course || row['Course of Study'] || '').trim();
            const level = String(row.Level || row.level || row['Year'] || row.year || '').trim();
            const fingerprintStr = String(row.Fingerprint || row.fingerprint || row['Fingerprint Enrolled'] || '').toLowerCase();
            const faceStr = String(row.Face || row.face || row['Face Enrolled'] || row['Face Recognition'] || row.faceEnrolled || '').toLowerCase();

            const fingerprintEnrolled = fingerprintStr === 'yes' || fingerprintStr === 'y' || fingerprintStr === 'true' || fingerprintStr === 'enrolled' || fingerprintStr === '1';
            // Photo from ZIP photos/ folder takes priority over any path in the spreadsheet
            const photo = photoMap[index] || '';
            const faceEnrolled = faceStr === 'yes' || faceStr === 'y' || faceStr === 'true' || faceStr === 'enrolled' || faceStr === '1' || !!photo;

            // Flag if student has no photo at all (no embedded image & no face enrollment)
            const hasNoPhoto = !photo || photo.length === 0 || (!photo.startsWith('data:') && !photo.startsWith('http') && !photo.startsWith('blob:'));
            if (hasNoPhoto && !faceEnrolled) {
              flaggedNoFace.push(index);
            }

            await db.put('students', {
              index,
              name: name || 'Unknown',
              programme: programme || 'N/A',
              level: level || 'N/A',
              photo,
              fingerprintEnrolled,
              faceEnrolled,
            });
            addedCount++;
          }
        }

        // Sessions
        const sessionFile = zip.file('sessions.xlsx');
        if (sessionFile) {
          const sessionBuf = await sessionFile.async('arraybuffer');
          const sessionWb = XLSX.read(sessionBuf, { type: 'array' });
          const sheet = sessionWb.Sheets['Sessions'] || sessionWb.Sheets[sessionWb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);
          for (const row of rows) {
            const id = Number(row.ID || row.id || 0);
            if (!id) continue;

            if (await exists('sessions', id)) {
              issues.push({ type: 'duplicate', entity: 'session', id: String(id) });
              continue;
            }

            await db.put('sessions', {
              id,
              course: String(row.Course || row.course || row['Course Name'] || ''),
              courseCode: String(row['Course Code'] || row.courseCode || row.Code || row.code || ''),
              date: String(row.Date || row.date || ''),
              time: String(row.Time || row.time || ''),
              hall: String(row.Hall || row.hall || row.Venue || row.venue || ''),
            });
            addedCount++;
          }
        }

        // Attendance
        const attFile = zip.file('attendance.xlsx');
        if (attFile) {
          const attBuf = await attFile.async('arraybuffer');
          const attWb = XLSX.read(attBuf, { type: 'array' });
          const sheet = attWb.Sheets['Attendance'] || attWb.Sheets[attWb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);
          for (const row of rows) {
            const studentId = String(row['Student ID'] || row.studentId || row.Index || row.index || '').trim();
            if (!studentId) continue;

            await db.add('attendance', {
              studentId,
              courseCode: String(row['Course Code'] || row.courseCode || row.Course || row.course || ''),
              date: String(row.Date || row.date || ''),
              time: String(row.Time || row.time || ''),
              status: (String(row.Status || row.status || 'Present') === 'Absent' ? 'Absent' : 'Present') as 'Present' | 'Absent',
            });
            addedCount++;
          }
        }
      } else if (file.name.endsWith('.xlsx')) {
        // --- Legacy .xlsx import (without photos folder) ---
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(event.target?.result as ArrayBuffer, { type: 'array' });

            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const rows: any[] = XLSX.utils.sheet_to_json(sheet);

              if (sheetName.toLowerCase().includes('student')) {
                for (const row of rows) {
                  const index = String(row.Index || row.index || row['Student ID'] || row.studentId || row.id || '').trim();
                  if (!index) continue;

                  if (await exists('students', index)) {
                    issues.push({ type: 'duplicate', entity: 'student', id: index });
                    continue;
                  }

                  const name = String(row.Name || row.name || row['Full Name'] || row.fullName || '').trim();
                  const programme = String(row.Programme || row.programme || row.Course || row.course || row['Course of Study'] || '').trim();
                  const level = String(row.Level || row.level || row['Year'] || row.year || '').trim();
                  const photo = String(row.Photo || row.photo || row['Profile Photo'] || row.profilePhoto || row.Image || row.image || '').trim();
                  const fingerprintStr = String(row.Fingerprint || row.fingerprint || row['Fingerprint Enrolled'] || '').toLowerCase();
                  const faceStr = String(row.Face || row.face || row['Face Enrolled'] || row['Face Recognition'] || row.faceEnrolled || row['Facial Recognition'] || '').toLowerCase();

                  const fingerprintEnrolled = fingerprintStr === 'yes' || fingerprintStr === 'y' || fingerprintStr === 'true' || fingerprintStr === 'enrolled' || fingerprintStr === '1';
                  // Check if there's actual photo data (embedded image, URL, or base64 data URI)
                  const hasPhotoData = photo.length > 0 && (photo.startsWith('data:image') || photo.startsWith('data:') || photo.startsWith('http') || photo.startsWith('blob:') || photo.startsWith('/'));
                  const faceEnrolled = faceStr === 'yes' || faceStr === 'y' || faceStr === 'true' || faceStr === 'enrolled' || faceStr === '1' || hasPhotoData;

                  // Flag if NO photo data at all AND face is not enrolled
                  const hasNoPhoto = !hasPhotoData && photo.length === 0;
                  if (hasNoPhoto && !faceEnrolled) {
                    flaggedNoFace.push(index);
                  }

                  await db.put('students', {
                    index,
                    name: name || 'Unknown',
                    programme: programme || 'N/A',
                    level: level || 'N/A',
                    photo: photo || '',
                    fingerprintEnrolled,
                    faceEnrolled,
                  });
                  addedCount++;
                }
              } else if (sheetName.toLowerCase().includes('session')) {
                for (const row of rows) {
                  const id = Number(row.ID || row.id || 0);
                  if (!id) continue;

                  if (await exists('sessions', id)) {
                    issues.push({ type: 'duplicate', entity: 'session', id: String(id) });
                    continue;
                  }

                  await db.put('sessions', {
                    id,
                    course: String(row.Course || row.course || row['Course Name'] || ''),
                    courseCode: String(row['Course Code'] || row.courseCode || row.Code || row.code || ''),
                    date: String(row.Date || row.date || ''),
                    time: String(row.Time || row.time || ''),
                    hall: String(row.Hall || row.hall || row.Venue || row.venue || ''),
                  });
                  addedCount++;
                }
              } else if (sheetName.toLowerCase().includes('attend')) {
                for (const row of rows) {
                  const studentId = String(row['Student ID'] || row.studentId || row.Index || row.index || '').trim();
                  if (!studentId) continue;

                  await db.add('attendance', {
                    studentId,
                    courseCode: String(row['Course Code'] || row.courseCode || row.Course || row.course || ''),
                    date: String(row.Date || row.date || ''),
                    time: String(row.Time || row.time || ''),
                    status: (String(row.Status || row.status || 'Present') === 'Absent' ? 'Absent' : 'Present') as 'Present' | 'Absent',
                  });
                  addedCount++;
                }
              }
            }

            await persistDBBackup();
            let message = `✅ Import complete: ${addedCount} record(s) added.`;
            if (issues.length > 0) {
              const dupStudents = issues.filter(i => i.type === 'duplicate' && i.entity === 'student').length;
              const dupSessions = issues.filter(i => i.type === 'duplicate' && i.entity === 'session').length;
              const dupIds = issues.map(i => i.id).slice(0, 15).join(', ');
              message += `\n\n⚠️ FLAGGED — ${issues.length} duplicate(s) skipped (already exist in database): ${dupStudents} students, ${dupSessions} sessions.\n   IDs: ${dupIds}${issues.length > 15 ? ` ...and ${issues.length - 15} more` : ''}`;
            }
            if (flaggedNoFace.length > 0) {
              message += `\n\n⚠️ FLAGGED — ${flaggedNoFace.length} student(s) have NO photo: ${flaggedNoFace.slice(0, 20).join(', ')}${flaggedNoFace.length > 20 ? `\n   ...and ${flaggedNoFace.length - 20} more` : ''}`;
            }
            alert(message);
            window.location.reload();
          } catch (error) {
            console.error('Import failed', error);
            const errorContext = issues.length > 0 || flaggedNoFace.length > 0
              ? `\n\nNote: Before the error, ${issues.length} duplicate(s) and ${flaggedNoFace.length} no-photo student(s) were flagged.`
              : '';
            alert(`❌ Failed to import database. Invalid file format or unexpected error.${errorContext}`);
          }
          e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
        return; // early return since we're inside the reader callback
      } else {
        // --- Legacy JSON import ---
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);

            if (Array.isArray(data.students)) {
              for (const item of data.students) {
                const key = item.index || item.id;
                if (key && (await exists('students', key))) {
                  issues.push({ type: 'duplicate', entity: 'student', id: String(key) });
                  continue;
                }
                const hasPhotoData = typeof item.photo === 'string' && item.photo.length > 0;
                const faceEnrolled = Boolean(item.faceEnrolled) || hasPhotoData;
                if (!faceEnrolled && !hasPhotoData) {
                  flaggedNoFace.push(String(key));
                }
                await db.put('students', {
                  ...item,
                  faceEnrolled,
                  fingerprintEnrolled: item.fingerprintEnrolled ?? false,
                });
                addedCount++;
              }
            }

            if (Array.isArray(data.sessions)) {
              for (const item of data.sessions) {
                const key = item.id;
                if (key !== undefined && (await exists('sessions', key))) {
                  issues.push({ type: 'duplicate', entity: 'session', id: String(key) });
                  continue;
                }
                await db.put('sessions', item);
                addedCount++;
              }
            }

            if (Array.isArray(data.attendance)) {
              for (const item of data.attendance) {
                const key = item.id;
                if (key !== undefined && (await exists('attendance', key))) {
                  issues.push({ type: 'duplicate', entity: 'attendance', id: String(key) });
                  continue;
                }
                await db.put('attendance', item);
                addedCount++;
              }
            }

            await persistDBBackup();
            let message = `✅ Import complete: ${addedCount} record(s) added.`;
            if (issues.length > 0) {
              const dupStudents = issues.filter(i => i.type === 'duplicate' && i.entity === 'student').length;
              const dupSessions = issues.filter(i => i.type === 'duplicate' && i.entity === 'session').length;
              const dupIds = issues.map(i => i.id).slice(0, 15).join(', ');
              message += `\n\n⚠️ FLAGGED — ${issues.length} duplicate(s) skipped (already exist in database): ${dupStudents} students, ${dupSessions} sessions.\n   IDs: ${dupIds}${issues.length > 15 ? ` ...and ${issues.length - 15} more` : ''}`;
            }
            if (flaggedNoFace.length > 0) {
              message += `\n\n⚠️ FLAGGED — ${flaggedNoFace.length} student(s) have NO photo: ${flaggedNoFace.slice(0, 20).join(', ')}${flaggedNoFace.length > 20 ? `\n   ...and ${flaggedNoFace.length - 20} more` : ''}`;
            }
            alert(message);
            window.location.reload();
          } catch (error) {
            console.error('Import failed', error);
            const errorContext = issues.length > 0 || flaggedNoFace.length > 0
              ? `\n\nNote: Before the error, ${issues.length} duplicate(s) and ${flaggedNoFace.length} no-photo student(s) were flagged.`
              : '';
            alert(`❌ Failed to import database. Invalid file format or unexpected error.${errorContext}`);
          }
          e.target.value = '';
        };
        reader.readAsText(file);
        return;
      }

        await persistDBBackup();

      // Also push imported data to MySQL
      try {
        const { students: allStudents, sessions: allSessions, attendance: allAttendance } = 
          await Promise.all([
            db.getAll('students'),
            db.getAll('sessions'),
            db.getAll('attendance'),
          ]).then(([s, ses, att]) => ({ students: s, sessions: ses, attendance: att }));
        await pushAllToMySQL({
          students: allStudents.map((s: any) => ({
            index_no: s.index,
            name: s.name,
            programme: s.programme,
            level: s.level,
            fingerprint_enrolled: s.fingerprintEnrolled ?? s.fingerprint_enrolled ?? false,
            face_enrolled: s.faceEnrolled ?? s.face_enrolled ?? false,
            photo_url: s.photo || null,
          })),
          sessions: allSessions.map((s: any) => ({
            course_code: s.courseCode || s.course_code,
            course: s.course,
            session_date: s.date || s.session_date,
            session_time: s.time || s.session_time,
            hall: s.hall,
          })),
          attendance: allAttendance.map((a: any) => ({
            studentId: a.studentId || a.student_id,
            courseCode: a.courseCode || a.course_code,
            date: a.date || a.attendance_date,
            time: a.time || a.attendance_time,
            status: a.status,
          })),
        });
      } catch (mysqlErr) {
        console.warn('Could not sync to MySQL:', mysqlErr);
      }

      let message = `✅ Import complete: ${addedCount} record(s) added.`;
      if (issues.length > 0) {
        const dupStudents = issues.filter(i => i.type === 'duplicate' && i.entity === 'student').length;
        const dupSessions = issues.filter(i => i.type === 'duplicate' && i.entity === 'session').length;
        const dupIds = issues.map(i => i.id).slice(0, 15).join(', ');
        message += `\n\n⚠️ FLAGGED — ${issues.length} duplicate(s) skipped (already exist in database): ${dupStudents} students, ${dupSessions} sessions.\n   IDs: ${dupIds}${issues.length > 15 ? ` ...and ${issues.length - 15} more` : ''}`;
      }
      if (flaggedNoFace.length > 0) {
        message += `\n\n⚠️ FLAGGED — ${flaggedNoFace.length} student(s) have NO photo: ${flaggedNoFace.slice(0, 20).join(', ')}${flaggedNoFace.length > 20 ? `\n   ...and ${flaggedNoFace.length - 20} more` : ''}`;
      }
      alert(message);
      window.location.reload();
    } catch (error) {
      console.error('Import failed', error);
      let errorMsg = '❌ Failed to import database. Invalid file format or unexpected error.';
      if (issues.length > 0 || flaggedNoFace.length > 0) {
        errorMsg += `\n\nNote: Before the error, ${issues.length} duplicate(s) and ${flaggedNoFace.length} no-photo student(s) were flagged.`;
      }
      errorMsg += '\n\nFor ZIP imports, ensure it contains students.xlsx, sessions.xlsx, attendance.xlsx, and optionally a photos/ folder.';
      alert(errorMsg);
    }
    e.target.value = '';
  };

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }

    const loadStats = async () => {
      const data = await fetchDashboardStats();
      const monData = await fetchMonitoring();
      setStats(data);
      setMonitoring(monData);
    };
    loadStats();
  }, []);

  if (!stats || !monitoring) return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: 'calc(100vh - 68px)', // Adjust based on Navbar height
      color: 'var(--muted)',
      flexDirection: 'column'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid rgba(255,255,255,0.06)',
        borderTop: '4px solid #FFB606',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem'
      }}></div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      Loading dashboard...
    </div>
  );

  return (
    <div className="page-enter" style={{ minHeight: 'calc(100vh - 68px)', width: '100%' }}>
      <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title animate-fade-in-up">Dashboard</h1>
          <p className="page-sub animate-fade-in-up delay-1">Welcome back, {username}</p>
        </div>
        <div className="page-actions animate-fade-in-up delay-2">
          <input
            type="file"
            id="db-import-input"
            accept=".zip,.xlsx,.json"
            style={{ display: 'none' }}
            onChange={handleImportDB}
          />
          <button className="btn btn-primary" onClick={() => document.getElementById('db-import-input')?.click()}>Import DB</button>
          <button className="btn btn-ghost" onClick={handleExportDB}>Export DB</button>
          <button className="btn btn-ghost" onClick={handleClearDB}>Clear Database</button>
          <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="card-grid stagger-children" style={{ marginBottom: '2rem' }}>
        <div className="metric-card" onClick={() => navigate('/exam-setup')}>
          <h3 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem', fontWeight: 600 }}>Total Sessions</h3>
          <p className="metric-value">{stats.sessions}</p>
        </div>
        <div className="metric-card" onClick={() => navigate('/students')}>
          <h3 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem', fontWeight: 600 }}>Total Students</h3>
          <p className="metric-value">{stats.students}</p>
        </div>
        <div className="metric-card" onClick={() => navigate('/reporting')}>
          <h3 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem', fontWeight: 600 }}>Avg. Attendance</h3>
          <p className="metric-value" style={{ color: 'var(--upsa-success)' }}>{stats.attendance}%</p>
        </div>
      </div>

      {/* Detailed Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Recent Activity */}
        <div className="card table-card">
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>Recent Activity</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {monitoring.recentLogs.map((log: any, i: number) => (
                    <li key={i} className="table-row-hover" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: `fadeInUp 0.3s ease-out both`, animationDelay: `${0.04 + i * 0.03}s` }}>
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{log.event}</span>
                        <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{log.time}</span>
                    </li>
                ))}
            </ul>
            <button className="animate-fade-in-up delay-4" style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, transition: 'color 0.2s ease, transform 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FFD15C'; e.currentTarget.style.transform = 'translateX(4px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.transform = 'translateX(0)'; }} onClick={() => navigate('/monitoring')}>View All Activity &rarr;</button>
        </div>

        {/* System Status & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card table-card">
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--accent)' }}>System Status</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Active Exam Sessions</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--upsa-success)', fontSize: '1.25rem' }}>{monitoring.activeSessions}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Biometric Devices</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '1.25rem' }}>{monitoring.devicesOnline} Online</span>
                </div>
            </div>

            <div className="animate-scale-in delay-5 card-accent-hover" style={{ background: 'linear-gradient(135deg, #00004E 0%, #1E3A8A 30%, #F27229 100%)', borderRadius: '16px', padding: '1.25rem', color: 'white' }}>
                <h3 style={{ marginTop: 0, color: 'white', marginBottom: '1.5rem' }}>Quick Actions</h3>
                <button onClick={() => navigate('/enroll')} style={{ display: 'block', width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', textAlign: 'left', fontWeight: 500, transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}>+ Enroll New Student</button>
                <button onClick={() => navigate('/exam-setup')} style={{ display: 'block', width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', textAlign: 'left', fontWeight: 500, transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}>+ Schedule Exam Session</button>
            </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DashboardPage;
