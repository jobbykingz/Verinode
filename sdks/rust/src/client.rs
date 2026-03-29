//! Main client for the Verinode SDK.

use crate::config::Config;
use crate::error::{Error, Result};
use crate::services::{ProofService, VerificationService, WalletService};
use crate::types::{
    AuthToken, LoginRequest, RegisterRequest, RefreshTokenRequest, User,
    WebSocketMessage, HashMap,
};
use crate::utils::{HttpClient, WebSocketClient};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Main Verinode SDK client
#[derive(Clone)]
pub struct Client {
    config: Arc<Config>,
    http_client: Arc<dyn HttpClient>,
    ws_client: Arc<dyn WebSocketClient>,
    
    // Authentication state
    auth_token: Option<AuthToken>,
    current_user: Option<User>,
    
    // Services
    proof_service: Arc<ProofService>,
    verification_service: Arc<VerificationService>,
    wallet_service: Arc<WalletService>,
}

impl Client {
    /// Create a new client with the given configuration
    pub fn new(config: Config) -> Self {
        let config = Arc::new(config);
        let http_client = Arc::new(crate::utils::ReqwestHttpClient::new(config.clone()));
        let ws_client = Arc::new(crate::utils::TungsteniteWebSocketClient::new(config.clone()));
        
        let proof_service = Arc::new(ProofService::new(http_client.clone()));
        let verification_service = Arc::new(VerificationService::new(http_client.clone()));
        let wallet_service = Arc::new(WalletService::new(http_client.clone(), ws_client.clone()));
        
        Self {
            config,
            http_client,
            ws_client,
            auth_token: None,
            current_user: None,
            proof_service,
            verification_service,
            wallet_service,
        }
    }
    
    /// Create a client with default configuration
    pub fn with_defaults() -> Result<Self> {
        let config = Config::default();
        Ok(Self::new(config))
    }
    
    /// Create a client from environment variables
    pub fn from_env() -> Result<Self> {
        let config = Config::from_env()?;
        Ok(Self::new(config))
    }
    
    /// Get the configuration
    pub fn config(&self) -> &Config {
        &self.config
    }
    
    /// Check if the client is authenticated
    pub fn is_authenticated(&self) -> bool {
        self.auth_token.is_some() && self.current_user.is_some()
    }
    
    /// Get the current authenticated user
    pub fn current_user(&self) -> Option<&User> {
        self.current_user.as_ref()
    }
    
    /// Get the current authentication token
    pub fn auth_token(&self) -> Option<&AuthToken> {
        self.auth_token.as_ref()
    }
    
    /// Check if the SDK is properly configured
    pub fn is_ready(&self) -> bool {
        self.config.validate().is_ok()
    }
    
    /// Get the proof service
    pub fn proof(&self) -> &ProofService {
        &self.proof_service
    }
    
    /// Get the verification service
    pub fn verification(&self) -> &VerificationService {
        &self.verification_service
    }
    
    /// Get the wallet service
    pub fn wallet(&self) -> &WalletService {
        &self.wallet_service
    }
    
    /// Authenticate with email and password
    pub async fn authenticate(&mut self, email: &str, password: &str) -> Result<AuthToken> {
        let request = LoginRequest {
            email: email.to_string(),
            password: password.to_string(),
        };
        
        let response: AuthResponse = self.http_client
            .post("/auth/login", &request)
            .await?;
        
        let token = response.into_result()?;
        
        // Set authentication token
        self.auth_token = Some(token.clone());
        self.http_client.set_auth_token(&token.access_token);
        
        // Get current user info
        self.get_current_user().await?;
        
        if self.config.logging_enabled {
            log::info!("Successfully authenticated user: {}", email);
        }
        
        Ok(token)
    }
    
    /// Register a new user account
    pub async fn register(&mut self, email: &str, password: &str, username: Option<&str>) -> Result<AuthToken> {
        let request = RegisterRequest {
            email: email.to_string(),
            password: password.to_string(),
            username: username.map(|u| u.to_string()),
        };
        
        let response: AuthResponse = self.http_client
            .post("/auth/register", &request)
            .await?;
        
        let token = response.into_result()?;
        
        // Set authentication token
        self.auth_token = Some(token.clone());
        self.http_client.set_auth_token(&token.access_token);
        
        // Get current user info
        self.get_current_user().await?;
        
        if self.config.logging_enabled {
            log::info!("Successfully registered user: {}", email);
        }
        
        Ok(token)
    }
    
    /// Logout the current user
    pub async fn logout(&mut self) -> Result<()> {
        if self.auth_token.is_some() {
            let _ = self.http_client.post::<(), ()>("/auth/logout", &()).await;
        }
        
        self.auth_token = None;
        self.current_user = None;
        self.http_client.set_auth_token("");
        
        if self.config.logging_enabled {
            log::info!("User logged out");
        }
        
        Ok(())
    }
    
    /// Refresh the authentication token
    pub async fn refresh_token(&mut self) -> Result<AuthToken> {
        let token = self.auth_token.as_ref()
            .and_then(|t| t.refresh_token.clone())
            .ok_or_else(|| Error::auth_error("No refresh token available"))?;
        
        let request = RefreshTokenRequest { refresh_token: token };
        let response: AuthResponse = self.http_client
            .post("/auth/refresh", &request)
            .await?;
        
        let new_token = response.into_result()?;
        
        self.auth_token = Some(new_token.clone());
        self.http_client.set_auth_token(&new_token.access_token);
        
        if self.config.logging_enabled {
            log::info!("Token refreshed successfully");
        }
        
        Ok(new_token)
    }
    
    /// Subscribe to real-time updates
    pub async fn subscribe_to_updates(&self, filters: HashMap<String, serde_json::Value>) -> Result<Box<dyn Subscription>> {
        if !self.is_authenticated() {
            return Err(Error::auth_error("Must be authenticated to subscribe to updates"));
        }
        
        self.ws_client.subscribe(filters).await
    }
    
    /// Get current user information
    async fn get_current_user(&mut self) -> Result<()> {
        let response: UserResponse = self.http_client.get("/auth/me").await?;
        self.current_user = Some(response.into_result()?);
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct AuthResponse {
    success: bool,
    data: Option<AuthToken>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UserResponse {
    success: bool,
    data: Option<User>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[async_trait]
pub trait Subscription {
    async fn messages(&mut self) -> Result<WebSocketMessage>;
    fn id(&self) -> &str;
    fn unsubscribe(&self) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::NetworkType;
    
    #[test]
    fn test_client_creation() {
        let config = Config::builder()
            .api_endpoint("https://api.example.com")
            .network(NetworkType::Testnet)
            .build()
            .unwrap();
        
        let client = Client::new(config);
        assert!(client.is_ready());
        assert!(!client.is_authenticated());
    }
    
    #[test]
    fn test_client_from_env() {
        // This test would require setting environment variables
        // For now, just test that it doesn't panic with default config
        std::env::set_var("VERINODE_API_ENDPOINT", "https://api.example.com");
        let client = Client::from_env();
        assert!(client.is_ok());
        std::env::remove_var("VERINODE_API_ENDPOINT");
    }
}
