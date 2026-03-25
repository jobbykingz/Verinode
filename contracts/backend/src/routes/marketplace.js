const express = require('express');
const router = express.Router();
const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  rateTemplate,
  getTemplateRatings,
  purchaseTemplate,
  getUserTemplates,
  searchTemplates,
  getTemplateCategories,
  getMarketplaceStats
} = require('../controllers/marketplaceController');

// Public routes
router.get('/templates', getTemplates);
router.get('/templates/search', searchTemplates);
router.get('/templates/categories', getTemplateCategories);
router.get('/stats', getMarketplaceStats);
router.get('/templates/:id', getTemplateById);
router.get('/templates/:id/ratings', getTemplateRatings);

// Protected routes (would require authentication middleware in production)
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);
router.post('/templates/:id/rate', rateTemplate);
router.post('/templates/:id/purchase', purchaseTemplate);
router.get('/user/templates', getUserTemplates);

module.exports = router;