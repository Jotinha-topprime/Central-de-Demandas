// Importa o modulo nativo `http`, que vamos usar para criar o servidor web.
const http = require('http');
// Importa o modulo `fs` (file system), usado para ler arquivos do disco.
const fs = require('fs');
// Importa o modulo `path`, que ajuda a montar caminhos de arquivos do jeito certo.
const path = require('path');
// Importa o modulo `https`, usado para conversar com APIs externas seguras, como a do Trello.
const https = require('https');

// Monta o caminho absoluto do arquivo `.env` dentro da pasta do projeto.
// `__dirname` representa a pasta onde este arquivo `server.js` esta.
const CAMINHO_ENV = path.join(__dirname, '.env');

// Este objeto guarda os tipos MIME dos arquivos estaticos.
// MIME e o tipo de conteudo que o navegador precisa saber para interpretar o arquivo direito.
const TIPOS_MIME = {
  // Quando o arquivo termina com `.html`, o navegador deve tratar como pagina HTML.
  '.html': 'text/html; charset=utf-8',
  // Arquivos CSS devem ser tratados como folha de estilo.
  '.css': 'text/css',
  // Arquivos JavaScript devem ser tratados como codigo JS.
  '.js': 'application/javascript',
  // Arquivos JSON devem ser tratados como JSON.
  '.json': 'application/json',
  // Imagem PNG.
  '.png': 'image/png',
  // Imagem JPG.
  '.jpg': 'image/jpeg',
  // Imagem SVG.
  '.svg': 'image/svg+xml',
  // Icone `.ico`.
  '.ico': 'image/x-icon',
  // Imagem WEBP.
  '.webp': 'image/webp',
};

// Este objeto traduz os codigos internos das empresas para os nomes que vao aparecer ao usuario.
const EMPRESAS = {
  // `topprime` vira `Top Prime`.
  topprime: 'Top Prime',
  // `planoa` vira `Plano A`.
  planoa: 'Plano A',
  // `alg3` continua `ALG3`.
  alg3: 'ALG3',
};

// Chama a funcao que tenta carregar o `.env` antes de continuar.
// Isso e importante porque depois vamos ler variaveis como `PORT`, `TRELLO_API_KEY` etc.
carregarArquivoEnv();

// Define a porta do servidor.
// Primeiro tenta usar `process.env.PORT`.
// Se nao existir, usa 8080 como valor padrao.
const PORTA = process.env.PORT || 8080;

// Junta as credenciais do Trello em um objeto so, para o codigo ficar mais organizado.
const TRELLO = {
  // Chave da API do Trello.
  apiKey: process.env.TRELLO_API_KEY || '',
  // Token do Trello.
  token: process.env.TRELLO_TOKEN || '',
  // ID do board do Trello.
  boardId: process.env.TRELLO_BOARD_ID || '',
  // ID da lista onde os cards novos serao criados.
  listId: process.env.TRELLO_LIST_ID || '',
};

// Depois de montar o objeto `TRELLO`, mostramos no console se esta tudo configurado.
registrarStatusCredenciais();

// Esta funcao carrega o arquivo `.env` manualmente, sem usar biblioteca externa como `dotenv`.
function carregarArquivoEnv() {
  // Primeiro verificamos se o arquivo `.env` realmente existe.
  if (!fs.existsSync(CAMINHO_ENV)) {
    // Se nao existir, avisamos no console e seguimos usando so as variaveis do sistema.
    console.warn('Arquivo .env nao encontrado; usando variaveis do sistema');
    return;
  }

  // Le o arquivo inteiro como texto (`utf8`).
  fs.readFileSync(CAMINHO_ENV, 'utf8')
    // Quebra o texto em varias linhas.
    .split('\n')
    // Percorre uma linha por vez.
    .forEach((linhaBruta) => {
      // Remove espacos extras no comeco e no fim da linha.
      const linha = linhaBruta.trim();
      // Se a linha estiver vazia ou for comentario (`#`), ignoramos.
      if (!linha || linha.startsWith('#')) return;

      // Divide a linha no sinal `=`.
      // Exemplo: `PORT=8080` vira `chave = PORT` e `resto = 8080`.
      const [chave, ...resto] = linha.split('=');
      // Se nao existir chave, pulamos essa linha.
      if (!chave) return;

      // Guarda o valor dentro de `process.env`.
      // O `resto.join('=')` existe para o caso do valor conter `=` no meio.
      process.env[chave.trim()] = resto.join('=').trim();
    });

  // Informa no console que o `.env` foi carregado com sucesso.
  console.log('Arquivo .env carregado');
}

