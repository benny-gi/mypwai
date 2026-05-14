import React, { useEffect, useState } from 'react';
import { fetchDashboardStats } from './apiExtra';

const cardStyle: React.CSSProperties = {
  padding: '1.5rem',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  backgroundColor: '#fff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<{ sessions: number; students: number; attendance: number } | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const data = await fetchDashboardStats();
      setStats(data);
    };
    loadStats();
  }, []);

  if (!stats) return <div style={{ padding: '2rem' }}>Loading dashboard...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        <div style={cardStyle}>
          <h3>Total Sessions</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{stats.sessions}</p>
        </div>
        <div style={cardStyle}>
          <h3>Total Students</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{stats.students}</p>
        </div>
        <div style={cardStyle}>
          <h3>Avg. Attendance</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{stats.attendance}%</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;