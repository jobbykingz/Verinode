//! Error types for the Verinode SDK.

use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorCode {
    #[serde(rename = "API_ERROR")]
    ApiError,
    #[serde(rename = "AUTH_ERROR")]
    AuthError,
    #[serde(rename = "VALIDATION_ERROR")]
    ValidationError,
    #[serde(rename = "NETWORK_ERROR")]
    NetworkError,
    #[serde(rename = "WALLET_ERROR")]
    WalletError,
    #[serde(rename = "PROOF_ERROR")]
    ProofError,
    #[serde(rename = "VERIFICATION_ERROR")]
    VerificationError,
    #[serde(rename = "SUBSCRIPTION_ERROR")]
    SubscriptionError,
}

#[derive(Debug, Error)]
#[error("{message}")]
pub struct Error {
    pub code: ErrorCode,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub status_code: Option<StatusCode>,
}

impl Error {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
            status_code: None,
        }
    }
    
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
    
    pub fn with_status_code(mut self, status_code: StatusCode) -> Self {
        self.status_code = Some(status_code);
        self
    }
    
    pub fn api_error(message: impl Into<String>, status_code: StatusCode) -> Self {
        Self::new(ErrorCode::ApiError, message)
            .with_status_code(status_code)
    }
    
    pub fn auth_error(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::AuthError, message)
    }
    
    pub fn validation_error(message: impl Into<String>, field: Option<&str>) -> Self {
        let mut details = serde_json::Map::new();
        if let Some(field) = field {
            details.insert("field".to_string(), serde_json::Value::String(field.to_string()));
        }
        
        Self::new(ErrorCode::ValidationError, message)
            .with_details(serde_json::Value::Object(details))
    }
    
    pub fn network_error(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NetworkError, message)
    }
    
    pub fn wallet_error(message: impl Into<String>, wallet_type: Option<&str>) -> Self {
        let mut details = serde_json::Map::new();
        if let Some(wallet_type) = wallet_type {
            details.insert("wallet_type".to_string(), serde_json::Value::String(wallet_type.to_string()));
        }
        
        Self::new(ErrorCode::WalletError, message)
            .with_details(serde_json::Value::Object(details))
    }
    
    pub fn proof_error(message: impl Into<String>, proof_id: Option<&str>) -> Self {
        let mut details = serde_json::Map::new();
        if let Some(proof_id) = proof_id {
            details.insert("proof_id".to_string(), serde_json::Value::String(proof_id.to_string()));
        }
        
        Self::new(ErrorCode::ProofError, message)
            .with_details(serde_json::Value::Object(details))
    }
    
    pub fn verification_error(message: impl Into<String>, verification_id: Option<&str>) -> Self {
        let mut details = serde_json::Map::new();
        if let Some(verification_id) = verification_id {
            details.insert("verification_id".to_string(), serde_json::Value::String(verification_id.to_string()));
        }
        
        Self::new(ErrorCode::VerificationError, message)
            .with_details(serde_json::Value::Object(details))
    }
    
    pub fn subscription_error(message: impl Into<String>, subscription_id: Option<&str>) -> Self {
        let mut details = serde_json::Map::new();
        if let Some(subscription_id) = subscription_id {
            details.insert("subscription_id".to_string(), serde_json::Value::String(subscription_id.to_string()));
        }
        
        Self::new(ErrorCode::SubscriptionError, message)
            .with_details(serde_json::Value::Object(details))
    }
    
    pub fn is_api_error(&self) -> bool {
        matches!(self.code, ErrorCode::ApiError)
    }
    
    pub fn is_auth_error(&self) -> bool {
        matches!(self.code, ErrorCode::AuthError)
    }
    
    pub fn is_validation_error(&self) -> bool {
        matches!(self.code, ErrorCode::ValidationError)
    }
    
    pub fn is_network_error(&self) -> bool {
        matches!(self.code, ErrorCode::NetworkError)
    }
    
    pub fn is_wallet_error(&self) -> bool {
        matches!(self.code, ErrorCode::WalletError)
    }
    
    pub fn is_proof_error(&self) -> bool {
        matches!(self.code, ErrorCode::ProofError)
    }
    
    pub fn is_verification_error(&self) -> bool {
        matches!(self.code, ErrorCode::VerificationError)
    }
    
    pub fn is_subscription_error(&self) -> bool {
        matches!(self.code, ErrorCode::SubscriptionError)
    }
}

impl From<reqwest::Error> for Error {
    fn from(err: reqwest::Error) -> Self {
        if let Some(status) = err.status() {
            Self::api_error(err.to_string(), status)
        } else {
            Self::network_error(err.to_string())
        }
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Self::api_error(format!("JSON serialization error: {}", err), StatusCode::INTERNAL_SERVER_ERROR)
    }
}

impl From<tokio_tungstenite::tungstenite::Error> for Error {
    fn from(err: tokio_tungstenite::tungstenite::Error) -> Self {
        Self::network_error(format!("WebSocket error: {}", err))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub message: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl<T> ApiResponse<T> {
    pub fn into_result(self) -> Result<T> {
        if self.success {
            self.data.ok_or_else(|| Error::api_error("No data in successful response", StatusCode::INTERNAL_SERVER_ERROR))
        } else {
            Err(Error::api_error(
                self.error.unwrap_or_else(|| "Unknown API error".to_string()),
                StatusCode::BAD_REQUEST,
            ))
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total_count: i64,
    pub page: i32,
    pub page_size: i32,
    pub has_next: bool,
    pub has_prev: bool,
}

impl<T> PaginatedResponse<T> {
    pub fn empty() -> Self {
        Self {
            items: Vec::new(),
            total_count: 0,
            page: 1,
            page_size: 10,
            has_next: false,
            has_prev: false,
        }
    }
}
