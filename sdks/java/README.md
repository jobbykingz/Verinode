# Verinode Java SDK

Official Java SDK for Verinode - Web3 infrastructure for cryptographic proofs on Stellar.

## Installation

Add this dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>com.verinode</groupId>
    <artifactId>verinode-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

Or if you're using Gradle:

```gradle
implementation 'com.verinode:verinode-sdk:1.0.0'
```

## Quick Start

```java
import com.verinode.sdk.Verinode;
import com.verinode.sdk.config.VerinodeConfig;
import com.verinode.sdk.config.NetworkType;
import com.verinode.sdk.types.*;

public class Example {
    public static void main(String[] args) {
        try {
            // Initialize the SDK
            VerinodeConfig config = VerinodeConfig.builder()
                .apiEndpoint("https://api.verinode.com")
                .network(NetworkType.TESTNET)
                .build();
            
            Verinode client = new Verinode(config);
            
            // Authenticate
            client.authenticate("user@example.com", "password");
            
            // Create a proof
            Proof proof = client.proof().create(new ProofCreateRequest.Builder("My First Proof")
                .description("This is a test proof")
                .metadata(Map.of("type", "document"))
                .tags(List.of("example", "java"))
                .build());
            
            System.out.println("Created proof: " + proof.getId());
            System.out.println("Title: " + proof.getTitle());
            System.out.println("Status: " + proof.getStatus());
            
        } catch (VerinodeException e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
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

```java
VerinodeConfig config = VerinodeConfig.builder()
    .apiEndpoint("https://api.verinode.com")
    .network(NetworkType.MAINNET)
    .apiKey("your-api-key")
    .timeout(Duration.ofSeconds(15))
    .maxRetries(5)
    .retryDelay(Duration.ofSeconds(1))
    .backoffMultiplier(2.0)
    .loggingEnabled(true)
    .logLevel("INFO")
    .build();
```

## Features

### Authentication

```java
// Login with email and password
AuthToken token = client.authenticate("email@example.com", "password");

// Register new user
AuthToken token = client.register("newuser@example.com", "password", "username");

// Refresh token
AuthToken newToken = client.refreshToken();

// Logout
client.logout();
```

### Proof Management

```java
// Create proof
Proof proof = client.proof().create(new ProofCreateRequest.Builder("Document Verification")
    .description("Verify this important document")
    .metadata(Map.of("document_type", "passport"))
    .tags(List.of("identity", "verification"))
    .build());

// List proofs with filters
PaginatedResponse<Proof> proofs = client.proof().list(
    ProofStatus.PENDING,
    null,
    List.of("identity"),
    new QueryOptions(1, 20, true)
);

// Search proofs
PaginatedResponse<Proof> results = client.proof().search("document verification", 
    new QueryOptions(1, 10, true));

// Update proof
Proof updated = client.proof().update(proof.getId(), new ProofUpdateRequest.Builder()
    .title("Updated Title")
    .description("Updated description")
    .build());

// Verify proof
client.proof().verify(proof.getId(), Map.of("verified_by", "system"));

// Delete proof
client.proof().delete(proof.getId());
```

### Verification Management

```java
// Create verification
Verification verification = client.verification().create(new VerificationCreateRequest.Builder(
    proof.getId(),
    VerificationStatus.APPROVED
).comment("Verification successful")
 .evidence(Map.of("method", "automated", "confidence", 0.95))
 .build());

// List verifications
PaginatedResponse<Verification> verifications = client.verification().list(
    proof.getId(),
    null,
    VerificationStatus.PENDING,
    new QueryOptions(1, 10, true)
);

// Approve verification
Verification approved = client.verification().approve(verification.getId(), 
    "Approved after review", null);

// Reject verification
Verification rejected = client.verification().reject(verification.getId(),
    "Insufficient evidence", null);

// Bulk operations
List<Verification> approved = client.verification().bulkApprove(
    List.of("ver1", "ver2", "ver3"),
    "Bulk approval"
);

// Get statistics
Map<String, Object> stats = client.verification().getStatistics(null, null);
System.out.println("Total verifications: " + stats.get("total"));
```

### Wallet Management

```java
// Connect wallet
Wallet wallet = client.wallet().connect(new WalletConnectRequest.Builder(
    WalletType.STELLAR,
    NetworkType.TESTNET
).publicKey("G...")
 .build());

