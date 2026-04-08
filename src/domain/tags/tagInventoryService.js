const { query } = require('../../config/database');
const NfcTag = require('../../models/NfcTag');

function toContagemMap(rows) {
  const out = {
    stock: 0,
    reserved: 0,
    sent: 0,
    active: 0,
    blocked: 0,
  };
  (rows || []).forEach((row) => {
    out[row.status] = Number(row.total || 0);
  });
  return out;
}

async function resumoEstoque() {
  const porStatus = await NfcTag.contarPorStatus();
  const mapa = toContagemMap(porStatus);
  const vendidosRes = await query(
    `SELECT COALESCE(COUNT(*), 0)::int AS total
     FROM tag_order_units
     WHERE nfc_tag_id IS NOT NULL`
  );
  return {
    porStatus: mapa,
    vendidas: Number(vendidosRes.rows[0]?.total || 0),
  };
}

async function listarUltimosScans(limite = 25) {
  const resultado = await query(
    `SELECT s.id, s.tag_code, s.cidade, s.ip, s.data,
            p.nome AS pet_nome, u.nome AS usuario_nome
     FROM tag_scans s
     LEFT JOIN nfc_tags t ON t.id = s.tag_id
     LEFT JOIN pets p ON p.id = t.pet_id
     LEFT JOIN usuarios u ON u.id = t.user_id
     ORDER BY s.data DESC
     LIMIT $1`,
    [Math.min(100, Math.max(1, Number(limite) || 25))]
  );
  return resultado.rows;
}

module.exports = {
  resumoEstoque,
  listarUltimosScans,
};
