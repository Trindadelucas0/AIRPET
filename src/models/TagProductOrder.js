const { query, withTransaction } = require('../config/database');
const { ensureTagCommerceSchema } = require('./tagCommerceSchema');

const TagProductOrder = {
  async ensureSchema() {
    await ensureTagCommerceSchema();
  },

  async criarComUnidades(dados, unidades) {
    await ensureTagCommerceSchema();
    return withTransaction(async (client) => {
      const orderRes = await client.query(
        `INSERT INTO tag_product_orders
          (
            usuario_id, plan_slug, order_type, status, quantidade_tags, subtotal_centavos, desconto_centavos, total_centavos,
            promo_code, petshop_id, billing_name, billing_cpf_cnpj, billing_phone, billing_cep, billing_logradouro,
            billing_numero, billing_complemento, billing_bairro, billing_cidade, billing_uf, snapshot_json
          )
         VALUES
          (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21::jsonb
          )
         RETURNING *`,
        [
          dados.usuario_id,
          dados.plan_slug,
          dados.order_type,
          dados.status || 'aguardando_pagamento',
          dados.quantidade_tags || 0,
          dados.subtotal_centavos || 0,
          dados.desconto_centavos || 0,
          dados.total_centavos || 0,
          dados.promo_code || null,
          dados.petshop_id || null,
          dados.billing_name || null,
          dados.billing_cpf_cnpj || null,
          dados.billing_phone || null,
          dados.billing_cep || null,
          dados.billing_logradouro || null,
          dados.billing_numero || null,
          dados.billing_complemento || null,
          dados.billing_bairro || null,
          dados.billing_cidade || null,
          dados.billing_uf || null,
          JSON.stringify(dados.snapshot_json || {}),
        ]
      );
      const pedido = orderRes.rows[0];

      for (const unidade of (unidades || [])) {
        await client.query(
          `INSERT INTO tag_order_units
            (order_id, sequencia, pet_id, print_photo_url, personalization_status)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            pedido.id,
            unidade.sequencia,
            unidade.pet_id || null,
            unidade.print_photo_url || null,
            unidade.personalization_status || 'pendente',
          ]
        );
      }

      return pedido;
    });
  },

  async atualizarCheckout(orderId, orderNsu, checkoutUrl, invoiceSlug) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_product_orders
       SET infinitepay_order_nsu = $2,
           checkout_url = $3,
           invoice_slug = $4,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, orderNsu, checkoutUrl || null, invoiceSlug || null]
    );
    return r.rows[0] || null;
  },

  async buscarPorOrderNsu(orderNsu) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT * FROM tag_product_orders WHERE infinitepay_order_nsu = $1 LIMIT 1`,
      [orderNsu]
    );
    return r.rows[0] || null;
  },

  async marcarPago(orderId, transactionNsu) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_product_orders
       SET status = 'pago',
           transaction_nsu = COALESCE($2, transaction_nsu),
           paid_at = COALESCE(paid_at, NOW()),
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, transactionNsu || null]
    );
    return r.rows[0] || null;
  },

  async buscarPorIdEUsuario(orderId, usuarioId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT o.*
       FROM tag_product_orders o
       WHERE o.id = $1 AND o.usuario_id = $2`,
      [orderId, usuarioId]
    );
    return r.rows[0] || null;
  },

  async listarPorUsuario(usuarioId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT *
       FROM tag_product_orders
       WHERE usuario_id = $1
       ORDER BY data_criacao DESC
       LIMIT 100`,
      [usuarioId]
    );
    return r.rows;
  },

  async listarAdmin(filtros = {}) {
    await ensureTagCommerceSchema();
    const valores = [];
    const where = [];

    if (filtros.status) {
      valores.push(String(filtros.status).trim());
      where.push(`o.status = $${valores.length}`);
    }
    if (filtros.plan_slug) {
      valores.push(String(filtros.plan_slug).trim());
      where.push(`o.plan_slug = $${valores.length}`);
    }
    if (filtros.data_inicio) {
      valores.push(filtros.data_inicio);
      where.push(`o.data_criacao >= $${valores.length}::timestamptz`);
    }
    if (filtros.data_fim) {
      valores.push(filtros.data_fim);
      where.push(`o.data_criacao <= $${valores.length}::timestamptz`);
    }

    const limit = Number.isFinite(Number(filtros.limit)) ? Math.min(200, Math.max(1, Number(filtros.limit))) : 100;
    valores.push(limit);
    const limitPos = valores.length;

    const sql = `
      SELECT o.*, u.nome AS usuario_nome, u.email AS usuario_email
      FROM tag_product_orders o
      JOIN usuarios u ON u.id = o.usuario_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY o.data_criacao DESC
      LIMIT $${limitPos}
    `;
    const r = await query(sql, valores);
    return r.rows;
  },

  async buscarPorIdAdmin(orderId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT o.*, u.nome AS usuario_nome, u.email AS usuario_email
       FROM tag_product_orders o
       JOIN usuarios u ON u.id = o.usuario_id
       WHERE o.id = $1`,
      [orderId]
    );
    return r.rows[0] || null;
  },

  async obterResumoAdmin(filtros = {}) {
    await ensureTagCommerceSchema();
    const valores = [];
    const where = [];

    if (filtros.data_inicio) {
      valores.push(filtros.data_inicio);
      where.push(`o.data_criacao >= $${valores.length}::timestamptz`);
    }
    if (filtros.data_fim) {
      valores.push(filtros.data_fim);
      where.push(`o.data_criacao <= $${valores.length}::timestamptz`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const kpis = await query(
      `SELECT
         COUNT(*)::int AS total_pedidos,
         COUNT(*) FILTER (WHERE o.status = 'pago')::int AS pedidos_pagos,
         COUNT(*) FILTER (WHERE o.status = 'aguardando_pagamento')::int AS aguardando_pagamento,
         COALESCE(SUM(o.total_centavos) FILTER (WHERE o.status = 'pago'), 0)::int AS receita_centavos
       FROM tag_product_orders o
       ${whereSql}`,
      valores
    );

    const porPlano = await query(
      `SELECT
         o.plan_slug,
         COUNT(*)::int AS pedidos,
         COUNT(*) FILTER (WHERE o.status = 'pago')::int AS pagos,
         COALESCE(SUM(o.total_centavos) FILTER (WHERE o.status = 'pago'), 0)::int AS receita_centavos
       FROM tag_product_orders o
       ${whereSql}
       GROUP BY o.plan_slug
       ORDER BY o.plan_slug`,
      valores
    );

    const pendencias = await query(
      `SELECT COUNT(*)::int AS tags_pendentes_alocacao
       FROM tag_order_units u
       JOIN tag_product_orders o ON o.id = u.order_id
       ${whereSql ? `${whereSql} AND` : 'WHERE'}
       o.status = 'pago'
       AND u.nfc_tag_id IS NULL`,
      valores
    );

    return {
      kpis: kpis.rows[0] || {
        total_pedidos: 0,
        pedidos_pagos: 0,
        aguardando_pagamento: 0,
        receita_centavos: 0,
      },
      porPlano: porPlano.rows || [],
      pendencias: pendencias.rows[0] || { tags_pendentes_alocacao: 0 },
    };
  },

  async atualizarNotaFiscal(orderId, dados) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_product_orders
       SET nfe_numero = $2,
           nfe_chave = $3,
           nfe_url_pdf = $4,
           nfe_emitida_em = $5,
           admin_nf_obs = $6,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        orderId,
        dados.nfe_numero || null,
        dados.nfe_chave || null,
        dados.nfe_url_pdf || null,
        dados.nfe_emitida_em || null,
        dados.admin_nf_obs || null,
      ]
    );
    return r.rows[0] || null;
  },
};

module.exports = TagProductOrder;
