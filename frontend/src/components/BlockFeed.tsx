'use client';

import { useState, useEffect } from 'react';
import { api, type BlocksLatestResponse, type BlockSummary } from '@/lib/api';

interface BlockFeedProps {
  onSelectBlock: (block: BlockSummary) => void;
  selectedHeight?: number;
}

export function BlockFeed({ onSelectBlock, selectedHeight }: BlockFeedProps) {
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

  if (error && !data) return <div className="text-red-400">Error: {error}</div>;
  if (!data) return <div className="text-gray-500">Loading blocks...</div>;

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {(isRetrying || consecutiveFailures > 0) && (
        <div className="px-3 py-1 text-xs text-yellow-400 border-b border-gray-700">
          {isRetrying ? '⟳ retrying...' : `⚠ {consecutiveFailures}/3 failures - showing cached`}
        </div>
      )}
      {data.blocks.map((block) => (
        <button
          key={block.hash}
          onClick={() => onSelectBlock(block)}
          className={`w-full text-left px-3 py-2 rounded hover:bg-gray-800 transition-colors flex items-center justify-between gap-2 ${
            selectedHeight === block.height ? 'bg-gray-800 border border-green-500' : ''
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">#{block.height.toLocaleString()}</span>
              <span className="text-green-400 text-sm">🛡️{block.shieldedCount}/{block.txCount}</span>
              <span className="text-gray-500 text-xs">{api.formatTime(block.time)}</span>
            </div>
            <div className="font-mono text-xs text-gray-600 truncate">{api.formatHash(block.hash, 10)}</div>
          </div>
          {selectedHeight === block.height && <span className="text-green-500">▸</span>}
        </button>
      ))}
    </div>
  );
}