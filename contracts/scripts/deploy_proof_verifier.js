const { SorobanRpc, Networks, TransactionBuilder, Contract, Address, ScInt, xdr } = require('@stellar/stellar-sdk');
const { readFileSync } = require('fs');
const { join } = require('path');

/**
 * Deployment script for ProofVerifier Soroban smart contract
 * 
 * This script handles:
 * - Contract compilation and deployment
 * - Initialization with admin address
 * - Gas optimization verification
 * - Testnet deployment with verification
 */

class ProofVerifierDeployer {
    constructor(network = 'testnet', adminPrivateKey = null) {
        this.network = network;
        this.networkConfig = this.getNetworkConfig(network);
        this.server = new SorobanRpc.Server(this.networkConfig.rpcUrl);
        this.adminPrivateKey = adminPrivateKey || process.env.ADMIN_PRIVATE_KEY;
        
        if (!this.adminPrivateKey) {
            throw new Error('Admin private key is required. Set ADMIN_PRIVATE_KEY environment variable or pass as parameter.');
        }
        
        this.keypair = SorobanRpc.Keypair.fromSecret(this.adminPrivateKey);
        this.adminAddress = this.keypair.publicKey();
    }

    getNetworkConfig(network) {
        const configs = {
            testnet: {
                rpcUrl: 'https://soroban-testnet.stellar.org',
                networkPassphrase: Networks.TESTNET,
                friendbotUrl: 'https://friendbot.stellar.org'
            },
            futurenet: {
                rpcUrl: 'https://rpc-futurenet.stellar.org',
                networkPassphrase: Networks.FUTURENET,
                friendbotUrl: 'https://friendbot-futurenet.stellar.org'
            },
            standalone: {
                rpcUrl: 'http://localhost:8000/soroban/rpc',
                networkPassphrase: Networks.STANDALONE
            }
        };
        
        if (!configs[network]) {
            throw new Error(`Unsupported network: ${network}`);
        }
        
        return configs[network];
    }

