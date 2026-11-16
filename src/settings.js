const db = require('./db');

const CACHE_TTL = 30 * 1000;
let cache = { value: null, expiresAt: 0 };

async function getWhatsappNumber(force = false) {
  const now = Date.now();
  if (force || cache.expiresAt < now) {
    cache = {
      value: (await db.getSetting('whatsapp_number')) || '',
      expiresAt: now + CACHE_TTL,
    };
  }
  return cache.value;
}

function invalidateWhatsappCache() {
  cache = { value: null, expiresAt: 0 };
}

module.exports = { getWhatsappNumber, invalidateWhatsappCache };
