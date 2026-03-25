import { config } from './src/config';

console.log('✅ Configuration loaded successfully:');
console.log('Server Port:', config.server.port);
console.log('Node Env:', config.server.nodeEnv);
console.log('Features:', config.features);
console.log('Blockchain (Ethereum) RPC:', config.blockchain.ethereum.rpcUrl);
