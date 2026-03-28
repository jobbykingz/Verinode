//! # Verinode Rust SDK
//!
//! Official Rust SDK for Verinode - Web3 infrastructure for cryptographic proofs on Stellar.
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use verinode_sdk::{Client, Config};
//! use verinode_sdk::types::{ProofCreateRequest, ProofStatus};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Initialize the SDK
//!     let config = Config::builder()
//!         .api_endpoint("https://api.verinode.com")
//!         .network(NetworkType::Testnet)
//!         .build()?;
//!
//!     let mut client = Client::new(config);
//!
//!     // Authenticate
//!     client.authenticate("user@example.com", "password").await?;
//!
//!     // Create a proof
//!     let proof = client.proof().create(&ProofCreateRequest {
//!         title: "My First Proof".to_string(),
//!         description: Some("This is a test proof".to_string()),
//!         metadata: Some(serde_json::json!({
//!             "type": "document"
//!         })),
//!         tags: Some(vec!["example".to_string(), "rust".to_string()]),
//!         ..Default::default()
//!     }).await?;
//!
//!     println!("Created proof: {}", proof.id);
//!
//!     Ok(())
//! }
//! ```

pub mod client;
pub mod config;
pub mod error;
pub mod services;
pub mod types;
pub mod utils;

// Re-export main types for convenience
pub use client::Client;
pub use config::{Config, ConfigBuilder};
pub use error::{Error, Result};
pub use services::{ProofService, VerificationService, WalletService};
pub use types::*;

/// SDK version
pub const VERSION: &str = "1.0.0";
