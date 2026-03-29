package verinode

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// NetworkType represents the network type
type NetworkType string

const (
	NetworkMainnet NetworkType = "mainnet"
	NetworkTestnet NetworkType = "testnet"
)

// Config holds the configuration for the Verinode client
type Config struct {
	// API configuration
	APIEndpoint string `json:"api_endpoint" yaml:"api_endpoint"`
	Network     NetworkType `json:"network" yaml:"network"`
	APIKey      string `json:"api_key,omitempty" yaml:"api_key,omitempty"`
	
	// Request configuration
	Timeout         time.Duration `json:"timeout" yaml:"timeout"`
	MaxRetries      int           `json:"max_retries" yaml:"max_retries"`
	RetryDelay      time.Duration `json:"retry_delay" yaml:"retry_delay"`
	BackoffMultiplier float64      `json:"backoff_multiplier" yaml:"backoff_multiplier"`
	
	// Wallet configuration
	WalletAutoConnect bool     `json:"wallet_auto_connect" yaml:"wallet_auto_connect"`
	SupportedWallets  []string `json:"supported_wallets" yaml:"supported_wallets"`
	
	// Logging configuration
	LoggingEnabled bool   `json:"logging_enabled" yaml:"logging_enabled"`
	LogLevel       string `json:"log_level" yaml:"log_level"`
}

// DefaultConfig returns a default configuration
func DefaultConfig() *Config {
	return &Config{
		APIEndpoint:       "https://api.verinode.com",
		Network:          NetworkMainnet,
		Timeout:          10 * time.Second,
		MaxRetries:       3,
		RetryDelay:       1 * time.Second,
		BackoffMultiplier: 2.0,
		WalletAutoConnect: false,
		SupportedWallets:  []string{"stellar", "albedo", "freighter"},
		LoggingEnabled:   false,
		LogLevel:         "INFO",
	}
}

// ConfigFromEnv creates configuration from environment variables
func ConfigFromEnv() *Config {
	config := DefaultConfig()
	
	if endpoint := os.Getenv("VERINODE_API_ENDPOINT"); endpoint != "" {
		config.APIEndpoint = endpoint
	}
	
	if network := os.Getenv("VERINODE_NETWORK"); network != "" {
		config.Network = NetworkType(network)
	}
	
	if apiKey := os.Getenv("VERINODE_API_KEY"); apiKey != "" {
		config.APIKey = apiKey
	}
	
	if timeout := os.Getenv("VERINODE_TIMEOUT"); timeout != "" {
		if ms, err := strconv.Atoi(timeout); err == nil {
			config.Timeout = time.Duration(ms) * time.Millisecond
		}
	}
	
	if maxRetries := os.Getenv("VERINODE_MAX_RETRIES"); maxRetries != "" {
		if retries, err := strconv.Atoi(maxRetries); err == nil {
			config.MaxRetries = retries
		}
	}
	
	if retryDelay := os.Getenv("VERINODE_RETRY_DELAY"); retryDelay != "" {
		if ms, err := strconv.Atoi(retryDelay); err == nil {
			config.RetryDelay = time.Duration(ms) * time.Millisecond
		}
	}
	
	if backoff := os.Getenv("VERINODE_BACKOFF_MULTIPLIER"); backoff != "" {
		if mult, err := strconv.ParseFloat(backoff, 64); err == nil {
			config.BackoffMultiplier = mult
		}
	}
	
	if autoConnect := os.Getenv("VERINODE_WALLET_AUTO_CONNECT"); autoConnect != "" {
		if enabled, err := strconv.ParseBool(autoConnect); err == nil {
			config.WalletAutoConnect = enabled
		}
	}
	
	if logging := os.Getenv("VERINODE_LOGGING_ENABLED"); logging != "" {
		if enabled, err := strconv.ParseBool(logging); err == nil {
			config.LoggingEnabled = enabled
		}
	}
	
	if logLevel := os.Getenv("VERINODE_LOG_LEVEL"); logLevel != "" {
		config.LogLevel = logLevel
	}
	
	return config
}

// ConfigFromFile creates configuration from a YAML file
func ConfigFromFile(filename string) (*Config, error) {
	config := DefaultConfig()
	
	// Implementation would use yaml.Unmarshal here
	// For now, return default config
	return config, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.APIEndpoint == "" {
		return fmt.Errorf("API endpoint is required")
	}
	
	if c.Network != NetworkMainnet && c.Network != NetworkTestnet {
		return fmt.Errorf("network must be either 'mainnet' or 'testnet'")
	}
	
	if c.Timeout <= 0 {
		return fmt.Errorf("timeout must be positive")
	}
	
	if c.MaxRetries < 0 {
		return fmt.Errorf("max retries must be non-negative")
	}
	
	if c.RetryDelay <= 0 {
		return fmt.Errorf("retry delay must be positive")
	}
	
	if c.BackoffMultiplier <= 1.0 {
		return fmt.Errorf("backoff multiplier must be greater than 1.0")
	}
	
	return nil
}

// ToMap returns the configuration as a map
func (c *Config) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"api_endpoint":        c.APIEndpoint,
		"network":            string(c.Network),
		"api_key":            c.APIKey,
		"timeout":            c.Timeout.Milliseconds(),
		"max_retries":        c.MaxRetries,
		"retry_delay":        c.RetryDelay.Milliseconds(),
		"backoff_multiplier": c.BackoffMultiplier,
		"wallet_auto_connect": c.WalletAutoConnect,
		"supported_wallets":  c.SupportedWallets,
		"logging_enabled":    c.LoggingEnabled,
		"log_level":          c.LogLevel,
	}
}

// Update updates the configuration with new values
func (c *Config) Update(updates map[string]interface{}) error {
	for key, value := range updates {
		switch key {
		case "api_endpoint":
			if str, ok := value.(string); ok {
				c.APIEndpoint = str
			}
		case "network":
			if str, ok := value.(string); ok {
				c.Network = NetworkType(str)
			}
		case "api_key":
			if str, ok := value.(string); ok {
				c.APIKey = str
			}
		case "timeout":
			if ms, ok := value.(int); ok {
				c.Timeout = time.Duration(ms) * time.Millisecond
			}
		case "max_retries":
			if retries, ok := value.(int); ok {
				c.MaxRetries = retries
			}
		case "retry_delay":
			if ms, ok := value.(int); ok {
				c.RetryDelay = time.Duration(ms) * time.Millisecond
			}
		case "backoff_multiplier":
			if mult, ok := value.(float64); ok {
				c.BackoffMultiplier = mult
			}
		case "wallet_auto_connect":
			if enabled, ok := value.(bool); ok {
				c.WalletAutoConnect = enabled
			}
		case "supported_wallets":
			if wallets, ok := value.([]string); ok {
				c.SupportedWallets = wallets
			}
		case "logging_enabled":
			if enabled, ok := value.(bool); ok {
				c.LoggingEnabled = enabled
			}
		case "log_level":
			if level, ok := value.(string); ok {
				c.LogLevel = level
			}
		}
	}
	
	return c.Validate()
}
