function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const val = Number(raw);
  return Number.isFinite(val) ? Math.round(val) : fallback;
}

const PLANOS_PADRAO = [
  {
    slug: 'basico',
    nome: 'AIRPET Essencial',
    mensalidade_centavos: envInt('TAG_PLAN_BASICO_CENTS', 1990),
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
    nome: 'AIRPET Protecao',
    mensalidade_centavos: envInt('TAG_PLAN_PROTECAO_CENTS', 2990),
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
    nome: 'AIRPET Rede',
    mensalidade_centavos: envInt('TAG_PLAN_REDE_CENTS', 3990),
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
  { quantidade: 1, preco_centavos: envInt('TAG_HARDWARE_QTD1_CENTS', 4990) },
  { quantidade: 2, preco_centavos: envInt('TAG_HARDWARE_QTD2_CENTS', 8000) },
  { quantidade: 4, preco_centavos: envInt('TAG_HARDWARE_QTD4_CENTS', 14990) },
];

function precoHardwarePorQuantidade(quantidade) {
  const qtd = Number(quantidade) || 0;
  if (qtd <= 0) return 0;
  const pack = PACKS_TAG.find((p) => p.quantidade === qtd);
  if (pack) return pack.preco_centavos;
  if (qtd > 4) return qtd * envInt('TAG_HARDWARE_EXTRA_UNIT_CENTS', 1500);
  return qtd * envInt('TAG_HARDWARE_UNIT_FALLBACK_CENTS', 4990);
}

module.exports = {
  PLANOS_PADRAO,
  PACKS_TAG,
  precoHardwarePorQuantidade,
};
