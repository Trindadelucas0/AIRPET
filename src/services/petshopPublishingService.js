const PetshopPost = require('../models/PetshopPost');
const PetshopProduct = require('../models/PetshopProduct');
const PetshopFollower = require('../models/PetshopFollower');
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

    if (postType === 'promocao' && approval_status === 'aprovado') {
      await this.notificarPublicoElegivel(petshopId, post.id, dados.titulo || 'Nova promoção');
    }

    return post;
  },

  async notificarPublicoElegivel(petshopId, postId, titulo) {
    const seguidores = await PetshopFollower.listarSeguidores(petshopId);
    const petsVinculados = await PetPetshopLink.listarPetsDoPetshop(petshopId);
    const usuariosViaPets = [...new Set((petsVinculados || []).map((p) => p.usuario_id).filter(Boolean))];
    const usuarios = [...new Set([...(seguidores || []).map((s) => s.usuario_id), ...usuariosViaPets])];

    const mensagem = `Nova promoção disponível: ${titulo}`;
    await Promise.all(
      usuarios.map((uid) =>
        notificacaoService.criar(uid, 'sistema', mensagem, `/petshops/${petshopId}`)
      )
    );
  },
};

module.exports = petshopPublishingService;
