# GraphQL Schema Documentation

This document provides detailed information about the Verinode GraphQL schema, including all types, queries, mutations, and subscriptions.

## Schema Overview

The GraphQL schema is organized into the following main types:
- **User**: Represents user accounts
- **Proof**: Represents verification proofs
- **AuthPayload**: Authentication response
- **ProofConnection**: Paginated proof results

## Types

### User

Represents a user account in the system.

```graphql
type User {
  id: ID!
  email: String!
  username: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

**Fields:**
- `id`: Unique identifier for the user
- `email`: User's email address
- `username`: User's display name
- `createdAt`: When the user account was created
- `updatedAt`: When the user account was last updated

### Proof

Represents a verification proof submitted by a user.

```graphql
type Proof {
  id: ID!
  userId: ID!
  title: String!
  description: String!
  status: ProofStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
}
```

**Fields:**
- `id`: Unique identifier for the proof
- `userId`: ID of the user who created the proof
- `title`: Proof title
- `description`: Detailed description of the proof
- `status`: Current status of the proof
- `createdAt`: When the proof was created
- `updatedAt`: When the proof was last updated
- `metadata`: Additional JSON data associated with the proof

### ProofStatus

Enumeration of possible proof statuses.

```graphql
enum ProofStatus {
  PENDING
  VERIFIED
  REJECTED
}
```

**Values:**
- `PENDING`: Proof is awaiting review
- `VERIFIED`: Proof has been verified and approved
- `REJECTED`: Proof has been rejected

### AuthPayload

Authentication response containing token and user information.

```graphql
type AuthPayload {
  token: String!
  user: User!
}
```

**Fields:**
- `token`: JWT authentication token
- `user`: Authenticated user object

### ProofConnection

Paginated connection type for proof queries.

```graphql
type ProofConnection {
  edges: [ProofEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

**Fields:**
- `edges`: Array of proof edges
- `pageInfo`: Pagination information
- `totalCount`: Total number of proofs matching the query

### ProofEdge

Edge type for proof connections.

```graphql
type ProofEdge {
  node: Proof!
  cursor: String!
}
```

**Fields:**
- `node`: The proof object
- `cursor`: Cursor for pagination

### PageInfo

Pagination information for connections.

```graphql
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

**Fields:**
- `hasNextPage`: Whether there are more items forward
- `hasPreviousPage`: Whether there are more items backward
- `startCursor`: Cursor for the first item
- `endCursor`: Cursor for the last item

## Queries

### User Queries

#### me

Get the currently authenticated user.

```graphql
me: User
```

**Authentication:** Required

**Example:**
```graphql
query {
  me {
    id
    email
    username
    createdAt
  }
}
```

#### user

Get a specific user by ID.

```graphql
user(id: ID!): User
```

**Arguments:**
- `id`: User ID to retrieve

**Example:**
```graphql
query {
  user(id: "1") {
    id
    email
    username
  }
}
```

#### users

Get all users.

```graphql
users: [User!]!
```

**Example:**
```graphql
query {
  users {
    id
    email
    username
  }
}
```

### Proof Queries

#### proof

Get a specific proof by ID.

```graphql
proof(id: ID!): Proof
```

**Arguments:**
- `id`: Proof ID to retrieve

**Example:**
```graphql
query {
  proof(id: "1") {
    id
    title
    description
    status
    createdAt
  }
}
```

#### proofs

Get paginated list of proofs with optional filtering.

```graphql
proofs(
  userId: ID
  status: ProofStatus
  first: Int
  after: String
): ProofConnection!
```

**Arguments:**
- `userId`: Filter by user ID (optional)
- `status`: Filter by proof status (optional)
- `first`: Number of items to return (default: 10)
- `after`: Cursor for pagination (optional)

**Example:**
```graphql
query {
  proofs(first: 5, status: PENDING) {
    edges {
      node {
        id
        title
        status
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

#### myProofs

Get proofs for the currently authenticated user.

```graphql
myProofs(
  status: ProofStatus
  first: Int
  after: String
): ProofConnection!
```

**Authentication:** Required

**Arguments:**
- `status`: Filter by proof status (optional)
- `first`: Number of items to return (default: 10)
- `after`: Cursor for pagination (optional)

**Example:**
```graphql
query {
  myProofs(status: PENDING) {
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
```

## Mutations

### Authentication Mutations

#### login

Authenticate a user and return a JWT token.

```graphql
login(email: String!, password: String!): AuthPayload!
```

**Arguments:**
- `email`: User's email address
- `password`: User's password

**Example:**
```graphql
mutation {
  login(email: "user@example.com", password: "password") {
    token
    user {
      id
      email
      username
    }
  }
}
```

#### register

Register a new user account.

```graphql
register(
  email: String!
  username: String!
  password: String!
): AuthPayload!
```

**Arguments:**
- `email`: User's email address
- `username`: User's display name
- `password`: User's password

**Example:**
```graphql
mutation {
  register(
    email: "newuser@example.com"
    username: "newuser"
    password: "password"
  ) {
    token
    user {
      id
      email
      username
    }
  }
}
```

### Proof Mutations

#### createProof

Create a new proof.

```graphql
createProof(
  title: String!
  description: String!
  metadata: JSON
): Proof!
```

**Authentication:** Required

**Arguments:**
- `title`: Proof title
- `description`: Proof description
- `metadata`: Additional JSON data (optional)

**Example:**
```graphql
mutation {
  createProof(
    title: "My New Proof"
    description: "This is a detailed description"
    metadata: { type: "document", tags: ["important"] }
  ) {
    id
    title
    description
    status
    createdAt
  }
}
```

#### updateProof

Update an existing proof.

```graphql
updateProof(
  id: ID!
  title: String
  description: String
  status: ProofStatus
): Proof!
```

**Authentication:** Required

**Arguments:**
- `id`: Proof ID to update
- `title`: New title (optional)
- `description`: New description (optional)
- `status`: New status (optional)

**Example:**
```graphql
mutation {
  updateProof(
    id: "1"
    title: "Updated Title"
    status: VERIFIED
  ) {
    id
    title
    status
    updatedAt
  }
}
```

#### deleteProof

Delete a proof.

```graphql
deleteProof(id: ID!): Boolean!
```

**Authentication:** Required

**Arguments:**
- `id`: Proof ID to delete

**Example:**
```graphql
mutation {
  deleteProof(id: "1")
}
```

## Subscriptions

### proofUpdated

Subscribe to proof updates for a specific user.

```graphql
proofUpdated(userId: ID): Proof!
```

**Arguments:**
- `userId`: Filter updates by user ID (optional)

**Example:**
```graphql
subscription {
  proofUpdated(userId: "1") {
    id
    title
    status
    updatedAt
  }
}
```

### proofCreated

Subscribe to new proof creation events.

```graphql
proofCreated: Proof!
```

**Example:**
```graphql
subscription {
  proofCreated {
    id
    title
    userId
    createdAt
  }
}
```

### proofStatusChanged

Subscribe to proof status change events.

```graphql
proofStatusChanged(status: ProofStatus): Proof!
```

**Arguments:**
- `status`: Filter by specific status (optional)

**Example:**
```graphql
subscription {
  proofStatusChanged(status: VERIFIED) {
    id
    title
    status
    updatedAt
  }
}
```

## Custom Scalars

### DateTime

ISO-8601 formatted date/time string.

**Example:** `"2024-01-01T12:00:00Z"`

### JSON

Arbitrary JSON data.

**Example:** `{ "key": "value", "array": [1, 2, 3] }`

## Error Handling

The API returns structured errors for various scenarios:

### Authentication Errors

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": { "code": "UNAUTHENTICATED" }
    }
  ]
}
```

### Validation Errors

```json
{
  "errors": [
    {
      "message": "Proof not found or access denied",
      "extensions": { "code": "NOT_FOUND" }
    }
  ]
}
```

### Rate Limiting Errors

```json
{
  "errors": [
    {
      "message": "Too many requests, please try again later.",
      "extensions": { "code": "RATE_LIMITED" }
    }
  ]
}
```

## Rate Limiting

Different rate limits apply to different operation types:

- **Queries**: 60 requests per minute
- **Mutations**: 30 requests per minute
- **Authentication**: 5 attempts per 15 minutes

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests for the window
- `X-RateLimit-Remaining`: Remaining requests in the window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

## Testing

Use the GraphQL Playground at `http://localhost:4000/graphql` to interactively test queries, mutations, and subscriptions.

The playground provides:
- Auto-completion for queries
- Schema documentation explorer
- Real-time subscription testing
- Query history
