const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes');

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-original-size', 'x-compressed-size'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Router registration
app.use('/api', apiRoutes);

// Simple message for root endpoint
app.get('/api-status', (req, res) => {
  res.json({
    message: 'Invoice & PDF SaaS API is up and running!',
    environment: process.env.NODE_ENV || 'development',
    time: new Date()
  });
});

// Serve frontend in production (if running as a unified server locally)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Export the App for Vercel Serverless Functions
module.exports = app;

// Listen if run directly (local development)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[Backend Server] Running on http://localhost:${PORT}`);
  });
}
