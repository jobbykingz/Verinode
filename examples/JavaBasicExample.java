import com.verinode.sdk.Verinode;
import com.verinode.sdk.config.VerinodeConfig;
import com.verinode.sdk.config.NetworkType;
import com.verinode.sdk.types.*;
import com.verinode.sdk.exception.VerinodeException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Basic example demonstrating Verinode Java SDK usage.
 */
public class JavaBasicExample {
    
    public static void main(String[] args) {
        System.out.println("🚀 Starting Verinode Java SDK Example");
        System.out.println("=".repeat(50));
        
        try {
            // Initialize SDK with configuration
            VerinodeConfig config = VerinodeConfig.builder()
                .apiEndpoint("https://api.verinode.com")
                .network(NetworkType.TESTNET)
                .timeout(Duration.ofSeconds(10))
                .maxRetries(3)
                .retryDelay(Duration.ofSeconds(1))
                .backoffMultiplier(2.0)
                .loggingEnabled(true)
                .logLevel("INFO")
                .build();
            
            Verinode client = new Verinode(config);
            
            // Check if SDK is ready
            if (!client.isReady()) {
                System.out.println("❌ SDK configuration is invalid");
                return;
            }
            
            System.out.println("✅ SDK initialized successfully");
            
            // Example 1: Authentication
            System.out.println("\n🔐 Authenticating...");
            authenticateExample(client);
            
            // Example 2: Create a proof
            System.out.println("\n📄 Creating a proof...");
            String proofId = createProofExample(client);
            
            // Example 3: List proofs
            System.out.println("\n📋 Listing proofs...");
            listProofsExample(client);
            
            // Example 4: Search proofs
            System.out.println("\n🔍 Searching proofs...");
            searchProofsExample(client);
            
            // Example 5: Wallet operations
            System.out.println("\n💳 Wallet operations...");
            walletExample(client);
            
            // Example 6: Verification operations
            System.out.println("\n✅ Verification operations...");
            verificationExample(client, proofId);
            
            // Example 7: Real-time subscription
            System.out.println("\n📡 Setting up real-time subscription...");
            subscriptionExample(client);
            
            System.out.println("\n🎉 Example completed successfully!");
            
        } catch (Exception e) {
            System.err.println("❌ Example failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private static void authenticateExample(Verinode client) {
        try {
            client.authenticate("demo@example.com", "demo-password");
            
            if (client.getCurrentUser() != null) {
                System.out.println("✅ Authenticated as: " + client.getCurrentUser().getEmail());
            }
        } catch (VerinodeException e) {
            System.out.println("⚠️  Authentication failed (expected in demo): " + e.getMessage());
            System.out.println("Continuing with unauthenticated operations...");
        }
    }
    
    private static String createProofExample(Verinode client) {
        try {
            ProofCreateRequest request = new ProofCreateRequest.Builder("Example Document Verification")
                .description("This is an example proof created with the Java SDK")
                .metadata(Map.of(
                    "document_type", "identity",
                    "created_by", "java-sdk-example"
                ))
                .tags(List.of("example", "java", "sdk"))
                .build();
            
            Proof proof = client.proof().create(request);
            
            System.out.println("✅ Proof created with ID: " + proof.getId());
            System.out.println("   Title: " + proof.getTitle());
            System.out.println("   Status: " + proof.getStatus());
            
            return proof.getId();
            
        } catch (VerinodeException e) {
            System.out.println("⚠️  Proof creation failed: " + e.getMessage());
            return "demo-proof-id";
        }
    }
    
    private static void listProofsExample(Verinode client) {
        try {
            PaginatedResponse<Proof> proofs = client.proof().list(
                ProofStatus.PENDING,
                null,
                null,
                new QueryOptions(1, 5, true)
            );
            
            System.out.println("✅ Found " + proofs.getItems().size() + " proofs");
            for (Proof proof : proofs.getItems()) {
                System.out.println("   - " + proof.getTitle() + " (" + proof.getStatus() + ")");
            }
            
        } catch (VerinodeException e) {
            System.out.println("⚠️  Proof listing failed: " + e.getMessage());
        }
    }
    
    private static void searchProofsExample(Verinode client) {
        try {
            PaginatedResponse<Proof> results = client.proof().search("example", 
                new QueryOptions(1, 10, true));
            
            System.out.println("✅ Found " + results.getItems().size() + " matching proofs");
            
        } catch (VerinodeException e) {
            System.out.println("⚠️  Search failed: " + e.getMessage());
        }
    }
    
    private static void walletExample(Verinode client) {
        try {
            // Connect a demo wallet
            WalletConnectRequest request = new WalletConnectRequest.Builder(
                WalletType.STELLAR,
                NetworkType.TESTNET
            ).build();
            
            Wallet wallet = client.wallet().connect(request);
            
            System.out.println("✅ Wallet connected: " + wallet.getId());
            System.out.println("   Type: " + wallet.getWalletType());
            System.out.println("   Network: " + wallet.getNetwork());
            
            // Get balance
            try {
                String balance = client.wallet().getBalance(wallet.getId());
                System.out.println("   Balance: " + balance);
            } catch (VerinodeException e) {
                System.out.println("   Balance: Unable to fetch (" + e.getMessage() + ")");
            }
            
        } catch (VerinodeException e) {
            System.out.println("⚠️  Wallet operations failed: " + e.getMessage());
        }
    }
    
    private static void verificationExample(Verinode client, String proofId) {
        if ("demo-proof-id".equals(proofId)) {
            System.out.println("⚠️  Skipping verification - no valid proof ID");
            return;
        }
        
        try {
            // Create a verification
            VerificationCreateRequest request = new VerificationCreateRequest.Builder(
                proofId,
                VerificationStatus.APPROVED
            ).comment("Automated verification example")
             .evidence(Map.of(
                 "method", "automated",
                 "confidence", 0.95
             ))
             .build();
            
            Verification verification = client.verification().create(request);
            
            System.out.println("✅ Verification created: " + verification.getId());
            
            // Get verification statistics
            Map<String, Object> stats = client.verification().getStatistics(null, null);
            System.out.println("   Total verifications: " + stats.get("total"));
            
        } catch (VerinodeException e) {
            System.out.println("⚠️  Verification operations failed: " + e.getMessage());
        }
    }
    
    private static void subscriptionExample(Verinode client) {
        try {
            // Subscribe to updates
            Map<String, Object> filters = Map.of(
                "event_types", List.of("proof_updated", "verification_created")
            );
            
            Subscription subscription = client.subscribeToUpdates(filters);
            
            System.out.println("✅ Subscription created: " + subscription.getId());
            
            // Set up message handler
            subscription.setMessageHandler(message -> {
                System.out.println("📨 Received update: " + message.getType());
            });
            
            // Simulate some time to receive updates
            Thread.sleep(2000);
            
            // Unsubscribe
            subscription.unsubscribe();
            
        } catch (Exception e) {
            System.out.println("⚠️  Subscription setup failed: " + e.getMessage());
        }
    }
}
