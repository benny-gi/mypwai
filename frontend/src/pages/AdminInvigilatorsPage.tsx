import React, { useState, useEffect } from 'react';
import { fetchInvigilators, createInvigilator, bulkCreateInvigilators, deleteInvigilator, resetInvigilatorPassword } from '../apiExtra';

interface Invigilator {
  id: number;
  username: string;
  email: string | null;
  full_name: string;
  created_at: string;
  is_active?: number;
  deleted_at?: string | null;
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
      loadInvigilators();
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
      loadInvigilators();
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
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
    <div style={{ maxWidth: 1000, margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Invigilator Management</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Create and manage invigilator accounts. Emails are used as usernames. Passwords are auto-generated.
      </p>

      {/* Single Create Form */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Add Single Invigilator</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.9rem' }}>Full Name *</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="e.g. John Mensah"
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.9rem' }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="e.g. john@school.edu"
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={creating}
            style={{ padding: '0.6rem 1.5rem', backgroundColor: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {creating ? 'Creating...' : 'Generate & Create'}
          </button>
        </form>
        {error && <div style={{ color: '#DC2626', marginTop: '0.75rem', fontSize: '0.9rem' }}>{error}</div>}
        {success && !bulkResults && <div style={{ color: '#059669', marginTop: '0.75rem', fontSize: '0.9rem' }}>{success}</div>}
        {generatedPassword && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#FEF3C7', borderRadius: 8, border: '1px solid #FCD34D' }}>
            <strong style={{ color: '#92400E' }}>Generated Password:</strong>{' '}
            <code style={{ fontSize: '1.1rem', fontWeight: 700, background: '#FFFBEB', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{generatedPassword}</code>
            <span style={{ display: 'block', marginTop: '0.3rem', color: '#B45309', fontSize: '0.8rem' }}>
              Copy this password now — it will not be shown again.
            </span>
          </div>
        )}
        {actionPassword && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#E0F2FE', borderRadius: 8, border: '1px solid #7DD3FC' }}>
            <strong style={{ color: '#075985' }}>New Password Issued:</strong>{' '}
            <code style={{ fontSize: '1.1rem', fontWeight: 700, background: '#F0F9FF', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{actionPassword}</code>
            <span style={{ display: 'block', marginTop: '0.3rem', color: '#0369A1', fontSize: '0.8rem' }}>
              This re-enables the account and replaces the previous password.
            </span>
          </div>
        )}
      </div>

      {/* Bulk Upload Section */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Bulk Import Invigilators</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Upload multiple invigilator emails at once. Passwords will be auto-generated for each.
        </p>

        {!bulkMode && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setBulkMode('paste')}
              style={{ padding: '0.6rem 1.5rem', backgroundColor: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              📋 Paste Emails
            </button>
            <button onClick={() => setBulkMode('csv')}
              style={{ padding: '0.6rem 1.5rem', backgroundColor: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              📄 Upload CSV
            </button>
          </div>
        )}

        {bulkMode && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setBulkMode(null); setBulkText(''); }}
                style={{ background: 'transparent', border: '1px solid #ddd', borderRadius: 4, padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                ← Back
              </button>
              <span style={{ color: '#666', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
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
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }} />
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button onClick={handleBulkUpload} disabled={bulkUploading || !bulkText.trim()}
                style={{ padding: '0.6rem 1.5rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                {bulkUploading ? 'Importing...' : `Import ${parseBulkText().length} Invigilator${parseBulkText().length !== 1 ? 's' : ''}`}
              </button>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>
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
                <strong style={{ color: '#059669' }}>{bulkSummary?.created || 0} created</strong>
                {bulkSummary && bulkSummary.skipped > 0 && (
                  <span style={{ color: '#F59E0B', marginLeft: '1rem' }}>
                    ⚠ {bulkSummary.skipped} skipped
                  </span>
                )}
              </div>
              <button onClick={downloadResultsCSV}
                style={{ padding: '0.4rem 1rem', backgroundColor: '#2563EB', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                📥 Download Passwords CSV
              </button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', position: 'sticky', top: 0, borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Full Name</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Password</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: r.status === 'skipped' ? '#FEF2F2' : r.status === 'created' ? '#F0FDF4' : 'transparent' }}>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{r.email}</td>
                      <td style={{ padding: '0.5rem' }}>{r.fullName}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {r.generatedPassword ? (
                          <code style={{ background: '#FFFBEB', padding: '0.15rem 0.4rem', borderRadius: 3, fontWeight: 700 }}>{r.generatedPassword}</code>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {r.status === 'created' ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>✓ Created</span>
                        ) : (
                          <span style={{ color: '#DC2626' }} title={r.reason}>✗ Skipped{r.reason ? ` (${r.reason})` : ''}</span>
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
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Current Invigilators ({invigilators.length})</h3>
        {loading ? (
          <p style={{ color: '#888' }}>Loading...</p>
        ) : invigilators.length === 0 ? (
          <p style={{ color: '#888' }}>No invigilators yet. Add one above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: '#6B7280' }}>Name</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: '#6B7280' }}>Email (Username)</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: '#6B7280' }}>Created</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: '#6B7280' }}></th>
                </tr>
              </thead>
              <tbody>
                {invigilators.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500 }}>{inv.full_name}</td>
                    <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontSize: '0.9rem', color: '#4F46E5' }}>{inv.username || inv.email || '—'}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#888', fontSize: '0.85rem' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button onClick={() => handleResetPassword(inv.id, inv.full_name)}
                          style={{ background: 'transparent', border: '1px solid #93C5FD', color: '#2563EB', borderRadius: 4, padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          Reset Password
                        </button>
                        <button onClick={() => handleDelete(inv.id, inv.full_name)}
                          style={{ background: 'transparent', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 4, padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
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
  );
};

export default AdminInvigilatorsPage;
