package services

import (
	"context"
	"fmt"
	"log"

	"github.com/Great-2025/verinode-go/pkg/verinode/types"
)

// WalletService handles wallet-related operations
type WalletService struct {
	httpClient HTTPClient
	wsClient   WebSocketClient
	config     ConfigProvider
}

// NewWalletService creates a new wallet service
func NewWalletService(httpClient HTTPClient, wsClient WebSocketClient, config ConfigProvider) *WalletService {
	return &WalletService{
		httpClient: httpClient,
		wsClient:   wsClient,
		config:     config,
	}
}

// Connect connects a wallet
func (s *WalletService) Connect(ctx context.Context, req *types.WalletConnectRequest) (*types.Wallet, error) {
	var resp types.WalletResponse
	err := s.httpClient.Post(ctx, "/wallets/connect", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to connect wallet: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to connect wallet: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Connected wallet: %s (%s)", resp.Data.ID, resp.Data.WalletType)
	}
	
	return &resp.Data, nil
}

// Disconnect disconnects a wallet
func (s *WalletService) Disconnect(ctx context.Context, walletID string) error {
	var resp types.APIResponse
	err := s.httpClient.Post(ctx, fmt.Sprintf("/wallets/%s/disconnect", walletID), nil, &resp)
	if err != nil {
		return fmt.Errorf("failed to disconnect wallet %s: %w", walletID, err)
	}
	
	if !resp.Success {
		return fmt.Errorf("failed to disconnect wallet: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Disconnected wallet: %s", walletID)
	}
	
	return nil
}

// Get retrieves wallet information
func (s *WalletService) Get(ctx context.Context, walletID string) (*types.Wallet, error) {
	var resp types.WalletResponse
	err := s.httpClient.Get(ctx, fmt.Sprintf("/wallets/%s", walletID), &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet %s: %w", walletID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("wallet not found: %s", safeString(resp.Error))
	}
	
	return &resp.Data, nil
}

// List lists wallets with optional filtering
func (s *WalletService) List(ctx context.Context, userID *string) ([]types.Wallet, error) {
	params := make(map[string]string)
	if userID != nil {
		params["user_id"] = *userID
	}
	
	var resp types.WalletsResponse
	err := s.httpClient.Get(ctx, "/wallets", &resp, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to list wallets: %w", err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to list wallets: %s", safeString(resp.Error))
	}
	
	return resp.Data, nil
}

// GetBalance retrieves wallet balance
func (s *WalletService) GetBalance(ctx context.Context, walletID string) (string, error) {
	var resp types.BalanceResponse
	err := s.httpClient.Get(ctx, fmt.Sprintf("/wallets/%s/balance", walletID), &resp)
	if err != nil {
		return "", fmt.Errorf("failed to get wallet balance %s: %w", walletID, err)
	}
	
	if !resp.Success {
		return "", fmt.Errorf("failed to get wallet balance: %s", safeString(resp.Error))
	}
	
	return resp.Data.Balance, nil
}

// SendTransaction sends a transaction from a wallet
func (s *WalletService) SendTransaction(ctx context.Context, walletID, toAddress, amount string, memo *string) (map[string]interface{}, error) {
	req := types.TransactionRequest{
		ToAddress: toAddress,
		Amount:    amount,
		Memo:      memo,
	}
	
	var resp types.TransactionResponse
	err := s.httpClient.Post(ctx, fmt.Sprintf("/wallets/%s/send", walletID), req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction from wallet %s: %w", walletID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to send transaction: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Transaction sent from wallet %s", walletID)
	}
	
	return resp.Data, nil
}

// SignMessage signs a message with a wallet
func (s *WalletService) SignMessage(ctx context.Context, walletID, message string) (string, error) {
	req := types.SignMessageRequest{
		Message: message,
	}
	
	var resp types.SignMessageResponse
	err := s.httpClient.Post(ctx, fmt.Sprintf("/wallets/%s/sign", walletID), req, &resp)
	if err != nil {
		return "", fmt.Errorf("failed to sign message with wallet %s: %w", walletID, err)
	}
	
	if !resp.Success {
		return "", fmt.Errorf("failed to sign message: %s", safeString(resp.Error))
	}
	
	return resp.Data.Signature, nil
}

// VerifyMessage verifies a message signature
func (s *WalletService) VerifyMessage(ctx context.Context, publicKey, message, signature string) (bool, error) {
	req := types.VerifyMessageRequest{
		PublicKey: publicKey,
		Message:   message,
		Signature: signature,
	}
	
	var resp types.VerifyMessageResponse
	err := s.httpClient.Post(ctx, "/wallets/verify", req, &resp)
	if err != nil {
		return false, fmt.Errorf("failed to verify message: %w", err)
	}
	
	if !resp.Success {
		return false, fmt.Errorf("failed to verify message: %s", safeString(resp.Error))
	}
	
	return resp.Data.Valid, nil
}

// SubscribeToWalletEvents subscribes to real-time wallet events
func (s *WalletService) SubscribeToWalletEvents(ctx context.Context, walletID string) (*WebSocketSubscription, error) {
	if s.wsClient == nil {
		return nil, fmt.Errorf("WebSocket client not available")
	}
	
	filters := map[string]interface{}{
		"wallet_id": walletID,
	}
	
	return s.wsClient.Subscribe(ctx, filters)
}

// SwitchNetwork switches wallet network
func (s *WalletService) SwitchNetwork(ctx context.Context, walletID string, network types.NetworkType) (*types.Wallet, error) {
	req := map[string]interface{}{
		"network": string(network),
	}
	
	var resp types.WalletResponse
	err := s.httpClient.Post(ctx, fmt.Sprintf("/wallets/%s/switch-network", walletID), req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to switch network for wallet %s: %w", walletID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to switch network: %s", safeString(resp.Error))
	}
	
	if s.config.IsLoggingEnabled() {
		log.Printf("Switched wallet %s to %s", walletID, network)
	}
	
	return &resp.Data, nil
}

// GetTransactionHistory retrieves transaction history for a wallet
func (s *WalletService) GetTransactionHistory(ctx context.Context, walletID string, limit, offset int) ([]map[string]interface{}, error) {
	params := map[string]string{
		"limit":  fmt.Sprintf("%d", limit),
		"offset": fmt.Sprintf("%d", offset),
	}
	
	var resp types.TransactionsResponse
	err := s.httpClient.Get(ctx, fmt.Sprintf("/wallets/%s/transactions", walletID), &resp, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction history for wallet %s: %w", walletID, err)
	}
	
	if !resp.Success {
		return nil, fmt.Errorf("failed to get transaction history: %s", safeString(resp.Error))
	}
	
	return resp.Data, nil
}
