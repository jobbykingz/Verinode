# Verinode Rust SDK

Official Rust SDK for Verinode - Web3 infrastructure for cryptographic proofs on Stellar.

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
verinode-sdk = "1.0.0"
tokio = { version = "1.0", features = ["full"] }
```

## Quick Start

```rust
use verinode_sdk::{Client, Config};
use verinode_sdk::types::{ProofCreateRequest, ProofStatus};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize the SDK
    let config = Config::builder()
        .api_endpoint("https://api.verinode.com")
        .network(NetworkType::Testnet)
        .build()?;

    let mut client = Client::new(config);

    // Authenticate
    client.authenticate("user@example.com", "password").await?;

    // Create a proof
    let proof = client.proof().create(&ProofCreateRequest::new("My First Proof")
        .with_description("This is a test proof")
        .with_metadata(serde_json::json!({
            "type": "document"
        }))
        .with_tags(vec!["example".to_string(), "rust".to_string()])
    ).await?;

    println!("Created proof: {}", proof.id);
    println!("Title: {}", proof.title);
    println!("Status: {:?}", proof.status);

    Ok(())
}
```

## Configuration

The SDK can be configured using environment variables or configuration builder:

### Environment Variables

```bash
export VERINODE_API_ENDPOINT="https://api.verinode.com"
export VERINODE_NETWORK="mainnet"
export VERINODE_API_KEY="your-api-key"
export VERINODE_TIMEOUT="10000"
```

### Configuration Builder

```rust
use verinode_sdk::{Config, NetworkType};
use std::time::Duration;

let config = Config::builder()
    .api_endpoint("https://api.verinode.com")
    .network(NetworkType::Mainnet)
    .api_key("your-api-key")
    .timeout(Duration::from_secs(15))
    .max_retries(5)
    .retry_delay(Duration::from_secs(1))
    .backoff_multiplier(2.0)
    .logging_enabled(true)
    .log_level("INFO")
    .build()?;
```

## Features

### Authentication

```rust
// Login with email and password
let token = client.authenticate("email@example.com", "password").await?;

// Register new user
let token = client.register("newuser@example.com", "password", Some("username")).await?;

// Refresh token
let new_token = client.refresh_token().await?;

// Logout
client.logout().await?;
```

### Proof Management

```rust
use verinode_sdk::types::*;

// Create proof
let proof = client.proof().create(&ProofCreateRequest::new("Document Verification")
    .with_description("Verify this important document")
    .with_metadata(serde_json::json!({
        "document_type": "passport"
    }))
    .with_tags(vec!["identity".to_string(), "verification".to_string()])
).await?;

// List proofs with filters
let proofs = client.proof().list(
    Some(ProofStatus::Pending),
    None,
    Some(vec!["identity".to_string()]),
    Some(&QueryOptions::new(1, 20)
        .with_sort(serde_json::json!({
            "created_at": -1
        }))
    ),
).await?;

// Search proofs
let results = client.proof().search("document verification", 
    Some(&QueryOptions::new(1, 10))
).await?;

// Update proof
let updated = client.proof().update(&proof.id, &ProofUpdateRequest {
    title: Some("Updated Title".to_string()),
    description: Some("Updated description".to_string()),
    ..Default::default()
}).await?;

// Verify proof
client.proof().verify(&proof.id, Some(serde_json::json!({
    "verified_by": "system"
}))).await?;

// Delete proof
client.proof().delete(&proof.id).await?;
```

### Verification Management

```rust
// Create verification
let verification = client.verification().create(&VerificationCreateRequest::new(
    &proof.id,
    VerificationStatus::Approved,
).with_comment("Verification successful")
 .with_evidence(serde_json::json!({
     "method": "automated",
     "confidence": 0.95
 }))).await?;

// List verifications
let verifications = client.verification().list(
    Some(&proof.id),
    None,
    Some(VerificationStatus::Pending),
    Some(&QueryOptions::new(1, 10))
).await?;

// Approve verification
let approved = client.verification().approve(&verification.id, 
    Some("Approved after review"), None).await?;

// Reject verification
let rejected = client.verification().reject(&verification.id,
    Some("Insufficient evidence"), None).await?;

// Bulk operations
let approved = client.verification().bulk_approve(
    vec!["ver1".to_string(), "ver2".to_string(), "ver3".to_string()],
    Some("Bulk approval")
).await?;

// Get statistics
let stats = client.verification().get_statistics(None, None).await?;
println!("Total verifications: {}", stats.get("total").unwrap_or(&serde_json::Value::Null));
```

### Wallet Management

```rust
// Connect wallet
let wallet = client.wallet().connect(&WalletConnectRequest::new(
    WalletType::Stellar,
    NetworkType::Testnet,
).with_public_key("G...")).await?;

