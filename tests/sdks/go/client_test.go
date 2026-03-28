package tests

import (
	"context"
	"testing"
	"time"

	"github.com/Great-2025/verinode-go/pkg/verinode"
	"github.com/Great-2025/verinode-go/pkg/verinode/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockHTTPClient is a mock implementation of HTTPClient for testing
type MockHTTPClient struct {
	mock.Mock
}

func (m *MockHTTPClient) Get(ctx context.Context, endpoint string, response interface{}, params ...string) error {
	args := m.Called(ctx, endpoint, response, params)
	return args.Error(0)
}

func (m *MockHTTPClient) Post(ctx context.Context, endpoint string, request interface{}, response interface{}) error {
	args := m.Called(ctx, endpoint, request, response)
	return args.Error(0)
}

func (m *MockHTTPClient) Patch(ctx context.Context, endpoint string, request interface{}, response interface{}) error {
	args := m.Called(ctx, endpoint, request, response)
	return args.Error(0)
}

func (m *MockHTTPClient) Put(ctx context.Context, endpoint string, request interface{}, response interface{}) error {
	args := m.Called(ctx, endpoint, request, response)
	return args.Error(0)
}

func (m *MockHTTPClient) Delete(ctx context.Context, endpoint string, response interface{}) error {
	args := m.Called(ctx, endpoint, response)
	return args.Error(0)
}

func (m *MockHTTPClient) SetAuthToken(token string) {
	m.Called(token)
}

func (m *MockHTTPClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

// MockWebSocketClient is a mock implementation of WebSocketClient for testing
type MockWebSocketClient struct {
	mock.Mock
}

func (m *MockWebSocketClient) Connect(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockWebSocketClient) Disconnect(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockWebSocketClient) Subscribe(ctx context.Context, filters map[string]interface{}) (*verinode.WebSocketSubscription, error) {
	args := m.Called(ctx, filters)
	return args.Get(0).(*verinode.WebSocketSubscription), args.Error(1)
}

func (m *MockWebSocketClient) SendMessage(message interface{}) error {
	args := m.Called(message)
	return args.Error(0)
}

func (m *MockWebSocketClient) IsConnected() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockWebSocketClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

func TestNewClient(t *testing.T) {
	config := &verinode.Config{
		APIEndpoint: "https://test.api.com",
		Network:     verinode.NetworkTestnet,
	}

	client := verinode.NewClient(config)

	assert.NotNil(t, client)
	assert.Equal(t, "https://test.api.com", client.GetConfig().GetAPIEndpoint())
	assert.Equal(t, verinode.NetworkTestnet, client.GetConfig().GetNetwork())
	assert.False(t, client.IsAuthenticated())
}

func TestNewClientWithDefaults(t *testing.T) {
	client := verinode.NewClientWithDefaults()

	assert.NotNil(t, client)
	assert.Equal(t, "https://api.verinode.com", client.GetConfig().GetAPIEndpoint())
	assert.Equal(t, verinode.NetworkMainnet, client.GetConfig().GetNetwork())
	assert.True(t, client.IsReady())
}

func TestClientIsReady(t *testing.T) {
	tests := []struct {
		name     string
		config   *verinode.Config
		expected bool
	}{
		{
			name:     "valid config",
			config:   &verinode.Config{APIEndpoint: "https://api.verinode.com"},
			expected: true,
		},
		{
			name:     "empty endpoint",
			config:   &verinode.Config{APIEndpoint: ""},
			expected: false,
		},
		{
			name:     "invalid network",
			config:   &verinode.Config{APIEndpoint: "https://api.verinode.com", Network: "invalid"},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := verinode.NewClient(tt.config)
			assert.Equal(t, tt.expected, client.IsReady())
		})
	}
}

func TestClientAuthenticate(t *testing.T) {
	mockHTTP := &MockHTTPClient{}
	mockWS := &MockWebSocketClient{}

	config := &verinode.Config{
		APIEndpoint: "https://test.api.com",
		Network:     verinode.NetworkTestnet,
	}

	client := &verinode.Client{
		Config:        config,
		HttpClient:    mockHTTP,
		WebSocketClient: mockWS,
	}

	// Mock successful authentication response
	authResponse := &types.LoginResponse{
		APIResponse: types.APIResponse{
			Success: true,
			Data: &types.AuthToken{
				AccessToken: "test_token",
				TokenType:   "Bearer",
			},
		},
	}

	userResponse := &types.UserResponse{
		APIResponse: types.APIResponse{
			Success: true,
			Data: &types.User{
				ID:    "user_123",
				Email: "test@example.com",
			},
		},
	}

	mockHTTP.On("Post", mock.Anything, "/auth/login", mock.AnythingOfType("*types.LoginRequest"), mock.AnythingOfType("*types.LoginResponse")).Return(nil).Run(func(args mock.Arguments) {
		response := args.Get(3).(*types.LoginResponse)
		*response = *authResponse
	})

	mockHTTP.On("Get", mock.Anything, "/auth/me", mock.AnythingOfType("*types.UserResponse")).Return(nil).Run(func(args mock.Arguments) {
		response := args.Get(2).(*types.UserResponse)
		*response = *userResponse
	})

	mockHTTP.On("SetAuthToken", "test_token").Return()

	ctx := context.Background()
	token, err := client.Authenticate(ctx, "test@example.com", "password")

	require.NoError(t, err)
	assert.Equal(t, "test_token", token.AccessToken)
	assert.True(t, client.IsAuthenticated())
	assert.Equal(t, "test@example.com", client.CurrentUser().Email)

	mockHTTP.AssertExpectations(t)
}

func TestClientAuthenticateFailure(t *testing.T) {
	mockHTTP := &MockHTTPClient{}
	mockWS := &MockWebSocketClient{}

	config := &verinode.Config{
		APIEndpoint: "https://test.api.com",
		Network:     verinode.NetworkTestnet,
	}

	client := &verinode.Client{
		Config:         config,
		HttpClient:     mockHTTP,
		WebSocketClient: mockWS,
	}

	// Mock failed authentication response
	authResponse := &types.LoginResponse{
		APIResponse: types.APIResponse{
			Success: false,
			Error:   stringPtr("Invalid credentials"),
		},
	}

	mockHTTP.On("Post", mock.Anything, "/auth/login", mock.AnythingOfType("*types.LoginRequest"), mock.AnythingOfType("*types.LoginResponse")).Return(nil).Run(func(args mock.Arguments) {
		response := args.Get(3).(*types.LoginResponse)
		*response = *authResponse
	})

	ctx := context.Background()
	_, err := client.Authenticate(ctx, "test@example.com", "wrong_password")

	require.Error(t, err)
	assert.False(t, client.IsAuthenticated())

	mockHTTP.AssertExpectations(t)
}

func TestClientRegister(t *testing.T) {
	mockHTTP := &MockHTTPClient{}
	mockWS := &MockWebSocketClient{}

	config := &verinode.Config{
		APIEndpoint: "https://test.api.com",
		Network:     verinode.NetworkTestnet,
	}

	client := &verinode.Client{
		Config:         config,
		HttpClient:     mockHTTP,
		WebSocketClient: mockWS,
	}

	// Mock successful registration response
	registerResponse := &types.RegisterResponse{
		APIResponse: types.APIResponse{
			Success: true,
			Data: &types.AuthToken{
				AccessToken: "new_token",
				TokenType:   "Bearer",
			},
		},
	}

	userResponse := &types.UserResponse{
		APIResponse: types.APIResponse{
			Success: true,
			Data: &types.User{
				ID:    "user_456",
				Email: "newuser@example.com",
			},
		},
	}

	mockHTTP.On("Post", mock.Anything, "/auth/register", mock.AnythingOfType("*types.RegisterRequest"), mock.AnythingOfType("*types.RegisterResponse")).Return(nil).Run(func(args mock.Arguments) {
		response := args.Get(3).(*types.RegisterResponse)
		*response = *registerResponse
	})

	mockHTTP.On("Get", mock.Anything, "/auth/me", mock.AnythingOfType("*types.UserResponse")).Return(nil).Run(func(args mock.Arguments) {
		response := args.Get(2).(*types.UserResponse)
		*response = *userResponse
	})

	mockHTTP.On("SetAuthToken", "new_token").Return()

	ctx := context.Background()
	token, err := client.Register(ctx, "newuser@example.com", "password", stringPtr("newuser"))

	require.NoError(t, err)
	assert.Equal(t, "new_token", token.AccessToken)
	assert.True(t, client.IsAuthenticated())
	assert.Equal(t, "newuser@example.com", client.CurrentUser().Email)

	mockHTTP.AssertExpectations(t)
}

func TestClientLogout(t *testing.T) {
	mockHTTP := &MockHTTPClient{}
	mockWS := &MockWebSocketClient{}

	config := &verinode.Config{
		APIEndpoint: "https://test.api.com",
	}

	client := &verinode.Client{
		Config:         config,
		HttpClient:     mockHTTP,
		WebSocketClient: mockWS,
		AuthToken:      &types.AuthToken{AccessToken: "test_token"},
		CurrentUser:    &types.User{ID: "user_123"},
	}

	mockHTTP.On("Post", mock.Anything, "/auth/logout", mock.Anything, mock.Anything).Return(nil)
	mockHTTP.On("SetAuthToken", "").Return()

	ctx := context.Background()
	err := client.Logout(ctx)

	require.NoError(t, err)
	assert.False(t, client.IsAuthenticated())
	assert.Nil(t, client.AuthToken())
	assert.Nil(t, client.CurrentUser())

	mockHTTP.AssertExpectations(t)
}

func TestClientRefreshToken(t *testing.T) {
	mockHTTP := &MockHTTPClient{}
	mockWS := &MockWebSocketClient{}

	config := &verinode.Config{
		APIEndpoint: "https://test.api.com",
	}

	client := &verinode.Client{
		Config:         config,
		HttpClient:     mockHTTP,
		WebSocketClient: mockWS,
		AuthToken: &types.AuthToken{
			AccessToken:  "old_token",
			RefreshToken: stringPtr("refresh_token"),
		},
	}

	// Mock successful token refresh response
	refreshResponse := &types.RefreshTokenResponse{
		APIResponse: types.APIResponse{
			Success: true,
			Data: &types.AuthToken{
				AccessToken:  "new_token",
				RefreshToken: stringPtr("new_refresh_token"),
				TokenType:    "Bearer",
			},
		},
	}

	mockHTTP.On("Post", mock.Anything, "/auth/refresh", mock.AnythingOfType("*types.RefreshTokenRequest"), mock.AnythingOfType("*types.RefreshTokenResponse")).Return(nil).Run(func(args mock.Arguments) {
		response := args.Get(3).(*types.RefreshTokenResponse)
		*response = *refreshResponse
	})

	mockHTTP.On("SetAuthToken", "new_token").Return()

	ctx := context.Background()
	newToken, err := client.RefreshToken(ctx)

	require.NoError(t, err)
	assert.Equal(t, "new_token", newToken.AccessToken)
	assert.Equal(t, "new_token", client.AuthToken().AccessToken)

	mockHTTP.AssertExpectations(t)
}

func TestClientRefreshTokenNoRefreshToken(t *testing.T) {
	config := &verinode.Config{
		APIEndpoint: "https://test.api.com",
	}

	client := &verinode.Client{
		Config:     config,
		AuthToken: &types.AuthToken{
			AccessToken: "old_token",
			// No refresh token
		},
	}

	ctx := context.Background()
	_, err := client.RefreshToken(ctx)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "No refresh token available")
}

// Helper function
func stringPtr(s string) *string {
	return &s
}

// Benchmark tests
func BenchmarkNewClient(b *testing.B) {
	config := &verinode.Config{
		APIEndpoint: "https://api.verinode.com",
		Network:     verinode.NetworkMainnet,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		client := verinode.NewClient(config)
		_ = client.IsReady()
	}
}

func BenchmarkClientIsReady(b *testing.B) {
	client := verinode.NewClientWithDefaults()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.IsReady()
	}
}
