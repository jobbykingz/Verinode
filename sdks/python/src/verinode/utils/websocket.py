"""
WebSocket client for real-time updates.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, Callable, Set
import websockets
from ..config import VerinodeConfig
from ..exceptions import VerinodeSubscriptionError, VerinodeNetworkError


class WebSocketClient:
    """
    WebSocket client for real-time updates and subscriptions.
    """
    
    def __init__(self, config: VerinodeConfig):
        """
        Initialize WebSocket client.
        
        Args:
            config: Configuration object
        """
        self.config = config
        self.logger = logging.getLogger(__name__)
        self._websocket: Optional[websockets.WebSocketClientProtocol] = None
        self._subscriptions: Dict[str, Dict[str, Any]] = {}
        self._message_handlers: Dict[str, Callable] = {}
        self._is_connected = False
        self._reconnect_task: Optional[asyncio.Task] = None
        self._should_reconnect = True
    
    async def connect(self):
        """
        Connect to WebSocket server.
        
        Raises:
            VerinodeNetworkError: If connection fails
        """
        if self._is_connected:
            return
        
        try:
            ws_url = self.config.api_endpoint.replace("http", "ws") + "/ws"
            
            # Prepare connection parameters
            extra_headers = {
                "User-Agent": "verinode-sdk-python/1.0.0"
            }
            
            if hasattr(self.config, 'api_key') and self.config.api_key:
                extra_headers["Authorization"] = f"Bearer {self.config.api_key}"
            
            self._websocket = await websockets.connect(
                ws_url,
                extra_headers=extra_headers,
                ping_interval=20,
                ping_timeout=10
            )
            
            self._is_connected = True
            self.logger.info("WebSocket connection established")
            
            # Start message handler
            asyncio.create_task(self._message_handler())
            
        except Exception as e:
            self.logger.error(f"WebSocket connection failed: {str(e)}")
            raise VerinodeNetworkError(f"WebSocket connection failed: {str(e)}")
    
    async def disconnect(self):
        """Disconnect from WebSocket server."""
        self._should_reconnect = False
        
        if self._reconnect_task:
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
        
        if self._websocket:
            await self._websocket.close()
            self._websocket = None
        
        self._is_connected = False
        self.logger.info("WebSocket connection closed")
    
    async def subscribe(
        self,
        filters: Optional[Dict[str, Any]] = None,
        message_handler: Optional[Callable] = None
    ) -> str:
        """
        Subscribe to real-time updates.
        
        Args:
            filters: Subscription filters
            message_handler: Optional message handler callback
            
        Returns:
            Subscription ID
            
        Raises:
            VerinodeSubscriptionError: If subscription fails
        """
        if not self._is_connected:
            await self.connect()
        
        try:
            subscription_id = f"sub_{len(self._subscriptions) + 1}_{int(asyncio.get_event_loop().time())}"
            
            subscription_message = {
                "type": "subscribe",
                "id": subscription_id,
                "filters": filters or {}
            }
            
            await self._websocket.send(json.dumps(subscription_message))
            
            self._subscriptions[subscription_id] = {
                "filters": filters or {},
                "created_at": asyncio.get_event_loop().time()
            }
            
            if message_handler:
                self._message_handlers[subscription_id] = message_handler
            
            self.logger.info(f"Subscribed to updates with ID: {subscription_id}")
            return subscription_id
            
        except Exception as e:
            self.logger.error(f"Subscription failed: {str(e)}")
            raise VerinodeSubscriptionError(f"Subscription failed: {str(e)}")
    
    async def unsubscribe(self, subscription_id: str) -> bool:
        """
        Unsubscribe from updates.
        
        Args:
            subscription_id: Subscription ID
            
        Returns:
            True if unsubscribed successfully
        """
        if subscription_id not in self._subscriptions:
            return False
        
        try:
            unsubscribe_message = {
                "type": "unsubscribe",
                "id": subscription_id
            }
            
            if self._websocket:
                await self._websocket.send(json.dumps(unsubscribe_message))
            
            del self._subscriptions[subscription_id]
            
            if subscription_id in self._message_handlers:
                del self._message_handlers[subscription_id]
            
            self.logger.info(f"Unsubscribed from updates: {subscription_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Unsubscribe failed: {str(e)}")
            return False
    
    async def send_message(self, message: Dict[str, Any]):
        """
        Send message through WebSocket.
        
        Args:
            message: Message to send
            
        Raises:
            VerinodeNetworkError: If send fails
        """
        if not self._is_connected or not self._websocket:
            raise VerinodeNetworkError("WebSocket not connected")
        
        try:
            await self._websocket.send(json.dumps(message))
        except Exception as e:
            self.logger.error(f"Failed to send message: {str(e)}")
            raise VerinodeNetworkError(f"Failed to send message: {str(e)}")
    
    async def _message_handler(self):
        """Handle incoming WebSocket messages."""
        try:
            async for message in self._websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError as e:
                    self.logger.error(f"Invalid JSON message: {str(e)}")
                except Exception as e:
                    self.logger.error(f"Error handling message: {str(e)}")
                    
        except websockets.exceptions.ConnectionClosed:
            self.logger.warning("WebSocket connection closed")
            self._is_connected = False
            
            if self._should_reconnect:
                self._reconnect_task = asyncio.create_task(self._reconnect())
        except Exception as e:
            self.logger.error(f"WebSocket error: {str(e)}")
            self._is_connected = False
    
    async def _handle_message(self, data: Dict[str, Any]):
        """
        Handle incoming message.
        
        Args:
            data: Message data
        """
        message_type = data.get("type")
        
        if message_type == "subscription_update":
            subscription_id = data.get("subscription_id")
            if subscription_id in self._message_handlers:
                handler = self._message_handlers[subscription_id]
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    self.logger.error(f"Message handler error: {str(e)}")
            else:
                self.logger.info(f"Received update for subscription {subscription_id}")
        
        elif message_type == "subscription_confirmed":
            subscription_id = data.get("subscription_id")
            self.logger.info(f"Subscription confirmed: {subscription_id}")
        
        elif message_type == "subscription_error":
            subscription_id = data.get("subscription_id")
            error = data.get("error", "Unknown error")
            self.logger.error(f"Subscription error for {subscription_id}: {error}")
        
        elif message_type == "ping":
            # Respond to ping with pong
            await self.send_message({"type": "pong"})
        
        else:
            self.logger.debug(f"Unknown message type: {message_type}")
    
    async def _reconnect(self):
        """Attempt to reconnect WebSocket."""
        while self._should_reconnect and not self._is_connected:
            try:
                self.logger.info("Attempting to reconnect WebSocket...")
                await asyncio.sleep(5)  # Wait before reconnecting
                await self.connect()
                
                # Resubscribe to existing subscriptions
                for subscription_id, subscription_data in self._subscriptions.items():
                    subscription_message = {
                        "type": "subscribe",
                        "id": subscription_id,
                        "filters": subscription_data["filters"]
                    }
                    await self._websocket.send(json.dumps(subscription_message))
                
                self.logger.info("WebSocket reconnected successfully")
                break
                
            except Exception as e:
                self.logger.error(f"Reconnection failed: {str(e)}")
                await asyncio.sleep(10)  # Wait longer before next attempt
    
    def is_connected(self) -> bool:
        """
        Check if WebSocket is connected.
        
        Returns:
            True if connected
        """
        return self._is_connected
    
    def get_subscriptions(self) -> Set[str]:
        """
        Get active subscription IDs.
        
        Returns:
            Set of subscription IDs
        """
        return set(self._subscriptions.keys())
    
    def add_message_handler(self, subscription_id: str, handler: Callable):
        """
        Add message handler for subscription.
        
        Args:
            subscription_id: Subscription ID
            handler: Message handler callback
        """
        self._message_handlers[subscription_id] = handler
    
    def remove_message_handler(self, subscription_id: str):
        """
        Remove message handler for subscription.
        
        Args:
            subscription_id: Subscription ID
        """
        if subscription_id in self._message_handlers:
            del self._message_handlers[subscription_id]
    
    def close(self):
        """Close WebSocket connection."""
        if self._is_connected:
            asyncio.create_task(self.disconnect())
