# Verinode Python SDK

Official Python SDK for Verinode - Web3 infrastructure for cryptographic proofs on Stellar.

## Installation

```bash
pip install verinode-sdk
```

## Quick Start

```python
import asyncio
from verinode import Verinode

async def main():
    # Initialize the SDK
    client = Verinode.init(
        api_endpoint="https://api.verinode.com",
        network="testnet"
    )
    
    # Authenticate
    await client.authenticate("your-email@example.com", "your-password")
    
    # Create a proof
    proof = await client.proof.create({
        "title": "My First Proof",
        "description": "This is a test proof",
        "metadata": {"type": "document"}
    })
    
    print(f"Created proof: {proof.id}")
    
    # Get proof details
    proof_details = await client.proof.get(proof.id)
    print(f"Proof status: {proof_details.status}")

asyncio.run(main())
```

## Configuration

The SDK can be configured using environment variables or configuration object:

### Environment Variables

```bash
export VERINODE_API_ENDPOINT="https://api.verinode.com"
export VERINODE_NETWORK="mainnet"
export VERINODE_API_KEY="your-api-key"
export VERINODE_TIMEOUT=10000
```

### Configuration Object

```python
from verinode import Verinode, VerinodeConfig

config = VerinodeConfig(
    api_endpoint="https://api.verinode.com",
    network="mainnet",
    api_key="your-api-key",
    timeout=15000,
    max_retries=5
)

client = Verinode(config)
```

## Features

### Authentication

```python
# Login with email and password
token = await client.authenticate("email@example.com", "password")

# Register new user
token = await client.register("newuser@example.com", "password", "username")

# Refresh token
new_token = await client.refresh_token()

# Logout
await client.logout()
```

### Proof Management

```python
# Create proof
proof = await client.proof.create({
    "title": "Document Verification",
    "description": "Verify this important document",
    "metadata": {"document_type": "passport"},
    "tags": ["identity", "verification"],
    "expires_at": "2024-12-31T23:59:59Z"
})

# List proofs with filters
proofs = await client.proof.list(
    status="pending",
    tags=["identity"],
    options={"page": 1, "page_size": 20}
)

# Search proofs
results = await client.proof.search("document verification")

# Update proof
updated = await client.proof.update(proof.id, {
    "title": "Updated Title",
    "description": "Updated description"
})

# Verify proof
await client.proof.verify(proof.id, {"verified_by": "system"})

# Delete proof
await client.proof.delete(proof.id)
```

### Verification Management

```python
# Create verification
verification = await client.verification.create({
    "proof_id": "proof-id",
    "status": "approved",
    "comment": "Verification successful",
    "evidence": {"method": "automated"}
})

# List verifications
verifications = await client.verification.list(
    proof_id="proof-id",
    status="pending"
)

# Approve verification
await client.verification.approve(verification.id, "Approved after review")

# Reject verification
await client.verification.reject(verification.id, "Insufficient evidence")

# Bulk operations
approved = await client.verification.bulk_approve(
    ["ver1", "ver2", "ver3"],
    "Bulk approval"
)

# Get statistics
stats = await client.verification.get_statistics()
print(f"Total verifications: {stats['total']}")
```

### Wallet Management

```python
# Connect wallet
wallet = await client.wallet.connect({
    "wallet_type": "stellar",
    "public_key": "G...",
    "network": "testnet"
})

# Get wallet balance
balance = await client.wallet.get_balance(wallet.id)

# Send transaction
tx = await client.wallet.send_transaction(
    wallet.id,
    "G...",
    "10.5",
    "Payment for services"
)

# Sign message
signature = await client.wallet.sign_message(
    wallet.id,
    "Please sign this message"
)

# Verify message
is_valid = await client.wallet.verify_message(
    "G...",
    "Please sign this message",
    signature
)

# Get transaction history
history = await client.wallet.get_transaction_history(wallet.id)
```

### Real-time Subscriptions

```python
# Subscribe to proof updates
async def handle_proof_update(data):
    print(f"Proof update: {data}")

subscription_id = await client.subscribe_to_updates({
    "event_type": "proof_updated",
    "user_id": "user-id"
})

# Or use wallet-specific subscriptions
await client.wallet.subscribe_to_wallet_events(wallet.id)

# Add custom message handler
client.wallet.add_listener("balance_changed", handle_balance_change)
```

## Error Handling

The SDK provides comprehensive error handling:

```python
from verinode import VerinodeError, VerinodeAPIError, VerinodeAuthError

try:
    proof = await client.proof.get("invalid-id")
except VerinodeAuthError as e:
    print(f"Authentication failed: {e}")
except VerinodeAPIError as e:
    print(f"API error: {e} (Status: {e.status_code})")
except VerinodeError as e:
    print(f"SDK error: {e}")
```

## Advanced Usage

### Custom HTTP Client

```python
import aiohttp
from verinode import Verinode

# Use custom session
async with aiohttp.ClientSession() as session:
    client = Verinode()
    client.http_client._session = session
    # Use client...
```

### Retry Logic

The SDK includes automatic retry logic with exponential backoff:

```python
from verinode.utils import retry

@retry(max_attempts=5, delay=1.0, backoff=2.0)
async def custom_operation():
    # Your code here
    pass
```

### Rate Limiting

Built-in rate limiting to prevent API abuse:

```python
from verinode.utils import rate_limit

@rate_limit(calls_per_second=10)
async def limited_operation():
    # Your code here
    pass
```

## Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/Great-2025/Verinode.git
cd Verinode/sdks/python

# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run tests with coverage
pytest --cov=verinode

# Lint code
flake8 src/
black src/
mypy src/
```

### Project Structure

```
src/verinode/
├── __init__.py          # Main exports
├── client.py            # Main client class
├── config.py            # Configuration management
├── exceptions.py        # Exception classes
├── types.py             # Type definitions
├── services/            # Service modules
│   ├── __init__.py
│   ├── proof.py         # Proof service
│   ├── verification.py  # Verification service
│   └── wallet.py        # Wallet service
└── utils/               # Utility modules
    ├── __init__.py
    ├── http.py          # HTTP client
    ├── websocket.py     # WebSocket client
    └── helpers.py       # Helper functions
```

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

- Documentation: [Verinode Documentation](https://docs.verinode.com)
- Issues: [GitHub Issues](https://github.com/Great-2025/Verinode/issues)
- Community: [Discord](https://discord.gg/verinode)
