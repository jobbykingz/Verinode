# Verinode CLI

A comprehensive command-line interface for managing proofs, deploying contracts, and interacting with the Verinode platform programmatically.

## Installation

```bash
npm install -g verinode-cli
```

## Configuration

Before using the CLI, configure your environment:

```bash
# Set API endpoint
verinode config set apiUrl https://api.verinode.com

# Login to authenticate
verinode auth login
```

## Commands

### Authentication

```bash
# Login
verinode auth login

# Logout
verinode auth logout

# Check auth status
verinode auth status
```

### Proof Management

```bash
# List all proofs
verinode proof list

# Create a new proof
verinode proof create
verinode proof create -f proof-data.json

# Get proof details
verinode proof get <proof-id>

# Delete a proof
verinode proof delete <proof-id>

# Batch operations
verinode proof batch operations.json
```

### Contract Deployment

```bash
# List deployed contracts
verinode deploy list

# Deploy a new contract
verinode deploy contract -n mainnet
verinode deploy contract -f contract-config.json

# Check deployment status
verinode deploy status <contract-id>

# Upgrade a contract
verinode deploy upgrade <contract-id> -f new-source.json
```

### Proof Verification

```bash
# Verify a specific proof
verinode verify proof <proof-id>
verinode verify proof <proof-id> -d  # detailed

# Batch verification
verinode verify batch proofs.json

# Check verification status
verinode verify status <verification-id>

# View verification history
verinode verify history <proof-id>

# Interactive verification
verinode verify interactive
```

## Configuration File Format

### Proof Data (proof-data.json)
```json
{
  "name": "My Proof",
  "description": "A sample proof",
  "data": {
    "field1": "value1",
    "field2": "value2"
  }
}
```

### Batch Operations (operations.json)
```json
{
  "operations": [
    {
      "type": "create",
      "data": {
        "name": "Proof 1",
        "description": "First proof"
      }
    },
    {
      "type": "update",
      "id": "proof-123",
      "data": {
        "status": "verified"
      }
    }
  ]
}
```

### Contract Config (contract-config.json)
```json
{
  "name": "MyContract",
  "source": "./contracts/MyContract.sol",
  "network": "mainnet",
  "parameters": {
    "param1": "value1"
  }
}
```

## Error Handling

The CLI provides user-friendly error messages and handles network issues gracefully. All commands include progress indicators for long-running operations.

## Cross-Platform Support

The CLI works on Windows, macOS, and Linux systems.

## Development

To build the CLI:

```bash
cd cli
npm run build
```

To run locally:

```bash
npm start
```

## License

MIT