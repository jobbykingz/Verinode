//! HTTP client utilities for the Verinode SDK.

use crate::config::Config;
use crate::error::{Error, Result};
use async_trait::async_trait;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

/// Trait for HTTP client implementations
#[async_trait]
pub trait HttpClient: Send + Sync {
    /// Set the authentication token
    fn set_auth_token(&self, token: &str);
    
    /// Perform a GET request
    async fn get<T: for<'de> Deserialize<'de>>(&self, endpoint: &str) -> Result<T>;
    
    /// Perform a GET request with parameters
    async fn get_with_params<T: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        params: &[(&String, serde_json::Value)],
    ) -> Result<T>;
    
    /// Perform a POST request
    async fn post<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        request: &Req,
    ) -> Result<Res>;
    
    /// Perform a PATCH request
    async fn patch<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        request: &Req,
    ) -> Result<Res>;
    
    /// Perform a PUT request
    async fn put<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        request: &Req,
    ) -> Result<Res>;
    
    /// Perform a DELETE request
    async fn delete<T: for<'de> Deserialize<'de>>(&self, endpoint: &str) -> Result<T>;
}

/// Reqwest-based HTTP client implementation
pub struct ReqwestHttpClient {
    client: Client,
    base_url: String,
    auth_token: std::sync::RwLock<Option<String>>,
    max_retries: u32,
    retry_delay: Duration,
    backoff_multiplier: f64,
}

impl ReqwestHttpClient {
    /// Create a new HTTP client
    pub fn new(config: Arc<Config>) -> Self {
        let timeout = config.timeout;
        let mut client_builder = Client::builder()
            .timeout(timeout)
            .user_agent("verinode-sdk-rust/1.0.0");
        
        // Configure TLS if needed
        client_builder = client_builder.use_rustls_tls();
        
        let client = client_builder.build().unwrap_or_else(|_| {
            Client::builder()
                .timeout(timeout)
                .user_agent("verinode-sdk-rust/1.0.0")
                .build()
                .expect("Failed to create HTTP client")
        });
        
        Self {
            client,
            base_url: config.api_endpoint.clone(),
            auth_token: std::sync::RwLock::new(None),
            max_retries: config.max_retries,
            retry_delay: config.retry_delay,
            backoff_multiplier: config.backoff_multiplier,
        }
    }
    
    /// Build the full URL for an endpoint
    fn build_url(&self, endpoint: &str) -> String {
        format!("{}{}", self.base_url, endpoint)
    }
    
    /// Add authentication header to request
    fn add_auth_header(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        let auth_token = self.auth_token.read().unwrap();
        if let Some(token) = auth_token.as_ref() {
            request.header("Authorization", format!("Bearer {}", token))
        } else {
            request
        }
    }
    
    /// Perform a request with retry logic
    async fn request_with_retry<F, T>(&self, request_fn: F) -> Result<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T>> + Send>>,
    {
        let mut last_error = None;
        
        for attempt in 0..=self.max_retries {
            match request_fn().await {
                Ok(result) => return Ok(result),
                Err(err) => {
                    last_error = Some(err.clone());
                    
                    // Don't retry on client errors (4xx)
                    if let Some(http_err) = err.downcast_ref::<Error>() {
                        if let Some(status) = http_err.status_code {
                            if status.is_client_error() {
                                break;
                            }
                        }
                    }
                    
                    // Don't retry on the last attempt
                    if attempt == self.max_retries {
                        break;
                    }
                    
                    // Calculate delay with exponential backoff
                    let delay = self.retry_delay * self.backoff_multiplier.powi(attempt as i32);
                    tokio::time::sleep(delay).await;
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| Error::network_error("Request failed after retries")))
    }
    
    /// Handle HTTP response
    async fn handle_response<T: for<'de> Deserialize<'de>>(
        &self,
        response: reqwest::Response,
    ) -> Result<T> {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        
        if status.is_success() {
            serde_json::from_str(&text).map_err(|e| {
                Error::api_error(
                    format!("Failed to parse response: {}", e),
                    status,
                )
            })
        } else {
            // Try to parse error response
            if let Ok(error_response) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(error_msg) = error_response.get("error").and_then(|v| v.as_str()) {
                    return Err(Error::api_error(error_msg.to_string(), status));
                }
            }
            
            Err(Error::api_error(
                format!("HTTP {}: {}", status.as_u16(), text),
                status,
            ))
        }
    }
}

