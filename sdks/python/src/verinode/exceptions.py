"""
Exception classes for Verinode SDK.
"""

from typing import Optional, Dict, Any


class VerinodeError(Exception):
    """Base exception class for all Verinode SDK errors."""
    
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
    
    def __str__(self) -> str:
        if self.error_code:
            return f"[{self.error_code}] {self.message}"
        return self.message


class VerinodeAPIError(VerinodeError):
    """Exception raised for API-related errors."""
    
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response_data: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None
    ):
        super().__init__(message, error_code)
        self.status_code = status_code
        self.response_data = response_data or {}
    
    def __str__(self) -> str:
        base_msg = super().__str__()
        if self.status_code:
            base_msg = f"HTTP {self.status_code}: {base_msg}"
        return base_msg


class VerinodeAuthError(VerinodeError):
    """Exception raised for authentication-related errors."""
    
    def __init__(
        self,
        message: str = "Authentication failed",
        error_code: Optional[str] = "AUTH_ERROR"
    ):
        super().__init__(message, error_code)


class VerinodeValidationError(VerinodeError):
    """Exception raised for validation errors."""
    
    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        error_code: Optional[str] = "VALIDATION_ERROR"
    ):
        super().__init__(message, error_code)
        self.field = field
    
    def __str__(self) -> str:
        base_msg = super().__str__()
        if self.field:
            base_msg = f"Field '{self.field}': {base_msg}"
        return base_msg


class VerinodeNetworkError(VerinodeError):
    """Exception raised for network-related errors."""
    
    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        error_code: Optional[str] = "NETWORK_ERROR"
    ):
        super().__init__(message, error_code)
        self.retry_after = retry_after


class VerinodeWalletError(VerinodeError):
    """Exception raised for wallet-related errors."""
    
    def __init__(
        self,
        message: str,
        wallet_type: Optional[str] = None,
        error_code: Optional[str] = "WALLET_ERROR"
    ):
        super().__init__(message, error_code)
        self.wallet_type = wallet_type


class VerinodeProofError(VerinodeError):
    """Exception raised for proof-related errors."""
    
    def __init__(
        self,
        message: str,
        proof_id: Optional[str] = None,
        error_code: Optional[str] = "PROOF_ERROR"
    ):
        super().__init__(message, error_code)
        self.proof_id = proof_id


class VerinodeSubscriptionError(VerinodeError):
    """Exception raised for subscription-related errors."""
    
    def __init__(
        self,
        message: str,
        subscription_id: Optional[str] = None,
        error_code: Optional[str] = "SUBSCRIPTION_ERROR"
    ):
        super().__init__(message, error_code)
        self.subscription_id = subscription_id
