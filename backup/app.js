/* ============================================================
   app.js — Lógica principal da Central de Demandas

   ARQUITETURA:
   O front NUNCA fala com o Trello diretamente.
   Todas as operações passam pelo servidor local:
     POST /api/enviar-demanda   → servidor cria cartão no Trello
     GET  /api/listar-demandas  → servidor busca cartões e retorna
   ============================================================ */

// ── ESTADO GLOBAL ─────────────────────────────────────────────
const estadoForm = {
  topprime: { material: null, prioridade: null },
  planoa:   { material: null, prioridade: null },
  alg3:     { material: null, prioridade: null }
};

const prefixos      = { topprime: 'tp', planoa: 'pa', alg3: 'a3' };
const prefixosStats = { topprime: 'stp', planoa: 'spa', alg3: 'sa3' };

let demandas = { topprime: [], planoa: [], alg3: [] };

// URL base do servidor — ao rodar local, é localhost
// Ao publicar em produção, troque pelo seu domínio/IP público
const API_URL = 'https://demanda-marketing.netlify.app/';

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

  // Carrega demandas do servidor (que busca no Trello)
  await carregarDemandas();
});

// ── CARREGAR DEMANDAS ─────────────────────────────────────────
async function carregarDemandas() {
  try {
    const res = await fetch(`${API_URL}/api/listar-demandas`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    demandas = await res.json();
  } catch (e) {
    console.warn('Não foi possível carregar demandas:', e.message);
    showToast('Servidor offline — demandas não carregadas', '#d4930a');
  }

  // Renderiza independente de erro (pode ser lista vazia)
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
async function submitDemand(empresa) {
  const p = prefixos[empresa];

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

  if (!nome || !email || !setor || !titulo || !objetivo || !prazo) {
    showToast('Preencha todos os campos obrigatórios (*)', '#d94f4f');
    return;
  }
  if (!estadoForm[empresa].material)   { showToast('Selecione o tipo de material', '#d94f4f');  return; }
  if (!estadoForm[empresa].prioridade) { showToast('Selecione a prioridade', '#d94f4f');         return; }

  // Desabilita botão durante envio para evitar duplo clique
  const btn = document.querySelector(`#form-${empresa} .btn-submit`);
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

  try {
    // Envia os dados ao servidor — ele cria o cartão no Trello com as credenciais seguras
    const res = await fetch(`${API_URL}/api/enviar-demanda`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
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

    // Recarrega a lista para mostrar a nova demanda vinda do Trello
    await carregarDemandas();

  } catch (e) {
    showToast('Erro: servidor inacessível', '#d94f4f');
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar demanda'; }
  }
}

// ── RENDERIZAR LISTA ──────────────────────────────────────────
function renderizarLista(empresa) {
  const lista = document.getElementById('list-' + empresa);

  if (!demandas[empresa] || !demandas[empresa].length) {
    lista.innerHTML = '<p class="empty-msg">Nenhuma demanda enviada ainda.</p>';
    return;
  }

  lista.innerHTML = demandas[empresa].map(d => {
    const sc = normalizarStatus(d.status);
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
  }).join('');
  // Status reflete a lista onde o cartão está no Trello.
  // Para alterar o status, mova o cartão de lista no próprio Trello.
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
function formatarData(s) {
  if (!s) return '—';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

function escaparHtml(t) {
  if (!t) return '';
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function normalizarStatus(status) {
  return { 'Aguardando':'aguardando', 'Em produção':'emproducao', 'Concluído':'concluido' }[status] || 'aguardando';
}

function showToast(msg, bg) {
  const toast = document.getElementById('toast');
  toast.textContent    = msg;
  toast.style.background = bg || null;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}
