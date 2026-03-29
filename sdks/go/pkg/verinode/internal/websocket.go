package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/Great-2025/verinode-go/pkg/verinode"
	"github.com/Great-2025/verinode-go/pkg/verinode/types"
)

// WebSocketClient implements the WebSocketClient interface
type WebSocketClient struct {
	config          verinode.ConfigProvider
	conn            *websocket.Conn
	subscriptions   map[string]*verinode.WebSocketSubscription
	mu              sync.RWMutex
	isConnected     bool
	shouldReconnect bool
	reconnectDelay  time.Duration
	done            chan struct{}
}

// NewWebSocketClient creates a new WebSocket client
func NewWebSocketClient(config verinode.ConfigProvider) verinode.WebSocketClient {
	return &WebSocketClient{
		config:          config,
		subscriptions:   make(map[string]*verinode.WebSocketSubscription),
		shouldReconnect: true,
		reconnectDelay:  5 * time.Second,
		done:            make(chan struct{}),
	}
}

// Connect establishes a WebSocket connection
func (c *WebSocketClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if c.isConnected {
		return nil
	}
	
	// Build WebSocket URL
	wsURL, err := url.Parse(c.config.GetAPIEndpoint())
	if err != nil {
		return fmt.Errorf("invalid API endpoint: %w", err)
	}
	
	// Convert HTTP to WebSocket URL
	if wsURL.Scheme == "https" {
		wsURL.Scheme = "wss"
	} else {
		wsURL.Scheme = "ws"
	}
	
	wsURL.Path += "/ws"
	
	// Set headers
	headers := websocket.DefaultDialer.Header
	if headers == nil {
		headers = make(http.Header)
	}
	headers.Set("User-Agent", "verinode-sdk-go/1.0.0")
	
	// Connect
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL.String(), headers)
	if err != nil {
		return verinode.NewNetworkError(fmt.Sprintf("WebSocket connection failed: %v", err))
	}
	
	c.conn = conn
	c.isConnected = true
	
	// Start message handler
	go c.messageHandler()
	
	if c.config.IsLoggingEnabled() {
		log.Println("WebSocket connection established")
	}
	
	return nil
}

// Disconnect closes the WebSocket connection
func (c *WebSocketClient) Disconnect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.shouldReconnect = false
	
	if c.conn != nil {
		err := c.conn.Close()
		c.conn = nil
		if err != nil {
			return fmt.Errorf("failed to close WebSocket connection: %w", err)
		}
	}
	
	c.isConnected = false
	close(c.done)
	
	if c.config.IsLoggingEnabled() {
		log.Println("WebSocket connection closed")
	}
	
	return nil
}

// Subscribe subscribes to real-time updates
func (c *WebSocketClient) Subscribe(ctx context.Context, filters map[string]interface{}) (*verinode.WebSocketSubscription, error) {
	if !c.isConnected {
		if err := c.Connect(ctx); err != nil {
			return nil, err
		}
	}
	
	subscriptionID := fmt.Sprintf("sub_%d", time.Now().UnixNano())
	
	subscription := &verinode.WebSocketSubscription{
		ID:       subscriptionID,
		Filters:  filters,
		Messages: make(chan types.WebSocketMessage, 100),
		Done:     make(chan struct{}),
	}
	
	c.mu.Lock()
	c.subscriptions[subscriptionID] = subscription
	c.mu.Unlock()
	
	// Send subscription message
	subMsg := types.WebSocketMessage{
		Type: "subscribe",
		ID:   subscriptionID,
		Data: filters,
	}
	
	if err := c.SendMessage(subMsg); err != nil {
		c.mu.Lock()
		delete(c.subscriptions, subscriptionID)
		c.mu.Unlock()
		return nil, fmt.Errorf("failed to send subscription message: %w", err)
	}
	
	if c.config.IsLoggingEnabled() {
		log.Printf("Subscribed to updates with ID: %s", subscriptionID)
	}
	
	return subscription, nil
}

// Unsubscribe removes a subscription
func (c *WebSocketClient) Unsubscribe(subscriptionID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if subscription, exists := c.subscriptions[subscriptionID]; exists {
		close(subscription.Done)
		delete(c.subscriptions, subscriptionID)
		
		// Send unsubscribe message
		unsubMsg := types.WebSocketMessage{
			Type: "unsubscribe",
			ID:   subscriptionID,
		}
		
		if c.conn != nil {
			c.conn.WriteJSON(unsubMsg)
		}
		
		if c.config.IsLoggingEnabled() {
			log.Printf("Unsubscribed from updates: %s", subscriptionID)
		}
		
		return true
	}
	
	return false
}

