'use strict';
const axios = require('axios');
const config = require('../config');
const logger = require('../logger');
const secretsManager = require('./secretsManager');

/**
 * Upsert a live sharing link that arrived via Kafka (source=kafka, link_type=routeStopLink).
 * Called by the routeEvents handler on RouteStopDeparture events.
 */
async function upsertFromKafka({ customerId, busieVehicleId, samsaraAssetId, samsaraRouteStopId, linkUrl }) {
  // TODO: upsert into live_sharing_links table
  // ON CONFLICT (customer_id, busie_vehicle_id, samsara_route_stop_id, link_type) DO UPDATE SET link_url = ...
  logger.info({ customerId, busieVehicleId, samsaraRouteStopId, linkUrl }, 'Live sharing link stored (kafka)');
}

/**
 * Generate a live sharing link via the Samsara REST API.
 * Used for non-routing customers who do not emit RouteStop events.
 * Calls POST https://api.samsara.com/live-shares
 */
async function generateViaRestApi({ customerId, samsaraAssetId, busieVehicleId, expiresAtTime }) {
  const apiToken = await secretsManager.getSamsaraToken(customerId);

  // expiresAtTime must be an RFC 3339 string, e.g. "2026-06-17T18:00:00Z"
  // Do NOT use expiresAtMs — Samsara API does not accept millisecond timestamps here.
  const body = {
    type: 'assetsLocation',
    assetIds: [samsaraAssetId],
    ...(expiresAtTime ? { expiresAtTime } : {}),
  };

  const response = await axios.post(
    `${config.samsara.baseUrl}/live-shares`,
    body,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const linkUrl = response.data?.data?.url;
  if (!linkUrl) throw new Error('Samsara /live-shares response missing data.url');

  // TODO: upsert into live_sharing_links table (source=rest_api, link_type=assetsLocation)
  logger.info({ customerId, busieVehicleId, samsaraAssetId, linkUrl }, 'Live sharing link generated (REST API)');

  return linkUrl;
}

module.exports = { upsertFromKafka, generateViaRestApi };
