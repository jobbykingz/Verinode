"""
Wallet service for managing blockchain wallets.
"""

import logging
from typing import Optional, List, Dict, Any, Callable
from ..types import (
    Wallet, WalletType, NetworkType, WalletConnectRequest
)
from ..exceptions import VerinodeWalletError, VerinodeError
from ..utils import HTTPClient, WebSocketClient


class WalletService:
    """
    Service for managing blockchain wallets in the Verinode system.
    
    Provides methods to connect, manage, and interact with various wallet providers.
    """
    
    def __init__(self, http_client: HTTPClient, ws_client: WebSocketClient, config):
        """
        Initialize wallet service.
        
        Args:
            http_client: HTTP client for API requests
            ws_client: WebSocket client for real-time updates
            config: Configuration object
        """
        self.http_client = http_client
        self.ws_client = ws_client
        self.config = config
        self.logger = logging.getLogger(__name__)
        self._connected_wallets: Dict[str, Wallet] = {}
        self._wallet_listeners: Dict[str, List[Callable]] = {}
    
    async def connect(self, request: WalletConnectRequest) -> Wallet:
        """
        Connect a wallet.
        
        Args:
            request: Wallet connection request
            
        Returns:
            Connected wallet object
            
        Raises:
            VerinodeWalletError: If wallet connection fails
        """
        try:
            response = await self.http_client.post(
                "/wallets/connect",
                json=request.dict(exclude_none=True)
            )
            
            if response.get("success"):
                wallet_data = response["data"]
                wallet = Wallet(**wallet_data)
                self._connected_wallets[wallet.id] = wallet
                self.logger.info(f"Connected wallet: {wallet.id} ({wallet.wallet_type})")
                return wallet
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to connect wallet"),
                    wallet_type=request.wallet_type.value,
                    error_code="WALLET_CONNECT_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(
                f"Failed to connect wallet: {str(e)}",
                wallet_type=request.wallet_type.value
            )
    
    async def disconnect(self, wallet_id: str) -> bool:
        """
        Disconnect a wallet.
        
        Args:
            wallet_id: Wallet ID to disconnect
            
        Returns:
            True if disconnected successfully
            
        Raises:
            VerinodeWalletError: If wallet disconnection fails
        """
        try:
            response = await self.http_client.post(f"/wallets/{wallet_id}/disconnect")
            
            if response.get("success"):
                if wallet_id in self._connected_wallets:
                    del self._connected_wallets[wallet_id]
                self.logger.info(f"Disconnected wallet: {wallet_id}")
                return True
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to disconnect wallet"),
                    error_code="WALLET_DISCONNECT_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to disconnect wallet {wallet_id}: {str(e)}")
    
    async def get(self, wallet_id: str) -> Wallet:
        """
        Get wallet information.
        
        Args:
            wallet_id: Wallet ID
            
        Returns:
            Wallet object
            
        Raises:
            VerinodeWalletError: If wallet not found
        """
        try:
            response = await self.http_client.get(f"/wallets/{wallet_id}")
            
            if response.get("success"):
                wallet_data = response["data"]
                wallet = Wallet(**wallet_data)
                return wallet
            else:
                raise VerinodeWalletError(
                    response.get("error", "Wallet not found"),
                    error_code="WALLET_NOT_FOUND"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to get wallet {wallet_id}: {str(e)}")
    
    async def list(self, user_id: Optional[str] = None) -> List[Wallet]:
        """
        List wallets.
        
        Args:
            user_id: Optional user ID filter
            
        Returns:
            List of wallets
        """
        try:
            params = {}
            if user_id:
                params["user_id"] = user_id
            
            response = await self.http_client.get("/wallets", params=params)
            
            if response.get("success"):
                wallets = [Wallet(**w) for w in response["data"]]
                return wallets
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to list wallets"),
                    error_code="WALLET_LIST_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to list wallets: {str(e)}")
    
    async def get_balance(self, wallet_id: str) -> str:
        """
        Get wallet balance.
        
        Args:
            wallet_id: Wallet ID
            
        Returns:
            Balance as string
            
        Raises:
            VerinodeWalletError: If balance retrieval fails
        """
        try:
            response = await self.http_client.get(f"/wallets/{wallet_id}/balance")
            
            if response.get("success"):
                return response["data"]["balance"]
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to get wallet balance"),
                    error_code="WALLET_BALANCE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to get balance for wallet {wallet_id}: {str(e)}")
    
    async def send_transaction(
        self,
        wallet_id: str,
        to_address: str,
        amount: str,
        memo: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send a transaction from a wallet.
        
        Args:
            wallet_id: Wallet ID
            to_address: Recipient address
            amount: Amount to send
            memo: Optional transaction memo
            
        Returns:
            Transaction information
            
        Raises:
            VerinodeWalletError: If transaction fails
        """
        try:
            response = await self.http_client.post(
                f"/wallets/{wallet_id}/send",
                json={
                    "to_address": to_address,
                    "amount": amount,
                    "memo": memo
                }
            )
            
            if response.get("success"):
                self.logger.info(f"Transaction sent from wallet {wallet_id}")
                return response["data"]
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to send transaction"),
                    error_code="WALLET_TRANSACTION_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to send transaction from wallet {wallet_id}: {str(e)}")
    
    async def sign_message(
        self,
        wallet_id: str,
        message: str
    ) -> str:
        """
        Sign a message with a wallet.
        
        Args:
            wallet_id: Wallet ID
            message: Message to sign
            
        Returns:
            Signature
            
        Raises:
            VerinodeWalletError: If signing fails
        """
        try:
            response = await self.http_client.post(
                f"/wallets/{wallet_id}/sign",
                json={"message": message}
            )
            
            if response.get("success"):
                return response["data"]["signature"]
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to sign message"),
                    error_code="WALLET_SIGN_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to sign message with wallet {wallet_id}: {str(e)}")
    
    async def verify_message(
        self,
        public_key: str,
        message: str,
        signature: str
    ) -> bool:
        """
        Verify a message signature.
        
        Args:
            public_key: Public key of signer
            message: Original message
            signature: Signature to verify
            
        Returns:
            True if signature is valid
        """
        try:
            response = await self.http_client.post(
                "/wallets/verify",
                json={
                    "public_key": public_key,
                    "message": message,
                    "signature": signature
                }
            )
            
            if response.get("success"):
                return response["data"]["valid"]
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to verify message"),
                    error_code="WALLET_VERIFY_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to verify message: {str(e)}")
    
    def add_listener(self, event_type: str, callback: Callable):
        """
        Add event listener for wallet events.
        
        Args:
            event_type: Type of event to listen for
            callback: Callback function
        """
        if event_type not in self._wallet_listeners:
            self._wallet_listeners[event_type] = []
        self._wallet_listeners[event_type].append(callback)
    
    def remove_listener(self, event_type: str, callback: Callable):
        """
        Remove event listener.
        
        Args:
            event_type: Type of event
            callback: Callback function to remove
        """
        if event_type in self._wallet_listeners:
            try:
                self._wallet_listeners[event_type].remove(callback)
            except ValueError:
                pass
    
    async def subscribe_to_wallet_events(self, wallet_id: str):
        """
        Subscribe to real-time wallet events.
        
        Args:
            wallet_id: Wallet ID to subscribe to
        """
        if not self.ws_client:
            raise VerinodeWalletError(
                "WebSocket client not available",
                error_code="WS_CLIENT_UNAVAILABLE"
            )
        
        filters = {"wallet_id": wallet_id}
        await self.ws_client.subscribe(filters)
    
    def get_connected_wallets(self) -> List[Wallet]:
        """
        Get list of currently connected wallets.
        
        Returns:
            List of connected wallets
        """
        return list(self._connected_wallets.values())
    
    def is_connected(self, wallet_id: str) -> bool:
        """
        Check if a wallet is connected.
        
        Args:
            wallet_id: Wallet ID
            
        Returns:
            True if connected
        """
        return wallet_id in self._connected_wallets
    
    async def switch_network(self, wallet_id: str, network: NetworkType) -> Wallet:
        """
        Switch wallet network.
        
        Args:
            wallet_id: Wallet ID
            network: New network type
            
        Returns:
            Updated wallet object
        """
        try:
            response = await self.http_client.post(
                f"/wallets/{wallet_id}/switch-network",
                json={"network": network.value}
            )
            
            if response.get("success"):
                wallet_data = response["data"]
                wallet = Wallet(**wallet_data)
                if wallet_id in self._connected_wallets:
                    self._connected_wallets[wallet_id] = wallet
                self.logger.info(f"Switched wallet {wallet_id} to {network.value}")
                return wallet
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to switch network"),
                    error_code="WALLET_NETWORK_SWITCH_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to switch network for wallet {wallet_id}: {str(e)}")
    
    async def get_transaction_history(
        self,
        wallet_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get transaction history for a wallet.
        
        Args:
            wallet_id: Wallet ID
            limit: Maximum number of transactions
            offset: Offset for pagination
            
        Returns:
            List of transactions
        """
        try:
            params = {"limit": limit, "offset": offset}
            response = await self.http_client.get(f"/wallets/{wallet_id}/transactions", params=params)
            
            if response.get("success"):
                return response["data"]
            else:
                raise VerinodeWalletError(
                    response.get("error", "Failed to get transaction history"),
                    error_code="WALLET_TRANSACTIONS_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeWalletError(f"Failed to get transaction history for wallet {wallet_id}: {str(e)}")
