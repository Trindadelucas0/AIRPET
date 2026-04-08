const { query } = require('../../config/database');
const Usuario = require('../../models/Usuario');
const Pet = require('../../models/Pet');
const PetPerdido = require('../../models/PetPerdido');

async function carregarCardsDashboard() {
  const [usuarios, pets, alertasAtivos, tags] = await Promise.all([
    Usuario.contarTotal(),
    Pet.contarTotal(),
    PetPerdido.contarAtivos(),
    query(
      `SELECT
        COALESCE(COUNT(*) FILTER (WHERE status = 'active'), 0)::int AS tags_ativas,
        COALESCE(COUNT(*) FILTER (WHERE status IN ('sent', 'active', 'blocked')), 0)::int AS tags_vendidas
       FROM nfc_tags`
    ),
  ]);

  const compradores = await query(
    `SELECT COUNT(DISTINCT usuario_id)::int AS total
     FROM tag_product_orders
     WHERE status IN ('pago', 'enviado', 'entregue')`
  );
  const totalUsuarios = Number(usuarios || 0);
  const totalCompradores = Number(compradores.rows[0]?.total || 0);
  const taxaConversaoCompra = totalUsuarios > 0 ? Number(((totalCompradores / totalUsuarios) * 100).toFixed(2)) : 0;

  return {
    usuarios: totalUsuarios,
    pets: Number(pets || 0),
    alertasAtivos: Number(alertasAtivos || 0),
    tagsAtivas: Number(tags.rows[0]?.tags_ativas || 0),
    tagsVendidas: Number(tags.rows[0]?.tags_vendidas || 0),
    taxaConversaoCompra,
  };
}

async function carregarSerieDashboard(dias = 14) {
  const d = Math.min(60, Math.max(7, Number(dias) || 14));
  const resultado = await query(
    `WITH serie AS (
      SELECT generate_series(
        date_trunc('day', NOW()) - make_interval(days => $1::int - 1),
        date_trunc('day', NOW()),
        INTERVAL '1 day'
      )::date AS dia
    ),
    novos_usuarios AS (
      SELECT DATE(data_criacao) AS dia, COUNT(*)::int AS total
      FROM usuarios
      WHERE data_criacao >= NOW() - make_interval(days => $1::int)
      GROUP BY 1
    ),
    pedidos_pagos AS (
      SELECT DATE(data_criacao) AS dia, COUNT(*)::int AS total
      FROM tag_product_orders
      WHERE status IN ('pago', 'enviado', 'entregue')
        AND data_criacao >= NOW() - make_interval(days => $1::int)
      GROUP BY 1
    )
    SELECT s.dia,
           COALESCE(n.total, 0)::int AS novos_usuarios,
           COALESCE(p.total, 0)::int AS pedidos_pagos
    FROM serie s
    LEFT JOIN novos_usuarios n ON n.dia = s.dia
    LEFT JOIN pedidos_pagos p ON p.dia = s.dia
    ORDER BY s.dia ASC`,
    [d]
  );
  return resultado.rows;
}

module.exports = {
  carregarCardsDashboard,
  carregarSerieDashboard,
};
