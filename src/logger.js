'use strict';
const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.app.logLevel,
  // In production, remove prettyPrint and ship JSON logs to your log aggregator
  transport: config.app.env === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

module.exports = logger;
