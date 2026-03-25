import express, { Request, Response } from 'express';
import express_cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { authenticate } from './middleware/auth.ts';
import rbacRoutes from './routes/rbac.ts';

// Import JS routes (using require for compatibility with existing JS files)
const proofRoutes = require('./routes/proofs.js');
const authRoutes = require('./routes/auth.js');
const stellarRoutes = require('./routes/stellar.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verinode';

// Security middleware
app.use(helmet());
app.use(express_cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB successfully for RBAC integration'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes); // Login/Register (Public)

// Protected routes (require valid JWT)
app.use('/api/proofs', authenticate, proofRoutes);
app.use('/api/stellar', authenticate, stellarRoutes);
app.use('/api/rbac', authenticate, rbacRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.listen(PORT, () => {
  console.log(`Verinode backend (RBAC Integrated) running on port ${PORT}`);
});

export default app;
