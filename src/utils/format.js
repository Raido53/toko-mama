const numberFormatter = new Intl.NumberFormat('id-ID');

function rupiah(value) {
  return `Rp${numberFormatter.format(Number(value) || 0)}`;
}

function dateId(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(`${value}`.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

module.exports = { rupiah, dateId, slugify };
