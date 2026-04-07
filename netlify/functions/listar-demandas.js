// ============================================================
// netlify/functions/listar-demandas.js
//
// Rota: GET /.netlify/functions/listar-demandas
//
// Busca todos os cartões do board do Trello,
// filtra os que vieram deste sistema (prefixo [Empresa]),
// e retorna agrupados por empresa:
// { topprime: [...], planoa: [...], alg3: [...] }
//
// Credenciais lidas de process.env — nunca expostas ao front.
// ============================================================

const https = require('https');

// ── CABEÇALHOS CORS ───────────────────────────────────────────
// Necessário para o front hospedado no Netlify chamar esta function
const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ── HELPER: GET via https nativo ──────────────────────────────
// Faz uma requisição GET e retorna o JSON já parseado
function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Resposta inválida do Trello: ' + data.substring(0, 200)));
        }
      });
    }).on('error', reject);
  });
}

// ── HELPER: Formata data ──────────────────────────────────────
function formatarData(s) {
  if (!s) return '—';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

// ── HELPER: Traduz nome da lista → status do sistema ──────────
function traduzirStatus(nomeLista) {
  const n = (nomeLista || '').toLowerCase();
  if (n.includes('produção') || n.includes('producao') || n.includes('andamento')) return 'Em produção';
  if (n.includes('concluí') || (n.includes('publicado')  || n.includes('concluido') || n.includes('done'))     return 'Concluído';
  return 'Aguardando';
}

// ── FUNÇÃO PRINCIPAL ──────────────────────────────────────────
exports.handler = async (event) => {

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  // Lê as credenciais do ambiente — configuradas no painel do Netlify
  const TRELLO = {
    apiKey:  process.env.TRELLO_API_KEY  || '',
    token:   process.env.TRELLO_TOKEN    || '',
    boardId: process.env.TRELLO_BOARD_ID || '',
  };

  // Se não houver credenciais, retorna listas vazias sem erro
  if (!TRELLO.apiKey || !TRELLO.boardId) {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ topprime: [], planoa: [], alg3: [] }),
    };
  }

  try {
    const base = `key=${TRELLO.apiKey}&token=${TRELLO.token}`;

    // Busca cartões e listas do board em paralelo (mais rápido)
    const [cartoes, listas] = await Promise.all([
      getJSON(`https://api.trello.com/1/boards/${TRELLO.boardId}/cards?${base}&fields=name,desc,due,idList,url,dateLastActivity`),
      getJSON(`https://api.trello.com/1/boards/${TRELLO.boardId}/lists?${base}&fields=id,name`),
    ]);

    // Monta mapa idList → nome da lista para traduzir o status
    const mapaListas = {};
    listas.forEach(l => { mapaListas[l.id] = l.name; });

    // Resultado agrupado por empresa
    const resultado = { topprime: [], planoa: [], alg3: [] };

    cartoes.forEach(cartao => {
      // Identifica a empresa pelo prefixo do nome do cartão
      let empresa = null;
      if      (cartao.name.startsWith('[Top Prime]')) empresa = 'topprime';
      else if (cartao.name.startsWith('[Plano A]'))   empresa = 'planoa';
      else if (cartao.name.startsWith('[ALG3]'))       empresa = 'alg3';
      else return; // Cartão não veio deste sistema — ignora

      // Remove o prefixo "[Empresa]" do título para exibição
      const titulo = cartao.name.replace(/^\[.*?\]\s*/, '');

      // Extrai campos da descrição markdown do cartão
      // Ex: **Setor:** Comercial → "Comercial"
      const desc    = cartao.desc || '';
      const extrair = (campo) => {
        const match = desc.match(new RegExp(`\\*\\*${campo}:\\*\\*\\s*(.+)`));
        return match ? match[1].trim() : '—';
      };

      resultado[empresa].push({
        id:         cartao.url,
        titulo,
        empresa,
        setor:      extrair('Setor'),
        material:   extrair('Material'),
        prioridade: extrair('Prioridade'),
        prazo:      cartao.due ? cartao.due.split('T')[0] : '',
        nome:       extrair('Solicitante').replace(/\s*\(.*\)$/, ''), // remove "(email)"
        status:     traduzirStatus(mapaListas[cartao.idList]),
        trelloUrl:  cartao.url,
        criadoEm:   cartao.dateLastActivity,
      });
    });

    // Ordena cada empresa por data de atividade (mais recentes primeiro)
    Object.keys(resultado).forEach(emp => {
      resultado[emp].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify(resultado),
    };

  } catch (e) {
    console.error('Erro ao buscar demandas do Trello:', e.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ erro: 'Falha ao buscar demandas do Trello' }),
    };
  }
};
