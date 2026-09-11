# PRD: Zplorer — Shielded Insight Explorer

## 1. Overview

**What it is:** A single-page web app that connects to a Zcash node (Zebra) via RPC and shows:
1. Live network/node status (sync state, peers, mempool)
2. A scrolling feed of recent blocks, each tagged with its shielded vs. transparent transaction count
3. A "shielded activity" headline stat — the % of recent transactions using shielded (private) pools
4. A block/transaction detail view (click into a block, click into a tx)
5. A search bar to jump to any block by height or hash

**Why it matters (the story):** Zcash's core feature is privacy. Most block explorers just show raw chain data. This one answers a real question — "is the network's privacy feature actually being used, right now?" — while still functioning as a normal mini-explorer.

**Constraints from the challenge brief:**
- Must have a landing page (frontend for the app, not the whole thing)
- Must connect to a Zcash node (local or remote)
- Must use **at least 3 RPC methods** (this PRD targets 6–7, all load-bearing, not filler)
- Must display **live** blockchain data (not a static screenshot / not hardcoded)
- Grading weights: RPC integration 50%, Functionality 35%, UI/UX 5%, Creativity 10%
- Deadline: Sep 16. Submission needs a README covering what it does, which RPC methods were used, and how to run it.

**Explicit non-goals (keep it small):**
- No wallet functionality (no sending/receiving funds)
- No user accounts or auth
- No database — everything is fetched live from the node on each request or short poll interval
- No mobile app, no complex design system — UI is only 5% of the grade

---

## 2. Architecture

```
┌─────────────┐      HTTP (fetch, polling)      ┌──────────────┐      JSON-RPC (HTTP POST)      ┌──────────────┐
│  Frontend    │ ───────────────────────────────▶│  Backend      │ ───────────────────────────────▶│  Zebra node  │
│  (HTML/JS or │◀─────────────────────────────── │  (Node/Express│◀─────────────────────────────── │  (zebrad)    │
│  React)      │        JSON responses            │  or Python/   │        JSON-RPC responses        │              │
└─────────────┘                                  │  Flask)       │                                  └──────────────┘
                                                   └──────────────┘
```

**Why a backend proxy layer instead of calling the node directly from the browser:**
- Zebra's RPC port typically requires being called server-side (CORS, and possibly RPC auth/cookie auth) — browsers calling it directly will usually fail or be insecure.
- A thin backend also lets you cache/dedupe calls (e.g., only fetch a block once, reuse it for both the feed and detail view).

### Confirm this for yourself (don't assume — test it)

Before writing any frontend fetch code, verify whether Zebra sends CORS headers on your exact setup:

```bash
curl -i -X POST http://127.0.0.1:8232 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"jsonrpc":"2.0","id":"1","method":"getblockchaininfo","params":[]}'
```

Check the response headers for `Access-Control-Allow-Origin`. In practice, generic JSON-RPC node servers (Zebra included) almost never send this by default — it has to be explicitly configured server-side, and node software generally isn't built to do that out of the box. If it's missing, your frontend's browser-side `fetch()` calls will be blocked before your code even sees the response — this is a browser enforcement, not a node error, so you won't get a helpful error message from Zebra itself, just a CORS failure in devtools.

**Decision rule for the agent:**
- No `Access-Control-Allow-Origin` header present → you need the backend proxy (§6). This is the expected/default case — plan around it.
- Header present and permissive → in theory the frontend could call Zebra directly, but still prefer the backend proxy anyway, because:
  1. If cookie auth is left enabled, credentials would be exposed in browser devtools' Network tab if called directly.
  2. The backend proxy lets you dedupe/cache calls (e.g., fetch a block once, reuse it for both the feed and the detail view) instead of the frontend re-fetching the same data repeatedly.
  3. It's a cleaner separation for your README/demo narrative — one clear place where "the RPC integration" lives.

**Bottom line:** build the backend proxy regardless of the curl test result. It's a ~20-30 line Express (or Flask) server with a handful of routes — not heavy — and it removes this entire class of risk from your 2-day timeline instead of debugging CORS/auth edge cases live at the workspace.

**Recommended stack (pick whichever the agent/dev is fastest in):**
- Backend: Node.js + Express (simplest, same language as frontend if using React) — OR Python + Flask
- Frontend: Plain HTML/CSS/JS is enough (UI is 5% of grade) — React is fine too if preferred
- No database. No ORM. No ID's frontend framework required beyond basics.

---

## 3. Zebra RPC Connection

- Zebra exposes a JSON-RPC HTTP endpoint, default `http://127.0.0.1:8232` (mainnet) — confirm actual port/host from the node config given at the workspace (it may be remote, or on a different port for testnet).
- Some Zebra deployments require RPC username/password (basic auth) similar to zcashd — check the node's `zebrad.toml` config for `[rpc]` section, or ask the workspace organizers for connection details (host, port, and auth if enabled).
- Calls are standard JSON-RPC 2.0 over HTTP POST:

