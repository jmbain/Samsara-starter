'use strict';
const express = require('express');
const config = require('../config');
const logger = require('../logger');
const onboardingRoutes = require('./routes/onboarding');
const liveShareRoutes = require('./routes/liveShare');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/samsara', onboardingRoutes);
app.use('/api/samsara', liveShareRoutes);

// Start
app.listen(config.app.port, () => {
  logger.info({ port: config.app.port }, 'API server listening');
});

module.exports = app;
