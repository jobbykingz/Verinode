package verinode

import (
	"context"

	"github.com/Great-2025/verinode-go/pkg/verinode/types"
)

// HTTPClient interface for HTTP operations
type HTTPClient interface {
	Get(ctx context.Context, endpoint string, response interface{}, params ...string) error
	Post(ctx context.Context, endpoint string, request interface{}, response interface{}) error
	Patch(ctx context.Context, endpoint string, request interface{}, response interface{}) error
	Put(ctx context.Context, endpoint string, request interface{}, response interface{}) error
	Delete(ctx context.Context, endpoint string, response interface{}) error
	SetAuthToken(token string)
	Close() error
}

// WebSocketClient interface for WebSocket operations
type WebSocketClient interface {
	Connect(ctx context.Context) error
	Disconnect(ctx context.Context) error
	Subscribe(ctx context.Context, filters map[string]interface{}) (*WebSocketSubscription, error)
	Unsubscribe(subscriptionID string) error
	SendMessage(message interface{}) error
	IsConnected() bool
	Close() error
}

// ConfigProvider interface for configuration
type ConfigProvider interface {
	GetAPIEndpoint() string
	GetNetwork() string
	GetTimeout() int
	GetMaxRetries() int
	GetRetryDelay() int
	GetBackoffMultiplier() float64
	IsLoggingEnabled() bool
	GetLogLevel() string
}

// WebSocketSubscription represents a WebSocket subscription
type WebSocketSubscription struct {
	ID       string
	Filters  map[string]interface{}
	Messages chan types.WebSocketMessage
	Done     chan struct{}
}

// Helper functions for interfaces
func safeString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
