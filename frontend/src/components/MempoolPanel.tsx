'use client';

import { useState, useEffect } from 'react';
import { api, type MempoolTx } from '@/lib/api';

export function MempoolPanel() {
  const [data, setData] = useState<{ txs: MempoolTx[]; count: number; shieldedCount: number; transparentCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedTxid, setSelectedTxid] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      try {
        const res = await api.mempool(20);
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

  if (error && !data) return <div className="text-red-400 p-4">Error: {error}</div>;
  if (!data) return <div className="text-gray-500 p-4 text-center">Loading mempool...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mempool ({data.count} pending)</h3>
        <span className="text-sm">
          🛡️ {data.shieldedCount} / 🔓 {data.transparentCount}
        </span>
      </div>

      {(isRetrying || consecutiveFailures > 0) && (
        <div className="text-xs text-yellow-400 mb-2">
          {isRetrying ? '⟳ retrying...' : `⚠ {consecutiveFailures}/3 failures - showing cached`}
        </div>
      )}

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {data.txs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No pending transactions</div>
        ) : (
          data.txs.map((tx) => (
            <button
              key={tx.txid}
              onClick={() => setSelectedTxid(tx.txid)}
              className={`w-full text-left px-3 py-2 rounded hover:bg-gray-800 transition-colors flex items-center justify-between gap-2 ${
                selectedTxid === tx.txid ? 'bg-gray-800 border border-green-500' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={tx.type === 'shielded' ? 'text-green-400' : 'text-gray-400'}>
                  {tx.type === 'shielded' ? '🛡️' : '🔓'}
                </span>
                <span className="font-mono text-sm truncate">{api.formatHash(tx.txid, 10)}</span>
                <span className="text-xs text-gray-500">{api.formatNumber(tx.size)} bytes</span>
                {tx.fee > 0 && (
                  <span className="text-xs text-yellow-400">{api.formatNumber(tx.fee)} ZAT</span>
                )}
              </div>
              {selectedTxid === tx.txid && <span className="text-green-500">▸</span>}
            </button>
          ))
        )}
      </div>

      {selectedTxid && (
        <div className="border-t border-gray-700 pt-4">
          <MempoolTxDetail txid={selectedTxid} onClose={() => setSelectedTxid(null)} />
        </div>
      )}
    </div>
  );
}

function MempoolTxDetail({ txid, onClose }: { txid: string; onClose: () => void }) {
  const [tx, setTx] = useState<MempoolTx | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.mempool(50).then(res => {
      const found = res.txs.find(t => t.txid === txid);
      if (mounted) {
        setTx(found || null);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [txid]);

  if (loading) return <div className="text-gray-500 text-center py-4">Loading...</div>;
  if (!tx) return <div className="text-red-400 text-center py-4">Transaction not found</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Transaction Detail</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
      </div>
      <div className="font-mono text-sm text-green-400 break-all">{tx.txid}</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-gray-500">Type:</span> <span className="ml-2 capitalize">{tx.type}</span></div>
        <div><span className="text-gray-500">Size:</span> <span className="ml-2">{api.formatNumber(tx.size)} bytes</span></div>
        <div><span className="text-gray-500">Fee:</span> <span className="ml-2">{api.formatNumber(tx.fee)} ZAT</span></div>
        <div><span className="text-gray-500">Inputs/Outputs:</span> <span className="ml-2">{tx.vinCount} / {tx.voutCount}</span></div>
        {tx.type === 'shielded' && (
          <>
            <div className="col-span-2 border-t border-gray-700 mt-2 pt-2"></div>
            <div><span className="text-gray-500">Shielded Spends:</span> <span className="ml-2">{tx.shieldedSpendCount}</span></div>
            <div><span className="text-gray-500">Shielded Outputs:</span> <span className="ml-2">{tx.shieldedOutputCount}</span></div>
            {tx.orchardActionCount > 0 && (
              <div><span className="text-gray-500">Orchard Actions:</span> <span className="ml-2">{tx.orchardActionCount}</span></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}