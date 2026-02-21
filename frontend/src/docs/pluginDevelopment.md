# Plugin Development Guide

Welcome to the Verinode Plugin Development Guide! This comprehensive guide will help you create, test, and publish plugins that extend Verinode's functionality.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Plugin Structure](#plugin-structure)
3. [Plugin API](#plugin-api)
4. [Permissions](#permissions)
5. [Security Sandbox](#security-sandbox)
6. [Development Workflow](#development-workflow)
7. [Testing](#testing)
8. [Publishing](#publishing)
9. [Best Practices](#best-practices)
10. [Examples](#examples)

## Getting Started

### Prerequisites

- Node.js 16+ 
- TypeScript knowledge
- Basic understanding of React
- Familiarity with Stellar blockchain (optional)

### Quick Start

```bash
# Create a new plugin
npx create-verinode-plugin my-plugin

# Navigate to plugin directory
cd my-plugin

# Install dependencies
npm install

# Start development
npm run dev
```

## Plugin Structure

A typical Verinode plugin has the following structure:

```
my-plugin/
├── src/
│   ├── index.ts          # Main plugin entry point
│   ├── components/       # React components
│   ├── services/         # Business logic
│   └── types/           # TypeScript definitions
├── assets/              # Static assets
├── docs/               # Documentation
├── tests/              # Test files
├── package.json        # Plugin metadata
├── verinode.json       # Plugin manifest
└── README.md          # Plugin description
```

### Plugin Manifest (verinode.json)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A sample Verinode plugin",
  "author": "Your Name",
  "main": "dist/index.js",
  "permissions": [
    {
      "type": "stellar",
      "scope": ["read"],
      "description": "Read Stellar account information"
    },
    {
      "type": "ui",
      "scope": ["notifications"],
      "description": "Show notifications to users"
    }
  ],
  "dependencies": [],
  "verinodeVersion": ">=0.1.0"
}
```

## Plugin API

### Core Interfaces

#### Plugin Interface

```typescript
export interface Plugin {
  metadata: PluginMetadata;
  initialize(context: PluginContext): Promise<void>;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
  destroy?(): Promise<void>;
}
```

#### Plugin Context

```typescript
export interface PluginContext {
  id: string;
  metadata: PluginMetadata;
  storage: PluginStorage;
  events: PluginEventEmitter;
  permissions: PluginPermission[];
  api: PluginAPI;
}
```

### Available APIs

#### Stellar API

```typescript
// Connect to Stellar
const publicKey = await context.api.stellar.connect();

// Get account information
const account = await context.api.stellar.getAccount(publicKey);

// Sign transaction
const signedTx = await context.api.stellar.signTransaction(transaction);

// Submit transaction
const result = await context.api.stellar.submitTransaction(signedTx);
```

#### UI API

```typescript
// Show notification
context.api.ui.showNotification('Hello World!', 'success');

// Show modal
context.api.ui.showModal(MyComponent, { data: 'example' });

// Add menu item
context.api.ui.addMenuItem({
  id: 'my-plugin-action',
  label: 'My Plugin Action',
  action: () => console.log('Action clicked')
});

// Remove menu item
context.api.ui.removeMenuItem('my-plugin-action');
```

#### Network API

```typescript
// Make HTTP request
const response = await context.api.network.request('https://api.example.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'example' })
});

// GET request
const data = await context.api.network.get('https://api.example.com/data');

// POST request
const result = await context.api.network.post('https://api.example.com/create', {
  name: 'Example'
});
```

#### Storage API

```typescript
// Store data
await context.api.storage.set('user-preferences', { theme: 'dark' });

// Retrieve data
const preferences = await context.api.storage.get('user-preferences');

// Delete data
await context.api.storage.delete('user-preferences');

// Clear all data
await context.api.storage.clear();
```

#### Events API

```typescript
// Listen to events
context.api.events.on('stellar:account-changed', (account) => {
  console.log('Account changed:', account);
});

// Emit events
context.api.events.emit('my-plugin:custom-event', { data: 'example' });

// Remove event listener
context.api.events.off('stellar:account-changed', handler);
```

## Permissions

### Permission Types

- **stellar**: Access to Stellar blockchain operations
- **network**: Make HTTP requests to external services
- **storage**: Access to plugin-specific storage
- **ui**: Modify user interface elements
- **events**: Listen to and emit system events
- **filesystem**: Access to local files (restricted)

### Permission Scopes

Each permission type has specific scopes:

#### Stellar Scopes
- `connect`: Connect to Stellar wallet
- `read`: Read account information
- `sign`: Sign transactions
- `submit`: Submit transactions

#### Network Scopes
- `request`: Make any HTTP request
- `read`: Make GET requests
- `write`: Make POST/PUT/DELETE requests

#### UI Scopes
- `notifications`: Show notifications
- `modals`: Show modal dialogs
- `menu`: Add/remove menu items

#### Storage Scopes
- `read`: Read stored data
- `write`: Write stored data
- `delete`: Delete stored data

### Requesting Permissions

Declare permissions in your `verinode.json`:

```json
{
  "permissions": [
    {
      "type": "stellar",
      "scope": ["read", "sign"],
      "description": "Read account info and sign transactions"
    },
    {
      "type": "network",
      "scope": ["request"],
      "description": "Access external API services"
    }
  ]
}
```

## Security Sandbox

### Isolation Model

Verinode plugins run in a secure sandbox environment that:

- Isolates plugin code from the main application
- Restricts access to system resources
- Validates all API calls
- Prevents malicious code execution

### Allowed Domains

Plugins can only make requests to pre-approved domains:

- `https://api.stellar.org`
- `https://horizon.stellar.org`
- `https://soroban.stellar.org`

Additional domains must be requested during plugin review.

### Data Storage

Plugin data is stored in isolated namespaces:

```
localStorage: plugin_{pluginId}_{key}
```

## Development Workflow

### 1. Create Plugin Structure

```bash
mkdir my-verinode-plugin
cd my-verinode-plugin
npm init -y
```

### 2. Setup TypeScript

```bash
npm install -D typescript @types/react @types/node
npx tsc --init
```

### 3. Create Main Plugin File

```typescript
// src/index.ts
import { Plugin, PluginContext } from '@verinode/plugin-api';

export default class MyPlugin implements Plugin {
  metadata = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'A sample Verinode plugin',
    author: 'Your Name',
    permissions: [
      {
        type: 'ui',
        scope: ['notifications'],
        description: 'Show notifications'
      }
    ],
    entryPoint: 'index.js'
  };

  async initialize(context: PluginContext): Promise<void> {
    // Plugin initialization logic
    context.api.ui.showNotification('Plugin initialized!', 'success');
  }

  async activate(): Promise<void> {
    // Plugin activation logic
  }

  async deactivate(): Promise<void> {
    // Plugin deactivation logic
  }

  async destroy(): Promise<void> {
    // Cleanup logic
  }
}
```

### 4. Build Plugin

```bash
npm run build
```

### 5. Test Plugin

```bash
npm run test
```

## Testing

### Unit Testing

```typescript
// tests/plugin.test.ts
import { MyPlugin } from '../src/index';
import { MockPluginContext } from '@verinode/test-utils';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let mockContext: MockPluginContext;

  beforeEach(() => {
    plugin = new MyPlugin();
    mockContext = new MockPluginContext();
  });

  it('should initialize correctly', async () => {
    await plugin.initialize(mockContext);
    expect(mockContext.api.ui.showNotification).toHaveBeenCalledWith(
      'Plugin initialized!',
      'success'
    );
  });
});
```

### Integration Testing

```typescript
// tests/integration.test.ts
import { PluginTestRunner } from '@verinode/test-utils';

describe('Plugin Integration', () => {
  let testRunner: PluginTestRunner;

  beforeEach(() => {
    testRunner = new PluginTestRunner();
  });

  it('should work in Verinode environment', async () => {
    const result = await testRunner.runPlugin('./dist/index.js');
    expect(result.success).toBe(true);
  });
});
```

## Publishing

### 1. Prepare Plugin

```bash
# Run tests
npm test

# Build plugin
npm run build

# Create package
npm pack
```

### 2. Submit to Marketplace

1. Go to [Verinode Plugin Marketplace](https://marketplace.verinode.io)
2. Click "Submit Plugin"
3. Upload your plugin package
4. Fill in plugin details
5. Wait for review

### 3. Review Process

Plugins are reviewed for:
- Security compliance
- Code quality
- User experience
- Documentation completeness

## Best Practices

### 1. Performance

- Minimize API calls
- Use caching appropriately
- Avoid blocking operations
- Optimize bundle size

### 2. Security

- Validate all inputs
- Use HTTPS for network requests
- Don't store sensitive data
- Follow principle of least privilege

### 3. User Experience

- Provide clear error messages
- Use consistent UI patterns
- Handle loading states
- Provide helpful documentation

### 4. Code Quality

- Use TypeScript strictly
- Follow naming conventions
- Write comprehensive tests
- Document public APIs

## Examples

### Simple Notification Plugin

```typescript
export class NotificationPlugin implements Plugin {
  metadata = {
    id: 'notification-plugin',
    name: 'Notification Plugin',
    version: '1.0.0',
    description: 'Shows periodic notifications',
    author: 'Verinode Team',
    permissions: [
      {
        type: 'ui',
        scope: ['notifications'],
        description: 'Show notifications'
      }
    ],
    entryPoint: 'index.js'
  };

  private interval: NodeJS.Timeout;

  async initialize(context: PluginContext): Promise<void> {
    this.interval = setInterval(() => {
      context.api.ui.showNotification(
        'Hello from Notification Plugin!',
        'info'
      );
    }, 60000); // Every minute
  }

  async destroy(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
```

### Stellar Balance Checker

```typescript
export class BalanceCheckerPlugin implements Plugin {
  metadata = {
    id: 'balance-checker',
    name: 'Balance Checker',
    version: '1.0.0',
    description: 'Check Stellar account balance',
    author: 'Verinode Team',
    permissions: [
      {
        type: 'stellar',
        scope: ['read'],
        description: 'Read account balance'
      },
      {
        type: 'ui',
        scope: ['notifications'],
        description: 'Show balance notifications'
      }
    ],
    entryPoint: 'index.js'
  };

  async initialize(context: PluginContext): Promise<void> {
    const publicKey = await context.api.stellar.connect();
    const account = await context.api.stellar.getAccount(publicKey);
    
    context.api.ui.showNotification(
      `Account balance: ${account.balance} XLM`,
      'success'
    );
  }
}
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Check if permissions are declared in manifest
   - Verify user has granted permissions

2. **API Call Failed**
   - Check network connectivity
   - Verify API endpoints are accessible

3. **Plugin Won't Load**
   - Check syntax errors
   - Verify build output
   - Check manifest format

### Debug Mode

Enable debug logging in plugin settings:

```typescript
// In plugin development
console.log('Debug: Plugin initializing');
```

### Getting Help

- [Verinode Discord](https://discord.gg/verinode)
- [GitHub Issues](https://github.com/jobbykingz/Verinode/issues)
- [Documentation](https://docs.verinode.io)

## API Reference

### Complete API documentation is available at:
https://docs.verinode.io/plugin-api

### Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.

---

Happy plugin development! 🚀
