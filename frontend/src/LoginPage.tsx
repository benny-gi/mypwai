import React from 'react';
import './LoginPage.css';

const LoginPage = ({ onNavigate }: { onNavigate?: (path: string) => void }) => {
  const goTo = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.href = path;
  };

  return (
    <div className="login-hero">
      <div className="login-hero-inner container">
        <header className="login-header">
          <div className="hide-sm">
            <button className="btn" onClick={() => goTo('/login')}>Login</button>
            <button className="btn btn-primary" onClick={() => goTo('/login')}>Invigilator Access</button>
          </div>
        </header>

        <main className="login-main card">
          <div className="login-copy">
            <h1>Build the future — One line at a time.</h1>
            <p className="muted">A modern, fast platform for managing exam attendance and invigilation.</p>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => goTo('/login')}>Get Started</button>
              <button className="btn btn-ghost" onClick={() => goTo('/login')}>View Demo</button>
            </div>
          </div>
          <div className="login-visual hide-sm">
            <div className="visual-card card">
              <div className="visual-placeholder">Dashboard preview</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LoginPage;