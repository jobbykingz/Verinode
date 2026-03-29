package services

import (
	"context"
	"fmt"
	"log"

	"github.com/Great-2025/verinode-go/pkg/verinode/types"
)

// VerificationService handles verification-related operations
type VerificationService struct {
	httpClient HTTPClient
	config     ConfigProvider
}

// NewVerificationService creates a new verification service
func NewVerificationService(httpClient HTTPClient, config ConfigProvider) *VerificationService {
	return &VerificationService{
		httpClient: httpClient,
		config:     config,
	}
}

// Create creates a new verification
func (s *VerificationService) Create(ctx context.Context, req *types.VerificationCreateRequest) (*types.Verification, error) {
	var resp types.VerificationResponse
	err := s.httpClient.Post(ctx, "/verifications", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create verification: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to create verification: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Created verification: %s", resp.Data.ID)
	}
	
	return &resp.Data, nil
}

// Get retrieves a verification by ID
func (s *VerificationService) Get(ctx context.Context, verificationID string) (*types.Verification, error) {
	var resp types.VerificationResponse
	err := s.httpClient.Get(ctx, fmt.Sprintf("/verifications/%s", verificationID), &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to get verification %s: %w", verificationID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("verification not found: %s", safeString(resp.Error))
	}
	
	return &resp.Data, nil
}

// Update updates an existing verification
func (s *VerificationService) Update(ctx context.Context, verificationID string, status *types.VerificationStatus, comment *string, evidence map[string]interface{}) (*types.Verification, error) {
	updateData := make(map[string]interface{})
	
	if status != nil {
		updateData["status"] = string(*status)
	}
	if comment != nil {
		updateData["comment"] = *comment
	}
	if evidence != nil {
		updateData["evidence"] = evidence
	}
	
	var resp types.VerificationResponse
	err := s.httpClient.Patch(ctx, fmt.Sprintf("/verifications/%s", verificationID), updateData, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to update verification %s: %w", verificationID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to update verification: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Updated verification: %s", resp.Data.ID)
	}
	
	return &resp.Data, nil
}

// Delete deletes a verification
func (s *VerificationService) Delete(ctx context.Context, verificationID string) error {
	var resp types.APIResponse
	err := s.httpClient.Delete(ctx, fmt.Sprintf("/verifications/%s", verificationID), &resp)
	if err != nil {
		return fmt.Errorf("failed to delete verification %s: %w", verificationID, err)
	}
	
	if !resp.Success {
		return fmt.Errorf("failed to delete verification: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Deleted verification: %s", verificationID)
	}
	
	return nil
}

// List lists verifications with optional filtering and pagination
func (s *VerificationService) List(ctx context.Context, proofID *string, verifierID *string, status *types.VerificationStatus, options *types.QueryOptions) (*types.PaginatedResponse, error) {
	params := make(map[string]string)
	
	if proofID != nil {
		params["proof_id"] = *proofID
	}
	if verifierID != nil {
		params["verifier_id"] = *verifierID
	}
	if status != nil {
		params["status"] = string(*status)
	}
	
	if options != nil {
		params["page"] = fmt.Sprintf("%d", options.Page)
		params["page_size"] = fmt.Sprintf("%d", options.PageSize)
		params["include_total"] = fmt.Sprintf("%t", options.IncludeTotal)
		
		for i, filter := range options.Filters {
			params[fmt.Sprintf("filter_%d_field", i)] = filter.Field
			params[fmt.Sprintf("filter_%d_operator", i)] = filter.Operator
			params[fmt.Sprintf("filter_%d_value", i)] = fmt.Sprintf("%v", filter.Value)
		}
		
		for field, direction := range options.Sort {
			params[fmt.Sprintf("sort_%s", field)] = fmt.Sprintf("%d", direction)
		}
	}
	
	var resp types.VerificationsResponse
	err := s.httpClient.Get(ctx, "/verifications", &resp, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to list verifications: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to list verifications: %s", safeString(resp.Error))
	}
	
	return &resp.Data, nil
}

// Approve approves a verification
func (s *VerificationService) Approve(ctx context.Context, verificationID string, comment *string, evidence map[string]interface{}) (*types.Verification, error) {
	status := types.VerificationStatusApproved
	return s.Update(ctx, verificationID, &status, comment, evidence)
}

// Reject rejects a verification
func (s *VerificationService) Reject(ctx context.Context, verificationID string, comment *string, evidence map[string]interface{}) (*types.Verification, error) {
	status := types.VerificationStatusRejected
	return s.Update(ctx, verificationID, &status, comment, evidence)
}

// GetStatistics retrieves verification statistics
func (s *VerificationService) GetStatistics(ctx context.Context, proofID *string, verifierID *string) (map[string]interface{}, error) {
	params := make(map[string]string)
	
	if proofID != nil {
		params["proof_id"] = *proofID
	}
	if verifierID != nil {
		params["verifier_id"] = *verifierID
	}
	
	var resp types.StatisticsResponse
	err := s.httpClient.Get(ctx, "/verifications/statistics", &resp, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to get verification statistics: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to get verification statistics: %s", safeString(resp.Error))
	}
	
	return resp.Data, nil
}

// BulkApprove approves multiple verifications at once
func (s *VerificationService) BulkApprove(ctx context.Context, verificationIDs []string, comment *string) ([]types.Verification, error) {
	req := map[string]interface{}{
		"verification_ids": verificationIDs,
	}
	if comment != nil {
		req["comment"] = *comment
	}
	
	var resp types.VerificationsResponse
	err := s.httpClient.Post(ctx, "/verifications/bulk-approve", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to bulk approve verifications: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to bulk approve verifications: %s", safeString(resp.Error))
	}
	
	// Convert interface{} slice to Verification slice
	verifications := make([]types.Verification, len(resp.Data.Items))
	for i, item := range resp.Data.Items {
		if verification, ok := item.(types.Verification); ok {
			verifications[i] = verification
		}
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Bulk approved %d verifications", len(verifications))
	}
	
	return verifications, nil
}

// BulkReject rejects multiple verifications at once
func (s *VerificationService) BulkReject(ctx context.Context, verificationIDs []string, comment *string) ([]types.Verification, error) {
	req := map[string]interface{}{
		"verification_ids": verificationIDs,
	}
	if comment != nil {
		req["comment"] = *comment
	}
	
	var resp types.VerificationsResponse
	err := s.httpClient.Post(ctx, "/verifications/bulk-reject", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to bulk reject verifications: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to bulk reject verifications: %s", safeString(resp.Error))
	}
	
	// Convert interface{} slice to Verification slice
	verifications := make([]types.Verification, len(resp.Data.Items))
	for i, item := range resp.Data.Items {
		if verification, ok := item.(types.Verification); ok {
			verifications[i] = verification
		}
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Bulk rejected %d verifications", len(verifications))
	}
	
	return verifications, nil
}
