"""
HTTP client for Verinode SDK.
"""

import asyncio
import logging
import time
from typing import Optional, Dict, Any, Union
import aiohttp
from ..config import VerinodeConfig
from ..exceptions import VerinodeAPIError, VerinodeNetworkError


class HTTPClient:
    """
    HTTP client for making API requests to Verinode.
    """
    
    def __init__(self, config: VerinodeConfig):
        """
        Initialize HTTP client.
        
        Args:
            config: Configuration object
        """
        self.config = config
        self.logger = logging.getLogger(__name__)
        self._session: Optional[aiohttp.ClientSession] = None
        self._auth_token: Optional[str] = None
        
        # Configure session
        self._timeout = aiohttp.ClientTimeout(total=config.timeout / 1000)
        self._headers = {
            "Content-Type": "application/json",
            "User-Agent": f"verinode-sdk-python/1.0.0"
        }
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300,
                use_dns_cache=True,
            )
            
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=self._timeout,
                headers=self._headers
            )
        
        return self._session
    
    def set_auth_token(self, token: Optional[str]):
        """
        Set authentication token.
        
        Args:
            token: Authentication token or None to clear
        """
        self._auth_token = token
        if token:
            self._headers["Authorization"] = f"Bearer {token}"
        elif "Authorization" in self._headers:
            del self._headers["Authorization"]
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make HTTP request with retry logic.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            **kwargs: Additional request arguments
            
        Returns:
            Response data
            
        Raises:
            VerinodeAPIError: If request fails
        """
        url = f"{self.config.api_endpoint}{endpoint}"
        session = await self._get_session()
        
        last_exception = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                async with session.request(method, url, **kwargs) as response:
                    response_data = await self._handle_response(response)
                    
                    # Log successful request
                    self.logger.debug(
                        f"{method} {endpoint} - {response.status} - Attempt {attempt + 1}"
                    )
                    
                    return response_data
                    
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                last_exception = e
                
                if attempt < self.config.max_retries:
                    delay = self.config.retry_delay * (self.config.backoff_multiplier ** attempt)
                    self.logger.warning(
                        f"Request failed (attempt {attempt + 1}), retrying in {delay}ms: {str(e)}"
                    )
                    await asyncio.sleep(delay / 1000)
                else:
                    self.logger.error(f"Request failed after {attempt + 1} attempts: {str(e)}")
                    
            except Exception as e:
                self.logger.error(f"Unexpected error during request: {str(e)}")
                raise VerinodeNetworkError(f"Request failed: {str(e)}")
        
        raise VerinodeNetworkError(
            f"Request failed after {self.config.max_retries + 1} attempts: {str(last_exception)}"
        )
    
    async def _handle_response(self, response: aiohttp.ClientResponse) -> Dict[str, Any]:
        """
        Handle HTTP response.
        
        Args:
            response: HTTP response object
            
        Returns:
            Response data
            
        Raises:
            VerinodeAPIError: If response indicates an error
        """
        try:
            response_data = await response.json()
        except aiohttp.ContentTypeError:
            response_text = await response.text()
            response_data = {"error": f"Invalid JSON response: {response_text}"}
        
        if response.status >= 400:
            error_msg = response_data.get("error", f"HTTP {response.status}")
            raise VerinodeAPIError(
                error_msg,
                status_code=response.status,
                response_data=response_data
            )
        
        return response_data
    
    async def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make GET request.
        
        Args:
            endpoint: API endpoint
            params: Query parameters
            
        Returns:
            Response data
        """
        return await self._make_request(
            "GET",
            endpoint,
            params=params
        )
    
    async def post(
        self,
        endpoint: str,
        json: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make POST request.
        
        Args:
            endpoint: API endpoint
            json: JSON data
            data: Form data
            
        Returns:
            Response data
        """
        kwargs = {}
        if json is not None:
            kwargs["json"] = json
        if data is not None:
            kwargs["data"] = data
        
        return await self._make_request("POST", endpoint, **kwargs)
    
    async def patch(
        self,
        endpoint: str,
        json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make PATCH request.
        
        Args:
            endpoint: API endpoint
            json: JSON data
            
        Returns:
            Response data
        """
        return await self._make_request(
            "PATCH",
            endpoint,
            json=json
        )
    
    async def put(
        self,
        endpoint: str,
        json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make PUT request.
        
        Args:
            endpoint: API endpoint
            json: JSON data
            
        Returns:
            Response data
        """
        return await self._make_request(
            "PUT",
            endpoint,
            json=json
        )
    
    async def delete(self, endpoint: str) -> Dict[str, Any]:
        """
        Make DELETE request.
        
        Args:
            endpoint: API endpoint
            
        Returns:
            Response data
        """
        return await self._make_request("DELETE", endpoint)
    
    async def upload_file(
        self,
        endpoint: str,
        file_path: str,
        field_name: str = "file",
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Upload file.
        
        Args:
            endpoint: API endpoint
            file_path: Path to file
            field_name: Form field name for file
            additional_data: Additional form data
            
        Returns:
            Response data
        """
        session = await self._get_session()
        
        try:
            with open(file_path, "rb") as file:
                data = aiohttp.FormData()
                data.add_field(field_name, file)
                
                if additional_data:
                    for key, value in additional_data.items():
                        data.add_field(key, str(value))
                
                async with session.post(f"{self.config.api_endpoint}{endpoint}", data=data) as response:
                    return await self._handle_response(response)
                    
        except FileNotFoundError:
            raise VerinodeAPIError(f"File not found: {file_path}")
        except Exception as e:
            raise VerinodeAPIError(f"File upload failed: {str(e)}")
    
    def close(self):
        """Close HTTP session."""
        if self._session and not self._session.closed:
            asyncio.create_task(self._session.close())
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        self.close()
