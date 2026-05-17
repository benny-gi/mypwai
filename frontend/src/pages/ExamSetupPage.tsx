import React, { useState, useEffect } from 'react';
import { fetchSessions, createSession, deleteSession } from '../apiExtra';

const ExamSetupPage: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [form, setForm] = useState({ course: '', courseCode: '', date: '', time: '', hall: '' });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const data = await fetchSessions();
    setSessions(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.course && form.courseCode && form.date && form.time && form.hall) {
      await createSession({ id: Date.now(), ...form });
      await loadSessions();
      setForm({ course: '', courseCode: '', date: '', time: '', hall: '' });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      await deleteSession(id);
      await loadSessions();
    }
  };

  return (
    <div className="page-enter" style={{
      minHeight: 'calc(100vh - 68px)',
      width: '100%',
      padding: '2rem'
    }}>
      <div style={{ width: '100%', maxWidth: 600, margin: '40px auto 0', background: 'var(--card)', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', padding: '2.5rem 2rem', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)' }}>
        <h2 style={{ color: 'var(--accent)', marginBottom: 24, textAlign: 'center', fontWeight: 700 }}>Examination Setup</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input type="text" placeholder="Course Name" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} className="input" required />
          <input type="text" placeholder="Course Code" value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })} className="input" required />
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input" required />
          <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="input" required />
          <input type="text" placeholder="Examination Hall" value={form.hall} onChange={e => setForm({ ...form, hall: e.target.value })} className="input" required />
          <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', fontSize: '1rem' }}>Create Session</button>
        </form>
        <div style={{ marginTop: 32 }}>
          <h3 style={{ color: 'var(--accent)', marginBottom: 12, fontWeight: 600 }}>Upcoming Sessions</h3>
          <ul style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 18, listStyle: 'none', border: '1px solid var(--border)' }}>
            {sessions.length > 0 ? sessions.map(s => (
              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>{s.course} ({s.courseCode})</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{s.date} at {s.time} | {s.hall}</div>
                </div>
                <button 
                  onClick={() => handleDelete(s.id)}
                  className="btn-outline-action btn-outline-action--danger"
                >
                  Delete
                </button>
              </li>
            )) : (
              <li style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No sessions scheduled.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExamSetupPage;
