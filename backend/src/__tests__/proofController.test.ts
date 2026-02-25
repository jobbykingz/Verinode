import request from 'supertest';
import express from 'express';
import { ProofController } from '../controllers/proofController';
import { ApiResponse } from '../utils/apiResponse';

// Mock dependencies
jest.mock('../services/proofService');
jest.mock('../utils/logger');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = { id: 'test-user-id', email: 'test@example.com', tier: 'free', permissions: [] };
  next();
});

// Routes for testing
app.post('/api/proofs', ProofController.createProof);
app.get('/api/proofs/user', ProofController.getUserProofs);
app.get('/api/proofs/:id', ProofController.getProofById);
app.put('/api/proofs/:id', ProofController.updateProof);
app.delete('/api/proofs/:id', ProofController.deleteProof);
app.post('/api/proofs/:id/verify', ProofController.verifyProof);
app.post('/api/proofs/batch', ProofController.batchOperations);
app.get('/api/proofs/stats', ProofController.getProofStats);
app.get('/api/proofs/search', ProofController.searchProofs);
app.get('/api/proofs/export', ProofController.exportProofs);
app.get('/api/proofs/:id/history', ProofController.getProofHistory);
app.post('/api/proofs/:id/share', ProofController.shareProof);

describe('Proof Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/proofs', () => {
    it('should create a new proof successfully', async () => {
      const proofData = {
        title: 'Test Proof',
        description: 'Test Description',
        proofType: 'identity',
        metadata: { key: 'value' },
        tags: ['test']
      };

      const response = await request(app)
        .post('/api/proofs')
        .send(proofData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Proof created successfully');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        title: '', // Invalid: empty title
        description: 'Test Description',
        proofType: 'invalid-type'
      };

      const response = await request(app)
        .post('/api/proofs')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/proofs/user', () => {
    it('should get user proofs successfully', async () => {
      const response = await request(app)
        .get('/api/proofs/user')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User proofs retrieved successfully');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/proofs/user')
        .query({ page: -1, limit: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/proofs/:id', () => {
    it('should get proof by ID successfully', async () => {
      const response = await request(app)
        .get('/api/proofs/test-proof-id')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent proof', async () => {
      const response = await request(app)
        .get('/api/proofs/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Proof not found');
    });
  });

  describe('PUT /api/proofs/:id', () => {
    it('should update proof successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated Description'
      };

      const response = await request(app)
        .put('/api/proofs/test-proof-id')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Proof updated successfully');
    });

    it('should return 404 when updating non-existent proof', async () => {
      const response = await request(app)
        .put('/api/proofs/non-existent-id')
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Proof not found or access denied');
    });
  });

  describe('DELETE /api/proofs/:id', () => {
    it('should delete proof successfully', async () => {
      const response = await request(app)
        .delete('/api/proofs/test-proof-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Proof deleted successfully');
    });

    it('should return 404 when deleting non-existent proof', async () => {
      const response = await request(app)
        .delete('/api/proofs/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Proof not found or access denied');
    });
  });

  describe('POST /api/proofs/:id/verify', () => {
    it('should verify proof successfully', async () => {
      const verifyData = {
        verificationMethod: 'manual',
        additionalData: { notes: 'Manual verification' }
      };

      const response = await request(app)
        .post('/api/proofs/test-proof-id/verify')
        .send(verifyData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Proof verification completed');
    });

    it('should return validation error for invalid verification method', async () => {
      const invalidData = {
        verificationMethod: 'invalid-method'
      };

      const response = await request(app)
        .post('/api/proofs/test-proof-id/verify')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/proofs/batch', () => {
    it('should process batch operations successfully', async () => {
      const batchData = {
        operations: [
          {
            type: 'create',
            data: {
              title: 'Batch Proof 1',
              description: 'Description',
              proofType: 'identity'
            }
          },
          {
            type: 'verify',
            proofId: 'test-proof-id',
            verificationMethod: 'manual'
          }
        ]
      };

      const response = await request(app)
        .post('/api/proofs/batch')
        .send(batchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Batch operations completed successfully');
      expect(response.body.data.summary).toBeDefined();
    });

    it('should reject batch operations with too many items', async () => {
      const batchData = {
        operations: Array(101).fill({
          type: 'create',
          data: { title: 'Test', proofType: 'identity' }
        })
      };

      const response = await request(app)
        .post('/api/proofs/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Maximum 100 operations allowed per batch');
    });
  });

  describe('GET /api/proofs/stats', () => {
    it('should get proof statistics successfully', async () => {
      const response = await request(app)
        .get('/api/proofs/stats')
        .query({ timeRange: '30d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Proof statistics retrieved successfully');
    });

    it('should validate time range parameter', async () => {
      const response = await request(app)
        .get('/api/proofs/stats')
        .query({ timeRange: 'invalid-range' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/proofs/search', () => {
    it('should search proofs successfully', async () => {
      const response = await request(app)
        .get('/api/proofs/search')
        .query({ q: 'test query', page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Search results retrieved successfully');
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/proofs/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Search query is required');
    });
  });

  describe('GET /api/proofs/export', () => {
    it('should export proofs in JSON format', async () => {
      const response = await request(app)
        .get('/api/proofs/export')
        .query({ format: 'json' })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-type']).toBe('application/json');
    });

    it('should export proofs in CSV format', async () => {
      const response = await request(app)
        .get('/api/proofs/export')
        .query({ format: 'csv' })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-type']).toBe('text/csv');
    });

    it('should validate export format', async () => {
      const response = await request(app)
        .get('/api/proofs/export')
        .query({ format: 'invalid-format' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/proofs/:id/history', () => {
    it('should get proof history successfully', async () => {
      const response = await request(app)
        .get('/api/proofs/test-proof-id/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Proof history retrieved successfully');
    });
  });

  describe('POST /api/proofs/:id/share', () => {
    it('should share proof successfully', async () => {
      const shareData = {
        recipientEmail: 'recipient@example.com',
        permissions: ['view'],
        message: 'Please review this proof'
      };

      const response = await request(app)
        .post('/api/proofs/test-proof-id/share')
        .send(shareData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Proof shared successfully');
    });

    it('should validate sharing data', async () => {
      const invalidData = {
        recipientEmail: 'invalid-email',
        permissions: []
      };

      const response = await request(app)
        .post('/api/proofs/test-proof-id/share')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});

// Performance tests
describe('Proof Controller Performance', () => {
  it('should handle concurrent requests efficiently', async () => {
    const promises = Array(50).fill(null).map(() =>
      request(app)
        .get('/api/proofs/user')
        .query({ page: 1, limit: 10 })
    );

    const startTime = Date.now();
    await Promise.all(promises);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle batch operations efficiently', async () => {
    const batchData = {
      operations: Array(50).fill({
        type: 'create',
        data: {
          title: 'Batch Test Proof',
          description: 'Test Description',
          proofType: 'identity'
        }
      })
    };

    const startTime = Date.now();
    await request(app)
      .post('/api/proofs/batch')
      .send(batchData)
      .expect(200);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
  });
});

// Error handling tests
describe('Proof Controller Error Handling', () => {
  it('should handle service errors gracefully', async () => {
    // Mock service to throw an error
    const { proofService } = require('../services/proofService');
    proofService.createProof.mockRejectedValue(new Error('Service error'));

    const response = await request(app)
      .post('/api/proofs')
      .send({
        title: 'Test Proof',
        description: 'Test Description',
        proofType: 'identity'
      })
      .expect(500);

    expect(response.body.success).toBe(false);
  });

  it('should handle missing user authentication', async () => {
    // Create app without auth middleware
    const noAuthApp = express();
    noAuthApp.use(express.json());
    noAuthApp.post('/api/proofs', ProofController.createProof);

    const response = await request(noAuthApp)
      .post('/api/proofs')
      .send({
        title: 'Test Proof',
        description: 'Test Description',
        proofType: 'identity'
      })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('User authentication required');
  });
});
