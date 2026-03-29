# Decentralized Storage Integration for Verinode

This implementation provides comprehensive decentralized storage integration for the Verinode project, supporting both IPFS and Arweave networks with advanced features like redundancy, content addressing, and permanent storage options.

## Overview

The decentralized storage system consists of:

- **Smart Contracts** (Rust/Soroban): Storage management logic on-chain
- **Backend Services** (TypeScript/Node.js): IPFS and Arweave integration services
- **Frontend Components** (React/TypeScript): User interface for storage management
- **Models** (TypeScript): Data structures and validation

## Features

### ✅ IPFS Integration
- Distributed file storage with automatic pinning
- Content addressing with CID generation
- Redundancy and replication management
- Fast retrieval with caching layers
- Storage verification and integrity checks

### ✅ Arweave Integration
- Permanent storage with one-time payment
- Transaction management and confirmation tracking
- Cost estimation and optimization
- Content verification with hash checking
- Block height confirmation monitoring

### ✅ Hybrid Storage
- Combined IPFS + Arweave for maximum reliability
- Automatic failover between storage types
- Optimized redundancy based on storage type
- Cost-efficient storage strategies

### ✅ Content Addressing
- CID generation using multiple hash functions
- Content deduplication
- Version management
- Metadata handling
- Integrity verification

### ✅ Storage Management
- Automatic redundancy and replication
- Storage cost optimization and monitoring
- Fast retrieval with caching layers
- Storage verification and integrity checks
- User-friendly storage management interface

### ✅ Performance Optimization
- Large file handling optimizations
- Batch operations support
- Caching for frequently accessed content
- Progress tracking for uploads/downloads
- Compression and encryption support

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Smart         │
│   React App     │◄──►│   Services      │◄──►│   Contracts     │
│                 │    │                 │    │                 │
│ • StorageMgr    │    │ • IPFSService   │    │ • IPFSIntegration│
│ • FileRetrieval │    │ • ArweaveService │    │ • ArweaveInteg  │
│ • UI Components │    │ • Decentralized  │    │ • StorageManager│
│                 │    │   StorageService │    │ • ContentAddress│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐            ┌─────▼─────┐            ┌─────▼─────┐
    │   UI    │            │   HTTP    │            │  Soroban  │
    │Events  │            │   APIs    │            │   RPC     │
    └─────────┘            └───────────┘            └───────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Decentralized        │
                    │   Storage Networks     │
                    │                         │
                    │ ┌─────┐   ┌─────────┐ │
                    │ │IPFS │   │Arweave  │ │
                    │ └─────┘   └─────────┘ │
                    └─────────────────────────┘
```

## File Structure

### Smart Contracts (`contracts/src/storage/`)
```
storage/
├── IPFSIntegration.rs     # IPFS storage contract
├── ArweaveIntegration.rs  # Arweave storage contract
├── StorageManager.rs      # Main storage management contract
├── ContentAddressing.rs   # Content addressing and CID management
└── mod.rs                # Module exports
```

### Backend Services (`backend/src/services/storage/`)
```
storage/
├── IPFSService.ts              # IPFS client and operations
├── ArweaveService.ts           # Arweave client and operations
├── DecentralizedStorageService.ts # Main storage service
└── ../models/StorageReference.ts   # Data models
```

### Frontend Components (`frontend/src/components/Storage/`)
```
Storage/
├── StorageManager.tsx    # Main storage management UI
└── FileRetrieval.tsx      # File retrieval and preview UI
```

## Installation & Setup

### Prerequisites
- Node.js 16+
- Rust 1.70+
- IPFS node (optional, for local development)
- Arweave wallet (for permanent storage)

### Backend Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your IPFS and Arweave configuration
```

3. Start the backend service:
```bash
npm run dev
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the frontend:
```bash
npm start
```

### Smart Contract Deployment

1. Build contracts:
```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown
```

2. Deploy to Soroban network:
```bash
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/verinode_contracts.wasm
```

## Configuration

### IPFS Configuration
```typescript
const ipfsConfig: IPFSConfig = {
  apiUrl: 'https://ipfs.infura.io:5001',
  gatewayUrl: 'https://ipfs.io',
  projectSecret: 'your-infura-secret',
  projectId: 'your-infura-project-id',
  timeout: 30000,
  retryAttempts: 3,
  enablePubSub: true
};
```

### Arweave Configuration
```typescript
const arweaveConfig: ArweaveConfig = {
  gatewayUrl: 'https://arweave.net',
  nodeUrl: 'https://arweave.net',
  wallet: {
    jwk: yourArweaveWalletJWK,
    address: 'your-wallet-address'
  },
  timeout: 60000,
  retryAttempts: 3,
  currency: 'AR',
  rewardMultiplier: 1
};
```

## API Reference

### Storage Operations

#### Upload File
```typescript
const result = await storageService.storeData(fileBuffer, {
  storageType: 'hybrid',
  contentType: 'application/pdf',
  metadata: { name: 'document.pdf' },
  tags: ['important', 'document']
});
```

#### Retrieve File
```typescript
const data = await storageService.retrieveData(storageId);
```

#### Verify Storage
```typescript
const verified = await storageService.verifyStorage(storageId);
```

#### List Storage
```typescript
const files = await storageService.listStorage();
```

### Smart Contract Methods

#### IPFS Integration
```rust
// Store data to IPFS
let ipfs_ref = IPFSIntegration::store_data(env, user, data, true);

