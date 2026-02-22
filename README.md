# Verinode

A verification node system with both REST and GraphQL APIs for managing user proofs and verifications.

## Features

- **GraphQL API**: Flexible data queries with real-time subscriptions
- **REST API**: Traditional REST endpoints (for backward compatibility)
- **Authentication**: JWT-based authentication system
- **Real-time Updates**: WebSocket subscriptions for live data
- **Rate Limiting**: Protection against API abuse
- **TypeScript**: Full type safety throughout the application
- **Comprehensive Testing**: Unit tests for all GraphQL features

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Verinode

# Install dependencies
npm install

# Build the project
npm run build

# Start the development server
npm run dev
```

The server will start on `http://localhost:4000`

## API Endpoints

### GraphQL API

- **Endpoint**: `http://localhost:4000/graphql`
- **Playground**: `http://localhost:4000/graphql` (development only)
- **Subscriptions**: `ws://localhost:4000/graphql`

### REST API

- **Base URL**: `http://localhost:4000/api`
- **Authentication**: `/api/auth/login`, `/api/auth/register`
- **Users**: `/api/users/*`
- **Proofs**: `/api/proofs/*`

## GraphQL Schema

The GraphQL API provides the following main types:

- **User**: User accounts and authentication
- **Proof**: Verification proofs with status tracking
- **AuthPayload**: Authentication responses
- **Subscriptions**: Real-time updates for proof changes

### Example Queries

```graphql
# Get current user
query {
  me {
    id
    email
    username
  }
}

# Get paginated proofs
query {
  proofs(first: 10, status: PENDING) {
    edges {
      node {
        id
        title
        description
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

### Example Mutations

```graphql
# Login
mutation {
  login(email: "user@example.com", password: "password") {
    token
    user {
      id
      email
    }
  }
}

# Create proof
mutation {
  createProof(
    title: "My Proof"
    description: "Proof description"
    metadata: { type: "document" }
  ) {
    id
    title
    status
  }
}
```

### Example Subscriptions

```graphql
# Subscribe to proof updates
subscription {
  proofUpdated(userId: "1") {
    id
    title
    status
    updatedAt
  }
}
```

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

For WebSocket subscriptions, include the token in the connection parameters:

```javascript
const wsClient = new SubscriptionClient('ws://localhost:4000/graphql', {
  connectionParams: {
    Authorization: `Bearer ${token}`
  }
});
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

## Development

### Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Project Structure

```
src/
├── graphql/
│   ├── schema.ts              # GraphQL type definitions
│   ├── server.ts              # Apollo Server setup
│   ├── resolvers/             # Query and mutation resolvers
│   │   ├── userResolver.ts
│   │   └── proofResolver.ts
│   ├── subscriptions/        # Subscription handlers
│   │   └── proofSubscription.ts
│   ├── middleware/            # Custom middleware
│   │   ├── auth.ts
│   │   └── rateLimit.ts
│   └── __tests__/            # GraphQL tests
│       ├── resolvers.test.ts
│       └── subscriptions.test.ts
├── types/
│   └── index.ts               # TypeScript type definitions
├── test/
│   └── setup.ts               # Jest test setup
└── index.ts                   # Application entry point
```

### Testing

The project includes comprehensive tests for all GraphQL features:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- resolvers.test.ts
```

## Documentation

- **Migration Guide**: `docs/graphql/migration-guide.md`
- **Schema Documentation**: `docs/graphql/schema-documentation.md`

## Environment Variables

```bash
# Server configuration
PORT=4000
NODE_ENV=development

# JWT configuration (for production)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Database configuration (for production)
DATABASE_URL=your-database-url
```

## Production Deployment

1. Set environment variables
2. Build the project: `npm run build`
3. Start the server: `npm start`

For production, ensure:
- `NODE_ENV=production`
- Use a proper database instead of mock data
- Use a secure JWT secret
- Configure proper CORS origins
- Set up SSL/TLS

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.
