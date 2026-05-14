import React, { useEffect, useState } from 'react';
import { onSyncEvent, SyncEvent, getLastSyncTime, isSyncInProgress, syncToMySQL } from './offlineSync';

const SyncStatusBanner: React.FC = () => {
  const [status, setStatus] = useState<{
    type: 'idle' | 'syncing' | 'success' | 'error' | 'offline';
    message: string;
    lastSync: string | null;
  }>({
    type: 'idle',
    message: 'Sync idle',
    lastSync: null,
  });

  useEffect(() => {
    // Update status based on sync events
    const unsubscribe = onSyncEvent((event: SyncEvent) => {
      switch (event.type) {
        case 'sync-started':
          setStatus({
            type: 'syncing',
            message: '🔄 Syncing data to MySQL database...',
            lastSync: getLastSyncTime()?.toLocaleTimeString() || null,
          });
          break;
        case 'sync-completed':
          setStatus({
            type: 'success',
            message: event.details || '✅ All data synced to MySQL successfully',
            lastSync: event.timestamp.toLocaleTimeString(),
          });
          // Auto-hide success after 5 seconds
          setTimeout(() => {
            setStatus(prev => prev.type === 'success' ? { ...prev, type: 'idle', message: 'All data saved to MySQL' } : prev);
          }, 5000);
          break;
        case 'sync-skipped':
          setStatus({
            type: 'idle',
            message: 'Sync skipped (already in progress)',
            lastSync: getLastSyncTime()?.toLocaleTimeString() || null,
          });
          break;
        case 'sync-failed':
          setStatus({
            type: 'error',
            message: event.details || '❌ Failed to sync to MySQL',
            lastSync: getLastSyncTime()?.toLocaleTimeString() || null,
          });
          break;
        case 'backend-offline':
          setStatus({
            type: 'offline',
            message: '⚠️ Backend offline - data saved locally. Will sync when backend is available.',
            lastSync: getLastSyncTime()?.toLocaleTimeString() || null,
          });
          break;
        case 'backend-online':
          setStatus({
            type: 'idle',
            message: 'Backend is online',
            lastSync: getLastSyncTime()?.toLocaleTimeString() || null,
          });
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Style based on status type
  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      padding: '8px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '13px',
      fontWeight: 500,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'all 0.3s ease',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
    };

    switch (status.type) {
      case 'syncing':
        return { ...base, backgroundColor: '#DBEAFE', color: '#1E40AF', borderTop: '2px solid #3B82F6' };
      case 'success':
        return { ...base, backgroundColor: '#DCFCE7', color: '#166534', borderTop: '2px solid #22C55E' };
      case 'error':
        return { ...base, backgroundColor: '#FEE2E2', color: '#991B1B', borderTop: '2px solid #EF4444' };
      case 'offline':
        return { ...base, backgroundColor: '#FEF3C7', color: '#92400E', borderTop: '2px solid #F59E0B' };
      default:
        return { ...base, backgroundColor: '#F8FAFC', color: '#64748B', borderTop: '2px solid #CBD5E1' };
    }
  };

  // Don't show anything if idle and never synced
  if (status.type === 'idle' && !status.lastSync && !isSyncInProgress()) {
    return null;
  }

  return (
    <div style={getStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {status.type === 'syncing' && (
          <span style={{
            width: '12px', height: '12px',
            border: '2px solid #3B82F6',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'syncSpin 0.8s linear infinite',
            display: 'inline-block',
          }} />
        )}
        <span>{status.message}</span>
        {status.lastSync && (
          <span style={{ opacity: 0.7, marginLeft: '8px' }}>
            (Last sync: {status.lastSync})
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {status.lastSync && (
          <button
            onClick={() => syncToMySQL()}
            disabled={isSyncInProgress()}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              cursor: isSyncInProgress() ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              opacity: isSyncInProgress() ? 0.5 : 1,
            }}
          >
            {isSyncInProgress() ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
      <style>{`
        @keyframes syncSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SyncStatusBanner;
