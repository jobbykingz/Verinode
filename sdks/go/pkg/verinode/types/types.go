package types

import (
	"time"
)

// NetworkType represents the network type
type NetworkType string

const (
	NetworkMainnet NetworkType = "mainnet"
	NetworkTestnet NetworkType = "testnet"
)

// ProofStatus represents the status of a proof
type ProofStatus string

const (
	ProofStatusPending  ProofStatus = "pending"
	ProofStatusVerified ProofStatus = "verified"
	ProofStatusRejected ProofStatus = "rejected"
	ProofStatusExpired  ProofStatus = "expired"
)

// VerificationStatus represents the status of a verification
type VerificationStatus string

const (
	VerificationStatusPending  VerificationStatus = "pending"
	VerificationStatusApproved VerificationStatus = "approved"
	VerificationStatusRejected VerificationStatus = "rejected"
	VerificationStatusExpired  VerificationStatus = "expired"
)

// WalletType represents the wallet provider type
type WalletType string

const (
	WalletTypeStellar  WalletType = "stellar"
	WalletTypeAlbedo   WalletType = "albedo"
	WalletTypeFreighter WalletType = "freighter"
	WalletTypeXbull    WalletType = "xbull"
)

// User represents a user account
type User struct {
	ID        string                 `json:"id"`
	Email     string                 `json:"email"`
	Username  *string                `json:"username,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
	IsActive  bool                   `json:"is_active"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Wallet represents a blockchain wallet
type Wallet struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"user_id"`
	PublicKey    string                 `json:"public_key"`
	WalletType   WalletType             `json:"wallet_type"`
	Network      NetworkType            `json:"network"`
	IsConnected  bool                   `json:"is_connected"`
	Balance      *string                `json:"balance,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// Proof represents a cryptographic proof
type Proof struct {
	ID               string                 `json:"id"`
	UserID           string                 `json:"user_id"`
	Title            string                 `json:"title"`
	Description      *string                `json:"description,omitempty"`
	Status           ProofStatus            `json:"status"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	Attachments      []string               `json:"attachments,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	ExpiresAt        *time.Time             `json:"expires_at,omitempty"`
	VerificationCount int                    `json:"verification_count"`
	Tags             []string               `json:"tags,omitempty"`
}

// Verification represents a proof verification
type Verification struct {
	ID          string                 `json:"id"`
	ProofID     string                 `json:"proof_id"`
	VerifierID  string                 `json:"verifier_id"`
	Status      VerificationStatus     `json:"status"`
	Comment     *string                `json:"comment,omitempty"`
	Evidence    map[string]interface{} `json:"evidence,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Subscription represents a real-time subscription
type Subscription struct {
	ID            string                 `json:"id"`
	UserID        string                 `json:"user_id"`
	SubscriptionType string              `json:"subscription_type"`
	IsActive      bool                   `json:"is_active"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	Filters       map[string]interface{} `json:"filters,omitempty"`
}

// APIResponse represents a generic API response
type APIResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     *string     `json:"error,omitempty"`
	Message   *string     `json:"message,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	Items      []interface{} `json:"items"`
	TotalCount int           `json:"total_count"`
	Page       int           `json:"page"`
	PageSize   int           `json:"page_size"`
	HasNext    bool          `json:"has_next"`
	HasPrev    bool          `json:"has_prev"`
}

// AuthToken represents an authentication token
type AuthToken struct {
	AccessToken  string  `json:"access_token"`
	RefreshToken *string `json:"refresh_token,omitempty"`
	TokenType    string  `json:"token_type"`
	ExpiresIn    *int    `json:"expires_in,omitempty"`
	Scope        *string `json:"scope,omitempty"`
}

// ProofCreateRequest represents a request to create a proof
type ProofCreateRequest struct {
	Title       string                 `json:"title"`
	Description *string                `json:"description,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Attachments []string               `json:"attachments,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
	ExpiresAt   *time.Time             `json:"expires_at,omitempty"`
}

// ProofUpdateRequest represents a request to update a proof
type ProofUpdateRequest struct {
	Title       *string                `json:"title,omitempty"`
	Description *string                `json:"description,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Attachments []string               `json:"attachments,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
	ExpiresAt   *time.Time             `json:"expires_at,omitempty"`
}

