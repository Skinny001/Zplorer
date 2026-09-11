'use client';

import { useState, useEffect } from 'react';
import { api, type BlocksLatestResponse } from '@/lib/api';

export function ShieldedRatio() {
  const [data, setData] = useState<BlocksLatestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      try {
        const res = await api.latestBlocks(5);
        if (mounted) {
          setData(res);
          setError(null);
          setConsecutiveFailures(0);
          setIsRetrying(false);
        }
      } catch (e) {
        if (!mounted) return;
        const failures = consecutiveFailures + 1;
        setConsecutiveFailures(failures);
        setIsRetrying(true);
        
        if (failures >= 3) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
        
        const delay = Math.min(5000 * Math.pow(2, failures - 1), 60000);
        retryTimeout = setTimeout(fetchData, delay);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => { 
      mounted = false; 
      clearInterval(interval);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [consecutiveFailures]);

  if (error && !data) {
    return <div className="text-red-400">Error: {error}</div>;
  }

  if (!data) return <div className="text-gray-500">Loading...</div>;

  const pct = (data.shieldedRatio * 100).toFixed(1);
  const shieldedTotal = data.blocks.reduce((sum, b) => sum + b.shieldedCount, 0);
  const total = data.blocks.reduce((sum, b) => sum + b.txCount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">🛡️ {pct}% of recent activity is shielded</span>
        <span className="text-sm text-gray-500">{shieldedTotal} / {total} txs (last 5 blocks)</span>
      </div>
      <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${data.shieldedRatio * 100}%` }}
        />
      </div>
      {isRetrying && <span className="text-yellow-400 text-xs">⟳ retrying...</span>}
      {consecutiveFailures > 0 && consecutiveFailures < 3 && (
        <span className="text-yellow-400 text-xs">⚠ {consecutiveFailures}/3 failures</span>
      )}
    </div>
  );
}