const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const proofRoutes = require('./routes/proofs');
const authRoutes = require('./routes/auth');
const stellarRoutes = require('./routes/stellar');
const marketplaceRoutes = require('./routes/marketplace');
const searchRoutes = require('./routes/search');
const securityRoutes = require('./routes/security');
const sharingRoutes = require('./routes/sharing');
const complianceRoutes = require('./routes/compliance');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/proofs', proofRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/stellar', stellarRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/compliance', complianceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Verinode backend running on port ${PORT}`);
});

module.exports = app;
