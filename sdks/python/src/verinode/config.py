"""
Configuration management for Verinode SDK.
"""

from typing import Optional, Dict, Any, Union
from pydantic import BaseSettings, Field
import os


class VerinodeConfig(BaseSettings):
    """Configuration class for Verinode SDK."""
    
    api_endpoint: str = Field(
        default="https://api.verinode.com",
        description="API endpoint URL"
    )
    
    network: str = Field(
        default="mainnet",
        description="Network type (mainnet or testnet)"
    )
    
    api_key: Optional[str] = Field(
        default=None,
        description="API key for authentication"
    )
    
    timeout: int = Field(
        default=10000,
        description="Timeout for API requests in milliseconds"
    )
    
    max_retries: int = Field(
        default=3,
        description="Maximum number of retry attempts"
    )
    
    retry_delay: int = Field(
        default=1000,
        description="Delay between retries in milliseconds"
    )
    
    backoff_multiplier: float = Field(
        default=2.0,
        description="Backoff multiplier for retries"
    )
    
    wallet_auto_connect: bool = Field(
        default=False,
        description="Automatically connect wallet on initialization"
    )
    
    supported_wallets: list = Field(
        default_factory=lambda: ["stellar", "albedo", "freighter"],
        description="List of supported wallet providers"
    )
    
    logging_enabled: bool = Field(
        default=False,
        description="Enable debug logging"
    )
    
    log_level: str = Field(
        default="INFO",
        description="Logging level"
    )
    
    class Config:
        env_prefix = "VERINODE_"
        case_sensitive = False
        
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._validate_config()
    
    def _validate_config(self):
        """Validate configuration parameters."""
        if self.network not in ["mainnet", "testnet"]:
            raise ValueError("Network must be either 'mainnet' or 'testnet'")
        
        if self.timeout <= 0:
            raise ValueError("Timeout must be positive")
        
        if self.max_retries < 0:
            raise ValueError("Max retries must be non-negative")
        
        if self.retry_delay <= 0:
            raise ValueError("Retry delay must be positive")
        
        if self.backoff_multiplier <= 1.0:
            raise ValueError("Backoff multiplier must be greater than 1.0")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return self.dict()
    
    def update(self, **kwargs):
        """Update configuration with new values."""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self._validate_config()
    
    @classmethod
    def from_env(cls) -> "VerinodeConfig":
        """Create configuration from environment variables."""
        return cls()
