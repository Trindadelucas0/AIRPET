const PLANOS_PADRAO = [
  {
    slug: 'basico',
    nome: 'Basico',
    mensalidade_centavos: 1990,
    ordem: 1,
    features: {
      scan_publico_basico: true,
      explorar_busca: true,
      scan_rico: false,
      pet_perdido_mapa: false,
      petshop_proximo: false,
      notificacoes_multicanal: false,
    },
  },
  {
    slug: 'plus',
    nome: 'Plus',
    mensalidade_centavos: 2990,
    ordem: 2,
    features: {
      scan_publico_basico: true,
      explorar_busca: true,
      scan_rico: true,
      pet_perdido_mapa: true,
      petshop_proximo: false,
      notificacoes_multicanal: false,
    },
  },
  {
    slug: 'familia',
    nome: 'Familia',
    mensalidade_centavos: 3990,
    ordem: 3,
    features: {
      scan_publico_basico: true,
      explorar_busca: true,
      scan_rico: true,
      pet_perdido_mapa: true,
      petshop_proximo: true,
      notificacoes_multicanal: true,
    },
  },
];

const PACKS_TAG = [
  { quantidade: 1, preco_centavos: 4990 },
  { quantidade: 2, preco_centavos: 8000 },
  { quantidade: 4, preco_centavos: 14990 },
];

function precoHardwarePorQuantidade(quantidade) {
  const qtd = Number(quantidade) || 0;
  if (qtd <= 0) return 0;
  const pack = PACKS_TAG.find((p) => p.quantidade === qtd);
  if (pack) return pack.preco_centavos;
  if (qtd > 4) return qtd * 1500;
  return qtd * 4990;
}

module.exports = {
  PLANOS_PADRAO,
  PACKS_TAG,
  precoHardwarePorQuantidade,
};
