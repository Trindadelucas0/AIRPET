const PetshopPost = require('../models/PetshopPost');
const PetshopProduct = require('../models/PetshopProduct');
const PetPetshopLink = require('../models/PetPetshopLink');
const notificacaoService = require('./notificacaoService');
const petshopProductService = require('./petshopProductService');

const petshopPublishingService = {
  async criarPost(petshopId, accountId, dados) {
    const postType = dados.post_type || 'normal';
    const approval_status = postType === 'promocao' ? 'pendente' : 'aprovado';

    const post = await PetshopPost.criar({
      petshop_id: petshopId,
      criado_por_account_id: accountId,
      post_type: postType,
      approval_status,
      titulo: dados.titulo,
      texto: dados.texto,
      foto_url: dados.foto_url,
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
