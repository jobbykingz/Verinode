# REST API Documentation - Proof Management

This document provides comprehensive documentation for the REST API endpoints for proof creation, verification, and management.

## Overview

The Verinode Proof Management API provides a complete set of endpoints for managing cryptographic proofs with proper error handling, security, and rate limiting.

## Base URL

```
https://api.verinode.com/api/proofs
```

## Authentication

All endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

Different endpoints have different rate limits:

- **General endpoints**: 100 requests per 15 minutes
- **Proof creation**: 50 requests per hour
- **Verification**: 30 requests per 15 minutes
- **Batch operations**: 10 requests per hour
- **Search**: 50 requests per 15 minutes
- **Export**: 5 requests per hour
- **Sharing**: 25 requests per hour

## Response Format

All responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "timestamp": "2024-02-25T10:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "details": { ... },
  "timestamp": "2024-02-25T10:00:00.000Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2024-02-25T10:00:00.000Z"
}
```

## Endpoints

### 1. Create Proof

**POST** `/api/proofs`

Creates a new cryptographic proof.

#### Request Body
```json
{
  "title": "Proof Title",
  "description": "Proof description",
  "proofType": "identity|education|employment|financial|health|legal|property|digital|custom",
  "metadata": {
    "key": "value",
    "additional": "data"
  },
  "eventData": {
    "event": "data",
    "timestamp": "2024-02-25T10:00:00.000Z"
  },
  "recipientAddress": "recipient@example.com",
  "tags": ["tag1", "tag2"]
}
```

#### Response
```json
{
  "success": true,
  "message": "Proof created successfully",
  "data": {
    "id": "proof_1234567890_abc123",
    "title": "Proof Title",
    "description": "Proof description",
    "proofType": "identity",
    "metadata": { ... },
    "eventData": { ... },
    "recipientAddress": "recipient@example.com",
    "tags": ["tag1", "tag2"],
    "hash": "sha256_hash_value",
    "status": "draft",
    "createdBy": "user_id",
    "createdAt": "2024-02-25T10:00:00.000Z",
    "updatedAt": "2024-02-25T10:00:00.000Z"
  }
}
```

#### Validation Rules
- `title`: Required, 1-200 characters
- `description`: Required, 1-2000 characters
- `proofType`: Required, must be one of the allowed types
- `metadata`: Optional, object
- `eventData`: Optional, object
- `recipientAddress`: Optional, valid email
- `tags`: Optional, array of strings (1-50 characters each)

---

### 2. Get User Proofs

**GET** `/api/proofs/user`

Retrieves proofs belonging to the authenticated user with filtering and pagination.

#### Query Parameters
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 10, min: 1, max: 100)
- `status`: Filter by status (`draft|verified|verification_failed|revoked`)
- `proofType`: Filter by proof type
- `sortBy`: Sort field (`createdAt|updatedAt|title|status|proofType`)
- `sortOrder`: Sort order (`asc|desc`)
- `search`: Search query

#### Example Request
```
GET /api/proofs/user?page=1&limit=10&status=verified&sortBy=createdAt&sortOrder=desc
```

#### Response
```json
{
  "success": true,
  "message": "User proofs retrieved successfully",
  "data": [
    {
      "id": "proof_1234567890_abc123",
      "title": "Proof Title",
      "status": "verified",
      "createdAt": "2024-02-25T10:00:00.000Z",
      "verifiedAt": "2024-02-25T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 3. Get Proof by ID

**GET** `/api/proofs/{id}`

Retrieves a specific proof by ID.

#### Path Parameters
- `id`: Proof ID

#### Response
```json
{
  "success": true,
  "message": "Proof retrieved successfully",
  "data": {
    "id": "proof_1234567890_abc123",
    "title": "Proof Title",
    "description": "Proof description",
    "proofType": "identity",
    "metadata": { ... },
    "eventData": { ... },
    "hash": "sha256_hash_value",
    "status": "verified",
    "verifiedAt": "2024-02-25T10:30:00.000Z",
    "verifiedBy": "verifier_id",
    "createdBy": "user_id",
    "createdAt": "2024-02-25T10:00:00.000Z",
    "updatedAt": "2024-02-25T10:30:00.000Z",
    "verificationHistory": [ ... ],
    "sharedWith": [ ... ]
  }
}
```

---

### 4. Update Proof

**PUT** `/api/proofs/{id}`

Updates an existing proof.

#### Path Parameters
- `id`: Proof ID

#### Request Body
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "metadata": {
    "new": "metadata"
  },
  "eventData": {
    "updated": "data"
  },
  "recipientAddress": "new@example.com",
  "tags": ["new", "tags"]
}
```

#### Response
```json
{
  "success": true,
  "message": "Proof updated successfully",
  "data": {
    "id": "proof_1234567890_abc123",
    "title": "Updated Title",
    "description": "Updated description",
    "updatedAt": "2024-02-25T11:00:00.000Z"
  }
}
```

---

### 5. Delete Proof

**DELETE** `/api/proofs/{id}`

Deletes a proof permanently.

#### Path Parameters
- `id`: Proof ID

#### Response
```json
{
  "success": true,
  "message": "Proof deleted successfully",
  "data": null
}
```

---

### 6. Verify Proof

**POST** `/api/proofs/{id}/verify`

Verifies a cryptographic proof.

#### Path Parameters
- `id`: Proof ID

#### Request Body
```json
{
  "verificationMethod": "manual|automated|blockchain|external",
  "additionalData": {
    "notes": "Verification notes",
    "confidence": 0.95
  }
}
```

#### Response
```json
{
  "success": true,
  "message": "Proof verification completed",
  "data": {
    "proof": {
      "id": "proof_1234567890_abc123",
      "status": "verified",
      "verifiedAt": "2024-02-25T10:30:00.000Z",
      "verifiedBy": "verifier_id"
    },
    "verificationResult": {
      "isValid": true,
      "verifiedAt": "2024-02-25T10:30:00.000Z",
      "verifiedBy": "verifier_id",
      "method": "manual",
      "details": {
        "notes": "Verification notes",
        "confidence": 0.95
      }
    }
  }
}
```

---

### 7. Batch Operations

**POST** `/api/proofs/batch`

Processes multiple proof operations in a single request.

#### Request Body
```json
{
  "operations": [
    {
      "type": "create",
      "data": {
        "title": "Batch Proof 1",
        "description": "Description",
        "proofType": "identity"
      }
    },
    {
      "type": "verify",
      "proofId": "proof_1234567890_abc123",
      "verificationMethod": "manual"
    },
    {
      "type": "update",
      "proofId": "proof_1234567890_def456",
      "data": {
        "title": "Updated Title"
      }
    },
    {
      "type": "delete",
      "proofId": "proof_1234567890_ghi789"
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "message": "Batch operations completed successfully",
  "data": {
    "results": [
      {
        "operation": "create",
        "success": true,
        "data": { "id": "proof_new123", ... }
      },
      {
        "operation": "verify",
        "success": true,
        "data": { "isValid": true, ... }
      },
      {
        "operation": "update",
        "success": false,
        "error": "Proof not found"
      }
    ],
    "summary": {
      "total": 4,
      "successful": 3,
      "failed": 1
    }
  }
}
```

#### Validation Rules
- Maximum 100 operations per batch
- Each operation must specify a valid type
- Proof ID required for update, verify, and delete operations
- Data required for create and update operations

---

### 8. Get Proof Statistics

**GET** `/api/proofs/stats`

Retrieves proof statistics for the authenticated user.

#### Query Parameters
- `timeRange`: Time range for statistics (`7d|30d|90d`, default: `30d`)

#### Response
```json
{
  "success": true,
  "message": "Proof statistics retrieved successfully",
  "data": {
    "totalProofs": 150,
    "verifiedProofs": 120,
    "draftProofs": 25,
    "failedProofs": 5,
    "verificationRate": 80.0,
    "uniqueProofTypes": 6,
    "avgVerificationTime": 1800000,
    "timeRange": "30d"
  }
}
```

---

### 9. Search Proofs

**GET** `/api/proofs/search`

Searches proofs with advanced filtering.

#### Query Parameters
- `q`: Search query (required)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `proofType`: Filter by proof type
- `status`: Filter by status
- `tags`: Filter by tags (comma-separated)
- `dateFrom`: Start date (ISO 8601)
- `dateTo`: End date (ISO 8601)
- `sortBy`: Sort field (`relevance|createdAt|title`)
- `sortOrder`: Sort order (`asc|desc`)

#### Example Request
```
GET /api/proofs/search?q=identity&proofType=identity&status=verified&page=1&limit=10
```

#### Response
```json
{
  "success": true,
  "message": "Search results retrieved successfully",
  "data": [
    {
      "id": "proof_1234567890_abc123",
      "title": "Identity Proof",
      "description": "User identity verification",
      "proofType": "identity",
      "status": "verified",
      "relevanceScore": 0.95
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

---

### 10. Export Proofs

**GET** `/api/proofs/export`

Exports proofs in JSON or CSV format.

#### Query Parameters
- `format`: Export format (`json|csv`, default: `json`)
- `proofType`: Filter by proof type
- `status`: Filter by status
- `dateFrom`: Start date (ISO 8601)
- `dateTo`: End date (ISO 8601)

#### Response
- **Content-Type**: `application/json` or `text/csv`
- **Content-Disposition**: `attachment; filename="proofs_export_2024-02-25.json"`

---

### 11. Get Proof History

**GET** `/api/proofs/{id}/history`

Retrieves the audit trail for a specific proof.

#### Path Parameters
- `id`: Proof ID

#### Response
```json
{
  "success": true,
  "message": "Proof history retrieved successfully",
  "data": [
    {
      "verifiedAt": "2024-02-25T10:30:00.000Z",
      "verifiedBy": "verifier_id",
      "method": "manual",
      "result": true,
      "details": {
        "notes": "Manual verification completed"
      }
    },
    {
      "verifiedAt": "2024-02-25T09:00:00.000Z",
      "verifiedBy": "system",
      "method": "automated",
      "result": false,
      "details": {
        "error": "Hash mismatch detected"
      }
    }
  ]
}
```

---

### 12. Share Proof

**POST** `/api/proofs/{id}/share`

Shares a proof with another user.

#### Path Parameters
- `id`: Proof ID

#### Request Body
```json
{
  "recipientEmail": "recipient@example.com",
  "permissions": ["view", "edit", "share", "verify"],
  "message": "Please review this proof"
}
```

#### Response
```json
{
  "success": true,
  "message": "Proof shared successfully",
  "data": {
    "shareId": "share_abc123def456",
    "recipientEmail": "recipient@example.com",
    "permissions": ["view", "edit"],
    "message": "Please review this proof",
    "sharedAt": "2024-02-25T10:00:00.000Z",
    "sharedBy": "user_id"
  }
}
```

## Error Codes

| Status Code | Description | Example |
|-------------|-------------|---------|
| 200 | Success | Operation completed successfully |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

## Validation Errors

Validation errors return detailed information about what failed:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title must be between 1 and 200 characters",
      "value": ""
    },
    {
      "field": "proofType",
      "message": "Invalid proof type",
      "value": "invalid-type"
    }
  ]
}
```

## Rate Limiting Errors

When rate limits are exceeded:

```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": "15 minutes",
  "limit": 100,
  "windowMs": 900000
}
```

## Security Features

### Authentication
- JWT-based authentication
- Token expiration handling
- User permission validation

### Rate Limiting
- User-based rate limiting
- Tier-based limits (free/premium/enterprise)
- Endpoint-specific limits

### Input Validation
- Comprehensive input sanitization
- SQL injection prevention
- XSS protection

### Access Control
- Resource ownership validation
- Permission-based access
- Admin-only endpoints

## Testing

### Unit Tests
Run unit tests:
```bash
npm test
```

### Integration Tests
Run integration tests:
```bash
npm run test:integration
```

### Performance Tests
Run performance tests:
```bash
npm run test:performance
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { VerinodeAPI } from '@verinode/sdk';

const api = new VerinodeAPI({
  baseURL: 'https://api.verinode.com',
  apiKey: 'your-api-key'
});

// Create a proof
const proof = await api.proofs.create({
  title: 'My Proof',
  description: 'Proof description',
  proofType: 'identity'
});

// Verify a proof
const verification = await api.proofs.verify(proof.id, {
  verificationMethod: 'manual'
});
```

### Python
```python
from verinode_sdk import VerinodeAPI

api = VerinodeAPI(
    base_url='https://api.verinode.com',
    api_key='your-api-key'
)

# Create a proof
proof = api.proofs.create({
    'title': 'My Proof',
    'description': 'Proof description',
    'proof_type': 'identity'
})

# Verify a proof
verification = api.proofs.verify(proof['id'], {
    'verification_method': 'manual'
})
```

## Best Practices

1. **Authentication**: Always include a valid JWT token
2. **Rate Limiting**: Implement exponential backoff for rate limit errors
3. **Pagination**: Use pagination for large datasets
4. **Error Handling**: Always check the `success` field in responses
5. **Validation**: Validate input data before sending requests
6. **Security**: Never expose API keys in client-side code

## Support

For API support and questions:
- Documentation: https://docs.verinode.com
- Support: support@verinode.com
- Status: https://status.verinode.com
