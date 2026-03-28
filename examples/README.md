# Verinode SDK Examples

This directory contains practical examples demonstrating how to use the Verinode SDKs across different programming languages.

## Available Examples

### Python Examples
- [`python_basic_example.py`](python_basic_example.py) - Basic SDK usage demonstration
- [`python_wallet_example.py`](python_wallet_example.py) - Wallet management example
- [`python_subscriptions_example.py`](python_subscriptions_example.py) - Real-time subscriptions

### Go Examples
- [`go_basic_example.go`](go_basic_example.go) - Basic SDK usage demonstration
- [`go_wallet_example.go`](go_wallet_example.go) - Wallet management example
- [`go_subscriptions_example.go`](go_subscriptions_example.go) - Real-time subscriptions

### Rust Examples
- [`rust_basic_example.rs`](rust_basic_example.rs) - Basic SDK usage demonstration
- [`rust_wallet_example.rs`](rust_wallet_example.rs) - Wallet management example
- [`rust_subscriptions_example.rs`](rust_subscriptions_example.rs) - Real-time subscriptions

### Java Examples
- [`JavaBasicExample.java`](JavaBasicExample.java) - Basic SDK usage demonstration
- [`JavaWalletExample.java`](JavaWalletExample.java) - Wallet management example
- [`JavaSubscriptionsExample.java`](JavaSubscriptionsExample.java) - Real-time subscriptions

## Running Examples

### Prerequisites

1. **Install the SDK** for your preferred language
2. **Set up environment variables**:
   ```bash
   export VERINODE_API_ENDPOINT="https://api.verinode.com"
   export VERINODE_NETWORK="testnet"
   export VERINODE_API_KEY="your-api-key"  # Optional
   ```

### Python Examples

```bash
# Install dependencies
pip install verinode-sdk

# Run basic example
python python_basic_example.py

# Run wallet example
python python_wallet_example.py

# Run subscriptions example
python python_subscriptions_example.py
```

### Go Examples

```bash
# Navigate to Go SDK directory
cd ../sdks/go

# Run basic example
go run ../../examples/go_basic_example.go

# Run wallet example
go run ../../examples/go_wallet_example.go

# Run subscriptions example
go run ../../examples/go_subscriptions_example.go
```

### Rust Examples

```bash
# Navigate to Rust SDK directory
cd ../sdks/rust

# Run basic example
cargo run --example basic

# Run wallet example
cargo run --example wallet

# Run subscriptions example
cargo run --example subscriptions
```

### Java Examples

```bash
# Navigate to Java SDK directory
cd ../sdks/java

# Compile and run basic example
mvn compile exec:java -Dexec.mainClass="JavaBasicExample"

# Run wallet example
mvn compile exec:java -Dexec.mainClass="JavaWalletExample"

# Run subscriptions example
mvn compile exec:java -Dexec.mainClass="JavaSubscriptionsExample"
```

## Example Categories

### 1. Basic Usage
Demonstrates fundamental SDK operations:
- Client initialization
- Authentication
- Proof creation and management
- Basic error handling

### 2. Wallet Management
Shows wallet-specific functionality:
- Connecting multiple wallet types
- Transaction management
- Message signing and verification
- Balance queries

### 3. Real-time Subscriptions
Illustrates WebSocket usage:
- Setting up subscriptions
- Handling real-time events
- Filtering updates
- Connection management

## Common Patterns

### Authentication Flow
All examples follow this pattern:
1. Initialize SDK with configuration
2. Authenticate with credentials
3. Use authenticated client for operations
4. Handle errors gracefully
5. Clean up resources

### Error Handling
Examples demonstrate:
- Try-catch blocks (Python/Java)
- Error type checking (Go)
- Result handling (Rust)
- Retry logic implementation

### Resource Management
Shows proper cleanup:
- Closing connections
- Canceling subscriptions
- Memory management
- Context cancellation (Go/Rust)

## Configuration Examples

### Environment-based Configuration
```bash
# Set environment variables
export VERINODE_API_ENDPOINT="https://api.verinode.com"
export VERINODE_NETWORK="testnet"
export VERINODE_LOGGING_ENABLED="true"
```

### Programmatic Configuration
Each language example shows how to configure the SDK programmatically with custom settings.

## Testing the Examples

### Using Test Credentials
Examples use demo credentials that will fail authentication. This is expected behavior.

### Mock Mode
Some examples include mock mode for testing without API access:
```python
# Python
client = Verinode(config, mock_mode=True)
```

### Local Testing
For local development, you can:
1. Set up a local API server
2. Update the `VERINODE_API_ENDPOINT` environment variable
3. Run examples against your local server

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Expected with demo credentials
   - Use real credentials for actual testing

2. **Network Errors**
   - Check internet connection
   - Verify API endpoint URL
   - Check firewall settings

3. **Dependency Issues**
   - Install required dependencies
   - Check version compatibility
   - Update package managers

4. **Compilation Errors**
   - Verify language version requirements
   - Check for syntax errors
   - Ensure all imports are available

### Debug Mode

Enable debug logging:
```bash
export VERINODE_LOGGING_ENABLED="true"
export VERINODE_LOG_LEVEL="DEBUG"
```

## Contributing Examples

We welcome contributions! To add new examples:

1. **Choose appropriate category**
2. **Follow existing patterns**
3. **Include comprehensive comments**
4. **Test with real API**
5. **Update documentation**

### Example Structure
```python
# File header with description
"""
Example: [Brief description]
Demonstrates: [Features shown]
Requirements: [Prerequisites]
"""

# Imports
# Configuration
# Main logic
# Error handling
# Cleanup
```

## Performance Considerations

Examples demonstrate:
- Connection reuse
- Efficient data handling
- Memory management
- Async/await patterns where applicable

## Security Best Practices

Examples show:
- Secure credential handling
- Input validation
- Error information sanitization
- Resource cleanup

## Next Steps

After running the examples:
1. **Explore the SDK documentation** for detailed API reference
2. **Check the integration guides** for specific use cases
3. **Join the community** for support and discussions
4. **Build your own applications** using the patterns shown

## Support

If you encounter issues with the examples:
- Check the [troubleshooting guide](../docs/troubleshooting.md)
- Search [GitHub Issues](https://github.com/Great-2025/Verinode/issues)
- Join our [Discord community](https://discord.gg/verinode)
- Create a new issue with details about your problem

---

**Happy coding!** 🚀
