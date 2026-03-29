"""
Main client class for Verinode SDK.
"""

import asyncio
import logging
from typing import Optional, Dict, Any, Union
from .config import VerinodeConfig
from .exceptions import VerinodeError, VerinodeAuthError, VerinodeAPIError
from .services import ProofService, VerificationService, WalletService
from .utils import HTTPClient, WebSocketClient
from .types import User, AuthToken


class Verinode:
    """
    Main Verinode SDK client.
    
    Provides access to all Verinode services including proofs, verifications,
    and wallet management.
    """
    
    def __init__(self, config: Optional[Union[VerinodeConfig, Dict[str, Any]]] = None):
        """
        Initialize Verinode client.
        
        Args:
            config: Configuration object or dictionary
        """
        if config is None:
            self.config = VerinodeConfig()
        elif isinstance(config, dict):
            self.config = VerinodeConfig(**config)
        else:
            self.config = config
        
        self._http_client = HTTPClient(self.config)
        self._ws_client = WebSocketClient(self.config)
        self._user: Optional[User] = None
        self._auth_token: Optional[AuthToken] = None
        
        # Initialize services
        self.proof = ProofService(self._http_client, self.config)
        self.verification = VerificationService(self._http_client, self.config)
        self.wallet = WalletService(self._http_client, self._ws_client, self.config)
        
        # Setup logging
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup logging configuration."""
        if self.config.logging_enabled:
            logging.basicConfig(
                level=getattr(logging, self.config.log_level.upper()),
                format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            self.logger = logging.getLogger(__name__)
        else:
            self.logger = logging.getLogger(__name__)
            self.logger.addHandler(logging.NullHandler())
    
    @classmethod
    def init(cls, **kwargs) -> "Verinode":
        """
        Initialize Verinode client with configuration.
        
        Args:
            **kwargs: Configuration options
            
        Returns:
            Verinode client instance
        """
        config = VerinodeConfig(**kwargs)
        return cls(config)
    
    @property
    def is_authenticated(self) -> bool:
        """Check if client is authenticated."""
        return self._auth_token is not None and self._user is not None
    
    @property
    def current_user(self) -> Optional[User]:
        """Get current authenticated user."""
        return self._user
    
    @property
    def auth_token(self) -> Optional[AuthToken]:
        """Get current authentication token."""
        return self._auth_token
    
    def is_ready(self) -> bool:
        """
        Check if SDK is properly configured and ready to use.
        
        Returns:
            True if ready, False otherwise
        """
        try:
            self.config._validate_config()
            return True
        except Exception:
            return False
    
    def get_config(self) -> VerinodeConfig:
        """
        Get current configuration.
        
        Returns:
            Current configuration
        """
        return self.config
    
    def update_config(self, **kwargs):
        """
        Update configuration.
        
        Args:
            **kwargs: Configuration options to update
        """
        self.config.update(**kwargs)
        self._http_client = HTTPClient(self.config)
        self._ws_client = WebSocketClient(self.config)
        
        # Update services with new clients
        self.proof = ProofService(self._http_client, self.config)
        self.verification = VerificationService(self._http_client, self.config)
        self.wallet = WalletService(self._http_client, self._ws_client, self.config)
    
    async def authenticate(self, email: str, password: str) -> AuthToken:
        """
        Authenticate with email and password.
        
        Args:
            email: User email
            password: User password
            
        Returns:
            Authentication token
            
        Raises:
            VerinodeAuthError: If authentication fails
        """
        try:
            response = await self._http_client.post(
                "/auth/login",
                json={"email": email, "password": password}
            )
            
            if response.get("success"):
                token_data = response["data"]
                self._auth_token = AuthToken(**token_data)
                
                # Set authorization header for future requests
                self._http_client.set_auth_token(self._auth_token.access_token)
                
                # Get user info
                await self._get_current_user()
                
                self.logger.info(f"Successfully authenticated user: {email}")
                return self._auth_token
            else:
                raise VerinodeAuthError(response.get("error", "Authentication failed"))
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeAuthError(f"Authentication failed: {str(e)}")
    
    async def register(self, email: str, password: str, username: Optional[str] = None) -> AuthToken:
        """
        Register a new user account.
        
        Args:
            email: User email
            password: User password
            username: Optional username
            
        Returns:
            Authentication token
            
        Raises:
            VerinodeAuthError: If registration fails
        """
        try:
            response = await self._http_client.post(
                "/auth/register",
                json={
                    "email": email,
                    "password": password,
                    "username": username
                }
            )
            
            if response.get("success"):
                token_data = response["data"]
                self._auth_token = AuthToken(**token_data)
                
                # Set authorization header for future requests
                self._http_client.set_auth_token(self._auth_token.access_token)
                
                # Get user info
                await self._get_current_user()
                
                self.logger.info(f"Successfully registered user: {email}")
                return self._auth_token
            else:
                raise VerinodeAuthError(response.get("error", "Registration failed"))
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeAuthError(f"Registration failed: {str(e)}")
    
    async def logout(self):
        """Logout current user."""
        if self._auth_token:
            try:
                await self._http_client.post("/auth/logout")
            except Exception as e:
                self.logger.warning(f"Logout request failed: {str(e)}")
            finally:
                self._auth_token = None
                self._user = None
                self._http_client.set_auth_token(None)
                self.logger.info("User logged out")
    
    async def refresh_token(self) -> AuthToken:
        """
        Refresh authentication token.
        
        Returns:
            New authentication token
            
        Raises:
            VerinodeAuthError: If refresh fails
        """
        if not self._auth_token or not self._auth_token.refresh_token:
            raise VerinodeAuthError("No refresh token available")
        
        try:
            response = await self._http_client.post(
                "/auth/refresh",
                json={"refresh_token": self._auth_token.refresh_token}
            )
            
            if response.get("success"):
                token_data = response["data"]
                self._auth_token = AuthToken(**token_data)
                self._http_client.set_auth_token(self._auth_token.access_token)
                
                self.logger.info("Token refreshed successfully")
                return self._auth_token
            else:
                raise VerinodeAuthError(response.get("error", "Token refresh failed"))
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeAuthError(f"Token refresh failed: {str(e)}")
    
    async def _get_current_user(self):
        """Get current user information."""
        try:
            response = await self._http_client.get("/auth/me")
            if response.get("success"):
                user_data = response["data"]
                self._user = User(**user_data)
        except Exception as e:
            self.logger.error(f"Failed to get current user: {str(e)}")
            raise
    
    async def subscribe_to_updates(self, filters: Optional[Dict[str, Any]] = None):
        """
        Subscribe to real-time updates.
        
        Args:
            filters: Optional filters for subscriptions
            
        Returns:
            WebSocket connection for real-time updates
        """
        if not self.is_authenticated:
            raise VerinodeAuthError("Must be authenticated to subscribe to updates")
        
        return await self._ws_client.subscribe(filters)
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if hasattr(self, '_http_client'):
            self._http_client.close()
        if hasattr(self, '_ws_client'):
            self._ws_client.close()
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.logout()
        if hasattr(self, '_http_client'):
            self._http_client.close()
        if hasattr(self, '_ws_client'):
            self._ws_client.close()
