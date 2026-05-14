/**
 * petController.js — Controller de gerenciamento de pets
 *
 * Responsável por todas as operações relacionadas aos pets:
 * listagem, cadastro, visualização de perfil, edição e saúde.
 *
 * Cada pet pertence a um usuário (tutor). O controller verifica
 * a propriedade antes de permitir edição ou visualização de dados sensíveis.
 *
 * Fluxos principais:
 *   - Listar meus pets → GET /pets
 *   - Cadastrar novo pet → GET /pets/cadastro → POST /pets
 *   - Ver perfil do pet → GET /pets/:id
 *   - Editar pet → GET /pets/:id/editar → POST /pets/:id/editar
 *   - Ver saúde do pet → GET /pets/:id/saude
 *
 * Dependências:
 *   - Pet (model): operações de banco para a tabela pets
 *   - Vacina (model): histórico de vacinas do pet
 *   - RegistroSaude (model): registros de saúde gerais
 *   - logger: registro de eventos e erros
 */

const Pet = require('../models/Pet');
const PetPerdido = require('../models/PetPerdido');
const Vacina = require('../models/Vacina');
const RegistroSaude = require('../models/RegistroSaude');
const TagScan = require('../models/TagScan');
const NfcTag = require('../models/NfcTag');
const Localizacao = require('../models/Localizacao');
const SeguidorPet = require('../models/SeguidorPet');
const Conversa = require('../models/Conversa');
const MensagemChat = require('../models/MensagemChat');
const PetStatusHistory = require('../models/PetStatusHistory');
const PetTrackingEvent = require('../models/PetTrackingEvent');
const petEventBus = require('../services/petEventBus');
const tagEntitlementService = require('../services/tagEntitlementService');
const petPlanLimitService = require('../services/petPlanLimitService');
const storageService = require('../services/storageService');
const { withTransaction } = require('../config/database');
const logger = require('../utils/logger');
const { multerPublicUrl } = require('../middlewares/persistUploadMiddleware');

