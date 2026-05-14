import React, { useEffect, useState } from 'react';
import { fetchDashboardStats, fetchMonitoring, fetchAllFromMySQL, pushAllToMySQL } from '../apiExtra';
import { initDB, persistDBBackup } from '../db';
import { useNavigate } from 'react-router-dom';

const cardStyle: React.CSSProperties = {
  padding: '2rem',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
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
      color: '#6B7280',
      flexDirection: 'column'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #E5E7EB',
        borderTop: '4px solid #4F46E5',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem'
      }}></div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      Loading dashboard...
    </div>
  );

  return (
    <div style={{
      minHeight: 'calc(100vh - 68px)',
      width: '100%',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 50%, #0f766e 100%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '2.25rem', textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}>Dashboard</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#eee', textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>Welcome back, {username}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="file"
            id="db-import-input"
            accept=".zip,.xlsx,.json"
            style={{ display: 'none' }}
            onChange={handleImportDB}
          />
          <button
            onClick={() => document.getElementById('db-import-input')?.click()}
            style={{
              padding: '0.75rem 1.5rem', backgroundColor: '#E0E7FF', color: '#4338CA',
              border: '1px solid #C7D2FE', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            Import DB
          </button>
          <button
            onClick={handleExportDB}
            style={{
              padding: '0.75rem 1.5rem', backgroundColor: '#ECFDF5', color: '#065F46',
              border: '1px solid #6EE7B7', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            Export DB
          </button>
          <button
            onClick={handleClearDB}
            style={{
              padding: '0.75rem 1.5rem', backgroundColor: '#FFFBEB', color: '#D97706',
              border: '1px solid #FDE68A', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            Clear Database
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#FFFFFF',
              color: '#EF4444',
              border: '1px solid #FEE2E2',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF2F2';
              e.currentTarget.style.borderColor = '#FCA5A5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#FEE2E2';
            }}
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div style={cardStyle} onClick={() => navigate('/exam-setup')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <h3 style={{ margin: 0, color: '#6B7280', fontSize: '1rem', fontWeight: 500 }}>Total Sessions</h3>
          <p style={{ fontSize: '3rem', margin: '1rem 0', fontWeight: 700, color: '#4F46E5' }}>{stats.sessions}</p>
        </div>
        <div style={cardStyle} onClick={() => navigate('/students')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <h3 style={{ margin: 0, color: '#6B7280', fontSize: '1rem', fontWeight: 500 }}>Total Students</h3>
          <p style={{ fontSize: '3rem', margin: '1rem 0', fontWeight: 700, color: '#4F46E5' }}>{stats.students}</p>
        </div>
        <div style={cardStyle} onClick={() => navigate('/reporting')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <h3 style={{ margin: 0, color: '#6B7280', fontSize: '1rem', fontWeight: 500 }}>Avg. Attendance</h3>
          <p style={{ fontSize: '3rem', margin: '1rem 0', fontWeight: 700, color: '#10B981' }}>{stats.attendance}%</p>
        </div>
      </div>

      {/* Detailed Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* Recent Activity */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1F2937', borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem' }}>Recent Activity</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {monitoring.recentLogs.map((log: any, i: number) => (
                    <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, color: '#374151' }}>{log.event}</span>
                        <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>{log.time}</span>
                    </li>
                ))}
            </ul>
            <button style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontWeight: 600, padding: 0 }} onClick={() => navigate('/monitoring')}>View All Activity &rarr;</button>
        </div>

        {/* System Status & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1F2937' }}>System Status</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{ color: '#6B7280' }}>Active Exam Sessions</span>
                    <span style={{ fontWeight: 'bold', color: '#10B981', fontSize: '1.25rem' }}>{monitoring.activeSessions}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6B7280' }}>Biometric Devices</span>
                    <span style={{ fontWeight: 'bold', color: '#4F46E5', fontSize: '1.25rem' }}>{monitoring.devicesOnline} Online</span>
                </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)', borderRadius: '12px', padding: '2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', color: 'white' }}>
                <h3 style={{ marginTop: 0, color: 'white', marginBottom: '1.5rem' }}>Quick Actions</h3>
                <button onClick={() => navigate('/enroll')} style={{ display: 'block', width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', textAlign: 'left', fontWeight: 500, transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}>+ Enroll New Student</button>
                <button onClick={() => navigate('/exam-setup')} style={{ display: 'block', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', textAlign: 'left', fontWeight: 500, transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}>+ Schedule Exam Session</button>
            </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DashboardPage;
