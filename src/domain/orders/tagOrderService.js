const TagProductOrder = require('../../models/TagProductOrder');
const TagProductOrderEvent = require('../../models/TagProductOrderEvent');
const { query } = require('../../config/database');

const STATUS_LABELS = {
  aguardando_pagamento: 'pendente',
  pago: 'pago',
  enviado: 'enviado',
  entregue: 'entregue',
};

const TRANSICOES_VALIDAS = {
  aguardando_pagamento: new Set(['pago']),
  pago: new Set(['enviado']),
  enviado: new Set(['entregue']),
  entregue: new Set([]),
};

async function atualizarStatus(orderId, novoStatus, actorAdminId = null, nota = null) {
  const pedido = await TagProductOrder.buscarPorIdAdmin(orderId);
  if (!pedido) throw new Error('Pedido não encontrado.');

  const atual = String(pedido.status || '');
  const alvo = String(novoStatus || '').trim();
  if (!alvo) throw new Error('Status de destino inválido.');

  const permitidos = TRANSICOES_VALIDAS[atual] || new Set();
  if (!permitidos.has(alvo)) {
    throw new Error(`Transição inválida: ${atual} -> ${alvo}.`);
  }

  const updated = await query(
    `UPDATE tag_product_orders
     SET status = $2,
         data_atualizacao = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, alvo]
  );
  const pedidoAtualizado = updated.rows[0];

  await TagProductOrderEvent.registrar({
    order_id: orderId,
    from_status: atual,
    to_status: alvo,
    actor_admin_id: actorAdminId,
    nota,
  });

  return pedidoAtualizado;
}

function toLabel(status) {
  return STATUS_LABELS[status] || status;
}

module.exports = {
  STATUS_LABELS,
  toLabel,
  atualizarStatus,
};