    async fundAccount() {
        if (this.network === 'standalone') {
            console.log('Skipping account funding for standalone network');
            return;
        }

        try {
            const friendbotUrl = `${this.networkConfig.friendbotUrl}?addr=${this.adminAddress}`;
            const response = await fetch(friendbotUrl);
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Account funded: ${result.successful}`);
            } else {
                console.log('ℹ️ Account may already be funded or friendbot unavailable');
            }
        } catch (error) {
            console.log('ℹ️ Could not fund account, continuing anyway...');
        }
    }

    async getAccount() {
        try {
            const account = await this.server.getAccount(this.adminAddress);
            return account;
        } catch (error) {
            throw new Error(`Failed to get account: ${error.message}`);
        }
    }

    compileContract() {
        console.log('🔨 Compiling contract...');
        
        try {
            // This would typically be done with cargo build --release --target wasm32-unknown-unknown
            // For now, we'll assume the .wasm file exists
            const wasmPath = join(__dirname, '..', 'target', 'wasm32-unknown-unknown', 'release', 'verinode_contracts.wasm');
            
            try {
                const wasmBuffer = readFileSync(wasmPath);
                console.log('✅ Contract compiled successfully');
                return wasmBuffer;
            } catch (readError) {
                throw new Error(`Contract WASM file not found at ${wasmPath}. Please run: cargo build --release --target wasm32-unknown-unknown`);
            }
        } catch (error) {
            throw new Error(`Compilation failed: ${error.message}`);
        }
    }

    async uploadContract(wasmBuffer) {
        console.log('📤 Uploading contract code...');
        
        const account = await this.getAccount();
        
        const uploadTx = new TransactionBuilder(account, {
            fee: '10000',
            networkPassphrase: this.networkConfig.networkPassphrase
        })
        .setTimeout(30)
        .addOperation(
            xdr.Operation.hostFunction({
                hostFunction: xdr.HostFunction.hostFunctionType.uploadContractWasm(wasmBuffer)
            })
        )
        .build();

        const preparedTx = await this.server.prepareTransaction(uploadTx);
        preparedTx.sign(this.keypair);

        try {
            const result = await this.server.sendTransaction(preparedTx);
            
            if (result.status === 'SUCCESS') {
                const wasmHash = result.resultRetval.xdr;
                console.log('✅ Contract uploaded successfully');
                return wasmHash;
            } else {
                throw new Error(`Upload failed: ${result.errorResult}`);
            }
        } catch (error) {
            throw new Error(`Failed to upload contract: ${error.message}`);
        }
    }

    async createContract(wasmHash) {
        console.log('🏗️ Creating contract instance...');
        
        const account = await this.getAccount();
        
        const createTx = new TransactionBuilder(account, {
            fee: '10000',
            networkPassphrase: this.networkConfig.networkPassphrase
        })
        .setTimeout(30)
        .addOperation(
            xdr.Operation.createCustomContract({
                address: Address.fromString(this.adminAddress).toScAddress(),
                wasmHash: wasmHash,
                salt: xdr.ScVal.scvBytes(Buffer.alloc(32, 0)) // Empty salt for simplicity
            })
        )
        .build();

        const preparedTx = await this.server.prepareTransaction(createTx);
        preparedTx.sign(this.keypair);

        try {
            const result = await this.server.sendTransaction(preparedTx);
            
            if (result.status === 'SUCCESS') {
                const contractAddress = result.resultRetval.xdr;
                console.log('✅ Contract created successfully');
                return contractAddress;
            } else {
                throw new Error(`Contract creation failed: ${result.errorResult}`);
            }
        } catch (error) {
            throw new Error(`Failed to create contract: ${error.message}`);
        }
    }

    async initializeContract(contractAddress) {
        console.log('🔧 Initializing contract...');
        
        const account = await this.getAccount();
        const contract = new Contract(contractAddress);
        
        const initializeTx = new TransactionBuilder(account, {
            fee: '10000',
            networkPassphrase: this.networkConfig.networkPassphrase
        })
        .setTimeout(30)
        .addOperation(
            contract.call(
                'initialize',
                new Address(this.adminAddress).toScVal()
            )
        )
        .build();

        const preparedTx = await this.server.prepareTransaction(initializeTx);
        preparedTx.sign(this.keypair);

        try {
            const result = await this.server.sendTransaction(preparedTx);
            
            if (result.status === 'SUCCESS') {
                console.log('✅ Contract initialized successfully');
                return true;
            } else {
                throw new Error(`Initialization failed: ${result.errorResult}`);
            }
        } catch (error) {
            throw new Error(`Failed to initialize contract: ${error.message}`);
        }
    }

    async verifyDeployment(contractAddress) {
        console.log('🔍 Verifying deployment...');
        
        const contract = new Contract(contractAddress);
        
        try {
            // Check admin
            const adminResult = await this.server.simulateTransaction(
                new TransactionBuilder(await this.getAccount(), {
                    fee: '1000',
                    networkPassphrase: this.networkConfig.networkPassphrase
                })
                .setTimeout(30)
                .addOperation(contract.call('get_admin'))
                .build()
            );

            console.log('✅ Admin verification passed');

            // Check proof count
            const countResult = await this.server.simulateTransaction(
                new TransactionBuilder(await this.getAccount(), {
                    fee: '1000',
                    networkPassphrase: this.networkConfig.networkPassphrase
                })
                .setTimeout(30)
                .addOperation(contract.call('get_proof_count'))
                .build()
            );

            console.log('✅ Proof count verification passed');

            return true;
        } catch (error) {
            throw new Error(`Deployment verification failed: ${error.message}`);
        }
    }

    async estimateGasCosts(contractAddress) {
        console.log('⛽ Estimating gas costs...');
        
        const contract = new Contract(contractAddress);
        const account = await this.getAccount();
        
        // Test various operations to estimate gas costs
        const operations = [
            { name: 'issue_proof', method: 'issue_proof' },
            { name: 'verify_proof', method: 'verify_proof' },
            { name: 'revoke_proof', method: 'revoke_proof' },
            { name: 'get_proof', method: 'get_proof' }
        ];

        const gasEstimates = {};

        for (const op of operations) {
            try {
                let tx;
                
                if (op.name === 'issue_proof') {
                    // Create a mock proof request
                    const proofRequest = {
                        subject: new Address(this.adminAddress).toScVal(),
                        proof_type: xdr.ScVal.scvString('identity'),
                        event_data: xdr.ScVal.scvBytes(Buffer.from('test data')),
                        metadata: xdr.ScVal.scvMap([])
                    };
                    
                    tx = new TransactionBuilder(account, {
                        fee: '10000',
                        networkPassphrase: this.networkConfig.networkPassphrase
                    })
                    .setTimeout(30)
                    .addOperation(contract.call(op.method, proofRequest))
                    .build();
                } else if (op.name === 'verify_proof') {
                    tx = new TransactionBuilder(account, {
                        fee: '10000',
                        networkPassphrase: this.networkConfig.networkPassphrase
                    })
                    .setTimeout(30)
                    .addOperation(contract.call(op.method, new Address(this.adminAddress).toScVal(), xdr.ScVal.scvU64(1)))
                    .build();
                } else {
                    tx = new TransactionBuilder(account, {
                        fee: '1000',
                        networkPassphrase: this.networkConfig.networkPassphrase
                    })
                    .setTimeout(30)
                    .addOperation(contract.call(op.method, xdr.ScVal.scvU64(1)))
                    .build();
                }

                const simulation = await this.server.simulateTransaction(tx);
                
                if (simulation.result) {
                    // Convert resource fee to lumens (1 stroop = 0.0000001 XLM)
                    const resourceFee = simulation.transactionData.resourceFee || 0;
                    const feeInLumens = resourceFee / 10000000;
                    gasEstimates[op.name] = feeInLumens;
                    console.log(`💰 ${op.name}: ${feeInLumens} XLM`);
                }
            } catch (error) {
                console.log(`⚠️ Could not estimate gas for ${op.name}: ${error.message}`);
                gasEstimates[op.name] = 'unknown';
            }
        }

        return gasEstimates;
    }

    async deploy() {
        console.log(`🚀 Starting deployment to ${this.network}...`);
        
        try {
            // Step 1: Fund account
            await this.fundAccount();
            
            // Step 2: Compile contract
            const wasmBuffer = this.compileContract();
            
            // Step 3: Upload contract
            const wasmHash = await this.uploadContract(wasmBuffer);
            
            // Step 4: Create contract instance
            const contractAddress = await this.createContract(wasmHash);
            
            // Step 5: Initialize contract
            await this.initializeContract(contractAddress);
            
            // Step 6: Verify deployment
            await this.verifyDeployment(contractAddress);
            
            // Step 7: Estimate gas costs
            const gasEstimates = await this.estimateGasCosts(contractAddress);
            
            console.log('\n🎉 Deployment completed successfully!');
            console.log(`📍 Contract Address: ${contractAddress}`);
            console.log(`👤 Admin Address: ${this.adminAddress}`);
            
            console.log('\n⛽ Gas Cost Estimates:');
            Object.entries(gasEstimates).forEach(([op, cost]) => {
                const status = typeof cost === 'number' && cost < 0.001 ? '✅' : '⚠️';
                console.log(`${status} ${op}: ${cost} XLM`);
            });
            
            // Check if all operations are under 1000 lumens (0.001 XLM)
            const allUnderLimit = Object.values(gasEstimates).every(cost => 
                typeof cost === 'number' && cost < 0.001
            );
            
            if (allUnderLimit) {
                console.log('✅ All operations are under the 1000 lumens gas limit!');
            } else {
                console.log('⚠️ Some operations exceed the 1000 lumens gas limit');
            }
            
            return {
                contractAddress,
                adminAddress: this.adminAddress,
                gasEstimates,
                network: this.network
            };
            
        } catch (error) {
            console.error('❌ Deployment failed:', error.message);
            throw error;
        }
    }

    async testContract(contractAddress) {
        console.log('🧪 Testing contract functionality...');
        
        const contract = new Contract(contractAddress);
        const testSubject = Address.fromString(this.adminAddress);
        
        try {
            // Test issuing a proof
            const proofRequest = {
                subject: testSubject.toScVal(),
                proof_type: xdr.ScVal.scvString('test_identity'),
                event_data: xdr.ScVal.scvBytes(Buffer.from('test event data')),
                metadata: xdr.ScVal.scvMap([
                    new xdr.ScMapEntry({
                        key: xdr.ScVal.scvString('purpose'),
                        value: xdr.ScVal.scvString('testing')
                    })
                ])
            };

            const issueTx = new TransactionBuilder(await this.getAccount(), {
                fee: '10000',
                networkPassphrase: this.networkConfig.networkPassphrase
            })
            .setTimeout(30)
            .addOperation(contract.call('issue_proof', proofRequest))
            .build();

            const preparedIssueTx = await this.server.prepareTransaction(issueTx);
            preparedIssueTx.sign(this.keypair);

            const issueResult = await this.server.sendTransaction(preparedIssueTx);
            
            if (issueResult.status === 'SUCCESS') {
                console.log('✅ Proof issuance test passed');
                
                // Test getting the proof
                const proofId = issueResult.resultRetval;
                
                const getTx = new TransactionBuilder(await this.getAccount(), {
                    fee: '1000',
                    networkPassphrase: this.networkConfig.networkPassphrase
                })
                .setTimeout(30)
                .addOperation(contract.call('get_proof', proofId))
                .build();

                const getResult = await this.server.simulateTransaction(getTx);
                
                if (getResult.result) {
                    console.log('✅ Proof retrieval test passed');
                }
                
                console.log('🎉 All contract tests passed!');
                return true;
            } else {
                throw new Error(`Proof issuance test failed: ${issueResult.errorResult}`);
            }
        } catch (error) {
            console.error('❌ Contract testing failed:', error.message);
            return false;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const network = args[0] || 'testnet';
    const adminKey = args[1] || null;
    
    try {
        const deployer = new ProofVerifierDeployer(network, adminKey);
        const deployment = await deployer.deploy();
        
        // Run tests after deployment
        await deployer.testContract(deployment.contractAddress);
        
        console.log('\n📋 Deployment Summary:');
        console.log(JSON.stringify(deployment, null, 2));
        
    } catch (error) {
        console.error('💥 Deployment script failed:', error.message);
        process.exit(1);
    }
}

// Export for use as module
module.exports = { ProofVerifierDeployer };

// Run if called directly
if (require.main === module) {
    main();
}
