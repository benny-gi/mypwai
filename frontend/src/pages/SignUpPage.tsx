import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup } from '../apiExtra';

const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      await signup({ ...form, username: form.email.trim() });
      alert('Account created successfully! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    }
    setLoading(false);
  };

  const requirements = checkPasswordRequirements(form.password);
  const strength = getPasswordStrength(form.password);
  const progressWidth = (Object.values(requirements).filter(Boolean).length / 5) * 100;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ flex: 1, backgroundImage: "url('/UPSA.jpeg')", backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.68)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', textAlign: 'center', padding: '0 2rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>Get Started</h1>
          <p style={{ fontSize: '1.2rem', fontStyle: 'italic' }}>"Excellence in every step"</p>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', margin: '2rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.5rem', textAlign: 'center' }}>Sign Up</h2>
            <p style={{ color: '#666', textAlign: 'center', marginBottom: '2rem' }}>Create your account</p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{display:'block', marginBottom:'0.5rem', fontWeight: 600}}>Full Name</label>
              <input type="text" name="fullName" value={form.fullName} onChange={handleChange} style={{width:'100%', padding:'0.75rem', border:'1px solid #ddd', borderRadius:'6px', boxSizing: 'border-box'}} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{display:'block', marginBottom:'0.5rem', fontWeight: 600}}>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} style={{width:'100%', padding:'0.75rem', border:'1px solid #ddd', borderRadius:'6px', boxSizing: 'border-box'}} required />
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#6B7280' }}>Your email will also be used as your username.</div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{display:'block', marginBottom:'0.5rem', fontWeight: 600}}>Password</label>
              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} style={{width:'100%', padding:'0.75rem', paddingRight:'2.5rem', border:'1px solid #ddd', borderRadius:'6px', boxSizing: 'border-box'}} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '1.2rem' }}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {form.password && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Strength: </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: strength.color }}>{strength.level}</span>
                    <div style={{ height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', marginTop: '0.3rem', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: strength.color, width: `${progressWidth}%`, transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                    <div style={{ marginBottom: '0.25rem', color: requirements.minLength ? '#10B981' : '#999' }}>
                      {requirements.minLength ? '✓' : '○'} At least 8 characters
                    </div>
                    <div style={{ marginBottom: '0.25rem', color: requirements.hasUppercase ? '#10B981' : '#999' }}>
                      {requirements.hasUppercase ? '✓' : '○'} Uppercase letter (A-Z)
                    </div>
                    <div style={{ marginBottom: '0.25rem', color: requirements.hasLowercase ? '#10B981' : '#999' }}>
                      {requirements.hasLowercase ? '✓' : '○'} Lowercase letter (a-z)
                    </div>
                    <div style={{ marginBottom: '0.25rem', color: requirements.hasNumber ? '#10B981' : '#999' }}>
                      {requirements.hasNumber ? '✓' : '○'} Number (0-9)
                    </div>
                    <div style={{ color: requirements.hasSpecial ? '#10B981' : '#999' }}>
                      {requirements.hasSpecial ? '✓' : '○'} Special character (!@#$%^&*)
                    </div>
                  </div>
                </div>
              )}
            </div>
            {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.875rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#666' }}>
            <p>Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#4F46E5', cursor: 'pointer', fontWeight: 600 }}>Sign In</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;