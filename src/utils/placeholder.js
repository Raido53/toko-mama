const PALETTES = {
  sembako: ['#ffe6c7', '#ffb877', '#8a4b00'],
  minuman: ['#d7ecff', '#7eb8f2', '#0b3d6b'],
  kebersihan: ['#dcf7ef', '#79d6b8', '#075c48'],
  protein: ['#ffe0e6', '#ff8fa8', '#7a102a'],
  snack: ['#fff4cc', '#ffd166', '#7a5300'],
  'bumbu-dapur': ['#ffdccd', '#ff9a71', '#7a2c0b'],
  'rumah-tangga': ['#e8e2ff', '#b4a4f5', '#35236e'],
  'perlengkapan-bayi': ['#ffe3f0', '#ff9dc4', '#7a1246'],
  'mainan-anak': ['#e2f4ff', '#8ecdf7', '#0b4a6b'],
  default: ['#ffe1ec', '#f77fb0', '#7a1039'],
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function initials(label) {
  const words = String(label || 'TM')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'TM';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function placeholderSvg(label, paletteKey = 'default') {
  const [from, to, ink] = PALETTES[paletteKey] || PALETTES.default;
  const text = escapeXml(String(label || 'Produk').slice(0, 22));
  const mark = escapeXml(initials(label));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#g)"/>
  <circle cx="392" cy="76" r="62" fill="#ffffff" opacity=".35"/>
  <circle cx="86" cy="292" r="90" fill="#ffffff" opacity=".22"/>
  <text x="240" y="176" font-family="Inter,Segoe UI,sans-serif" font-size="64" font-weight="800"
        text-anchor="middle" fill="${ink}" opacity=".85">${mark}</text>
  <text x="240" y="238" font-family="Inter,Segoe UI,sans-serif" font-size="20" font-weight="700"
        text-anchor="middle" fill="${ink}" opacity=".75">${text}</text>
  <text x="240" y="266" font-family="Inter,Segoe UI,sans-serif" font-size="13"
        text-anchor="middle" fill="${ink}" opacity=".55">Toko Mama</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

module.exports = { placeholderSvg };