// Get IPFS reference
let reference = IPFSIntegration::get_reference(env, user, cid);

// Pin content
IPFSIntegration::pin_content(env, cid);
```

#### Arweave Integration
```rust
// Store data permanently
let arweave_ref = ArweaveIntegration::store_permanent(env, user, data, content_type, tags);

// Get cost estimate
let cost = ArweaveIntegration::get_cost_estimate(env, size_bytes);

// Verify permanent storage
let verified = ArweaveIntegration::verify_permanent_storage(env, tx_id, expected_hash);
```

## Usage Examples

### Basic File Upload
```typescript
import { DecentralizedStorageService } from './services/storage/DecentralizedStorageService';

const storageService = new DecentralizedStorageService(config, policy);
await storageService.initialize();

// Upload a file
const fileBuffer = fs.readFileSync('./document.pdf');
const result = await storageService.storeData(fileBuffer, {
  storageType: 'hybrid',
  contentType: 'application/pdf',
  metadata: {
    name: 'document.pdf',
    description: 'Important legal document'
  },
  tags: ['legal', 'important', 'pdf']
});

console.log('Storage ID:', result.id);
console.log('IPFS CID:', result.ipfsRef?.cid);
console.log('Arweave TX:', result.arweaveRef?.transactionId);
```

### File Retrieval with Verification
```typescript
// Retrieve file with automatic verification
const data = await storageService.retrieveData(result.id, {
  verify: true,
  cache: true
});

// Save to file
fs.writeFileSync('./downloaded-document.pdf', data);
```

### Storage Management
```typescript
// Get storage metrics
const metrics = await storageService.getMetrics();
console.log('Total files:', metrics.totalFiles);
console.log('Total size:', metrics.totalSize);
console.log('Verification rate:', metrics.verificationRate);

// List all storage references
const storageList = storageService.listStorage();

// Batch verification
const results = await storageService.batchVerify([
  'storage-id-1',
  'storage-id-2',
  'storage-id-3'
]);
```

## Frontend Components

### StorageManager Component
```typescript
import { StorageManager } from './components/Storage/StorageManager';

function App() {
  return (
    <StorageManager 
      userId="user-123"
      onStorageSelect={(storage) => {
        console.log('Selected storage:', storage);
      }}
    />
  );
}
```

### FileRetrieval Component
```typescript
import { FileRetrieval } from './components/Storage/FileRetrieval';

function FileManager() {
  return (
    <FileRetrieval 
      userId="user-123"
      allowDownload={true}
      showPreview={true}
      onFileSelect={(storage) => {
        // Handle file selection
      }}
    />
  );
}
```

## Performance Considerations

### Large Files
- Automatic chunking for files > 100MB
- Parallel upload/download processing
- Progress tracking and resumable operations
- Compression support for bandwidth optimization

### Caching Strategy
- LRU cache for frequently accessed files
- Configurable cache size limits
- Cache hit rate monitoring
- Automatic cache cleanup

### Network Optimization
- Connection pooling for IPFS nodes
- Retry logic with exponential backoff
- Timeout configuration per operation type
- Health monitoring and failover

## Security Features

### Content Integrity
- SHA-256 hash verification
- CID validation for IPFS content
- Arweave transaction verification
- Automatic corruption detection

### Access Control
- User-based storage isolation
- Admin-only configuration changes
- JWT-based API authentication
- Rate limiting and DDoS protection

### Data Protection
- Optional encryption support
- Private IPFS networks
- Secure key management
- Audit logging

## Monitoring & Analytics

### Storage Metrics
- Total storage usage
- File count by type
- Verification success rates
- Cost tracking and optimization

### Performance Metrics
- Upload/download speeds
- Cache hit rates
- Network latency
- Error rates and types

### Health Monitoring
- Service availability checks
- Network connectivity status
- Storage backend health
- Automated alerting

## Troubleshooting

### Common Issues

#### IPFS Connection Issues
```bash
# Check IPFS node status
ipfs id

# Check connectivity
ipfs swarm peers

# Restart IPFS service
ipfs daemon --restart
```

#### Arweave Transaction Issues
```typescript
// Check transaction status
const status = await arweaveService.getTransaction(txId);
console.log('Block height:', status.block_height);

// Wait for confirmation
const confirmed = await arweaveService.waitForConfirmation(txId, 300000);
```

#### Storage Verification Failures
```typescript
// Re-verify failed storage
const repaired = await storageService.repairStorage(storageId);

// Check verification details
const verification = await storageService.verifyStorage(storageId);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Join our Discord community
- Check the documentation at docs.verinode.io

---

**Note**: This implementation is part of the Verinode project's Issue #139 for decentralized storage integration. It provides a comprehensive solution for storing proof data and other files on decentralized networks with redundancy, content addressing, and permanent storage options.
