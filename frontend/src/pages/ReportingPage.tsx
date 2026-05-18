import React, { useState } from 'react';
import { fetchAIReport, fetchReports } from '../apiExtra';

const ReportingPage: React.FC = () => {
  const [filters, setFilters] = useState({ course: 'CSC101', date: '2026-03-01' });
  const [reports, setReports] = useState<any[]>([]);
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const [data, aiData] = await Promise.all([
        fetchReports(filters.course, filters.date),
        fetchAIReport(),
      ]);
      setReports(data);
      setAiReport(aiData);
      setSearched(true);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const total = reports.length;
  const present = reports.filter(r => r.status === 'Present').length;
  const absent = total - present;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  const presentTimes = reports
    .filter(r => r.status === 'Present' && r.time)
    .map(r => r.time)
    .sort();
  const firstArrival = presentTimes.length > 0 ? presentTimes[0] : '-';
  const lastArrival = presentTimes.length > 0 ? presentTimes[presentTimes.length - 1] : '-';

  const displayedReports = reports.filter(r => {
    if (statusFilter === 'All') return true;
    return r.status === statusFilter;
  });

    const handleExport = () => {
    // Build a formatted text table with columns
    const reportLines: string[] = [];
    
    // Header
    reportLines.push('='.repeat(62));
    reportLines.push('  ATTENDANCE REPORT');
    reportLines.push('='.repeat(62));
    reportLines.push(`  Course: ${filters.course}     Date: ${filters.date}`);
    reportLines.push(`  Generated: ${new Date().toLocaleString()}`);
    reportLines.push('');
    
    // Summary section
    reportLines.push('  SUMMARY');
    reportLines.push('  ' + '-'.repeat(20));
    reportLines.push(`  Total Students:    ${reports.length}`);
    reportLines.push(`  Present:           ${reports.filter(r => r.status === 'Present').length}`);
    reportLines.push(`  Absent:            ${reports.filter(r => r.status === 'Absent').length}`);
    reportLines.push(`  Attendance Rate:   ${reports.length > 0 ? Math.round((reports.filter(r => r.status === 'Present').length / reports.length) * 100) : 0}%`);
    reportLines.push('');
    
    // Table header row
    const separator = '  +' + '-'.repeat(14) + '+' + '-'.repeat(22) + '+' + '-'.repeat(10) + '+' + '-'.repeat(10) + '+';
    const headerRow = '  | Student ID' + ' '.repeat(4) + '| Name' + ' '.repeat(18) + '| Status' + ' '.repeat(4) + '| Time' + ' '.repeat(6) + '|';
    
    reportLines.push(separator);
    reportLines.push(headerRow);
    reportLines.push(separator);
    
    // Table data rows
    reports.forEach(r => {
      const id = (r.studentId || '').padEnd(14).substring(0, 14);
      const name = (r.name || '').padEnd(22).substring(0, 22);
      const status = (r.status || '').padEnd(10).substring(0, 10);
      const time = (r.time || '').padEnd(10).substring(0, 10);
      reportLines.push(`  | ${id}| ${name}| ${status}| ${time}|`);
    });
    
    reportLines.push(separator);
    reportLines.push('');
    reportLines.push('  -- End of Report --');
    
    const textContent = reportLines.join('\n');
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_report_${filters.course}_${filters.date}.txt`;
    link.click();
  };

  return (
    <div className="page-enter" style={{ minHeight: 'calc(100vh - 68px)', width: '100%' }}>
      <div className="page-container">
      <style>{`
        @media print {
          .navbar, .no-print { display: none !important; }
          body { background-color: white !important; }
          .print-container { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>
      <h2 className="animate-fade-in-up" style={{ marginBottom: '1rem', color: 'var(--accent)' }}>Attendance Reports</h2>
      
      <form className="no-print card" onSubmit={handleSearch} style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem', borderTop: '3px solid var(--upsa-navy)' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Course Code</label>
          <input type="text" value={filters.course} onChange={e => setFilters({...filters, course: e.target.value})} className="input" style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</label>
          <input type="date" value={filters.date} onChange={e => setFilters({...filters, date: e.target.value})} className="input" style={{ width: '100%' }} />
        </div>
        <button type="submit" disabled={loading} className="btn btn-secondary">{loading ? 'Loading...' : 'Generate Report'}</button>
      </form>

      {searched && (
        <>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.05rem', color: 'var(--text)' }}>
            Report for <strong>{filters.course}</strong> on <strong>{new Date(filters.date).toLocaleDateString()}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={handleExport}>Export Text</button>
            <button className="btn" onClick={() => window.print()}>Print Report</button>
          </div>
        </div>
        {aiReport && (
          <div style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.82)', color: '#fff', padding: '1.5rem', borderRadius: '14px', boxShadow: '0 12px 24px rgba(15, 23, 42, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '260px' }}>
                <div style={{ fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93C5FD', fontWeight: 700, marginBottom: '0.5rem' }}>AI Summary</div>
                <div style={{ fontSize: '1.05rem', lineHeight: 1.5 }}>{aiReport.overview}</div>
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FCA5A5', fontWeight: 700, marginBottom: '0.5rem' }}>Risk Flags</div>
                {(aiReport.riskFlags?.length ? aiReport.riskFlags : ['No major risk flags in the current dataset.']).map((flag: string, index: number) => (
                  <div key={index} style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>{flag}</div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--border)', borderRadius: '16px', padding: '1rem' }}>
                <div style={{ color: '#86EFAC', fontWeight: 700, marginBottom: '0.5rem' }}>Recommendations</div>
                {(aiReport.recommendations || []).map((item: string, index: number) => (
                  <div key={index} style={{ marginBottom: '0.45rem', color: 'var(--text)' }}>{item}</div>
                ))}
              </div>
              <div style={{ background: 'var(--border)', borderRadius: '16px', padding: '1rem' }}>
                <div style={{ color: '#FDE68A', fontWeight: 700, marginBottom: '0.5rem' }}>Absent Today</div>
                {(aiReport.absentToday?.length ? aiReport.absentToday.slice(0, 6) : ['No absences detected.']).map((item: string, index: number) => (
                  <div key={index} style={{ marginBottom: '0.45rem', color: 'var(--text)' }}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 700 }}>Total Students</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)' }}>{total}</div>
          </div>
          <div style={{ background: 'var(--card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 700 }}>Present</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#5EEAD4' }}>{present}</div>
          </div>
          <div style={{ background: 'var(--card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 700 }}>Absent</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FCA5A5' }}>{absent}</div>
          </div>
          <div style={{ background: 'var(--card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 700 }}>Attendance Rate</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{percentage}%</div>
          </div>
          <div style={{ background: 'var(--card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 700 }}>First Arrival</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#5EEAD4' }}>{firstArrival}</div>
          </div>
          <div style={{ background: 'var(--card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 700 }}>Last Arrival</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FCD34D' }}>{lastArrival}</div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem', background: 'var(--border)', borderRadius: '9999px', height: '24px', overflow: 'hidden', display: 'flex' }}>
          <div style={{ 
            width: `${percentage}%`, 
            background: 'var(--upsa-success)',
            height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 'bold',
            transition: 'width 0.5s ease-in-out'
          }}>{percentage > 5 && `${percentage}%`}</div>
          <div style={{ 
            width: `${100 - percentage}%`, 
            background: 'var(--upsa-danger)',
            height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 'bold',
            transition: 'width 0.5s ease-in-out'
          }}>{(100 - percentage) > 5 && `${100 - percentage}%`}</div>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', overflow: 'hidden', border: '1px solid var(--border)', borderTop: '3px solid var(--upsa-navy)' }}>
          <div className="no-print" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Filter:</span>
            {['All', 'Present', 'Absent'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '9999px',
                  border: '1px solid ' + (statusFilter === status ? 'var(--accent)' : 'var(--border)'),
                  background: statusFilter === status ? 'var(--accent)' : 'transparent',
                  color: statusFilter === status ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                {status}
              </button>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '2px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Student ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {displayedReports.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem' }}>{r.studentId}</td>
                  <td style={{ padding: '1rem' }}>{r.name}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', background: r.status === 'Present' ? '#134E4A' : '#7F1D1D', color: r.status === 'Present' ? '#5EEAD4' : '#FCA5A5' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{r.time}</td>
                </tr>
              ))}
              {displayedReports.length === 0 && <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No records found for this criteria.</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}
      </div>
    </div>
  );
};
export default ReportingPage;
