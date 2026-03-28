//! Verification service for managing proof verifications.

use crate::error::{Error, Result};
use crate::types::{
    Verification, VerificationCreateRequest, VerificationStatus, QueryOptions, 
    QueryFilter, HashMap, PaginatedResponse,
};
use crate::utils::HttpClient;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Service for managing verifications in the Verinode system
pub struct VerificationService {
    http_client: Arc<dyn HttpClient>,
}

impl VerificationService {
    /// Create a new verification service
    pub fn new(http_client: Arc<dyn HttpClient>) -> Self {
        Self { http_client }
    }
    
    /// Create a new verification
    pub async fn create(&self, request: &VerificationCreateRequest) -> Result<Verification> {
        let response: VerificationResponse = self.http_client
            .post("/verifications", request)
            .await?;
        
        response.into_result()
    }
    
    /// Get a verification by ID
    pub async fn get(&self, verification_id: &str) -> Result<Verification> {
        let response: VerificationResponse = self.http_client
            .get(&format!("/verifications/{}", verification_id))
            .await?;
        
        response.into_result()
    }
    
    /// Update an existing verification
    pub async fn update(
        &self,
        verification_id: &str,
        status: Option<VerificationStatus>,
        comment: Option<&str>,
        evidence: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<Verification> {
        let mut update_data = HashMap::new();
        
        if let Some(status) = status {
            update_data.insert("status".to_string(), serde_json::to_value(status)?);
        }
        
        if let Some(comment) = comment {
            update_data.insert("comment".to_string(), serde_json::to_value(comment)?);
        }
        
        if let Some(evidence) = evidence {
            update_data.insert("evidence".to_string(), serde_json::to_value(evidence)?);
        }
        
        let response: VerificationResponse = self.http_client
            .patch(&format!("/verifications/{}", verification_id), &update_data)
            .await?;
        
        response.into_result()
    }
    
    /// Delete a verification
    pub async fn delete(&self, verification_id: &str) -> Result<()> {
        let response: EmptyResponse = self.http_client
            .delete(&format!("/verifications/{}", verification_id))
            .await?;
        
        response.into_result().map(|_| ())
    }
    
    /// List verifications with optional filtering and pagination
    pub async fn list(
        &self,
        proof_id: Option<&str>,
        verifier_id: Option<&str>,
        status: Option<VerificationStatus>,
        options: Option<&QueryOptions>,
    ) -> Result<PaginatedResponse<Verification>> {
        let mut params = Vec::new();
        
        if let Some(proof_id) = proof_id {
            params.push(("proof_id".to_string(), serde_json::to_value(proof_id)?));
        }
        
        if let Some(verifier_id) = verifier_id {
            params.push(("verifier_id".to_string(), serde_json::to_value(verifier_id)?));
        }
        
        if let Some(status) = status {
            params.push(("status".to_string(), serde_json::to_value(status)?));
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
        
        let response: VerificationsResponse = self.http_client
            .get_with_params("/verifications", &params)
            .await?;
        
        response.into_result()
    }
    
    /// Approve a verification
    pub async fn approve(
        &self,
        verification_id: &str,
        comment: Option<&str>,
        evidence: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<Verification> {
        self.update(
            verification_id,
            Some(VerificationStatus::Approved),
            comment,
            evidence,
        ).await
    }
    
    /// Reject a verification
    pub async fn reject(
        &self,
        verification_id: &str,
        comment: Option<&str>,
        evidence: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<Verification> {
        self.update(
            verification_id,
            Some(VerificationStatus::Rejected),
            comment,
            evidence,
        ).await
    }
    
    /// Get verification statistics
    pub async fn get_statistics(
        &self,
        proof_id: Option<&str>,
        verifier_id: Option<&str>,
    ) -> Result<HashMap<String, serde_json::Value>> {
        let mut params = Vec::new();
        
        if let Some(proof_id) = proof_id {
            params.push(("proof_id".to_string(), serde_json::to_value(proof_id)?));
        }
        
        if let Some(verifier_id) = verifier_id {
            params.push(("verifier_id".to_string(), serde_json::to_value(verifier_id)?));
        }
        
        let response: StatisticsResponse = self.http_client
            .get_with_params("/verifications/statistics", &params)
            .await?;
        
        response.into_result()
    }
    
    /// Bulk approve multiple verifications
    pub async fn bulk_approve(
        &self,
        verification_ids: Vec<String>,
        comment: Option<&str>,
    ) -> Result<Vec<Verification>> {
        let mut request = HashMap::new();
        request.insert("verification_ids".to_string(), serde_json::to_value(verification_ids)?);
        
        if let Some(comment) = comment {
            request.insert("comment".to_string(), serde_json::to_value(comment)?);
        }
        
        let response: VerificationsResponse = self.http_client
            .post("/verifications/bulk-approve", &request)
            .await?;
        
        response.into_result()
    }
    
    /// Bulk reject multiple verifications
    pub async fn bulk_reject(
        &self,
        verification_ids: Vec<String>,
        comment: Option<&str>,
    ) -> Result<Vec<Verification>> {
        let mut request = HashMap::new();
        request.insert("verification_ids".to_string(), serde_json::to_value(verification_ids)?);
        
        if let Some(comment) = comment {
            request.insert("comment".to_string(), serde_json::to_value(comment)?));
        }
        
        let response: VerificationsResponse = self.http_client
            .post("/verifications/bulk-reject", &request)
            .await?;
        
        response.into_result()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct VerificationResponse {
    success: bool,
    data: Option<Verification>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VerificationsResponse {
    success: bool,
    data: Option<PaginatedResponse<Verification>>,
    error: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct StatisticsResponse {
    success: bool,
    data: Option<HashMap<String, serde_json::Value>>,
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
    use crate::utils::MockHttpClient;
    use std::sync::Arc;
    
    #[tokio::test]
    async fn test_create_verification() {
        let mock_client = Arc::new(MockHttpClient::new());
        let service = VerificationService::new(mock_client.clone());
        
        let request = VerificationCreateRequest::new(
            "proof-id",
            VerificationStatus::Approved,
        ).with_comment("Test verification");
        
        // This would need to be implemented in the mock
        // let result = service.create(&request).await;
        // assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_approve_verification() {
        let mock_client = Arc::new(MockHttpClient::new());
        let service = VerificationService::new(mock_client);
        
        // This would need to be implemented in the mock
        // let result = service.approve("verification-id", Some("Approved"), None).await;
        // assert!(result.is_ok());
    }
}
