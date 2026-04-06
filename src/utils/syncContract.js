/**
 * Contrato comum entre GET/PATCH /api/v1/me e respostas JSON de perfil (cache local / ETag).
 */

function profileVersionMs(usuario) {
  if (!usuario || !usuario.data_atualizacao) return 0;
  const t = new Date(usuario.data_atualizacao).getTime();
  return Number.isFinite(t) ? t : 0;
}

function stripUsuario(usuario) {
  if (!usuario) return null;
  const { senha_hash: _, ...rest } = usuario;
  return rest;
}

function etagMe(usuario) {
  if (!usuario) return 'W/"me-empty"';
  return `W/"me-${usuario.id}-${profileVersionMs(usuario)}"`;
}

function etagFollowing(userId, resumo) {
  const t = resumo && resumo.ultima_mudanca ? new Date(resumo.ultima_mudanca).getTime() : 0;
  const total = resumo && Number.isFinite(resumo.total) ? resumo.total : 0;
  return `W/"following-${userId}-${total}-${t}"`;
}

function etagPreferences(usuario) {
  if (!usuario) return 'W/"prefs-empty"';
  const pv = profileVersionMs(usuario);
  const cor = usuario.cor_perfil || '#ec5a1c';
  const alertas = usuario.receber_alertas_pet_perdido !== false;
  return `W/"prefs-${usuario.id}-${pv}-${cor}-${alertas}"`;
}

module.exports = {
  profileVersionMs,
  stripUsuario,
  etagMe,
  etagFollowing,
  etagPreferences,
};
