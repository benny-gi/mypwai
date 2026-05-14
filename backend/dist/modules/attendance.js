import express from 'express';
import { query, exec, transaction } from '../db.js';
const router = express.Router();
const todayIso = () => new Date().toISOString().split('T')[0] || '1970-01-01';
const nowTime = () => new Date().toLocaleTimeString();
router.get('/students', async (_req, res) => {
    try {
        const students = await query('SELECT * FROM students');
        res.json(students);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch students';
        res.status(500).json({ message });
    }
});
router.post('/students', async (req, res) => {
    const student = req.body;
    if (!student?.index_no || !student?.name) {
        return res.status(400).json({ message: 'index_no and name are required' });
    }
    try {
        const existing = (await query('SELECT id FROM students WHERE index_no = ?', [
            student.index_no,
        ]));
        if (existing.length > 0) {
            // Update existing
            await exec('UPDATE students SET name = ?, programme = ?, level = ?, fingerprint_enrolled = ?, face_enrolled = ?, photo_url = ? WHERE index_no = ?', [
                student.name,
                student.programme || null,
                student.level || null,
                student.fingerprint_enrolled || false,
                student.face_enrolled || false,
                student.photo_url || null,
                student.index_no,
            ]);
        }
        else {
            // Insert new
            await exec('INSERT INTO students (index_no, name, programme, level, fingerprint_enrolled, face_enrolled, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                student.index_no,
                student.name,
                student.programme || null,
                student.level || null,
                student.fingerprint_enrolled || false,
                student.face_enrolled || false,
                student.photo_url || null,
            ]);
        }
        return res.json({ success: true, student });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save student';
        res.status(500).json({ message });
    }
});
router.delete('/students/:index', async (req, res) => {
    const index = String(req.params?.index || '').trim();
    try {
        await exec('DELETE FROM students WHERE index_no = ?', [index]);
        return res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete student';
        res.status(500).json({ message });
    }
});
router.get('/sessions', async (_req, res) => {
    try {
        const sessions = await query('SELECT * FROM sessions');
        res.json(sessions);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch sessions';
        res.status(500).json({ message });
    }
});
router.post('/sessions', async (req, res) => {
    const session = req.body;
    if (!session?.course_code || !session?.session_date || !session?.session_time) {
        return res.status(400).json({ message: 'course_code, session_date, and session_time are required' });
    }
    try {
        if (session.id) {
            // Update existing
            await exec('UPDATE sessions SET course = ?, course_code = ?, session_date = ?, session_time = ?, hall = ? WHERE id = ?', [session.course || null, session.course_code, session.session_date, session.session_time, session.hall || null, session.id]);
        }
        else {
            // Insert new
            await exec('INSERT INTO sessions (course, course_code, session_date, session_time, hall) VALUES (?, ?, ?, ?, ?)', [session.course || null, session.course_code, session.session_date, session.session_time, session.hall || null]);
        }
        return res.json({ success: true, session });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save session';
        res.status(500).json({ message });
    }
});
router.delete('/sessions/:id', async (req, res) => {
    const id = Number(req.params?.id);
    try {
        await exec('DELETE FROM sessions WHERE id = ?', [id]);
        return res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete session';
        res.status(500).json({ message });
    }
});
router.get('/attendance', async (_req, res) => {
    try {
        const attendance = await query('SELECT * FROM attendance');
        res.json(attendance);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch attendance';
        res.status(500).json({ message });
    }
});
router.post('/attendance', async (req, res) => {
    const record = req.body;
    if (!record?.student_id || !record?.course_code || !record?.attendance_date || !record?.attendance_time) {
        return res.status(400).json({ message: 'student_id, course_code, attendance_date, and attendance_time are required' });
    }
    try {
        await exec('INSERT INTO attendance (student_id, course_code, attendance_date, attendance_time, status) VALUES (?, ?, ?, ?, ?)', [record.student_id, record.course_code, record.attendance_date, record.attendance_time, record.status || 'Present']);
        return res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save attendance';
        res.status(500).json({ message });
    }
});
router.get('/scan-events', async (_req, res) => {
    try {
        const events = await query('SELECT * FROM scan_events ORDER BY event_date DESC, event_time DESC');
        res.json(events);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch scan events';
        res.status(500).json({ message });
    }
});
router.post('/scan-events', async (req, res) => {
    const event = req.body;
    if (!event?.event_date || !event?.event_time || !event?.result) {
        return res.status(400).json({ message: 'event_date, event_time, and result are required' });
    }
    try {
        await exec('INSERT INTO scan_events (student_id, course_code, event_date, event_time, result, reason) VALUES (?, ?, ?, ?, ?, ?)', [event.student_id || null, event.course_code || null, event.event_date, event.event_time, event.result, event.reason || null]);
        return res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save scan event';
        res.status(500).json({ message });
    }
});
router.post('/verify', async (req, res) => {
    const studentIndex = typeof req.body?.studentId === 'string' ? req.body.studentId.trim() : '';
    if (!studentIndex) {
        return res.status(400).json({ message: 'studentId is required' });
    }
    try {
        // Find student by index_no
        const students = (await query('SELECT id, name, index_no FROM students WHERE index_no = ?', [
            studentIndex,
        ]));
        if (students.length === 0) {
            // Log failed event
            await exec('INSERT INTO scan_events (course_code, event_date, event_time, result, reason) VALUES (?, ?, ?, ?, ?)', [null, todayIso(), nowTime(), 'failed', 'student_not_found']);
            return res.status(404).json({ message: 'Student not found' });
        }
        const student = students[0];
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        const todaySession = (await query('SELECT course_code FROM sessions WHERE session_date = ? LIMIT 1', [todayIso()]));
        const courseCode = todaySession[0]?.course_code || 'DEMO101';
        // Check for duplicate attendance
        const duplicates = (await query('SELECT id FROM attendance WHERE student_id = ? AND course_code = ? AND attendance_date = ? AND status = ?', [student.id, courseCode, todayIso(), 'Present']));
        if (duplicates.length > 0) {
            await exec('INSERT INTO scan_events (student_id, course_code, event_date, event_time, result, reason) VALUES (?, ?, ?, ?, ?, ?)', [student.id, courseCode, todayIso(), nowTime(), 'duplicate', 'duplicate_check_in']);
            return res.json({ message: `Duplicate scan detected for ${student.name}` });
        }
        // Record attendance using transaction
        await transaction(async (conn) => {
            await conn.execute('INSERT INTO attendance (student_id, course_code, attendance_date, attendance_time, status) VALUES (?, ?, ?, ?, ?)', [student.id, courseCode, todayIso(), nowTime(), 'Present']);
            await conn.execute('INSERT INTO scan_events (student_id, course_code, event_date, event_time, result) VALUES (?, ?, ?, ?, ?)', [student.id, courseCode, todayIso(), nowTime(), 'success']);
        });
        return res.json({ message: `Verified: ${student.name}` });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        res.status(500).json({ message });
    }
});
export default router;
//# sourceMappingURL=attendance.js.map