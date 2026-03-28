# Verinode SDK Testing Infrastructure

This directory contains the comprehensive testing infrastructure for all Verinode SDKs. The testing suite ensures quality, consistency, and reliability across all supported programming languages.

## Testing Strategy

### Test Categories

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test SDK interactions with real API
3. **End-to-End Tests**: Test complete workflows
4. **Performance Tests**: Measure performance characteristics
5. **Compatibility Tests**: Ensure cross-platform compatibility

### Test Coverage Goals

- **Code Coverage**: Minimum 90% line coverage
- **API Coverage**: 100% of public API methods
- **Error Scenarios**: All error paths tested
- **Edge Cases**: Boundary conditions and unusual inputs

## Language-Specific Testing

### Python Testing

#### Structure
```
tests/sdks/python/
├── unit/                 # Unit tests
│   ├── test_client.py
│   ├── test_services.py
│   ├── test_config.py
│   └── test_utils.py
├── integration/          # Integration tests
│   ├── test_auth.py
│   ├── test_proofs.py
│   ├── test_verifications.py
│   └── test_wallets.py
├── e2e/                 # End-to-end tests
│   ├── test_workflows.py
│   └── test_realtime.py
├── performance/          # Performance tests
│   ├── test_benchmarks.py
│   └── test_load.py
└── conftest.py          # Pytest configuration
```

#### Running Tests
```bash
# Install test dependencies
pip install -r sdks/python/requirements-dev.txt

# Run all tests
pytest tests/sdks/python/

# Run with coverage
pytest tests/sdks/python/ --cov=verinode --cov-report=html

# Run specific test categories
pytest tests/sdks/python/unit/
pytest tests/sdks/python/integration/
pytest tests/sdks/python/e2e/

# Run performance tests
pytest tests/sdks/python/performance/ --benchmark-only
```

### Go Testing

#### Structure
```
tests/sdks/go/
├── unit/                 # Unit tests
│   ├── client_test.go
│   ├── services_test.go
│   ├── config_test.go
│   └── utils_test.go
├── integration/          # Integration tests
│   ├── auth_test.go
│   ├── proofs_test.go
│   ├── verifications_test.go
│   └── wallets_test.go
├── e2e/                 # End-to-end tests
│   ├── workflows_test.go
│   └── realtime_test.go
├── benchmark/           # Performance tests
│   ├── benchmarks_test.go
│   └── load_test.go
└── testutils/           # Test utilities
    ├── mocks.go
    └── helpers.go
```

#### Running Tests
```bash
# Navigate to Go SDK directory
cd sdks/go

# Run all tests
go test ./... -v

# Run with coverage
go test ./... -cover -coverprofile=coverage.out
go tool cover -html=coverage.out

# Run specific test categories
go test ./unit/... -v
go test ./integration/... -v
go test ./e2e/... -v

# Run benchmarks
go test ./benchmark/... -bench=. -benchmem
```

### Rust Testing

#### Structure
```
tests/sdks/rust/
├── unit/                 # Unit tests
│   ├── client_tests.rs
│   ├── services_tests.rs
│   ├── config_tests.rs
│   └── utils_tests.rs
├── integration/          # Integration tests
│   ├── auth_tests.rs
│   ├── proofs_tests.rs
│   ├── verifications_tests.rs
│   └── wallets_tests.rs
├── e2e/                 # End-to-end tests
│   ├── workflows_tests.rs
│   └── realtime_tests.rs
├── performance/          # Performance tests
│   ├── benchmarks.rs
│   └── load_tests.rs
└── common/              # Test utilities
    ├── mocks.rs
    └── helpers.rs
```

#### Running Tests
```bash
# Navigate to Rust SDK directory
cd sdks/rust

# Run all tests
cargo test

# Run with coverage
cargo tarpaulin --out Html

# Run specific test categories
cargo test unit
cargo test integration
cargo test e2e

# Run benchmarks
cargo bench
```

### Java Testing

#### Structure
```
tests/sdks/java/
├── unit/                 # Unit tests
│   ├── ClientTest.java
│   ├── ServicesTest.java
│   ├── ConfigTest.java
│   └── UtilsTest.java
├── integration/          # Integration tests
│   ├── AuthTest.java
│   ├── ProofsTest.java
│   ├── VerificationsTest.java
│   └── WalletsTest.java
├── e2e/                 # End-to-end tests
│   ├── WorkflowsTest.java
│   └── RealtimeTest.java
├── performance/          # Performance tests
│   ├── BenchmarkTest.java
│   └── LoadTest.java
└── utils/               # Test utilities
    ├── Mocks.java
    └── Helpers.java
```

#### Running Tests
```bash
# Navigate to Java SDK directory
cd sdks/java

# Run all tests
mvn test

# Run with coverage
mvn jacoco:report

# Run specific test categories
mvn test -Dtest="**/unit/**"
mvn test -Dtest="**/integration/**"
mvn test -Dtest="**/e2e/**"

# Run performance tests
mvn test -Dtest="**/performance/**"
```

## Test Configuration

### Environment Variables

All tests use these environment variables:

