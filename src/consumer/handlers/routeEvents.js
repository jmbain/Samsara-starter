'use strict';
const logger = require('../../logger');
const { lookupBusieVehicleId } = require('../../services/vehicleMap');
const liveSharingLinks = require('../../services/liveSharingLinks');

/**
 * Handles messages from samsara.{customer_id}.route-events
 *
 * Subtypes handled: RouteStopArrival, RouteStopDeparture
 *
 * On RouteStopDeparture: extract liveSharingUrl from routeStopDetails
 * and upsert into live_sharing_links (source=kafka, link_type=routeStopLink)
 */
async function handleRouteEvent({ customerId, payload, topic, offset }) {
  const eventType = payload?.eventType;
  if (!['RouteStopArrival', 'RouteStopDeparture'].includes(eventType)) {
    logger.debug({ eventType }, 'Ignoring non-route-stop event type');
    return;
  }

  const samsaraAssetId = payload?.asset?.id;
  const busieVehicleId = samsaraAssetId
    ? await lookupBusieVehicleId(customerId, samsaraAssetId)
    : null;

  const routeStop = payload?.routeStopDetails;

  // TODO: upsert into route_stop_actuals
  logger.info({
    customerId,
    busieVehicleId,
    eventType,
    stopId: routeStop?.id,
    arrivedAt: routeStop?.actualArrivalTime,
    departedAt: routeStop?.actualDepartureTime,
  }, 'Route stop event recorded');

  // Extract live sharing link on departure
  if (eventType === 'RouteStopDeparture') {
    const linkUrl = routeStop?.liveSharingUrl;
    if (linkUrl) {
      await liveSharingLinks.upsertFromKafka({
        customerId,
        busieVehicleId,
        samsaraAssetId,
        samsaraRouteStopId: routeStop?.id,
        linkUrl,
      });
    } else {
      // No link = customer likely does not use Samsara routing
      logger.warn({ customerId, topic, offset }, 'RouteStopDeparture missing liveSharingUrl — customer may not use routing');
      // TODO: flag customer as non-routing in samsara_customers
    }
  }
}

module.exports = { handleRouteEvent };
