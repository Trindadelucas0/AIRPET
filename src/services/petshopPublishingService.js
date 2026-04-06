const PetshopPost = require('../models/PetshopPost');
const PetshopProduct = require('../models/PetshopProduct');
const PetPetshopLink = require('../models/PetPetshopLink');
const notificacaoService = require('./notificacaoService');
const petshopProductService = require('./petshopProductService');
const fs = require('fs');
const path = require('path');

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function hasMediaUrl(value) {
  return String(value || '').trim().length > 0;
}

function resolverCaminhoMidiaLocal(fotoUrl) {
  const raw = String(fotoUrl || '').trim();
  if (!raw || isHttpUrl(raw)) return null;

  const semQuery = raw.split('?')[0].split('#')[0];
  const relativo = semQuery.replace(/^\/+/, '');
  if (!relativo) return null;

  const publicDir = path.resolve(__dirname, '..', 'public');
  const filePath = path.resolve(publicDir, relativo);
  if (!filePath.startsWith(publicDir)) return null;
  return filePath;
}

function removerArquivoMidia(fotoUrl) {
  const caminho = resolverCaminhoMidiaLocal(fotoUrl);
  if (!caminho) return;
  fs.unlink(caminho, () => {});
}

const petshopPublishingService = {
  async criarPost(petshopId, accountId, dados) {
    const postType = dados.post_type || 'normal';
    const approval_status = 'aprovado';
    const isHighlighted = dados.is_highlighted === true || dados.is_highlighted === 'on' || dados.is_highlighted === '1';
    const highlightRank = dados.highlight_rank != null && String(dados.highlight_rank).trim() !== ''
      ? parseInt(dados.highlight_rank, 10)
      : 0;
    const serviceId = dados.service_id != null && String(dados.service_id).trim() !== ''
      ? parseInt(dados.service_id, 10)
      : null;
    const fotoUrl = dados.foto_url;

    if (postType === 'normal' && hasMediaUrl(fotoUrl)) {
      const totalFotos = await PetshopPost.contarFotosFeedAtivas(petshopId);
      if (totalFotos >= PetshopPost.MAX_FOTOS_FEED) {
        const maisAntiga = await PetshopPost.buscarFotoFeedMaisAntiga(petshopId);
        if (maisAntiga) {
          await PetshopPost.desativar(maisAntiga.id);
          removerArquivoMidia(maisAntiga.foto_url);
        }
      }
    }

    const post = await PetshopPost.criar({
      petshop_id: petshopId,
      criado_por_account_id: accountId,
      post_type: postType,
      approval_status,
      titulo: dados.titulo,
      texto: dados.texto,
      foto_url: fotoUrl,
      is_highlighted: isHighlighted,
      highlight_rank: Number.isFinite(highlightRank) ? highlightRank : 0,
    });

    if (postType === 'produto' || postType === 'promocao') {
      await petshopProductService.validarLimiteAtivos(petshopId);
      await PetshopProduct.criar({
        petshop_id: petshopId,
        post_id: post.id,
        nome: dados.nome_produto || dados.titulo || 'Produto',
        preco: dados.preco || 0,
        descricao: dados.descricao_produto || dados.texto || null,
        foto_url: dados.foto_url || null,
        contato_link: dados.contato_link || null,
        is_promocao: postType === 'promocao',
        service_id: serviceId,
        is_highlighted: isHighlighted,
        highlight_rank: Number.isFinite(highlightRank) ? highlightRank : 0,
      });
    }

    if (approval_status === 'aprovado') {
      if (postType === 'promocao') {
        await this.notificarVinculados(petshopId, dados.titulo || 'Nova promoção', `/petshops/${petshopId}`, 'sistema');
      } else if (postType === 'normal' && dados.relevante) {
        await this.notificarVinculados(petshopId, dados.titulo || 'Nova postagem relevante', `/petshops/${petshopId}`, 'sistema');
      } else if (postType === 'evento') {
        await this.notificarVinculados(petshopId, dados.titulo || 'Novo evento para seu pet', `/petshops/${petshopId}`, 'sistema');
      }
    }

    return post;
  },

  async notificarVinculados(petshopId, titulo, link, tipo = 'sistema') {
    const petsVinculados = await PetPetshopLink.listarPetsDoPetshop(petshopId);
    const usuariosViaPets = [...new Set((petsVinculados || []).map((p) => p.usuario_id).filter(Boolean))];
    const usuarios = [...new Set(usuariosViaPets)];
    if (!usuarios.length) return;
    const mensagem = `${titulo}`;
    await Promise.all(
      usuarios.map((uid) =>
        notificacaoService.criar(uid, tipo, mensagem, link || `/petshops/${petshopId}`)
      )
    );
  },
};

module.exports = petshopPublishingService;
