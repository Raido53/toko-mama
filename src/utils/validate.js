function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function isRole(value) {
  return ['admin', 'seller', 'pembeli'].includes(value);
}

function int(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = str(String(value));
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/** Normalisasi nomor WhatsApp Indonesia ke format 62xxxxxxxxxx. */
function normalizeWhatsappNumber(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.startsWith('8')) digits = `62${digits}`;
  return digits;
}

function isValidWhatsappNumber(value) {
  return /^62\d{8,13}$/.test(value);
}

module.exports = { str, isEmail, isRole, int, normalizeWhatsappNumber, isValidWhatsappNumber };
