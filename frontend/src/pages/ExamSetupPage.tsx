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
    <div style={{
      minHeight: 'calc(100vh - 68px)',
      width: '100%',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #C9A84C 50%, #0f766e 100%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{ width: '100%', maxWidth: 600, background: 'rgba(255, 255, 255, 0.95)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', padding: '2.5rem 2rem', backdropFilter: 'blur(5px)', borderTop: '4px solid #C9A84C' }}>
        <h2 style={{ color: '#1F2937', marginBottom: 24, textAlign: 'center', fontWeight: 700 }}>Examination Setup</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input type="text" placeholder="Course Name" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db' }} required />
          <input type="text" placeholder="Course Code" value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db' }} required />
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db' }} required />
          <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db' }} required />
          <input type="text" placeholder="Examination Hall" value={form.hall} onChange={e => setForm({ ...form, hall: e.target.value })} style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db' }} required />
          <button type="submit" style={{ background: '#C9A84C', color: '#1a1a1a', border: 'none', borderRadius: 6, padding: '12px 0', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginTop: 10 }}>Create Session</button>
        </form>
        <div style={{ marginTop: 32 }}>
          <h3 style={{ color: '#1F2937', marginBottom: 12, fontWeight: 700 }}>Upcoming Sessions</h3>
          <ul style={{ background: '#f9fafb', borderRadius: 8, padding: 18, listStyle: 'none', border: '1px solid #e5e7eb' }}>
            {sessions.length > 0 ? sessions.map(s => (
              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#111827' }}>{s.course} ({s.courseCode})</div>
                  <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{s.date} at {s.time} | {s.hall}</div>
                </div>
                <button 
                  onClick={() => handleDelete(s.id)}
                  style={{
                    background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5',
                    borderRadius: '6px', padding: '0.25rem 0.75rem', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  Delete
                </button>
              </li>
            )) : (
              <li style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>No sessions scheduled.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExamSetupPage;
