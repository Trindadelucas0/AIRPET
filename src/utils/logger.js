/**
 * logger.js — Dashboard Console para o AIRPET
 *
 * Sistema de logging visual com cores ANSI, tabelas, banners e
 * request logger integrado. Zero dependencias externas.
 */

// ─── Cores ANSI ─────────────────────────────────────────────────────────────

const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  black:   '\x1b[30m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:    '\x1b[41m',
  bgGreen:  '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue:   '\x1b[44m',
  bgMagenta:'\x1b[45m',
  bgCyan:   '\x1b[46m',
  bgWhite:  '\x1b[47m',
  gray:   '\x1b[90m',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function hora() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

function dataCompleta() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano} ${hora()}`;
}

function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s.substring(0, len) : s + ' '.repeat(len - s.length);
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// ─── Formatadores de linha ──────────────────────────────────────────────────

const MODULO_WIDTH = 22;

function info(modulo, mensagem) {
  const tag = `${c.bgGreen}${c.black}${c.bold} INFO  ${c.reset}`;
  const tempo = `${c.gray}${hora()}${c.reset}`;
  const mod = `${c.cyan}${pad(modulo, MODULO_WIDTH)}${c.reset}`;
  console.log(`${tag} ${tempo}  ${mod} ${c.white}${mensagem}${c.reset}`);
}

function error(modulo, mensagem, err) {
  const tag = `${c.bgRed}${c.white}${c.bold} ERRO  ${c.reset}`;
  const tempo = `${c.gray}${hora()}${c.reset}`;
  const mod = `${c.cyan}${pad(modulo, MODULO_WIDTH)}${c.reset}`;
  const detalhe = err?.message ? ` ${c.dim}→ ${err.message}${c.reset}` : '';
  console.error(`${tag} ${tempo}  ${mod} ${c.red}${mensagem}${c.reset}${detalhe}`);
}

function warn(modulo, mensagem) {
  const tag = `${c.bgYellow}${c.black}${c.bold} AVISO ${c.reset}`;
  const tempo = `${c.gray}${hora()}${c.reset}`;
  const mod = `${c.cyan}${pad(modulo, MODULO_WIDTH)}${c.reset}`;
  console.warn(`${tag} ${tempo}  ${mod} ${c.yellow}${mensagem}${c.reset}`);
}

// ─── Banner de Startup ──────────────────────────────────────────────────────

function banner(opcoes = {}) {
  const {
    versao = '1.0.0',
    porta = 3000,
    ambiente = process.env.NODE_ENV || 'development',
    db = 'Conectado',
    migrations = null,
  } = opcoes;

  const W = 58;
  const borda = '═'.repeat(W - 2);
  const linha = (label, valor) => {
    const conteudo = `  ${pad(label, 14)}${c.dim}│${c.reset} ${valor}`;
    const visivel = stripAnsi(conteudo);
    const espacos = W - 2 - visivel.length;
    return `${c.cyan}║${c.reset}${conteudo}${' '.repeat(Math.max(0, espacos))}${c.cyan}║${c.reset}`;
  };

  const titulo = 'AIRPET v' + versao;
  const tituloSpaces = Math.floor((W - 2 - titulo.length) / 2);
  const tituloLinha = `${c.cyan}║${c.reset}${' '.repeat(tituloSpaces)}${c.bold}${c.green}${titulo}${c.reset}${' '.repeat(W - 2 - tituloSpaces - titulo.length)}${c.cyan}║${c.reset}`;

  const ambienteCor = ambiente === 'production' ? c.red : c.green;
  const dbCor = db === 'Conectado' ? c.green : c.red;
  const migInfo = migrations
    ? (migrations.erros > 0
      ? `${c.yellow}${migrations.ok}/${migrations.total} OK, ${migrations.erros} erro(s)${c.reset}`
      : `${c.green}${migrations.ok}/${migrations.total} OK${c.reset}`)
    : `${c.dim}npm run db:migrate${c.reset}`;

  console.log('');
  console.log(`${c.cyan}╔${borda}╗${c.reset}`);
  console.log(tituloLinha);
  console.log(`${c.cyan}╠${borda}╣${c.reset}`);
  console.log(linha('Status',     `${c.green}${c.bold}Online${c.reset}`));
  console.log(linha('Porta',      `${c.bold}${porta}${c.reset}`));
  console.log(linha('Ambiente',   `${ambienteCor}${c.bold}${ambiente}${c.reset}`));
  console.log(linha('Node',       `${c.bold}${process.version}${c.reset}`));
  console.log(linha('Database',   `${dbCor}${c.bold}${db}${c.reset}`));
  console.log(linha('Migrations', migInfo));
  console.log(linha('Hora',       `${c.bold}${dataCompleta()}${c.reset}`));
  console.log(`${c.cyan}╚${borda}╝${c.reset}`);
  console.log('');
}

// ─── Separador de Secao ─────────────────────────────────────────────────────

function secao(titulo) {
  const W = 60;
  const tituloStr = ` ${titulo.toUpperCase()} `;
  const restante = W - 4 - tituloStr.length;
  const direita = restante > 0 ? '─'.repeat(restante) : '';
  console.log('');
  console.log(`${c.cyan}${c.bold}─── ${tituloStr}${direita}${c.reset}`);
}

// ─── Tabela ─────────────────────────────────────────────────────────────────

function table(titulo, dados) {
  if (!dados || !dados.length) return;

  const colunas = Object.keys(dados[0]);
  const larguras = {};
  colunas.forEach(col => {
    larguras[col] = col.length;
    dados.forEach(row => {
      const val = String(row[col] ?? '');
      if (val.length > larguras[col]) larguras[col] = val.length;
    });
    larguras[col] = Math.min(larguras[col] + 2, 40);
  });

  const totalW = colunas.reduce((s, col) => s + larguras[col], 0) + colunas.length + 1;

  const bordaTop = `${c.gray}┌${'─'.repeat(totalW - 2)}┐${c.reset}`;
  const bordaSep = `${c.gray}├${colunas.map(col => '─'.repeat(larguras[col])).join('┼')}┤${c.reset}`;
  const bordaBot = `${c.gray}└${'─'.repeat(totalW - 2)}┘${c.reset}`;

  if (titulo) {
    const tituloStr = ` ${titulo} `;
    const visivel = totalW - 2;
    const tPad = Math.floor((visivel - tituloStr.length) / 2);
    console.log(`${c.gray}┌${'─'.repeat(Math.max(0, tPad))}${c.cyan}${c.bold}${tituloStr}${c.reset}${c.gray}${'─'.repeat(Math.max(0, visivel - tPad - tituloStr.length))}┐${c.reset}`);
  } else {
    console.log(bordaTop);
  }

  const header = colunas.map(col => `${c.bold}${c.white}${pad(col, larguras[col])}${c.reset}`).join(`${c.gray}│${c.reset}`);
  console.log(`${c.gray}│${c.reset}${header}${c.gray}│${c.reset}`);
  console.log(bordaSep);

  dados.forEach(row => {
    const cells = colunas.map(col => {
      const val = String(row[col] ?? '');
      return `${c.white}${pad(val, larguras[col])}${c.reset}`;
    }).join(`${c.gray}│${c.reset}`);
    console.log(`${c.gray}│${c.reset}${cells}${c.gray}│${c.reset}`);
  });

  console.log(bordaBot);
}

// ─── Request Logger (substitui morgan) ──────────────────────────────────────

const STATIC_EXT = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webmanifest)$/i;

function requestLogger() {
  return (req, res, next) => {
    if (STATIC_EXT.test(req.path)) return next();

    const inicio = Date.now();

    const originalEnd = res.end;
    res.end = function (...args) {
      res.end = originalEnd;
      res.end(...args);

      const duracao = Date.now() - inicio;
      const status = res.statusCode;
      const metodo = req.method;

      const metodoCores = {
        GET:    c.green,
        POST:   c.blue,
        PUT:    c.yellow,
        PATCH:  c.yellow,
        DELETE: c.red,
      };

      let statusCor;
      if (status < 300) statusCor = c.green;
      else if (status < 400) statusCor = c.cyan;
      else if (status < 500) statusCor = c.yellow;
      else statusCor = c.red;

      let tempoCor;
      if (duracao < 100) tempoCor = c.green;
      else if (duracao < 500) tempoCor = c.yellow;
      else tempoCor = c.red;

      const tag = `${c.bgBlue}${c.white}${c.bold} REQ  ${c.reset}`;
      const tempo = `${c.gray}${hora()}${c.reset}`;
      const met = `${metodoCores[metodo] || c.white}${c.bold}${pad(metodo, 7)}${c.reset}`;
      const url = `${c.white}${pad(req.originalUrl || req.url, 35)}${c.reset}`;
      const st = `${statusCor}${c.bold}${status}${c.reset}`;
      const dur = `${tempoCor}${duracao}ms${c.reset}`;

      console.log(`${tag}  ${tempo}  ${met} ${url} ${st}  ${dur}`);
    };

    next();
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = { info, error, warn, banner, secao, table, requestLogger };
