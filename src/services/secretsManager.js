'use strict';
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const config = require('../config');

const client = new SecretsManagerClient({ region: config.aws.region });

// In-process cache — tokens don't change often; invalidated on 401 from Samsara
const tokenCache = new Map();

/**
 * Fetch the Samsara API token for a given customer from AWS Secrets Manager.
 * Secret path: busie/samsara/{customerId}/api_token
 */
async function getSamsaraToken(customerId) {
  // Dev shortcut: if a token is set in env, use it directly
  if (config.samsara.devApiToken) return config.samsara.devApiToken;

  if (tokenCache.has(customerId)) return tokenCache.get(customerId);

  const secretId = `busie/samsara/${customerId}/api_token`;
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const token = result.SecretString;

  if (!token) throw new Error(`No secret value found for ${secretId}`);

  tokenCache.set(customerId, token);
  return token;
}

/** Call on 401 from Samsara so next request re-fetches from Secrets Manager */
function invalidateToken(customerId) {
  tokenCache.delete(customerId);
}

module.exports = { getSamsaraToken, invalidateToken };
