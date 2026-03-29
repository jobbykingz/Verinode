"""
Verinode Python SDK

Official Python SDK for Verinode - Web3 infrastructure for cryptographic proofs.
"""

from .client import Verinode
from .config import VerinodeConfig
from .exceptions import VerinodeError, VerinodeAPIError, VerinodeAuthError
from .types import Proof, Verification, Wallet, User
from .services import ProofService, VerificationService, WalletService

__version__ = "1.0.0"
__author__ = "Verinode Team"
__email__ = "team@verinode.com"

__all__ = [
    "Verinode",
    "VerinodeConfig",
    "VerinodeError",
    "VerinodeAPIError",
    "VerinodeAuthError",
    "Proof",
    "Verification",
    "Wallet",
    "User",
    "ProofService",
    "VerificationService",
    "WalletService",
]