const petController = {

  /**
   * Lista todos os pets do usuário autenticado.
   * Rota: GET /pets
   *
   * Busca os pets pelo ID do usuário na sessão e renderiza
   * a view com a lista (pode ser vazia para usuários novos).
   *
   * @param {object} req - Objeto de requisição (req.session.usuario contém o usuário logado)
   * @param {object} res - Objeto de resposta do Express
   */
  async listar(req, res) {
    try {
      /* Busca todos os pets vinculados ao usuário logado */
      const pets = await Pet.buscarPorUsuario(req.session.usuario.id);

      res.render('pets/meus-pets', {
        titulo: 'Meus Pets',
        pets,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao listar pets do usuário', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar seus pets.' };
      res.redirect('/');
    }
  },

  /**
   * Renderiza o formulário de cadastro de novo pet.
   * Rota: GET /pets/cadastro
   *
   * @param {object} req - Objeto de requisição do Express
   * @param {object} res - Objeto de resposta do Express
   */
  mostrarCadastro(req, res) {
    try {
      res.render('pets/cadastro', {
        titulo: 'Cadastrar Pet',
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao renderizar formulário de cadastro de pet', erro);
      res.status(500).render('partials/erro', {
        titulo: 'Erro interno',
        mensagem: 'Não foi possível carregar o formulário de cadastro.',
        codigo: 500,
      });
    }
  },

  /**
   * Cria um novo pet no sistema.
   * Rota: POST /pets
   *
   * Recebe os dados do formulário e opcionalmente um arquivo de foto
   * enviado via multer (disponível em req.file).
   *
   * O campo usuario_id é preenchido automaticamente a partir da sessão,
   * garantindo que o pet pertença ao usuário autenticado.
   *
   * @param {object} req - Requisição (body: dados do pet, file: foto do multer)
   * @param {object} res - Resposta do Express
   */
  async criar(req, res) {
    try {
      const usuarioId = req.session.usuario.id;
      const petsAtuais = await Pet.buscarPorUsuario(usuarioId);
      const { limitePets } = await petPlanLimitService.obterLimiteUsuario(usuarioId);
      if (petsAtuais.length >= limitePets) {
        req.session.flash = {
          tipo: 'erro',
          mensagem: `Seu plano atual permite até ${limitePets} pet(s). Faça upgrade para cadastrar mais.`,
        };
        return res.redirect('/pets/cadastro');
      }

      const { nome, tipo, tipo_custom, raca, cor, porte, sexo, dataNascimento, peso, descricao, telefoneContato,
        microchip, numero_pedigree, castrado: castradoBody, alergias_medicacoes, veterinario_nome, veterinario_telefone, observacoes } = req.body;
      const castrado = castradoBody === 'sim' || castradoBody === 'on' ? true : (castradoBody === 'nao' ? false : null);

      const foto = multerPublicUrl(req.file, 'pets');

      const dadosPet = {
        usuario_id: usuarioId,
        nome,
        tipo: tipo || 'cachorro',
        tipo_custom: tipo === 'outro' ? tipo_custom : null,
        raca,
        cor,
        porte,
        sexo,
        data_nascimento: dataNascimento || null,
        peso: peso ? parseFloat(peso) : null,
        foto,
        descricao_emocional: descricao,
        telefone_contato: telefoneContato,
        microchip,
        numero_pedigree,
        castrado,
        alergias_medicacoes,
        veterinario_nome,
        veterinario_telefone,
        observacoes,
      };

      const novoPet = await Pet.criar(dadosPet);

      logger.info('PET_CTRL', `Pet cadastrado: ${novoPet.nome} (ID: ${novoPet.id})`);

      res.render('pets/confirmacao', {
        titulo: `${novoPet.nome} cadastrado!`,
        pet: novoPet,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao cadastrar pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao cadastrar o pet. Tente novamente.' };
      res.redirect('/pets/cadastro');
    }
  },

  /**
   * Exibe o perfil completo de um pet.
   * Rota: GET /pets/:id
   *
   * Verifica se o pet existe e se pertence ao usuário logado.
   * Pets de outros tutores podem ser visualizados com dados limitados
   * (cenário de scan NFC por terceiros).
   *
   * @param {object} req - Requisição (params.id: UUID do pet)
   * @param {object} res - Resposta do Express
   */
  async mostrarPerfil(req, res) {
    try {
      const { id } = req.params;

      /* Busca o pet com dados do dono via JOIN */
      const pet = await Pet.buscarPorId(id);

      /* Verifica se o pet existe */
      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }

      /*
       * Verifica se o usuário logado é o dono do pet.
       * Essa flag é usada na view para mostrar/esconder botões de edição.
       */
      const ehDono = req.session.usuario && pet.usuario_id === req.session.usuario.id;

      let idadePet = null;
      if (pet.data_nascimento) {
        const nascimento = new Date(pet.data_nascimento);
        const hoje = new Date();
        const diffMs = hoje - nascimento;
        const anos = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
        const meses = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
        const dias = Math.floor((diffMs % (30.44 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));

        let idadeHumana = 0;
        if (pet.tipo === 'cachorro') {
          idadeHumana = anos <= 2 ? anos * 12 : 24 + (anos - 2) * 5;
        } else if (pet.tipo === 'gato') {
          idadeHumana = anos <= 2 ? anos * 12.5 : 25 + (anos - 2) * 4;
        }

        idadePet = { anos, meses, dias, idadeHumana, tipo: pet.tipo };
      }

      let pesoIdeal = null;
      if (pet.peso) {
        const tipoRef = PESO_IDEAL[pet.tipo] || {};
        let ref = tipoRef[pet.raca] || null;
        if (!ref && pet.tipo === 'cachorro') {
          if (pet.porte === 'pequeno') ref = tipoRef['default_pequeno'];
          else if (pet.porte === 'grande') ref = tipoRef['default_grande'];
          else ref = tipoRef['default_medio'];
        }
        if (!ref && pet.tipo === 'gato') ref = tipoRef['default'];

        if (ref) {
          pesoIdeal = {
            min: ref.min,
            max: ref.max,
            atual: parseFloat(pet.peso),
            status: parseFloat(pet.peso) < ref.min ? 'abaixo' : parseFloat(pet.peso) > ref.max ? 'acima' : 'ideal'
          };
        }
      }

      let calendario = [];
      if (ehDono) {
        try {
          const [vacinas, registros] = await Promise.all([
            Vacina.buscarPorPet(id),
            RegistroSaude.buscarPorPet(id),
          ]);

          vacinas.forEach(v => {
            if (v.data_proxima && new Date(v.data_proxima) >= new Date()) {
              calendario.push({
                tipo: 'vacina',
                titulo: v.nome_vacina,
                data: v.data_proxima,
                icone: 'fa-syringe',
                cor: 'blue'
              });
            }
          });

          registros.forEach(r => {
            if (r.data_proxima && new Date(r.data_proxima) >= new Date()) {
              calendario.push({
                tipo: r.tipo,
                titulo: r.descricao || r.tipo,
                data: r.data_proxima,
                icone: r.tipo === 'consulta' ? 'fa-stethoscope' : r.tipo === 'vermifugo' ? 'fa-pills' : 'fa-notes-medical',
                cor: r.tipo === 'consulta' ? 'green' : 'purple'
              });
            }
          });

          calendario.sort((a, b) => new Date(a.data) - new Date(b.data));
          calendario = calendario.slice(0, 5);
        } catch (e) {}
      }

      let scans = [];
      let tags = [];
      let tagsAtivas = [];
      let tagsHistorico = [];
      let fotosRecebidas = [];
      let alertaAtivo = null;
      let ultimoScanPerdido = null;
      if (ehDono) {
        [scans, tags, fotosRecebidas, alertaAtivo] = await Promise.all([
          TagScan.buscarPorPet(id, 20),
          NfcTag.buscarPorUsuario(req.session.usuario.id).then(lista => lista.filter(t => t.pet_id === parseInt(id, 10))),
          Localizacao.buscarComFotosPorPet(id, 20),
          PetPerdido.buscarAtivoPorPet(id),
        ]);
        tagsAtivas = (tags || []).filter((t) => t.status === 'active');
        tagsHistorico = (tags || []).filter((t) => t.status !== 'active');
        if (pet.status === 'perdido') {
          ultimoScanPerdido = await TagScan.ultimoScanPet(id);
        }
      }

      let totalSeguidores = 0;
      let estaSeguindo = false;
      try {
        totalSeguidores = await SeguidorPet.contarSeguidores(id);
        if (!ehDono && req.session.usuario) {
          estaSeguindo = await SeguidorPet.estaSeguindo(req.session.usuario.id, id);
        }
      } catch (_) { }

      res.render('pets/perfil', {
        titulo: `Perfil de ${pet.nome}`,
        pet,
        ehDono,
        scans,
        tags,
        tagsAtivas,
        tagsHistorico,
        fotosRecebidas,
        idadePet,
        calendario,
        pesoIdeal,
        alertaAtivo,
        ultimoScanPerdido,
        totalSeguidores,
        estaSeguindo,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao exibir perfil do pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o perfil do pet.' };
      res.redirect('/pets');
    }
  },

  /**
   * Renderiza o formulário de edição de um pet.
   * Rota: GET /pets/:id/editar
   *
   * Apenas o dono do pet pode editar. Se outro usuário tentar
   * acessar, recebe erro de permissão e é redirecionado.
   *
   * @param {object} req - Requisição (params.id: UUID do pet)
   * @param {object} res - Resposta do Express
   */
  async mostrarEditar(req, res) {
    try {
      const { id } = req.params;
      const pet = await Pet.buscarPorId(id);

      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }

      /* Apenas o dono pode editar */
      if (pet.usuario_id !== req.session.usuario.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para editar este pet.' };
        return res.redirect('/pets');
      }

      res.render('pets/editar', {
        titulo: `Editar ${pet.nome}`,
        pet,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao renderizar formulário de edição do pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o formulário de edição.' };
      res.redirect('/pets');
    }
  },

  /**
   * Atualiza os dados de um pet existente.
   * Rota: POST /pets/:id/editar
   *
   * Verifica propriedade antes de atualizar. Se uma nova foto
   * for enviada, atualiza também o campo de foto.
   *
   * @param {object} req - Requisição (params.id, body: dados, file: nova foto)
   * @param {object} res - Resposta do Express
   */
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const pet = await Pet.buscarPorId(id);

      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }

      /* Verifica se o usuário logado é o dono do pet */
      if (pet.usuario_id !== req.session.usuario.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para editar este pet.' };
        return res.redirect('/pets');
      }

      const { nome, tipo, tipo_custom, raca, cor, porte, sexo, dataNascimento, peso, descricao, telefoneContato,
        microchip, numero_pedigree, foto_cropped, castrado: castradoBody, alergias_medicacoes, veterinario_nome, veterinario_telefone, observacoes,
        bio_pet, privado,
      } = req.body;
      const castrado = castradoBody === 'sim' || castradoBody === 'on' ? true : (castradoBody === 'nao' ? false : null);

      await Pet.atualizar(id, {
        nome,
        tipo: tipo || 'cachorro',
        tipo_custom: tipo === 'outro' ? tipo_custom : null,
        raca,
        cor,
        porte,
        sexo,
        data_nascimento: dataNascimento || null,
        peso: peso ? parseFloat(peso) : null,
        descricao_emocional: descricao,
        telefone_contato: telefoneContato,
        microchip,
        numero_pedigree,
        castrado,
        alergias_medicacoes,
        veterinario_nome,
        veterinario_telefone,
        observacoes,
        bio_pet,
        privado,
      });

      /* Se uma nova foto foi enviada via multer, atualiza a foto separadamente */
      if (req.file) {
        try {
          const urlFoto = multerPublicUrl(req.file, 'pets');
          if (urlFoto) await Pet.atualizarFoto(id, urlFoto);
        } catch (errFoto) {
          logger.error('PET_CTRL', 'Erro ao atualizar foto do pet', errFoto);
          req.session.flash = { tipo: 'aviso', mensagem: 'Dados salvos, mas não foi possível atualizar a foto.' };
          return res.redirect(`/pets/${id}`);
        }
      } else if (foto_cropped) {
        try {
          const base64 = String(foto_cropped).trim();
          const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (match && match[2]) {
            const mimetype = match[1] || 'image/jpeg';
            const rawBase64 = match[2];
            const buffer = Buffer.from(rawBase64, 'base64');
            const { publicUrl } = await storageService.saveBuffer({
              buffer,
              mimetype,
              originalname: mimetype.includes('png') ? 'foto-crop.png' : 'foto-crop.jpg',
              folder: 'pets',
            });
            if (publicUrl) await Pet.atualizarFoto(id, publicUrl);
          }
        } catch (errFotoCrop) {
          logger.error('PET_CTRL', 'Erro ao processar foto recortada do pet', errFotoCrop);
          req.session.flash = { tipo: 'aviso', mensagem: 'Dados salvos, mas não foi possível atualizar a foto recortada.' };
          return res.redirect(`/pets/${id}`);
        }
      }

      logger.info('PET_CTRL', `Pet atualizado: ${nome} (ID: ${id})`);

      req.session.flash = { tipo: 'sucesso', mensagem: 'Dados do pet atualizados com sucesso!' };
      res.redirect(`/pets/${id}`);
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao atualizar pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar os dados do pet.' };
      res.redirect(`/pets/${req.params.id}/editar`);
    }
  },

  /**
   * Exibe a página de saúde do pet (vacinas e registros médicos).
   * Rota: GET /pets/:id/saude
   *
   * Busca simultaneamente as vacinas e os registros de saúde do pet.
   * Verifica propriedade — apenas o dono pode ver dados de saúde.
   *
   * @param {object} req - Requisição (params.id: UUID do pet)
   * @param {object} res - Resposta do Express
   */
  async mostrarSaude(req, res) {
    try {
      const { id } = req.params;
      const pet = await Pet.buscarPorId(id);

      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }

      /* Apenas o dono pode visualizar dados de saúde */
      if (pet.usuario_id !== req.session.usuario.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para ver a saúde deste pet.' };
        return res.redirect('/pets');
      }

      /*
       * Busca vacinas e registros de saúde em paralelo
       * usando Promise.all para melhor performance.
       */
      const [vacinas, registros] = await Promise.all([
        Vacina.buscarPorPet(id),
        RegistroSaude.buscarPorPet(id),
      ]);
      const plano = await tagEntitlementService.obterEstadoPlano(req.session.usuario.id);

      res.render('pets/saude', {
        titulo: `Saúde de ${pet.nome}`,
        pet,
        vacinas,
        registros,
        planoAtivo: Boolean(plano && plano.planoAtivo),
        planoSlug: plano?.planSlug || 'basico',
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao exibir dados de saúde do pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar os dados de saúde.' };
      res.redirect(`/pets/${req.params.id}`);
    }
  },

  /**
   * Renderiza a pagina de vinculacao de tag NFC a um pet.
   * Rota: GET /pets/:id/vincular-tag
   */
  async mostrarVincularTag(req, res) {
    try {
      const { id } = req.params;
      const pet = await Pet.buscarPorId(id);

      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }

      if (pet.usuario_id !== req.session.usuario.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para vincular tags a este pet.' };
        return res.redirect('/pets');
      }

      res.render('pets/vincular-tag', {
        titulo: `Vincular Tag - ${pet.nome}`,
        pet,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao exibir página de vinculação de tag', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a página.' };
      res.redirect(`/pets/${req.params.id}`);
    }
  },

  /**
   * Processa a vinculacao de tag NFC a um pet com validacao de codigo de ativacao.
   * Rota: POST /pets/:id/vincular-tag
   *
   * Recebe tag_code e codigo_ativacao, valida ambos e vincula
   * a tag diretamente ao pet (pula a etapa de escolha de pet).
   */
  async vincularTag(req, res) {
    const MAX_TENTATIVAS = 5;
    const BLOQUEIO_MINUTOS = 30;

    try {
      const { id } = req.params;
      const { tag_code, codigo_ativacao } = req.body;
      const usuarioId = req.session.usuario.id;

      const pet = await Pet.buscarPorId(id);

      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }

      if (pet.usuario_id !== usuarioId) {
        req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para vincular tags a este pet.' };
        return res.redirect('/pets');
      }

      if (!tag_code) {
        req.session.flash = { tipo: 'erro', mensagem: 'Código da tag não informado.' };
        return res.redirect(`/pets/${id}/vincular-tag`);
      }

      const tag = await NfcTag.buscarPorTagCode(tag_code.trim().toUpperCase());

      if (!tag) {
        req.session.flash = { tipo: 'erro', mensagem: 'Tag NFC não encontrada no sistema. Verifique o código.' };
        return res.redirect(`/pets/${id}/vincular-tag`);
      }

      if (tag.user_id && tag.user_id !== usuarioId) {
        req.session.flash = { tipo: 'erro', mensagem: 'Esta tag já está reservada para outra conta.' };
        return res.redirect(`/pets/${id}/vincular-tag`);
      }

      if (tag.status !== 'sent') {
        const msgs = {
          manufactured: 'Esta tag ainda não foi preparada para envio.',
          reserved: 'Esta tag está reservada mas ainda não foi enviada.',
          active: 'Esta tag já está ativa e vinculada a um pet.',
          blocked: 'Esta tag está bloqueada.',
        };
        req.session.flash = { tipo: 'erro', mensagem: msgs[tag.status] || 'Esta tag não está disponível para ativação.' };
        return res.redirect(`/pets/${id}/vincular-tag`);
      }

      if (tag.bloqueada_ate && new Date(tag.bloqueada_ate) > new Date()) {
        const minRestantes = Math.ceil((new Date(tag.bloqueada_ate) - new Date()) / 60000);
        req.session.flash = { tipo: 'erro', mensagem: `Muitas tentativas incorretas. Tente novamente em ${minRestantes} minuto(s).` };
        return res.redirect(`/pets/${id}/vincular-tag`);
      }

      if (!codigo_ativacao || tag.activation_code !== codigo_ativacao.trim().toUpperCase()) {
        const tagAtualizada = await withTransaction(async (client) => {
          const atual = await NfcTag.incrementarTentativas(tag.id, client);
          const tentativas = atual.tentativas_ativacao || 0;
          if (tentativas >= MAX_TENTATIVAS) {
            await NfcTag.bloquearTemporariamente(tag.id, BLOQUEIO_MINUTOS, client);
          }
          return atual;
        });
        const tentativas = tagAtualizada.tentativas_ativacao || 0;
        const restantes = MAX_TENTATIVAS - tentativas;

        if (tentativas >= MAX_TENTATIVAS) {
          logger.warn('PET_CTRL', `Tag ${tag_code} bloqueada por ${BLOQUEIO_MINUTOS}min após ${tentativas} tentativas`);
          req.session.flash = { tipo: 'erro', mensagem: `Muitas tentativas incorretas. Tag bloqueada por ${BLOQUEIO_MINUTOS} minutos.` };
        } else {
          req.session.flash = { tipo: 'erro', mensagem: `Código de ativação inválido. Restam ${restantes} tentativa(s).` };
        }
        return res.redirect(`/pets/${id}/vincular-tag`);
      }

      await withTransaction(async (client) => {
        await NfcTag.resetarTentativas(tag.id, client);
        const reservada = await NfcTag.reservar(tag.id, usuarioId, client);
        if (!reservada) {
          throw new Error('TAG_RESERVA_INVALIDA');
        }
        const anteriorAtiva = await NfcTag.buscarAtivaPorPetId(id, client);
        const novaTag = await NfcTag.ativar(tag.id, id, client);
        if (!novaTag) {
          throw new Error('FALHA_ATIVACAO_TAG');
        }
        if (anteriorAtiva && Number(anteriorAtiva.id) !== Number(novaTag.id)) {
          await NfcTag.desativarPorSubstituicao(anteriorAtiva.id, novaTag.id, client);
        }
      });

      logger.info('PET_CTRL', `Tag ${tag_code} vinculada ao pet ${pet.nome} (ID: ${id}) pelo usuário ${usuarioId}`);

      req.session.flash = { tipo: 'sucesso', mensagem: `Tag vinculada a ${pet.nome} com sucesso! A tag NFC agora identifica seu pet.` };
      return res.redirect(`/pets/${id}`);
    } catch (erro) {
      if (erro && erro.message === 'TAG_RESERVA_INVALIDA') {
        req.session.flash = { tipo: 'erro', mensagem: 'Esta tag está vinculada a outra conta e não pode ser ativada por este usuário.' };
        return res.redirect(`/pets/${req.params.id}/vincular-tag`);
      }
      logger.error('PET_CTRL', 'Erro ao vincular tag ao pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao vincular a tag. Tente novamente.' };
      return res.redirect(`/pets/${req.params.id}/vincular-tag`);
    }
  },

  /**
   * Exibe a página com QR Code do perfil do pet.
   * Rota: GET /pets/:id/qr
   */
  async mostrarQr(req, res) {
    try {
      const { id } = req.params;
      const pet = await Pet.buscarPorId(id);
      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }
      const ehDono = req.session.usuario && pet.usuario_id === req.session.usuario.id;
      if (!ehDono) {
        req.session.flash = { tipo: 'erro', mensagem: 'Acesso restrito ao dono do pet.' };
        return res.redirect(`/pets/${id}`);
      }
      const petProfileUrl = `${req.protocol}://${req.get('host')}/p/${pet.slug || pet.id}`;
      return res.render('pets/qr', {
        titulo: `QR Code — ${pet.nome}`,
        pet,
        petProfileUrl,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao exibir QR do pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao gerar QR Code.' };
      return res.redirect('/pets');
    }
  },

  /**
   * API inline: alterna status do pet entre 'perdido' e 'seguro' sem trocar de página.
   * Rota: POST /pets/:id/toggle-status
   */
  async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const usuarioId = req.session.usuario.id;
      const pet = await Pet.buscarPorId(id);

      if (!pet) return res.status(404).json({ sucesso: false, mensagem: 'Pet não encontrado.' });
      if (pet.usuario_id !== usuarioId) return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });

      if (pet.status === 'perdido') {
        const alerta = await PetPerdido.buscarAtivoPorPet(id);
        await withTransaction(async (client) => {
          if (alerta) {
            await PetPerdido.resolver(alerta.id, client);
            try {
              const conversas = await Conversa.buscarPorPetPerdido(alerta.id, client);
              for (const c of conversas) {
                await MensagemChat.deletarPorConversa(c.id, client);
                await Conversa.encerrar(c.id, client);
              }
            } catch (_) { }
          }
          await Pet.atualizarStatus(id, 'seguro', client);
        });
        PetStatusHistory.registrar({ pet_id: parseInt(id, 10), usuario_id: usuarioId, old_status: 'perdido', new_status: 'seguro' }).catch(() => {});
        PetTrackingEvent.registrar({ pet_id: parseInt(id, 10), event_type: 'status_change', source: 'owner', visibility: 'owner', metadata: { novoStatus: 'seguro', atorId: usuarioId } }).catch(() => {});
        petEventBus.emit(id, 'status_change', { petId: id, novoStatus: 'seguro', ts: Date.now() });
        logger.info('PET_CTRL', `Pet ${pet.nome} (${id}) marcado como ENCONTRADO pelo tutor ${usuarioId}`);
        return res.json({ sucesso: true, novoStatus: 'seguro', mensagem: `${pet.nome} está em segurança!` });
      } else {
        const { descricao, latitude, longitude, recompensa } = req.body || {};
        await withTransaction(async (client) => {
          await PetPerdido.criar({
            pet_id: parseInt(id, 10),
            descricao: descricao || 'Reportado pelo tutor.',
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            cidade: null,
            recompensa: recompensa || null,
          }, client);
          await Pet.atualizarStatus(id, 'perdido', client);
        });
        PetStatusHistory.registrar({ pet_id: parseInt(id, 10), usuario_id: usuarioId, old_status: 'seguro', new_status: 'perdido', descricao, latitude, longitude, recompensa }).catch(() => {});
        PetTrackingEvent.registrar({ pet_id: parseInt(id, 10), event_type: 'status_change', source: 'owner', latitude, longitude, visibility: 'public', metadata: { novoStatus: 'perdido', descricao, atorId: usuarioId } }).catch(() => {});
        petEventBus.emit(id, 'status_change', { petId: id, novoStatus: 'perdido', ts: Date.now() });
        logger.info('PET_CTRL', `Pet ${pet.nome} (${id}) reportado como PERDIDO pelo tutor ${usuarioId}`);
        return res.json({ sucesso: true, novoStatus: 'perdido', mensagem: `${pet.nome} foi reportado como perdido. O alerta será publicado após análise.` });
      }
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao alternar status do pet', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar status. Tente novamente.' });
    }
  },

  /**
   * API inline: bloqueia ou desbloqueia uma tag NFC do pet.
   * Rota: POST /pets/:id/tags/:tagId/toggle-block
   */
  async toggleBlockTag(req, res) {
    try {
      const { id, tagId } = req.params;
      const usuarioId = req.session.usuario.id;

      const pet = await Pet.buscarPorId(id);
      if (!pet || pet.usuario_id !== usuarioId) return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });

      const tag = await NfcTag.buscarPorId(tagId);
      if (!tag || tag.user_id !== usuarioId) return res.status(404).json({ sucesso: false, mensagem: 'Tag não encontrada.' });

      let tagAtualizada;
      if (tag.status === 'blocked') {
        tagAtualizada = await NfcTag.desbloquear(tagId);
      } else {
        tagAtualizada = await NfcTag.bloquear(tagId);
      }

      return res.json({ sucesso: true, tag: tagAtualizada, novoStatus: tagAtualizada ? tagAtualizada.status : null });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao alternar bloqueio de tag', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar tag.' });
    }
  },

  /**
   * SSE — stream de eventos em tempo real do perfil do pet.
   * Rota: GET /pets/:id/events
   * Emite: nfc_scan, status_change, follow
   */
  sseEvents(req, res) {
    try {
      const { id } = req.params;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(`event: connected\ndata: ${JSON.stringify({ petId: id, ts: Date.now() })}\n\n`);
      petEventBus.subscribe(id, res);
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao iniciar SSE', erro);
      try { res.end(); } catch (_) {}
    }
  },

  /**
   * API inline: alterna seguimento de um pet pelo usuário logado.
   * Rota: POST /pets/:id/seguir
   */
  async toggleSeguir(req, res) {
    try {
      const { id } = req.params;
      const usuarioId = req.session.usuario.id;
      const pet = await Pet.buscarPorId(id);
      if (!pet) return res.status(404).json({ sucesso: false, mensagem: 'Pet não encontrado.' });
      if (pet.usuario_id === usuarioId) return res.status(400).json({ sucesso: false, mensagem: 'Você não pode seguir seu próprio pet.' });

      const jaSeguindo = await SeguidorPet.estaSeguindo(usuarioId, id);
      if (jaSeguindo) {
        await SeguidorPet.deixarDeSeguir(usuarioId, id);
      } else {
        await SeguidorPet.seguir(usuarioId, id);
      }
      const totalSeguidores = await SeguidorPet.contarSeguidores(id);
      return res.json({ sucesso: true, seguindo: !jaSeguindo, totalSeguidores });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao alternar seguimento', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar seguimento.' });
    }
  },

  /**
   * API: dados do alerta ativo de um pet (para modal de notificação de pet perdido).
   * Rota: GET /api/pets/:id/alerta-ativo
   *
   * @param {object} req - req.params.id = pet_id
   * @param {object} res - JSON { pet_nome, pet_foto, recompensa, descricao, pet_id } ou 404
   */
  async alertaAtivo(req, res) {
    try {
      const petId = parseInt(req.params.id, 10);
      if (!petId) {
        return res.status(400).json({ ativo: false, mensagem: 'ID do pet inválido.' });
      }
      const alerta = await PetPerdido.buscarAtivoPorPet(petId);
      if (!alerta) {
        return res.status(404).json({ ativo: false, mensagem: 'Nenhum alerta ativo para este pet.' });
      }
      return res.json({
        ativo: true,
        pet_id: alerta.pet_id,
        pet_nome: alerta.pet_nome,
        pet_foto: alerta.pet_foto,
        recompensa: alerta.recompensa || null,
        descricao: alerta.descricao || null,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao buscar alerta ativo', erro);
      return res.status(500).json({ ativo: false, mensagem: 'Erro ao carregar dados do alerta.' });
    }
  },
};

const PESO_IDEAL = {
  cachorro: {
    'Labrador': { min: 25, max: 36 },
    'Golden Retriever': { min: 25, max: 34 },
    'Pastor Alemão': { min: 22, max: 40 },
    'Bulldog': { min: 18, max: 25 },
    'Poodle': { min: 3, max: 32 },
    'Yorkshire': { min: 2, max: 3.5 },
    'Shih Tzu': { min: 4, max: 7.5 },
    'Pinscher': { min: 3, max: 5 },
    'Pit Bull': { min: 14, max: 27 },
    'Rottweiler': { min: 36, max: 60 },
    'default_pequeno': { min: 2, max: 10 },
    'default_medio': { min: 10, max: 25 },
    'default_grande': { min: 25, max: 45 },
  },
  gato: {
    'default': { min: 3.5, max: 5.5 },
    'Persa': { min: 3, max: 5.5 },
    'Siamês': { min: 3, max: 5 },
    'Maine Coon': { min: 5, max: 11 },
  },
};

module.exports = petController;
