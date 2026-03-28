//! Type definitions for the Verinode SDK.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

pub use super::config::NetworkType;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProofStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "verified")]
    Verified,
    #[serde(rename = "rejected")]
    Rejected,
    #[serde(rename = "expired")]
    Expired,
}

impl Default for ProofStatus {
    fn default() -> Self {
        ProofStatus::Pending
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "approved")]
    Approved,
    #[serde(rename = "rejected")]
    Rejected,
    #[serde(rename = "expired")]
    Expired,
}

impl Default for VerificationStatus {
    fn default() -> Self {
        VerificationStatus::Pending
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WalletType {
    #[serde(rename = "stellar")]
    Stellar,
    #[serde(rename = "albedo")]
    Albedo,
    #[serde(rename = "freighter")]
    Freighter,
    #[serde(rename = "xbull")]
    Xbull,
}

impl Default for WalletType {
    fn default() -> Self {
        WalletType::Stellar
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub username: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_active: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub id: String,
    pub user_id: String,
    pub public_key: String,
    pub wallet_type: WalletType,
    pub network: NetworkType,
    pub is_connected: bool,
    pub balance: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proof {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: ProofStatus,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub attachments: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub verification_count: i32,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verification {
    pub id: String,
    pub proof_id: String,
    pub verifier_id: String,
    pub status: VerificationStatus,
    pub comment: Option<String>,
    pub evidence: Option<HashMap<String, serde_json::Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: String,
    pub user_id: String,
    pub subscription_type: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub filters: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_in: Option<i32>,
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProofCreateRequest {
    pub title: String,
    pub description: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub attachments: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProofUpdateRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub attachments: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationCreateRequest {
    pub proof_id: String,
    pub status: VerificationStatus,
    pub comment: Option<String>,
    pub evidence: Option<HashMap<String, serde_json::Value>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletConnectRequest {
    pub wallet_type: WalletType,
    pub public_key: Option<String>,
    pub network: NetworkType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionCreateRequest {
    pub subscription_type: String,
    pub filters: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryFilter {
    pub field: String,
    pub operator: String, // eq, ne, gt, gte, lt, lte, in, nin, contains
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QueryOptions {
    pub filters: Option<Vec<QueryFilter>>,
    pub sort: Option<HashMap<String, i32>>, // field: 1 (asc) or -1 (desc)
    pub page: i32,
    pub page_size: i32,
    pub include_total: bool,
}

impl Default for QueryOptions {
    fn default() -> Self {
        Self {
            filters: None,
            sort: None,
            page: 1,
            page_size: 10,
            include_total: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRequest {
    pub to_address: String,
    pub amount: String,
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignMessageRequest {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyMessageRequest {
    pub public_key: String,
    pub message: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub id: Option<String>,
    pub data: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionUpdate {
    #[serde(flatten)]
    pub message: WebSocketMessage,
    #[serde(rename = "subscription_id")]
    pub subscription_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionConfirmed {
    #[serde(flatten)]
    pub message: WebSocketMessage,
    #[serde(rename = "subscription_id")]
    pub subscription_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionError {
    #[serde(flatten)]
    pub message: WebSocketMessage,
    #[serde(rename = "subscription_id")]
    pub subscription_id: String,
    pub error: String,
}

// Utility functions for creating common requests
impl ProofCreateRequest {
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            description: None,
            metadata: None,
            attachments: None,
            tags: None,
            expires_at: None,
        }
    }
    
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }
    
    pub fn with_metadata(mut self, metadata: HashMap<String, serde_json::Value>) -> Self {
        self.metadata = Some(metadata);
        self
    }
    
    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = Some(tags);
        self
    }
    
    pub fn with_expires_at(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }
}

impl VerificationCreateRequest {
    pub fn new(proof_id: impl Into<String>, status: VerificationStatus) -> Self {
        Self {
            proof_id: proof_id.into(),
            status,
            comment: None,
            evidence: None,
            metadata: None,
        }
    }
    
    pub fn with_comment(mut self, comment: impl Into<String>) -> Self {
        self.comment = Some(comment.into());
        self
    }
    
    pub fn with_evidence(mut self, evidence: HashMap<String, serde_json::Value>) -> Self {
        self.evidence = Some(evidence);
        self
    }
}

impl WalletConnectRequest {
    pub fn new(wallet_type: WalletType, network: NetworkType) -> Self {
        Self {
            wallet_type,
            public_key: None,
            network,
        }
    }
    
    pub fn with_public_key(mut self, public_key: impl Into<String>) -> Self {
        self.public_key = Some(public_key.into());
        self
    }
}

impl QueryOptions {
    pub fn new(page: i32, page_size: i32) -> Self {
        Self {
            page,
            page_size,
            include_total: true,
            filters: None,
            sort: None,
        }
    }
    
    pub fn with_filters(mut self, filters: Vec<QueryFilter>) -> Self {
        self.filters = Some(filters);
        self
    }
    
    pub fn with_sort(mut self, sort: HashMap<String, i32>) -> Self {
        self.sort = Some(sort);
        self
    }
}
