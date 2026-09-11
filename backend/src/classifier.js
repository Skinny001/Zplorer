function classifyTx(tx) {
  const hasSaplingSpend = Array.isArray(tx.vShieldedSpend) && tx.vShieldedSpend.length > 0;
  const hasSaplingOutput = Array.isArray(tx.vShieldedOutput) && tx.vShieldedOutput.length > 0;
  const hasOrchard = tx.orchard && Array.isArray(tx.orchard.actions) && tx.orchard.actions.length > 0;
  const hasSprout = Array.isArray(tx.vjoinsplit) && tx.vjoinsplit.length > 0;

  const isShielded = hasSaplingSpend || hasSaplingOutput || hasOrchard || hasSprout;

  return {
    type: isShielded ? 'shielded' : 'transparent',
    hasSaplingSpend,
    hasSaplingOutput,
    hasOrchard,
    hasSprout,
    shieldedSpendCount: hasSaplingSpend ? tx.vShieldedSpend.length : 0,
    shieldedOutputCount: hasSaplingOutput ? tx.vShieldedOutput.length : 0,
    orchardActionCount: hasOrchard ? tx.orchard.actions.length : 0
  };
}

function classifyBlockTxs(block) {
  if (!block.tx || !Array.isArray(block.tx)) {
    return { shieldedCount: 0, transparentCount: 0, txCount: 0, transactions: [] };
  }

  const results = block.tx.map(tx => {
    const classification = classifyTx(tx);
    return {
      txid: tx.txid,
      type: classification.type,
      shieldedSpendCount: classification.shieldedSpendCount,
      shieldedOutputCount: classification.shieldedOutputCount,
      orchardActionCount: classification.orchardActionCount
    };
  });

  const shieldedCount = results.filter(t => t.type === 'shielded').length;
  const transparentCount = results.filter(t => t.type === 'transparent').length;

  return {
    shieldedCount,
    transparentCount,
    txCount: results.length,
    transactions: results
  };
}

function calculateShieldedRatio(blocks) {
  let totalShielded = 0;
  let totalTx = 0;

  for (const block of blocks) {
    totalShielded += block.shieldedCount || 0;
    totalTx += block.txCount || 0;
  }

  return totalTx > 0 ? totalShielded / totalTx : 0;
}

module.exports = { classifyTx, classifyBlockTxs, calculateShieldedRatio };