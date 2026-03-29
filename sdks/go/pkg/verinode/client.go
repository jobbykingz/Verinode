package verinode

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/Great-2025/verinode-go/pkg/verinode/services"
	"github.com/Great-2025/verinode-go/pkg/verinode/types"
)

// Client is the main Verinode SDK client
type Client struct {
	config      *Config
	httpClient  *HTTPClient
	wsClient    *WebSocketClient
	
	// Services
	Proof         *services.ProofService
	Verification  *services.VerificationService
	Wallet        *services.WalletService
	
	// Authentication
	authToken     *types.AuthToken
	currentUser   *types.User
}

// NewClient creates a new Verinode client
func NewClient(config *Config) *Client {
	if config == nil {
		config = DefaultConfig()
	}
	
	client := &Client{
		config:     config,
		httpClient: NewHTTPClient(config),
		wsClient:   NewWebSocketClient(config),
	}
	
	// Initialize services
	client.Proof = services.NewProofService(client.httpClient, config)
	client.Verification = services.NewVerificationService(client.httpClient, config)
	client.Wallet = services.NewWalletService(client.httpClient, client.wsClient, config)
	
	return client
}

// NewClientWithDefaults creates a new client with default configuration
func NewClientWithDefaults() *Client {
	return NewClient(DefaultConfig())
}

// IsAuthenticated returns true if the client is authenticated
func (c *Client) IsAuthenticated() bool {
	return c.authToken != nil && c.currentUser != nil
}

// CurrentUser returns the currently authenticated user
func (c *Client) CurrentUser() *types.User {
	return c.currentUser
}

// AuthToken returns the current authentication token
func (c *Client) AuthToken() *types.AuthToken {
	return c.authToken
}

// IsReady returns true if the SDK is properly configured
func (c *Client) IsReady() bool {
	return c.config.Validate() == nil
}

// GetConfig returns the current configuration
func (c *Client) GetConfig() *Config {
	return c.config
}

// UpdateConfig updates the client configuration
func (c *Client) UpdateConfig(config *Config) {
	c.config = config
	c.httpClient = NewHTTPClient(config)
	c.wsClient = NewWebSocketClient(config)
	
	// Update services with new clients
	c.Proof = services.NewProofService(c.httpClient, config)
	c.Verification = services.NewVerificationService(c.httpClient, config)
	c.Wallet = services.NewWalletService(c.httpClient, c.wsClient, config)
}

// Authenticate authenticates with email and password
func (c *Client) Authenticate(ctx context.Context, email, password string) (*types.AuthToken, error) {
	req := &types.LoginRequest{
		Email:    email,
		Password: password,
	}
	
	var resp types.LoginResponse
	err := c.httpClient.Post(ctx, "/auth/login", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("authentication failed: %s", resp.Error)
	}
	
	c.authToken = &resp.Data
	c.httpClient.SetAuthToken(c.authToken.AccessToken)
	
	// Get current user info
	err = c.getCurrentUser(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	
	if c.config.LoggingEnabled {
		log.Printf("Successfully authenticated user: %s", email)
	}
	
	return c.authToken, nil
}

// Register registers a new user account
func (c *Client) Register(ctx context.Context, email, password, username string) (*types.AuthToken, error) {
	req := &types.RegisterRequest{
		Email:    email,
		Password: password,
		Username: username,
	}
	
	var resp types.RegisterResponse
	err := c.httpClient.Post(ctx, "/auth/register", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("registration failed: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("registration failed: %s", resp.Error)
	}
	
	c.authToken = &resp.Data
	c.httpClient.SetAuthToken(c.authToken.AccessToken)
	
	// Get current user info
	err = c.getCurrentUser(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	
	if c.config.LoggingEnabled {
		log.Printf("Successfully registered user: %s", email)
	}
	
	return c.authToken, nil
}

// Logout logs out the current user
func (c *Client) Logout(ctx context.Context) error {
	if c.authToken != nil {
		err := c.httpClient.Post(ctx, "/auth/logout", nil, nil)
		if err != nil && c.config.LoggingEnabled {
			log.Printf("Logout request failed: %v", err)
		}
	}
	
	c.authToken = nil
	c.currentUser = nil
	c.httpClient.SetAuthToken("")
	
	if c.config.LoggingEnabled {
		log.Println("User logged out")
	}
	
	return nil
}

// RefreshToken refreshes the authentication token
func (c *Client) RefreshToken(ctx context.Context) (*types.AuthToken, error) {
	if c.authToken == nil || c.authToken.RefreshToken == "" {
		return nil, fmt.Errorf("no refresh token available")
	}
	
	req := &types.RefreshTokenRequest{
		RefreshToken: c.authToken.RefreshToken,
	}
	
	var resp types.RefreshTokenResponse
	err := c.httpClient.Post(ctx, "/auth/refresh", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("token refresh failed: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("token refresh failed: %s", resp.Error)
	}
	
	c.authToken = &resp.Data
	c.httpClient.SetAuthToken(c.authToken.AccessToken)
	
	if c.config.LoggingEnabled {
		log.Println("Token refreshed successfully")
	}
	
	return c.authToken, nil
}

// SubscribeToUpdates subscribes to real-time updates
func (c *Client) SubscribeToUpdates(ctx context.Context, filters map[string]interface{}) (*WebSocketSubscription, error) {
	if !c.IsAuthenticated() {
		return nil, fmt.Errorf("must be authenticated to subscribe to updates")
	}
	
	return c.wsClient.Subscribe(ctx, filters)
}

// getCurrentUser retrieves the current user information
func (c *Client) getCurrentUser(ctx context.Context) error {
	var resp types.UserResponse
	err := c.httpClient.Get(ctx, "/auth/me", &resp)
	if err != nil {
		return fmt.Errorf("failed to get current user: %w", err)
	}
	
	if !resp.Success {
		return fmt.Errorf("failed to get current user: %s", resp.Error)
	}
	
	c.currentUser = &resp.Data
	return nil
}

// Close closes the client and cleans up resources
func (c *Client) Close() error {
	var errs []error
	
	if c.httpClient != nil {
		if err := c.httpClient.Close(); err != nil {
			errs = append(errs, fmt.Errorf("HTTP client close error: %w", err))
		}
	}
	
	if c.wsClient != nil {
		if err := c.wsClient.Close(); err != nil {
			errs = append(errs, fmt.Errorf("WebSocket client close error: %w", err))
		}
	}
	
	if len(errs) > 0 {
		return fmt.Errorf("close errors: %v", errs)
	}
	
	return nil
}

// Version returns the SDK version
func Version() string {
	return "1.0.0"
}
