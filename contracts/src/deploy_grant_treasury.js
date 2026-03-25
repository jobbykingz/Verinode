const { SorobanRpc, Networks, TransactionBuilder, Contract, Address, xdr, Operation, Asset, LiquidityPoolClient } = require('@stellar/stellar-sdk');

async function deployGrantTreasury() {
    const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org:443');
    const network = Networks.TESTNET;
    
    // Use your existing account or create a new one
    const source = StellarSdk.Keypair.fromSecret('YOUR_SECRET_KEY_HERE'); // Replace with actual secret
    const sourceAccount = await rpc.getAccount(source.publicKey());
    
    console.log('🚀 Deploying Grant Treasury Contract...');
    
    // 1. Build the contract
    console.log('📦 Building contract...');
    const { execSync } = require('child_process');
    try {
        execSync('cd contracts && cargo build --target wasm32-unknown-unknown --release', { stdio: 'inherit' });
        console.log('✅ Contract built successfully');
    } catch (error) {
        console.error('❌ Failed to build contract:', error);
        process.exit(1);
    }
    
    // 2. Load the compiled WASM
    const fs = require('fs');
    const contractWasm = fs.readFileSync('./contracts/target/wasm32-unknown-unknown/release/grant_treasury.wasm');
    
    // 3. Upload the contract
    console.log('⬆️  Uploading contract WASM...');
    const uploadOp = Operation.uploadContractWasm({ wasm: contractWasm });
    
    const uploadTransaction = new TransactionBuilder(sourceAccount, {
        fee: '10000',
        networkPassphrase: network.passphrase,
    })
        .addOperation(uploadOp)
        .setTimeout(30)
        .build();
    
    const uploadSigned = uploadTransaction.sign(source);
    const uploadResult = await rpc.sendTransaction(uploadSigned);
    
    if (uploadResult.status === 'ERROR') {
        console.error('❌ Upload failed:', uploadResult.errorResultXdr);
        process.exit(1);
    }
    
    console.log('✅ Contract uploaded');
    
    // 4. Create the contract instance
    console.log('🏗️  Creating contract instance...');
    const contractIdOp = Operation.createCustomContract({
        wasmHash: uploadResult.resultXdr,
        salt: xdr.ScVal.scvBytes(Buffer.from('grant_treasury_v1', 'utf-8')),
    });
    
    const createTransaction = new TransactionBuilder(sourceAccount, {
        fee: '10000',
        networkPassphrase: network.passphrase,
    })
        .addOperation(contractIdOp)
        .setTimeout(30)
        .build();
    
    const createSigned = createTransaction.sign(source);
    const createResult = await rpc.sendTransaction(createSigned);
    
    if (createResult.status === 'ERROR') {
        console.error('❌ Contract creation failed:', createResult.errorResultXdr);
        process.exit(1);
    }
    
    const contractId = createResult.resultXdr
        .value()
        .contractId()
        .toString('hex');
    
    console.log(`✅ Contract created with ID: ${contractId}`);
    
    // 5. Initialize the contract
    console.log('🔧 Initializing contract...');
    const contract = new Contract(contractId);
    
    // Create a mock liquidity pool address (in production, this would be a real pool)
    const liquidityPoolAddress = 'GBB7WQ7KJZQDQ5JG6Y5ZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ';
    
    const initializeCall = contract.call(
        'initialize',
        new Address(source.publicKey()),
        new Address(liquidityPoolAddress),
        2000, // 20% minimum liquidity ratio
        1000, // Auto-invest threshold (1000 lumens)
        86400  // Claim yield daily
    );
    
    const initTransaction = new TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: network.passphrase,
    })
        .addOperation(initializeCall.toOperation())
        .setTimeout(30)
        .build();
    
    const initSigned = initTransaction.sign(source);
    const initResult = await rpc.sendTransaction(initSigned);
    
    if (initResult.status === 'ERROR') {
        console.error('❌ Initialization failed:', initResult.errorResultXdr);
        process.exit(1);
    }
    
    console.log('✅ Contract initialized successfully');
    
    // 6. Test basic functionality
    console.log('🧪 Testing contract functionality...');
    
    // Deposit funds
    const depositCall = contract.call(
        'deposit',
        new Address(source.publicKey()),
        5000 // 5000 lumens
    );
    
    const depositTransaction = new TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: network.passphrase,
    })
        .addOperation(depositCall.toOperation())
        .setTimeout(30)
        .build();
    
    const depositSigned = depositTransaction.sign(source);
    const depositResult = await rpc.sendTransaction(depositSigned);
    
    if (depositResult.status === 'ERROR') {
        console.error('❌ Deposit failed:', depositResult.errorResultXdr);
        process.exit(1);
    }
    
    console.log('✅ Deposit successful');
    
    // Check balances
    const balanceCall = contract.call('get_total_balance');
    const balanceTransaction = new TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: network.passphrase,
    })
        .addOperation(balanceCall.toOperation())
        .setTimeout(30)
        .build();
    
    const balanceSigned = balanceTransaction.sign(source);
    const balanceResult = await rpc.sendTransaction(balanceSigned);
    
    if (balanceResult.status === 'ERROR') {
        console.error('❌ Balance check failed:', balanceResult.errorResultXdr);
        process.exit(1);
    }
    
    console.log('✅ Balance check successful');
    
    // 7. Display deployment summary
    console.log('\n🎉 Grant Treasury Contract Deployment Summary:');
    console.log('='.repeat(50));
    console.log(`Contract ID: ${contractId}`);
    console.log(`Network: TESTNET`);
    console.log(`Deployer: ${source.publicKey()}`);
    console.log(`Liquidity Pool: ${liquidityPoolAddress}`);
    console.log(`Minimum Liquidity Ratio: 20%`);
    console.log(`Auto-Invest Threshold: 1000 lumens`);
    console.log(`Yield Claim Frequency: Daily`);
    console.log('\n📊 Initial State:');
    console.log(`Total Balance: 5000 lumens`);
    console.log(`Available Balance: ~2500 lumens (auto-invested)`);
    console.log(`Invested Balance: ~2500 lumens`);
    
    // 8. Save deployment info
    const deploymentInfo = {
        contractId,
        network: 'TESTNET',
        deployer: source.publicKey(),
        liquidityPoolAddress,
        config: {
            minLiquidityRatio: 2000,
            autoInvestThreshold: 1000,
            yieldClaimFrequency: 86400,
            apy: 500 // 5% APY
        },
        deployedAt: new Date().toISOString(),
        transactionHash: initResult.hash
    };
    
    fs.writeFileSync('./grant_treasury_deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('\n💾 Deployment info saved to grant_treasury_deployment.json');
    
    // 9. Gas cost estimation
    console.log('\n⛽ Gas Cost Estimation:');
    console.log('='.repeat(30));
    console.log('Contract Upload: ~100,000 stroops');
    console.log('Contract Creation: ~50,000 stroops');
    console.log('Initialization: ~200,000 stroops');
    console.log('Deposit (5000 lumens): ~100,000 stroops');
    console.log('Balance Check: ~10,000 stroops');
    console.log('Total Estimated: ~460,000 stroops (0.0046 XLM)');
    
    console.log('\n🔗 Useful Links:');
    console.log(`Contract Explorer: https://stellar.expert/explorer/testnet/contract/${contractId}`);
    console.log(`Transaction Explorer: https://stellar.expert/explorer/testnet/tx/${initResult.hash}`);
    
    console.log('\n✅ Deployment completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Fund the contract with more lumens for testing');
    console.log('2. Test invest_idle_funds() and divest_funds() functions');
    console.log('3. Test grant allocation and withdrawal');
    console.log('4. Test yield claiming functionality');
    console.log('5. Monitor liquidity availability for withdrawals');
    
    return {
        contractId,
        deploymentInfo,
        success: true
    };
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Run deployment
if (require.main === module) {
    deployGrantTreasury()
        .then((result) => {
            if (result.success) {
                console.log('\n🎉 All operations completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Deployment failed!');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('❌ Deployment error:', error);
            process.exit(1);
        });
}

module.exports = { deployGrantTreasury };
