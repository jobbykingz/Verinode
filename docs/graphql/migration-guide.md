# REST to GraphQL Migration Guide

This guide helps you migrate from the REST API to the new GraphQL API in Verinode.

## Overview

The GraphQL API provides the same functionality as the REST API but with additional benefits:
- **Flexible queries**: Request only the data you need
- **Real-time subscriptions**: Get instant updates when data changes
- **Single endpoint**: All operations go through `/graphql`
- **Strong typing**: Built-in schema validation and documentation

## Authentication

Both APIs use the same authentication method. Include your JWT token in the Authorization header:

```bash
# REST
Authorization: Bearer <your-jwt-token>

# GraphQL
Authorization: Bearer <your-jwt-token>
```

## Endpoint Mapping

### Users

| REST Endpoint | GraphQL Query/Mutation |
|---------------|------------------------|
| `GET /api/users/me` | `query { me { id email username } }` |
| `GET /api/users/:id` | `query { user(id: "1") { id email username } }` |
| `GET /api/users` | `query { users { id email username } }` |
| `POST /api/auth/login` | `mutation { login(email: "user@example.com", password: "password") { token user { id email } } }` |
| `POST /api/auth/register` | `mutation { register(email: "user@example.com", username: "user", password: "password") { token user { id email } } }` |

### Proofs

| REST Endpoint | GraphQL Query/Mutation |
|---------------|------------------------|
| `GET /api/proofs/:id` | `query { proof(id: "1") { id title description status } }` |
| `GET /api/proofs` | `query { proofs(first: 10) { edges { node { id title } } totalCount } }` |
| `GET /api/users/:userId/proofs` | `query { proofs(userId: "1") { edges { node { id title } } } }` |
| `POST /api/proofs` | `mutation { createProof(title: "Title", description: "Description") { id title status } }` |
| `PUT /api/proofs/:id` | `mutation { updateProof(id: "1", title: "New Title") { id title } }` |
| `DELETE /api/proofs/:id` | `mutation { deleteProof(id: "1") }` |

## Migration Steps

### 1. Update Your Client

Replace REST API calls with GraphQL queries:

```javascript
// Before (REST)
const response = await fetch('/api/proofs', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const proofs = await response.json();

// After (GraphQL)
const response = await fetch('/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: `
      query {
        proofs(first: 10) {
          edges {
            node {
              id
              title
              description
              status
            }
          }
          totalCount
        }
      }
    `
  })
});
const { data } = await response.json();
const proofs = data.proofs;
```

### 2. Use GraphQL Client Libraries

Consider using a GraphQL client library for better developer experience:

```javascript
// Using Apollo Client
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: '/graphql',
  cache: new InMemoryCache(),
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const GET_PROOFS = gql`
  query GetProofs($first: Int, $userId: ID) {
    proofs(first: $first, userId: $userId) {
      edges {
        node {
          id
          title
          description
          status
        }
      }
      totalCount
    }
  }
`;

const { data } = await client.query({
  query: GET_PROOFS,
  variables: { first: 10 }
});
```

### 3. Implement Real-time Updates

Replace polling with GraphQL subscriptions:

```javascript
// Before (REST with polling)
setInterval(async () => {
  const response = await fetch('/api/proofs');
  const proofs = await response.json();
  updateUI(proofs);
}, 5000);

// After (GraphQL subscriptions)
import { SubscriptionClient } from 'subscriptions-transport-ws';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const wsClient = new SubscriptionClient('ws://localhost:4000/graphql', {
  reconnect: true,
  connectionParams: {
    Authorization: `Bearer ${token}`
  }
});

const client = new ApolloClient({
  link: new WebSocketLink(wsClient),
  cache: new InMemoryCache()
});

const PROOF_UPDATED = gql`
  subscription ProofUpdated($userId: ID) {
    proofUpdated(userId: $userId) {
      id
      title
      description
      status
    }
  }
`;

client.subscribe({
  query: PROOF_UPDATED,
  variables: { userId: '1' }
}).subscribe({
  next: ({ data }) => {
    updateProofInUI(data.proofUpdated);
  }
});
```

## Benefits of Migration

### 1. Reduced Data Transfer

```graphql
# Request only what you need
query {
  proof(id: "1") {
    id
    title
    status
    # No description, createdAt, etc. if not needed
  }
}
```

### 2. Single Request for Multiple Resources

```graphql
# Get user and their proofs in one request
query {
  me {
    id
    username
  }
  myProofs {
    edges {
      node {
        id
        title
        status
      }
    }
  }
}
```

### 3. Real-time Updates

```graphql
# Subscribe to proof updates
subscription {
  proofUpdated(userId: "1") {
    id
    title
    status
  }
}
```

## Error Handling

GraphQL errors are structured differently from REST:

```javascript
// REST errors
{
  "error": "Proof not found",
  "status": 404
}

// GraphQL errors
{
  "errors": [
    {
      "message": "Proof not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["proof"],
      "extensions": { "code": "NOT_FOUND" }
    }
  ],
  "data": {
    "proof": null
  }
}
```

## Rate Limiting

GraphQL has different rate limits than REST:
- **Queries**: 60 requests per minute
- **Mutations**: 30 requests per minute  
- **Authentication**: 5 attempts per 15 minutes

## Testing

Use the GraphQL Playground at `http://localhost:4000/graphql` to test queries before implementing them in your code.

## Common Migration Patterns

### 1. Pagination

```javascript
// REST pagination
const response = await fetch('/api/proofs?page=1&limit=10');

// GraphQL pagination
const response = await fetch('/graphql', {
  body: JSON.stringify({
    query: `
      query($first: Int, $after: String) {
        proofs(first: $first, after: $after) {
          edges { node { id title } }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    `,
    variables: { first: 10 }
  })
});
```

### 2. Filtering

```javascript
// REST filtering
const response = await fetch('/api/proofs?status=pending&userId=1');

// GraphQL filtering
const response = await fetch('/graphql', {
  body: JSON.stringify({
    query: `
      query($status: ProofStatus, $userId: ID) {
        proofs(status: $status, userId: $userId) {
          edges { node { id title } }
        }
      }
    `,
    variables: { status: 'PENDING', userId: '1' }
  })
});
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure your JWT token is included in the Authorization header
2. **Rate Limiting**: GraphQL has different rate limits than REST
3. **Query Complexity**: Large queries may hit complexity limits
4. **Subscription Connection**: WebSocket connections require proper authentication

### Getting Help

- Check the GraphQL schema documentation: `/docs/graphql/schema-documentation.md`
- Use the GraphQL Playground for testing queries
- Review the test files in `src/graphql/__tests__/` for examples

## Next Steps

1. Start with read-only queries (migrate GET requests)
2. Add mutations (migrate POST/PUT/DELETE requests)
3. Implement subscriptions for real-time features
4. Optimize queries to request only needed data
5. Add error handling for GraphQL-specific errors

This migration will provide a more efficient and flexible API experience for your Verinode application.
