'use client';

import { useState, useEffect } from 'react';
import { api, type StatusResponse } from '@/lib/api';

export function StatusStrip() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        const data = await api.status();
        if (mounted) {
          setStatus(data);
          setError(null);
          setConsecutiveFailures(0);
          setIsRetrying(false);
        }
      } catch (e) {
        if (!mounted) return;
        const failures = consecutiveFailures + 1;
        setConsecutiveFailures(failures);
        setIsRetrying(true);
        
        // Only show error after 3 consecutive failures
        if (failures >= 3) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
        
        // Exponential backoff: 5s, 10s, 20s, max 60s
        const delay = Math.min(5000 * Math.pow(2, failures - 1), 60000);
        retryTimeout = setTimeout(fetchStatus, delay);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => { 
      mounted = false; 
      clearInterval(interval);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [consecutiveFailures]);

  // Show cached data with retrying indicator, only show error after 3 failures
  if (error && !status) {
    return (
      <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded">
        ⚠️ Cannot connect to node: {error}
      </div>
    );
  }

  if (!status) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="flex flex-wrap items-center gap-6 text-sm">
      <span className={`flex items-center gap-2 ${status.isSynced ? 'text-green-400' : 'text-yellow-400'}`}>
        {status.isSynced ? '✅ Synced' : '⏳ Syncing'}
      </span>
      <span>Height: <span className="font-mono">{status.syncedHeight.toLocaleString()}</span> / {status.estimatedHeight.toLocaleString()}</span>
      <span>Peers: <span className="font-mono">{status.peerCount}</span></span>
      <span>Mempool: <span className="font-mono">{status.mempoolSize}</span></span>
      <span className="text-gray-500">Diff: {api.formatNumber(status.difficulty)}</span>
      {isRetrying && <span className="text-yellow-400 text-xs">⟳ retrying...</span>}
      {consecutiveFailures > 0 && consecutiveFailures < 3 && (
        <span className="text-yellow-400 text-xs">⚠ {consecutiveFailures}/3 failures</span>
      )}
    </div>
  );
}