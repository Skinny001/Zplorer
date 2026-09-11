'use client';

import { useState } from 'react';
import { ShieldedRatio } from '@/components/ShieldedRatio';
import { StatusStrip } from '@/components/StatusStrip';
import { SearchBar } from '@/components/SearchBar';
import { BlockFeed } from '@/components/BlockFeed';
import { BlockDetailPanel } from '@/components/BlockDetail';
import { TxDetailPanel } from '@/components/TxDetail';
import { MempoolPanel } from '@/components/MempoolPanel';
import { api, type BlockSummary, type TransactionSummary, type BlockDetail } from '@/lib/api';

export default function Home() {
  const [selectedBlock, setSelectedBlock] = useState<BlockSummary | null>(null);
  const [blockDetail, setBlockDetail] = useState<BlockDetail | null>(null);
  const [selectedTxid, setSelectedTxid] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'blocks' | 'mempool'>('blocks');

  const handleBlockSelect = async (block: BlockSummary) => {
    setSelectedBlock(block);
    setSelectedTxid(null);
    setLoadingDetail(true);
    try {
      const detail = await api.block(block.hash);
      setBlockDetail(detail);
    } catch (e) {
      console.error(e);
      setBlockDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleTxSelect = (tx: TransactionSummary) => {
    setSelectedTxid(tx.txid);
  };

  const handleSearch = async (query: string) => {
    setSelectedBlock(null);
    setSelectedTxid(null);
    setLoadingDetail(true);
    try {
      const detail = await api.block(query);
      setBlockDetail(detail);
      setSelectedBlock({
        height: detail.height,
        hash: detail.hash,
        time: detail.time,
        txCount: detail.transactions.length,
        shieldedCount: detail.transactions.filter(t => t.type === 'shielded').length,
        transparentCount: detail.transactions.filter(t => t.type === 'transparent').length
      });
    } catch (e) {
      console.error(e);
      setBlockDetail(null);
      alert('Block not found');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <span className="text-green-500">🛡️</span>
          Zplorer
        </h1>
        <p className="text-gray-500 text-sm mt-1">Shielded Insight Explorer</p>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <section className="space-y-4">
          <ShieldedRatio />
          <StatusStrip />
        </section>

        <section>
          <SearchBar onSearch={handleSearch} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-1 space-y-4">
            <div className="flex gap-2 border-b border-gray-700 pb-2">
              <button
                onClick={() => setActiveTab('blocks')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  activeTab === 'blocks' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Recent Blocks
              </button>
              <button
                onClick={() => setActiveTab('mempool')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  activeTab === 'mempool' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Mempool
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg">
              {activeTab === 'blocks' && (
                <>
                  <h2 className="text-lg font-semibold mb-3 p-3 border-b border-gray-700">Recent Blocks</h2>
                  <BlockFeed
                    onSelectBlock={handleBlockSelect}
                    selectedHeight={selectedBlock?.height}
                  />
                </>
              )}
              {activeTab === 'mempool' && (
                <MempoolPanel />
              )}
            </div>
          </section>

          <section className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              {loadingDetail ? (
                <div className="text-gray-500 text-center py-8">Loading block...</div>
              ) : (
                <BlockDetailPanel
                  block={blockDetail}
                  onSelectTx={handleTxSelect}
                  selectedTxid={selectedTxid}
                />
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <TxDetailPanel txid={selectedTxid} />
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center text-sm text-gray-500">
        Powered by Zebra node · Data via JSON-RPC
      </footer>
    </div>
  );
}