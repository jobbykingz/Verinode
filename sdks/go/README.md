# Verinode Go SDK

Official Go SDK for Verinode - Web3 infrastructure for cryptographic proofs on Stellar.

## Installation

```bash
go get github.com/Great-2025/verinode-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/Great-2025/verinode-go/pkg/verinode"
    "github.com/Great-2025/verinode-go/pkg/verinode/types"
)

func main() {
    // Initialize the SDK
    client := verinode.NewClient(&verinode.Config{
        APIEndpoint: "https://api.verinode.com",
        Network:     verinode.NetworkTestnet,
        LoggingEnabled: true,
    })

    ctx := context.Background()

    // Authenticate
    token, err := client.Authenticate(ctx, "your-email@example.com", "your-password")
    if err != nil {
        log.Fatalf("Authentication failed: %v", err)
    }

    fmt.Printf("Authenticated successfully! Token: %s\n", token.AccessToken)

    // Create a proof
    proof, err := client.Proof.Create(ctx, &types.ProofCreateRequest{
        Title:       "My First Proof",
        Description: stringPtr("This is a test proof"),
        Metadata: map[string]interface{}{
            "type": "document",
        },
        Tags: []string{"example", "go"},
    })
    if err != nil {
        log.Fatalf("Failed to create proof: %v", err)
    }

    fmt.Printf("Created proof: %s\n", proof.ID)
    fmt.Printf("Title: %s\n", proof.Title)
    fmt.Printf("Status: %s\n", proof.Status)

    // List proofs
    proofs, err := client.Proof.List(ctx, &types.ProofStatusPending, nil, nil, &types.QueryOptions{
        Page:     1,
        PageSize: 10,
    })
    if err != nil {
        log.Fatalf("Failed to list proofs: %v", err)
    }

    fmt.Printf("Found %d proofs\n", len(proofs.Items))
}

func stringPtr(s string) *string {
    return &s
}
```

## Configuration

The SDK can be configured using environment variables or configuration struct:

### Environment Variables

```bash
export VERINODE_API_ENDPOINT="https://api.verinode.com"
export VERINODE_NETWORK="mainnet"
export VERINODE_API_KEY="your-api-key"
export VERINODE_TIMEOUT="10000"
```

### Configuration Struct

```go
config := &verinode.Config{
    APIEndpoint:       "https://api.verinode.com",
    Network:          verinode.NetworkMainnet,
    APIKey:          "your-api-key",
    Timeout:          15 * time.Second,
    MaxRetries:       5,
    RetryDelay:       1 * time.Second,
    BackoffMultiplier: 2.0,
    LoggingEnabled:   true,
    LogLevel:         "INFO",
}

client := verinode.NewClient(config)
```

## Features

### Authentication

```go
// Login with email and password
token, err := client.Authenticate(ctx, "email@example.com", "password")

// Register new user
token, err := client.Register(ctx, "newuser@example.com", "password", "username")

// Refresh token
newToken, err := client.RefreshToken(ctx)

// Logout
err = client.Logout(ctx)
```

### Proof Management

```go
// Create proof
proof, err := client.Proof.Create(ctx, &types.ProofCreateRequest{
    Title:       "Document Verification",
    Description: stringPtr("Verify this important document"),
    Metadata: map[string]interface{}{
        "document_type": "passport",
    },
    Tags: []string{"identity", "verification"},
})

// List proofs with filters
proofs, err := client.Proof.List(ctx, 
    &types.ProofStatusPending, 
    nil, 
    []string{"identity"}, 
    &types.QueryOptions{
        Page:     1,
        PageSize: 20,
    },
)

// Search proofs
results, err := client.Proof.Search(ctx, "document verification", &types.QueryOptions{
    Page:     1,
    PageSize: 10,
})

// Update proof
updated, err := client.Proof.Update(ctx, proof.ID, &types.ProofUpdateRequest{
    Title: stringPtr("Updated Title"),
    Description: stringPtr("Updated description"),
})

// Verify proof
err = client.Proof.Verify(ctx, proof.ID, map[string]interface{}{
    "verified_by": "system",
})

// Delete proof
err = client.Proof.Delete(ctx, proof.ID)
```

### Verification Management

