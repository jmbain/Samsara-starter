'use strict';
const { Router } = require('express');
const liveSharingLinks = require('../../services/liveSharingLinks');
const logger = require('../../logger');

const router = Router();

/**
 * POST /api/samsara/live-share
 * Body: { customerId, samsaraAssetId, busieVehicleId, expiresAtTime? }
 *
 * Generates a live sharing link via the Samsara REST API.
 * Used for non-routing customers who do not emit Route Stop events.
 *
 * expiresAtTime: optional RFC 3339 string (e.g. "2026-06-17T18:00:00Z")
 */
router.post('/live-share', async (req, res) => {
  const { customerId, samsaraAssetId, busieVehicleId, expiresAtTime } = req.body;

  if (!customerId || !samsaraAssetId || !busieVehicleId) {
    return res.status(400).json({ error: 'customerId, samsaraAssetId, and busieVehicleId are required' });
  }

  try {
    const linkUrl = await liveSharingLinks.generateViaRestApi({
      customerId,
      samsaraAssetId,
      busieVehicleId,
      expiresAtTime,
    });
    return res.json({ linkUrl });
  } catch (err) {
    logger.error({ customerId, samsaraAssetId, err }, 'Failed to generate live sharing link');
    return res.status(502).json({ error: 'Failed to generate live sharing link' });
  }
});

module.exports = router;
