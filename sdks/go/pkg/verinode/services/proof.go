package services

import (
	"context"
	"fmt"
	"log"

	"github.com/Great-2025/verinode-go/pkg/verinode/types"
)

// ProofService handles proof-related operations
type ProofService struct {
	httpClient HTTPClient
	config     ConfigProvider
}

// NewProofService creates a new proof service
func NewProofService(httpClient HTTPClient, config ConfigProvider) *ProofService {
	return &ProofService{
		httpClient: httpClient,
		config:     config,
	}
}

// Create creates a new proof
func (s *ProofService) Create(ctx context.Context, req *types.ProofCreateRequest) (*types.Proof, error) {
	var resp types.ProofResponse
	err := s.httpClient.Post(ctx, "/proofs", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create proof: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to create proof: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Created proof: %s", resp.Data.ID)
	}
	
	return &resp.Data, nil
}

// Get retrieves a proof by ID
func (s *ProofService) Get(ctx context.Context, proofID string) (*types.Proof, error) {
	var resp types.ProofResponse
	err := s.httpClient.Get(ctx, fmt.Sprintf("/proofs/%s", proofID), &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to get proof %s: %w", proofID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("proof not found: %s", safeString(resp.Error))
	}
	
	return &resp.Data, nil
}

// Update updates an existing proof
func (s *ProofService) Update(ctx context.Context, proofID string, req *types.ProofUpdateRequest) (*types.Proof, error) {
	var resp types.ProofResponse
	err := s.httpClient.Patch(ctx, fmt.Sprintf("/proofs/%s", proofID), req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to update proof %s: %w", proofID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to update proof: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Updated proof: %s", resp.Data.ID)
	}
	
	return &resp.Data, nil
}

// Delete deletes a proof
func (s *ProofService) Delete(ctx context.Context, proofID string) error {
	var resp types.APIResponse
	err := s.httpClient.Delete(ctx, fmt.Sprintf("/proofs/%s", proofID), &resp)
	if err != nil {
		return fmt.Errorf("failed to delete proof %s: %w", proofID, err)
	}
	
	if !resp.Success {
		return fmt.Errorf("failed to delete proof: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Deleted proof: %s", proofID)
	}
	
	return nil
}

// List lists proofs with optional filtering and pagination
func (s *ProofService) List(ctx context.Context, status *types.ProofStatus, userID *string, tags []string, options *types.QueryOptions) (*types.PaginatedResponse, error) {
	params := make(map[string]string)
	
	if status != nil {
		params["status"] = string(*status)
	}
	if userID != nil {
		params["user_id"] = *userID
	}
	if len(tags) > 0 {
		params["tags"] = joinStrings(tags, ",")
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
	
	var resp types.ProofsResponse
	err := s.httpClient.Get(ctx, "/proofs", &resp, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to list proofs: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to list proofs: %s", safeString(resp.Error))
	}
	
	return &resp.Data, nil
}

// Search searches proofs by text query
func (s *ProofService) Search(ctx context.Context, query string, options *types.QueryOptions) (*types.PaginatedResponse, error) {
	params := map[string]string{
		"q": query,
	}
	
	if options != nil {
		params["page"] = fmt.Sprintf("%d", options.Page)
		params["page_size"] = fmt.Sprintf("%d", options.PageSize)
		params["include_total"] = fmt.Sprintf("%t", options.IncludeTotal)
	}
	
	var resp types.ProofsResponse
	err := s.httpClient.Get(ctx, "/proofs/search", &resp, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to search proofs: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to search proofs: %s", safeString(resp.Error))
	}
	
	return &resp.Data, nil
}

// Verify initiates verification for a proof
func (s *ProofService) Verify(ctx context.Context, proofID string, evidence map[string]interface{}) error {
	req := map[string]interface{}{}
	if evidence != nil {
		req["evidence"] = evidence
	}
	
	var resp types.APIResponse
	err := s.httpClient.Post(ctx, fmt.Sprintf("/proofs/%s/verify", proofID), req, &resp)
	if err != nil {
		return fmt.Errorf("failed to verify proof %s: %w", proofID, err)
	}
	
	if !resp.Success {
		return fmt.Errorf("failed to verify proof: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Verification initiated for proof: %s", proofID)
	}
	
	return nil
}

// GetVerifications retrieves all verifications for a proof
func (s *ProofService) GetVerifications(ctx context.Context, proofID string) ([]types.Verification, error) {
	var resp types.VerificationsResponse
	err := s.httpClient.Get(ctx, fmt.Sprintf("/proofs/%s/verifications", proofID), &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to get verifications for proof %s: %w", proofID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to get verifications: %s", safeString(resp.Error))
	}
	
	// Convert interface{} slice to Verification slice
	verifications := make([]types.Verification, len(resp.Data.Items))
	for i, item := range resp.Data.Items {
		if verification, ok := item.(types.Verification); ok {
			verifications[i] = verification
		}
	}
	
	return verifications, nil
}