// SendMessage sends a message through the WebSocket
func (c *WebSocketClient) SendMessage(message interface{}) error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	if !c.isConnected || c.conn == nil {
		return verinode.NewNetworkError("WebSocket not connected")
	}
	
	if err := c.conn.WriteJSON(message); err != nil {
		return verinode.NewNetworkError(fmt.Sprintf("failed to send message: %v", err))
	}
	
	return nil
}

// IsConnected returns the connection status
func (c *WebSocketClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.isConnected
}

// Close closes the WebSocket client
func (c *WebSocketClient) Close() error {
	return c.Disconnect(context.Background())
}

// messageHandler handles incoming WebSocket messages
func (c *WebSocketClient) messageHandler() {
	defer func() {
		if r := recover(); r != nil {
			if c.config.IsLoggingEnabled() {
				log.Printf("WebSocket message handler panic: %v", r)
			}
		}
	}()
	
	for {
		select {
		case <-c.done:
			return
		default:
			if !c.isConnected || c.conn == nil {
				time.Sleep(1 * time.Second)
				continue
			}
			
			var message types.WebSocketMessage
			err := c.conn.ReadJSON(&message)
			if err != nil {
				if c.config.IsLoggingEnabled() {
					log.Printf("WebSocket read error: %v", err)
				}
				
				c.handleDisconnect()
				return
			}
			
			c.handleMessage(message)
		}
	}
}

// handleMessage processes incoming messages
func (c *WebSocketClient) handleMessage(message types.WebSocketMessage) {
	switch message.Type {
	case "subscription_update":
		c.mu.RLock()
		if subscription, exists := c.subscriptions[message.ID]; exists {
			select {
			case subscription.Messages <- message:
			default:
				if c.config.IsLoggingEnabled() {
					log.Printf("Subscription channel full for %s", message.ID)
				}
			}
		}
		c.mu.RUnlock()
		
	case "subscription_confirmed":
		if c.config.IsLoggingEnabled() {
			log.Printf("Subscription confirmed: %s", message.ID)
		}
		
	case "subscription_error":
		if c.config.IsLoggingEnabled() {
			if errorMsg, ok := message.Data["error"].(string); ok {
				log.Printf("Subscription error for %s: %s", message.ID, errorMsg)
			}
		}
		
	case "ping":
		// Respond with pong
		pongMsg := types.WebSocketMessage{
			Type: "pong",
		}
		c.SendMessage(pongMsg)
		
	default:
		if c.config.IsLoggingEnabled() {
			log.Printf("Unknown message type: %s", message.Type)
		}
	}
}

// handleDisconnect handles WebSocket disconnection
func (c *WebSocketClient) handleDisconnect() {
	c.mu.Lock()
	c.isConnected = false
	c.conn = nil
	c.mu.Unlock()
	
	if c.config.IsLoggingEnabled() {
		log.Println("WebSocket connection closed")
	}
	
	// Attempt to reconnect if enabled
	if c.shouldReconnect {
		go c.reconnect()
	}
}

// reconnect attempts to reconnect the WebSocket
func (c *WebSocketClient) reconnect() {
	for c.shouldReconnect {
		if c.config.IsLoggingEnabled() {
			log.Println("Attempting to reconnect WebSocket...")
		}
		
		time.Sleep(c.reconnectDelay)
		
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err := c.Connect(ctx)
		cancel()
		
		if err == nil {
			if c.config.IsLoggingEnabled() {
				log.Println("WebSocket reconnected successfully")
			}
			
			// Resubscribe to existing subscriptions
			c.resubscribeAll()
			break
		}
		
		if c.config.IsLoggingEnabled() {
			log.Printf("Reconnection failed: %v", err)
		}
		
		c.reconnectDelay = time.Duration(float64(c.reconnectDelay) * 1.5)
		if c.reconnectDelay > 30*time.Second {
			c.reconnectDelay = 30 * time.Second
		}
	}
}

// resubscribeAll resubscribes to all active subscriptions
func (c *WebSocketClient) resubscribeAll() {
	c.mu.RLock()
	subscriptions := make([]*verinode.WebSocketSubscription, 0, len(c.subscriptions))
	for _, sub := range c.subscriptions {
		subscriptions = append(subscriptions, sub)
	}
	c.mu.RUnlock()
	
	for _, subscription := range subscriptions {
		subMsg := types.WebSocketMessage{
			Type: "subscribe",
			ID:   subscription.ID,
			Data: subscription.Filters,
		}
		
		if err := c.SendMessage(subMsg); err != nil && c.config.IsLoggingEnabled() {
			log.Printf("Failed to resubscribe %s: %v", subscription.ID, err)
		}
	}
}
