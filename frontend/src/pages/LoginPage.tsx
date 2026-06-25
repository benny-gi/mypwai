import React, { useState } from 'react';
import { login } from '../apiExtra';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      localStorage.setItem('username', form.username);
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .login-container {
            display: flex !important;
            flex-direction: column !important;
            height: 100vh !important;
            width: 100% !important;
          }
          .login-sidebar {
            display: none !important;
            flex: 0 !important;
          }
          .login-form-wrapper {
            flex: 1 !important;
            height: auto !important;
            min-height: 100vh !important;
            width: 100% !important;
          }
        }
      `}</style>
      <div className="login-container" style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      }}>
        <div className="login-sidebar" style={{
          flex: 1,
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #C9A84C 50%, #0f766e 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minWidth: 0,
        }}></div>
        <div className="login-form-wrapper" style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: '#f5f5f5',
          minWidth: 0,
        }}>
          <div style={{
            maxWidth: 400,
            width: '100%',
            background: '#fff',
            padding: '3rem',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            borderTop: '4px solid #C9A84C'
          }}>
          <h2 style={{ textAlign: 'center', color: '#212529', marginBottom: '1rem', fontSize: '2.5rem', fontWeight: 300 }}>
            Login
          </h2>
          <p style={{ textAlign: 'center', color: '#6c757d', marginBottom: '2rem' }}>
            Welcome back! Please enter your details.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="username" style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontWeight: 600 }}>Username or Email</label>
              <input
                id="username"
                type="text"
                placeholder="username or email"
                value={form.username}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.25rem',
                  border: '1px solid #ced4da',
                  fontSize: '1rem',
                  transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontWeight: 600 }}>Password</label>
              <input
                id="password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.25rem',
                  border: '1px solid #ced4da',
                  fontSize: '1rem',
                  transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                }}
              />
            </div>
            {error && <div style={{ color: '#dc3545', marginBottom: '1.5rem', textAlign: 'center' }}>{error}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#C9A84C',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '0.25rem',
                padding: '1rem 0',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                marginTop: '1rem',
                transition: 'background-color 0.15s ease-in-out',
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <div style={{ marginTop: '2rem', backgroundColor: '#e9ecef', padding: '1rem', borderRadius: '0.25rem', fontSize: '0.875rem', border: '1px solid #dee2e6' }}>
            <strong>Demo Credentials:</strong><br/>
            Email: <code>admin@example.com</code><br/>
            Password: <code>password123</code>
          </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
