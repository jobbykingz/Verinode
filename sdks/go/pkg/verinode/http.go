package verinode

import (
	"github.com/Great-2025/verinode-go/pkg/verinode/internal"
)

// HTTPClient constructor
func NewHTTPClient(config *Config) HTTPClient {
	return internal.NewHTTPClient(config)
}

// WebSocketClient constructor
func NewWebSocketClient(config *Config) WebSocketClient {
	return internal.NewWebSocketClient(config)
}
