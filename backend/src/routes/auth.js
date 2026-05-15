const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// ========================================
// REGISTER ENDPOINT
// ========================================
// POST /api/auth/register
// User creates account with email + password
// Returns: { success: true, user: { id, email, name } }

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // STEP 1: Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required',
      });
    }

    // STEP 2: Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
      });
    }

    // STEP 3: Hash password with bcrypt
    // bcrypt.hashSync(password, 10) turns "password123" into gibberish
    // The "10" is the salt rounds (higher = more secure but slower)
    const hashedPassword = bcrypt.hashSync(password, 10);

    // STEP 4: Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword, // Store hashed password, not plain text!
        name,
        role: role || 'FARMER', // Default to FARMER if not specified
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      }, // Don't return password
    });

    // STEP 5: Return success
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

// ========================================
// LOGIN ENDPOINT
// ========================================
// POST /api/auth/login
// User logs in with email + password
// Returns: { success: true, token: "eyJ..." }

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // STEP 1: Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // STEP 2: Find user in database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // STEP 3: Compare submitted password with hashed password in database
    // bcrypt.compareSync(plain, hashed) returns true if they match
    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // STEP 4: Create JWT token
    // jwt.sign creates a signed token with user data
    // This token can't be faked because it's signed with JWT_SECRET
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET, // Secret key from .env
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // STEP 5: Return token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

module.exports = router;