// Esta funcao verifica se alguma credencial importante do Trello esta faltando.
function registrarStatusCredenciais() {
  // `Object.entries(TRELLO)` transforma o objeto em pares tipo `[chave, valor]`.
  const faltando = Object.entries(TRELLO)
    // Aqui filtramos so as entradas cujo valor esta vazio.
    .filter(([, valor]) => !valor)
    // Depois pegamos apenas o nome da chave faltante.
    .map(([chave]) => chave);

  // Se existir ao menos uma credencial faltando...
  if (faltando.length) {
    // ...mostramos quais sao.
    console.warn('Credenciais ausentes no .env:', faltando.join(', '));
    return;
  }

  // Se chegou aqui, todas as credenciais foram encontradas.
  console.log('Credenciais do Trello OK');
}

// Esta funcao le o corpo de uma requisicao HTTP.
// Ela e muito usada em `POST`, quando o navegador manda dados em JSON.
function lerCorpoRequisicao(req) {
  // Retornamos uma Promise porque a leitura do corpo acontece aos poucos, de forma assincrona.
  return new Promise((resolve, reject) => {
    // Aqui vamos acumulando o texto recebido.
    let corpo = '';
    // Toda vez que chega um pedaco da requisicao, anexamos ao `corpo`.
    req.on('data', (pedaco) => {
      corpo += pedaco;
    });
    // Quando termina de chegar tudo, resolvemos a Promise com o texto completo.
    req.on('end', () => resolve(corpo));
    // Se der erro na leitura, rejeitamos a Promise.
    req.on('error', reject);
  });
}

// Esta funcao padroniza respostas JSON do servidor.
function responderJson(res, status, dados) {
  // Define o status HTTP e o cabeçalho dizendo que a resposta e JSON.
  res.writeHead(status, { 'Content-Type': 'application/json' });
  // Converte o objeto JavaScript para texto JSON e envia ao cliente.
  res.end(JSON.stringify(dados));
}

// Esta funcao faz uma requisicao GET via HTTPS e tenta devolver o JSON pronto.
function obterJson(url) {
  // De novo usamos Promise porque a resposta chega de forma assincrona.
  return new Promise((resolve, reject) => {
    // Faz a chamada GET para a URL recebida.
    https.get(url, (resposta) => {
      // Aqui vamos acumulando os dados retornados pela API.
      let dados = '';

      // Cada pedaco recebido e concatenado.
      resposta.on('data', (pedaco) => {
        dados += pedaco;
      });

      // Quando terminar de receber tudo...
      resposta.on('end', () => {
        try {
          // ...tentamos converter o texto em JSON.
          resolve(JSON.parse(dados));
        } catch (erro) {
          // Se o texto nao for um JSON valido, devolvemos um erro mais amigavel.
          reject(new Error('JSON invalido: ' + dados.substring(0, 100)));
        }
      });
    // Se a conexao HTTPS falhar, rejeitamos a Promise.
    }).on('error', reject);
  });
}

