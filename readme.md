# Central de Demandas — Marketing

Sistema para gestores solicitarem demandas ao setor de Marketing,
com suporte a múltiplas empresas (Top Prime, Plano A, ALG3),
integração com Trello e persistência em JSON local via Node.js. (desnecessário e descontinuado, apenas para testes)

---

## Estrutura de arquivos

```
sistema de demandas/
│
├── index.html              ← Página principal
├── server.js               ← Servidor Node.js (persistência + arquivos estáticos)
├── dados.json              ← Criado automaticamente — armazena as demandas
├── trello-config.json      ← Criado automaticamente — credenciais do Trello
│
├── css/
│   └── style.css           ← Estilos com temas por empresa
│
├── js/
│   ├── app.js              ← Lógica principal
│   └── trello.js           ← Módulo de integração Trello
│
└── README.md               ← Este arquivo
```

---

## Como rodar (Node.js — recomendado)

### Pré-requisitos
- Node.js instalado: https://nodejs.org

### Iniciar o servidor

```bash
# Entre na pasta do projeto
cd "C:\Users\joaov\Downloads\sistema de demandas"

# Inicie o servidor (sem instalar dependências — usa apenas módulos nativos)
node server.js
```

Acesse no navegador: **http://localhost:3001**

Para compartilhar na rede local (outros dispositivos no mesmo Wi-Fi):
- Descubra seu IP: abra o CMD e digite `ipconfig`
- Acesse de outro dispositivo: `http://SEU_IP:3001`

### O que o servidor faz
- Serve os arquivos HTML, CSS e JS
- Salva as demandas em `dados.json` (persiste entre reinicios)
- Salva a configuração do Trello em `trello-config.json`
- Expõe as rotas: `GET /demandas`, `POST /demandas`, `GET /trello-config`, `POST /trello-config`

---

## Temas por empresa

| Empresa   | Esquema de cores       |
|-----------|------------------------|
| Top Prime | Preto & Dourado-Amarelo |
| Plano A   | Azul Profundo & Branco  |
| ALG3      | Azul Claro & Off-White  |

O tema muda automaticamente ao trocar de aba.

---

## Integração com o Trello

A configuração do Trello fica no **header global** do sistema
(botão "Trello" no canto superior direito), valendo para todas as empresas.

### Passo a passo

1. Acesse https://trello.com/app-key e copie sua **API Key**
2. Na mesma página, clique em **"Generate a Token"** e copie o token
3. Crie um quadro no Trello com 3 listas: `Aguardando`, `Em produção`, `Concluído`
4. Descubra o **Board ID**: abra o quadro, adicione `.json` no final da URL
5. Descubra o **List ID** da lista "Aguardando":
   ```
   https://api.trello.com/1/boards/SEU_BOARD_ID/lists?key=SUA_KEY&token=SEU_TOKEN
   ```
6. No sistema, clique em **"Trello"** no header, preencha os campos e salve

---

## Migração para Supabase

Quando quiser sair do JSON local e usar um banco de dados real,
siga estes passos:

### 1. Criar o projeto no Supabase
- Acesse https://supabase.com e crie um novo projeto
- Anote a **URL** e a **anon key** do projeto (em Settings → API)

### 2. Criar a tabela de demandas

No SQL Editor do Supabase, execute:

```sql
create table demandas (
  id          bigint primary key,
  empresa     text not null check (empresa in ('topprime', 'planoa', 'alg3')),
  titulo      text not null,
  setor       text,
  material    text,
  prioridade  text,
  prazo       date,
  nome        text,
  email       text,
  objetivo    text,
  publico     text,
  copy        text,
  formato     text,
  ref         text,
  obs         text,
  status      text default 'Aguardando',
  trello_url  text,
  criado_em   timestamptz default now()
);

-- Habilitar acesso público (ajuste as policies conforme necessário)
alter table demandas enable row level security;

create policy "Leitura pública" on demandas for select using (true);
create policy "Inserção pública" on demandas for insert with check (true);
create policy "Atualização pública" on demandas for update using (true);
```

### 3. Criar tabela de configuração do Trello

```sql
create table trello_config (
  id        int primary key default 1,
  api_key   text,
  token     text,
  board_id  text,
  list_id   text,
  enabled   boolean default false
);

insert into trello_config (id) values (1);
```

### 4. Instalar o cliente Supabase

```bash
npm install @supabase/supabase-js
```

Ou via CDN no HTML (sem Node.js):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.js"></script>
```

### 5. Substituir as funções de persistência em app.js

Substitua `carregarDemandas()` e `salvarDemandas()` pelo seguinte:

```javascript
// Adicione no topo do app.js:
const SUPABASE_URL  = 'https://XXXXXXXX.supabase.co';
const SUPABASE_KEY  = 'sua-anon-key-aqui';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Carregar todas as demandas agrupadas por empresa
async function carregarDemandas() {
  const { data, error } = await supabase
    .from('demandas')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) { console.error(error); return; }

  demandas = { topprime: [], planoa: [], alg3: [] };
  data.forEach(d => {
    if (demandas[d.empresa]) demandas[d.empresa].push(d);
  });
}

// Inserir nova demanda
async function inserirDemanda(demanda) {
  const { error } = await supabase.from('demandas').insert([{
    id:         demanda.id,
    empresa:    demanda.empresa,
    titulo:     demanda.titulo,
    setor:      demanda.setor,
    material:   demanda.material,
    prioridade: demanda.prioridade,
    prazo:      demanda.prazo,
    nome:       demanda.nome,
    email:      demanda.email,
    objetivo:   demanda.objetivo,
    publico:    demanda.publico,
    copy:       demanda.copy,
    formato:    demanda.formato,
    ref:        demanda.ref,
    obs:        demanda.obs,
    status:     demanda.status,
    trello_url: demanda.trelloUrl,
  }]);
  if (error) console.error('Erro ao inserir:', error);
}

// Atualizar status de uma demanda
async function atualizarStatusSupabase(id, novoStatus) {
  const { error } = await supabase
    .from('demandas')
    .update({ status: novoStatus })
    .eq('id', id);
  if (error) console.error('Erro ao atualizar status:', error);
}
```

### 6. Ajustar server.js para usar Supabase (opcional)
Se preferir manter o servidor Node.js como proxy, instale:

```bash
npm install @supabase/supabase-js
```

E substitua as leituras/escritas de arquivo pelas chamadas ao Supabase.
Consulte a documentação em https://supabase.com/docs/reference/javascript

---

## Tecnologias

- HTML5 + CSS3 com variáveis customizadas (temas)
- JavaScript puro (sem frameworks — compatível com qualquer ambiente)
- Node.js com módulos nativos (`http`, `fs`, `path`) — sem npm install
- API REST do Trello (opcional)
- Supabase (migração futura — PostgreSQL + API REST)
