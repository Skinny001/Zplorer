'use client';

import { api, type BlockDetail, type TransactionSummary } from '@/lib/api';

interface BlockDetailProps {
  block: BlockDetail | null;
  onSelectTx: (tx: TransactionSummary) => void;
  selectedTxid?: string | null;
}

export function BlockDetailPanel({ block, onSelectTx, selectedTxid }: BlockDetailProps) {
  if (!block) return <div className="text-gray-500 text-center py-8">Click a block to view details</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-700 pb-3">
        <h3 className="text-lg font-semibold">Block #{block.height.toLocaleString()}</h3>
        <span className="text-sm text-gray-500">{api.formatTime(block.time)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-gray-500">Hash:</span> <span className="font-mono ml-2">{api.formatHash(block.hash, 12)}</span></div>
        <div><span className="text-gray-500">Prev:</span> <span className="font-mono ml-2">{api.formatHash(block.previousHash, 12)}</span></div>
        <div><span className="text-gray-500">Size:</span> <span className="ml-2">{api.formatNumber(block.size)} bytes</span></div>
        <div><span className="text-gray-500">Txs:</span> <span className="ml-2">{block.transactions.length}</span></div>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <h4 className="font-medium mb-2">Transactions</h4>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {block.transactions.map((tx) => (
            <button
              key={tx.txid}
              onClick={() => onSelectTx(tx)}
              className={`w-full text-left px-3 py-2 rounded hover:bg-gray-800 transition-colors flex items-center justify-between gap-2 ${
                selectedTxid === tx.txid ? 'bg-gray-800 border border-green-500' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={tx.type === 'shielded' ? 'text-green-400' : 'text-gray-400'}>
                  {tx.type === 'shielded' ? '🛡️' : '🔓'}
                </span>
                <span className="font-mono text-sm truncate">{api.formatHash(tx.txid, 10)}</span>
                <span className="text-xs text-gray-500 capitalize">{tx.type}</span>
              </div>
              {selectedTxid === tx.txid && <span className="text-green-500">▸</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}