#[async_trait]
impl HttpClient for ReqwestHttpClient {
    fn set_auth_token(&self, token: &str) {
        let mut auth_token = self.auth_token.write().unwrap();
        *auth_token = Some(token.to_string());
    }
    
    async fn get<T: for<'de> Deserialize<'de>>(&self, endpoint: &str) -> Result<T> {
        self.request_with_retry(|| {
            Box::pin(async {
                let url = self.build_url(endpoint);
                let request = self.add_auth_header(self.client.get(&url));
                let response = request.send().await.map_err(Error::from)?;
                self.handle_response(response).await
            })
        }).await
    }
    
    async fn get_with_params<T: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        params: &[(&String, serde_json::Value)],
    ) -> Result<T> {
        self.request_with_retry(|| {
            Box::pin(async {
                let url = self.build_url(endpoint);
                let mut request = self.add_auth_header(self.client.get(&url));
                
                // Add query parameters
                for (key, value) in params {
                    request = request.query(&[(key.as_str(), &value.to_string())]);
                }
                
                let response = request.send().await.map_err(Error::from)?;
                self.handle_response(response).await
            })
        }).await
    }
    
    async fn post<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        request: &Req,
    ) -> Result<Res> {
        self.request_with_retry(|| {
            Box::pin(async {
                let url = self.build_url(endpoint);
                let request = self.add_auth_header(self.client.post(&url).json(request));
                let response = request.send().await.map_err(Error::from)?;
                self.handle_response(response).await
            })
        }).await
    }
    
    async fn patch<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        request: &Req,
    ) -> Result<Res> {
        self.request_with_retry(|| {
            Box::pin(async {
                let url = self.build_url(endpoint);
                let request = self.add_auth_header(self.client.patch(&url).json(request));
                let response = request.send().await.map_err(Error::from)?;
                self.handle_response(response).await
            })
        }).await
    }
    
    async fn put<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        request: &Req,
    ) -> Result<Res> {
        self.request_with_retry(|| {
            Box::pin(async {
                let url = self.build_url(endpoint);
                let request = self.add_auth_header(self.client.put(&url).json(request));
                let response = request.send().await.map_err(Error::from)?;
                self.handle_response(response).await
            })
        }).await
    }
    
    async fn delete<T: for<'de> Deserialize<'de>>(&self, endpoint: &str) -> Result<T> {
        self.request_with_retry(|| {
            Box::pin(async {
                let url = self.build_url(endpoint);
                let request = self.add_auth_header(self.client.delete(&url));
                let response = request.send().await.map_err(Error::from)?;
                self.handle_response(response).await
            })
        }).await
    }
}

/// Mock HTTP client for testing
#[cfg(test)]
pub struct MockHttpClient {
    // Implementation would go here
}

#[cfg(test)]
impl MockHttpClient {
    pub fn new() -> Self {
        Self {}
    }
}

#[cfg(test)]
#[async_trait]
impl HttpClient for MockHttpClient {
    fn set_auth_token(&self, _token: &str) {
        // Mock implementation
    }
    
    async fn get<T: for<'de> Deserialize<'de>>(&self, _endpoint: &str) -> Result<T> {
        // Mock implementation
        Err(Error::network_error("Not implemented"))
    }
    
    async fn get_with_params<T: for<'de> Deserialize<'de>>(
        &self,
        _endpoint: &str,
        _params: &[(&String, serde_json::Value)],
    ) -> Result<T> {
        // Mock implementation
        Err(Error::network_error("Not implemented"))
    }
    
    async fn post<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        _endpoint: &str,
        _request: &Req,
    ) -> Result<Res> {
        // Mock implementation
        Err(Error::network_error("Not implemented"))
    }
    
    async fn patch<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        _endpoint: &str,
        _request: &Req,
    ) -> Result<Res> {
        // Mock implementation
        Err(Error::network_error("Not implemented"))
    }
    
    async fn put<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        _endpoint: &str,
        _request: &Req,
    ) -> Result<Res> {
        // Mock implementation
        Err(Error::network_error("Not implemented"))
    }
    
    async fn delete<T: for<'de> Deserialize<'de>>(&self, _endpoint: &str) -> Result<T> {
        // Mock implementation
        Err(Error::network_error("Not implemented"))
    }
}