// Esta funcao faz uma requisicao POST via HTTPS.
// No nosso caso, ela e usada para criar cards no Trello.
function postarHttps(hostname, caminho) {
  // Retorna uma Promise porque a requisicao tambem e assincrona.
  return new Promise((resolve, reject) => {
    // Cria a requisicao HTTPS.
    const requisicao = https.request(
      {
        // Dominio de destino, por exemplo `api.trello.com`.
        hostname,
        // Caminho da rota com query string.
        path: caminho,
        // Metodo HTTP usado aqui.
        method: 'POST',
        // Como nao estamos enviando body, o tamanho e zero.
        headers: { 'Content-Length': 0 },
      },
      (resposta) => {
        // Aqui vamos juntar o texto retornado pela API.
        let dados = '';

        // Concatena cada pedaco recebido.
        resposta.on('data', (pedaco) => {
          dados += pedaco;
        });

        // Quando a resposta terminar...
        resposta.on('end', () => {
          try {
            // ...devolvemos um objeto com o status HTTP e o corpo parseado em JSON.
            resolve({
              status: resposta.statusCode,
              body: JSON.parse(dados),
            });
          } catch (erro) {
            // Se a API responder algo que nao seja JSON valido, cai aqui.
            reject(erro);
          }
        });
      }
    );

    // Se der erro de rede na requisicao, rejeitamos a Promise.
    requisicao.on('error', reject);
    // Finaliza e envia a requisicao.
    requisicao.end();
  });
}

// Esta funcao pega uma data no formato ISO (`YYYY-MM-DD`) e devolve em `DD/MM/YYYY`.
function formatarData(dataIso) {
  // Se vier vazia, devolvemos `-` so para nao quebrar a exibicao.
  if (!dataIso) return '-';

  // Divide a string da data em ano, mes e dia.
  const [ano, mes, dia] = dataIso.split('-');
  // Reorganiza no formato brasileiro.
  return `${dia}/${mes}/${ano}`;
}

// Traduz o codigo da empresa para o nome bonito que sera mostrado ou salvo.
function obterNomeEmpresa(codigoEmpresa) {
  // Se existir no objeto `EMPRESAS`, usa o nome mapeado.
  // Se nao existir, devolve o proprio valor recebido.
  return EMPRESAS[codigoEmpresa] || codigoEmpresa;
}

// Monta a descricao do card do Trello com base nos dados da demanda.
function montarDescricaoCartao(demanda) {
  // Retorna um array de linhas e no final junta tudo com `\n`.
  return [
    // Linha com nome e email do solicitante.
    `**Solicitante:** ${demanda.nome} (${demanda.email})`,
    // Linha com setor.
    `**Setor:** ${demanda.setor}`,
    // Linha com empresa traduzida para nome legivel.
    `**Empresa:** ${obterNomeEmpresa(demanda.empresa)}`,
    // Linha com tipo de material.
    `**Material:** ${demanda.material}`,
    // Linha com prioridade.
    `**Prioridade:** ${demanda.prioridade}`,
    // Linha com prazo formatado.
    `**Prazo:** ${formatarData(demanda.prazo)}`,
    // Linha divisoria visual dentro da descricao.
    '---',
    // Linha com objetivo principal.
    `**Objetivo:** ${demanda.objetivo}`,
    // Se `publico` existir, adiciona a linha; senao coloca string vazia.
    demanda.publico ? `**Publico-alvo:** ${demanda.publico}` : '',
    // Mesmo raciocinio para a copy sugerida.
    demanda.copy ? `**Copy sugerida:** ${demanda.copy}` : '',
    // Mesmo raciocinio para formato.
    demanda.formato ? `**Formato:** ${demanda.formato}` : '',
    // Mesmo raciocinio para referencias.
    demanda.ref ? `**Referencias:** ${demanda.ref}` : '',
    // Mesmo raciocinio para observacoes.
    demanda.obs ? `**Observacoes:** ${demanda.obs}` : '',
  ]
    // Remove linhas vazias.
    .filter(Boolean)
    // Junta tudo em um texto unico com quebra de linha.
    .join('\n');
}

// Traduz o nome da lista do Trello para um status amigavel do sistema.
function traduzirStatusLista(nomeLista) {
  // Garante que teremos uma string e coloca tudo em minusculo para comparar melhor.
  const nomeNormalizado = (nomeLista || '').toLowerCase();

  // Se o nome da lista sugerir que a demanda esta sendo produzida...
  if (
    nomeNormalizado.includes('producao') ||
    nomeNormalizado.includes('produção') ||
    nomeNormalizado.includes('andamento')
  ) {
    // ...retornamos este status padrao do sistema.
    return 'Em produção';
  }

  // Se o nome da lista sugerir que a demanda ja foi finalizada...
  if (
    nomeNormalizado.includes('concluido') ||
    nomeNormalizado.includes('concluído') ||
    nomeNormalizado.includes('done')
  ) {
    // ...retornamos o status de concluido.
    return 'Concluído';
  }

  // Se nao cair nos casos acima, assumimos que ainda esta aguardando.
  return 'Aguardando';
}

