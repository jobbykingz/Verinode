# Multi-Signature Wallet Integration for Verinode

## Overview

This implementation provides a comprehensive multi-signature wallet system for the Verinode platform, enhancing security for sensitive operations like proof creation and contract interactions.

## Features

### 🔐 Core Multi-Signature Functionality
- **M-of-N Signature Scheme**: Configurable threshold-based approval system
- **Multiple Network Support**: Stellar, Ethereum, and Polygon
- **Dynamic Signer Management**: Add/remove signers with proper validation
- **Weight-Based Signatures**: Support for different signer weights

### 🛡️ Security Features
- **Recovery Mechanisms**: Social recovery, backup signatures, and time-delay recovery
- **Security Monitoring**: Real-time detection of suspicious patterns
- **Rate Limiting**: Protection against brute force attacks
- **Encryption**: End-to-end encryption for sensitive data

### 📊 Analytics & Monitoring
- **Signature Statistics**: Comprehensive metrics on signer participation
- **Security Scoring**: Automated security assessment
- **Audit Trail**: Complete audit logging for compliance
- **Performance Metrics**: Transaction success rates and timing analysis

### 🔗 Integration Features
- **Proof Operations**: Multi-sig approval for proof creation and verification
- **Contract Interactions**: Secure smart contract execution
- **Token Transfers**: Multi-approval required for fund movements
- **Emergency Actions**: Critical operation handling with enhanced security

## Architecture

### Backend Components

#### Models
- `MultiSigWallet.ts`: Wallet configuration and state management
- `SignatureRequest.ts`: Signature request lifecycle management

#### Services
- `MultiSigService.ts`: Core multi-signature operations
- `SignatureService.ts`: Signature verification and validation
- `ProofMultiSigIntegration.ts`: Integration with existing proof operations
- `MultiSigRecoveryService.ts`: Wallet recovery and security optimization

#### Controllers & Routes
- `MultiSigController.ts`: HTTP API endpoints
- `multisig.ts`: Route definitions with middleware

### Frontend Components

#### React Components
- `MultiSigWallet.tsx`: Wallet management interface
- `SignatureRequest.tsx`: Signature request handling
- `SignatureStatus.tsx`: Real-time status monitoring

#### Services
- `multiSigService.ts`: Frontend API integration

### Smart Contract
- `MultiSigContract.rs`: Stellar smart contract implementation

## Installation & Setup

### Prerequisites
- Node.js 16+
- MongoDB 4.4+
- Redis (for caching and rate limiting)
- Stellar SDK for blockchain interactions

### Backend Setup

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Configure the following variables:
# - JWT_SECRET
# - ENCRYPTION_KEY
# - MULTISIG_SECRET
# - Database connections
# - Email/SMS service credentials
```

3. **Database Setup**
```bash
# Ensure MongoDB is running
# Create indexes for performance
npm run db:index
```

4. **Start the Server**
```bash
npm run dev
```

### Frontend Setup

1. **Install Dependencies**
```bash
cd frontend
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Configure API endpoints
REACT_APP_API_URL=http://localhost:3001/api
```

3. **Start the Development Server**
```bash
npm start
```

### Smart Contract Deployment

1. **Build the Contract**
```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown
```

2. **Deploy to Stellar**
```bash
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/verinode_multisig.wasm
```

## API Documentation

### Wallet Management

#### Create Wallet
```http
POST /api/multisig/wallets
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Company Wallet",
  "description": "Main company multi-sig wallet",
  "network": "STELLAR",
  "threshold": 2,
  "signers": [
    {
      "address": "G...",
      "name": "CEO",
      "role": "OWNER",
      "weight": 1
    },
    {
      "address": "G...",
      "name": "CTO", 
      "role": "ADMIN",
      "weight": 1
    }
  ]
}
```

#### Get Wallet
```http
GET /api/multisig/wallets/{walletId}
Authorization: Bearer <token>
```

#### Update Wallet Config
```http
PUT /api/multisig/wallets/{walletId}/config
Authorization: Bearer <token>

