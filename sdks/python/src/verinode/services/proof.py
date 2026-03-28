"""
Proof service for managing cryptographic proofs.
"""

import logging
from typing import Optional, List, Dict, Any, Union
from ..types import (
    Proof, ProofCreateRequest, ProofUpdateRequest, 
    QueryOptions, PaginatedResponse, ProofStatus
)
from ..exceptions import VerinodeProofError, VerinodeAPIError
from ..utils import HTTPClient


class ProofService:
    """
    Service for managing proofs in the Verinode system.
    
    Provides methods to create, read, update, delete, and query proofs.
    """
    
    def __init__(self, http_client: HTTPClient, config):
        """
        Initialize proof service.
        
        Args:
            http_client: HTTP client for API requests
            config: Configuration object
        """
        self.http_client = http_client
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    async def create(self, request: ProofCreateRequest) -> Proof:
        """
        Create a new proof.
        
        Args:
            request: Proof creation request
            
        Returns:
            Created proof
            
        Raises:
            VerinodeProofError: If proof creation fails
        """
        try:
            response = await self.http_client.post(
                "/proofs",
                json=request.dict(exclude_none=True)
            )
            
            if response.get("success"):
                proof_data = response["data"]
                proof = Proof(**proof_data)
                self.logger.info(f"Created proof: {proof.id}")
                return proof
            else:
                raise VerinodeProofError(
                    response.get("error", "Failed to create proof"),
                    error_code="PROOF_CREATE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(f"Failed to create proof: {str(e)}")
    
    async def get(self, proof_id: str) -> Proof:
        """
        Get a proof by ID.
        
        Args:
            proof_id: Proof ID
            
        Returns:
            Proof object
            
        Raises:
            VerinodeProofError: If proof not found or access denied
        """
        try:
            response = await self.http_client.get(f"/proofs/{proof_id}")
            
            if response.get("success"):
                proof_data = response["data"]
                proof = Proof(**proof_data)
                return proof
            else:
                error_msg = response.get("error", "Proof not found")
                raise VerinodeProofError(
                    error_msg,
                    proof_id=proof_id,
                    error_code="PROOF_NOT_FOUND"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(
                f"Failed to get proof {proof_id}: {str(e)}",
                proof_id=proof_id
            )
    
    async def update(self, proof_id: str, request: ProofUpdateRequest) -> Proof:
        """
        Update an existing proof.
        
        Args:
            proof_id: Proof ID
            request: Proof update request
            
        Returns:
            Updated proof
            
        Raises:
            VerinodeProofError: If proof update fails
        """
        try:
            response = await self.http_client.patch(
                f"/proofs/{proof_id}",
                json=request.dict(exclude_none=True)
            )
            
            if response.get("success"):
                proof_data = response["data"]
                proof = Proof(**proof_data)
                self.logger.info(f"Updated proof: {proof.id}")
                return proof
            else:
                raise VerinodeProofError(
                    response.get("error", "Failed to update proof"),
                    proof_id=proof_id,
                    error_code="PROOF_UPDATE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(
                f"Failed to update proof {proof_id}: {str(e)}",
                proof_id=proof_id
            )
    
    async def delete(self, proof_id: str) -> bool:
        """
        Delete a proof.
        
        Args:
            proof_id: Proof ID
            
        Returns:
            True if deleted successfully
            
        Raises:
            VerinodeProofError: If proof deletion fails
        """
        try:
            response = await self.http_client.delete(f"/proofs/{proof_id}")
            
            if response.get("success"):
                self.logger.info(f"Deleted proof: {proof_id}")
                return True
            else:
                raise VerinodeProofError(
                    response.get("error", "Failed to delete proof"),
                    proof_id=proof_id,
                    error_code="PROOF_DELETE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(
                f"Failed to delete proof {proof_id}: {str(e)}",
                proof_id=proof_id
            )
    
    async def list(
        self,
        status: Optional[ProofStatus] = None,
        user_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
        options: Optional[QueryOptions] = None
    ) -> PaginatedResponse:
        """
        List proofs with optional filtering and pagination.
        
        Args:
            status: Filter by proof status
            user_id: Filter by user ID
            tags: Filter by tags
            options: Query options (pagination, sorting, etc.)
            
        Returns:
            Paginated list of proofs
        """
        try:
            params = {}
            
            if status:
                params["status"] = status.value
            if user_id:
                params["user_id"] = user_id
            if tags:
                params["tags"] = ",".join(tags)
            
            if options:
                params.update({
                    "page": options.page,
                    "page_size": options.page_size,
                    "include_total": options.include_total
                })
                
                if options.filters:
                    for i, filter_obj in enumerate(options.filters):
                        params[f"filter_{i}_field"] = filter_obj.field
                        params[f"filter_{i}_operator"] = filter_obj.operator
                        params[f"filter_{i}_value"] = filter_obj.value
                
                if options.sort:
                    for field, direction in options.sort.items():
                        params[f"sort_{field}"] = direction
            
            response = await self.http_client.get("/proofs", params=params)
            
            if response.get("success"):
                data = response["data"]
                
                items = [Proof(**item) for item in data.get("items", [])]
                
                return PaginatedResponse(
                    items=items,
                    total_count=data.get("total_count", 0),
                    page=data.get("page", 1),
                    page_size=data.get("page_size", 10),
                    has_next=data.get("has_next", False),
                    has_prev=data.get("has_prev", False)
                )
            else:
                raise VerinodeProofError(
                    response.get("error", "Failed to list proofs"),
                    error_code="PROOF_LIST_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(f"Failed to list proofs: {str(e)}")
    
    async def search(
        self,
        query: str,
        options: Optional[QueryOptions] = None
    ) -> PaginatedResponse:
        """
        Search proofs by text query.
        
        Args:
            query: Search query string
            options: Query options
            
        Returns:
            Paginated list of matching proofs
        """
        try:
            params = {"q": query}
            
            if options:
                params.update({
                    "page": options.page,
                    "page_size": options.page_size,
                    "include_total": options.include_total
                })
            
            response = await self.http_client.get("/proofs/search", params=params)
            
            if response.get("success"):
                data = response["data"]
                
                items = [Proof(**item) for item in data.get("items", [])]
                
                return PaginatedResponse(
                    items=items,
                    total_count=data.get("total_count", 0),
                    page=data.get("page", 1),
                    page_size=data.get("page_size", 10),
                    has_next=data.get("has_next", False),
                    has_prev=data.get("has_prev", False)
                )
            else:
                raise VerinodeProofError(
                    response.get("error", "Failed to search proofs"),
                    error_code="PROOF_SEARCH_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(f"Failed to search proofs: {str(e)}")
    
    async def verify(self, proof_id: str, evidence: Optional[Dict[str, Any]] = None) -> bool:
        """
        Verify a proof.
        
        Args:
            proof_id: Proof ID to verify
            evidence: Optional verification evidence
            
        Returns:
            True if verification initiated successfully
            
        Raises:
            VerinodeProofError: If verification fails
        """
        try:
            response = await self.http_client.post(
                f"/proofs/{proof_id}/verify",
                json={"evidence": evidence} if evidence else {}
            )
            
            if response.get("success"):
                self.logger.info(f"Verification initiated for proof: {proof_id}")
                return True
            else:
                raise VerinodeProofError(
                    response.get("error", "Failed to verify proof"),
                    proof_id=proof_id,
                    error_code="PROOF_VERIFY_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(
                f"Failed to verify proof {proof_id}: {str(e)}",
                proof_id=proof_id
            )
    
    async def get_verifications(self, proof_id: str) -> List[Any]:
        """
        Get all verifications for a proof.
        
        Args:
            proof_id: Proof ID
            
        Returns:
            List of verifications
        """
        try:
            response = await self.http_client.get(f"/proofs/{proof_id}/verifications")
            
            if response.get("success"):
                from ..types import Verification
                verifications = [Verification(**v) for v in response["data"]]
                return verifications
            else:
                raise VerinodeProofError(
                    response.get("error", "Failed to get verifications"),
                    proof_id=proof_id,
                    error_code="PROOF_VERIFICATIONS_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeProofError(
                f"Failed to get verifications for proof {proof_id}: {str(e)}",
                proof_id=proof_id
            )
