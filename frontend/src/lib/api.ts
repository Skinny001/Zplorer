// Use a relative path so requests go through Next.js' built-in proxy rewrite.
// This avoids CORS issues regardless of which device opens the page.
const API_BASE = '/api';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface StatusResponse {
  chain: string;
  syncedHeight: number;
  estimatedHeight: number;
  isSynced: boolean;
  difficulty: number;
  peerCount: number;
  mempoolSize: number;
}

export interface BlockSummary {
  height: number;
  hash: string;
  time: number;
  txCount: number;
  shieldedCount: number;
  transparentCount: number;
}

export interface BlocksLatestResponse {
  blocks: BlockSummary[];
  shieldedRatio: number;
}

export interface BlockDetail {
  height: number;
  hash: string;
  previousHash: string;
  time: number;
  size: number;
  transactions: TransactionSummary[];
}

export interface TransactionSummary {
  txid: string;
  type: 'shielded' | 'transparent';
  shieldedSpendCount: number;
  shieldedOutputCount: number;
  orchardActionCount: number;
}

export interface TxDetail {
  txid: string;
  type: 'shielded' | 'transparent';
  confirmations: number;
  size: number;
  vinCount: number;
  voutCount: number;
  shieldedSpendCount: number;
  shieldedOutputCount: number;
  orchardActionCount: number;
}

export interface MempoolTx {
  txid: string;
  type: 'shielded' | 'transparent';
  size: number;
  fee: number;
  vinCount: number;
  voutCount: number;
  shieldedSpendCount: number;
  shieldedOutputCount: number;
  orchardActionCount: number;
  time: number;
}

export interface MempoolResponse {
  txs: MempoolTx[];
  count: number;
  shieldedCount: number;
  transparentCount: number;
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function formatHash(hash: string, length = 8): string {
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

export function formatNumber(num: number): string {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

export const api = {
  status: () => fetchJson<StatusResponse>('/status'),
  latestBlocks: (count = 10) => fetchJson<BlocksLatestResponse>(`/blocks/latest?count=${count}`),
  block: (hashOrHeight: string | number) => fetchJson<BlockDetail>(`/block/${hashOrHeight}`),
  tx: (txid: string) => fetchJson<TxDetail>(`/tx/${txid}`),
  mempool: (limit = 20) => fetchJson<MempoolResponse>(`/mempool?limit=${limit}`),
  formatTime,
  formatHash,
  formatNumber,
};