```json
POST /
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "getblockchaininfo",
  "params": []
}
```

- **Important caveat for the agent:** Zebra does NOT implement 100% of zcashd's RPC surface. Before building, run each candidate method once by hand (curl or Postman) against the actual node to confirm it's supported and see its real response shape — do not assume zcashd docs match Zebra's output exactly. If a method 404s / errors "method not found", swap to the documented fallback below.

---

## 3a. Local Zebra Node — Install, Configure, Sync (do this FIRST, before any code)

This is your actual critical path. Start this before writing a single line of backend code.

### Install

Zebra now ships an interactive installer as of v6.2.0 (binary, Docker, or source-build modes) — check the current installer first:
```bash
# check https://github.com/ZcashFoundation/zebra for the current installer script/instructions
```

If installing from source (works on any recent version):
```bash
# Prereqs: Rust toolchain, a C++ compiler (g++ or Xcode), pkg-config, libclang
curl https://sh.rustup.rs -sSf | sh
source $HOME/.cargo/env

cargo install --locked zebrad
```

Docker is the fastest path if you don't want to deal with build toolchains:
```bash
docker pull zfnd/zebra:latest
```

### Generate config

```bash
zebrad generate -o ~/.config/zebrad.toml
```

This creates a default config. Open it and check/set the `[rpc]` section:

```toml
[rpc]
listen_addr = "127.0.0.1:8232"

# IMPORTANT: recent Zebra versions (2.0.0+) enable cookie-based auth on the
# RPC endpoint BY DEFAULT. For a simple hackathon backend, disable it so you
# can call RPC methods without implementing cookie auth:
enable_cookie_auth = false
```

If you'd rather keep cookie auth on (slightly more "production-correct"), Zebra writes a cookie file your backend can read and send as the RPC password — but for a 2-day build, disabling it is the pragmatic choice. Mention this explicitly in your README so it reads as a deliberate tradeoff, not an oversight.

Also confirm which network you're targeting:
```toml
[network]
network = "Mainnet"   # or "Testnet" for a much faster sync
```

### Start the node and let it sync

```bash
zebrad start
```

