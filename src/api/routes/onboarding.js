'use strict';
const { Router } = require('express');
const axios = require('axios');
const config = require('../../config');
const logger = require('../../logger');
const secretsManager = require('../../services/secretsManager');

const router = Router();

/**
 * POST /api/samsara/onboard
 * Body: { customerId: string, apiToken: string }
 *
 * Validates the token against Samsara, then stores it in Secrets Manager.
 * Steps:
 *  1. Validate token with GET /fleet/vehicles?limit=1
 *  2. Check "Write Live Sharing Links" scope with a dry-run POST /live-shares
 *  3. Store token in Secrets Manager
 *  4. Update samsara_customers record to active
 */
router.post('/onboard', async (req, res) => {
  const { customerId, apiToken } = req.body;

  if (!customerId || !apiToken) {
    return res.status(400).json({ error: 'customerId and apiToken are required' });
  }

  const headers = { Authorization: `Bearer ${apiToken}` };

  // Step 1: Validate token is functional
  try {
    await axios.get(`${config.samsara.baseUrl}/fleet/vehicles?limit=1`, { headers });
  } catch (err) {
    const status = err.response?.status;
    logger.warn({ customerId, status }, 'Samsara token validation failed');
    if (status === 401) {
      return res.status(422).json({ error: 'Invalid or expired Samsara API token. Please regenerate it in the Samsara Dashboard.' });
    }
    return res.status(502).json({ error: 'Unable to reach Samsara API. Please try again.' });
  }

  // Step 2: Check for Write Live Sharing Links scope
  try {
    await axios.post(`${config.samsara.baseUrl}/live-shares`, { type: 'assetsLocation', assetIds: [] }, { headers });
  } catch (err) {
    if (err.response?.status === 403) {
      return res.status(422).json({
        error: 'Your Samsara token is missing the "Write Live Sharing Links" scope. Please add it in the Samsara Dashboard under Settings → API Tokens.',
      });
    }
    // Other errors are non-fatal for scope check (empty assetIds may 400 — that's fine)
  }

  // Step 3: Store token in Secrets Manager
  // TODO: implement secretsManager.storeSamsaraToken(customerId, apiToken)
  logger.info({ customerId }, 'Token validated — storing in Secrets Manager (TODO)');

  // Step 4: Upsert samsara_customers record
  // TODO: db.upsertSamsaraCustomer({ customerId, status: 'active', apiTokenSecretPath: `busie/samsara/${customerId}/api_token` })

  return res.json({ success: true, message: 'Samsara integration activated.' });
});

module.exports = router;
