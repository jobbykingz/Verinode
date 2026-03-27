const express = require('express');
const router = express.Router();
const StellarSDK = require('@stellar/stellar-sdk');
const { cacheMiddleware, invalidateCacheMiddleware } = require('../middleware/cacheMiddleware');

// Initialize Stellar server
const server = new StellarSDK.Horizon.Server(
  process.env.STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org'
);

// Get account info - cache 5 min (account balances change but Horizon calls are expensive)
router.get('/account/:address', cacheMiddleware({
  ttl: 300,
  keyPrefix: 'stellar',
  keyGenerator: (req) => `account:${req.params.address}`,
  tags: ['stellar-accounts']
}), async (req, res) => {
  try {
    const { address } = req.params;
    const account = await server.loadAccount(address);

    res.json({
      success: true,
      account: {
        address: account.accountId(),
        balance: account.balances,
        sequence: account.sequenceNumber()
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submit transaction - invalidate account cache after successful submission
router.post('/transaction', invalidateCacheMiddleware({
  tags: ['stellar-accounts']
}), async (req, res) => {
  try {
    const { transactionXdr } = req.body;

    const transaction = StellarSDK.TransactionBuilder.fromXDR(
      transactionXdr,
      StellarSDK.Networks.TESTNET
    );

    const result = await server.submitTransaction(transaction);

    res.json({
      success: true,
      transactionHash: result.hash,
      ledger: result.ledger
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get transaction info - cache 10 min (transactions are immutable once confirmed)
router.get('/transaction/:hash', cacheMiddleware({
  ttl: 600,
  keyPrefix: 'stellar',
  keyGenerator: (req) => `tx:${req.params.hash}`,
  tags: ['stellar-transactions']
}), async (req, res) => {
  try {
    const { hash } = req.params;
    const transaction = await server.transactions().transaction(hash).call();

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    res.status(404).json({ error: 'Transaction not found' });
  }
});

module.exports = router;
