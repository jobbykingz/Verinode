const { Requester, Validator } = require('@chainlink/external-adapter');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const ApiAdapter = require('./ApiAdapter');

// Load configuration
const loadConfig = () => {
    try {
        const configPath = path.join(__dirname, 'contract-metrics.yml');
        if (fs.existsSync(configPath)) {
            return yaml.load(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (error) {
        console.error('Failed to load configuration:', error);
    }
    // Default configuration if file load fails
    return {
        network: {
            retry: { max_attempts: 3, delay: 1000, backoff_multiplier: 2 },
            request_timeout: 5000,
            circuit_breaker: { enabled: true }
        }
    };
};

const config = loadConfig();
const apiAdapter = new ApiAdapter(config);

// Define custom parameters for validation
const customParams = {
    fsym: ['base', 'from', 'coin', 'fsym'],
    tsyms: ['quote', 'to', 'market', 'tsyms'],
    endpoint: false
};

/**
 * Create a request to the external API
 * Implements Chainlink external adapter interface using async/await
 */
const createRequest = async (input) => {
    const validator = new Validator(input, customParams);
    const jobRunID = validator.validated.id;
    
    const fsym = validator.validated.data.fsym;
    const tsyms = validator.validated.data.tsyms;
    const endpoint = validator.validated.data.endpoint || 'price';
    
    const url = `https://min-api.cryptocompare.com/data/${endpoint}`;

    try {
        const response = await apiAdapter.request('GET', url, {
            params: { fsym, tsyms }
        });

        return Requester.success(jobRunID, {
            data: response,
            result: response[tsyms],
            status: 200
        });
    } catch (error) {
        return Requester.errored(jobRunID, error);
    }
};

module.exports.createRequest = createRequest;