# Zplorer — Shielded Insight Explorer
# Demo video 
https://www.loom.com/share/c0f86fea6ce14b27b72b719187fe6f35
A live Zcash block explorer that tracks shielded (private) vs transparent transaction activity, showing what percentage of recent network activity uses Zcash's privacy features.

## What It Does

- **Live node/network status** — sync state, peer count, mempool size, difficulty
- **Shielded activity headline** — % of recent transactions using shielded pools (Sapling/Orchard/Sprout)
- **Recent blocks feed** — scrolling list of latest blocks with shielded/transparent transaction counts
- **Block detail view** — click any block to see full transaction list with type tags
- **Transaction detail view** — click any transaction to see shielded spends, outputs, Orchard actions
- **Mempool panel** — view pending transactions with shielded/transparent classification
- **Search** — jump to any block by height or hash

## RPC Methods Used (6 Total)

| # | Method | Purpose | Frontend Feature |
|---|--------|---------|------------------|
| 1 | `getblockchaininfo` | Chain name, current height, estimated height, sync progress, difficulty | Status strip, sync indicator |
| 2 | `getpeerinfo` | Connected peer count | Status strip |
| 3 | `getrawmempool` | Pending transaction IDs (count + list) | Status strip mempool size, Mempool panel |
| 4 | `getblockhash` | Resolve block height → hash | Block feed, block search, block detail |
| 5 | `getblock` (verbosity 2) | Full block with verbose transactions | Block feed, block detail, shielded ratio calculation |
| 6 | `getrawtransaction` (verbose) | Per-transaction detail with shielded fields | Transaction detail, mempool tx detail, shielded classification |

**All 6 methods are load-bearing** — each directly drives visible UI elements. No filler calls.

## Shielded Detection Logic

A transaction is classified as **shielded** if it contains any of:
- `vShieldedSpend` / `vShieldedOutput` (Sapling)
- `orchard.actions` (Orchard)
- `vjoinsplit` (Sprout, legacy)

Otherwise it's **transparent** (only `vin`/`vout`).

Shielded ratio = shielded tx count / total tx count across last 5 blocks.

## Architecture

```
┌─────────────┐    HTTP (fetch, polling)     ┌──────────────┐    JSON-RPC (HTTPS)     ┌────────────┐
│  Frontend   │ ────────────────────────────▶ │  Backend     │ ──────────────────────▶ │  GetBlock  │
│  (Next.js)  │ ◀──────────────────────────── │  (Express)   │ ◀────────────────────── │  (Zcash    │
└─────────────┘      JSON responses          └──────────────┘      JSON-RPC responses   │   RPC)     │
                                                                                       └────────────┘
```

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Express.js proxy (avoids CORS, handles auth, adds timeouts/retries)
- **RPC Provider**: GetBlock (hosted Zcash node) — no local Zebra node needed
- **No database** — all data fetched live on each request

## How to Run

### Prerequisites
- Node.js 20+
- GetBlock API key (free tier works)

### 1. Backend

```bash
cd backend
cp .env.example .env  # Edit with your GetBlock URL
npm install
npm start
```
Runs on `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:3000` (proxies `/api/*` to backend)

### Environment Variables

**Backend (`.env`):**
```env
RPC_URL=https://shared.eu-central-1.getblock.io/YOUR_API_KEY
PORT=3001
RPC_TIMEOUT=30000
```

**Frontend (`.env.local` — optional):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Project Structure

```
Zplorer/
├── backend/
│   ├── src/
│   │   ├── rpc.js          # JSON-RPC client with timeout/retry/logging
│   │   ├── routes.js       # Express routes (/status, /blocks/latest, /block, /tx, /mempool)
│   │   └── classifier.js   # Shielded/transparent detection logic
│   ├── index.js            # Express entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx    # Main page with tabs (blocks/mempool)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ShieldedRatio.tsx
│   │   │   ├── StatusStrip.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── BlockFeed.tsx
│   │   │   ├── BlockDetail.tsx
│   │   │   ├── TxDetail.tsx
│   │   │   └── MempoolPanel.tsx
│   │   └── lib/api.ts      # Typed API client + formatters
│   └── package.json
└── README.md
```

## Key Features

- **Graceful error handling** — exponential backoff retry (5s→10s→20s→60s), shows cached data during retries, only errors after 3 consecutive failures
- **Rate-limit friendly** — 5 blocks per request, 60s polling interval
- **Responsive UI** — works on mobile/desktop, clean dark theme
- **TypeScript throughout** — typed API responses, component props

## Demo

1. Start backend + frontend
2. Open `http://localhost:3000`
3. See live shielded ratio, block feed, mempool
4. Click blocks → transactions for details
5. Search by height or hash


## License

MIT