// VerificationCreateRequest represents a request to create a verification
type VerificationCreateRequest struct {
	ProofID   string                 `json:"proof_id"`
	Status    VerificationStatus     `json:"status"`
	Comment   *string                `json:"comment,omitempty"`
	Evidence  map[string]interface{} `json:"evidence,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// WalletConnectRequest represents a request to connect a wallet
type WalletConnectRequest struct {
	WalletType WalletType  `json:"wallet_type"`
	PublicKey  *string     `json:"public_key,omitempty"`
	Network    NetworkType `json:"network"`
}

// SubscriptionCreateRequest represents a request to create a subscription
type SubscriptionCreateRequest struct {
	SubscriptionType string                 `json:"subscription_type"`
	Filters          map[string]interface{} `json:"filters,omitempty"`
}

// QueryFilter represents a query filter
type QueryFilter struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, gte, lt, lte, in, nin, contains
	Value    interface{} `json:"value"`
}

// QueryOptions represents query options
type QueryOptions struct {
	Filters      []QueryFilter         `json:"filters,omitempty"`
	Sort         map[string]int        `json:"sort,omitempty"`      // field: 1 (asc) or -1 (desc)
	Page         int                   `json:"page"`
	PageSize     int                   `json:"page_size"`
	IncludeTotal bool                  `json:"include_total"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	APIResponse
	Data AuthToken `json:"data"`
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Username *string `json:"username,omitempty"`
}

// RegisterResponse represents a registration response
type RegisterResponse struct {
	APIResponse
	Data AuthToken `json:"data"`
}

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// RefreshTokenResponse represents a refresh token response
type RefreshTokenResponse struct {
	APIResponse
	Data AuthToken `json:"data"`
}

// UserResponse represents a user response
type UserResponse struct {
	APIResponse
	Data User `json:"data"`
}

// ProofResponse represents a proof response
type ProofResponse struct {
	APIResponse
	Data Proof `json:"data"`
}

// ProofsResponse represents a proofs list response
type ProofsResponse struct {
	APIResponse
	Data PaginatedResponse `json:"data"`
}

// VerificationResponse represents a verification response
type VerificationResponse struct {
	APIResponse
	Data Verification `json:"data"`
}

// VerificationsResponse represents a verifications list response
type VerificationsResponse struct {
	APIResponse
	Data PaginatedResponse `json:"data"`
}

// WalletResponse represents a wallet response
type WalletResponse struct {
	APIResponse
	Data Wallet `json:"data"`
}

// WalletsResponse represents a wallets list response
type WalletsResponse struct {
	APIResponse
	Data []Wallet `json:"data"`
}

// BalanceResponse represents a balance response
type BalanceResponse struct {
	APIResponse
	Data struct {
		Balance string `json:"balance"`
	} `json:"data"`
}

// TransactionRequest represents a transaction request
type TransactionRequest struct {
	ToAddress string  `json:"to_address"`
	Amount    string  `json:"amount"`
	Memo      *string `json:"memo,omitempty"`
}

// TransactionResponse represents a transaction response
type TransactionResponse struct {
	APIResponse
	Data map[string]interface{} `json:"data"`
}

// SignMessageRequest represents a sign message request
type SignMessageRequest struct {
	Message string `json:"message"`
}

// SignMessageResponse represents a sign message response
type SignMessageResponse struct {
	APIResponse
	Data struct {
		Signature string `json:"signature"`
	} `json:"data"`
}

// VerifyMessageRequest represents a verify message request
type VerifyMessageRequest struct {
	PublicKey string `json:"public_key"`
	Message   string `json:"message"`
	Signature string `json:"signature"`
}

// VerifyMessageResponse represents a verify message response
type VerifyMessageResponse struct {
	APIResponse
	Data struct {
		Valid bool `json:"valid"`
	} `json:"data"`
}

// TransactionsResponse represents a transaction history response
type TransactionsResponse struct {
	APIResponse
	Data []map[string]interface{} `json:"data"`
}

// StatisticsResponse represents a statistics response
type StatisticsResponse struct {
	APIResponse
	Data map[string]interface{} `json:"data"`
}

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type string                 `json:"type"`
	ID   string                 `json:"id,omitempty"`
	Data map[string]interface{} `json:"data,omitempty"`
}

// SubscriptionUpdate represents a subscription update message
type SubscriptionUpdate struct {
	WebSocketMessage
	SubscriptionID string `json:"subscription_id"`
}

// SubscriptionConfirmed represents a subscription confirmation
type SubscriptionConfirmed struct {
	WebSocketMessage
	SubscriptionID string `json:"subscription_id"`
}

// SubscriptionError represents a subscription error
type SubscriptionError struct {
	WebSocketMessage
	SubscriptionID string `json:"subscription_id"`
	Error         string `json:"error"`
}
