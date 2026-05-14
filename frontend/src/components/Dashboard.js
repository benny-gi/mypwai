import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  // Inline styles for components
  const cardStyle = {
    background: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
    cursor: 'pointer',
    minHeight: '150px'
  };

  const cardHoverStyle = {
    transform: 'translateY(-5px)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginTop: '2rem'
  };

  const dashboardData = [
    { title: 'Student Management', value: '1,250', icon: '🎓', path: '/students' },
    { title: 'Attendance', value: '98.5%', icon: '✅', path: '/attendance' },
    { title: 'Exam Setup', value: '12 Active', icon: '📝', path: '/exam-setup' },
    { title: 'Fingerprint Enrollment', value: '95% Done', icon: '👆', path: '/enroll' },
    { title: 'Live Monitoring', value: '3 Halls', icon: '🔴', path: '/monitoring' },
    { title: 'Reporting', value: '25 Reports', icon: '📊', path: '/reporting' },
  ];

  // A sub-component for each card to handle its own hover state
  const StatCard = ({ item }) => {
    const [hover, setHover] = React.useState(false);
    return (
      <div 
        style={{ ...cardStyle, ...(hover ? cardHoverStyle : {}) }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => navigate(item.path)}
      >
        <div>
          <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151', margin: 0 }}>{item.title}</p>
          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#111827', margin: '0.5rem 0' }}>{item.value}</p>
        </div>
        <div style={{ fontSize: '3rem', alignSelf: 'flex-end', opacity: 0.8, marginTop: 'auto' }}>
          {item.icon}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 68px)', // Adjust if Navbar height is different
      width: '100%',
      backgroundImage: "url('/AKUSSAH.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '2.25rem', fontWeight: '800', color: '#fff', margin: 0, textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>Dashboard Overview</h1>
      <p style={{ fontSize: '1.1rem', color: '#f0f0f0', marginTop: '0.5rem', textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}>Welcome back, Admin! Here's a summary of the system.</p>
      
      <div style={gridStyle}>
        {dashboardData.map((item, index) => (
          <StatCard key={index} item={item} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;