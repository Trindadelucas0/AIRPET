/** Encerra o pool pg uma vez apos todos os arquivos de teste. */
module.exports = async () => {
  try {
    const { pool } = require('../../src/config/database');
    await pool.end();
  } catch (_) {
    /* pool ja encerrado ou app nao carregou */
  }
};
