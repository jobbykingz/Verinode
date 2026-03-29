"""
Helper utilities for Verinode SDK.
"""

import asyncio
import time
import re
from typing import Callable, Any, Optional, Union
from functools import wraps
from ..exceptions import VerinodeError


def retry(max_attempts: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """
    Retry decorator for async functions.
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Initial delay between attempts in seconds
        backoff: Backoff multiplier for delay
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt < max_attempts - 1:
                        wait_time = delay * (backoff ** attempt)
                        await asyncio.sleep(wait_time)
                    else:
                        raise
            
            raise last_exception
        
        return wrapper
    return decorator


def rate_limit(calls_per_second: float = 1.0):
    """
    Rate limiting decorator for async functions.
    
    Args:
        calls_per_second: Maximum number of calls per second
    """
    def decorator(func: Callable):
        last_called = [0.0]
        min_interval = 1.0 / calls_per_second
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_time = time.time()
            time_since_last = current_time - last_called[0]
            
            if time_since_last < min_interval:
                await asyncio.sleep(min_interval - time_since_last)
            
            last_called[0] = time.time()
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def validate_address(address: str, address_type: str = "stellar") -> bool:
    """
    Validate blockchain address format.
    
    Args:
        address: Address to validate
        address_type: Type of address (stellar, ethereum, etc.)
        
    Returns:
        True if address is valid
    """
    if not address or not isinstance(address, str):
        return False
    
    if address_type.lower() == "stellar":
        # Stellar addresses are 56 characters starting with 'G'
        return bool(re.match(r'^G[A-Z0-9]{55}$', address))
    
    elif address_type.lower() == "ethereum":
        # Ethereum addresses are 42 characters starting with '0x'
        return bool(re.match(r'^0x[a-fA-F0-9]{40}$', address))
    
    elif address_type.lower() == "bitcoin":
        # Bitcoin addresses validation (simplified)
        return bool(re.match(r'^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$', address))
    
    return False


def validate_email(email: str) -> bool:
    """
    Validate email address format.
    
    Args:
        email: Email address to validate
        
    Returns:
        True if email is valid
    """
    if not email or not isinstance(email, str):
        return False
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def sanitize_string(text: str, max_length: Optional[int] = None) -> str:
    """
    Sanitize string input.
    
    Args:
        text: Text to sanitize
        max_length: Maximum length constraint
        
    Returns:
        Sanitized string
    """
    if not isinstance(text, str):
        text = str(text)
    
    # Remove control characters
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    
    # Normalize whitespace
    text = ' '.join(text.split())
    
    # Apply length limit
    if max_length and len(text) > max_length:
        text = text[:max_length].rstrip()
    
    return text


def format_timestamp(timestamp: Union[int, float, str]) -> str:
    """
    Format timestamp to ISO 8601 string.
    
    Args:
        timestamp: Timestamp to format
        
    Returns:
        ISO 8601 formatted timestamp
    """
    if isinstance(timestamp, str):
        return timestamp
    
    if isinstance(timestamp, (int, float)):
        from datetime import datetime, timezone
        return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()
    
    return str(timestamp)


def parse_timestamp(timestamp: str) -> float:
    """
    Parse ISO 8601 timestamp to Unix timestamp.
    
    Args:
        timestamp: ISO 8601 timestamp string
        
    Returns:
        Unix timestamp
    """
    from datetime import datetime
    
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return dt.timestamp()
    except ValueError:
        raise VerinodeError(f"Invalid timestamp format: {timestamp}")


def chunk_list(items: list, chunk_size: int) -> list:
    """
    Split list into chunks.
    
    Args:
        items: List to chunk
        chunk_size: Size of each chunk
        
    Returns:
        List of chunks
    """
    if chunk_size <= 0:
        raise ValueError("Chunk size must be positive")
    
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]


def merge_dicts(dict1: dict, dict2: dict) -> dict:
    """
    Merge two dictionaries recursively.
    
    Args:
        dict1: First dictionary
        dict2: Second dictionary
        
    Returns:
        Merged dictionary
    """
    result = dict1.copy()
    
    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value
    
    return result


def deep_get(dictionary: dict, keys: str, default: Any = None) -> Any:
    """
    Get nested dictionary value using dot notation.
    
    Args:
        dictionary: Dictionary to search
        keys: Dot-separated keys (e.g., 'a.b.c')
        default: Default value if key not found
        
    Returns:
        Value or default
    """
    keys_list = keys.split('.')
    current = dictionary
    
    try:
        for key in keys_list:
            current = current[key]
        return current
    except (KeyError, TypeError):
        return default


def deep_set(dictionary: dict, keys: str, value: Any):
    """
    Set nested dictionary value using dot notation.
    
    Args:
        dictionary: Dictionary to modify
        keys: Dot-separated keys (e.g., 'a.b.c')
        value: Value to set
    """
    keys_list = keys.split('.')
    current = dictionary
    
    for key in keys_list[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    
    current[keys_list[-1]] = value


def generate_id(prefix: str = "", length: int = 8) -> str:
    """
    Generate random ID with optional prefix.
    
    Args:
        prefix: Optional prefix
        length: Random part length
        
    Returns:
        Generated ID
    """
    import random
    import string
    
    chars = string.ascii_letters + string.digits
    random_part = ''.join(random.choice(chars) for _ in range(length))
    
    return f"{prefix}{random_part}" if prefix else random_part


def is_valid_json(json_string: str) -> bool:
    """
    Check if string is valid JSON.
    
    Args:
        json_string: String to check
        
    Returns:
        True if valid JSON
    """
    try:
        import json
        json.loads(json_string)
        return True
    except (ValueError, TypeError):
        return False


def bytes_to_hex(data: bytes) -> str:
    """
    Convert bytes to hex string.
    
    Args:
        data: Bytes to convert
        
    Returns:
        Hex string
    """
    return data.hex()


def hex_to_bytes(hex_string: str) -> bytes:
    """
    Convert hex string to bytes.
    
    Args:
        hex_string: Hex string to convert
        
    Returns:
        Bytes
    """
    return bytes.fromhex(hex_string)


def truncate_string(text: str, max_length: int, suffix: str = "...") -> str:
    """
    Truncate string to maximum length.
    
    Args:
        text: Text to truncate
        max_length: Maximum length
        suffix: Suffix to add if truncated
        
    Returns:
        Truncated string
    """
    if len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix


def calculate_age(created_at: Union[int, float, str]) -> float:
    """
    Calculate age from creation timestamp.
    
    Args:
        created_at: Creation timestamp
        
    Returns:
        Age in seconds
    """
    if isinstance(created_at, str):
        created_at = parse_timestamp(created_at)
    elif isinstance(created_at, int):
        created_at = float(created_at)
    
    return time.time() - created_at


def format_duration(seconds: float) -> str:
    """
    Format duration in seconds to human-readable string.
    
    Args:
        seconds: Duration in seconds
        
    Returns:
        Formatted duration string
    """
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    elif seconds < 86400:
        hours = seconds / 3600
        return f"{hours:.1f}h"
    else:
        days = seconds / 86400
        return f"{days:.1f}d"
