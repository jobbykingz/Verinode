"""
Basic tests for Python Verinode SDK.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch
from verinode import Verinode, VerinodeConfig
from verinode.types import Proof, ProofStatus, ProofCreateRequest


class TestVerinodeClient:
    """Test cases for Verinode client."""
    
    def test_init_with_config(self):
        """Test client initialization with configuration."""
        config = VerinodeConfig(api_endpoint="https://test.api.com")
        client = Verinode(config)
        
        assert client.config.api_endpoint == "https://test.api.com"
        assert client.config.network == "mainnet"
        assert not client.is_authenticated()
    
    def test_init_with_defaults(self):
        """Test client initialization with default configuration."""
        client = Verinode.init()
        
        assert client.config.api_endpoint == "https://api.verinode.com"
        assert client.config.network == "mainnet"
        assert client.is_ready()
    
    def test_is_ready_valid_config(self):
        """Test is_ready with valid configuration."""
        config = VerinodeConfig()
        client = Verinode(config)
        assert client.is_ready()
    
    def test_is_ready_invalid_config(self):
        """Test is_ready with invalid configuration."""
        config = VerinodeConfig(api_endpoint="")
        client = Verinode(config)
        assert not client.is_ready()
    
    def test_get_config(self):
        """Test getting configuration."""
        config = VerinodeConfig(timeout=5000)
        client = Verinode(config)
        
        retrieved_config = client.get_config()
        assert retrieved_config.timeout == 5000
    
    def test_update_config(self):
        """Test updating configuration."""
        client = Verinode.init()
        
        new_config = {"timeout": 15000, "max_retries": 5}
        client.update_config(**new_config)
        
        assert client.config.timeout == 15000
        assert client.config.max_retries == 5


class TestAuthentication:
    """Test cases for authentication functionality."""
    
    @pytest.fixture
    def client(self):
        """Create a test client."""
        return Verinode.init()
    
    @pytest.mark.asyncio
    async def test_authenticate_success(self, client):
        """Test successful authentication."""
        mock_response = {
            "success": True,
            "data": {
                "access_token": "test_token",
                "refresh_token": "refresh_token",
                "token_type": "Bearer"
            }
        }
        
        with patch.object(client._http_client, 'post', return_value=mock_response):
            token = await client.authenticate("test@example.com", "password")
            
            assert token.access_token == "test_token"
            assert client.is_authenticated()
    
    @pytest.mark.asyncio
    async def test_authenticate_failure(self, client):
        """Test authentication failure."""
        mock_response = {
            "success": False,
            "error": "Invalid credentials"
        }
        
        with patch.object(client._http_client, 'post', return_value=mock_response):
            with pytest.raises(Exception):
                await client.authenticate("test@example.com", "wrong_password")
    
    @pytest.mark.asyncio
    async def test_register_success(self, client):
        """Test successful registration."""
        mock_response = {
            "success": True,
            "data": {
                "access_token": "new_token",
                "token_type": "Bearer"
            }
        }
        
        with patch.object(client._http_client, 'post', return_value=mock_response):
            token = await client.register("new@example.com", "password", "username")
            
            assert token.access_token == "new_token"
            assert client.is_authenticated()
    
    @pytest.mark.asyncio
    async def test_logout(self, client):
        """Test logout functionality."""
        # First authenticate
        client._auth_token = Mock(access_token="test_token")
        client._current_user = Mock()
        
        with patch.object(client._http_client, 'post'):
            await client.logout()
            
            assert not client.is_authenticated()
            assert client._auth_token is None
            assert client._current_user is None


class TestProofService:
    """Test cases for proof service."""
    
    @pytest.fixture
    def client(self):
        """Create an authenticated test client."""
        client = Verinode.init()
        client._auth_token = Mock(access_token="test_token")
        return client
    
    @pytest.mark.asyncio
    async def test_create_proof_success(self, client):
        """Test successful proof creation."""
        mock_response = {
            "success": True,
            "data": {
                "id": "proof_123",
                "title": "Test Proof",
                "status": "pending",
                "user_id": "user_123",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "verification_count": 0
            }
        }
        
        request = ProofCreateRequest(
            title="Test Proof",
            description="A test proof",
            metadata={"type": "document"}
        )
        
        with patch.object(client.proof._http_client, 'post', return_value=mock_response):
            proof = await client.proof.create(request)
            
            assert proof.id == "proof_123"
            assert proof.title == "Test Proof"
            assert proof.status == ProofStatus.PENDING
    
    @pytest.mark.asyncio
    async def test_get_proof_success(self, client):
        """Test successful proof retrieval."""
        mock_response = {
            "success": True,
            "data": {
                "id": "proof_123",
                "title": "Test Proof",
                "status": "verified",
                "user_id": "user_123",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "verification_count": 2
            }
        }
        
        with patch.object(client.proof._http_client, 'get', return_value=mock_response):
            proof = await client.proof.get("proof_123")
            
            assert proof.id == "proof_123"
            assert proof.status == ProofStatus.VERIFIED
            assert proof.verification_count == 2
    
    @pytest.mark.asyncio
    async def test_get_proof_not_found(self, client):
        """Test proof not found error."""
        mock_response = {
            "success": False,
            "error": "Proof not found"
        }
        
        with patch.object(client.proof._http_client, 'get', return_value=mock_response):
            with pytest.raises(Exception):
                await client.proof.get("nonexistent_proof")
    
    @pytest.mark.asyncio
    async def test_list_proofs_success(self, client):
        """Test successful proof listing."""
        mock_response = {
            "success": True,
            "data": {
                "items": [
                    {
                        "id": "proof_1",
                        "title": "Proof 1",
                        "status": "pending"
                    },
                    {
                        "id": "proof_2",
                        "title": "Proof 2",
                        "status": "verified"
                    }
                ],
                "total_count": 2,
                "page": 1,
                "page_size": 10,
                "has_next": False,
                "has_prev": False
            }
        }
        
        with patch.object(client.proof._http_client, 'get', return_value=mock_response):
            result = await client.proof.list()
            
            assert len(result.items) == 2
            assert result.total_count == 2
            assert result.page == 1
    
    @pytest.mark.asyncio
    async def test_search_proofs_success(self, client):
        """Test successful proof search."""
        mock_response = {
            "success": True,
            "data": {
                "items": [
                    {
                        "id": "proof_1",
                        "title": "Document Verification",
                        "status": "verified"
                    }
                ],
                "total_count": 1,
                "page": 1,
                "page_size": 10,
                "has_next": False,
                "has_prev": False
            }
        }
        
        with patch.object(client.proof._http_client, 'get', return_value=mock_response):
            result = await client.proof.search("document")
            
            assert len(result.items) == 1
            assert result.items[0].title == "Document Verification"
    
    @pytest.mark.asyncio
    async def test_update_proof_success(self, client):
        """Test successful proof update."""
        mock_response = {
            "success": True,
            "data": {
                "id": "proof_123",
                "title": "Updated Title",
                "status": "pending",
                "user_id": "user_123",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-02T00:00:00Z",
                "verification_count": 0
            }
        }
        
        update_request = ProofCreateRequest(title="Updated Title")
        
        with patch.object(client.proof._http_client, 'patch', return_value=mock_response):
            proof = await client.proof.update("proof_123", update_request)
            
            assert proof.title == "Updated Title
    
    @pytest.mark.asyncio
    async def test_delete_proof_success(self, client):
        """Test successful proof deletion."""
        mock_response = {
            "success": True,
            "data": None
        }
        
        with patch.object(client.proof._http_client, 'delete', return_value=mock_response):
            result = await client.proof.delete("proof_123")
            
            assert result is True
    
    @pytest.mark.asyncio
    async def test_verify_proof_success(self, client):
        """Test successful proof verification."""
        mock_response = {
            "success": True,
            "data": None
        }
        
        evidence = {"method": "automated", "confidence": 0.95}
        
        with patch.object(client.proof._http_client, 'post', return_value=mock_response):
            result = await client.proof.verify("proof_123", evidence)
            
            assert result is True


class TestErrorHandling:
    """Test cases for error handling."""
    
    def test_api_error_handling(self):
        """Test API error handling."""
        from verinode.exceptions import VerinodeAPIError
        
        error = VerinodeAPIError("API Error", 500, {"details": "Server error"})
        
        assert error.status_code == 500
        assert "API Error" in str(error)
        assert error.is_api_error()
    
    def test_auth_error_handling(self):
        """Test authentication error handling."""
        from verinode.exceptions import VerinodeAuthError
        
        error = VerinodeAuthError("Authentication failed")
        
        assert "Authentication failed" in str(error)
        assert error.is_auth_error()
    
    def test_network_error_handling(self):
        """Test network error handling."""
        from verinode.exceptions import VerinodeNetworkError
        
        error = VerinodeNetworkError("Connection failed")
        
        assert "Connection failed" in str(error)
        assert error.is_network_error()


if __name__ == "__main__":
    pytest.main([__file__])