```go
// Create verification
verification, err := client.Verification.Create(ctx, &types.VerificationCreateRequest{
    ProofID: "proof-id",
    Status:  types.VerificationStatusApproved,
    Comment: stringPtr("Verification successful"),
    Evidence: map[string]interface{}{
        "method":     "automated",
        "confidence": 0.95,
    },
})

// List verifications
verifications, err := client.Verification.List(ctx,
    stringPtr("proof-id"),
    nil,
    &types.VerificationStatusPending,
    &types.QueryOptions{Page: 1, PageSize: 10},
)

// Approve verification
approved, err := client.Verification.Approve(ctx, verification.ID, 
    stringPtr("Approved after review"), nil)

// Reject verification
rejected, err := client.Verification.Reject(ctx, verification.ID,
    stringPtr("Insufficient evidence"), nil)

// Bulk operations
approved, err := client.Verification.BulkApprove(ctx,
    []string{"ver1", "ver2", "ver3"},
    stringPtr("Bulk approval"))

// Get statistics
stats, err := client.Verification.GetStatistics(ctx, nil, nil)
fmt.Printf("Total verifications: %v\n", stats["total"])
```

### Wallet Management

```go
// Connect wallet
wallet, err := client.Wallet.Connect(ctx, &types.WalletConnectRequest{
    WalletType: types.WalletTypeStellar,
    PublicKey:  stringPtr("G..."),
    Network:    types.NetworkTestnet,
})

// Get wallet balance
balance, err := client.Wallet.GetBalance(ctx, wallet.ID)
fmt.Printf("Balance: %s\n", balance)

// Send transaction
tx, err := client.Wallet.SendTransaction(ctx, wallet.ID,
    "G...", "10.5", stringPtr("Payment for services"))

// Sign message
signature, err := client.Wallet.SignMessage(ctx, wallet.ID, "Please sign this message")

// Verify message
isValid, err := client.Wallet.VerifyMessage(ctx, "G...", 
    "Please sign this message", signature)

// Get transaction history
history, err := client.Wallet.GetTransactionHistory(ctx, wallet.ID, 50, 0)
```

### Real-time Subscriptions

```go
// Subscribe to proof updates
subscription, err := client.SubscribeToUpdates(ctx, map[string]interface{}{
    "event_types": []string{"proof_updated", "verification_created"},
})

// Handle messages in a goroutine
go func() {
    for {
        select {
        case message := <-subscription.Messages:
            fmt.Printf("Received update: %s\n", message.Type)
        case <-subscription.Done:
            return
        }
    }
}()

// Or use wallet-specific subscriptions
walletSub, err := client.Wallet.SubscribeToWalletEvents(ctx, wallet.ID)
```

## Error Handling

The SDK provides comprehensive error handling:

```go
import "github.com/Great-2025/verinode-go/pkg/verinode"

proof, err := client.Proof.Get(ctx, "invalid-id")
if err != nil {
    switch {
    case verinode.IsAuthError(err):
        fmt.Printf("Authentication failed: %v\n", err)
    case verinode.IsAPIError(err):
        if verr, ok := err.(*verinode.Error); ok {
            fmt.Printf("API error: %v (Status: %d)\n", verr.Message, verr.StatusCode)
        }
    case verinode.IsValidationError(err):
        fmt.Printf("Validation error: %v\n", err)
    case verinode.IsNetworkError(err):
        fmt.Printf("Network error: %v\n", err)
    default:
        fmt.Printf("SDK error: %v\n", err)
    }
}
```

## Advanced Usage

### Custom HTTP Client

```go
// The SDK uses internal HTTP client implementation
// You can configure it through the Config struct
config := &verinode.Config{
    Timeout:     30 * time.Second,
    MaxRetries:  10,
    RetryDelay:  2 * time.Second,
}
client := verinode.NewClient(config)
```

### Context Usage

All SDK methods accept a context for cancellation and timeouts:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

proof, err := client.Proof.Get(ctx, proofID)
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        fmt.Println("Request timed out")
    }
}
```

### Resource Management

Always close the client when done:

```go
defer client.Close()
```

Or use context with automatic cleanup:

```go
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

// Use client...
// When context is cancelled, resources are cleaned up
```

## Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/Great-2025/Verinode.git
cd Verinode/sdks/go

# Install dependencies
go mod tidy

# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run benchmarks
go test -bench=. ./...

# Build
go build ./...
```

### Project Structure

```
pkg/verinode/
├── client.go              # Main client class
├── config.go              # Configuration management
├── errors.go              # Exception classes
├── interfaces.go          # Interface definitions
├── http.go                # HTTP client constructor
├── types/                 # Type definitions
│   └── types.go
├── services/              # Service modules
│   ├── proof.go           # Proof service
│   ├── verification.go    # Verification service
│   └── wallet.go         # Wallet service
└── internal/              # Internal implementations
    ├── http.go            # HTTP client
    └── websocket.go       # WebSocket client
```

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

- Documentation: [Verinode Documentation](https://docs.verinode.com)
- Issues: [GitHub Issues](https://github.com/Great-2025/Verinode/issues)
- Community: [Discord](https://discord.gg/verinode)