// Extrai um campo especifico da descricao do card do Trello.
// Exemplo: pegar o valor depois de `**Setor:**`.
function extrairCampoDescricao(descricao, campo) {
  // Se a descricao vier vazia, usamos string vazia para evitar erro.
  const texto = descricao || '';
  // Monta uma expressao regular dinamicamente para procurar o campo desejado.
  const match = texto.match(new RegExp(`\\*\\*${campo}:\\*\\*\\s*(.+)`));
  // Se encontrou, devolve o valor limpo; se nao, devolve `-`.
  return match ? match[1].trim() : '-';
}

// Descobre qual empresa o card representa olhando o prefixo do nome.
function identificarEmpresaPorPrefixo(nomeCartao) {
  // Se comeca com `[Top Prime]`, a empresa e `topprime`.
  if (nomeCartao.startsWith('[Top Prime]')) return 'topprime';
  // Se comeca com `[Plano A]`, a empresa e `planoa`.
  if (nomeCartao.startsWith('[Plano A]')) return 'planoa';
  // Se comeca com `[ALG3]`, a empresa e `alg3`.
  if (nomeCartao.startsWith('[ALG3]')) return 'alg3';
  // Se nao tiver nenhum prefixo conhecido, devolvemos `null`.
  return null;
}

// Cria a estrutura padrao de retorno das demandas, separada por empresa.
function criarEstruturaDemandasVazia() {
  // Sempre devolvemos as tres chaves, mesmo se estiverem vazias.
  return {
    // Lista de demandas da Top Prime.
    topprime: [],
    // Lista de demandas da Plano A.
    planoa: [],
    // Lista de demandas da ALG3.
    alg3: [],
  };
}

// Monta um mapa de `id da lista -> nome da lista`.
function montarMapaListas(listas) {
  // Comecamos com um objeto vazio.
  const mapa = {};
  // Percorremos cada lista recebida do Trello.
  listas.forEach((lista) => {
    // Guardamos o nome da lista usando o ID como chave.
    mapa[lista.id] = lista.name;
  });
  // No fim, devolvemos o mapa pronto.
  return mapa;
}

// Converte um card bruto do Trello em um objeto de demanda no formato que o frontend espera.
function mapearCartaoParaDemanda(cartao, mapaListas) {
  // Primeiro descobrimos de qual empresa esse card e.
  const empresa = identificarEmpresaPorPrefixo(cartao.name || '');
  // Se nao der para identificar, ignoramos esse card.
  if (!empresa) return null;

  // Garante que a descricao seja uma string.
  const descricao = cartao.desc || '';

  // Devolve um objeto com a empresa e a demanda formatada.
  return {
    // Esta chave serve para sabermos em qual grupo o card sera colocado.
    empresa,
    // Este objeto e o que o frontend realmente vai usar.
    demanda: {
      // Remove o prefixo `[Empresa]` do titulo para mostrar um nome limpo.
      titulo: (cartao.name || '').replace(/^\[.*?\]\s*/, ''),
      // Extrai o setor da descricao.
      setor: extrairCampoDescricao(descricao, 'Setor'),
      // Extrai o material da descricao.
      material: extrairCampoDescricao(descricao, 'Material'),
      // Extrai a prioridade da descricao.
      prioridade: extrairCampoDescricao(descricao, 'Prioridade'),
      // Se o card tiver `due`, pega apenas a parte da data.
      prazo: cartao.due ? cartao.due.split('T')[0] : '',
      // Extrai o solicitante e remove o trecho do email entre parenteses.
      nome: extrairCampoDescricao(descricao, 'Solicitante').replace(/\s*\(.*\)$/, ''),
      // Traduz o nome da lista do Trello para o status padrao do sistema.
      status: traduzirStatusLista(mapaListas[cartao.idList]),
      // Guarda a URL do card para o frontend poder abrir no Trello.
      trelloUrl: cartao.url,
      // Guarda a data da ultima atividade para ordenar depois.
      criadoEm: cartao.dateLastActivity,
    },
  };
}

