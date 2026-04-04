/* ============================================================
   js/trello.js — UI do painel Trello no header

   IMPORTANTE:
   Neste arquivo NÃO existem credenciais do Trello.
   A API Key, Token, Board ID e List ID ficam APENAS no servidor
   (arquivo .env local ou variáveis de ambiente do Netlify).

   Este arquivo cuida apenas de:
   - Detectar automaticamente se está rodando local ou no Netlify
   - Consultar /status para saber se o Trello está configurado
   - Atualizar o indicador visual no header (verde/vermelho)
   - Abrir/fechar o painel dropdown do header
   ============================================================ */

// ── DETECÇÃO DE AMBIENTE ──────────────────────────────────────
// Mesma lógica do app.js — detecta se está local ou em produção.
// Precisa ficar aqui também porque o trello.js carrega antes do app.js
// e não pode depender de variáveis definidas em outro arquivo.
const TRELLO_IS_LOCAL = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';

// URL da rota de status — muda conforme o ambiente
// Local:   http://localhost:3001/api/status
// Netlify: /.netlify/functions/status
const TRELLO_STATUS_URL = TRELLO_IS_LOCAL
  ? 'http://localhost:8080/api/status'
  : '/.netlify/functions/status';

// ── VERIFICA STATUS DO TRELLO AO CARREGAR ────────────────────
// Consulta o servidor/function para saber se as credenciais
// do Trello estão configuradas e atualiza o indicador no header
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch(TRELLO_STATUS_URL);
    const data = await res.json();

    // Elementos visuais do header e do painel
    const dot   = document.getElementById('trelloDot');
    const label = document.getElementById('trello-header-label');
    const badge = document.getElementById('trelloStatusBadge');
    const info  = document.getElementById('trelloPanelInfo');

    if (data.trelloConfigurado) {
      // Trello configurado → indicador verde no header
      if (dot)   dot.classList.add('connected');
      if (label) label.textContent = 'Trello ✓';
      if (badge) {
        badge.textContent = 'Conectado';
        badge.classList.add('connected');
      }
      if (info) {
        info.textContent = 'Integração ativa. As demandas enviadas aparecem automaticamente no quadro do Trello.';
      }
    } else {
      // Credenciais ausentes → indicador padrão (vermelho/cinza)
      if (badge) badge.textContent = 'Não configurado';
      if (info) {
        info.textContent = TRELLO_IS_LOCAL
          ? 'Trello não configurado. Preencha o arquivo .env e reinicie o servidor.'
          : 'Trello não configurado. Adicione as variáveis de ambiente no painel do Netlify.';
      }
    }
  } catch (e) {
    // Servidor/function inacessível — avisa no console, não trava a página
    console.warn('Não foi possível verificar o status do Trello:', e.message);

    const badge = document.getElementById('trelloStatusBadge');
    const info  = document.getElementById('trelloPanelInfo');
    if (badge) badge.textContent = 'Servidor offline';
    if (info)  info.textContent  = 'Não foi possível conectar ao servidor para verificar o status.';
  }
});

// ── TOGGLE DO PAINEL ──────────────────────────────────────────
// Abre/fecha o dropdown do header ao clicar no botão "Trello"
function toggleTrelloPanel() {
  document.getElementById('trelloPanel').classList.toggle('open');
}
