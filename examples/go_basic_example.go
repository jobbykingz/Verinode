package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Great-2025/verinode-go/pkg/verinode"
	"github.com/Great-2025/verinode-go/pkg/verinode/types"
)

func main() {
	fmt.Println("🚀 Starting Verinode Go SDK Example")
	fmt.Println("=" + string(make([]byte, 49)))

	// Initialize SDK with configuration
	config := &verinode.Config{
		APIEndpoint:       "https://api.verinode.com",
		Network:          verinode.NetworkTestnet,
		Timeout:          10 * time.Second,
		MaxRetries:       3,
		RetryDelay:       1 * time.Second,
		BackoffMultiplier: 2.0,
		LoggingEnabled:   true,
		LogLevel:         "INFO",
	}

	client := verinode.NewClient(config)
	defer client.Close()

	ctx := context.Background()

	// Check if SDK is ready
	if !client.IsReady() {
		fmt.Println("❌ SDK configuration is invalid")
		return
	}

	fmt.Println("✅ SDK initialized successfully")

	// Example 1: Authentication
	fmt.Println("\n🔐 Authenticating...")
	err := authenticateExample(ctx, client)
	if err != nil {
		fmt.Printf("⚠️  Authentication failed (expected in demo): %v\n", err)
		fmt.Println("Continuing with unauthenticated operations...")
	}

	// Example 2: Create a proof
	fmt.Println("\n📄 Creating a proof...")
	proofID, err := createProofExample(ctx, client)
	if err != nil {
		fmt.Printf("⚠️  Proof creation failed: %v\n", err)
		proofID = "demo-proof-id"
	}

	// Example 3: List proofs
	fmt.Println("\n📋 Listing proofs...")
	err = listProofsExample(ctx, client)
	if err != nil {
		fmt.Printf("⚠️  Proof listing failed: %v\n", err)
	}

	// Example 4: Search proofs
	fmt.Println("\n🔍 Searching proofs...")
	err = searchProofsExample(ctx, client)
	if err != nil {
		fmt.Printf("⚠️  Search failed: %v\n", err)
	}

	// Example 5: Wallet operations
	fmt.Println("\n💳 Wallet operations...")
	err = walletExample(ctx, client)
	if err != nil {
		fmt.Printf("⚠️  Wallet operations failed: %v\n", err)
	}

	// Example 6: Verification operations
	fmt.Println("\n✅ Verification operations...")
	err = verificationExample(ctx, client, proofID)
	if err != nil {
		fmt.Printf("⚠️  Verification operations failed: %v\n", err)
	}

	// Example 7: Real-time subscription
	fmt.Println("\n📡 Setting up real-time subscription...")
	err = subscriptionExample(ctx, client)
	if err != nil {
		fmt.Printf("⚠️  Subscription setup failed: %v\n", err)
	}

	fmt.Println("\n🎉 Example completed successfully!")
}

func authenticateExample(ctx context.Context, client *verinode.Client) error {
	err := client.Authenticate(ctx, "demo@example.com", "demo-password")
	if err != nil {
		return err
	}

	if client.CurrentUser() != nil {
		fmt.Printf("✅ Authenticated as: %s\n", client.CurrentUser().Email)
	}
	return nil
}

func createProofExample(ctx context.Context, client *verinode.Client) (string, error) {
	proofRequest := &types.ProofCreateRequest{
		Title:       "Example Document Verification",
		Description: stringPtr("This is an example proof created with the Go SDK"),
		Metadata: map[string]interface{}{
			"document_type": "identity",
			"created_by":    "go-sdk-example",
		},
		Tags: []string{"example", "go", "sdk"},
	}

	proof, err := client.Proof.Create(ctx, proofRequest)
	if err != nil {
		return "", err
	}

	fmt.Printf("✅ Proof created with ID: %s\n", proof.ID)
	fmt.Printf("   Title: %s\n", proof.Title)
	fmt.Printf("   Status: %s\n", proof.Status)

	return proof.ID, nil
}

func listProofsExample(ctx context.Context, client *verinode.Client) error {
	proofs, err := client.Proof.List(ctx, &types.ProofStatusPending, nil, nil, &types.QueryOptions{
		Page:     1,
		PageSize: 5,
	})
	if err != nil {
		return err
	}

	fmt.Printf("✅ Found %d proofs\n", len(proofs.Items))
	for _, item := range proofs.Items {
		if proof, ok := item.(types.Proof); ok {
			fmt.Printf("   - %s (%s)\n", proof.Title, proof.Status)
		}
	}

	return nil
}

func searchProofsExample(ctx context.Context, client *verinode.Client) error {
	results, err := client.Proof.Search(ctx, "example", &types.QueryOptions{
		Page:     1,
		PageSize: 10,
	})
	if err != nil {
		return err
	}

	fmt.Printf("✅ Found %d matching proofs\n", len(results.Items))
	return nil
}

func walletExample(ctx context.Context, client *verinode.Client) error {
	// Connect a demo wallet
	walletRequest := &types.WalletConnectRequest{
		WalletType: types.WalletTypeStellar,
		Network:    types.NetworkTestnet,
	}

	wallet, err := client.Wallet.Connect(ctx, walletRequest)
	if err != nil {
		return err
	}

	fmt.Printf("✅ Wallet connected: %s\n", wallet.ID)
	fmt.Printf("   Type: %s\n", wallet.WalletType)
	fmt.Printf("   Network: %s\n", wallet.Network)

	// Get balance
	balance, err := client.Wallet.GetBalance(ctx, wallet.ID)
	if err != nil {
		fmt.Printf("   Balance: Unable to fetch (%v)\n", err)
	} else {
		fmt.Printf("   Balance: %s\n", balance)
	}

	return nil
}

func verificationExample(ctx context.Context, client *verinode.Client, proofID string) error {
	if proofID == "demo-proof-id" {
		fmt.Println("⚠️  Skipping verification - no valid proof ID")
		return nil
	}

	// Create a verification
	verificationRequest := &types.VerificationCreateRequest{
		ProofID: proofID,
		Status:  types.VerificationStatusApproved,
		Comment: stringPtr("Automated verification example"),
		Evidence: map[string]interface{}{
			"method":     "automated",
			"confidence": 0.95,
		},
	}

	verification, err := client.Verification.Create(ctx, verificationRequest)
	if err != nil {
		return err
	}

	fmt.Printf("✅ Verification created: %s\n", verification.ID)

	// Get verification statistics
	stats, err := client.Verification.GetStatistics(ctx, nil, nil)
	if err != nil {
		return err
	}

	fmt.Printf("   Total verifications: %v\n", stats["total"])
	return nil
}

func subscriptionExample(ctx context.Context, client *verinode.Client) error {
	// Subscribe to updates
	subscription, err := client.SubscribeToUpdates(ctx, map[string]interface{}{
		"event_types": []string{"proof_updated", "verification_created"},
	})
	if err != nil {
		return err
	}

	fmt.Printf("✅ Subscription created: %s\n", subscription.ID)

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Handle messages in a goroutine
	go func() {
		for {
			select {
			case message := <-subscription.Messages:
				fmt.Printf("📨 Received update: %s\n", message.Type)
			case <-subscription.Done:
				return
			case <-sigChan:
				fmt.Println("\n👋 Received interrupt signal, shutting down...")
				return
			}
		}
	}()

	// Simulate some time to receive updates
	select {
	case <-time.After(2 * time.Second):
		fmt.Println("✅ Subscription test completed")
	case <-sigChan:
	}

	return nil
}

// Helper function
func stringPtr(s string) *string {
	return &s
}
