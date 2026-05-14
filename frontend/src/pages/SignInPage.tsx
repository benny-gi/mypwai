import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../apiExtra';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;
    
    if (strength <= 2) return { level: 'Weak', color: '#EF4444' };
    if (strength <= 4) return { level: 'Medium', color: '#F59E0B' };
    return { level: 'Strong', color: '#10B981' };
  };

  const checkPasswordRequirements = (password: string) => ({
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(form.username, form.password);
      localStorage.setItem('authToken', res.token);
      localStorage.setItem('username', res.user.username);
      localStorage.setItem('email', res.user.email);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .signin-container {
            display: flex !important;
            flex-direction: column !important;
            height: 100vh !important;
            width: 100% !important;
          }
          .signin-sidebar {
            display: none !important;
            flex: 0 !important;
          }
          .signin-form-wrapper {
            flex: 1 !important;
            height: auto !important;
            min-height: 100vh !important;
            width: 100% !important;
          }
        }
      `}</style>
      <div className="signin-container" style={{ display: 'flex', height: '100vh', width: '100%', fontFamily: 'Segoe UI, sans-serif' }}>
        {/* Left Side - Image */}
        <div className="signin-sidebar" style={{
          flex: 1,
          backgroundImage: "url('/UPSA.jpeg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0,
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.68)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white'
          }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>Welcome Back</h1>
            <p style={{ fontSize: '1.2rem', fontStyle: 'italic' }}>"Excellence in every step"</p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="signin-form-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', minWidth: 0 }}>
          <div style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.5rem', textAlign: 'center' }}>Sign In</h2>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: '2rem' }}>Access your dashboard</p>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 600 }}>Username or Email</label>
              <input type="text" name="username" value={form.username} onChange={handleChange} placeholder="username or email" style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem' }} required />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 600 }}>Password</label>
              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', paddingRight: '2.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '1.2rem' }}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {form.password && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Strength: </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: getPasswordStrength(form.password).color }}>{getPasswordStrength(form.password).level}</span>
                    <div style={{ height: '3px', backgroundColor: '#e5e7eb', borderRadius: '2px', marginTop: '0.2rem', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: getPasswordStrength(form.password).color, width: `${(Object.values(checkPasswordRequirements(form.password)).filter(Boolean).length / 5) * 100}%`, transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.875rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#666' }}>
            <p>Don't have an account? <span onClick={() => navigate('/signup')} style={{ color: '#4F46E5', cursor: 'pointer', fontWeight: 600 }}>Sign Up</span></p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default SignInPage;