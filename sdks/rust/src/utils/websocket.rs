//! WebSocket client utilities for the Verinode SDK.

use crate::config::Config;
use crate::error::{Error, Result};
use crate::types::{WebSocketMessage, HashMap};
use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use serde_json;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message, WebSocketStream};

/// Trait for WebSocket client implementations
#[async_trait]
pub trait WebSocketClient: Send + Sync {
    /// Subscribe to real-time updates
    async fn subscribe(&self, filters: HashMap<String, serde_json::Value>) -> Result<Box<dyn crate::client::Subscription>>;
}

/// Tungstenite-based WebSocket client implementation
pub struct TungsteniteWebSocketClient {
    config: Arc<Config>,
    subscriptions: Arc<RwLock<HashMap<String, mpsc::UnboundedSender<WebSocketMessage>>>>,
}

impl TungsteniteWebSocketClient {
    /// Create a new WebSocket client
    pub fn new(config: Arc<Config>) -> Self {
        Self {
            config,
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Build WebSocket URL
    fn build_ws_url(&self) -> String {
        let base_url = &self.config.api_endpoint;
        let ws_url = base_url
            .replace("http://", "ws://")
            .replace("https://", "wss://");
        format!("{}/ws", ws_url)
    }
    
    /// Handle WebSocket connection and messages
    async fn handle_connection(
        ws_stream: WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
        subscriptions: Arc<RwLock<HashMap<String, mpsc::UnboundedSender<WebSocketMessage>>>>,
    ) -> Result<()> {
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        
        loop {
            tokio::select! {
                // Handle incoming messages
                Some(message_result) = ws_receiver.next() => {
                    match message_result {
                        Ok(Message::Text(text)) => {
                            if let Ok(ws_message) = serde_json::from_str::<WebSocketMessage>(&text) {
                                self::handle_websocket_message(ws_message, &subscriptions).await;
                            }
                        }
                        Ok(Message::Close(_)) => {
                            log::info!("WebSocket connection closed");
                            break;
                        }
                        Err(e) => {
                            log::error!("WebSocket error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }
                // Handle connection closure
                else => break,
            }
        }
        
        Ok(())
    }
    
    /// Handle incoming WebSocket messages
    async fn handle_websocket_message(
        message: WebSocketMessage,
        subscriptions: &Arc<RwLock<HashMap<String, mpsc::UnboundedSender<WebSocketMessage>>>>,
    ) {
        match message.message_type.as_str() {
            "subscription_update" => {
                if let Some(subscription_id) = message.data
                    .as_ref()
                    .and_then(|d| d.get("subscription_id"))
                    .and_then(|id| id.as_str())
                {
                    let subs = subscriptions.read().await;
                    if let Some(sender) = subs.get(subscription_id) {
                        let _ = sender.send(message);
                    }
                }
            }
            "subscription_confirmed" => {
                log::info!("Subscription confirmed");
            }
            "subscription_error" => {
                if let Some(error) = message.data
                    .as_ref()
                    .and_then(|d| d.get("error"))
                    .and_then(|e| e.as_str())
                {
                    log::error!("Subscription error: {}", error);
                }
            }
            "ping" => {
                // Respond with pong (would need access to ws_sender)
                log::debug!("Received ping, would send pong");
            }
            _ => {
                log::debug!("Unknown WebSocket message type: {}", message.message_type);
            }
        }
    }
}

#[async_trait]
impl WebSocketClient for TungsteniteWebSocketClient {
    async fn subscribe(&self, filters: HashMap<String, serde_json::Value>) -> Result<Box<dyn crate::client::Subscription>> {
        let ws_url = self.build_ws_url();
        let (ws_stream, _) = connect_async(&ws_url).await.map_err(Error::from)?;
        
        let subscription_id = format!("sub_{}", uuid::Uuid::new_v4());
        let (tx, rx) = mpsc::unbounded_channel();
        
        // Store subscription
        {
            let mut subs = self.subscriptions.write().await;
            subs.insert(subscription_id.clone(), tx);
        }
        
        // Send subscription message
        let (mut ws_sender, ws_receiver) = ws_stream.split();
        let subscribe_message = WebSocketMessage {
            message_type: "subscribe".to_string(),
            id: Some(subscription_id.clone()),
            data: Some(filters),
        };
        
        let subscribe_json = serde_json::to_string(&subscribe_message)?;
        ws_sender.send(Message::Text(subscribe_json)).await
            .map_err(|e| Error::network_error(format!("Failed to send subscription message: {}", e)))?;
        
        // Start message handler
        let subscriptions_clone = self.subscriptions.clone();
        tokio::spawn(async move {
            let _ = Self::handle_connection(
                ws_sender.reunite(ws_receiver).unwrap(),
                subscriptions_clone,
            ).await;
        });
        
        Ok(Box::new(WebSocketSubscriptionImpl {
            id: subscription_id,
            receiver: rx,
            subscriptions: self.subscriptions.clone(),
        }))
    }
}

/// WebSocket subscription implementation
struct WebSocketSubscriptionImpl {
    id: String,
    receiver: mpsc::UnboundedReceiver<WebSocketMessage>,
    subscriptions: Arc<RwLock<HashMap<String, mpsc::UnboundedSender<WebSocketMessage>>>>,
}

#[async_trait]
impl crate::client::Subscription for WebSocketSubscriptionImpl {
    async fn messages(&mut self) -> Result<WebSocketMessage> {
        self.receiver.recv().await
            .ok_or_else(|| Error::subscription_error("Subscription closed", Some(&self.id)))
    }
    
    fn id(&self) -> &str {
        &self.id
    }
    
    fn unsubscribe(&self) -> Result<()> {
        // Remove from subscriptions map
        // This would need to be async in a real implementation
        Ok(())
    }
}

/// Mock WebSocket client for testing
#[cfg(test)]
pub struct MockWebSocketClient {
    // Implementation would go here
}

#[cfg(test)]
impl MockWebSocketClient {
    pub fn new() -> Self {
        Self {}
    }
}

#[cfg(test)]
#[async_trait]
impl WebSocketClient for MockWebSocketClient {
    async fn subscribe(&self, _filters: HashMap<String, serde_json::Value>) -> Result<Box<dyn crate::client::Subscription>> {
        // Mock implementation
        Err(Error::network_error("Not implemented"))
    }
}
