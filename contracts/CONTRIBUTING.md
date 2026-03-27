# Contributing to Verinode

Thank you for your interest in contributing to Verinode! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js (v16+)
- Git
- Stellar CLI (for contract development)
- Basic knowledge of Rust (for Soroban contracts)
- Familiarity with JavaScript/TypeScript

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork the repository on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/Verinode.git
   cd Verinode
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install contract dependencies
   cd contracts
   npm install
   
   # Install backend dependencies
   cd ../backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Set up development environment**
   ```bash
   # Start local Stellar network
   stellar-core --conf stellar-core.cfg --newdb
   
   # Build contracts
   cd contracts
   npm run build
   
   # Start backend
   cd ../backend
   npm run dev
   
   # Start frontend
   cd ../frontend
   npm start
   ```

## How to Contribute

### Reporting Issues

- Use the [issue templates](.github/ISSUE_TEMPLATE/) to report bugs or request features
- Provide clear descriptions and steps to reproduce
- Include relevant logs, screenshots, or examples

### Submitting Pull Requests

1. **Create a new branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run contract tests
   cd contracts && npm test
   
   # Run backend tests
   cd ../backend && npm test
   
   # Run frontend tests
   cd ../frontend && npm test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

### Code Style Guidelines

- **Rust contracts**: Follow [Rust style guidelines](https://rust-lang.github.io/api-guidelines/)
- **JavaScript/TypeScript**: Use ESLint and Prettier configurations
- **Commits**: Follow [Conventional Commits](https://conventionalcommits.org/) format

### Project Structure

```
Verinode/
├── contracts/          # Soroban smart contracts (Rust)
│   ├── src/           # Contract source code
│   ├── tests/         # Contract tests
│   └── Cargo.toml     # Rust dependencies
├── backend/           # Node.js API server
│   ├── src/           # API source code
│   ├── tests/         # Backend tests
│   └── package.json   # Node.js dependencies
├── frontend/          # React Web3 application
│   ├── src/           # React source code
│   ├── public/        # Static assets
│   └── package.json   # Node.js dependencies
├── docs/             # Documentation
├── scripts/          # Deployment and utility scripts
└── .github/          # GitHub templates and workflows
```

## Development Areas

### Smart Contracts (Rust/Soroban)
- Proof verification logic
- Access control mechanisms
- Event management
- Contract optimization

### Backend (Node.js/Express)
- RESTful API endpoints
- Stellar network integration
- Database management
- Authentication and authorization

### Frontend (React/TypeScript)
- Web3 wallet integration (Freighter, etc.)
- User interface for proof issuance/verification
- Real-time updates
- Responsive design

## Getting Help

- **Discussions**: Use [GitHub Discussions](https://github.com/jobbykingz/Verinode/discussions) for questions
- **Discord**: Join our community server
- **Issues**: Check existing issues before creating new ones

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Special contributor badges in the application

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
