# GitHub Authentication Guide

This guide explains the different types of authentication you'll encounter when working with the Verinode project.

## 📋 Types of Authentication

### 1. **Git Authentication** (Cloning/Pushing)
Used when you interact with your repository from the command line.

#### Personal Access Token (Recommended)
```bash
# Create a Personal Access Token on GitHub
# Settings → Developer settings → Personal access tokens → Tokens (classic)

# Clone the repository
git clone https://github.com/jobbykingz/Verinode.git

# When prompted for credentials, use your token as the password
Username: your-github-username
Password: your-personal-access-token
```

#### SSH Key (Alternative)
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add SSH key to GitHub account
# Settings → SSH and GPG keys → New SSH key

# Clone using SSH
git clone git@github.com:jobbykingz/Verinode.git
```

### 2. **GitHub Actions Authentication** (CI/CD)
Automatically handled by GitHub when you push to the repository.

```yaml
# .github/workflows/ci.yml
# GitHub automatically provides a token (GITHUB_TOKEN)
# This token has permissions to:
# - Clone the repository
# - Create issues
# - Comment on pull requests
# - Upload artifacts
```

### 3. **Application Authentication** (Stellar/Web3)
Used when your application needs to interact with Stellar blockchain.

#### Freighter Wallet (Browser Extension)
```javascript
// Frontend authentication with Freighter
const isConnected = await window.freighter.isConnected();
const publicKey = await window.freighter.getPublicKey();
```

#### API Keys (Backend Services)
```javascript
// .env file
STELLAR_SECRET_KEY=your_secret_key
STELLAR_NETWORK=testnet

// Backend usage
const server = new StellarServer('https://horizon-testnet.stellar.org');
const keypair = StellarKeypair.fromSecret(STELLAR_SECRET_KEY);
```

## 🔧 Setting Up Authentication

### Step 1: Create Personal Access Token
1. Go to GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Click "Generate new token"
4. Select scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Copy the token (save it securely!)

### Step 2: Configure Git
```bash
# Set up your Git identity
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# Test authentication
git ls-remote https://github.com/jobbykingz/Verinode.git
```

### Step 3: Clone and Work
```bash
# Clone the repository
git clone https://github.com/jobbykingz/Verinode.git
cd Verinode

# Make changes
git add .
git commit -m "feat: add new feature"
git push origin main
```

## 🛡️ Security Best Practices

### Never Commit Secrets
```bash
# ❌ NEVER do this
git add .env
git commit -m "add api keys"

# ✅ Use .gitignore
echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
```

### Use Environment Variables
```javascript
// backend/src/config.js
require('dotenv').config();

module.exports = {
  stellarSecretKey: process.env.STELLAR_SECRET_KEY,
  stellarNetwork: process.env.STELLAR_NETWORK || 'testnet',
  jwtSecret: process.env.JWT_SECRET,
};
```

### Rotate Tokens Regularly
- Personal Access Tokens: Every 90 days
- API Keys: Every 30 days
- Secrets: Immediately if compromised

## 🔍 Troubleshooting

### Common Issues

#### "Authentication failed" Error
```bash
# Solution: Check your token
git config --global credential.helper store
# Try cloning again with fresh credentials
```

#### "Permission denied" Error
```bash
# Solution: Check token permissions
# Make sure your PAT has 'repo' scope
# Or that you're a collaborator on the repository
```

#### "403 Forbidden" on GitHub Actions
```yaml
# Solution: Add permissions to workflow
permissions:
  contents: read
  issues: write
  pull-requests: write
```

## 📚 Additional Resources

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [SSH Key Authentication](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Stellar Authentication](https://stellar.org/developers/guides/get-started/authentication)
- [Environment Variables Best Practices](https://12factor.net/config)

## 🆘 Getting Help

If you're having authentication issues:

1. **Check your token** - Is it expired? Does it have the right scopes?
2. **Verify permissions** - Are you a repository collaborator?
3. **Test connection** - Can you access the repository in your browser?
4. **Ask for help** - Create an issue in the repository with details

---

Remember: Authentication is about proving who you are. Keep your credentials secure and never share them publicly! 🔒
