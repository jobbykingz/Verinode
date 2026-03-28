"""
Verification service for managing proof verifications.
"""

import logging
from typing import Optional, List, Dict, Any
from ..types import (
    Verification, VerificationCreateRequest, VerificationStatus,
    QueryOptions, PaginatedResponse
)
from ..exceptions import VerinodeError, VerinodeAPIError
from ..utils import HTTPClient


class VerificationService:
    """
    Service for managing verifications in the Verinode system.
    
    Provides methods to create, read, update, and query verifications.
    """
    
    def __init__(self, http_client: HTTPClient, config):
        """
        Initialize verification service.
        
        Args:
            http_client: HTTP client for API requests
            config: Configuration object
        """
        self.http_client = http_client
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    async def create(self, request: VerificationCreateRequest) -> Verification:
        """
        Create a new verification.
        
        Args:
            request: Verification creation request
            
        Returns:
            Created verification
            
        Raises:
            VerinodeError: If verification creation fails
        """
        try:
            response = await self.http_client.post(
                "/verifications",
                json=request.dict(exclude_none=True)
            )
            
            if response.get("success"):
                verification_data = response["data"]
                verification = Verification(**verification_data)
                self.logger.info(f"Created verification: {verification.id}")
                return verification
            else:
                raise VerinodeError(
                    response.get("error", "Failed to create verification"),
                    error_code="VERIFICATION_CREATE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to create verification: {str(e)}")
    
    async def get(self, verification_id: str) -> Verification:
        """
        Get a verification by ID.
        
        Args:
            verification_id: Verification ID
            
        Returns:
            Verification object
            
        Raises:
            VerinodeError: If verification not found or access denied
        """
        try:
            response = await self.http_client.get(f"/verifications/{verification_id}")
            
            if response.get("success"):
                verification_data = response["data"]
                verification = Verification(**verification_data)
                return verification
            else:
                error_msg = response.get("error", "Verification not found")
                raise VerinodeError(
                    error_msg,
                    error_code="VERIFICATION_NOT_FOUND"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to get verification {verification_id}: {str(e)}")
    
    async def update(
        self,
        verification_id: str,
        status: Optional[VerificationStatus] = None,
        comment: Optional[str] = None,
        evidence: Optional[Dict[str, Any]] = None
    ) -> Verification:
        """
        Update an existing verification.
        
        Args:
            verification_id: Verification ID
            status: New verification status
            comment: Optional comment
            evidence: Optional evidence
            
        Returns:
            Updated verification
            
        Raises:
            VerinodeError: If verification update fails
        """
        try:
            update_data = {}
            if status is not None:
                update_data["status"] = status.value
            if comment is not None:
                update_data["comment"] = comment
            if evidence is not None:
                update_data["evidence"] = evidence
            
            response = await self.http_client.patch(
                f"/verifications/{verification_id}",
                json=update_data
            )
            
            if response.get("success"):
                verification_data = response["data"]
                verification = Verification(**verification_data)
                self.logger.info(f"Updated verification: {verification.id}")
                return verification
            else:
                raise VerinodeError(
                    response.get("error", "Failed to update verification"),
                    error_code="VERIFICATION_UPDATE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to update verification {verification_id}: {str(e)}")
    
    async def delete(self, verification_id: str) -> bool:
        """
        Delete a verification.
        
        Args:
            verification_id: Verification ID
            
        Returns:
            True if deleted successfully
            
        Raises:
            VerinodeError: If verification deletion fails
        """
        try:
            response = await self.http_client.delete(f"/verifications/{verification_id}")
            
            if response.get("success"):
                self.logger.info(f"Deleted verification: {verification_id}")
                return True
            else:
                raise VerinodeError(
                    response.get("error", "Failed to delete verification"),
                    error_code="VERIFICATION_DELETE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to delete verification {verification_id}: {str(e)}")
    
    async def list(
        self,
        proof_id: Optional[str] = None,
        verifier_id: Optional[str] = None,
        status: Optional[VerificationStatus] = None,
        options: Optional[QueryOptions] = None
    ) -> PaginatedResponse:
        """
        List verifications with optional filtering and pagination.
        
        Args:
            proof_id: Filter by proof ID
            verifier_id: Filter by verifier ID
            status: Filter by verification status
            options: Query options (pagination, sorting, etc.)
            
        Returns:
            Paginated list of verifications
        """
        try:
            params = {}
            
            if proof_id:
                params["proof_id"] = proof_id
            if verifier_id:
                params["verifier_id"] = verifier_id
            if status:
                params["status"] = status.value
            
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
            
            response = await self.http_client.get("/verifications", params=params)
            
            if response.get("success"):
                data = response["data"]
                
                items = [Verification(**item) for item in data.get("items", [])]
                
                return PaginatedResponse(
                    items=items,
                    total_count=data.get("total_count", 0),
                    page=data.get("page", 1),
                    page_size=data.get("page_size", 10),
                    has_next=data.get("has_next", False),
                    has_prev=data.get("has_prev", False)
                )
            else:
                raise VerinodeError(
                    response.get("error", "Failed to list verifications"),
                    error_code="VERIFICATION_LIST_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to list verifications: {str(e)}")
    
    async def approve(
        self,
        verification_id: str,
        comment: Optional[str] = None,
        evidence: Optional[Dict[str, Any]] = None
    ) -> Verification:
        """
        Approve a verification.
        
        Args:
            verification_id: Verification ID
            comment: Optional approval comment
            evidence: Optional approval evidence
            
        Returns:
            Updated verification
        """
        return await self.update(
            verification_id,
            status=VerificationStatus.APPROVED,
            comment=comment,
            evidence=evidence
        )
    
    async def reject(
        self,
        verification_id: str,
        comment: Optional[str] = None,
        evidence: Optional[Dict[str, Any]] = None
    ) -> Verification:
        """
        Reject a verification.
        
        Args:
            verification_id: Verification ID
            comment: Optional rejection comment
            evidence: Optional rejection evidence
            
        Returns:
            Updated verification
        """
        return await self.update(
            verification_id,
            status=VerificationStatus.REJECTED,
            comment=comment,
            evidence=evidence
        )
    
    async def get_statistics(
        self,
        proof_id: Optional[str] = None,
        verifier_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get verification statistics.
        
        Args:
            proof_id: Optional proof ID filter
            verifier_id: Optional verifier ID filter
            
        Returns:
            Verification statistics
        """
        try:
            params = {}
            if proof_id:
                params["proof_id"] = proof_id
            if verifier_id:
                params["verifier_id"] = verifier_id
            
            response = await self.http_client.get("/verifications/statistics", params=params)
            
            if response.get("success"):
                return response["data"]
            else:
                raise VerinodeError(
                    response.get("error", "Failed to get verification statistics"),
                    error_code="VERIFICATION_STATS_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to get verification statistics: {str(e)}")
    
    async def bulk_approve(
        self,
        verification_ids: List[str],
        comment: Optional[str] = None
    ) -> List[Verification]:
        """
        Approve multiple verifications at once.
        
        Args:
            verification_ids: List of verification IDs
            comment: Optional approval comment
            
        Returns:
            List of updated verifications
        """
        try:
            response = await self.http_client.post(
                "/verifications/bulk-approve",
                json={
                    "verification_ids": verification_ids,
                    "comment": comment
                }
            )
            
            if response.get("success"):
                verifications = [Verification(**v) for v in response["data"]]
                self.logger.info(f"Bulk approved {len(verifications)} verifications")
                return verifications
            else:
                raise VerinodeError(
                    response.get("error", "Failed to bulk approve verifications"),
                    error_code="VERIFICATION_BULK_APPROVE_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to bulk approve verifications: {str(e)}")
    
    async def bulk_reject(
        self,
        verification_ids: List[str],
        comment: Optional[str] = None
    ) -> List[Verification]:
        """
        Reject multiple verifications at once.
        
        Args:
            verification_ids: List of verification IDs
            comment: Optional rejection comment
            
        Returns:
            List of updated verifications
        """
        try:
            response = await self.http_client.post(
                "/verifications/bulk-reject",
                json={
                    "verification_ids": verification_ids,
                    "comment": comment
                }
            )
            
            if response.get("success"):
                verifications = [Verification(**v) for v in response["data"]]
                self.logger.info(f"Bulk rejected {len(verifications)} verifications")
                return verifications
            else:
                raise VerinodeError(
                    response.get("error", "Failed to bulk reject verifications"),
                    error_code="VERIFICATION_BULK_REJECT_FAILED"
                )
                
        except Exception as e:
            if isinstance(e, VerinodeError):
                raise
            raise VerinodeError(f"Failed to bulk reject verifications: {str(e)}")
