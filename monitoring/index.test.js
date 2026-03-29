const { createRequest } = require('../index');

// Mock the ApiAdapter module
jest.mock('../ApiAdapter', () => {
    return jest.fn().mockImplementation(() => {
        return {
            request: jest.fn(),
        };
    });
});

// Mock the configuration loading to use defaults
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn().mockReturnValue(false),
}));

const ApiAdapter = require('../ApiAdapter');

describe('createRequest', () => {
    let apiAdapterInstance;

    beforeEach(() => {
        // Clear mock history before each test
        ApiAdapter.mockClear();
        // Access the singleton instance created in index.js
        apiAdapterInstance = ApiAdapter.mock.instances[0];
    });

    it('should return a successful response for a valid request', async () => {
        const input = {
            id: '1',
            data: {
                fsym: 'ETH',
                tsyms: 'USD',
            },
        };

        const apiResponse = { ETH: { USD: 2000 } };
        apiAdapterInstance.request.mockResolvedValue(apiResponse);

        const response = await createRequest(input);

        expect(apiAdapterInstance.request).toHaveBeenCalledWith('GET', 'https://min-api.cryptocompare.com/data/price', {
            params: { fsym: 'ETH', tsyms: 'USD' },
        });
        expect(response.jobRunID).toBe('1');
        expect(response.statusCode).toBe(200);
        expect(response.data).toEqual(apiResponse);
        expect(response.result).toBe(2000);
    });

    it('should return an error response when the API call fails', async () => {
        const input = {
            id: '2',
            data: {
                fsym: 'BTC',
                tsyms: 'EUR',
            },
        };

        const apiError = new Error('API is down');
        apiAdapterInstance.request.mockRejectedValue(apiError);

        const response = await createRequest(input);

        expect(response.jobRunID).toBe('2');
        expect(response.status).toBe('errored');
        expect(response.error).toBe(apiError);
    });

    it('should return an error response for invalid input data', async () => {
        const input = { id: '3', data: {} }; // Missing fsym and tsyms

        const response = await createRequest(input);

        expect(response.jobRunID).toBe('3');
        expect(response.status).toBe('errored');
        expect(response.error.message).toContain('Required parameter not supplied: fsym');
    });
    
    it('should use a custom endpoint if provided', async () => {
        const input = { id: '4', data: { fsym: 'LINK', tsyms: 'USD', endpoint: 'v2/histoday' } };

        apiAdapterInstance.request.mockResolvedValue({});
        await createRequest(input);

        expect(apiAdapterInstance.request).toHaveBeenCalledWith('GET', 'https://min-api.cryptocompare.com/data/v2/histoday', {
            params: { fsym: 'LINK', tsyms: 'USD' },
        });
    });
});