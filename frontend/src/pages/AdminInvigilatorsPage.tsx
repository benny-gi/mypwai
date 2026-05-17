import React, { useState, useEffect } from 'react';
import { fetchInvigilators, createInvigilator, bulkCreateInvigilators, deleteInvigilator, resetInvigilatorPassword, bulkResetInvigilatorPasswords } from '../apiExtra';

interface Invigilator {
  id: number;
  username: string;
  email: string | null;
  full_name: string;
  created_at: string;
  is_active?: number;
  deleted_at?: string | null;
  temp_password?: string | null;
  temp_password_expires_at?: string | null;
}

interface BulkResult {
  email: string;
  fullName: string;
  username: string;
  generatedPassword: string;
  status: 'created' | 'skipped';
  reason?: string;
}

const AdminInvigilatorsPage: React.FC = () => {
  const [invigilators, setInvigilators] = useState<Invigilator[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkResetting, setBulkResetting] = useState(false);
  const [bulkResetResults, setBulkResetResults] = useState<{ id: number; email: string; fullName: string; generatedPassword: string; success: boolean; reason?: string }[] | null>(null);
  const [bulkResetSummary, setBulkResetSummary] = useState<{ total: number; succeeded: number; failed: number } | null>(null);

  // Bulk upload state
  const [bulkMode, setBulkMode] = useState<'paste' | 'csv' | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkSummary, setBulkSummary] = useState<{ total: number; created: number; skipped: number } | null>(null);

  const loadInvigilators = async () => {
    try {
      const data = await fetchInvigilators();
      setInvigilators(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load invigilators');
    }
    setLoading(false);
  };

  useEffect(() => { loadInvigilators(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setGeneratedPassword('');
    setActionPassword('');
    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    setCreating(true);
    try {
      const result = await createInvigilator(fullName.trim(), email.trim().toLowerCase());
      setGeneratedPassword(result.generatedPassword || '');
      setSuccess(`Invigilator "${fullName}" created successfully!`);
      setFullName('');
      setEmail('');
      // Refresh list then ensure the newly-created invigilator row contains the issued password
      await loadInvigilators();
      if (result.generatedPassword && result.invigilator?.email) {
        setInvigilators(prev => prev.map(inv => inv.email === result.invigilator.email ? { ...inv, temp_password: result.generatedPassword } : inv));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create invigilator');
    }
    setCreating(false);
  };

  // ── Bulk Upload Handlers ──

  const parseBulkText = (): { fullName: string; email: string }[] => {
    if (bulkMode === 'csv') {
      // Parse CSV: first line is header, columns: fullName,email or name,email
      const lines = bulkText.trim().split('\n');
      if (lines.length < 2) return [];
      const header = lines[0].toLowerCase();
      const cols = header.split(',').map(c => c.trim());
      const nameIdx = cols.findIndex(c => c === 'fullname' || c === 'name' || c === 'full_name');
      const emailIdx = cols.findIndex(c => c === 'email' || c === 'e-mail' || c === 'mail');
      if (emailIdx === -1) return [];

      return lines.slice(1)
        .map(line => {
          const vals = line.split(',').map(v => v.trim());
          const emailVal = vals[emailIdx] || '';
          let nameVal = nameIdx >= 0 ? vals[nameIdx] || '' : '';
          // If no name column, derive name from email prefix
          if (!nameVal && emailVal) {
            nameVal = emailVal.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }
          return { fullName: nameVal, email: emailVal };
        })
        .filter(e => e.email);
    } else {
      // Paste mode: one per line, format: "email" or "Full Name <email>" or "email,Full Name"
      return bulkText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
          // "Full Name <email@example.com>"
          const bracketMatch = line.match(/^(.+?)\s*<(.+?)>\s*$/);
          if (bracketMatch) {
            return { fullName: bracketMatch[1].trim(), email: bracketMatch[2].trim().toLowerCase() };
          }
          // "email@example.com, Full Name"
          const commaMatch = line.match(/^([^,]+),\s*(.+)$/);
          if (commaMatch && commaMatch[1].includes('@')) {
            return { fullName: commaMatch[2].trim(), email: commaMatch[1].trim().toLowerCase() };
          }
          // "Full Name, email@example.com"
          const commaMatch2 = line.match(/^(.+),\s*([^,@]+@[^,]+)$/);
          if (commaMatch2) {
            return { fullName: commaMatch2[1].trim(), email: commaMatch2[2].trim().toLowerCase() };
          }
          // Just email
          if (line.includes('@')) {
            const nameFromEmail = line.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return { fullName: nameFromEmail, email: line.toLowerCase() };
          }
          return null;
        })
        .filter((e): e is { fullName: string; email: string } => e !== null && !!e.email);
    }
  };

  const handleBulkUpload = async () => {
    setError('');
    setSuccess('');
    setBulkResults(null);
    setBulkSummary(null);

    const entries = parseBulkText();
    if (entries.length === 0) {
      setError('No valid entries found. Provide at least one email address.');
      return;
    }

    setBulkUploading(true);
    try {
      const result = await bulkCreateInvigilators(entries);
      setBulkResults(result.results || []);
      setBulkSummary(result.summary || { total: entries.length, created: 0, skipped: 0 });
      setSuccess(`Bulk import complete: ${result.summary?.created || 0} created, ${result.summary?.skipped || 0} skipped.`);
      setBulkText('');
      setBulkMode(null);
      loadInvigilators();
    } catch (err: any) {
      setError(err.message || 'Bulk upload failed');
    }
    setBulkUploading(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Disable invigilator "${name}"? They will not be able to sign in until a new password is issued.`)) return;
    try {
      await deleteInvigilator(id);
      loadInvigilators();
    } catch (err: any) {
      setError(err.message || 'Failed to delete invigilator');
    }
  };

  const handleResetPassword = async (id: number, name: string) => {
    if (!window.confirm(`Issue a new password for "${name}" and re-enable access?`)) return;
    setError('');
    setSuccess('');
    setGeneratedPassword('');
    setActionPassword('');
    try {
      const result = await resetInvigilatorPassword(id);
      setActionPassword(result.generatedPassword || '');
      setSuccess(`New password issued for "${name}".`);
      // Refresh list then ensure the reset invigilator row contains the issued password
      await loadInvigilators();
      if (result.generatedPassword) {
        setInvigilators(prev => prev.map(inv => inv.id === id ? { ...inv, temp_password: result.generatedPassword } : inv));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
  };

  const toggleInvigilatorSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === invigilators.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invigilators.map(inv => inv.id)));
    }
  };

  const handleBulkReset = async () => {
    if (selectedIds.size === 0) {
      setError('No invigilators selected');
      return;
    }
    if (!window.confirm(`Reset passwords for ${selectedIds.size} invigilator(s)?`)) return;
    
    setError('');
    setSuccess('');
    setBulkResetResults(null);
    setBulkResetSummary(null);
    setBulkResetting(true);

    try {
      const result = await bulkResetInvigilatorPasswords(Array.from(selectedIds));
      setBulkResetResults(result.results || []);
      setBulkResetSummary(result.summary || { total: selectedIds.size, succeeded: 0, failed: 0 });
      setSuccess(`Bulk reset complete: ${result.summary?.succeeded || 0} succeeded, ${result.summary?.failed || 0} failed.`);
      setSelectedIds(new Set());
      await loadInvigilators();
      // Update temp_password for succeeded resets
      if (result.results) {
        setInvigilators(prev => {
          let updated = [...prev];
          for (const res of result.results) {
            if (res.success) {
              updated = updated.map(inv => inv.id === res.id ? { ...inv, temp_password: res.generatedPassword } : inv);
            }
          }
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Bulk reset failed');
    }
    setBulkResetting(false);
  };

  const downloadBulkResetCSV = () => {
    if (!bulkResetResults) return;
    const header = 'Email,Full Name,Password,Status,Reason';
    const rows = bulkResetResults.map(r =>
      `"${r.email}","${r.fullName}","${r.generatedPassword || ''}","${r.success ? 'Success' : 'Failed'}","${r.reason || ''}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_reset_passwords.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadResultsCSV = () => {
    if (!bulkResults) return;
    const header = 'Email,Full Name,Password,Status,Reason';
    const rows = bulkResults.map(r =>
      `"${r.email}","${r.fullName}","${r.generatedPassword || ''}","${r.status}","${r.reason || ''}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invigilator_passwords.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-enter" style={{
      minHeight: 'calc(100vh - 68px)',
      width: '100%',
      padding: '2rem'
    }}>
    <div style={{ maxWidth: 1000, margin: '0 auto', fontFamily: 'Inter, Segoe UI, sans-serif' }}>
      <h1 className="animate-fade-in-up" style={{ fontSize: '2.25rem', marginBottom: '0.5rem', color: 'var(--accent)', fontWeight: 700 }}>Invigilator Management</h1>
      <p className="animate-fade-in-up delay-1" style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
        Create and manage invigilator accounts. Emails are used as usernames. Passwords are auto-generated.
      </p>

      {/* Single Create Form */}
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--accent)' }}>Add Single Invigilator</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Full Name *</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="e.g. John Mensah"
              className="input" />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="e.g. john@school.edu"
              className="input" />
          </div>
          <button type="submit" disabled={creating}
            className="btn btn-primary">
            {creating ? 'Creating...' : 'Generate & Create'}
          </button>
        </form>
        {error && <div style={{ color: 'var(--upsa-danger)', marginTop: '0.75rem', fontSize: '0.9rem', background: 'var(--upsa-danger-light)', padding: '0.75rem', borderRadius: 12 }}>{error}</div>}
        {success && !bulkResults && <div style={{ color: 'var(--upsa-success)', marginTop: '0.75rem', fontSize: '0.9rem', background: 'var(--upsa-success-light)', padding: '0.75rem', borderRadius: 12 }}>{success}</div>}
        {generatedPassword && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--upsa-success-light)', borderRadius: 12, border: '1px solid #A7F3D0' }}>
            <strong style={{ color: 'var(--upsa-success)' }}>Generated Password:</strong>{' '}
            <code style={{ fontSize: '1.1rem', fontWeight: 700, background: '#D1FAE5', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{generatedPassword}</code>
            <span style={{ display: 'block', marginTop: '0.3rem', color: 'var(--upsa-success)', fontSize: '0.8rem' }}>
              Copy this password now — it will not be shown again.
            </span>
          </div>
        )}
        {actionPassword && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--upsa-info-light)', borderRadius: 12, border: '1px solid #93C5FD' }}>
            <strong style={{ color: 'var(--upsa-info)' }}>New Password Issued:</strong>{' '}
            <code style={{ fontSize: '1.1rem', fontWeight: 700, background: '#EFF6FF', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{actionPassword}</code>
            <span style={{ display: 'block', marginTop: '0.3rem', color: 'var(--upsa-info)', fontSize: '0.8rem' }}>
              This re-enables the account and replaces the previous password.
            </span>
          </div>
        )}
      </div>

      {/* Bulk Upload Section */}
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--accent)' }}>Bulk Import Invigilators</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Upload multiple invigilator emails at once. Passwords will be auto-generated for each.
        </p>

        {!bulkMode && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setBulkMode('paste')}
              className="btn btn-primary">
              📋 Paste Emails
            </button>
            <button onClick={() => setBulkMode('csv')}
              className="btn btn-gold">
              📄 Upload CSV
            </button>
          </div>
        )}

        {bulkMode && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setBulkMode(null); setBulkText(''); }}
                className="btn-outline-action"
                style={{ fontSize: '0.85rem' }}>
                ← Back
              </button>
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                {bulkMode === 'paste' ? 'Paste emails (one per line)' : 'Paste CSV content (columns: fullName, email)'}
              </span>
            </div>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
              placeholder={
                bulkMode === 'paste'
                  ? 'john.mensah@school.edu\njane.doe@school.edu\n"Dr. Smith" <dr.smith@school.edu>\nkofi@school.edu, Kofi Adu'
                  : 'fullName,email\nJohn Mensah,john.mensah@school.edu\nJane Doe,jane.doe@school.edu'
              }
              rows={8}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 12, fontFamily: 'monospace', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }} />
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button onClick={handleBulkUpload} disabled={bulkUploading || !bulkText.trim()}
                className="btn btn-success">
                {bulkUploading ? 'Importing...' : `Import ${parseBulkText().length} Invigilator${parseBulkText().length !== 1 ? 's' : ''}`}
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {bulkText.trim() ? `${parseBulkText().length} entries detected` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Bulk Results */}
        {bulkResults && bulkResults.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <strong style={{ color: 'var(--upsa-success)' }}>{bulkSummary?.created || 0} created</strong>
                {bulkSummary && bulkSummary.skipped > 0 && (
                  <span style={{ color: 'var(--upsa-warning)', marginLeft: '1rem' }}>
                    ⚠ {bulkSummary.skipped} skipped
                  </span>
                )}
              </div>
              <button onClick={downloadResultsCSV}
                className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                📥 Download Passwords CSV
              </button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', position: 'sticky', top: 0, borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Full Name</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Password</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', backgroundColor: r.status === 'skipped' ? '#7F1D1D' : r.status === 'created' ? '#134E4A' : 'transparent' }}>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{r.email}</td>
                      <td style={{ padding: '0.5rem' }}>{r.fullName}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {r.generatedPassword ? (
                          <code style={{ background: '#FFFBEB', padding: '0.15rem 0.4rem', borderRadius: 3, fontWeight: 700 }}>{r.generatedPassword}</code>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {r.status === 'created' ? (
                          <span style={{ color: '#065F46', fontWeight: 600 }}>✓ Created</span>
                        ) : (
                          <span style={{ color: '#EF4444' }} title={r.reason}>✗ Skipped{r.reason ? ` (${r.reason})` : ''}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Invigilator List */}
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--accent)' }}>Current Invigilators ({invigilators.length})</h3>
        
        {/* Bulk Reset Section */}
        {invigilators.length > 0 && (
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'No selection'}
            </div>
            <button onClick={handleBulkReset} disabled={bulkResetting || selectedIds.size === 0}
              className="btn btn-danger" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
              {bulkResetting ? 'Resetting...' : `Reset ${selectedIds.size} Password${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())}
                className="btn-ghost" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                Clear Selection
              </button>
            )}
          </div>
        )}

        {/* Bulk Reset Results */}
        {bulkResetResults && bulkResetResults.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <strong style={{ color: 'var(--upsa-success)' }}>{bulkResetSummary?.succeeded || 0} succeeded</strong>
                {bulkResetSummary && bulkResetSummary.failed > 0 && (
                  <span style={{ color: 'var(--upsa-warning)', marginLeft: '1rem' }}>
                    ⚠ {bulkResetSummary.failed} failed
                  </span>
                )}
              </div>
              <button onClick={downloadBulkResetCSV}
                className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                📥 Download Results CSV
              </button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', position: 'sticky', top: 0, borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Full Name</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>New Password</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResetResults.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', backgroundColor: r.success ? '#134E4A' : '#7F1D1D' }}>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{r.email}</td>
                      <td style={{ padding: '0.5rem' }}>{r.fullName}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {r.generatedPassword ? (
                          <code style={{ background: '#FFFBEB', padding: '0.15rem 0.4rem', borderRadius: 3, fontWeight: 700 }}>{r.generatedPassword}</code>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {r.success ? (
                          <span style={{ color: '#065F46', fontWeight: 600 }}>✓ Success</span>
                        ) : (
                          <span style={{ color: '#EF4444' }} title={r.reason}>✗ Failed{r.reason ? ` (${r.reason})` : ''}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invigilators Table */}
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading...</p>
        ) : invigilators.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No invigilators yet. Add one above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', width: '30px' }}>
                    <input type="checkbox" checked={selectedIds.size === invigilators.length && invigilators.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }} />
                  </th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Name</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email (Username)</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Created</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Password</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}></th>
                </tr>
              </thead>
              <tbody>
                {invigilators.map(inv => (
                  <tr key={inv.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)', backgroundColor: selectedIds.has(inv.id) ? 'rgba(255,182,6,0.08)' : 'transparent' }}>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <input type="checkbox" checked={selectedIds.has(inv.id)}
                        onChange={() => toggleInvigilatorSelection(inv.id)}
                        style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500 }}>
                      <div>{inv.full_name}</div>
                      {inv.created_at && (
                        <div style={{ fontSize: '0.75rem', color: '#FCD34D', marginTop: '0.25rem' }}>
                          Created: {new Date(inv.created_at).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--accent)' }}>{inv.username || inv.email || '—'}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace' }}>
                      {inv.temp_password ? (
                        <div>
                          <code style={{ background: '#FFFBEB', padding: '0.15rem 0.4rem', borderRadius: 3, fontWeight: 700 }}>{inv.temp_password}</code>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button onClick={() => handleResetPassword(inv.id, inv.full_name)}
                      className="btn-outline-action btn-outline-action--info">
                      Reset Password
                    </button>
                    <button onClick={() => handleDelete(inv.id, inv.full_name)}
                      className="btn-outline-action btn-outline-action--danger">
                      Disable
                    </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default AdminInvigilatorsPage;
