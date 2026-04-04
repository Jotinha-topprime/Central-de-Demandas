// ============================================================
// netlify/functions/enviar-demanda.js
//
// Rota: POST /.netlify/functions/enviar-demanda
//
// Recebe os dados do formulário do front-end,
// monta o cartão e cria no Trello usando as credenciais
// que ficam APENAS nas variáveis de ambiente do Netlify.
//
// Retorna: { ok: true, trelloUrl: "https://trello.com/c/..." }
// ============================================================

const https = require('https');

// ── CABEÇALHOS CORS ───────────────────────────────────────────
const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ── HELPER: Formata data "YYYY-MM-DD" → "DD/MM/YYYY" ─────────
function formatarData(s) {
  if (!s) return '—';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

// ── HELPER: Monta a descrição markdown do cartão no Trello ────
// Usa a sintaxe **Campo:** valor que o Trello renderiza no cartão
// e que o listar-demandas.js usa para extrair os dados de volta
function montarDescricao(d) {
  const empresas = { topprime: 'Top Prime', planoa: 'Plano A', alg3: 'ALG3' };
  return [
    `**Solicitante:** ${d.nome} (${d.email})`,
    `**Setor:** ${d.setor}`,
    `**Empresa:** ${empresas[d.empresa] || d.empresa}`,
    `**Material:** ${d.material}`,
    `**Prioridade:** ${d.prioridade}`,
    `**Prazo:** ${formatarData(d.prazo)}`,
    `---`,
    `**Objetivo:** ${d.objetivo}`,
    d.publico  ? `**Público-alvo:** ${d.publico}` : '',
    d.copy     ? `**Copy sugerida:** ${d.copy}`   : '',
    d.formato  ? `**Formato:** ${d.formato}`      : '',
    d.ref      ? `**Referências:** ${d.ref}`      : '',
    d.obs      ? `**Observações:** ${d.obs}`      : '',
  ].filter(Boolean).join('\n');
}

// ── HELPER: POST via https nativo ─────────────────────────────
// Cria o cartão no Trello — sem axios ou node-fetch
function postTrello(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.trello.com',
        path,
        method:  'POST',
        headers: { 'Content-Length': 0 },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(new Error('Resposta inválida do Trello'));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── FUNÇÃO PRINCIPAL ──────────────────────────────────────────
exports.handler = async (event) => {

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  // Só aceita POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ erro: 'Método não permitido' }),
    };
  }

  // Lê as credenciais do ambiente — nunca expostas ao front
  const TRELLO = {
    apiKey: process.env.TRELLO_API_KEY  || '',
    token:  process.env.TRELLO_TOKEN    || '',
    listId: process.env.TRELLO_LIST_ID  || '',
  };

  // Valida se as credenciais estão configuradas
  if (!TRELLO.apiKey || !TRELLO.token || !TRELLO.listId) {
    return {
      statusCode: 503,
      headers: HEADERS,
      body: JSON.stringify({ erro: 'Trello não configurado no servidor' }),
    };
  }

  // Lê e valida o body da requisição
  let demanda;
  try {
    demanda = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ erro: 'Dados inválidos' }),
    };
  }

  // Nome da empresa para o prefixo do cartão
  const empresas    = { topprime: 'Top Prime', planoa: 'Plano A', alg3: 'ALG3' };
  const nomeEmpresa = empresas[demanda.empresa] || demanda.empresa;

  // Monta os parâmetros do cartão com as credenciais do servidor
  const params = new URLSearchParams({
    name:   `[${nomeEmpresa}] ${demanda.titulo}`,
    desc:   montarDescricao(demanda),
    idList: TRELLO.listId,
    key:    TRELLO.apiKey,
    token:  TRELLO.token,
  });

  // Adiciona prazo se informado
  if (demanda.prazo) {
    params.set('due', new Date(demanda.prazo + 'T12:00:00').toISOString());
  }

  try {
    const resposta = await postTrello(`/1/cards?${params}`);

    if (resposta.status !== 200) {
      console.error('Trello rejeitou o cartão:', resposta.body);
      return {
        statusCode: 502,
        headers: HEADERS,
        body: JSON.stringify({ erro: 'Trello rejeitou a criação do cartão' }),
      };
    }

    // Sucesso — retorna a URL do cartão criado
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ ok: true, trelloUrl: resposta.body.url }),
    };

  } catch (e) {
    console.error('Erro ao criar cartão no Trello:', e.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ erro: 'Falha de conexão com o Trello' }),
    };
  }
};
