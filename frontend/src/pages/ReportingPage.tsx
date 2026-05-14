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
    <div style={{
      minHeight: 'calc(100vh - 68px)',
      width: '100%',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 50%, #0f766e 100%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        @media print {
          .navbar, .no-print { display: none !important; }
          body { background-color: white !important; }
          .print-container { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>
      <h2 style={{ color: '#fff', marginBottom: '1.5rem', textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}>Attendance Reports</h2>
      
      <form className="no-print" onSubmit={handleSearch} style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem', backdropFilter: 'blur(5px)' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Course Code</label>
          <input type="text" value={filters.course} onChange={e => setFilters({...filters, course: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Date</label>
          <input type="date" value={filters.date} onChange={e => setFilters({...filters, date: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '0.6rem 1.5rem', background: '#005fa3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? 'Loading...' : 'Generate Report'}</button>
      </form>

      {searched && (
        <>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ color: '#fff', fontSize: '1.1rem', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
            Report for <strong>{filters.course}</strong> on <strong>{new Date(filters.date).toLocaleDateString()}</strong>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handleExport} style={{ padding: '0.5rem 1rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Export Text</button>
            <button onClick={() => window.print()} style={{ padding: '0.5rem 1rem', background: '#374151', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Print Report</button>
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
                  <div key={index} style={{ marginBottom: '0.5rem', color: '#E5E7EB' }}>{flag}</div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ color: '#86EFAC', fontWeight: 700, marginBottom: '0.5rem' }}>Recommendations</div>
                {(aiReport.recommendations || []).map((item: string, index: number) => (
                  <div key={index} style={{ marginBottom: '0.45rem', color: '#E2E8F0' }}>{item}</div>
                ))}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ color: '#FDE68A', fontWeight: 700, marginBottom: '0.5rem' }}>Absent Today</div>
                {(aiReport.absentToday?.length ? aiReport.absentToday.slice(0, 6) : ['No absences detected.']).map((item: string, index: number) => (
                  <div key={index} style={{ marginBottom: '0.45rem', color: '#E2E8F0' }}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 600 }}>Total Students</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1F2937' }}>{total}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 600 }}>Present</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10B981' }}>{present}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 600 }}>Absent</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#EF4444' }}>{absent}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 600 }}>Attendance Rate</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4F46E5' }}>{percentage}%</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 600 }}>First Arrival</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{firstArrival}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 600 }}>Last Arrival</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D97706' }}>{lastArrival}</div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem', background: 'rgba(229, 231, 235, 0.8)', borderRadius: '9999px', height: '24px', overflow: 'hidden', backdropFilter: 'blur(5px)', display: 'flex' }}>
          <div style={{ 
            width: `${percentage}%`, 
            background: '#10B981',
            height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 'bold',
            transition: 'width 0.5s ease-in-out'
          }}>{percentage > 5 && `${percentage}%`}</div>
          <div style={{ 
            width: `${100 - percentage}%`, 
            background: '#EF4444',
            height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 'bold',
            transition: 'width 0.5s ease-in-out'
          }}>{(100 - percentage) > 5 && `${100 - percentage}%`}</div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden', backdropFilter: 'blur(5px)' }}>
          <div className="no-print" style={{ padding: '1rem', borderBottom: '1px solid #e9ecef', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4B5563', marginRight: '0.5rem' }}>Filter:</span>
            {['All', 'Present', 'Absent'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '9999px',
                  border: '1px solid ' + (statusFilter === status ? '#005fa3' : '#D1D5DB'),
                  background: statusFilter === status ? '#005fa3' : 'transparent',
                  color: statusFilter === status ? '#fff' : '#374151',
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
            <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#495057' }}>Student ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#495057' }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#495057' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#495057' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {displayedReports.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '1rem' }}>{r.studentId}</td>
                  <td style={{ padding: '1rem' }}>{r.name}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', background: r.status === 'Present' ? '#d4edda' : '#f8d7da', color: r.status === 'Present' ? '#155724' : '#721c24' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{r.time}</td>
                </tr>
              ))}
              {displayedReports.length === 0 && <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No records found for this criteria.</td></tr>}
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
