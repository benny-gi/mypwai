import React from 'react';
import './Navbar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const getLinkClass = (path) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src="/SENANU.jpg" alt="System Logo" className="nav-logo" />
        <span>Examsys</span>
      </div>
      <div className="navbar-nav">
        <Link to="/dashboard" className={getLinkClass('/dashboard')}>Dashboard</Link>
        <Link to="/attendance" className={getLinkClass('/attendance')}>Attendance</Link>
        <Link to="/exam-setup" className={getLinkClass('/exam-setup')}>Exam Setup</Link>
        <Link to="/enroll" className={getLinkClass('/enroll')}>Enrollment</Link>
        <Link to="/monitoring" className={getLinkClass('/monitoring')}>Monitoring</Link>
        <Link to="/reporting" className={getLinkClass('/reporting')}>Reporting</Link>
        <Link to="/students" className={getLinkClass('/students')}>Student Management</Link>
        <button onClick={handleLogout} className="nav-link" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', color: '#dc2626', fontWeight: 'bold' }}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;