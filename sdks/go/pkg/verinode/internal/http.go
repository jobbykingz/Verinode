package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Great-2025/verinode-go/pkg/verinode"
)

// HTTPClient implements the HTTPClient interface
type HTTPClient struct {
	baseURL    string
	httpClient *http.Client
	authToken  string
	maxRetries int
	retryDelay time.Duration
	backoff    float64
}

// NewHTTPClient creates a new HTTP client
func NewHTTPClient(config verinode.ConfigProvider) verinode.HTTPClient {
	return &HTTPClient{
		baseURL: config.GetAPIEndpoint(),
		httpClient: &http.Client{
			Timeout: time.Duration(config.GetTimeout()) * time.Millisecond,
		},
		maxRetries: config.GetMaxRetries(),
		retryDelay: time.Duration(config.GetRetryDelay()) * time.Millisecond,
		backoff:    config.GetBackoffMultiplier(),
	}
}

// Get performs a GET request
func (c *HTTPClient) Get(ctx context.Context, endpoint string, response interface{}, params ...string) error {
	url := c.baseURL + endpoint
	if len(params) > 0 {
		url += "?" + params[0]
	}
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	return c.doRequestWithRetry(req, response)
}

// Post performs a POST request
func (c *HTTPClient) Post(ctx context.Context, endpoint string, request interface{}, response interface{}) error {
	url := c.baseURL + endpoint
	
	var body io.Reader
	if request != nil {
		jsonData, err := json.Marshal(request)
		if err != nil {
			return fmt.Errorf("failed to marshal request: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", url, body)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	if request != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	return c.doRequestWithRetry(req, response)
}

// Patch performs a PATCH request
func (c *HTTPClient) Patch(ctx context.Context, endpoint string, request interface{}, response interface{}) error {
	url := c.baseURL + endpoint
	
	var body io.Reader
	if request != nil {
		jsonData, err := json.Marshal(request)
		if err != nil {
			return fmt.Errorf("failed to marshal request: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequestWithContext(ctx, "PATCH", url, body)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	if request != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	return c.doRequestWithRetry(req, response)
}

// Put performs a PUT request
func (c *HTTPClient) Put(ctx context.Context, endpoint string, request interface{}, response interface{}) error {
	url := c.baseURL + endpoint
	
	var body io.Reader
	if request != nil {
		jsonData, err := json.Marshal(request)
		if err != nil {
			return fmt.Errorf("failed to marshal request: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequestWithContext(ctx, "PUT", url, body)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	if request != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	return c.doRequestWithRetry(req, response)
}

// Delete performs a DELETE request
func (c *HTTPClient) Delete(ctx context.Context, endpoint string, response interface{}) error {
	url := c.baseURL + endpoint
	
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	return c.doRequestWithRetry(req, response)
}

// SetAuthToken sets the authentication token
func (c *HTTPClient) SetAuthToken(token string) {
	c.authToken = token
}

// Close closes the HTTP client
func (c *HTTPClient) Close() error {
	// HTTP client doesn't need explicit closing in Go
	return nil
}

// doRequestWithRetry performs a request with retry logic
func (c *HTTPClient) doRequestWithRetry(req *http.Request, response interface{}) error {
	var lastErr error
	
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			delay := time.Duration(float64(c.retryDelay) * (1 << (attempt - 1)) * c.backoff)
			time.Sleep(delay)
		}
		
		err := c.doRequest(req, response)
		if err == nil {
			return nil
		}
		
		lastErr = err
		
		// Don't retry on client errors (4xx)
		if httpErr, ok := err.(*verinode.Error); ok && httpErr.StatusCode >= 400 && httpErr.StatusCode < 500 {
			break
		}
	}
	
	return lastErr
}

// doRequest performs a single HTTP request
func (c *HTTPClient) doRequest(req *http.Request, response interface{}) error {
	// Set headers
	req.Header.Set("User-Agent", "verinode-sdk-go/1.0.0")
	if c.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return verinode.NewNetworkError(fmt.Sprintf("request failed: %v", err))
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return verinode.NewNetworkError(fmt.Sprintf("failed to read response body: %v", err))
	}
	
	// Try to parse as JSON
	var apiResponse map[string]interface{}
	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return verinode.NewAPIError(fmt.Sprintf("invalid JSON response: %v", err), resp.StatusCode, string(body))
	}
	
	// Check for API error
	if success, ok := apiResponse["success"].(bool); ok && !success {
		errorMsg := "API error"
		if errMsg, ok := apiResponse["error"].(string); ok {
			errorMsg = errMsg
		}
		return verinode.NewAPIError(errorMsg, resp.StatusCode, apiResponse)
	}
	
	// Parse response if provided
	if response != nil {
		if err := json.Unmarshal(body, response); err != nil {
			return verinode.NewAPIError(fmt.Sprintf("failed to parse response: %v", err), resp.StatusCode, string(body))
		}
	}
	
	return nil
}
