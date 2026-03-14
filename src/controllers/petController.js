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
const Vacina = require('../models/Vacina');
const RegistroSaude = require('../models/RegistroSaude');
const TagScan = require('../models/TagScan');
const NfcTag = require('../models/NfcTag');
const logger = require('../utils/logger');

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
      const { nome, tipo, tipo_custom, raca, cor, porte, sexo, dataNascimento, peso, descricao, telefoneContato } = req.body;

      const foto = req.file ? `/images/pets/${req.file.filename}` : null;

      const dadosPet = {
        usuario_id: req.session.usuario.id,
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
      if (ehDono) {
        scans = await TagScan.buscarPorPet(id, 10);
        tags = await NfcTag.buscarPorUsuario(req.session.usuario.id);
        tags = tags.filter(t => t.pet_id === parseInt(id, 10));
      }

      res.render('pets/perfil', {
        titulo: `Perfil de ${pet.nome}`,
        pet,
        ehDono,
        scans,
        tags,
        idadePet,
        calendario,
        pesoIdeal,
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

      const { nome, tipo, tipo_custom, raca, cor, porte, sexo, dataNascimento, peso, descricao, telefoneContato } = req.body;

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
      });

      /* Se uma nova foto foi enviada via multer, atualiza a foto separadamente */
      if (req.file) {
        await Pet.atualizarFoto(id, `/images/pets/${req.file.filename}`);
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

      res.render('pets/saude', {
        titulo: `Saúde de ${pet.nome}`,
        pet,
        vacinas,
        registros,
      });
    } catch (erro) {
      logger.error('PET_CTRL', 'Erro ao exibir dados de saúde do pet', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar os dados de saúde.' };
      res.redirect(`/pets/${req.params.id}`);
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
