const express = require('express');
const router = express.Router();
const StellarSDK = require('@stellar/stellar-sdk');
const config = require('../config/appConfig');

// Initialize Stellar server — URL derived from STELLAR_NETWORK / STELLAR_HORIZON_URL
const server = new StellarSDK.Horizon.Server(config.stellar.horizonUrl);

// Get account info
router.get('/account/:address', async (req, res) => {
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

// Submit transaction
router.post('/transaction', async (req, res) => {
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

// Get transaction info
router.get('/transaction/:hash', async (req, res) => {
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
