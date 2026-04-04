/* ============================================================
   trello.js — UI do painel Trello no header

   IMPORTANTE:
   Neste arquivo NÃO existem mais credenciais do Trello.
   A API Key, Token, Board ID e List ID ficam APENAS no servidor,
   no arquivo .env, que nunca é enviado ao navegador.

   Este arquivo cuida apenas:
   - Mostrar/ocultar o painel do header
   - Exibir o status da integração (consultando /api/status)
   ============================================================ */

// ── VERIFICA STATUS DO TRELLO AO CARREGAR ────────────────────
// Consulta o servidor para saber se o Trello está configurado
// e atualiza o indicador visual no header
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch(`${API_URL}/api/status`);
    const data = await res.json();

    const dot   = document.getElementById('trelloDot');
    const label = document.getElementById('trello-header-label');
    const badge = document.getElementById('trelloStatusBadge');
    const info  = document.getElementById('trelloPanelInfo');

    if (data.trelloConfigurado) {
      // Trello configurado no servidor → indicador verde
      if (dot)   dot.classList.add('connected');
      if (label) label.textContent = 'Trello ✓';
      if (badge) { badge.textContent = 'Conectado'; badge.classList.add('connected'); }
      if (info)  info.textContent = 'Integração ativa. As demandas enviadas aparecem automaticamente no quadro do Trello.';
    } else {
      // Não configurado → indicador padrão (vermelho/cinza)
      if (badge) badge.textContent = 'Não configurado';
      if (info)  info.textContent = 'Trello não configurado no servidor.';
    }
  } catch (e) {
    // Servidor offline — não atualiza o badge
    console.warn('Servidor inacessível ao verificar status do Trello');
  }
});

// ── TOGGLE DO PAINEL ──────────────────────────────────────────
// Abre/fecha o dropdown do header ao clicar no botão "Trello"
function toggleTrelloPanel() {
  document.getElementById('trelloPanel').classList.toggle('open');
}
