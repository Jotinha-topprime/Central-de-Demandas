// ============================================================
// netlify/functions/status.js
//
// Rota: GET /.netlify/functions/status
//
// Verifica se as variáveis de ambiente do Trello estão
// configuradas no painel do Netlify.
// Retorna { ok: true, trelloConfigurado: true/false }
//
// As credenciais vêm de process.env — configuradas em:
// Netlify → Site settings → Environment variables
// ============================================================

exports.handler = async (event) => {

  // Cabeçalhos CORS — necessário para o front conseguir chamar
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Preflight — o navegador faz isso antes de todo POST/GET cross-origin
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Verifica se as 4 variáveis obrigatórias estão presentes
  const trelloConfigurado = !!(
    process.env.TRELLO_API_KEY  &&
    process.env.TRELLO_TOKEN    &&
    process.env.TRELLO_BOARD_ID &&
    process.env.TRELLO_LIST_ID
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, trelloConfigurado }),
  };
};
