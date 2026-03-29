# Verinode Multi-Language SDK Documentation

Welcome to the comprehensive documentation for Verinode's multi-language SDK suite. This document provides an overview of all available SDKs, their features, and how to get started with each one.

## Overview

Verinode provides official SDKs for multiple programming languages to simplify integration and expand the developer ecosystem. Each SDK maintains a consistent API design while following language-specific best practices.

## Available SDKs

| Language | Package | Version | Status |
|----------|---------|---------|--------|
| **Python** | `verinode-sdk` | 1.0.0 | ✅ Complete |
| **Go** | `github.com/Great-2025/verinode-go` | 1.0.0 | ✅ Complete |
| **Rust** | `verinode-sdk` | 1.0.0 | ✅ Complete |
| **Java** | `com.verinode:verinode-sdk` | 1.0.0 | ✅ Complete |

## Quick Links

- [Python SDK Documentation](./python.md)
- [Go SDK Documentation](./go.md)
- [Rust SDK Documentation](./rust.md)
- [Java SDK Documentation](./java.md)
- [Examples](../examples/)
- [API Reference](https://docs.verinode.com/api)

## Core Features Across All SDKs

### 🔐 Authentication
- Email/password authentication
- User registration
- Token refresh
- Session management

### 📄 Proof Management
- Create, read, update, delete proofs
- Search and filtering
- Metadata support
- Tagging system

### ✅ Verification System
- Create and manage verifications
- Bulk operations
- Approval/rejection workflows
- Evidence attachment

### 💳 Wallet Integration
- Multi-wallet support (Stellar, Albedo, Freighter, etc.)
- Transaction management
- Message signing/verification
- Balance queries

### 📡 Real-time Updates
- WebSocket subscriptions
- Event-driven architecture
- Filtered updates
- Connection management

### 🛡️ Error Handling
- Comprehensive error types
- Retry logic with exponential backoff
- Network resilience
- Detailed error context

## Installation Guide

### Python
```bash
pip install verinode-sdk
```

### Go
```bash
go get github.com/Great-2025/verinode-go
```

### Rust
```toml
[dependencies]
verinode-sdk = "1.0.0"
```

### Java (Maven)
```xml
<dependency>
    <groupId>com.verinode</groupId>
    <artifactId>verinode-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

## Configuration

All SDKs support configuration through:

1. **Environment Variables**: `VERINODE_API_ENDPOINT`, `VERINODE_NETWORK`, etc.
2. **Configuration Objects**: Language-specific configuration builders
3. **Configuration Files**: JSON/YAML/Properties files (where applicable)

### Common Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `api_endpoint` | API server URL | `https://api.verinode.com` |
| `network` | Network type (mainnet/testnet) | `mainnet` |
| `timeout` | Request timeout | 10 seconds |
| `max_retries` | Maximum retry attempts | 3 |
| `retry_delay` | Delay between retries | 1 second |
| `backoff_multiplier` | Exponential backoff factor | 2.0 |
| `logging_enabled` | Enable debug logging | `false` |

## API Consistency

While each SDK follows language-specific conventions, they maintain consistency in:

### Method Names
- `authenticate()` - User authentication
- `proof.create()` - Create proof
- `proof.get()` - Get proof by ID
- `proof.list()` - List proofs
- `proof.search()` - Search proofs
- `proof.update()` - Update proof
- `proof.delete()` - Delete proof
- `proof.verify()` - Verify proof

### Request/Response Patterns
- Builder patterns for complex requests
- Consistent response structures
- Pagination support
- Error handling

### Authentication Flow
1. Initialize client with configuration
2. Authenticate with credentials
3. Receive authentication token
4. Use token for subsequent requests
5. Refresh token when needed

## Error Handling

All SDKs provide structured error handling with:

### Error Categories
- **Authentication Errors**: Invalid credentials, token issues
- **Validation Errors**: Invalid request data
- **Network Errors**: Connection issues, timeouts
- **API Errors**: Server-side errors
- **Business Logic Errors**: Domain-specific errors

### Error Information
- Error code/type
- Human-readable message
- HTTP status code (when applicable)
- Additional context/details

## Real-time Features

### WebSocket Subscriptions
All SDKs support real-time updates through WebSocket connections:

```python
# Python
subscription = await client.subscribe_to_updates({
    "event_types": ["proof_updated", "verification_created"]
})

# Go
subscription, err := client.SubscribeToUpdates(ctx, map[string]interface{}{
    "event_types": []string{"proof_updated", "verification_created"},
})

# Rust
let subscription = client.subscribe_to_updates(filters).await?;

# Java
Subscription subscription = client.subscribeToUpdates(filters);
```

### Event Types
- `proof_created` - New proof created
- `proof_updated` - Proof status changed
- `proof_deleted` - Proof deleted
- `verification_created` - New verification
- `verification_updated` - Verification status changed
- `wallet_connected` - Wallet connected
- `wallet_disconnected` - Wallet disconnected
- `transaction_sent` - Transaction completed

## Testing

Each SDK includes comprehensive test suites:

### Unit Tests
- Core functionality testing
- Mock responses
- Edge case handling

### Integration Tests
- Real API interactions
- End-to-end workflows
- Performance testing

### Test Configuration
- Test API endpoints
- Mock data fixtures
- Test utilities

## Performance Considerations

### Connection Pooling
- HTTP connection reuse
- WebSocket connection management
- Resource cleanup

### Caching
- Authentication token caching
- Response caching (where appropriate)
- Rate limiting awareness

### Memory Management
- Efficient data structures
- Stream processing for large responses
- Garbage collection optimization

## Security Best Practices

### Credential Management
- Never hardcode credentials
- Use environment variables
- Secure token storage
- Token rotation

### Network Security
- HTTPS enforcement
- Certificate validation
- Request signing
- Input validation

### Data Protection
- Sensitive data masking in logs
- Secure memory handling
- Data encryption at rest/transit

## Migration Guide

### From REST API to SDK
1. Replace HTTP calls with SDK methods
2. Update error handling
3. Implement retry logic
4. Add real-time features

### Between SDK Versions
- Semantic versioning
- Backward compatibility
- Deprecation notices
- Migration scripts

## Community and Support

### Getting Help
- [Documentation](https://docs.verinode.com)
- [GitHub Issues](https://github.com/Great-2025/Verinode/issues)
- [Discord Community](https://discord.gg/verinode)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/verinode)

### Contributing
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [Code of Conduct](../../CODE_OF_CONDUCT.md)
- [Development Setup](../development/README.md)

### Release Notes
- [Changelog](../../CHANGELOG.md)
- [Migration Guides](./migration/)
- [Breaking Changes](./breaking-changes.md)

## Roadmap

### Upcoming Features
- Additional language support
- Enhanced real-time capabilities
- Performance optimizations
- Advanced analytics

### SDK Improvements
- Better error messages
- More examples and tutorials
- Improved documentation
- Enhanced developer experience

## License

All SDKs are released under the MIT License. See the [LICENSE](../../LICENSE) file for details.

---

**Next Steps**: Choose your preferred language SDK from the navigation menu to get started with detailed documentation and examples.
