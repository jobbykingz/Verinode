# Monitoring Adapter

This adapter connects to CryptoCompare API to fetch price data for smart contract monitoring. It follows the Chainlink external adapter framework and uses modern async/await patterns.

## Configuration

The adapter uses `contract-metrics.yml` for configuration. Key settings include:

- **Retry Logic**: Configurable attempts and backoff
- **Circuit Breaker**: Failure thresholds and reset timeouts
- **Rate Limiting**: Requests per minute limits

## Usage

The adapter exports a `createRequest` function that returns a Promise.

```javascript
const { createRequest } = require('./index');

const input = {
  id: '1',
  data: {
    fsym: 'ETH',
    tsyms: 'USD'
  }
};

createRequest(input)
  .then(response => console.log(response))
  .catch(error => console.error(error));
```

## Features

- **Async/Await**: Modern non-blocking I/O
- **Robust Error Handling**: Integrated with ApiAdapter for retries and circuit breaking
- **Input Validation**: Validates required parameters before execution