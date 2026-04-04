/* ============================================================
   js/app.js — Lógica principal da Central de Demandas

   ARQUITETURA:
   O front NUNCA fala com o Trello diretamente.
   Localmente  → chama http://localhost:3001/api/...
   No Netlify  → chama /.netlify/functions/...

   A detecção é automática: se estiver rodando em localhost,
   usa o servidor local. Caso contrário, usa as Functions.
   Assim o mesmo arquivo funciona nos dois ambientes.
   ============================================================ */

// ── URL BASE DA API ───────────────────────────────────────────
// Detecta automaticamente se está rodando local ou no Netlify.
// Local:   chama o server.js em localhost:3001/api/rota
// Netlify: chama /.netlify/functions/rota
const IS_LOCAL = window.location.hostname === 'localhost' ||
                 window.location.hostname === '127.0.0.1';

const API_BASE = IS_LOCAL
  ? 'http://localhost:8080/api'       // Servidor Node.js local
  : '/.netlify/functions';            // Netlify Functions em produção

// Monta a URL completa de cada rota
// Local:   http://localhost:3001/api/listar-demandas
// Netlify: /.netlify/functions/listar-demandas
const API = {
  status:   `${API_BASE}/status`,
  listar:   `${API_BASE}/listar-demandas`,
  enviar:   `${API_BASE}/enviar-demanda`,
};

// ── ESTADO GLOBAL ─────────────────────────────────────────────
const estadoForm = {
  topprime: { material: null, prioridade: null },
  planoa:   { material: null, prioridade: null },
  alg3:     { material: null, prioridade: null }
};

const prefixos      = { topprime: 'tp', planoa: 'pa', alg3: 'a3' };
const prefixosStats = { topprime: 'stp', planoa: 'spa', alg3: 'sa3' };

// Dados em memória — populados via listar-demandas
let demandas = { topprime: [], planoa: [], alg3: [] };

// ── INICIALIZAÇÃO ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  inicializarAbas();
  inicializarBotoesSelecao();

  // Fecha painel Trello ao clicar fora
  document.addEventListener('click', e => {
    const panel = document.getElementById('trelloPanel');
    const btn   = document.getElementById('trelloBtnHeader');
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  // Carrega as demandas do servidor (que busca no Trello)
  await carregarDemandas();
});

// ── CARREGAR DEMANDAS ─────────────────────────────────────────
// Faz GET em /listar-demandas → servidor busca no Trello e retorna
async function carregarDemandas() {
  try {
    const res = await fetch(API.listar);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    demandas = await res.json();
  } catch (e) {
    console.warn('Não foi possível carregar demandas:', e.message);
    showToast('Servidor offline — demandas não carregadas', '#d4930a');
  }

  // Renderiza mesmo se der erro (lista vazia)
  ['topprime', 'planoa', 'alg3'].forEach(empresa => {
    renderizarLista(empresa);
    atualizarStats(empresa);
  });
}

// ── ABAS ──────────────────────────────────────────────────────
function inicializarAbas() {
  document.querySelectorAll('.nav-tab').forEach(aba => {
    aba.addEventListener('click', () => {
      const empresa = aba.dataset.company;
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      aba.classList.add('active');
      document.getElementById('tab-' + empresa).classList.add('active');
      document.querySelector('.app').dataset.theme = empresa;
    });
  });
}

// ── BOTÕES DE SELEÇÃO (material e prioridade) ─────────────────
function inicializarBotoesSelecao() {
  ['topprime', 'planoa', 'alg3'].forEach(empresa => {

    document.querySelectorAll(`#mat-${empresa} .mat-option`).forEach(opcao => {
      opcao.addEventListener('click', () => {
        document.querySelectorAll(`#mat-${empresa} .mat-option`).forEach(o => o.classList.remove('selected'));
        opcao.classList.add('selected');
        estadoForm[empresa].material = opcao.dataset.val;
      });
    });

    document.querySelectorAll(`#prio-${empresa} .prio-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#prio-${empresa} .prio-btn`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        estadoForm[empresa].prioridade = btn.dataset.val;
      });
    });
  });
}

// ── TOGGLE DO PAINEL TRELLO ───────────────────────────────────
function toggleTrelloPanel() {
  document.getElementById('trelloPanel').classList.toggle('open');
}

