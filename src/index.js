const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'FarmPact API is running',
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint - POST
app.post('/api/test', (req, res) => {
  res.status(201).json({
    success: true,
    message: 'POST request received',
    receivedData: req.body,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ FarmPact API running on http://localhost:${PORT}`);
});
