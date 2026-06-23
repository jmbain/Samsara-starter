#!/usr/bin/env ts-node
/**
 * init-vehicle-map.ts
 * Seeds samsara_vehicle_map by calling GET /fleet/vehicles for a customer
 * and matching Samsara vehicles to Busie vehicles by VIN.
 *
 * Usage:
 *   ts-node src/scripts/init-vehicle-map.ts --customer-id <id>
 *
 * Requires DATABASE_URL and either SAMSARA_API_TOKEN (dev) or
 * AWS Secrets Manager access (prod) to be configured.
 */
import 'reflect-metadata';
import axios from 'axios';
import { Pool } from 'pg';

// Standalone script — reads env directly without NestJS DI
const args = process.argv.slice(2);
const customerIdIdx = args.indexOf('--customer-id');
const customerId = customerIdIdx !== -1 ? args[customerIdIdx + 1] : null;

if (!customerId) {
  console.error('Usage: ts-node src/scripts/init-vehicle-map.ts --customer-id <id>');
  process.exit(1);
}

const SAMSARA_BASE_URL = process.env.SAMSARA_API_BASE_URL ?? 'https://api.samsara.com';

interface SamsaraVehicle {
  id: string;
  name: string;
  vin?: string;
  licensePlate?: string;
}

interface PaginatedResponse {
  data: SamsaraVehicle[];
  pagination?: { endCursor?: string; hasNextPage?: boolean };
}

async function fetchAllVehicles(apiToken: string): Promise<SamsaraVehicle[]> {
  const vehicles: SamsaraVehicle[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, unknown> = { limit: 100, ...(cursor ? { after: cursor } : {}) };
    const response = await axios.get<PaginatedResponse>(`${SAMSARA_BASE_URL}/fleet/vehicles`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      params,
    });
    vehicles.push(...(response.data?.data ?? []));
    cursor = response.data?.pagination?.endCursor;
    if (!response.data?.pagination?.hasNextPage) break;
  } while (cursor);

  return vehicles;
}

async function run(): Promise<void> {
  const apiToken = process.env.SAMSARA_API_TOKEN;
  if (!apiToken) {
    // In production, fetch from Secrets Manager using the SecretsService.
    // For simplicity in this standalone script, require SAMSARA_API_TOKEN env var.
    throw new Error('SAMSARA_API_TOKEN env var required. In production, adapt this script to use SecretsService.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const samsaraVehicles = await fetchAllVehicles(apiToken);
    console.log(`Fetched ${samsaraVehicles.length} vehicles from Samsara for customer ${customerId}`);

    let matched = 0;
    let unmatched = 0;

    for (const v of samsaraVehicles) {
      const vin = v.vin;

      const busieResult = vin
        ? await pool.query<{ id: string }>('SELECT id FROM vehicles WHERE vin = $1 LIMIT 1', [vin])
        : null;

      const busieVehicleId: string | null = busieResult?.rows[0]?.id ?? null;

      if (busieVehicleId) {
        await pool.query(
          `INSERT INTO samsara_vehicle_map (customer_id, samsara_asset_id, busie_vehicle_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (customer_id, samsara_asset_id) DO UPDATE
             SET busie_vehicle_id = EXCLUDED.busie_vehicle_id, updated_at = NOW()`,
          [customerId, v.id, busieVehicleId],
        );
        console.log(`  ✓ Matched: ${v.name} (${vin ?? v.licensePlate}) → ${busieVehicleId}`);
        matched++;
      } else {
        console.log(`  ⚠ Unmatched: ${v.name} (${vin ?? v.licensePlate ?? 'no VIN/plate'}) — flagged for manual review`);
        // TODO: write to admin review queue
        unmatched++;
      }
    }

    console.log(`\nDone. Matched: ${matched}, Unmatched: ${unmatched}`);
  } finally {
    await pool.end();
  }
}

run().catch((err: Error) => {
  console.error('Vehicle map init failed:', err.message);
  process.exit(1);
});