// Get wallet balance
String balance = client.wallet().getBalance(wallet.getId());
System.out.println("Balance: " + balance);

// Send transaction
Map<String, Object> tx = client.wallet().sendTransaction(wallet.getId(),
    "G...", "10.5", "Payment for services");

// Sign message
String signature = client.wallet().signMessage(wallet.getId(), "Please sign this message");

// Verify message
boolean isValid = client.wallet().verifyMessage("G...", 
    "Please sign this message", signature);

// Get transaction history
List<Map<String, Object>> history = client.wallet().getTransactionHistory(wallet.getId(), 50, 0);
```

### Real-time Subscriptions

```java
// Subscribe to updates
Map<String, Object> filters = Map.of(
    "event_types", List.of("proof_updated", "verification_created")
);

Subscription subscription = client.subscribeToUpdates(filters);

// Handle messages
subscription.setMessageHandler(message -> {
    System.out.println("Received update: " + message.getType());
});

// Or use wallet-specific subscriptions
Subscription walletSub = client.wallet().subscribeToWalletEvents(wallet.getId());
```

## Error Handling

The SDK provides comprehensive error handling:

```java
try {
    Proof proof = client.proof().get("invalid-id");
} catch (VerinodeException e) {
    switch (e.getCode()) {
        case AUTH_ERROR:
            System.err.println("Authentication failed: " + e.getMessage());
            break;
        case API_ERROR:
            System.err.println("API error: " + e.getMessage() + 
                             " (Status: " + e.getStatusCode() + ")");
            break;
        case VALIDATION_ERROR:
            System.err.println("Validation error: " + e.getMessage());
            break;
        case NETWORK_ERROR:
            System.err.println("Network error: " + e.getMessage());
            break;
        default:
            System.err.println("SDK error: " + e.getMessage());
    }
}
```

## Advanced Usage

### Custom HTTP Client

The SDK uses a pluggable HTTP client interface:

```java
public class CustomHttpClient implements HttpClient {
    // Implement required methods
}

// Use custom client
VerinodeConfig config = VerinodeConfig.builder()
    .httpClient(new CustomHttpClient())
    .build();
```

### Async Operations

The SDK supports both synchronous and asynchronous operations:

```java
// Synchronous
Proof proof = client.proof().get("proof-id");

// Asynchronous using CompletableFuture
CompletableFuture<Proof> future = client.proof().getAsync("proof-id");
future.thenAccept(proof -> {
    System.out.println("Got proof: " + proof.getTitle());
});
```

### Resource Management

Always close the client when done:

```java
try (Verinode client = new Verinode(config)) {
    // Use client
} // Automatically closed
```

Or manually:

```java
Verinode client = new Verinode(config);
try {
    // Use client
} finally {
    client.close();
}
```

## Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/Great-2025/Verinode.git
cd Verinode/sdks/java

# Build the project
mvn clean compile

# Run tests
mvn test

# Run tests with coverage
mvn jacoco:report

# Build JAR
mvn package

# Install to local repository
mvn install
```

### Project Structure

```
src/main/java/com/verinode/sdk/
├── Verinode.java              # Main client class
├── config/                    # Configuration
│   ├── VerinodeConfig.java
│   └── NetworkType.java
├── exception/                 # Exception handling
│   ├── VerinodeException.java
│   └── ErrorCode.java
├── services/                  # Service modules
│   ├── ProofService.java
│   ├── VerificationService.java
│   └── WalletService.java
├── types/                     # Type definitions
│   ├── Proof.java
│   ├── Verification.java
│   ├── Wallet.java
│   └── ...
└── utils/                      # Utility classes
    ├── HttpClient.java
    └── WebSocketClient.java
```

## Features

- **Java 11+**: Modern Java with full type safety
- **Jackson**: JSON serialization/deserialization
- **OkHttp**: Efficient HTTP client with connection pooling
- **WebSocket**: Real-time updates support
- **Builder Pattern**: Fluent API for request objects
- **Exception Handling**: Comprehensive error types
- **Logging**: SLF4J integration
- **Async Support**: CompletableFuture for non-blocking operations
- **Stellar SDK**: Optional Stellar blockchain integration

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

- Documentation: [Verinode Documentation](https://docs.verinode.com)
- Issues: [GitHub Issues](https://github.com/Great-2025/Verinode/issues)
- Community: [Discord](https://discord.gg/verinode)