```bash
# Test configuration
VERINODE_TEST_API_ENDPOINT="https://api-test.verinode.com"
VERINODE_TEST_NETWORK="testnet"
VERINODE_TEST_API_KEY="test-api-key"

# Mock mode (for offline testing)
VERINODE_MOCK_MODE="true"

# Performance test settings
VERINODE_PERFORMANCE_ITERATIONS="100"
VERINODE_PERFORMANCE_CONCURRENCY="10"
```

### Test Data

#### Mock Data
- Pre-defined test scenarios
- Consistent across all languages
- Covers edge cases and error conditions

#### Fixtures
- Sample proofs, verifications, wallets
- Test user accounts
- Mock API responses

## Continuous Integration

### GitHub Actions

#### Workflow Triggers
- Push to main/develop branches
- Pull requests
- Scheduled nightly runs
- Manual dispatch

#### Test Matrix
```yaml
strategy:
  matrix:
    language: [python, go, rust, java]
    os: [ubuntu-latest, windows-latest, macos-latest]
    version: [stable, latest]
```

#### Test Stages
1. **Lint**: Code quality checks
2. **Unit Tests**: Fast feedback
3. **Integration Tests**: API interaction
4. **E2E Tests**: Full workflows
5. **Performance Tests**: Benchmarks
6. **Security Tests**: Vulnerability scanning

### Coverage Reporting

#### Tools
- **Python**: pytest-cov, coverage.py
- **Go**: go test -cover, codecov
- **Rust**: tarpaulin, cargo-tarpaulin
- **Java**: JaCoCo, codecov

#### Thresholds
- Minimum 90% line coverage
- Minimum 85% branch coverage
- 100% coverage for critical paths

## Test Data Management

### Test Accounts

#### Dedicated Test Users
- `test-user-1@example.com`
- `test-user-2@example.com`
- `admin-test@example.com`

#### Test Wallets
- Pre-funded test wallets
- Multiple wallet types
- Known private keys for testing

### Test Proofs

#### Sample Data
- Various proof types
- Different statuses
- Complete metadata
- Attachments and tags

## Performance Testing

### Metrics Tracked

#### Response Times
- API call latency
- Authentication time
- Proof creation time
- Search performance

#### Resource Usage
- Memory consumption
- CPU usage
- Network bandwidth
- Connection pooling efficiency

#### Concurrency
- Multiple simultaneous requests
- WebSocket connection limits
- Thread safety
- Race conditions

### Benchmark Scenarios

#### API Operations
- Proof CRUD operations
- Verification workflows
- Wallet transactions
- Search and filtering

#### Real-time Features
- WebSocket connection establishment
- Message throughput
- Subscription management
- Reconnection behavior

## Security Testing

### Vulnerability Scanning

#### Dependency Scanning
- **Python**: safety, bandit
- **Go**: gosec, govulncheck
- **Rust**: cargo-audit, cargo-deny
- **Java**: OWASP Dependency-Check

#### Code Analysis
- Static analysis tools
- Security linting
- Secret detection
- Input validation testing

### Authentication Testing

#### Scenarios
- Invalid credentials
- Token expiration
- Session management
- Permission boundaries

## Test Utilities

### Mock Servers

#### HTTP Mocking
- Request/response matching
- Dynamic responses
- Error simulation
- Performance throttling

#### WebSocket Mocking
- Message simulation
- Connection state testing
- Error injection
- Latency simulation

### Test Helpers

#### Common Functions
- Authentication helpers
- Data generators
- Assertion utilities
- Cleanup routines

## Reporting

### Test Results

#### Formats
- JUnit XML (CI integration)
- HTML reports (human readable)
- JSON (machine readable)
- Coverage reports

#### Metrics
- Pass/fail rates
- Execution times
- Coverage statistics
- Performance benchmarks

### Dashboards

#### Real-time Monitoring
- Test execution status
- Coverage trends
- Performance metrics
- Error rates

## Troubleshooting

### Common Issues

#### Test Failures
- API endpoint changes
- Authentication token issues
- Network connectivity
- Resource exhaustion

#### Performance Issues
- Slow test execution
- Memory leaks
- Connection timeouts
- Resource contention

### Debug Mode

Enable detailed logging:
```bash
export VERINODE_TEST_DEBUG="true"
export VERINODE_TEST_LOG_LEVEL="DEBUG"
```

## Contributing Tests

### Guidelines

#### Writing Tests
- Follow language-specific conventions
- Use descriptive test names
- Include setup/teardown
- Mock external dependencies

#### Test Structure
```python
def test_feature_scenario():
    # Arrange
    setup_test_data()
    
    # Act
    result = perform_action()
    
    # Assert
    assert result.is_valid()
    
    # Cleanup
    cleanup_test_data()
```

### Review Process

#### Checklist
- [ ] Test covers the requirement
- [ ] Uses appropriate assertions
- [ ] Handles edge cases
- [ ] Includes error scenarios
- [ ] Cleans up resources
- [ ] Documentation is clear

---

**Note**: Tests are designed to run in isolation and should not interfere with production systems. Always use test endpoints and test data.