// Busca as demandas do board do Trello e devolve tudo agrupado por empresa.
async function buscarDemandasDoTrello() {
  // Se faltar configuracao minima, nao tentamos consultar a API.
  if (!TRELLO.apiKey || !TRELLO.boardId) {
    return criarEstruturaDemandasVazia();
  }

  // Monta a parte compartilhada da autenticacao na query string.
  const credenciais = `key=${TRELLO.apiKey}&token=${TRELLO.token}`;

  // Faz as duas chamadas em paralelo para ganhar tempo.
  const [cartoes, listas] = await Promise.all([
    // Busca os cards do board com os campos que nos interessam.
    obterJson(`https://api.trello.com/1/boards/${TRELLO.boardId}/cards?${credenciais}&fields=name,desc,due,idList,url,dateLastActivity`),
    // Busca as listas do board para depois descobrir o status de cada card.
    obterJson(`https://api.trello.com/1/boards/${TRELLO.boardId}/lists?${credenciais}&fields=id,name`),
  ]);

  // Converte a lista de listas em um mapa mais facil de consultar.
  const mapaListas = montarMapaListas(listas);
  // Comeca com a estrutura final vazia.
  const demandasPorEmpresa = criarEstruturaDemandasVazia();

  // Percorre todos os cards recebidos.
  cartoes.forEach((cartao) => {
    // Converte o card bruto em um objeto pronto para o frontend.
    const itemMapeado = mapearCartaoParaDemanda(cartao, mapaListas);
    // Se nao for um card do sistema, ignoramos.
    if (!itemMapeado) return;

    // Coloca a demanda no array da empresa correta.
    demandasPorEmpresa[itemMapeado.empresa].push(itemMapeado.demanda);
  });

  // Ordena as demandas de cada empresa da mais recente para a mais antiga.
  Object.keys(demandasPorEmpresa).forEach((empresa) => {
    demandasPorEmpresa[empresa].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  });

  // Retorna o objeto final, pronto para o frontend usar.
  return demandasPorEmpresa;
}

