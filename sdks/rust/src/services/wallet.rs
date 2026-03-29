//! Wallet service for managing blockchain wallets.

use crate::error::{Error, Result};
use crate::types::{
    Wallet, WalletConnectRequest, TransactionRequest, SignMessageRequest, 
    VerifyMessageRequest, NetworkType, HashMap,
};
use crate::utils::{HttpClient, WebSocketClient};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Service for managing wallets in the Verinode system
pub struct WalletService {
    http_client: Arc<dyn HttpClient>,
    ws_client: Arc<dyn WebSocketClient>,
}

impl WalletService {
    /// Create a new wallet service
    pub fn new(http_client: Arc<dyn HttpClient>, ws_client: Arc<dyn WebSocketClient>) -> Self {
        Self {
            http_client,
            ws_client,
        }
    }
    
    /// Connect a wallet
    pub async fn connect(&self, request: &WalletConnectRequest) -> Result<Wallet> {
        let response: WalletResponse = self.http_client
            .post("/wallets/connect", request)
            .await?;
        
        response.into_result()
    }
    
    /// Disconnect a wallet
    pub async fn disconnect(&self, wallet_id: &str) -> Result<()> {
        let response: EmptyResponse = self.http_client
            .post(&format!("/wallets/{}/disconnect", wallet_id), &())
            .await?;
        
        response.into_result().map(|_| ())
    }
    
    /// Get wallet information
    pub async fn get(&self, wallet_id: &str) -> Result<Wallet> {
        let response: WalletResponse = self.http_client
            .get(&format!("/wallets/{}", wallet_id))
            .await?;
        
        response.into_result()
    }
    
    /// List wallets with optional filtering
    pub async fn list(&self, user_id: Option<&str>) -> Result<Vec<Wallet>> {
        let mut params = Vec::new();
        
        if let Some(user_id) = user_id {
            params.push(("user_id".to_string(), serde_json::to_value(user_id)?));
        }
        
        let response: WalletsResponse = self.http_client
            .get_with_params("/wallets", &params)
            .await?;
        
        response.into_result()
    }
    
    /// Get wallet balance
    pub async fn get_balance(&self, wallet_id: &str) -> Result<String> {
        let response: BalanceResponse = self.http_client
            .get(&format!("/wallets/{}/balance", wallet_id))
            .await?;
        
        let data = response.into_result()?;
        Ok(data.balance)
    }
    
    /// Send a transaction from a wallet
    pub async fn send_transaction(
        &self,
        wallet_id: &str,
        to_address: &str,
        amount: &str,
        memo: Option<&str>,
    ) -> Result<HashMap<String, serde_json::Value>> {
        let request = TransactionRequest {
            to_address: to_address.to_string(),
            amount: amount.to_string(),
            memo: memo.map(|m| m.to_string()),
        };
        
        let response: TransactionResponse = self.http_client
            .post(&format!("/wallets/{}/send", wallet_id), &request)
            .await?;
        
        response.into_result()
    }
    
    /// Sign a message with a wallet
    pub async fn sign_message(&self, wallet_id: &str, message: &str) -> Result<String> {
        let request = SignMessageRequest {
            message: message.to_string(),
        };
        
        let response: SignMessageResponse = self.http_client
            .post(&format!("/wallets/{}/sign", wallet_id), &request)
            .await?;
        
        let data = response.into_result()?;
        Ok(data.signature)
    }
    
    /// Verify a message signature
    pub async fn verify_message(
        &self,
        public_key: &str,
        message: &str,
        signature: &str,
    ) -> Result<bool> {
        let request = VerifyMessageRequest {
            public_key: public_key.to_string(),
            message: message.to_string(),
            signature: signature.to_string(),
        };
        
        let response: VerifyMessageResponse = self.http_client
            .post("/wallets/verify", &request)
            .await?;
        
        let data = response.into_result()?;
        Ok(data.valid)
    }
    
    /// Subscribe to wallet events
    pub async fn subscribe_to_wallet_events(&self, wallet_id: &str) -> Result<Box<dyn crate::client::Subscription>> {
        let mut filters = HashMap::new();
        filters.insert("wallet_id".to_string(), serde_json::to_value(wallet_id)?);
        
        self.ws_client.subscribe(filters).await
    }
    
    /// Switch wallet network
    pub async fn switch_network(&self, wallet_id: &str, network: NetworkType) -> Result<Wallet> {
        let mut request = HashMap::new();
        request.insert("network".to_string(), serde_json::to_value(network)?);
        
        let response: WalletResponse = self.http_client
            .post(&format!("/wallets/{}/switch-network", wallet_id), &request)
            .await?;
        
        response.into_result()
    }
    
    /// Get transaction history for a wallet
    pub async fn get_transaction_history(
        &self,
        wallet_id: &str,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<HashMap<String, serde_json::Value>>> {
        let params = vec![
            ("limit".to_string(), serde_json::to_value(limit)?),
            ("offset".to_string(), serde_json::to_value(offset)?),
        ];
        
        let response: TransactionsResponse = self.http_client
            .get_with_params(&format!("/wallets/{}/transactions", wallet_id), &params)
            .await?;
        
        response.into_result()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct WalletResponse {
    success: bool,
    data: Option<Wallet>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WalletsResponse {
    success: bool,
    data: Option<Vec<Wallet>>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BalanceResponse {
    success: bool,
    data: Option<BalanceData>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BalanceData {
    balance: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TransactionResponse {
    success: bool,
    data: Option<HashMap<String, serde_json::Value>>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SignMessageResponse {
    success: bool,
    data: Option<SignMessageData>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SignMessageData {
    signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct VerifyMessageResponse {
    success: bool,
    data: Option<VerifyMessageData>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VerifyMessageData {
    valid: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct TransactionsResponse {
    success: bool,
    data: Option<Vec<HashMap<String, serde_json::Value>>>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EmptyResponse {
    success: bool,
    data: Option<()>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::{MockHttpClient, MockWebSocketClient};
    use std::sync::Arc;
    
    #[tokio::test]
    async fn test_connect_wallet() {
        let mock_http = Arc::new(MockHttpClient::new());
        let mock_ws = Arc::new(MockWebSocketClient::new());
        let service = WalletService::new(mock_http, mock_ws);
        
        let request = WalletConnectRequest::new(
            crate::types::WalletType::Stellar,
            NetworkType::Testnet,
        );
        
        // This would need to be implemented in the mock
        // let result = service.connect(&request).await;
        // assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_get_balance() {
        let mock_http = Arc::new(MockHttpClient::new());
        let mock_ws = Arc::new(MockWebSocketClient::new());
        let service = WalletService::new(mock_http, mock_ws);
        
        // This would need to be implemented in the mock
        // let result = service.get_balance("wallet-id").await;
        // assert!(result.is_ok());
    }
}
