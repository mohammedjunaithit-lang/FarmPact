const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const cropRoutes = require('./routes/crops');

// Import middleware
const { verifyToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors());
app.use(express.json());

// ========================================
// PUBLIC ROUTES (no auth required)
// ========================================

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'FarmPact API is running',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (register, login)
app.use('/api/auth', authRoutes);

// Crops routes (LIST and GET single are public)
app.use('/api/crops', cropRoutes);

// ========================================
// PROTECTED ROUTES (auth required)
// ========================================

// Example protected endpoint
app.get('/api/protected-example', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'You are authenticated!',
    user: req.user,
  });
});

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log(`✅ FarmPact API running on http://localhost:${PORT}`);
  console.log(`\n📚 Routes:`);
  console.log(`   Health: GET http://localhost:${PORT}/api/health`);
  console.log(`\n🔐 Auth:`);
  console.log(`   Register: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   Login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`\n🌾 Crops:`);
  console.log(`   List: GET http://localhost:${PORT}/api/crops`);
  console.log(`   Get One: GET http://localhost:${PORT}/api/crops/:id`);
  console.log(`   Create: POST http://localhost:${PORT}/api/crops (auth required)`);
  console.log(`   Update: PUT http://localhost:${PORT}/api/crops/:id (auth required)`);
  console.log(`   Delete: DELETE http://localhost:${PORT}/api/crops/:id (auth required)`);
});