// Get wallet balance
let balance = client.wallet().get_balance(&wallet.id).await?;
println!("Balance: {}", balance);

// Send transaction
let tx = client.wallet().send_transaction(
    &wallet.id,
    "G...",
    "10.5",
    Some("Payment for services")
).await?;

// Sign message
let signature = client.wallet().sign_message(&wallet.id, "Please sign this message").await?;

// Verify message
let is_valid = client.wallet().verify_message(
    "G...",
    "Please sign this message",
    &signature
).await?;

// Get transaction history
let history = client.wallet().get_transaction_history(&wallet.id, 50, 0).await?;
```

### Real-time Subscriptions

```rust
use std::collections::HashMap;

// Subscribe to updates
let mut filters = HashMap::new();
filters.insert("event_types".to_string(), 
    serde_json::json!(["proof_updated", "verification_created"]));

let mut subscription = client.subscribe_to_updates(filters).await?;

// Handle messages
loop {
    match subscription.messages().await {
        Ok(message) => {
            println!("Received update: {}", message.message_type);
        }
        Err(e) => {
            eprintln!("Subscription error: {}", e);
            break;
        }
    }
}

// Or use wallet-specific subscriptions
let wallet_sub = client.wallet().subscribe_to_wallet_events(&wallet.id).await?;
```

## Error Handling

The SDK provides comprehensive error handling:

```rust
use verinode_sdk::Error;

match client.proof().get("invalid-id").await {
    Ok(proof) => println!("Found proof: {}", proof.id),
    Err(e) => {
        match e {
            Error { code: ErrorCode::AuthError, .. } => {
                eprintln!("Authentication failed: {}", e);
            }
            Error { code: ErrorCode::ApiError, status_code: Some(status), .. } => {
                eprintln!("API error: {} (Status: {})", e, status);
            }
            Error { code: ErrorCode::ValidationError, details: Some(details), .. } => {
                eprintln!("Validation error: {} (Details: {})", e, details);
            }
            Error { code: ErrorCode::NetworkError, .. } => {
                eprintln!("Network error: {}", e);
            }
            _ => {
                eprintln!("SDK error: {}", e);
            }
        }
    }
}
```

## Advanced Usage

### Custom HTTP Client

The SDK uses a trait-based HTTP client, allowing for custom implementations:

```rust
use verinode_sdk::utils::HttpClient;

struct CustomHttpClient {
    // Your custom implementation
}

#[async_trait::async_trait]
impl HttpClient for CustomHttpClient {
    // Implement required methods
    async fn get<T>(&self, endpoint: &str) -> Result<T> { /* ... */ }
    // ... other methods
}
```

### Async/Await Patterns

All SDK methods are async and should be used within an async context:

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Your async code here
}

// Or within an async function
async fn handle_proofs() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::from_env()?;
    let proofs = client.proof().list(None, None, None, None).await?;
    Ok(())
}
```

### Resource Management

The SDK uses Arc for shared resources:

```rust
use std::sync::Arc;

let client = Arc::new(Client::from_env()?);

// Share across threads
let client_clone = client.clone();
tokio::spawn(async move {
    // Use client_clone
});
```

## Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/Great-2025/Verinode.git
cd Verinode/sdks/rust

# Install dependencies
cargo build

# Run tests
cargo test

# Run tests with coverage
cargo tarpaulin --out Html

# Run examples
cargo run --example basic
cargo run --example wallet
cargo run --example subscriptions

# Build documentation
cargo doc --open
```

### Project Structure

```
src/
├── lib.rs              # Main library entry point
├── client.rs           # Main client class
├── config.rs           # Configuration management
├── error.rs            # Error types and handling
├── types/              # Type definitions
│   └── mod.rs
├── services/           # Service modules
│   ├── mod.rs
│   ├── proof.rs        # Proof service
│   ├── verification.rs # Verification service
│   └── wallet.rs       # Wallet service
└── utils/              # Utility modules
    ├── mod.rs
    ├── http.rs          # HTTP client
    └── websocket.rs     # WebSocket client
```

## Features

- **`default`**: Includes all standard features
- **`stellar`**: Includes Stellar SDK integration (enabled by default)

Disable default features:

```toml
[dependencies]
verinode-sdk = { version = "1.0.0", default-features = false }
```

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

- Documentation: [Verinode Documentation](https://docs.verinode.com)
- Issues: [GitHub Issues](https://github.com/Great-2025/Verinode/issues)
- Community: [Discord](https://discord.gg/verinode)
