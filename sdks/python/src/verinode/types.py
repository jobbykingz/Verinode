"""
Type definitions for Verinode SDK.
"""

from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class NetworkType(str, Enum):
    """Network types."""
    MAINNET = "mainnet"
    TESTNET = "testnet"


class ProofStatus(str, Enum):
    """Proof status types."""
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"


class VerificationStatus(str, Enum):
    """Verification status types."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class WalletType(str, Enum):
    """Wallet provider types."""
    STELLAR = "stellar"
    ALBEDO = "albedo"
    FREIGHTER = "freighter"
    XBULL = "xbull"


class User(BaseModel):
    """User model."""
    id: str
    email: str
    username: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    metadata: Optional[Dict[str, Any]] = None


class Wallet(BaseModel):
    """Wallet model."""
    id: str
    user_id: str
    public_key: str
    wallet_type: WalletType
    network: NetworkType
    is_connected: bool = False
    balance: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None


class Proof(BaseModel):
    """Proof model."""
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    status: ProofStatus
    metadata: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None
    verification_count: int = 0
    tags: Optional[List[str]] = None


class Verification(BaseModel):
    """Verification model."""
    id: str
    proof_id: str
    verifier_id: str
    status: VerificationStatus
    comment: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None


class Subscription(BaseModel):
    """Subscription model."""
    id: str
    user_id: str
    subscription_type: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    filters: Optional[Dict[str, Any]] = None


class APIResponse(BaseModel):
    """Generic API response model."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PaginatedResponse(BaseModel):
    """Paginated response model."""
    items: List[Any]
    total_count: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool


class AuthToken(BaseModel):
    """Authentication token model."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: Optional[int] = None
    scope: Optional[str] = None


class ProofCreateRequest(BaseModel):
    """Request model for creating a proof."""
    title: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    expires_at: Optional[datetime] = None


class ProofUpdateRequest(BaseModel):
    """Request model for updating a proof."""
    title: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    expires_at: Optional[datetime] = None


class VerificationCreateRequest(BaseModel):
    """Request model for creating a verification."""
    proof_id: str
    status: VerificationStatus
    comment: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class WalletConnectRequest(BaseModel):
    """Request model for connecting a wallet."""
    wallet_type: WalletType
    public_key: Optional[str] = None
    network: NetworkType = NetworkType.MAINNET


class SubscriptionCreateRequest(BaseModel):
    """Request model for creating a subscription."""
    subscription_type: str
    filters: Optional[Dict[str, Any]] = None


class QueryFilter(BaseModel):
    """Generic query filter model."""
    field: str
    operator: str  # eq, ne, gt, gte, lt, lte, in, nin, contains
    value: Any


class QueryOptions(BaseModel):
    """Query options model."""
    filters: Optional[List[QueryFilter]] = None
    sort: Optional[Dict[str, int]] = None  # field: 1 (asc) or -1 (desc)
    page: int = 1
    page_size: int = 10
    include_total: bool = True