- Mainnet full sync can take many hours depending on bandwidth/disk — **start this immediately, ideally before the workspace begins**, and let it run in the background while you build everything else.
- Testnet syncs much faster and is a legitimate fallback if mainnet sync time becomes a real risk — just be upfront in your README that you targeted testnet, and note that shielded transaction volume will be lower there (so your shielded-ratio stat may look thin — that's expected, not a bug).
- You can build and test your backend against a partially-synced node — older blocks are already queryable even while the tip is still catching up. Don't wait for 100% sync to start building.

### Verify it's alive before writing any backend code

```bash
curl -s -X POST http://127.0.0.1:8232 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"getblockchaininfo","params":[]}'
```

If this returns real JSON with a `blocks` field, you're connected. Do the same for `getpeerinfo`, `getrawmempool`, and a `getblock`/`getrawtransaction` pair on a known recent block/tx — this is also how you'll confirm real field names for the shielded-detection logic in §5, rather than trusting docs blindly (Zebra doesn't implement 100% of zcashd's RPC surface, and field shapes can differ from what's documented).

### Known rough edges to expect (from the Zebra project's own notes)

- `getpeerinfo` on Zebra currently reflects outbound/recent connections rather than a strict live inbound+outbound count — fine for display purposes, just don't over-promise precision on this number.
- Progress-bar/sync estimates in the terminal logs can occasionally show wildly large numbers — cosmetic, ignore it, check `verificationprogress` in `getblockchaininfo` instead for a reliable 0–1 sync progress figure.
- If Zebra fails to download Zcash parameters on first run, there's a separate parameters-download script in the Zebra repo — run that manually if you hit this.

---

## 4. RPC Methods to Use (target: 6–7)

| # | Method | Params | Purpose | Fallback if unsupported |
|---|--------|--------|---------|--------------------------|
| 1 | `getblockchaininfo` | none | Current height, sync status (`blocks` vs `estimatedheight`), chain name, difficulty | — (core method, should always exist) |
| 2 | `getbestblockhash` | none | Latest block hash (also derivable from `getblockchaininfo`) | use `bestblockhash` field from `getblockchaininfo` |
| 3 | `getblockhash` | `[height]` | Resolve a height → hash, used for search-by-height | — |
| 4 | `getblock` | `[hashOrHeight, verbosity=2]` | Full block: timestamp, size, tx list (verbosity 2 returns full tx objects, not just txids) | if verbosity 2 unsupported, use verbosity 1 (txids only) + individual `getrawtransaction` calls |
| 5 | `getrawtransaction` | `[txid, verbose=1]` | Per-tx detail: check for shielded fields (see §5) | — |
| 6 | `getrawmempool` | `[verbose=false]` | Returns array of pending txids — use `.length` as mempool size | `getmempoolinfo` if the node supports it (returns `{size, bytes, usage}` directly) |
| 7 | `getpeerinfo` | none | Array of connected peers — use `.length` as peer count | — |

This gives 6 methods minimum, 7 if you keep `getbestblockhash` as its own call rather than reading it off `getblockchaininfo`. That comfortably clears the "at least 3" bar and each one maps directly to something visible in the UI (no filler calls made just to hit a number).

---

## 5. Shielded vs. Transparent Detection Logic

This is the core "meaning" layer of the app. For each transaction object returned by `getrawtransaction` (verbose) or embedded in `getblock` (verbosity 2):

A transaction is **shielded** (fully or partially) if it contains any of:
- `vShieldedSpend` and/or `vShieldedOutput` arrays with length > 0 (Sapling)
- `orchard.actions` array with length > 0 (Orchard, if present in the tx JSON — field name may vary, verify against actual node output)
- `vjoinsplit` array with length > 0 (legacy Sprout — unlikely to see in recent blocks, but check anyway)

A transaction is **fully transparent** if none of the above are present (only `vin`/`vout`).

Pseudocode:

```
function classifyTx(tx):
    hasSapling = (tx.vShieldedSpend?.length > 0) or (tx.vShieldedOutput?.length > 0)
    hasOrchard = (tx.orchard?.actions?.length > 0)
    hasSprout  = (tx.vjoinsplit?.length > 0)

    if hasSapling or hasOrchard or hasSprout:
        return "shielded"
    else:
        return "transparent"
```

**Agent note:** field names must be verified against the actual JSON returned by the workspace's Zebra node — do a raw `getrawtransaction <txid> 1` call on a known recent tx first and inspect the real keys before writing the classifier. Don't hardcode field names from zcashd docs without checking, since Zebra's JSON shape can differ slightly.

**Shielded ratio calculation** (for the headline stat):
- Pull the last N blocks (N = 10 is a good default — enough to be meaningful, small enough to be fast)
- For each block, classify every tx
- `shieldedRatio = shieldedTxCount / totalTxCount` across all N blocks
- Also compute per-block counts for the block feed tags (e.g. "🛡️ 4/9 shielded")

---

## 6. Backend API (routes your frontend calls)

Keep this thin — each route just orchestrates one or more RPC calls and returns clean JSON.

### `GET /api/status`
Returns node/network health strip.
```json
{
  "chain": "main",
  "syncedHeight": 2481203,
  "estimatedHeight": 2481203,
  "isSynced": true,
  "difficulty": 123456789,
  "peerCount": 8,
  "mempoolSize": 3
}
```
Calls: `getblockchaininfo`, `getpeerinfo`, `getrawmempool` (or `getmempoolinfo`)

### `GET /api/blocks/latest?count=10`
Returns the last N blocks with shielded/transparent tagging.
```json
{
  "blocks": [
    {
      "height": 2481203,
      "hash": "0000...",
      "time": 1735689600,
      "txCount": 9,
      "shieldedCount": 4,
      "transparentCount": 5
    }
  ],
  "shieldedRatio": 0.42
}
```
Calls: `getblockchaininfo` (to get tip height) → loop `getblockhash` + `getblock` (verbosity 2) for last N heights → classify each tx

### `GET /api/block/:hashOrHeight`
Full detail for one block, including its transaction list (tagged).
```json
{
  "height": 2481203,
  "hash": "0000...",
  "previousHash": "0000...",
  "time": 1735689600,
  "size": 4321,
  "transactions": [
    { "txid": "abc123...", "type": "shielded" },
    { "txid": "def456...", "type": "transparent" }
  ]
}
```
Calls: `getblockhash` (if given a height) → `getblock` (verbosity 2) → classify each tx

### `GET /api/tx/:txid`
Detail for a single transaction.
```json
{
  "txid": "abc123...",
  "type": "shielded",
  "confirmations": 12,
  "size": 512,
  "vinCount": 1,
  "voutCount": 2,
  "shieldedSpendCount": 1,
  "shieldedOutputCount": 2
}
```
Calls: `getrawtransaction` (verbose)

**Polling:** frontend polls `/api/status` and `/api/blocks/latest` every 20–30 seconds (Zcash block time is ~75 seconds, so faster polling than that is wasted). Use `setInterval` on the frontend, not websockets — not worth the complexity for a 2-day build.

---

## 7. Frontend Layout (single page)

```
┌───────────────────────────────────────────────┐
│  Zplorer                                        │
│  🛡️ 42% of recent activity is shielded          │  ← headline stat
│  [donut/bar: shielded vs transparent]            │
│  Synced ✅   Peers: 8   Mempool: 3               │  ← status strip
├───────────────────────────────────────────────┤
│  🔍 Search block height or hash: [________] [Go]│
├───────────────────────────────────────────────┤
│  Recent Blocks                                   │
│  #2481203  🛡️4/9   2 min ago     [view]         │
│  #2481202  🛡️2/6   3 min ago     [view]         │
│  #2481201  🛡️5/5   5 min ago     [view]         │
│  ...                                             │
├───────────────────────────────────────────────┤
│  [Detail panel — shown when a block is clicked]  │
│  Block #2481203                                  │
│  Hash: 0000...                                   │
│  Prev: 0000...                                   │
│  Time: ...   Size: ... bytes                     │
│  Transactions:                                   │
│    abc123... 🛡️ shielded   [view]                │
│    def456... 🔓 transparent [view]               │
└───────────────────────────────────────────────┘
```

UI only needs to be clean and readable — no need for animation polish. Plain CSS flex/grid is enough.

---

## 8. Error Handling (don't skip this — live demos break)

- If the node is unreachable: show a clear "⚠️ Cannot connect to node" banner instead of a blank/broken page. Don't let one failed fetch crash the whole UI.
- If a specific RPC method isn't supported by this Zebra build: catch the error server-side, log it, and fall back gracefully (see fallback column in §4) rather than crashing the route.
- If sync is in progress (`blocks` < `estimatedheight`): show a "syncing" state instead of treating stale data as an error.
- Wrap every RPC call in a try/catch on the backend; return a `{ error: "..." }` JSON with an appropriate status code rather than letting the server 500 with no message.

---

## 9. Build Order (2-day plan)

**Day 1:**
1. Confirm Zebra node connection details (host, port, auth) at the workspace
2. Manually test each RPC method with curl against the real node; note actual field names
3. Build backend: RPC client wrapper (a single function that POSTs JSON-RPC and returns `.result`), then the 4 routes in §6
4. Test each route with curl/Postman before touching frontend

**Day 2:**
1. Build frontend: status strip → block feed → detail panel → search bar, in that order (each is independently demoable)
2. Wire up polling
3. Test the "node unreachable" and "still syncing" states on purpose (unplug node / kill it briefly) to make sure the UI doesn't break
4. Write the README (see §10)
5. Record a short demo or make sure it's live and working for judges

---

## 10. README Requirements (must include for submission)

```markdown
# Zplorer — Shielded Insight Explorer

## What it does
A live Zcash block explorer that also tracks shielded (private) vs
transparent transaction activity, showing what % of recent network
activity is using Zcash's privacy features.

## RPC methods used
- getblockchaininfo — chain sync status, height, difficulty
- getblockhash — resolve height to hash for search/navigation
- getblock (verbosity 2) — full block + transaction data
- getrawtransaction (verbose) — per-transaction shielded/transparent classification
- getrawmempool — pending transaction count
- getpeerinfo — connected peer count

## How to run
1. `cd backend && npm install && npm start` (set RPC host/port/auth in `.env`)
2. `cd frontend && npm install && npm start` (or just open index.html if plain JS)
3. App runs at http://localhost:3000

## Node connection
Requires a running Zebra node (local or remote) with RPC enabled.
Configure connection in `backend/.env`:
RPC_HOST=127.0.0.1
RPC_PORT=8232
RPC_USER=（if required）
RPC_PASS=（if required）
```

---

## 11. Grading Self-Check (map back to the rubric before submitting)

- **RPC integration (50%):** 6 distinct methods, each one directly driving a visible UI element — not decorative. ✅
- **Functionality (35%):** live polling, working search, working block/tx detail drill-down, graceful error states. ✅
- **UI/UX (5%):** clean, readable, no need for more than basic styling. ✅
- **Creativity (10%):** the shielded-ratio "story" stat is the differentiator vs. a generic explorer clone. ✅

---

## 12. Open Items to Resolve at the Workspace

- [ ] Exact Zebra RPC host/port/auth for the node you'll be given
- [ ] Confirm `getblock` verbosity 2 is supported (else fall back to verbosity 1 + per-tx `getrawtransaction` loop)
- [ ] Confirm `getrawmempool` vs `getmempoolinfo` availability
- [ ] Inspect one real `getrawtransaction` verbose response to confirm actual shielded field names (`vShieldedSpend`, `vShieldedOutput`, `orchard.actions`, etc.) before writing the classifier
- [ ] Confirm whether the node is mainnet or testnet (affects what "recent activity" looks like — testnet may have very few shielded txs, in which case mention this limitation honestly in the README rather than presenting a misleading 0%/100% stat)