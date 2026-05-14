import React, { useEffect, useState } from 'react';
import { enrollFingerprint } from '../apiExtra';
import { FingerprintCapture, ScannerService, ScannerDeviceInfo } from '../scannerService';

const enrollmentSteps = ['Connect scanner', 'Capture primary print', 'Assess quality', 'Store enrollment template'];

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.93)',
  borderRadius: '22px',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 24px 50px rgba(15,23,42,0.16)',
  backdropFilter: 'blur(14px)',
};

const FingerprintEnrollmentPage: React.FC = () => {
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<ScannerDeviceInfo | null>(null);
  const [capture, setCapture] = useState<FingerprintCapture | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    probeDeviceConnection();
  }, []);

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => ctx.close(), 600);
    } catch (error) {
      console.error(error);
    }
  };

  const playErrorSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => ctx.close(), 400);
    } catch (error) {
      console.error(error);
    }
  };

  const probeDeviceConnection = async () => {
    try {
      const connected = await ScannerService.probeConnection();
      setDeviceConnected(connected);
      if (connected) {
        setDeviceInfo(await ScannerService.getDeviceInfo());
      } else {
        setDeviceInfo(null);
      }
    } catch (error) {
      setDeviceConnected(false);
      setDeviceInfo(null);
    }
  };

  const connectScanner = async () => {
    try {
      setStatus('Connecting fingerprint scanner...');
      await ScannerService.connect();
      setDeviceConnected(true);
      setDeviceInfo(await ScannerService.getDeviceInfo());
      setStatus('Fingerprint scanner is ready for enrollment.');
    } catch (error) {
      setDeviceConnected(false);
      setDeviceInfo(null);
      setStatus(error instanceof Error ? error.message : 'Fingerprint support check failed');
    }
  };

  const handleEnroll = async () => {
    if (!studentId.trim()) {
      setStatus('Enter a student ID before starting enrollment.');
      return;
    }
    if (!deviceConnected) {
      setStatus('Connect a fingerprint scanner before starting enrollment.');
      return;
    }

    setLoading(true);
    setStatus('Enrollment capture in progress... Place the finger on the connected scanner when prompted.');
    setCapture(null);
    setScanProgress(8);
    setActiveStep(0);

    const progressTimer = window.setInterval(() => {
      setScanProgress((current) => {
        if (current >= 94) return current;
        return current + 8;
      });
    }, 180);

    const stepTimer = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, enrollmentSteps.length - 1));
    }, 540);

    try {
      const fingerprintData = await ScannerService.capture();
      setCapture(fingerprintData);
      const res = await enrollFingerprint(studentId.trim(), fingerprintData.template);
      setActiveStep(enrollmentSteps.length - 1);
      setScanProgress(100);
      setStatus(`${res.message}. Scanner capture quality ${fingerprintData.quality}%.`);
      playSuccessSound();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Enrollment failed');
      playErrorSound();
    } finally {
      window.clearInterval(progressTimer);
      window.clearInterval(stepTimer);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 68px)',
        width: '100%',
        backgroundImage: 'linear-gradient(135deg, #0b1020 0%, #1e3a8a 50%, #0f766e 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ color: '#A7F3D0', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.82rem' }}>
            Biometric Enrollment
          </div>
          <h1 style={{ color: '#fff', margin: '0.45rem 0 0.5rem', fontSize: '2.35rem' }}>Fingerprint Scanner Registration Console</h1>
          <p style={{ color: '#E2E8F0', margin: 0, maxWidth: '760px', lineHeight: 1.6 }}>
            Register new biometric templates with the connected fingerprint scanner. See device readiness, capture quality, and enrollment status at a glance.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ ...cardStyle, padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#10B981', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Enrollment Bay
                </div>
                <h3 style={{ margin: '0.35rem 0 0', color: '#0F172A', fontSize: '1.5rem' }}>Capture and Quality Review</h3>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 0.9rem',
                borderRadius: '999px',
                background: deviceConnected ? '#DCFCE7' : '#FEE2E2',
                color: deviceConnected ? '#166534' : '#B91C1C',
                fontWeight: 700,
              }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: deviceConnected ? '#22C55E' : '#EF4444' }} />
                {deviceConnected ? 'Scanner ready' : 'Sensor unavailable'}
              </div>
            </div>

            <div style={{
              minHeight: '330px',
              borderRadius: '28px',
              overflow: 'hidden',
              background: 'radial-gradient(circle at center, rgba(16,185,129,0.18), rgba(15,23,42,0.92) 60%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '1px solid rgba(16,185,129,0.24)',
            }}>
              {loading && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: `${scanProgress}%`,
                  background: 'linear-gradient(180deg, rgba(16,185,129,0.06), rgba(16,185,129,0.28))',
                  transition: 'height 0.18s linear',
                }} />
              )}
              <div style={{ textAlign: 'center', position: 'relative' }}>
                <div style={{
                  width: '220px',
                  height: '250px',
                  borderRadius: '36px',
                  border: `2px solid ${loading ? '#6EE7B7' : '#94A3B8'}`,
                  boxShadow: loading ? '0 0 0 12px rgba(110,231,183,0.08), 0 0 45px rgba(16,185,129,0.18)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  transition: 'all 0.25s ease',
                  margin: '0 auto',
                }}>
                  <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke={loading ? '#6EE7B7' : '#CBD5E1'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 6" />
                    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                    <path d="M8.63 7.17A2 2 0 0 1 9.71 5.5" />
                    <path d="M14 11.99V19a4 4 0 0 1-4 4" />
                    <path d="M15.5 19.5C15.5 19 15.5 17 15.5 16a4 4 0 0 0-4-4" />
                    <path d="M21.54 15H21a5 5 0 0 0-5 5v2" />
                  </svg>
                </div>
                <div style={{ marginTop: '1rem', color: '#ECFDF5', fontWeight: 700 }}>
                  {loading ? 'Reading fingerprint ridges for enrollment...' : 'Ready to register a new fingerprint'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontWeight: 700, marginBottom: '0.45rem' }}>
                <span>Enrollment progress</span>
                <span>{scanProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '12px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden' }}>
                <div style={{ width: `${scanProgress}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.2s ease' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ ...cardStyle, padding: '1.35rem' }}>
              <h3 style={{ marginTop: 0, color: '#0F172A' }}>Enrollment Controls</h3>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#334155', fontWeight: 700 }}>Student ID</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Enter student ID"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={loading}
                  style={{ flex: 1, padding: '0.95rem 1rem', borderRadius: '16px', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                />
                <button
                  onClick={handleEnroll}
                  disabled={loading || !deviceConnected}
                  style={{
                    padding: '0 1.25rem',
                    border: 'none',
                    borderRadius: '16px',
                    background: loading || !deviceConnected ? '#94A3B8' : 'linear-gradient(145deg, #10B981, #047857)',
                    color: '#fff',
                    cursor: loading || !deviceConnected ? 'not-allowed' : 'pointer',
                    fontWeight: 800,
                    minWidth: '130px',
                  }}
                >
                  {loading ? 'Enrolling...' : 'Enroll'}
                </button>
              </div>

              <div style={{ marginTop: '1.2rem', display: 'grid', gap: '0.65rem' }}>
                {enrollmentSteps.map((step, index) => {
                  const complete = index <= activeStep && (loading || scanProgress === 100);
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: complete ? '#047857' : '#64748B' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '999px',
                        background: complete ? '#D1FAE5' : '#E2E8F0',
                        color: complete ? '#047857' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}>
                        {index + 1}
                      </div>
                      <span style={{ fontWeight: 700 }}>{step}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={connectScanner}
                  disabled={loading || !deviceConnected}
                  style={{
                    border: '1px solid #A7F3D0',
                    background: '#ECFDF5',
                    color: '#047857',
                    borderRadius: '14px',
                    padding: '0.75rem 1rem',
                    fontWeight: 800,
                    cursor: loading || !deviceConnected ? 'not-allowed' : 'pointer',
                  }}
                >
                  Check fingerprint support
                </button>
                <button
                  onClick={probeDeviceConnection}
                  disabled={loading}
                  style={{
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#334155',
                    borderRadius: '14px',
                    padding: '0.75rem 1rem',
                    fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Check status
                </button>
              </div>
            </div>

            <div style={{ ...cardStyle, padding: '1.35rem' }}>
              <h3 style={{ marginTop: 0, color: '#0F172A' }}>Scanner Telemetry</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div><div style={{ color: '#64748B', fontSize: '0.82rem' }}>Support</div><div style={{ fontWeight: 800, color: '#0F172A' }}>{deviceConnected ? 'Available' : 'Unavailable'}</div></div>
                <div><div style={{ color: '#64748B', fontSize: '0.82rem' }}>Connection</div><div style={{ fontWeight: 800, color: '#0F172A' }}>{deviceInfo?.connectionType || 'Not checked'}</div></div>
                <div><div style={{ color: '#64748B', fontSize: '0.82rem' }}>Device ID</div><div style={{ fontWeight: 800, color: '#0F172A' }}>{deviceInfo?.deviceId || '--'}</div></div>
                <div><div style={{ color: '#64748B', fontSize: '0.82rem' }}>Last Calibration</div><div style={{ fontWeight: 800, color: '#0F172A' }}>{deviceInfo?.lastCalibration || '--'}</div></div>
              </div>
              <div style={{ marginTop: '1rem', color: '#64748B', lineHeight: 1.45 }}>
                Enrollment stays offline until the connected scanner is available and the capture completes.
              </div>
            </div>

            <div style={{ ...cardStyle, padding: '1.35rem' }}>
              <h3 style={{ marginTop: 0, color: '#0F172A' }}>Latest Enrollment Sample</h3>
              {capture ? (
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>Finger</span><strong>{capture.fingerLabel}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>Quality</span><strong>{capture.quality}%</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>Captured</span><strong>{capture.captureTime}</strong></div>
                </div>
              ) : (
                <div style={{ color: '#64748B', lineHeight: 1.5 }}>No capture stored yet. Start enrollment to view the latest biometric credential and capture details.</div>
              )}
            </div>
          </div>
        </div>

        {status && (
          <div style={{
            marginTop: '1.5rem',
            ...cardStyle,
            padding: '1rem 1.25rem',
            borderLeft: status.toLowerCase().includes('failed') || status.toLowerCase().includes('offline') ? '6px solid #EF4444' : '6px solid #10B981',
            color: '#0F172A',
            fontWeight: 700,
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default FingerprintEnrollmentPage;
