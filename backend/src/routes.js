const express = require('express');
const { rpcCall } = require('./rpc');
const { classifyBlockTxs, calculateShieldedRatio } = require('./classifier');

const router = express.Router();

function classifyTx(tx) {
  const hasSaplingSpend = Array.isArray(tx.vShieldedSpend) && tx.vShieldedSpend.length > 0;
  const hasSaplingOutput = Array.isArray(tx.vShieldedOutput) && tx.vShieldedOutput.length > 0;
  const hasOrchard = tx.orchard && Array.isArray(tx.orchard.actions) && tx.orchard.actions.length > 0;
  const hasSprout = Array.isArray(tx.vjoinsplit) && tx.vjoinsplit.length > 0;

  const isShielded = hasSaplingSpend || hasSaplingOutput || hasOrchard || hasSprout;

  return {
    type: isShielded ? 'shielded' : 'transparent',
    shieldedSpendCount: hasSaplingSpend ? tx.vShieldedSpend.length : 0,
    shieldedOutputCount: hasSaplingOutput ? tx.vShieldedOutput.length : 0,
    orchardActionCount: hasOrchard ? tx.orchard.actions.length : 0
  };
}

router.get('/mempool', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const txids = await rpcCall('getrawmempool');
    
    if (!Array.isArray(txids) || txids.length === 0) {
      return res.json({ txs: [], count: 0 });
    }

    const txs = [];
    for (const txid of txids.slice(0, limit)) {
      try {
        const tx = await rpcCall('getrawtransaction', [txid, 1]);
        const classification = classifyTx(tx);
        txs.push({
          txid: tx.txid,
          type: classification.type,
          size: tx.size || tx.vsize || 0,
          fee: tx.fee || 0,
          vinCount: Array.isArray(tx.vin) ? tx.vin.length : 0,
          voutCount: Array.isArray(tx.vout) ? tx.vout.length : 0,
          shieldedSpendCount: classification.shieldedSpendCount,
          shieldedOutputCount: classification.shieldedOutputCount,
          orchardActionCount: classification.orchardActionCount,
          time: tx.time || Math.floor(Date.now() / 1000)
        });
      } catch (e) {
        console.error(`Failed to fetch mempool tx ${txid}:`, e.message);
      }
    }

    const shieldedCount = txs.filter(t => t.type === 'shielded').length;
    res.json({ txs, count: txids.length, shieldedCount, transparentCount: txs.length - shieldedCount });
  } catch (err) {
    console.error('/api/mempool error:', err.message);
    res.status(502).json({ error: 'Failed to fetch mempool', detail: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const [chainInfo, peers, mempool] = await Promise.all([
      rpcCall('getblockchaininfo'),
      rpcCall('getpeerinfo'),
      rpcCall('getrawmempool')
    ]);

    const isSynced = chainInfo.blocks >= chainInfo.estimatedheight;

    res.json({
      chain: chainInfo.chain,
      syncedHeight: chainInfo.blocks,
      estimatedHeight: chainInfo.estimatedheight,
      isSynced,
      difficulty: chainInfo.difficulty,
      peerCount: Array.isArray(peers) ? peers.length : 0,
      mempoolSize: Array.isArray(mempool) ? mempool.length : 0
    });
  } catch (err) {
    console.error('/api/status error:', err.message);
    res.status(502).json({ error: 'Failed to fetch node status', detail: err.message });
  }
});

router.get('/blocks/latest', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 10, 50);
    
    const chainInfo = await rpcCall('getblockchaininfo');
    const tipHeight = chainInfo.blocks;

    const blocks = [];
    for (let i = 0; i < count; i++) {
      const height = tipHeight - i;
      if (height < 0) break;

      const hash = await rpcCall('getblockhash', [height]);
      const block = await rpcCall('getblock', [hash, 2]);
      
      const classified = classifyBlockTxs(block);
      blocks.push({
        height: block.height,
        hash: block.hash,
        time: block.time,
        txCount: classified.txCount,
        shieldedCount: classified.shieldedCount,
        transparentCount: classified.transparentCount
      });
    }

    const shieldedRatio = calculateShieldedRatio(blocks);

    res.json({ blocks, shieldedRatio });
  } catch (err) {
    console.error('/api/blocks/latest error:', err.message);
    res.status(502).json({ error: 'Failed to fetch latest blocks', detail: err.message });
  }
});

router.get('/block/:hashOrHeight', async (req, res) => {
  try {
    const { hashOrHeight } = req.params;
    let hash = hashOrHeight;

    if (/^\d+$/.test(hashOrHeight)) {
      const height = parseInt(hashOrHeight);
      hash = await rpcCall('getblockhash', [height]);
    }

    const block = await rpcCall('getblock', [hash, 2]);
    const classified = classifyBlockTxs(block);

    res.json({
      height: block.height,
      hash: block.hash,
      previousHash: block.previousblockhash,
      time: block.time,
      size: block.size,
      transactions: classified.transactions
    });
  } catch (err) {
    console.error('/api/block/:hashOrHeight error:', err.message);
    if (err.code === -5 || err.message.includes('Block not found')) {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.status(502).json({ error: 'Failed to fetch block', detail: err.message });
  }
});

router.get('/tx/:txid', async (req, res) => {
  try {
    const { txid } = req.params;
    const tx = await rpcCall('getrawtransaction', [txid, 1]);
    
    const classification = classifyTx(tx);

    res.json({
      txid: tx.txid,
      type: classification.type,
      confirmations: tx.confirmations || 0,
      size: tx.size || tx.vsize || 0,
      vinCount: Array.isArray(tx.vin) ? tx.vin.length : 0,
      voutCount: Array.isArray(tx.vout) ? tx.vout.length : 0,
      shieldedSpendCount: classification.shieldedSpendCount,
      shieldedOutputCount: classification.shieldedOutputCount,
      orchardActionCount: classification.orchardActionCount
    });
  } catch (err) {
    console.error('/api/tx/:txid error:', err.message);
    if (err.code === -5 || err.message.includes('not found')) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.status(502).json({ error: 'Failed to fetch transaction', detail: err.message });
  }
});

function classifyTx(tx) {
  const hasSaplingSpend = Array.isArray(tx.vShieldedSpend) && tx.vShieldedSpend.length > 0;
  const hasSaplingOutput = Array.isArray(tx.vShieldedOutput) && tx.vShieldedOutput.length > 0;
  const hasOrchard = tx.orchard && Array.isArray(tx.orchard.actions) && tx.orchard.actions.length > 0;
  const hasSprout = Array.isArray(tx.vjoinsplit) && tx.vjoinsplit.length > 0;

  const isShielded = hasSaplingSpend || hasSaplingOutput || hasOrchard || hasSprout;

  return {
    type: isShielded ? 'shielded' : 'transparent',
    shieldedSpendCount: hasSaplingSpend ? tx.vShieldedSpend.length : 0,
    shieldedOutputCount: hasSaplingOutput ? tx.vShieldedOutput.length : 0,
    orchardActionCount: hasOrchard ? tx.orchard.actions.length : 0
  };
}

module.exports = router;