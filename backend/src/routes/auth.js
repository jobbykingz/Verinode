const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const config = require('../config/appConfig');

// Mock user storage - replace with database
const users = [];

// Register a new user
router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('stellarAddress').isLength({ min: 56 }).withMessage('Valid Stellar address is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, stellarAddress } = req.body;
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = {
      id: users.length + 1,
      email,
      password, // In production, hash this password
      stellarAddress,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    
    const token = jwt.sign({ userId: user.id }, config.auth.jwtSecret || 'fallback_secret');
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        stellarAddress: user.stellarAddress
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, config.auth.jwtSecret || 'fallback_secret');
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        stellarAddress: user.stellarAddress
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
