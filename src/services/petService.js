/**
 * petService.js — Serviço de gerenciamento de pets do sistema AIRPET
 *
 * Este módulo contém a lógica de negócio para operações com pets.
 * Coordena entre o model Pet e regras como verificação de propriedade,
 * garantindo que apenas o dono de um pet possa alterá-lo.
 *
 * Regras de negócio:
 *   - Cada pet pertence a exatamente um usuário (tutor/dono)
 *   - Apenas o dono pode atualizar ou excluir seu pet
 *   - A foto do pet é armazenada como caminho relativo no servidor
 */

const Pet = require('../models/Pet');
const logger = require('../utils/logger');

const petService = {

  /**
   * Cadastra um novo pet vinculado a um usuário.
   *
   * Recebe os dados do formulário de cadastro e o ID do usuário
   * autenticado, mesclando-os para criar o registro completo.
   *
   * @param {object} dados - Dados do pet vindos do formulário/requisição
   * @param {string} dados.nome - Nome do pet (ex: 'Rex', 'Mimi')
   * @param {string} dados.especie - Espécie do animal ('cachorro', 'gato', etc.)
   * @param {string} dados.raca - Raça do pet (ex: 'Labrador', 'Persa')
   * @param {string} dados.cor - Cor predominante do pet
   * @param {string} dados.porte - Porte do animal ('pequeno', 'medio', 'grande')
   * @param {string} dados.sexo - Sexo do pet ('macho' ou 'femea')
   * @param {number} dados.idade - Idade estimada em anos
   * @param {number} dados.peso - Peso em quilogramas
   * @param {string} [dados.foto] - Caminho da foto (opcional no cadastro)
   * @param {string} [dados.descricao] - Descrição livre / observações
   * @param {string} usuarioId - UUID do tutor/dono autenticado (vem da sessão/token)
   * @returns {Promise<object>} O registro completo do pet recém-criado
   * @throws {Error} Se houver erro na inserção no banco
   *
   * @example
   * const pet = await petService.criar({
   *   nome: 'Rex', especie: 'cachorro', raca: 'Labrador',
   *   cor: 'caramelo', porte: 'grande', sexo: 'macho',
   *   idade: 3, peso: 28
   * }, 'uuid-do-usuario');
   */
  async criar(dados, usuarioId) {
    logger.info('PetService', `Criando pet para o usuário: ${usuarioId}`);

    /**
     * Mescla os dados do formulário com o ID do usuário autenticado.
     * O usuario_id não vem do formulário (segurança) — vem da sessão/token.
     */
    const dadosPet = {
      ...dados,
      usuario_id: usuarioId,
    };

    const pet = await Pet.criar(dadosPet);

    logger.info('PetService', `Pet criado com sucesso: ${pet.id} (${pet.nome})`);

    return pet;
  },

  /**
   * Busca um pet pelo ID, incluindo informações do dono/tutor.
   *
   * Utiliza o método buscarPorId do model Pet, que já faz JOIN
   * com a tabela de usuários para trazer o campo 'dono_nome'.
   * Ideal para páginas de detalhe do pet e perfil público.
   *
   * @param {string} petId - UUID do pet a ser buscado
   * @returns {Promise<object|null>} Pet com dados do dono, ou null se não encontrado
   *
   * @example
   * const pet = await petService.buscarComDono('uuid-do-pet');
   * // pet.dono_nome = 'João Silva'
   */
  async buscarComDono(petId) {
    logger.info('PetService', `Buscando pet com dados do dono: ${petId}`);

    const pet = await Pet.buscarPorId(petId);

    if (!pet) {
      logger.warn('PetService', `Pet não encontrado: ${petId}`);
      return null;
    }

    return pet;
  },

  /**
   * Lista todos os pets pertencentes a um usuário específico.
   *
   * Retorna um array ordenado do mais recente para o mais antigo.
   * Usado na página "Meus Pets" do painel do tutor.
   *
   * @param {string} usuarioId - UUID do tutor/dono
   * @returns {Promise<Array>} Lista de pets do usuário (pode ser vazia)
   *
   * @example
   * const pets = await petService.listarDoUsuario('uuid-do-usuario');
   * // pets = [{ id, nome, especie, ... }, ...]
   */
  async listarDoUsuario(usuarioId) {
    logger.info('PetService', `Listando pets do usuário: ${usuarioId}`);

    const pets = await Pet.buscarPorUsuario(usuarioId);

    logger.info('PetService', `Encontrados ${pets.length} pet(s) para o usuário: ${usuarioId}`);

    return pets;
  },

  /**
   * Atualiza os dados cadastrais de um pet.
   *
   * Antes de atualizar, verifica se o pet existe e se o usuário
   * que está tentando atualizar é realmente o dono. Essa verificação
   * de propriedade é uma regra de negócio crítica de segurança.
   *
   * @param {string} petId - UUID do pet a ser atualizado
   * @param {object} dados - Novos dados do pet
   * @param {string} dados.nome - Nome atualizado
   * @param {string} dados.especie - Espécie atualizada
   * @param {string} dados.raca - Raça atualizada
   * @param {string} dados.cor - Cor atualizada
   * @param {string} dados.porte - Porte atualizado
   * @param {string} dados.sexo - Sexo atualizado
   * @param {number} dados.idade - Idade atualizada
   * @param {number} dados.peso - Peso atualizado
   * @param {string} [dados.descricao] - Descrição atualizada
   * @param {string} usuarioId - UUID do usuário que está solicitando a atualização
   * @returns {Promise<object>} O registro do pet atualizado
   * @throws {Error} Se o pet não for encontrado ou o usuário não for o dono
   *
   * @example
   * const pet = await petService.atualizar('uuid-pet', { nome: 'Rex Jr.' }, 'uuid-usuario');
   */
  async atualizar(petId, dados, usuarioId) {
    logger.info('PetService', `Atualizando pet: ${petId} pelo usuário: ${usuarioId}`);

    /* Busca o pet para verificar se existe e quem é o dono */
    const petExistente = await Pet.buscarPorId(petId);

    if (!petExistente) {
      throw new Error('Pet não encontrado');
    }

    /**
     * Verificação de propriedade: apenas o dono pode editar o pet.
     * Compara o usuario_id do pet com o ID do usuário autenticado.
     * Isso impede que um tutor altere o pet de outro tutor.
     */
    if (petExistente.usuario_id !== usuarioId) {
      logger.warn('PetService', `Tentativa de edição não autorizada do pet: ${petId} pelo usuário: ${usuarioId}`);
      throw new Error('Você não tem permissão para editar este pet');
    }

    const petAtualizado = await Pet.atualizar(petId, dados);

    logger.info('PetService', `Pet atualizado com sucesso: ${petId}`);

    return petAtualizado;
  },

  /**
   * Atualiza apenas a foto de perfil de um pet.
   *
   * Separado do método atualizar() porque o upload de foto
   * passa por um fluxo diferente (middleware multer) e só
   * precisa alterar o campo 'foto' no banco.
   *
   * @param {string} petId - UUID do pet
   * @param {string} fotoPath - Caminho relativo da nova foto (ex: '/images/pets/uuid.jpg')
   * @returns {Promise<object>} O registro do pet com a foto atualizada
   * @throws {Error} Se o pet não for encontrado
   *
   * @example
   * const pet = await petService.atualizarFoto('uuid-pet', '/images/pets/foto123.jpg');
   */
  async atualizarFoto(petId, fotoPath) {
    logger.info('PetService', `Atualizando foto do pet: ${petId}`);

    const pet = await Pet.atualizarFoto(petId, fotoPath);

    if (!pet) {
      throw new Error('Pet não encontrado');
    }

    logger.info('PetService', `Foto do pet atualizada: ${petId}`);

    return pet;
  },
};

module.exports = petService;
