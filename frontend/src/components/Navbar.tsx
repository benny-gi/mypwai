import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Navbar.css';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const getLinkClass = (path: string) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">ExamSys</div>
      <div className="navbar-nav">
        <Link to="/dashboard" className={getLinkClass('/dashboard')}>Dashboard</Link>
        <Link to="/students" className={getLinkClass('/students')}>Students</Link>
        <Link to="/enroll" className={getLinkClass('/enroll')}>Enrollment</Link>
        <Link to="/exam-setup" className={getLinkClass('/exam-setup')}>Exams</Link>
        <Link to="/attendance" className={getLinkClass('/attendance')}>Attendance</Link>
        <Link to="/monitoring" className={getLinkClass('/monitoring')}>Monitoring</Link>
        <Link to="/reporting" className={getLinkClass('/reporting')}>Reports</Link>
        <button onClick={handleLogout} className="nav-link" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', color: '#dc2626', fontWeight: 'bold' }}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;
