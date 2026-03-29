#!/bin/bash
set -e

echo "Starting Security Scan..."

# 1. Dependency Audit
echo "Running npm audit..."
npm audit --audit-level=high --omit=dev

# 2. Container Scan (if trivy is installed)
if command -v trivy &> /dev/null; then
    echo "Running Trivy filesystem scan..."
    trivy fs --security-checks vuln,config,secret .
else
    echo "Trivy not found, skipping container scan."
fi

# 3. Secret Scan (Basic grep check)
echo "Scanning for potential leaked secrets..."
grep -r "API_KEY" . --exclude-dir=node_modules --exclude-dir=.git || true

echo "Security scan completed."