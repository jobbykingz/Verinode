#!/usr/bin/env node

// Smart Contract Monitoring Script for Verinode
// Monitors Stellar/Soroban contract events and metrics

const { Server, AxiosClient, Contract } = require('@stellar/stellar-sdk');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

class ContractMonitor {
  constructor() {
    this.logger = this.setupLogger();
    this.server = new Server('https://horizon-testnet.stellar.org'); // Change to mainnet for production
    this.contracts = new Map();
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      contractInvocations: 0,
      contractErrors: 0,
      gasUsed: 0,
      lastBlockHeight: 0
    };
    this.monitoringInterval = null;
    this.eventListeners = new Map();
  }

  setupLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'contract-monitor' },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/contract-monitor-error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/contract-monitor-combined.log' 
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async initialize() {
    try {
      this.logger.info('Initializing contract monitor');
      
      // Load contract configurations
      await this.loadContractConfigurations();
      
      // Start monitoring
      this.startMonitoring();
      
      this.logger.info('Contract monitor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize contract monitor', error);
      throw error;
    }
  }

  async loadContractConfigurations() {
    try {
      const configPath = path.join(__dirname, '../monitoring/contract-metrics.yml');
      if (fs.existsSync(configPath)) {
        const yaml = require('js-yaml');
        const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
        
        if (config.contracts) {
          config.contracts.forEach(contract => {
            this.contracts.set(contract.address, {
              address: contract.address,
              name: contract.name,
              abi: contract.abi,
              events: contract.events || [],
              monitoring: contract.monitoring || {}
            });
          });
        }
        
        this.logger.info(`Loaded ${this.contracts.size} contract configurations`);
      }
    } catch (error) {
      this.logger.error('Error loading contract configurations', error);
    }
  }

  startMonitoring() {
    // Monitor new ledgers
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkNewLedgers();
      } catch (error) {
        this.logger.error('Error in monitoring loop', error);
      }
    }, 5000); // Check every 5 seconds

    // Monitor specific contract events
    this.setupEventListeners();
    
    this.logger.info('Contract monitoring started');
  }

  async checkNewLedgers() {
    try {
      const ledger = await this.server.ledgers().order('desc').limit(1).call();
      const latestLedger = ledger.records[0];
      
      if (latestLedger.sequence > this.metrics.lastBlockHeight) {
        this.logger.info(`New ledger detected: ${latestLedger.sequence}`);
        this.metrics.lastBlockHeight = latestLedger.sequence;
        
        // Process transactions in this ledger
        await this.processLedgerTransactions(latestLedger);
        
        // Update metrics
        this.updateMetrics();
      }
    } catch (error) {
      this.logger.error('Error checking new ledgers', error);
    }
  }

  async processLedgerTransactions(ledger) {
    try {
      const transactions = await this.server.transactions()
        .forLedger(ledger.sequence)
        .includeFailed(true)
        .call();
      
      for (const tx of transactions.records) {
        this.metrics.totalTransactions++;
        
        if (tx.successful) {
          this.metrics.successfulTransactions++;
          await this.processSuccessfulTransaction(tx);
        } else {
          this.metrics.failedTransactions++;
          this.logger.warn(`Failed transaction: ${tx.hash}`);
        }
      }
    } catch (error) {
      this.logger.error('Error processing ledger transactions', error);
    }
  }

  async processSuccessfulTransaction(tx) {
    try {
      // Check if transaction involves our monitored contracts
      const operations = await tx.operations();
      
      for (const op of operations.records) {
        if (op.type === 'invoke_host_function') {
          await this.processContractInvocation(op, tx);
        }
      }
    } catch (error) {
      this.logger.error('Error processing successful transaction', error);
    }
  }

  async processContractInvocation(operation, transaction) {
    try {
      this.metrics.contractInvocations++;
      
      // Extract contract address and function call
      const contractId = operation.contract_id;
      const functionName = operation.function_name;
      
      if (this.contracts.has(contractId)) {
        const contractInfo = this.contracts.get(contractId);
        this.logger.info(`Contract invocation: ${contractInfo.name}.${functionName}`);
        
        // Record metrics
        this.recordContractMetrics(contractInfo, functionName, transaction);
        
        // Check for specific events
        await this.checkContractEvents(contractInfo, transaction);
      }
    } catch (error) {
      this.metrics.contractErrors++;
      this.logger.error('Error processing contract invocation', error);
    }
  }

  recordContractMetrics(contractInfo, functionName, transaction) {
    try {
      // Record Prometheus-style metrics
      const metrics = [
        `# HELP contract_invocations_total Total contract invocations`,
        `# TYPE contract_invocations_total counter`,
        `contract_invocations_total{contract="${contractInfo.name}",function="${functionName}",success="true"} 1`,
        ``,
        `# HELP contract_gas_used Gas used by contract invocations`,
        `# TYPE contract_gas_used gauge`,
        `contract_gas_used{contract="${contractInfo.name}",function="${functionName}"} ${transaction.fee_charged || 0}`,
        ``
      ].join('\n');
      
      // Append to metrics file
      const metricsPath = path.join(__dirname, '../monitoring/contract-metrics.prom');
      fs.appendFileSync(metricsPath, metrics);
      
    } catch (error) {
      this.logger.error('Error recording contract metrics', error);
    }
  }

  async checkContractEvents(contractInfo, transaction) {
    try {
      // Check for specific events defined in contract configuration
      if (contractInfo.events && contractInfo.events.length > 0) {
        // This would require parsing the transaction result XDR
        // For now, we'll log that we're monitoring for events
        this.logger.debug(`Monitoring events for contract: ${contractInfo.name}`);
      }
    } catch (error) {
      this.logger.error('Error checking contract events', error);
    }
  }

  setupEventListeners() {
    // Set up listeners for specific contract events
    this.contracts.forEach((contractInfo, address) => {
      if (contractInfo.monitoring && contractInfo.monitoring.events) {
        contractInfo.monitoring.events.forEach(event => {
          this.setupEventListener(contractInfo, event);
        });
      }
    });
  }

  setupEventListener(contractInfo, eventConfig) {
    try {
      const eventKey = `${contractInfo.address}:${eventConfig.name}`;
      
      // Store event listener configuration
      this.eventListeners.set(eventKey, {
        contract: contractInfo,
        event: eventConfig,
        lastProcessed: 0
      });
      
      this.logger.info(`Set up event listener for ${contractInfo.name}.${eventConfig.name}`);
    } catch (error) {
      this.logger.error('Error setting up event listener', error);
    }
  }

  updateMetrics() {
    try {
      const metrics = [
        `# HELP stellar_ledger_height Current ledger height`,
        `# TYPE stellar_ledger_height gauge`,
        `stellar_ledger_height ${this.metrics.lastBlockHeight}`,
        ``,
        `# HELP stellar_transactions_total Total Stellar transactions`,
        `# TYPE stellar_transactions_total counter`,
        `stellar_transactions_total ${this.metrics.totalTransactions}`,
        ``,
        `# HELP stellar_transactions_success_total Successful Stellar transactions`,
        `# TYPE stellar_transactions_success_total counter`,
        `stellar_transactions_success_total ${this.metrics.successfulTransactions}`,
        ``,
        `# HELP stellar_transaction_failures_total Failed Stellar transactions`,
        `# TYPE stellar_transaction_failures_total counter`,
        `stellar_transaction_failures_total ${this.metrics.failedTransactions}`,
        ``,
        `# HELP contract_invocations_total Total smart contract invocations`,
        `# TYPE contract_invocations_total counter`,
        `contract_invocations_total ${this.metrics.contractInvocations}`,
        ``,
        `# HELP contract_invocation_errors_total Smart contract invocation errors`,
        `# TYPE contract_invocation_errors_total counter`,
        `contract_invocation_errors_total ${this.metrics.contractErrors}`,
        ``
      ].join('\n');
      
      // Write metrics to file for Prometheus scraping
      const metricsPath = path.join(__dirname, '../monitoring/contract-metrics.prom');
      fs.writeFileSync(metricsPath, metrics);
      
    } catch (error) {
      this.logger.error('Error updating metrics', error);
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getContractInfo() {
    return Array.from(this.contracts.values());
  }

  async shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.logger.info('Contract monitor shut down');
  }
}

// CLI interface
async function main() {
  const monitor = new ContractMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down contract monitor...');
    await monitor.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nShutting down contract monitor...');
    await monitor.shutdown();
    process.exit(0);
  });
  
  try {
    await monitor.initialize();
    
    // Keep the process running
    console.log('Contract monitor is running. Press Ctrl+C to stop.');
    
    // Periodic status reporting
    setInterval(() => {
      const metrics = monitor.getMetrics();
      console.log(`Status - Ledger: ${metrics.lastBlockHeight}, TX: ${metrics.totalTransactions}, Contracts: ${metrics.contractInvocations}`);
    }, 30000); // Every 30 seconds
    
  } catch (error) {
    console.error('Failed to start contract monitor:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { ContractMonitor };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}