// Configura os cabeçalhos de CORS.
// Isso permite que o frontend hospedado em outro dominio consiga conversar com este backend.
function configurarCors(res) {
  // Permite requisicoes vindas de qualquer origem.
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Diz quais metodos HTTP sao aceitos.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // Diz quais cabeçalhos o navegador pode enviar.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Serve os arquivos estaticos do projeto, como HTML, CSS, JS e imagens.
function servirArquivoEstatico(req, res, caminhoUrl) {
  // Se pedirem `/`, entregamos o `index.html`.
  const arquivoSolicitado = caminhoUrl === '/' ? '/index.html' : caminhoUrl;
  // Monta o caminho completo do arquivo dentro da pasta do projeto.
  const caminhoArquivo = path.join(__dirname, arquivoSolicitado);
  // Descobre a extensao do arquivo para saber o tipo MIME.
  const extensao = path.extname(caminhoArquivo);

  // Tenta ler o arquivo do disco.
  fs.readFile(caminhoArquivo, (erro, dados) => {
    // Se der erro, normalmente e porque o arquivo nao existe.
    if (erro) {
      // Responde com 404.
      res.writeHead(404);
      // Envia uma mensagem simples.
      res.end('Nao encontrado');
      return;
    }

    // Se encontrou o arquivo, responde com status 200 e o tipo correto.
    res.writeHead(200, {
      'Content-Type': TIPOS_MIME[extensao] || 'application/octet-stream',
    });
    // Envia o conteudo do arquivo para o navegador.
    res.end(dados);
  });
}

// Cria o servidor HTTP principal.
const servidor = http.createServer(async (req, res) => {
  // Primeiro, sempre configuramos CORS para todas as respostas.
  configurarCors(res);

  // Se a requisicao for `OPTIONS`, respondemos so para satisfazer o preflight do navegador.
  if (req.method === 'OPTIONS') {
    // 204 significa `sem conteudo`.
    res.writeHead(204);
    // Finaliza a resposta.
    res.end();
    return;
  }

  // Separa apenas o caminho da URL, ignorando query string.
  const caminhoUrl = req.url.split('?')[0];

  // Rota de status do sistema.
  if (req.method === 'GET' && caminhoUrl === '/api/status') {
    // Responde informando se o Trello esta configurado.
    responderJson(res, 200, {
      trelloConfigurado: !!(TRELLO.apiKey && TRELLO.token && TRELLO.boardId),
    });
    return;
  }

  // Rota para listar demandas vindas do Trello.
  if (req.method === 'GET' && caminhoUrl === '/api/listar-demandas') {
    try {
      // Busca e organiza as demandas.
      const demandas = await buscarDemandasDoTrello();
      // Devolve ao frontend em JSON.
      responderJson(res, 200, demandas);
    } catch (erro) {
      // Se der erro, registramos no console para facilitar debug.
      console.error('Erro ao listar demandas:', erro.message);
      // E devolvemos uma mensagem amigavel para o frontend.
      responderJson(res, 500, { erro: 'Falha ao buscar demandas do Trello' });
    }
    return;
  }

  // Rota para criar uma nova demanda no Trello.
  if (req.method === 'POST' && caminhoUrl === '/api/enviar-demanda') {
    // Se faltar configuracao minima, paramos aqui.
    if (!TRELLO.apiKey || !TRELLO.listId) {
      responderJson(res, 503, { erro: 'Trello nao configurado no servidor' });
      return;
    }

    // Aqui vamos guardar o objeto da demanda enviado pelo frontend.
    let demanda;
    try {
      // Le o corpo bruto da requisicao.
      const corpo = await lerCorpoRequisicao(req);
      // Converte o JSON em objeto JavaScript.
      demanda = JSON.parse(corpo);
    } catch (erro) {
      // Se o JSON vier quebrado, respondemos erro 400.
      responderJson(res, 400, { erro: 'Dados invalidos' });
      return;
    }

    // Traduz o codigo da empresa para o nome bonito.
    const nomeEmpresa = obterNomeEmpresa(demanda.empresa);
    // Monta os parametros que serao enviados ao Trello na query string.
    const parametros = new URLSearchParams({
      // Nome do card com prefixo da empresa.
      name: `[${nomeEmpresa}] ${demanda.titulo}`,
      // Descricao completa formatada.
      desc: montarDescricaoCartao(demanda),
      // Lista onde o card sera criado.
      idList: TRELLO.listId,
      // Credenciais do Trello.
      key: TRELLO.apiKey,
      token: TRELLO.token,
    });

    // Se a demanda tiver prazo, adicionamos a data no formato ISO do Trello.
    if (demanda.prazo) {
      parametros.set('due', new Date(demanda.prazo + 'T12:00:00').toISOString());
    }

    try {
      // Faz a chamada para criar o card no Trello.
      const resposta = await postarHttps('api.trello.com', `/1/cards?${parametros}`);

      // Se o Trello nao respondeu 200, tratamos como falha.
      if (resposta.status !== 200) {
        // Mostra no console o que o Trello respondeu.
        console.error('Trello rejeitou o cartao:', resposta.body);
        // Devolve erro 502 para o frontend.
        responderJson(res, 502, { erro: 'Trello rejeitou a criacao do cartao' });
        return;
      }

      // Se deu certo, devolve a URL do card criado.
      responderJson(res, 200, { trelloUrl: resposta.body.url });
    } catch (erro) {
      // Se houve erro de conexao ou processamento, registramos no console.
      console.error('Erro ao criar cartao:', erro.message);
      // E devolvemos erro 500 para o frontend.
      responderJson(res, 500, { erro: 'Falha de conexao com o Trello' });
    }
    return;
  }

  // Se nao caiu em nenhuma rota da API, tentamos servir um arquivo estatico.
  servirArquivoEstatico(req, res, caminhoUrl);
});

// Faz o servidor comecar a escutar na porta configurada.
servidor.listen(PORTA, '0.0.0.0', () => {
  // Mostra no console que o servidor subiu com sucesso.
  console.log(`Servidor rodando na porta ${PORTA}`);
});
