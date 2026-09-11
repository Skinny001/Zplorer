'use client';

import { useState, useEffect } from 'react';
import { api, type TxDetail } from '@/lib/api';

interface TxDetailProps {
  txid: string | null;
}

export function TxDetailPanel({ txid }: TxDetailProps) {
  const [data, setData] = useState<TxDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!txid) {
      setData(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    api.tx(txid).then(res => {
      if (mounted) setData(res);
    }).catch(e => {
      if (mounted) setError(e.message);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [txid]);

  if (!txid) return <div className="text-gray-500 text-center py-8">Click a transaction to view details</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Transaction Detail</h3>
      <div className="font-mono text-sm text-green-400 break-all">{txid}</div>
      
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">Error: {error}</p>}
      
      {data && (
        <div className="grid grid-cols-2 gap-4 text-sm mt-4">
          <div><span className="text-gray-500">Type:</span> <span className="ml-2 capitalize">{data.type}</span></div>
          <div><span className="text-gray-500">Confirmations:</span> <span className="ml-2">{api.formatNumber(data.confirmations)}</span></div>
          <div><span className="text-gray-500">Size:</span> <span className="ml-2">{api.formatNumber(data.size)} bytes</span></div>
          <div><span className="text-gray-500">Inputs/Outputs:</span> <span className="ml-2">{data.vinCount} / {data.voutCount}</span></div>
          
          {data.type === 'shielded' && (
            <>
              <div className="col-span-2 border-t border-gray-700 mt-2 pt-2"></div>
              <div><span className="text-gray-500">Shielded Spends:</span> <span className="ml-2">{data.shieldedSpendCount}</span></div>
              <div><span className="text-gray-500">Shielded Outputs:</span> <span className="ml-2">{data.shieldedOutputCount}</span></div>
              {data.orchardActionCount > 0 && (
                <div><span className="text-gray-500">Orchard Actions:</span> <span className="ml-2">{data.orchardActionCount}</span></div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}