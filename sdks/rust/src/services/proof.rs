//! Proof service for managing cryptographic proofs.

use crate::error::{Error, Result};
use crate::types::{
    Proof, ProofCreateRequest, ProofUpdateRequest, QueryOptions, QueryFilter, 
    ProofStatus, HashMap, PaginatedResponse,
};
use crate::utils::HttpClient;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Service for managing proofs in the Verinode system
pub struct ProofService {
    http_client: Arc<dyn HttpClient>,
}

impl ProofService {
    /// Create a new proof service
    pub fn new(http_client: Arc<dyn HttpClient>) -> Self {
        Self { http_client }
    }
    
    /// Create a new proof
    pub async fn create(&self, request: &ProofCreateRequest) -> Result<Proof> {
        let response: ProofResponse = self.http_client
            .post("/proofs", request)
            .await?;
        
        response.into_result()
    }
    
    /// Get a proof by ID
    pub async fn get(&self, proof_id: &str) -> Result<Proof> {
        let response: ProofResponse = self.http_client
            .get(&format!("/proofs/{}", proof_id))
            .await?;
        
        response.into_result()
    }
    
    /// Update an existing proof
    pub async fn update(&self, proof_id: &str, request: &ProofUpdateRequest) -> Result<Proof> {
        let response: ProofResponse = self.http_client
            .patch(&format!("/proofs/{}", proof_id), request)
            .await?;
        
        response.into_result()
    }
    
    /// Delete a proof
    pub async fn delete(&self, proof_id: &str) -> Result<()> {
        let response: EmptyResponse = self.http_client
            .delete(&format!("/proofs/{}", proof_id))
            .await?;
        
        response.into_result().map(|_| ())
    }
    
    /// List proofs with optional filtering and pagination
    pub async fn list(
        &self,
        status: Option<ProofStatus>,
        user_id: Option<&str>,
        tags: Option<Vec<String>>,
        options: Option<&QueryOptions>,
    ) -> Result<PaginatedResponse<Proof>> {
        let mut params = Vec::new();
        
        if let Some(status) = status {
            params.push(("status".to_string(), serde_json::to_value(status)?));
        }
        
        if let Some(user_id) = user_id {
            params.push(("user_id".to_string(), serde_json::to_value(user_id)?));
        }
        
        if let Some(tags) = tags {
            params.push(("tags".to_string(), serde_json::to_value(tags.join(","))?));
        }
        
        if let Some(options) = options {
            params.push(("page".to_string(), serde_json::to_value(options.page)?));
            params.push(("page_size".to_string(), serde_json::to_value(options.page_size)?));
            params.push(("include_total".to_string(), serde_json::to_value(options.include_total)?));
            
            if let Some(filters) = &options.filters {
                for (i, filter) in filters.iter().enumerate() {
                    params.push((format!("filter_{}_field", i), serde_json::to_value(&filter.field)?));
                    params.push((format!("filter_{}_operator", i), serde_json::to_value(&filter.operator)?));
                    params.push((format!("filter_{}_value", i), filter.value.clone()));
                }
            }
            
            if let Some(sort) = &options.sort {
                for (field, direction) in sort {
                    params.push((format!("sort_{}", field), serde_json::to_value(direction)?));
                }
            }
        }
        
        let response: ProofsResponse = self.http_client
            .get_with_params("/proofs", &params)
            .await?;
        
        response.into_result()
    }
    
    /// Search proofs by text query
    pub async fn search(
        &self,
        query: &str,
        options: Option<&QueryOptions>,
    ) -> Result<PaginatedResponse<Proof>> {
        let mut params = vec![("q".to_string(), serde_json::to_value(query)?)];
        
        if let Some(options) = options {
            params.push(("page".to_string(), serde_json::to_value(options.page)?));
            params.push(("page_size".to_string(), serde_json::to_value(options.page_size)?));
            params.push(("include_total".to_string(), serde_json::to_value(options.include_total)?));
        }
        
        let response: ProofsResponse = self.http_client
            .get_with_params("/proofs/search", &params)
            .await?;
        
        response.into_result()
    }
    
    /// Verify a proof
    pub async fn verify(&self, proof_id: &str, evidence: Option<HashMap<String, serde_json::Value>>) -> Result<()> {
        let mut request = HashMap::new();
        if let Some(evidence) = evidence {
            request.insert("evidence".to_string(), serde_json::to_value(evidence)?);
        }
        
        let response: EmptyResponse = self.http_client
            .post(&format!("/proofs/{}/verify", proof_id), &request)
            .await?;
        
        response.into_result().map(|_| ())
    }
    
    /// Get all verifications for a proof
    pub async fn get_verifications(&self, proof_id: &str) -> Result<Vec<crate::types::Verification>> {
        let response: VerificationsResponse = self.http_client
            .get(&format!("/proofs/{}/verifications", proof_id))
            .await?;
        
        response.into_result()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ProofResponse {
    success: bool,
    data: Option<Proof>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProofsResponse {
    success: bool,
    data: Option<PaginatedResponse<Proof>>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VerificationsResponse {
    success: bool,
    data: Option<Vec<crate::types::Verification>>,
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
    use crate::types::NetworkType;
    use crate::utils::MockHttpClient;
    use std::sync::Arc;
    
    #[tokio::test]
    async fn test_create_proof() {
        let mock_client = Arc::new(MockHttpClient::new());
        let service = ProofService::new(mock_client.clone());
        
        let request = ProofCreateRequest::new("Test Proof")
            .with_description("A test proof")
            .with_tags(vec!["test".to_string()]);
        
        // This would need to be implemented in the mock
        // let result = service.create(&request).await;
        // assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_get_proof() {
        let mock_client = Arc::new(MockHttpClient::new());
        let service = ProofService::new(mock_client);
        
        // This would need to be implemented in the mock
        // let result = service.get("proof-id").await;
        // assert!(result.is_ok());
    }
}
