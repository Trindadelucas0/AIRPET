function normalizePhoneDigits(raw) {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length > 11 && digits.startsWith('55')) return digits;
  return digits;
}

function buildWhatsappUrl(phone, text = '') {
  const normalized = normalizePhoneDigits(phone);
  if (!normalized) return null;
  const msg = String(text || '').trim();
  if (!msg) return `https://wa.me/${normalized}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
}

module.exports = {
  normalizePhoneDigits,
  buildWhatsappUrl,
};
