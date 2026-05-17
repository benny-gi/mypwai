import React from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <style>{`
        .landing-page {
          height: 100vh;
          width: 100%;
          background-image: url('/UPSA.jpeg');
          background-size: cover;
          background-position: center;
          position: relative;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: white;
          overflow: hidden;
        }
        .landing-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 78, 0.58);
          z-index: 1;
        }
        .landing-nav {
          position: absolute;
          top: 0;
          right: 0;
          padding: 2rem;
          z-index: 10;
          display: flex;
          gap: 1.5rem;
        }
        .nav-btn {
          background: transparent;
          border: 2px solid rgba(255,182,6,0.7);
          color: white;
          padding: 0.6rem 1.5rem;
          border-radius: 30px;
          cursor: pointer;
          font-weight: 600;
          font-size: 1rem;
          transition: all 0.3s ease;
        }
        .nav-btn:hover {
          background: #FFB606;
          color: #00004E;
          transform: translateY(-2px);
        }
        .landing-content {
          position: relative;
          z-index: 5;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 0 2rem;
        }
        .system-name {
          font-size: 4.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 3px;
          text-shadow: 2px 2px 10px rgba(0,0,0,0.5);
        }
        .motto {
          font-size: 1.8rem;
          font-style: italic;
          margin-bottom: 3rem;
          color: #f0f0f0;
          font-weight: 300;
        }
        .overview-card {
          max-width: 800px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 2.5rem;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        .overview-text {
          font-size: 1.25rem;
          line-height: 1.8;
          color: #fff;
        }
      `}</style>

      <div className="landing-overlay"></div>

      <div className="landing-nav">
        <button className="nav-btn" onClick={() => navigate('/login')}>Login</button>
        <button className="nav-btn" onClick={() => window.location.href = 'mailto:support@examsys.com'}>Contact Us</button>
      </div>
      
      <div className="landing-content">
        <h1 className="system-name">Examsys</h1>
        <p className="motto">"Scholarship with Professionalism"</p>
        
        <div className="overview-card">
          <p className="overview-text">
            Welcome to the advanced Examination Attendance System. 
            Our platform ensures secure, efficient, and reliable monitoring of student attendance 
            and examination processes using cutting-edge biometric technology.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;