// ── SUBMETER DEMANDA ──────────────────────────────────────────
// Valida o form, envia para /enviar-demanda,
// o servidor cria o cartão no Trello com as credenciais seguras
async function submitDemand(empresa) {
  const p = prefixos[empresa];

  // Lê todos os campos
  const nome     = document.getElementById(p + '-nome').value.trim();
  const email    = document.getElementById(p + '-email').value.trim();
  const setor    = document.getElementById(p + '-setor').value;
  const titulo   = document.getElementById(p + '-titulo').value.trim();
  const objetivo = document.getElementById(p + '-objetivo').value.trim();
  const prazo    = document.getElementById(p + '-prazo').value;
  const publico  = document.getElementById(p + '-publico')?.value.trim() || '';
  const copy     = document.getElementById(p + '-copy')?.value.trim()    || '';
  const formato  = document.getElementById(p + '-formato')?.value.trim() || '';
  const ref      = document.getElementById(p + '-ref')?.value.trim()     || '';
  const obs      = document.getElementById(p + '-obs')?.value.trim()     || '';

  // Validação dos obrigatórios
  if (!nome || !email || !setor || !titulo || !objetivo || !prazo) {
    showToast('Preencha todos os campos obrigatórios (*)', '#d94f4f');
    return;
  }
  if (!estadoForm[empresa].material) {
    showToast('Selecione o tipo de material', '#d94f4f');
    return;
  }
  if (!estadoForm[empresa].prioridade) {
    showToast('Selecione a prioridade', '#d94f4f');
    return;
  }

  // Desabilita o botão durante o envio para evitar duplo clique
  const btn = document.querySelector(`#form-${empresa} .btn-submit`);
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

  try {
    // Envia ao servidor — ele cria o cartão no Trello com as credenciais seguras
    const res = await fetch(API.enviar, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa, titulo, setor,
        material:   estadoForm[empresa].material,
        prioridade: estadoForm[empresa].prioridade,
        prazo, nome, email, objetivo, publico, copy, formato, ref, obs,
      }),
    });

    const resultado = await res.json();

    if (!res.ok) {
      showToast(resultado.erro || 'Erro ao enviar demanda', '#d94f4f');
      return;
    }

    showToast('Demanda enviada com sucesso ✓', null);
    clearForm(empresa);

    // Recarrega a lista para mostrar o novo cartão vindo do Trello
    await carregarDemandas();

  } catch (e) {
    showToast('Erro: servidor inacessível', '#d94f4f');
    console.error(e);
  } finally {
    // Reabilita o botão independente do resultado
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar demanda'; }
  }
}

// ── RENDERIZAR LISTA ──────────────────────────────────────────
// Desenha os cards de demanda na seção "Demandas recentes"
function renderizarLista(empresa) {
  const lista = document.getElementById('list-' + empresa);

  if (!demandas[empresa] || !demandas[empresa].length) {
    lista.innerHTML = '<p class="empty-msg">Nenhuma demanda enviada ainda.</p>';
    return;
  }

  lista.innerHTML = demandas[empresa].map(d => {
    const sc = normalizarStatus(d.status);

    // Link para o cartão no Trello (abre numa nova aba)
    const linkTrello = d.trelloUrl
      ? ` · <a href="${d.trelloUrl}" target="_blank" style="color:inherit;opacity:0.7">↗ Trello</a>`
      : '';

    return `
      <div class="demand-item">
        <div class="demand-status s-${sc}"></div>
        <div class="demand-info">
          <div class="demand-title">${escaparHtml(d.titulo)}</div>
          <div class="demand-meta">
            ${escaparHtml(d.setor)} · ${escaparHtml(d.material)} ·
            Prazo: ${formatarData(d.prazo)} · ${escaparHtml(d.nome)}${linkTrello}
          </div>
        </div>
        <span class="demand-badge b-${sc}">${d.status}</span>
      </div>`;
    // Nota: o status reflete a lista onde o cartão está no Trello.
    // Para mudar o status, arraste o cartão de lista no Trello.
    // A próxima vez que a página carregar, o status já aparece atualizado.
  }).join('');
}

// ── ATUALIZAR STATS ───────────────────────────────────────────
function atualizarStats(empresa) {
  const sp  = prefixosStats[empresa];
  const arr = demandas[empresa] || [];
  document.getElementById(sp + '-total').textContent = arr.length;
  document.getElementById(sp + '-ag').textContent    = arr.filter(d => d.status === 'Aguardando').length;
  document.getElementById(sp + '-prod').textContent  = arr.filter(d => d.status === 'Em produção').length;
  document.getElementById(sp + '-ok').textContent    = arr.filter(d => d.status === 'Concluído').length;
}

// ── LIMPAR FORMULÁRIO ─────────────────────────────────────────
function clearForm(empresa) {
  const p = prefixos[empresa];
  ['nome','email','titulo','objetivo','publico','copy','formato','ref','obs','prazo'].forEach(campo => {
    const el = document.getElementById(p + '-' + campo);
    if (el) el.value = '';
  });
  const sel = document.getElementById(p + '-setor');
  if (sel) sel.selectedIndex = 0;
  document.querySelectorAll(`#mat-${empresa} .mat-option`).forEach(o => o.classList.remove('selected'));
  document.querySelectorAll(`#prio-${empresa} .prio-btn`).forEach(b => b.classList.remove('selected'));
  estadoForm[empresa].material   = null;
  estadoForm[empresa].prioridade = null;
}

const limparFormulario = clearForm;

// ── UTILITÁRIOS ───────────────────────────────────────────────

// Formata "YYYY-MM-DD" → "DD/MM/YYYY"
function formatarData(s) {
  if (!s) return '—';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

// Escapa HTML para evitar XSS ao renderizar dados do usuário na tela
function escaparHtml(t) {
  if (!t) return '';
  return t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Converte status textual → classe CSS válida (sem espaços/acentos)
function normalizarStatus(status) {
  return {
    'Aguardando':  'aguardando',
    'Em produção': 'emproducao',
    'Concluído':   'concluido',
  }[status] || 'aguardando';
}

// Toast de notificação flutuante no canto inferior direito
function showToast(msg, bg) {
  const toast = document.getElementById('toast');
  toast.textContent      = msg;
  toast.style.background = bg || null;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}