{
  "threshold": 3,
  "security": {
    "dailyLimit": 2000000,
    "singleTransactionLimit": 200000
  }
}
```

### Signature Requests

#### Create Signature Request
```http
POST /api/multisig/signature-requests
Authorization: Bearer <token>

{
  "walletId": "wallet_123",
  "type": "PROOF_CREATION",
  "title": "Create Video Proof",
  "description": "Multi-sig approval for video proof creation",
  "payload": {
    "proofType": "VIDEO",
    "mediaUrl": "https://...",
    "metadata": { ... }
  },
  "priority": "HIGH"
}
```

#### Add Signature
```http
POST /api/multisig/signature-requests/{requestId}/signatures
Authorization: Bearer <token>

{
  "signerAddress": "G...",
  "signature": "signature_data",
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1"
  }
}
```

#### Execute Request
```http
POST /api/multisig/signature-requests/{requestId}/execute
Authorization: Bearer <token>
```

### Recovery Operations

#### Initiate Recovery
```http
POST /api/multisig/wallets/{walletId}/initiate-recovery
Authorization: Bearer <token>

{
  "recoveryMethod": "SOCIAL_RECOVERY",
  "initiatorAddress": "G...",
  "reason": "Private key compromised",
  "evidence": {
    "compromisedAccount": true
  }
}
```

#### Approve Recovery
```http
POST /api/multisig/wallets/{walletId}/complete-recovery
Authorization: Bearer <token>

{
  "newSigners": [
    {
      "address": "G...",
      "name": "New CEO",
      "role": "OWNER",
      "weight": 1
    }
  ],
  "removedSigners": ["G..."]
}
```

## Security Considerations

### Key Management
- Private keys should never be stored in plain text
- Use hardware security modules (HSM) for production
- Implement proper key rotation policies

### Access Control
- Multi-factor authentication for critical operations
- IP whitelisting for administrative access
- Regular audit of signer permissions

### Network Security
- HTTPS/TLS encryption for all communications
- API rate limiting to prevent abuse
- Input validation and sanitization

### Monitoring & Alerting
- Real-time security monitoring
- Automated alerts for suspicious activities
- Regular security audits and penetration testing

## Performance Optimization

### Database Optimization
- Proper indexing on frequently queried fields
- Connection pooling for database connections
- Caching for frequently accessed data

### Smart Contract Optimization
- Gas-efficient contract design
- Batch operations where possible
- Event-driven architecture for updates

### Frontend Optimization
- Lazy loading for large datasets
- Real-time updates using WebSockets
- Progressive web app features

## Testing

### Unit Tests
```bash
cd backend
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### Smart Contract Tests
```bash
cd contracts
cargo test
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## Deployment

### Production Deployment
1. **Environment Setup**: Configure production environment variables
2. **Database Migration**: Run database migrations
3. **Smart Contract Deployment**: Deploy contracts to mainnet
4. **Monitoring Setup**: Configure logging and monitoring
5. **Security Hardening**: Apply security best practices

### Docker Deployment
```bash
docker-compose up -d
```

### Kubernetes Deployment
```bash
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

#### Signature Verification Fails
- Check signer address format
- Verify signature encoding
- Ensure nonce is not reused

#### Wallet Not Found
- Verify wallet ID format
- Check database connectivity
- Review access permissions

#### Recovery Process Fails
- Verify recovery method is enabled
- Check recovery signer permissions
- Ensure proper evidence provided

### Debug Mode
Enable debug logging:
```bash
DEBUG=multisig:* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## Changelog

### v1.0.0
- Initial multi-signature wallet implementation
- Support for Stellar, Ethereum, and Polygon
- Recovery mechanisms and security features
- Integration with existing proof operations
- Comprehensive API and frontend components
