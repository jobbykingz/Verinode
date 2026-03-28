//! Basic example demonstrating Verinode Rust SDK usage.

use verinode_sdk::{Client, Config, NetworkType};
use verinode_sdk::types::*;
use std::collections::HashMap;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Verinode Rust SDK Example");
    println!("{}", "=".repeat(50));

    // Initialize SDK with configuration
    let config = Config::builder()
        .api_endpoint("https://api.verinode.com")
        .network(NetworkType::Testnet)
        .timeout(Duration::from_secs(10))
        .max_retries(3)
        .retry_delay(Duration::from_secs(1))
        .backoff_multiplier(2.0)
        .logging_enabled(true)
        .log_level("INFO")
        .build()?;

    let mut client = Client::new(config);

    // Check if SDK is ready
    if !client.is_ready() {
        println!("❌ SDK configuration is invalid");
        return Ok(());
    }

    println!("✅ SDK initialized successfully");

    // Example 1: Authentication
    println!("\n🔐 Authenticating...");
    if let Err(e) = authenticate_example(&mut client).await {
        println!("⚠️  Authentication failed (expected in demo): {}", e);
        println!("Continuing with unauthenticated operations...");
    }

    // Example 2: Create a proof
    println!("\n📄 Creating a proof...");
    let proof_id = match create_proof_example(&client).await {
        Ok(id) => {
            println!("✅ Proof created successfully");
            id
        }
        Err(e) => {
            println!("⚠️  Proof creation failed: {}", e);
            "demo-proof-id".to_string()
        }
    };

    // Example 3: List proofs
    println!("\n📋 Listing proofs...");
    if let Err(e) = list_proofs_example(&client).await {
        println!("⚠️  Proof listing failed: {}", e);
    }

    // Example 4: Search proofs
    println!("\n🔍 Searching proofs...");
    if let Err(e) = search_proofs_example(&client).await {
        println!("⚠️  Search failed: {}", e);
    }

    // Example 5: Wallet operations
    println!("\n💳 Wallet operations...");
    if let Err(e) = wallet_example(&client).await {
        println!("⚠️  Wallet operations failed: {}", e);
    }

    // Example 6: Verification operations
    println!("\n✅ Verification operations...");
    if let Err(e) = verification_example(&client, &proof_id).await {
        println!("⚠️  Verification operations failed: {}", e);
    }

    // Example 7: Real-time subscription
    println!("\n📡 Setting up real-time subscription...");
    if let Err(e) = subscription_example(&client).await {
        println!("⚠️  Subscription setup failed: {}", e);
    }

    println!("\n🎉 Example completed successfully!");
    Ok(())
}

async fn authenticate_example(client: &mut Client) -> Result<(), Box<dyn std::error::Error>> {
    client.authenticate("demo@example.com", "demo-password").await?;
    
    if let Some(user) = client.current_user() {
        println!("✅ Authenticated as: {}", user.email);
    }
    
    Ok(())
}

async fn create_proof_example(client: &Client) -> Result<String, Box<dyn std::error::Error>> {
    let proof_request = ProofCreateRequest::new("Example Document Verification")
        .with_description("This is an example proof created with the Rust SDK")
        .with_metadata(serde_json::json!({
            "document_type": "identity",
            "created_by": "rust-sdk-example"
        }))
        .with_tags(vec![
            "example".to_string(),
            "rust".to_string(),
            "sdk".to_string()
        ]);

    let proof = client.proof().create(&proof_request).await?;
    
    println!("✅ Proof created with ID: {}", proof.id);
    println!("   Title: {}", proof.title);
    println!("   Status: {:?}", proof.status);
    
    Ok(proof.id)
}

async fn list_proofs_example(client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let proofs = client.proof().list(
        Some(ProofStatus::Pending),
        None,
        None,
        Some(&QueryOptions::new(1, 5)),
    ).await?;
    
    println!("✅ Found {} proofs", proofs.items.len());
    for proof in &proofs.items {
        println!("   - {} ({:?})", proof.title, proof.status);
    }
    
    Ok(())
}

async fn search_proofs_example(client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let results = client.proof().search(
        "example",
        Some(&QueryOptions::new(1, 10))
    ).await?;
    
    println!("✅ Found {} matching proofs", results.items.len());
    Ok(())
}

async fn wallet_example(client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    // Connect a demo wallet
    let wallet_request = WalletConnectRequest::new(
        WalletType::Stellar,
        NetworkType::Testnet,
    );

    let wallet = client.wallet().connect(&wallet_request).await?;
    
    println!("✅ Wallet connected: {}", wallet.id);
    println!("   Type: {:?}", wallet.wallet_type);
    println!("   Network: {:?}", wallet.network);

    // Get balance
    match client.wallet().get_balance(&wallet.id).await {
        Ok(balance) => println!("   Balance: {}", balance),
        Err(e) => println!("   Balance: Unable to fetch ({})", e),
    }

    Ok(())
}

async fn verification_example(client: &Client, proof_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    if proof_id == "demo-proof-id" {
        println!("⚠️  Skipping verification - no valid proof ID");
        return Ok(());
    }

    // Create a verification
    let verification_request = VerificationCreateRequest::new(
        proof_id,
        VerificationStatus::Approved,
    ).with_comment("Automated verification example")
     .with_evidence(serde_json::json!({
         "method": "automated",
         "confidence": 0.95
     }));

    let verification = client.verification().create(&verification_request).await?;
    
    println!("✅ Verification created: {}", verification.id);

    // Get verification statistics
    let stats = client.verification().get_statistics(None, None).await?;
    if let Some(total) = stats.get("total") {
        println!("   Total verifications: {}", total);
    }

    Ok(())
}

async fn subscription_example(client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    // Subscribe to updates
    let mut filters = HashMap::new();
    filters.insert("event_types".to_string(), 
        serde_json::json!(["proof_updated", "verification_created"]));

    let mut subscription = client.subscribe_to_updates(filters).await?;
    
    println!("✅ Subscription created: {}", subscription.id());

    // Handle messages for a short time
    let mut message_count = 0;
    let max_messages = 5;
    
    while message_count < max_messages {
        tokio::select! {
            message = subscription.messages() => {
                match message {
                    Ok(msg) => {
                        println!("📨 Received update: {}", msg.message_type);
                        message_count += 1;
                    }
                    Err(e) => {
                        println!("⚠️  Subscription error: {}", e);
                        break;
                    }
                }
            }
            _ = tokio::time::sleep(Duration::from_secs(2)) => {
                println!("✅ Subscription test completed (timeout)");
                break;
            }
        }
    }

    // Unsubscribe
    if let Err(e) = subscription.unsubscribe() {
        println!("⚠️  Failed to unsubscribe: {}", e);
    }

    Ok(())
}
