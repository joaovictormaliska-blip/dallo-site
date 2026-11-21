/* ==========================================================================
   Gerador do site da Dallo.
   Lê o acervo em ../dallo (JSON + mídia já baixada) e escreve as páginas.
   Roda com: node gerar.js
   Não há build, framework nem dependência: só Node e o acervo local.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ACERVO = path.resolve(__dirname, '..', 'dallo');
const SAIDA = __dirname;
/* pasta de escrita da língua corrente (LANG é definido mais abaixo) */
const saidaLang = () => (LANG === 'pt' ? SAIDA : path.join(SAIDA, LANG));
const MIDIA = path.join(SAIDA, 'midia');

/* ---- utilidades ---- */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* O CMS devolve HTML com entidades. Para texto corrido queremos o texto. */
const texto = (s) => String(s == null ? '' : s)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
  .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&atilde;/g, 'ã')
  .replace(/&otilde;/g, 'õ').replace(/&ccedil;/g, 'ç').replace(/&acirc;/g, 'â')
  .replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô').replace(/&agrave;/g, 'à')
  .replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();

const paragrafos = (s) => texto(s).split(/\n{1,}/).filter(Boolean)
  .map((p) => '<p>' + esc(p) + '</p>').join('\n          ');

/* ---- mídia: copia do acervo para dentro do site, mantendo o caminho ---- */
let copiados = 0, ausentes = 0;
const faltando = [];
function midia(url) {
  if (!url) return '';
  const limpa = String(url).replace(/\?.*$/, '').replace('br//', 'br/');
  const m = limpa.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (!m) return limpa;
  const [, host, rel] = m;
  const origemBase = host === 'admin.dallo.com.br' ? 'midia'
    : host === 'blog.dallo.com.br' ? 'midia-blog' : 'midia-site';
  let relDec = decodeURIComponent(rel);
  let origem = path.join(ACERVO, origemBase, relDec);

  /* O acervo guardou as galerias em `original_` (resolução cheia), mas o CMS
     referencia `large_`. É o mesmo arquivo: procura as variantes antes de
     desistir, preferindo a maior que existir. */
  if (!fs.existsSync(origem)) {
    const d = path.dirname(relDec);
    const b = path.basename(relDec).replace(/^(original|large|medium|thumb)_/, '');
    for (const pref of ['original_', 'large_', 'medium_', '']) {
      const alt = path.join(ACERVO, origemBase, d, pref + b);
      if (fs.existsSync(alt)) { origem = alt; relDec = path.join(d, pref + b); break; }
    }
  }

  /* O caminho devolvido precisa ser o do SITE, contado a partir da raiz dele:
     midia/<origem>/<resto>. Antes faltava o "midia/" e as páginas apontavam
     para um nível acima do arquivo copiado. */
  const destinoRel = path.join('midia', origemBase, relDec);
  const destino = path.join(SAIDA, destinoRel);
  if (!fs.existsSync(origem)) { ausentes++; faltando.push(limpa); return ''; }
  if (!fs.existsSync(destino)) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origem, destino);
    copiados++;
  }
  return destinoRel.replace(/\\/g, '/');
}

/* ---- leitura do acervo ---- */
const dir = path.join(ACERVO, 'api', 'empreendimentos');
const torres = fs.readdirSync(dir)
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).enterprise)
  .filter(Boolean);

const sobre = JSON.parse(fs.readFileSync(path.join(ACERVO, 'api', 'sobre.json'), 'utf8'));
const pag = (n) => JSON.parse(fs.readFileSync(path.join(ACERVO, 'api', 'paginas-conteudo', n + '.json'), 'utf8'));
const home = pag('home');
const contato = pag('contato');

/* ---- mídia que o JSON do CMS não entrega ----
   O extrator montou `home.equipe.depoimentos` só com nome e texto, e
   `home.projetos` só com texto: as imagens e os vídeos ficam fora do JSON,
   presos no HTML do site. Estes endereços vieram de ler a home publicada.
   Ficam aqui, num lugar só, para não se espalharem pelos modelos. */
const RETRATOS = {
  'Breno Bello':       'https://admin.dallo.com.br/uploads/collaborator/5/62028811d88e87.57102155.jpg',
  'Leiva Peres':       'https://admin.dallo.com.br/uploads/collaborator/14/6807de8eb20f12.90709428.jpg',
  'Luiz Fernando':     'https://admin.dallo.com.br/uploads/collaborator/16/68092c2ec33340.10449097.jpg',
  'Ângela de Oliveira': 'https://admin.dallo.com.br/uploads/collaborator/10/62542bcd7cac90.83087310.jpg',
  'Daniel Francisco':  'https://admin.dallo.com.br/uploads/collaborator/12/626c1930a558d0.68079300.jpg',
};

/* Cada projeto da Dallo tem um vídeo curto, mudo e em laço. É o que faz a
   seção virar dobra: a imagem é o fundo inteiro e o texto corre por cima. */
const EST = 'https://www.dallo.com.br/static/';
/* Pôster de cada filme. Sem ele o cartão fica preto até o vídeo chegar —
   e o vídeo só é pedido quando o bloco se aproxima da tela, então a seção
   abria vazia. Não vêm do CMS: foram tirados do próprio vídeo, no quadro
   de 1,6 s, desenhados num canvas a 1280 px de largura e salvos em WebP
   (213 KB os cinco). Para refazer: abrir o vídeo num <video> mudo, seek,
   drawImage num canvas, canvas.toBlob("image/webp", .72). */
const POSTERES = {
  'Dallo Esporte': 'midia/posteres/projeto-esporte.webp',
  'Banda Dallo':   'midia/posteres/projeto-banda.webp',
  'Dallo Travel':  'midia/posteres/projeto-travel.webp',
  'Dallo Teatro':  'midia/posteres/projeto-teatro.webp',
  'Dallo Hipismo': 'midia/posteres/projeto-hipismo.webp',
};
const FILMES = {
  'Dallo Esporte': ['video-dallo-esporte-e5ea54f8a9b048b35a69d66f5b291395.webm', 'video-dallo-esporte-60c228e1275534d9632bb5a2d7bbf769.mp4'],
  'Banda Dallo':   ['video-banda-dallo-9ade89c98adaaf287a8acf5d4686fd0f.webm', 'video-banda-dallo-9ed04be58d78e0ba567644951dbcdb06.mp4'],
  'Dallo Travel':  ['video-dallo-travel-2b4cb272b99b0efd869683efa078ea9c.webm', 'video-dallo-travel-d6e6a52e04190c9483b3e31af173939e.mp4'],
  'Dallo Teatro':  ['video-dallo-teatro-db9d8ea1a64d12fdb5aaa196c0352df1.webm', 'video-dallo-teatro-44ab7d5b15de02bb36f74ad72152304c.mp4'],
  'Dallo Hipismo': ['video-scuderia-dallo-62b8ee2ac5e743b2d4f5d76d54c7695c.webm', 'video-scuderia-dallo-2689d123e1ec2e56661d9eb6fe9ac293.mp4'],
};

/* Entregue ou em comercialização: o leitor decide por isso antes de tudo. */
const entregue = (t) => /entregue/i.test(t.yearDelivery || '');
const disponivel = (t) => !entregue(t) && !/100%|comercializado/i.test(t.tag || '');

/* ---- facetas da busca ----
   O CMS guarda isto como texto corrido, escrito à mão e sem padrão: "3
   suítes", "3 Suítes", "3 a 4 suítes", "3 e 4 suítes". Aqui vira número
   para a busca poder contar. Faixa ("a", "ou", "até") abre o intervalo
   inteiro; lista ("e", "/") fica só com o que está escrito. */
function suites(t) {
  const txt = String(t.room || '');
  const ns = (txt.match(/\d+/g) || []).map(Number).filter((n) => n > 0 && n < 10);
  if (!ns.length) return [];
  if (ns.length === 2 && /\b(a|ou|até)\b/i.test(txt)) {
    const [a, b] = ns.slice().sort((x, y) => x - y);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  return [...new Set(ns)];
}

/* Metragem: o maior número seguido de m² — é a unidade maior do
   empreendimento. "Até 277m²" dá 277; "300 - 1.000m²" dá 1000. Quatro
   torres não declaram metragem e ficam de fora desse filtro. */
function areaM2(t) {
  const achados = String(t.metreage || '').replace(/\.(?=\d{3}\b)/g, '')
    .match(/(\d+(?:,\d+)?)\s*m/gi);
  if (!achados) return null;
  return Math.round(Math.max(...achados.map((s) => parseFloat(s.replace(',', '.')))));
}

/* As faixas saem da distribuição real do acervo (80 m² a 1.000 m²,
   mediana 182), não de números redondos tirados do nada. */
const FAIXAS = [
  ['ate150', 'Até 150 m²', 0, 150],
  ['150-250', '150 a 250 m²', 150, 250],
  ['250-400', '250 a 400 m²', 250, 400],
  ['400+', 'Acima de 400 m²', 400, Infinity],
];
const faixaDe = (m) => (m == null ? '' : (FAIXAS.find(([, , a, b]) => m > a && m <= b) || FAIXAS[0])[0]);
/* O CMS marca "Entregue em 2019" para umas e só "2024" para outras — e
   "2024" é prazo de entrega, não aviso de obra. Quem tinha prazo em ano
   que já passou conta como pronto. Cinco torres não declaram prazo e
   ficam sem estágio: aparecem na lista inteira, mas não em nenhum dos
   dois filtros, porque o acervo não diz em qual delas estão.
   Isto depende do ano em que o site é gerado — é de propósito. */
const ANO_DA_GERACAO = new Date().getFullYear();
function estagio(t) {
  const txt = String(t.yearDelivery || '');
  if (!txt) return '';
  if (/entregue/i.test(txt)) return 'pronto';
  const ano = Number((txt.match(/\b(?:19|20)\d{2}\b/) || [])[0]);
  if (!ano) return '';
  return ano <= ANO_DA_GERACAO ? 'pronto' : 'obra';
}

/* ====================================================================
   TRÊS IDIOMAS
   --------------------------------------------------------------------
   O CMS da Dallo guarda tudo em três línguas: cada campo tem o irmão
   `campoEn` e `campoEs`. A cobertura é total nas 45 torres (nome, tag,
   suítes, metragem, garagem, altura, descrição, resumo e os títulos das
   seções) e na página "A Dallo" (história, os 34 marcos, o texto de
   estilo e os quatro programas). O SEO de cada página também vem
   traduzido, em `dallo/api/paginas/*.json`.

   Duas coisas NÃO vêm traduzidas do CMS e estão marcadas aqui:
   1. a interface do site (menu, botões, rótulos, títulos de seção que
      escrevemos nós) — tabela IDIOMAS, abaixo;
   2. os textos editoriais da home (marca, equipe, diferencial e os
      cinco projetos), que no acervo existem só em português — tabela
      HOME_TRAD, mais abaixo.

   O que está em HOME_TRAD é tradução NOSSA de texto institucional do
   cliente. Funciona, mas é o primeiro lugar onde a Dallo vai querer
   passar o olho antes de publicar.

   Estrutura de endereços: o português fica na raiz, e as outras duas em
   /en/ e /es/, com os MESMOS slugs. O CMS tem `slugEn` e `slugEs`, mas
   usar slug traduzido obrigaria o seletor de idioma a consultar uma
   tabela para saber para onde ir em cada página; com o slug igual, trocar
   de língua é trocar o prefixo, e nenhuma página pode cair em 404. */

const LINGUAS = ['pt', 'en', 'es'];
let LANG = 'pt';
const SUF = () => (LANG === 'en' ? 'En' : LANG === 'es' ? 'Es' : '');

/* campo traduzido, com o português como rede: se o CMS não trouxe a
   versão da língua, é melhor mostrar em português do que mostrar vazio */
const tr = (o, campo) => {
  if (!o) return '';
  const v = o[campo + SUF()];
  return (v === null || v === undefined || String(v).trim() === '') ? o[campo] : v;
};

/* raiz dos ARQUIVOS (css, fontes, img, midia): eles moram na raiz do
   site, uma pasta acima quando a página está em /en/ ou /es/ */
const raiz = (prof) => '../'.repeat((LANG === 'pt' ? 0 : 1) + (prof ? 1 : 0));
/* raiz das PÁGINAS: o índice da própria língua */
const raizL = (prof) => '../'.repeat(prof ? 1 : 0);

const IDIOMAS = {
  pt: {
    html: 'pt-BR', nome: 'Português', curta: 'PT',
    nav: ['Empreendimentos', 'A Dallo', 'Contato'],
    falarEquipe: 'Falar com a equipe',
    abrirMenu: 'Abrir menu', fecharMenu: 'Fechar menu',
    inicio: 'Construtora Dallo, página inicial',
    trocarIdioma: 'Trocar idioma',
    zap: 'Falar no WhatsApp',
    verEmpreendimento: 'Ver empreendimento',
    /* busca */
    onde: 'Onde', todasCidades: 'Todas as cidades',
    suites: 'Suítes', metragem: 'Metragem', qualquer: 'Qualquer',
    estagio: 'Estágio', todos: 'Todos',
    emObra: 'Em construção', pronto: 'Pronto para morar',
    verTorres: (n) => (n === 1 ? 'Ver 1 torre' : 'Ver ' + n + ' torres'),
    torresConta: (n) => (n === 1 ? '1 torre' : n + ' torres'),
    faixas: { ate150: 'Até 150 m²', '150-250': '150 a 250 m²', '250-400': '250 a 400 m²', '400+': 'Acima de 400 m²' },
    filtrandoPor: 'Filtrando por', limpar: 'limpar', ou: 'ou',
    suitesCurto: 'suítes',
    /* home */
    heroTitulo1: 'Em Itapema,', heroTitulo2: 'a Dallo mudou a linha do céu',
    heroLead: (n) => n + ' empreendimentos em Itapema, Porto Belo e Cascavel — dos que ainda estão subindo aos que já viraram endereço.',
    marcaDados: ['Empreendimentos', 'Desde', 'Cidades'],
    conhecaDallo: 'Conheça a Dallo',
    vozes: (n) => n + ' vozes',
    subindoAgora: (n) => n + ' subindo agora',
    emConstrucao: 'Em construção',
    verTodosEmp: (n) => 'Ver os ' + n + ' empreendimentos',
    pausa: ['Estamos construindo', 'a melhor torre', 'do Brasil.'],
    pausaNota: (nome, and, cidade) => nome + ' · ' + and + ' andares · ' + cidade,
    entregues: 'Entregues',
    entreguesConta: 'endereços que já são de alguém',
    verTodosEntregues: 'Ver todos os entregues',
    projetosRotulo: (n) => n + ' projetos',
    /* listagem */
    empreendimentos: 'Empreendimentos',
    contaEmp: (n) => n + (n === 1 ? ' empreendimento' : ' empreendimentos'),
    comUnidades: 'Com unidades', comercializados: 'Comercializados',
    /* torre */
    verNoMapa: 'Ver no mapa', plantas: 'Plantas', aObra: 'A obra',
    /* sobre */
    primeiroLanc: 'Primeiro lançamento',
    torresAte: (a) => 'Torres lançadas até ' + a,
    andaresDe: 'Andares, da menor à maior',
    lancamentosPeriodo: (n, a, b) => n + ' lançamentos, ' + a + '–' + b,
    linhaDoCeu: 'A linha do céu',
    linhaLead: (nome1, and1, ano1, nome2, and2) =>
      'Cada barra é uma torre, na altura que ela tem. A primeira, em ' + ano1 + ', foi o ' + nome1 + ', de ' + and1 + '. A mais alta do período é o ' + nome2 + ', de ' + and2 + '.',
    anosLancados: 'Lançamentos por ano, pela altura das torres',
    anoAano: 'Ano a ano', oQueSubiu: 'O que subiu, e quando',
    andares: 'andares',
    barraLeitor: (nome, and, ano) => nome + ', ' + and + ' andares, lançado em ' + ano,
    anteriores: 'Ver os anos anteriores', seguintes: 'Ver os anos seguintes',
    foraCanteiro: 'Fora do canteiro', jeitoDallo: 'O jeito Dallo',
    saibaMais: 'Saiba mais',
    /* contato */
    faleConosco: 'Fale conosco',
    contatoLead: 'Dois escritórios, equipe comercial própria.',
    escritorio: 'Escritório',
    /* rodapé */
    rodapeChamada: 'Todo endereço começa com uma conversa.',
    rodapeAssinatura: (n) => 'Construtora e incorporadora em Itapema, Porto Belo e Cascavel. ' + n + ' empreendimentos entregues e em obra desde 2008.',
    aDallo: 'A Dallo', nossaHistoria: 'Nossa história', faleConoscoCurto: 'Fale conosco',
    direitos: 'Todos os direitos reservados',
    /* carrosséis */
    quemAntes: 'Ver quem vem antes', quemDepois: 'Ver quem vem depois',
    anteriores2: 'Ver os anteriores', proximos: 'Ver os próximos',
    quemTrabalha: 'Quem trabalha na Dallo',
    escritorios: (n) => n + (n === 1 ? ' escritório' : ' escritórios'),
    zapChamada: 'Prefere conversar agora?',
    vazioFiltro: 'Nenhum empreendimento com esses filtros.',
    descHome: 'Do projeto à entrega: respeito, compromisso, inovação e qualidade são priorizados em cada detalhe. Padrão Dallo. Construção civil levada a sério.',
    fichaSuites: 'Suítes', fichaMetragem: 'Metragem', fichaVagas: 'Vagas',
    fichaAndares: 'Andares', fichaAltura: 'Altura', fichaEntrega: 'Entrega',
    empEntregues: 'Empreendimentos entregues',
  },

  en: {
    html: 'en', nome: 'English', curta: 'EN',
    nav: ['Developments', 'About Dallo', 'Contact'],
    falarEquipe: 'Talk to our team',
    abrirMenu: 'Open menu', fecharMenu: 'Close menu',
    inicio: 'Dallo Construction Company, home',
    trocarIdioma: 'Change language',
    zap: 'Message us on WhatsApp',
    verEmpreendimento: 'View development',
    onde: 'Where', todasCidades: 'All cities',
    suites: 'Suites', metragem: 'Floor area', qualquer: 'Any',
    estagio: 'Stage', todos: 'All',
    emObra: 'Under construction', pronto: 'Ready to move in',
    verTorres: (n) => (n === 1 ? 'View 1 tower' : 'View ' + n + ' towers'),
    torresConta: (n) => (n === 1 ? '1 tower' : n + ' towers'),
    faixas: { ate150: 'Up to 150 m²', '150-250': '150 to 250 m²', '250-400': '250 to 400 m²', '400+': 'Over 400 m²' },
    filtrandoPor: 'Filtering by', limpar: 'clear', ou: 'or',
    suitesCurto: 'suites',
    heroTitulo1: 'In Itapema,', heroTitulo2: 'Dallo redrew the skyline',
    heroLead: (n) => n + ' developments in Itapema, Porto Belo and Cascavel — from the ones still going up to the ones that are already home.',
    marcaDados: ['Developments', 'Since', 'Cities'],
    conhecaDallo: 'About Dallo',
    vozes: (n) => n + ' voices',
    subindoAgora: (n) => n + ' going up now',
    emConstrucao: 'Under construction',
    verTodosEmp: (n) => 'See all ' + n + ' developments',
    pausa: ['We are building', 'the finest tower', 'in Brazil.'],
    pausaNota: (nome, and, cidade) => nome + ' · ' + and + ' floors · ' + cidade,
    entregues: 'Delivered',
    entreguesConta: 'addresses that are already someone’s',
    verTodosEntregues: 'See everything delivered',
    projetosRotulo: (n) => n + ' projects',
    empreendimentos: 'Developments',
    contaEmp: (n) => n + (n === 1 ? ' development' : ' developments'),
    comUnidades: 'Units available', comercializados: 'Sold out',
    verNoMapa: 'View on the map', plantas: 'Floor plans', aObra: 'The works',
    primeiroLanc: 'First launch',
    torresAte: (a) => 'Towers launched through ' + a,
    andaresDe: 'Floors, lowest to tallest',
    lancamentosPeriodo: (n, a, b) => n + ' launches, ' + a + '–' + b,
    linhaDoCeu: 'The skyline',
    linhaLead: (nome1, and1, ano1, nome2, and2) =>
      'Each bar is a tower, at the height it stands. The first, in ' + ano1 + ', was ' + nome1 + ', at ' + and1 + '. The tallest of the period is ' + nome2 + ', at ' + and2 + '.',
    anosLancados: 'Launches by year, by tower height',
    anoAano: 'Year by year', oQueSubiu: 'What went up, and when',
    andares: 'floors',
    barraLeitor: (nome, and, ano) => nome + ', ' + and + ' floors, launched in ' + ano,
    anteriores: 'See earlier years', seguintes: 'See later years',
    foraCanteiro: 'Off the building site', jeitoDallo: 'The Dallo way',
    saibaMais: 'Read more',
    faleConosco: 'Contact us',
    contatoLead: 'Two offices, our own sales team.',
    escritorio: 'Office',
    rodapeChamada: 'Every address starts with a conversation.',
    rodapeAssinatura: (n) => 'Builder and developer in Itapema, Porto Belo and Cascavel. ' + n + ' developments delivered and under way since 2008.',
    aDallo: 'About Dallo', nossaHistoria: 'Our story', faleConoscoCurto: 'Contact us',
    direitos: 'All rights reserved',
    quemAntes: 'See previous', quemDepois: 'See next',
    anteriores2: 'See previous', proximos: 'See next',
    quemTrabalha: 'The people at Dallo',
    escritorios: (n) => n + (n === 1 ? ' office' : ' offices'),
    zapChamada: 'Rather talk right now?',
    vazioFiltro: 'No development matches these filters.',
    descHome: 'From design to handover: respect, commitment, innovation and quality come first in every detail. The Dallo standard. Construction taken seriously.',
    fichaSuites: 'Suites', fichaMetragem: 'Floor area', fichaVagas: 'Parking',
    fichaAndares: 'Floors', fichaAltura: 'Height', fichaEntrega: 'Handover',
    empEntregues: 'Delivered developments',
  },

  es: {
    html: 'es', nome: 'Español', curta: 'ES',
    nav: ['Emprendimientos', 'La Dallo', 'Contacto'],
    falarEquipe: 'Hablar con el equipo',
    abrirMenu: 'Abrir menú', fecharMenu: 'Cerrar menú',
    inicio: 'Constructora Dallo, página de inicio',
    trocarIdioma: 'Cambiar idioma',
    zap: 'Hablar por WhatsApp',
    verEmpreendimento: 'Ver emprendimiento',
    onde: 'Dónde', todasCidades: 'Todas las ciudades',
    suites: 'Suites', metragem: 'Superficie', qualquer: 'Cualquiera',
    estagio: 'Etapa', todos: 'Todos',
    emObra: 'En construcción', pronto: 'Listo para habitar',
    verTorres: (n) => (n === 1 ? 'Ver 1 torre' : 'Ver ' + n + ' torres'),
    torresConta: (n) => (n === 1 ? '1 torre' : n + ' torres'),
    faixas: { ate150: 'Hasta 150 m²', '150-250': '150 a 250 m²', '250-400': '250 a 400 m²', '400+': 'Más de 400 m²' },
    filtrandoPor: 'Filtrando por', limpar: 'limpiar', ou: 'o',
    suitesCurto: 'suites',
    heroTitulo1: 'En Itapema,', heroTitulo2: 'Dallo cambió la línea del cielo',
    heroLead: (n) => n + ' emprendimientos en Itapema, Porto Belo y Cascavel — de los que todavía están subiendo a los que ya son el hogar de alguien.',
    marcaDados: ['Emprendimientos', 'Desde', 'Ciudades'],
    conhecaDallo: 'Conozca la Dallo',
    vozes: (n) => n + ' voces',
    subindoAgora: (n) => n + ' subiendo ahora',
    emConstrucao: 'En construcción',
    verTodosEmp: (n) => 'Ver los ' + n + ' emprendimientos',
    pausa: ['Estamos construyendo', 'la mejor torre', 'de Brasil.'],
    pausaNota: (nome, and, cidade) => nome + ' · ' + and + ' pisos · ' + cidade,
    entregues: 'Entregados',
    entreguesConta: 'direcciones que ya son de alguien',
    verTodosEntregues: 'Ver todos los entregados',
    projetosRotulo: (n) => n + ' proyectos',
    empreendimentos: 'Emprendimientos',
    contaEmp: (n) => n + (n === 1 ? ' emprendimiento' : ' emprendimientos'),
    comUnidades: 'Con unidades', comercializados: 'Comercializados',
    verNoMapa: 'Ver en el mapa', plantas: 'Plantas', aObra: 'La obra',
    primeiroLanc: 'Primer lanzamiento',
    torresAte: (a) => 'Torres lanzadas hasta ' + a,
    andaresDe: 'Pisos, de la menor a la mayor',
    lancamentosPeriodo: (n, a, b) => n + ' lanzamientos, ' + a + '–' + b,
    linhaDoCeu: 'La línea del cielo',
    linhaLead: (nome1, and1, ano1, nome2, and2) =>
      'Cada barra es una torre, con la altura que tiene. La primera, en ' + ano1 + ', fue el ' + nome1 + ', de ' + and1 + '. La más alta del período es el ' + nome2 + ', de ' + and2 + '.',
    anosLancados: 'Lanzamientos por año, por la altura de las torres',
    anoAano: 'Año a año', oQueSubiu: 'Qué subió, y cuándo',
    andares: 'pisos',
    barraLeitor: (nome, and, ano) => nome + ', ' + and + ' pisos, lanzado en ' + ano,
    anteriores: 'Ver los años anteriores', seguintes: 'Ver los años siguientes',
    foraCanteiro: 'Fuera de la obra', jeitoDallo: 'El estilo Dallo',
    saibaMais: 'Saber más',
    faleConosco: 'Contáctenos',
    contatoLead: 'Dos oficinas, equipo comercial propio.',
    escritorio: 'Oficina',
    rodapeChamada: 'Toda dirección empieza con una conversación.',
    rodapeAssinatura: (n) => 'Constructora y promotora en Itapema, Porto Belo y Cascavel. ' + n + ' emprendimientos entregados y en obra desde 2008.',
    aDallo: 'La Dallo', nossaHistoria: 'Nuestra historia', faleConoscoCurto: 'Contáctenos',
    direitos: 'Todos los derechos reservados',
    quemAntes: 'Ver anteriores', quemDepois: 'Ver siguientes',
    anteriores2: 'Ver anteriores', proximos: 'Ver siguientes',
    quemTrabalha: 'Quién trabaja en Dallo',
    escritorios: (n) => n + (n === 1 ? ' oficina' : ' oficinas'),
    zapChamada: '¿Prefiere hablar ahora?',
    vazioFiltro: 'Ningún emprendimiento con esos filtros.',
    descHome: 'Del proyecto a la entrega: respeto, compromiso, innovación y calidad en cada detalle. Estándar Dallo. Construcción tomada en serio.',
    fichaSuites: 'Suites', fichaMetragem: 'Superficie', fichaVagas: 'Cocheras',
    fichaAndares: 'Pisos', fichaAltura: 'Altura', fichaEntrega: 'Entrega',
    empEntregues: 'Emprendimientos entregados',
  },
};

const T = () => IDIOMAS[LANG];

/* SEO por página, nas três línguas, direto do CMS. O arquivo
   dallo/api/paginas/<nome>.json traz title/description e os irmãos
   titleEn/titleEs e descriptionEn/descriptionEs. Se faltar, cai no que a
   tabela de idiomas tiver. */
const SEO_CACHE = {};
function seoDe(nome) {
  if (!(nome in SEO_CACHE)) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(ACERVO, 'api', 'paginas', nome + '.json'), 'utf8'));
      SEO_CACHE[nome] = (j.result && j.result.pageContext && j.result.pageContext.seo) || null;
    } catch (e) { SEO_CACHE[nome] = null; }
  }
  const o = SEO_CACHE[nome];
  return {
    titulo: (o && texto(tr(o, 'title'))) || 'Construtora Dallo',
    descricao: (o && texto(tr(o, 'description'))) || '',
  };
}

/* Tradução NOSSA dos textos editoriais da home: o acervo só tem o
   português deles. Chave = texto original, para nunca sair do ar se o
   CMS mudar a redação — se o português mudar e a tradução não, a chave
   deixa de casar e o texto volta em português, que é visível, em vez de
   ficar uma tradução velha mentindo. */
const HOME_TRAD = {
  en: {
    'A marca Dallo': 'The Dallo name',
    'Ética, responsabilidade, inovação e a gestão integrada dos nossos valores são os pontos fortes que nos tornaram líder de mercado e nos consagraram como uma das construtoras mais reconhecidas de Santa Catarina entre os consumidores de imóveis de luxo.':
      'Ethics, responsibility, innovation and the integrated management of our values are the strengths that made us a market leader and established us as one of the most recognised builders in Santa Catarina among luxury property buyers.',
    'Equipe Dallo': 'The Dallo team',
    'Somos uma empresa da construção civil completa, formada por equipe que ama o que faz.':
      'We are a full-service construction company, made up of a team that loves what it does.',
    'O que torna a Dallo única': 'What makes Dallo singular',
    'A capacidade de fazer a gestão de seus valores. Tudo que é feito pela Dallo tem a essência da marca. Muito mais que prédios, construímos um estilo de vida Dallo.':
      'The ability to live by its values. Everything Dallo does carries the essence of the name. Far more than buildings, we build a Dallo way of living.',
    'Iniciei na Dallo como menor aprendiz e em apenas 4 meses me tornei estagiário. A empresa me trouxe não apenas crescimento profissional, mas também pessoal. Aqui sou rodeado de pessoas sensacionais, sempre dispostas a me ajudar. Destaque para as minhas colegas de setor, sou muito sortudo por tê-las no meu dia a dia.':
      'I joined Dallo as an apprentice and within four months I had become an intern. The company brought me growth both professionally and personally. I am surrounded by remarkable people here, always ready to help. Special mention to my colleagues in the department — I am very lucky to have them around me every day.',
    'Assumir a diretoria executiva da Dallo e manter o ritmo de trabalho e de crescimento num momento de tantas incertezas por conta da pandemia foi um enorme desafio, porém muito gratificante, principalmente quando temos conosco uma equipe qualificada e comprometida em fazer sempre o melhor. Depois de 02 anos de trabalho, me sinto feliz e realizada por representar esta empresa que é líder de mercado, está entre as Construtoras mais reconhecidas entre os consumidores de imóveis de luxo e que proporciona inúmeras oportunidades para todos que fazem parte da equipe.':
      'Taking on the executive board at Dallo and keeping up the pace of work and growth at a time of so much uncertainty because of the pandemic was an enormous challenge, but a deeply rewarding one — above all when you have a qualified, committed team set on always doing their best. Two years in, I feel happy and fulfilled representing a company that leads its market, stands among the builders most recognised by luxury property buyers, and opens countless opportunities to everyone on the team.',
    'Durante meu tempo na Dallo, tive a oportunidade de crescer profissionalmente e pessoalmente, de maneira incrível. A equipe sempre foi dedicada, talentosa, e sempre disposta a enfrentar desafios. Sou grato pela experiência e pelas pessoas incríveis que conheci. A Dallo é mais do que um local de trabalho; é uma comunidade que inspira e motiva.':
      'During my time at Dallo I have had the chance to grow professionally and personally in a remarkable way. The team has always been dedicated, talented and ready to take on a challenge. I am grateful for the experience and for the extraordinary people I have met. Dallo is more than a workplace; it is a community that inspires and drives you.',
    'Penso que a empresa deve ser a extensão do nosso LAR, um lugar na qual nos sentimos bem por nele estar, onde encontramos conforto e acolhimento. Na Dallo me sinto feliz e grata, encontro aqui um ambiente de respeito, comprometimento, trabalho em equipe, pessoas felizes, o que é fundamental para nosso sucesso, sendo assim: Dallo também posso chamar de meu LAR.':
      'I believe a company should be an extension of HOME, a place where we feel good simply being there, where we find comfort and welcome. At Dallo I feel happy and grateful; I find an environment of respect, commitment, teamwork and people who are glad to be here, which is fundamental to our success. So Dallo is somewhere I can call HOME too.',
    'Ao longo desses quase 7 anos, na Dallo, tem sido uma experiência de constante crescimento e aprendizado. O que me motiva todos os dias é saber que estou cercado de pessoas que acreditam no que fazem, que se dedicam com paixão e que sonham grande. Fazer parte dessa trajetória é extremamente gratificante e o sentimento de realização, tanto pessoal quanto profissional.':
      'Across these almost seven years at Dallo it has been an experience of constant growth and learning. What keeps me going every day is knowing I am surrounded by people who believe in what they do, who give themselves to it with passion and who dream big. Being part of this story is deeply rewarding, and the sense of achievement is both personal and professional.',
    'Dallo Esporte': 'Dallo Sport',
    'Patrocinamos e incentivamos o esporte em suas diversas formas.':
      'We sponsor and encourage sport in all its forms.',
    'Fortalecemos o esporte e seguimos juntos promovendo saúde, superação e união. Apoiar essas iniciativas é investir no crescimento das pessoas e valorizar o impacto positivo que o esporte traz para toda a comunidade.':
      'We strengthen sport and move forward together, promoting health, resilience and unity. Supporting these initiatives means investing in people and valuing the good that sport brings to the whole community.',
    'Banda Dallo': 'Dallo Band',
    '"A música é a arte de manifestar os diversos afetos da nossa alma mediante o som." - Elvis Paz':
      '"Music is the art of expressing the many feelings of our soul through sound." — Elvis Paz',
    'Costumamos dizer que nos encontramos na música. O projeto: Banda Dallo recebe incentivos da empresa e a participação do CEO Luciano Dallo.':
      'We like to say we find each other in music. The Dallo Band is backed by the company and joined by CEO Luciano Dallo himself.',
    'Dallo Travel': 'Dallo Travel',
    'Sempre que viajamos voltamos maiores e melhores.':
      'Every time we travel, we come back larger and better.',
    'Aqui na Dallo existem diversos projetos dando aos colaboradores a chance de viver essas experiências. Os colaboradores ganham viagens nacionais e internacionais.':
      'At Dallo there are several programmes giving our people the chance to live those experiences. Employees are awarded trips at home and abroad.',
    'Dallo Teatro': 'Dallo Theatre',
    'O teatro dá forma às nossas emoções e nos leva a viver outras vidas em cada espetáculo.':
      'Theatre gives shape to our feelings and lets us live other lives with every performance.',
    'No projeto Teatro Dallo, valorizamos a arte como um caminho para sensibilizar, inspirar e aproximar as pessoas.':
      'In the Dallo Theatre programme we treat art as a way to move, to inspire and to bring people closer.',
    'Dallo Hipismo': 'Dallo Equestrian',
    'O hipismo une força, técnica e sintonia entre o atleta e o cavalo, criando uma conexão única que inspira a cada salto.':
      'Riding brings together strength, technique and the understanding between athlete and horse, a bond of its own that inspires at every jump.',
    'É com essa mesma paixão, que a Scuderia Dallo incentiva a prática e celebra o espírito e a elegância que esse esporte transmite.':
      'It is with that same passion that Scuderia Dallo supports the sport and celebrates the spirit and elegance it carries.',
  },
  es: {
    'A marca Dallo': 'La marca Dallo',
    'Ética, responsabilidade, inovação e a gestão integrada dos nossos valores são os pontos fortes que nos tornaram líder de mercado e nos consagraram como uma das construtoras mais reconhecidas de Santa Catarina entre os consumidores de imóveis de luxo.':
      'La ética, la responsabilidad, la innovación y la gestión integrada de nuestros valores son las fortalezas que nos convirtieron en líderes del mercado y nos consagraron como una de las constructoras más reconocidas de Santa Catarina entre los compradores de inmuebles de lujo.',
    'Equipe Dallo': 'El equipo Dallo',
    'Somos uma empresa da construção civil completa, formada por equipe que ama o que faz.':
      'Somos una empresa de construcción completa, formada por un equipo que ama lo que hace.',
    'O que torna a Dallo única': 'Lo que hace única a la Dallo',
    'A capacidade de fazer a gestão de seus valores. Tudo que é feito pela Dallo tem a essência da marca. Muito mais que prédios, construímos um estilo de vida Dallo.':
      'La capacidad de gestionar sus valores. Todo lo que hace la Dallo lleva la esencia de la marca. Mucho más que edificios, construimos un estilo de vida Dallo.',
    'Iniciei na Dallo como menor aprendiz e em apenas 4 meses me tornei estagiário. A empresa me trouxe não apenas crescimento profissional, mas também pessoal. Aqui sou rodeado de pessoas sensacionais, sempre dispostas a me ajudar. Destaque para as minhas colegas de setor, sou muito sortudo por tê-las no meu dia a dia.':
      'Empecé en la Dallo como aprendiz y en apenas cuatro meses pasé a ser pasante. La empresa me trajo crecimiento profesional y también personal. Aquí estoy rodeado de personas excepcionales, siempre dispuestas a ayudarme. Una mención especial para mis compañeras del sector: tengo mucha suerte de tenerlas en mi día a día.',
    'Assumir a diretoria executiva da Dallo e manter o ritmo de trabalho e de crescimento num momento de tantas incertezas por conta da pandemia foi um enorme desafio, porém muito gratificante, principalmente quando temos conosco uma equipe qualificada e comprometida em fazer sempre o melhor. Depois de 02 anos de trabalho, me sinto feliz e realizada por representar esta empresa que é líder de mercado, está entre as Construtoras mais reconhecidas entre os consumidores de imóveis de luxo e que proporciona inúmeras oportunidades para todos que fazem parte da equipe.':
      'Asumir la dirección ejecutiva de la Dallo y mantener el ritmo de trabajo y de crecimiento en un momento de tanta incertidumbre por la pandemia fue un enorme desafío, pero muy gratificante, sobre todo cuando se cuenta con un equipo cualificado y comprometido a dar siempre lo mejor. Después de dos años de trabajo me siento feliz y realizada al representar a esta empresa que lidera el mercado, que está entre las constructoras más reconocidas por los compradores de inmuebles de lujo y que ofrece innumerables oportunidades a todos los que forman parte del equipo.',
    'Durante meu tempo na Dallo, tive a oportunidade de crescer profissionalmente e pessoalmente, de maneira incrível. A equipe sempre foi dedicada, talentosa, e sempre disposta a enfrentar desafios. Sou grato pela experiência e pelas pessoas incríveis que conheci. A Dallo é mais do que um local de trabalho; é uma comunidade que inspira e motiva.':
      'Durante mi tiempo en la Dallo tuve la oportunidad de crecer profesional y personalmente de una manera increíble. El equipo siempre fue dedicado, talentoso y dispuesto a enfrentar desafíos. Estoy agradecido por la experiencia y por las personas extraordinarias que conocí. La Dallo es más que un lugar de trabajo: es una comunidad que inspira y motiva.',
    'Penso que a empresa deve ser a extensão do nosso LAR, um lugar na qual nos sentimos bem por nele estar, onde encontramos conforto e acolhimento. Na Dallo me sinto feliz e grata, encontro aqui um ambiente de respeito, comprometimento, trabalho em equipe, pessoas felizes, o que é fundamental para nosso sucesso, sendo assim: Dallo também posso chamar de meu LAR.':
      'Creo que la empresa debe ser la extensión de nuestro HOGAR, un lugar en el que nos sentimos bien por estar allí, donde encontramos comodidad y acogida. En la Dallo me siento feliz y agradecida; encuentro aquí un ambiente de respeto, compromiso, trabajo en equipo y personas contentas, lo que es fundamental para nuestro éxito. Por eso, a la Dallo también puedo llamarla mi HOGAR.',
    'Ao longo desses quase 7 anos, na Dallo, tem sido uma experiência de constante crescimento e aprendizado. O que me motiva todos os dias é saber que estou cercado de pessoas que acreditam no que fazem, que se dedicam com paixão e que sonham grande. Fazer parte dessa trajetória é extremamente gratificante e o sentimento de realização, tanto pessoal quanto profissional.':
      'A lo largo de estos casi siete años en la Dallo ha sido una experiencia de crecimiento y aprendizaje constantes. Lo que me motiva cada día es saber que estoy rodeado de personas que creen en lo que hacen, que se entregan con pasión y que sueñan en grande. Formar parte de esta trayectoria es enormemente gratificante, y la sensación de logro es tanto personal como profesional.',
    'Dallo Esporte': 'Dallo Deporte',
    'Patrocinamos e incentivamos o esporte em suas diversas formas.':
      'Patrocinamos e impulsamos el deporte en sus diversas formas.',
    'Fortalecemos o esporte e seguimos juntos promovendo saúde, superação e união. Apoiar essas iniciativas é investir no crescimento das pessoas e valorizar o impacto positivo que o esporte traz para toda a comunidade.':
      'Fortalecemos el deporte y seguimos juntos promoviendo salud, superación y unión. Apoyar estas iniciativas es invertir en el crecimiento de las personas y valorar el impacto positivo que el deporte trae a toda la comunidad.',
    'Banda Dallo': 'Banda Dallo',
    '"A música é a arte de manifestar os diversos afetos da nossa alma mediante o som." - Elvis Paz':
      '"La música es el arte de manifestar los diversos afectos de nuestra alma mediante el sonido." — Elvis Paz',
    'Costumamos dizer que nos encontramos na música. O projeto: Banda Dallo recebe incentivos da empresa e a participação do CEO Luciano Dallo.':
      'Solemos decir que nos encontramos en la música. La Banda Dallo recibe el apoyo de la empresa y la participación del CEO Luciano Dallo.',
    'Dallo Travel': 'Dallo Travel',
    'Sempre que viajamos voltamos maiores e melhores.':
      'Siempre que viajamos volvemos más grandes y mejores.',
    'Aqui na Dallo existem diversos projetos dando aos colaboradores a chance de viver essas experiências. Os colaboradores ganham viagens nacionais e internacionais.':
      'Aquí en la Dallo existen varios proyectos que dan a los colaboradores la oportunidad de vivir esas experiencias. Los colaboradores reciben viajes nacionales e internacionales.',
    'Dallo Teatro': 'Dallo Teatro',
    'O teatro dá forma às nossas emoções e nos leva a viver outras vidas em cada espetáculo.':
      'El teatro da forma a nuestras emociones y nos lleva a vivir otras vidas en cada espectáculo.',
    'No projeto Teatro Dallo, valorizamos a arte como um caminho para sensibilizar, inspirar e aproximar as pessoas.':
      'En el proyecto Teatro Dallo valoramos el arte como un camino para sensibilizar, inspirar y acercar a las personas.',
    'Dallo Hipismo': 'Dallo Hípica',
    'O hipismo une força, técnica e sintonia entre o atleta e o cavalo, criando uma conexão única que inspira a cada salto.':
      'La hípica une fuerza, técnica y sintonía entre el atleta y el caballo, creando una conexión única que inspira en cada salto.',
    'É com essa mesma paixão, que a Scuderia Dallo incentiva a prática e celebra o espírito e a elegância que esse esporte transmite.':
      'Con esa misma pasión, la Scuderia Dallo impulsa la práctica y celebra el espíritu y la elegancia que este deporte transmite.',
  },
};

/* texto editorial da home na língua corrente; cai no português quando
   não houver tradução nossa para aquela frase */
const trHome = (s) => {
  const t = texto(s);
  if (LANG === 'pt' || !t) return t;
  return (HOME_TRAD[LANG] && HOME_TRAD[LANG][t]) || t;
};

/* ---- fotos em tamanho de tela ----
   O acervo guarda os originais do CMS: as galerias dos empreendimentos
   somavam 1,68 GB, com média de 5,5 MB por imagem, e apareciam a 258 px
   de largura — fator 23 entre o que era baixado e o que era visto. Uma
   página de torre chegava a 62,5 MB.

   Cada original ganhou duas versões WebP em midia/web/, 1600 px e 820 px
   de largura (nunca ampliando): 930 arquivos, 79 MB no lugar de 1.828 MB.
   Isto é o que permite mostrar a arquitetura GRANDE — o problema de peso
   e o problema de direção de arte eram o mesmo problema.

   `web(url)` devolve {src, srcset} já com a raiz certa. Se a versão web
   não existir, cai no original, para nenhuma imagem sumir. */
function web(url, prof) {
  const local = midia(url);
  if (!local) return null;
  const r = raiz(prof);
  const base = 'midia/web/' + local.replace(/^midia\//, '').replace(/\.(jpe?g|png)$/i, '');
  if (!fs.existsSync(path.join(SAIDA, base + '-1600.webp'))) {
    return { src: r + local, srcset: '' };
  }
  return {
    src: r + base + '-1600.webp',
    srcset: r + base + '-820.webp 820w, ' + r + base + '-1600.webp 1600w',
  };
}

/* <img> pronto, com srcset e sizes. `sizes` diz ao navegador quanto da
   largura da tela a foto vai ocupar NAQUELE ponto do layout — sem isso o
   srcset não serve para nada, porque ele assume 100vw e baixa sempre a
   maior. */
function imagem(url, alt, sizes, prof, extra) {
  const f = web(url, prof);
  if (!f) return '';
  return '<img src="' + f.src + '"'
    + (f.srcset ? ' srcset="' + f.srcset + '" sizes="' + (sizes || '100vw') + '"' : '')
    + ' alt="' + esc(alt || '') + '" loading="lazy" decoding="async"'
    + (extra || '') + '>';
}

/* ---- partes comuns ---- */
const navItens = [
  ['empreendimentos.html', 'Empreendimentos'],
  ['sobre.html', 'A Dallo'],
  ['contato.html', 'Contato'],
];

/* Bandeiras desenhadas à mão, simplificadas de propósito: num círculo de
   20 px as 27 estrelas do Brasil e as 50 dos Estados Unidos viram sujeira.
   O que identifica uma bandeira nesse tamanho é o arranjo de cor — verde
   com losango amarelo, listras com cantão azul, três faixas horizontais.
   São SVG embutido, sem requisição, e não usam emoji: emoji de bandeira
   não é desenhado no Windows, sai como duas letras numa caixinha. */
const BANDEIRAS = {
  pt: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#009b3a"/><path d="M12 3.6 21.6 12 12 20.4 2.4 12z" fill="#fedf00"/><circle cx="12" cy="12" r="4.2" fill="#002776"/><path d="M8.1 10.4a8 8 0 0 1 7.9 1.6" stroke="#fff" stroke-width="1.1" fill="none"/></svg>',
  en: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#fff"/><g fill="#b22234"><rect width="24" height="2.4" y="0"/><rect width="24" height="2.4" y="4.8"/><rect width="24" height="2.4" y="9.6"/><rect width="24" height="2.4" y="14.4"/><rect width="24" height="2.4" y="19.2"/></g><rect width="11" height="12" fill="#3c3b6e"/></svg>',
  es: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#aa151b"/><rect width="24" height="12" y="6" fill="#f1bf00"/></svg>',
};

/* `pagina` é o caminho da página DENTRO da língua ("index.html",
   "empreendimento/celine.html"). É dele que saem os links alternativos:
   como os três idiomas usam o mesmo slug, trocar de língua é trocar o
   prefixo, e nenhum botão do seletor pode cair em 404. */
function seletorIdioma(r, pagina) {
  return `<div class="idiomas">
      <button class="idiomas-atual" type="button" aria-expanded="false" aria-controls="idiomas-lista" aria-label="${esc(T().trocarIdioma)}">
        <span class="bandeira">${BANDEIRAS[LANG]}</span>
        <span class="idiomas-sigla">${T().curta}</span>
        <svg class="idiomas-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <ul class="idiomas-lista" id="idiomas-lista" hidden>
        ${LINGUAS.map((l) => `<li><a href="${r}${l === 'pt' ? '' : l + '/'}${pagina}" lang="${IDIOMAS[l].html}"${l === LANG ? ' aria-current="true"' : ''}>
          <span class="bandeira">${BANDEIRAS[l]}</span>${IDIOMAS[l].nome}
        </a></li>`).join('\n        ')}
      </ul>
    </div>`;
}

function cabeca(titulo, descricao, prof, abertura, pagina) {
  const r = raiz(prof);        /* arquivos: css, fontes, img, midia */
  const rl = raizL(prof);      /* páginas da língua corrente */
  const p = pagina || 'index.html';
  const navLinks = [['empreendimentos.html', 0], ['sobre.html', 1], ['contato.html', 2]];
  return `<!DOCTYPE html>
<html lang="${T().html}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
${LINGUAS.map((l) => `<link rel="alternate" hreflang="${IDIOMAS[l].html}" href="${r}${l === 'pt' ? '' : l + '/'}${p}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${r}${p}">
<link rel="icon" href="${r}img/logo-dallo.svg">
<link rel="preload" href="${r}fontes/Manrope-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${r}fontes/PlayfairDisplay-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}css/estilo.css">
<!-- A classe js no elemento html e o que liga a revelacao na rolagem.
     Ela precisa valer em TODAS as paginas: enquanto so a home a tinha, o
     .revela das outras nunca escondia nada e nunca animava, e o efeito
     nao existia fora da home sem nenhum erro no console para avisar. A
     classe js no body continua so na home, porque quem usa e o CSS da
     abertura. -->
<script>document.documentElement.classList.add('js');</script>
${abertura ? `<!-- As duas faces de display da PRIMEIRA DOBRA. Medido: sem isto a
     Montserrat comecava em 36 ms e a Playfair italica em 40 ms, contra
     11 ms das que ja vinham no preload — e com font-display: swap o
     titulo e a linha de apoio nasciam em Arial e trocavam de fonte na
     frente do leitor. Vao so aqui, dentro do ramo da abertura: as
     outras paginas nao usam a italica nem a Montserrat no hero e nao
     devem pagar por estes dois arquivos. -->
<link rel="preload" href="${r}fontes/PlayfairDisplay-var-italic-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${r}fontes/Montserrat-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}css/abertura.css">
<script>document.addEventListener('DOMContentLoaded',function(){document.body.classList.add('js')});</script>` : ''}
<!-- As frases que o site.js escreve em tempo de execução (contagem da
     busca, aviso de filtro) não podem ficar dentro do script: ele é um
     arquivo só para as três línguas. Vêm por aqui. -->
<script type="application/json" id="i18n">${JSON.stringify({
    verTorre: T().verTorres(1).replace('1', '{n}'),
    verTorres: T().verTorres(2).replace('2', '{n}'),
    torre: T().torresConta(1).replace('1', '{n}'),
    torres: T().torresConta(2).replace('2', '{n}'),
    filtrandoPor: T().filtrandoPor, limpar: T().limpar, ou: T().ou,
    suites: T().suitesCurto, faixas: T().faixas,
    pronto: T().pronto.toLowerCase(), obra: T().emObra.toLowerCase(),
    emp: T().contaEmp(1).replace('1', '{n}'), emps: T().contaEmp(2).replace('2', '{n}'),
  })}</script>
</head>
<body${abertura ? ' class="js"' : ''}>

<header class="topo">
  <div class="faixa topo-in">
    <a class="topo-marca" href="${rl}index.html" aria-label="${esc(T().inicio)}">
      <img src="${r}img/logo-dallo.svg" alt="Construtora Dallo" width="138" height="35">
    </a>
    <button class="topo-abrir" type="button" aria-expanded="false" aria-controls="menu" aria-label="${esc(T().abrirMenu)}">
      <span></span><span></span><span></span>
    </button>
    <nav class="menu" id="menu">
      ${navLinks.map(([h, i]) => `<a href="${rl}${h}">${esc(T().nav[i])}</a>`).join('\n      ')}
      <a class="menu-botao" href="${rl}contato.html">${esc(T().falarEquipe)}</a>
    </nav>
    ${seletorIdioma(r, p)}
  </div>
</header>

<main>`;
}

function pe(prof, abertura, semChamada) {
  const r = raiz(prof);
  const rl = raizL(prof);
  const extra = abertura ? `\n<script src="${r}js/abertura.js"></script>` : '';
  const esc2 = contato.escritorios || [];
  return `</main>

<footer class="rodape">
  <div class="faixa">
    ${semChamada ? `` : `<div class="rodape-chamada">
      <p>${esc(T().rodapeChamada)}</p>
      <a class="botao botao-vazado" href="${rl}contato.html">${esc(T().falarEquipe)}</a>
    </div>`}
    <div class="rodape-grade">
      <div class="rodape-marca">
        <img src="${r}img/logo-dallo.svg" alt="Construtora Dallo" width="128" style="filter:brightness(0) invert(1)">
        <p class="rodape-assinatura">${esc(T().rodapeAssinatura(torres.length))}</p>
      </div>
      <div>
        <h4>${esc(T().empreendimentos)}</h4>
        <ul>
          <li><a href="${rl}empreendimentos.html?cidade=Itapema">Itapema</a></li>
          <li><a href="${rl}empreendimentos.html?cidade=Porto Belo">Porto Belo</a></li>
          <li><a href="${rl}empreendimentos.html?cidade=Cascavel">Cascavel</a></li>
        </ul>
      </div>
      <div>
        <h4>${esc(T().aDallo)}</h4>
        <ul>
          <li><a href="${rl}sobre.html">${esc(T().nossaHistoria)}</a></li>
          <li><a href="${rl}contato.html">${esc(T().faleConoscoCurto)}</a></li>
        </ul>
      </div>
      ${esc2.map((e) => `<div>
        <h4>${esc(e.nome)}</h4>
        <p>${esc(e.endereco)}</p>
        <p><a href="tel:${esc(String(e.telefone).replace(/\D/g, ''))}">${esc(e.telefone)}</a><br>${esc(e.atendimento || '')}</p>
      </div>`).join('\n      ')}
    </div>
    <div class="rodape-fim">
      <span>Dallo Empreendimentos</span>
      <span>${esc(T().direitos)}</span>
    </div>
  </div>
</footer>

<a class="zap" href="https://wa.me/554732671111" aria-label="${esc(T().zap)}">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.82c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.18 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28z"/></svg>
</a>

<script src="${r}js/site.js"></script>${extra}
</body>
</html>`;
}

/* ---- cartão de torre ----
   `extra` carrega as variantes de composição (destaque na grade
   assimétrica, largo na galeria deitada) e a classe de revelação. Os
   atributos `data-` continuam todos no <a>: são eles que os filtros da
   listagem leem, e qualquer variante nova tem de preservá-los.

   A ficha vive DENTRO da foto, no rodapé dela, e sobe no hover: a torre
   ocupa o cartão inteiro, e a informação chega quando se pede. */
function cartao(t, prof, extra) {
  const r = raiz(prof);        /* a foto mora na raiz do site */
  const rl = raizL(prof);      /* a página da torre, na raiz da língua */
  const foto = web(t.imageFeature, prof);
  const estado = entregue(t) ? 'entregue' : disponivel(t) ? 'disponivel' : 'esgotado';
  const specs = [tr(t, 'room'), tr(t, 'metreage')].filter(Boolean).map(texto).join(' · ');
  const local = [t.neighborhood, t.city, t.state].filter(Boolean).join(' · ');
  return `<a class="torre ${extra || ''}" href="${rl}empreendimento/${esc(t.slug)}.html"
         data-cidade="${esc(t.city || '')}" data-estado="${estado}"
         data-suites="${suites(t).join(',')}" data-faixa="${faixaDe(areaM2(t))}" data-estagio="${estagio(t)}">
        <span class="torre-foto">
          ${foto ? `<img src="${foto.src}"${foto.srcset ? ` srcset="${foto.srcset}" sizes="(min-width: 1100px) 31vw, (min-width: 700px) 46vw, 92vw"` : ''} alt="${esc(tr(t, 'name'))}, ${esc(local)}" loading="lazy" decoding="async">` : ''}
          ${t.tag ? `<span class="torre-tag" data-estado="${estado}">${esc(texto(tr(t, 'tag')))}</span>` : ''}
          <span class="torre-abre" aria-hidden="true">${esc(T().verEmpreendimento)}</span>
        </span>
        <span class="torre-ficha">
          <h3>${esc(tr(t, 'name'))}</h3>
          <span class="torre-local">${esc(local)}</span>
          ${specs ? `<span class="torre-specs">${esc(specs)}</span>` : ''}
        </span>
      </a>`;
}

/* ---- busca da primeira dobra ----
   Um filtro que conta antes de você clicar. Cada opção mostra quantas
   torres sobram com ela, e a que não sobraria nenhuma apaga — assim
   ninguém chega numa lista vazia. O acervo inteiro cabe em 45 linhas de
   JSON, então a conta é local: não há ida ao servidor a cada mexida.

   Não há filtro de preço porque o CMS da Dallo não publica preço em
   lugar nenhum — nenhuma das 45 fichas traz valor. No lugar dele entrou
   metragem, que é o que o acervo tem. */
function busca() {
  const porCidade = {};
  torres.forEach((t) => { if (t.city) porCidade[t.city] = (porCidade[t.city] || 0) + 1; });
  const cidades = Object.keys(porCidade).sort((a, b) => porCidade[b] - porCidade[a]);
  const degraus = [...new Set(torres.flatMap(suites))].sort((a, b) => a - b);

  const acervo = torres.map((t) => ({
    c: t.city || '', s: suites(t), f: faixaDe(areaM2(t)), e: estagio(t),
  }));

  const opcao = (valor, rotulo) =>
    `<option value="${esc(valor)}" data-rotulo="${esc(rotulo)}">${esc(rotulo)}</option>`;

  return `<form class="busca" action="empreendimentos.html" method="get"
        aria-label="${esc(T().empreendimentos)}">
        <label class="busca-campo">
          <span class="busca-rotulo">${esc(T().onde)}</span>
          <select class="busca-seletor" name="cidade">
            ${opcao('', T().todasCidades)}
            ${cidades.map((c) => opcao(c, c)).join('\n            ')}
          </select>
        </label>

        <div class="busca-campo busca-campo-suites" role="group" aria-label="${esc(T().suites)}">
          <span class="busca-rotulo" aria-hidden="true">${esc(T().suites)}</span>
          <div class="busca-fichas">
            ${degraus.map((n) => `<label class="busca-ficha">
              <input type="checkbox" name="suites" value="${n}">
              <span>${n}</span>
            </label>`).join('\n            ')}
          </div>
        </div>

        <label class="busca-campo">
          <span class="busca-rotulo">${esc(T().metragem)}</span>
          <select class="busca-seletor" name="faixa">
            ${opcao('', T().qualquer)}
            ${FAIXAS.map(([v]) => opcao(v, T().faixas[v])).join('\n            ')}
          </select>
        </label>

        <label class="busca-campo">
          <span class="busca-rotulo">${esc(T().estagio)}</span>
          <select class="busca-seletor" name="estagio">
            ${opcao('', T().todos)}
            ${opcao('obra', T().emObra)}
            ${opcao('pronto', T().pronto)}
          </select>
        </label>

        <button class="busca-ir" type="submit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          <span data-busca-contagem>${esc(T().verTorres(torres.length))}</span>
        </button>
      </form>
      <script type="application/json" id="busca-acervo">${JSON.stringify(acervo).replace(/</g, '\\u003c')}</script>`;
}

/* ---- página inicial ---- */
/* A cena da abertura é UM SVG só: o papel com o buraco e a marca, no mesmo
   desenho e no mesmo sistema de coordenadas. É isso que impede o buraco de
   descolar do O — antes o papel era recortado em pixels da tela e a marca
   era ampliada por transform, cada um com seu fator, e o anel do O ficava
   para trás enquanto o buraco disparava.

   O zoom é feito encolhendo o viewBox, e não ampliando camada nenhuma.
   Ampliar por transform tem teto: acima de ~16k pixels a placa larga
   pedaços da textura. Um viewBox que encolhe é redesenho vetorial — nítido
   em qualquer aproximação, e sem teto.

   O logotipo é um <path> só, com 8 subcaminhos. Para as letras saírem de
   trás do D não dá para separá-las sem redesenhar a marca — e redesenhar a
   marca de um cliente é mexer no que não é nosso. Em vez disso, a marca
   inteira é desenhada duas vezes: uma recortada no D, outra recortada no
   resto, e é o corte da segunda que se abre. A geometria fica intacta.
   O D termina em 27,3% da largura (medido no traçado): 376,188 + 0,273 ×
   138 = 413,86. */
function cenaAbertura() {
  const svg = fs.readFileSync(path.join(SAIDA, 'img', 'logo-dallo.svg'), 'utf8');
  const d = (svg.match(/ d="([^"]*)"/) || [])[1] || '';
  return `<svg class="abertura-cena" viewBox="376.188 189.404 138 34.659" aria-hidden="true">
        <defs>
          <clipPath id="abertura-d" clipPathUnits="userSpaceOnUse">
            <rect x="371" y="184" width="42.86" height="45"/>
          </clipPath>
          <clipPath id="abertura-letras" clipPathUnits="userSpaceOnUse">
            <rect class="abertura-cortina" x="413.86" y="184" width="0" height="45"/>
          </clipPath>
        </defs>
        <path class="abertura-papel" fill-rule="evenodd" d="M0,0Z"/>
        <path class="abertura-marca" clip-path="url(#abertura-d)" d="${d}"/>
        <path class="abertura-marca" clip-path="url(#abertura-letras)" d="${d}"/>
      </svg>`;
}

function gerarHome() {
  const videoHome = (home.videos || []).filter((v) => /video-home-1/.test(v));
  const mp4 = midia(videoHome.find((v) => v.endsWith('.mp4')));
  const webm = midia(videoHome.find((v) => v.endsWith('.webm')));
  const emObra = torres.filter(disponivel).slice(0, 6);
  const prontos = torres.filter(entregue).slice(0, 6);
  const marca = home.marca || {};
  const equipe = home.equipe || {};
  const projetos = home.projetos || [];

  /* Fotos da empresa. O CMS não guarda imagem nenhuma em `marca` nem em
     `equipe` — o site original deixa as duas seções só com texto. Estas duas
     são do próprio acervo da Dallo: a sede está no admin (uploads/office) e a
     foto da equipe inteira é a capa do post da festa de fim de ano, no blog.
     São endereços fixos de propósito: não há campo no JSON para apontá-las. */
  /* A torre mais alta do acervo, pelo número de andares do próprio JSON:
     é a imagem e a legenda da seção da frase institucional. */
  const maisAlta = torres.slice().sort((a, b) => (+b.floor || 0) - (+a.floor || 0))[0];
  const fotoPausa = maisAlta ? midia(maisAlta.imageFeature) : '';
  const fotoMarca = midia(EST + 'about-2-eb0088b1778ee27a765edfb7d704e264.jpg');
  const gente = (equipe.depoimentos || [])
    .map((d) => ({ ...d, foto: midia(RETRATOS[d.nome] || '') }))
    .filter((d) => d.foto);

  const seo = seoDe('index');
  /* paginas/index.json não traz bloco de SEO, então a descrição da home
     sai da tabela de idiomas — senão as três línguas repetiam a frase
     portuguesa na meta description, que é justamente o que o Google lê */
  const html = cabeca(seo.titulo, LANG === 'pt' ? texto(home.descricao || '') || T().descHome : T().descHome,
    false, true, 'index.html') + `
  <div class="abertura-palco">
    <section class="dobra-itapema">
      <!-- O vídeo é o travelling aéreo sobre Itapema que a própria Dallo
           usa na home: a cidade à esquerda, a torre no meio, o mar à
           direita. Estava no acervo (home.videos) e o gerador ja resolvia
           o caminho, mas nunca o usava.

           preload="none" e as fontes presas so pelo data-: quem liga o
           video e o site.js, depois do primeiro quadro pintado. Assim o
           hero aparece pelo poster, sem esperar 3 MB, e nao ha salto de
           layout — o poster tem a mesma proporcao do video.

           A foto antiga continua no projeto como poster de reserva para
           quem recusa movimento (prefers-reduced-motion), caminho em
           --hero-foto no CSS. -->
      <video class="dobra-filme" data-proporcao-min="1.4" muted loop playsinline preload="none" tabindex="-1"
             aria-hidden="true" poster="${raiz()}midia/cenas/hero-poster.webp"
             data-webm="${raiz()}${webm}" data-mp4="${raiz()}${mp4}"></video>
      <span class="dobra-grao" aria-hidden="true"></span>
      <div class="emenda-nuvens" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="dobra-texto">
        <div class="faixa">
          <h1 class="surge">
            <span class="linha-grotesca">${esc(T().heroTitulo1)}</span>
            <span class="linha-serifada">${esc(T().heroTitulo2)}</span>
          </h1>
          <p class="surge"><span>${esc(T().heroLead(torres.length))}</span></p>
        </div>
      </div>
      ${busca()}
    </section>

    <div class="abertura" aria-hidden="true">
      ${cenaAbertura()}
      <span class="abertura-seta"></span>
    </div>
  </div>



    <!-- A marca é uma dobra de tela cheia: a foto cobre a seção e o texto
         ocupa a cunha vazia do alto à esquerda. -->
    <!-- ======================= A MARCA ========================
       Composição editorial: a foto sangra pela borda direita e sobe mais
       que a coluna de texto, e o número institucional serve de âncora no
       canto vazio. Os três dados são contados do acervo, não escritos à
       mão — se entrar um empreendimento, eles mudam sozinhos. -->
  <section class="secao marca-editorial">
    <div class="marca-grade">
      <div class="marca-texto revela">
        <h2>${esc(trHome(marca.titulo || 'A marca Dallo'))}</h2>
        <p class="lead">${esc(trHome(marca.texto || ''))}</p>
        <dl class="marca-dados">
          <div><dt>${esc(T().marcaDados[0])}</dt><dd>${torres.length}</dd></div>
          <div><dt>${esc(T().marcaDados[1])}</dt><dd>2008</dd></div>
          <div><dt>${esc(T().marcaDados[2])}</dt><dd>${[...new Set(torres.map((t) => t.city).filter(Boolean))].length}</dd></div>
        </dl>
        <a class="botao" href="sobre.html">${esc(T().conhecaDallo)}</a>
      </div>
      ${fotoMarca ? `<figure class="marca-foto revela atraso-2">
        ${imagem(EST + 'about-2-eb0088b1778ee27a765edfb7d704e264.jpg',
          'Edifício da Dallo com fachada escura e arcadas envidraçadas, ao anoitecer',
          '(min-width: 1000px) 52vw, 100vw', false)}
      </figure>` : ''}
    </div>
  </section>

  <!-- ======================= EQUIPE ========================
       A fotografia é a protagonista: retratos altos correndo deitado, com
       contador e barra de progresso no lugar de pontinhos. O depoimento
       abre DENTRO da foto no clique — fora dela, cinco depoimentos
       inteiros empilhados faziam a seção descer meia página. -->
  <section class="secao equipe-editorial">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div>
          <span class="rotulo">${esc(T().vozes(gente.length))}</span>
          <h2>${esc(trHome(equipe.titulo || 'Equipe Dallo'))}</h2>
        </div>
        <p class="lead">${esc(trHome(equipe.chamada || ''))}</p>
      </div>
    </div>
    ${gente.length ? `<div class="trilho-caixa" data-trilho>
      <div class="trilho trilho-gente" tabindex="0" role="region" aria-label="${esc(T().quemTrabalha)}">
        ${gente.map((d, i) => `<figure class="gente">
          <div class="gente-foto">
            <img src="${raiz()}midia/cenas/equipe-${i + 1}.webp" alt="${esc(d.nome)}" loading="lazy">
            <div class="gente-fala" id="fala-${i}">
              <blockquote>${esc(trHome(d.texto || ''))}</blockquote>
            </div>
            <span class="gente-marca" aria-hidden="true"></span>
          </div>
          <figcaption>
            <span class="gente-ordem" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            <button class="gente-nome" type="button" aria-expanded="false" aria-controls="fala-${i}">${esc(d.nome)}</button>
          </figcaption>
        </figure>`).join('')}
      </div>
      <div class="trilho-leme faixa">
        <div class="trilho-barra" aria-hidden="true"><span data-trilho-progresso></span></div>
        <div class="trilho-setas">
          <button class="trilho-seta" type="button" data-passo="-1" aria-label="${esc(T().quemAntes)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8"/></svg>
          </button>
          <button class="trilho-seta" type="button" data-passo="1" aria-label="${esc(T().quemDepois)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8"/></svg>
          </button>
        </div>
      </div>
    </div>` : ''}
  </section>

  <!-- ======================= EM CONSTRUÇÃO ========================
       Grade assimétrica: a primeira torre vale por duas, as outras duas
       empilham ao lado. Não é enfeite — a primeira é a que a Dallo está
       lançando, e o tamanho diz isso antes de qualquer etiqueta. -->
  <section class="secao obras">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div>
          <span class="rotulo">${esc(T().subindoAgora(torres.filter(disponivel).length))}</span>
          <h2>${esc(T().emConstrucao)}</h2>
        </div>
        <a class="elo" href="empreendimentos.html">${esc(T().verTodosEmp(torres.length))}</a>
      </div>
      <div class="obras-grade">
        ${emObra.slice(0, 3).map((t, i) => cartao(t, false, i === 0 ? 'torre-destaque revela' : 'revela atraso-' + i)).join('')}
      </div>
    </div>
  </section>

  <!-- ======================= A PAUSA ========================
       A frase sobre a torre mais alta do acervo. A imagem não é ilustração
       solta: é a própria torre de que a frase fala, escolhida pelo número
       de andares no JSON. -->
  <section class="secao pausa">
    <picture>
      <source media="(max-width: 899px)" srcset="${raiz()}midia/cenas/pausa-sweden-alto.webp">
      <img class="pausa-foto" src="${raiz()}midia/cenas/pausa-sweden-largo.webp" alt="" aria-hidden="true" loading="lazy">
    </picture>
    <div class="faixa pausa-texto">
      <p class="frase-grande revela">
        ${T().pausa.map((l) => `<span><span>${esc(l)}</span></span>`).join('\n        ')}
      </p>
      ${maisAlta ? `<p class="pausa-nota revela atraso-2">${esc(T().pausaNota(tr(maisAlta, 'name'), maisAlta.floor, maisAlta.city))}</p>` : ''}
    </div>
  </section>

  <!-- ======================= ENTREGUES ========================
       Galeria deitada sobre o escuro: ali as fachadas saltam, e a seção
       lê como portfólio em vez de vitrine. O trilho sai da faixa e vai
       até as bordas da tela — o cartão cortado é o que avisa que há mais
       coisa adiante. -->
  <section class="secao entregues secao-escura">
    <div class="faixa">
      <div class="cabeca-conta revela">
        <h2>${esc(T().entregues)}</h2>
        <p class="conta-grande"><strong>${torres.filter(entregue).length}</strong> <span>${esc(T().entreguesConta)}</span></p>
      </div>
    </div>
    <div class="trilho-caixa" data-trilho>
      <div class="trilho trilho-largo" tabindex="0" role="region" aria-label="${esc(T().empEntregues)}">
        ${prontos.map((t) => cartao(t, false, 'torre-larga')).join('')}
      </div>
      <div class="trilho-leme faixa">
        <a class="elo elo-leme" href="empreendimentos.html?estagio=pronto">${esc(T().verTodosEntregues)}</a>
        <div class="trilho-barra" aria-hidden="true"><span data-trilho-progresso></span></div>
        <div class="trilho-setas">
          <button class="trilho-seta" type="button" data-passo="-1" aria-label="${esc(T().anteriores2)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8"/></svg>
          </button>
          <button class="trilho-seta" type="button" data-passo="1" aria-label="${esc(T().proximos)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8"/></svg>
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- ======================= PROJETOS ========================
       Mosaico com tratamentos diferentes, e não cinco blocos iguais: o
       primeiro ocupa a largura toda com o texto POR CIMA do filme; os
       demais se desencontram em larguras distintas, com o texto embaixo.

       Os vídeos não vêm com a página: o site.js só liga a fonte quando o
       bloco chega perto, e pausa quando sai. São 28 MB ao todo. -->
  <section class="secao projetos">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div>
          <span class="rotulo">${esc(T().projetosRotulo(projetos.length))}</span>
          <h2>${esc(trHome(home.diferencial ? home.diferencial.titulo : 'O que torna a Dallo única'))}</h2>
        </div>
        <p class="lead">${esc(trHome(home.diferencial ? home.diferencial.texto : ''))}</p>
      </div>
    </div>
    <div class="mosaico">
      ${projetos.map((p, i) => {
        const f = FILMES[p.nome];
        return `<article class="projeto revela ${i === 0 ? 'projeto-capa' : ''}">
        ${f ? `<div class="projeto-tela">
          <video class="dobra-filme" muted loop playsinline preload="none" aria-hidden="true"
                 ${POSTERES[p.nome] ? `poster="${raiz()}${POSTERES[p.nome]}"` : ``}
                 data-webm="${raiz()}${midia(EST + f[0])}" data-mp4="${raiz()}${midia(EST + f[1])}"></video>
        </div>` : ''}
        <div class="projeto-ficha">
          <span class="projeto-ordem" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <h3>${esc(trHome(p.nome))}</h3>
          ${p.chamada ? `<p class="projeto-chamada">${esc(trHome(p.chamada))}</p>` : ''}
          <p class="projeto-texto">${esc(trHome(p.texto || ''))}</p>
        </div>
      </article>`;
      }).join('\n      ')}
    </div>
  </section>
` + pe(false, true);
  fs.writeFileSync(path.join(saidaLang(), 'index.html'), html);
}

/* ---- listagem ---- */
function gerarListagem() {
  const cidades = [...new Set(torres.map((t) => t.city).filter(Boolean))].sort();
  const seo = seoDe('empreendimentos');
  const html = cabeca(seo.titulo, seo.descricao, false, false, 'empreendimentos.html') + `
  <section class="secao">
    <div class="faixa">
      <div class="cabeca-secao">
        <h1>${esc(T().empreendimentos)}</h1>
        <p class="lead" data-contagem>${esc(T().contaEmp(torres.length))}</p>
      </div>

      <div class="filtros" data-filtros>
        <button type="button" data-grupo="cidade" data-valor="todas" aria-pressed="true">${esc(T().todasCidades)}</button>
        ${cidades.map((c) => `<button type="button" data-grupo="cidade" data-valor="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('\n        ')}
      </div>
      <div class="filtros" data-filtros-estado>
        <button type="button" data-grupo="estado" data-valor="todos" aria-pressed="true">${esc(T().todos)}</button>
        <button type="button" data-grupo="estado" data-valor="disponivel" aria-pressed="false">${esc(T().comUnidades)}</button>
        <button type="button" data-grupo="estado" data-valor="esgotado" aria-pressed="false">${esc(T().comercializados)}</button>
        <button type="button" data-grupo="estado" data-valor="entregue" aria-pressed="false">${esc(T().entregues)}</button>
      </div>

      <div class="torres">
        ${torres.slice().sort((a, b) => String(tr(a, 'name')).localeCompare(String(tr(b, 'name')), LANG)).map((t) => cartao(t)).join('\n        ')}
      </div>
      <p class="vazio" data-vazio hidden>${esc(T().vazioFiltro)}</p>
    </div>
  </section>
` + pe();
  fs.writeFileSync(path.join(saidaLang(), 'empreendimentos.html'), html);
}

/* ---- página de um empreendimento ----
   Era a parte mais fraca do site, e é a que o comprador de fato abre:
   135 das 147 páginas. O diagnóstico, medido:

   · as galerias mostravam as fotos a 258x193 px numa grade uniforme de
     `auto-fill`, com um órfão sobrando na segunda fileira;
   · os arquivos tinham 5946x4606 e 5,5 MB — fator 23 entre o baixado e
     o visto — e uma página somava 62,5 MB;
   · onze seções idênticas empilhadas: mesmo cabeçalho, mesma lead, mesma
     fileira de miniaturas. Sem ritmo, sem hierarquia, sem respiro.

   A reescrita trata as duas coisas de uma vez: as fotos vêm das versões
   web (1600/820) e por isso podem aparecer GRANDES. Cada galeria vira um
   mosaico editorial de proporções variadas, em vez de miniaturas iguais,
   e as seções alternam papel e escuro para a página ter narrativa em vez
   de lista. */
function gerarTorre(t) {
  const local = [t.neighborhood, t.city, t.state].filter(Boolean).join(' · ');
  const ficha = [
    [T().fichaSuites, tr(t, 'room')], [T().fichaMetragem, tr(t, 'metreage')], [T().fichaVagas, tr(t, 'garage')],
    [T().fichaAndares, t.floor], [T().fichaAltura, tr(t, 'height')], [T().fichaEntrega, tr(t, 'yearDelivery')],
  ].filter(([, v]) => v);

  /* O mosaico: o ciclo de sete classes dá sete recortes diferentes e
     volta ao começo. Não é aleatório — é um padrão fixo, então duas
     torres com o mesmo número de fotos ficam com a mesma composição, e
     a página não muda de cara a cada build. */
  const RECORTES = ['alta', 'larga', 'quadrada', 'larga', 'alta', 'quadrada', 'panoramica'];

  const galerias = (t.galleries || []).map((g, gi) => {
    const fotos = (g.images || []).map((i) => (i.urls && (i.urls.large || i.urls.original)) || '').filter(Boolean);
    const titulo = texto(tr(g, 'title'));
    if (!fotos.length && !titulo) return '';
    const escura = gi % 2 === 1;
    const mosaico = fotos.map((u, i) => {
      const corte = RECORTES[i % RECORTES.length];
      /* sizes: quanto da largura o slot ocupa de fato. Sem isto o
         navegador assume 100vw e baixa sempre a versão de 1600. */
      const sizes = corte === 'panoramica' ? '(min-width: 900px) 92vw, 100vw'
        : corte === 'larga' ? '(min-width: 900px) 58vw, 100vw'
        : '(min-width: 900px) 38vw, 100vw';
      return '<figure class="cena cena-' + corte + ' revela">'
        + imagem(u, tr(t, 'name') + (titulo ? ' — ' + titulo : ''), sizes, true)
        + '</figure>';
    }).join('\n          ');
    return '<section class="secao cenas-secao' + (escura ? ' secao-escura' : '') + '">\n'
      + '      <div class="faixa">\n'
      + '        <div class="cabeca-dupla revela">\n'
      + '          <div>\n'
      + (titulo ? '            <h2>' + esc(titulo) + '</h2>\n' : '')
      + '          </div>\n'
      + (g.description ? '          <p class="lead">' + esc(texto(tr(g, 'description'))) + '</p>\n' : '')
      + '        </div>\n'
      + '      </div>\n'
      + (fotos.length ? '      <div class="cenas">\n          ' + mosaico + '\n      </div>\n' : '')
      + '    </section>';
  }).filter(Boolean);

  const plantas = (t.plants || []).map((p) => {
    const u = midia(p.image);
    if (!u) return '';
    /* tr() PRIMEIRO: no português p.description é um array, e testar o
       array antes de traduzir fazia o inglês e o espanhol caírem sempre
       de volta no português */
    const descBruta = tr(p, 'description');
    const desc = Array.isArray(descBruta) ? descBruta.map(texto).filter(Boolean).join(' · ') : texto(descBruta);
    return `<figure class="planta revela">
            ${imagem(p.image, T().plantas + ' ' + tr(p, 'name') + ' — ' + tr(t, 'name'), '(min-width: 900px) 30vw, 90vw', true)}
            <figcaption><strong>${esc(tr(p, 'name'))}</strong>${desc ? '<br>' + esc(desc) : ''}</figcaption>
          </figure>`;
  }).filter(Boolean);

  const etapas = (t.stages || []).filter((s) => s && s.name);
  const heroi = web(t.imageTop || t.imageFeature, true);

  const html = cabeca(
    `${tr(t, 'name')} — Construtora Dallo`,
    texto(tr(t, 'resume')).slice(0, 180), true, false, 'empreendimento/' + t.slug + '.html') + `
  <!-- ======================= ABERTURA DA TORRE ========================
       Tela cheia, com o nome sobre a imagem e a ficha técnica na mesma
       composição. Antes eram 558 px de altura com um recorte qualquer do
       render, e a ficha vinha depois, numa seção à parte. -->
  <section class="torre-abertura">
    ${heroi ? `<img class="torre-fundo" src="${heroi.src}"${heroi.srcset ? ` srcset="${heroi.srcset}" sizes="100vw"` : ''} alt="${esc(tr(t, 'name'))}, ${esc(local)}" fetchpriority="high" decoding="async">` : ''}
    <div class="faixa torre-abertura-texto">
      <span class="rotulo">${esc(local)}</span>
      <h1>${esc(tr(t, 'name'))}</h1>
      ${ficha.length ? `<dl class="torre-chave">
        ${ficha.slice(0, 4).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(texto(v))}</dd></div>`).join('\n        ')}
      </dl>` : ''}
    </div>
  </section>

  ${t.resume || t.description ? `<section class="secao torre-prosa">
    <div class="faixa">
      ${t.resume ? `<p class="frase-media revela">${esc(texto(tr(t, 'resume')))}</p>` : ''}
      ${t.description ? `<div class="torre-corpo revela atraso-1">${paragrafos(tr(t, 'description'))}</div>` : ''}
    </div>
  </section>` : ''}

  ${ficha.length > 4 ? `<section class="secao torre-ficha-secao">
    <div class="faixa">
      <!-- só o que a abertura ainda não mostrou: repetir os quatro
           primeiros a uma tela de distância não informa nada -->
      <dl class="torre-chave torre-chave-larga revela">
        ${ficha.slice(4).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(texto(v))}</dd></div>`).join('\n        ')}
      </dl>
    </div>
  </section>` : ''}

  ${galerias.join('\n  ')}

  ${plantas.length ? `<section class="secao secao-clara">
    <div class="faixa">
      <div class="cabeca-dupla revela"><div><h2>${esc(tr(t, 'plantTitle') || T().plantas)}</h2></div></div>
      <div class="plantas">
        ${plantas.join('\n        ')}
      </div>
    </div>
  </section>` : ''}

  ${etapas.length ? `<section class="secao secao-escura">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div><h2>${esc(tr(t, 'workTitle') || T().aObra)}</h2></div>
        ${t.workContent ? `<p class="lead">${esc(texto(tr(t, 'workContent')))}</p>` : ''}
      </div>
      <div class="obra revela">
        ${etapas.map((s) => `<div class="obra-item">
          <span class="obra-nome">${esc(tr(s, 'name'))}</span>
          <span class="obra-valor">${Number(s.value || 0).toFixed(0)}%</span>
          <span class="obra-barra"><i style="width:${Math.max(0, Math.min(100, Number(s.value) || 0))}%"></i></span>
        </div>`).join('\n        ')}
      </div>
    </div>
  </section>` : ''}

  ${t.locationUrl ? `<section class="secao">
    <div class="faixa">
      <a class="botao" href="${esc(t.locationUrl)}" target="_blank" rel="noopener">${esc(T().verNoMapa)}</a>
    </div>
  </section>` : ''}

  ${t.descriptionFooter ? `<section class="secao torre-nota">
    <div class="faixa">
      <p>${esc(texto(tr(t, 'descriptionFooter')))}</p>
    </div>
  </section>` : ''}
` + pe(true);
  fs.writeFileSync(path.join(saidaLang(), 'empreendimento', t.slug + '.html'), html);
}

/* ---- A Dallo ---- */
/* ---- A Dallo ----
   O CMS guarda 34 marcos em "histories", um por lançamento, de 2009 a
   2022. Cada um tem o ano (no campo "title", não em "year" — a versão
   anterior desta página lia h.year e por isso TODOS os anos saíam em
   branco), o nome da torre, a descrição e uma imagem que nunca foi
   baixada para o acervo.

   As imagens não fazem falta: os 34 nomes casam, um a um, com torres do
   acervo de empreendimentos, que já estão em disco. Então cada marco
   carrega a foto da própria torre e leva para a página dela.

   E a história está nos andares. O campo "floor" do acervo bate com o
   número escrito na descrição nos 32 marcos onde os dois existem, e
   cobre os 2 em que a frase está escrita de outro jeito. De 9 andares em
   2009 a 54 em 2021: é esse o enredo, e ele vira desenho — cada
   lançamento é uma barra da altura da torre, e a linha do céu sobe. */
function gerarSobre() {
  const u = sobre.universe || {};

  /* casa marco com torre do acervo pelo nome, ignorando acento e caixa */
  const chave = (x) => String(x || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  const porNome = new Map(torres.map((t) => [chave(t.name), t]));

  const marcos = (sobre.histories || [])
    .map((h) => {
      const t = porNome.get(chave(h.name));
      return {
        ano: String(texto(h.title) || '').trim(),
        nome: texto(tr(h, 'name')),
        descricao: texto(tr(h, 'description')),
        andares: t && +t.floor ? +t.floor : null,
        slug: t ? t.slug : '',
        foto: t ? web(t.imageFeature, false) : null,
      };
    })
    .filter((m) => /^\d{4}$/.test(m.ano));

  /* agrupa por ano, do mais antigo para o mais novo: a linha do céu tem
     de subir da esquerda para a direita, e o acervo vem ao contrário */
  const anos = [...new Set(marcos.map((m) => m.ano))].sort();
  const porAno = anos.map((ano) => ({
    ano,
    torres: marcos.filter((m) => m.ano === ano)
      .sort((a, b) => (a.andares || 0) - (b.andares || 0)),
  }));

  const altos = marcos.filter((m) => m.andares).map((m) => m.andares);
  const maisAlto = Math.max.apply(null, altos);
  const maisBaixo = Math.min.apply(null, altos);
  const campeao = marcos.find((m) => m.andares === maisAlto);
  /* a primeira torre e a do primeiro ano, nao a mais baixa do periodo:
     o minimo geral e 8 (2017/2018) e a de 2009 tem 9 andares */
  const primeira = porAno[0].torres[0];
  const anoIni = anos[0], anoFim = anos[anos.length - 1];

  let n = 0;   /* ordem geral da barra, para escalonar a entrada */

  const horizonte = porAno.map((g) => {
    const barras = g.torres.map((m) => {
      n += 1;
      return '<a class="barra" href="empreendimento/' + esc(m.slug) + '.html"'
        + ' style="--andares:' + (m.andares || 0) + ';--ordem:' + n + '">'
        + (m.foto ? '<img src="' + m.foto.src + '"' + (m.foto.srcset ? ' srcset="' + m.foto.srcset + '" sizes="44px"' : '') + ' alt="" aria-hidden="true" loading="lazy" decoding="async">' : '')
        + '<span class="barra-balao" aria-hidden="true"><strong>' + esc(m.nome) + '</strong>'
        + '<span>' + m.andares + ' ' + esc(T().andares) + '</span></span>'
        + '<span class="barra-leitor">' + esc(T().barraLeitor(m.nome, m.andares, m.ano)) + '</span></a>';
    }).join('\n            ');
    return '<div class="horizonte-ano">\n          <div class="horizonte-torres">\n            '
      + barras + '\n          </div>\n          <span class="horizonte-rotulo">'
      + esc(g.ano) + '</span>\n        </div>';
  }).join('\n        ');

  const listaMarcos = porAno.slice().reverse().map((g) => {
    const itens = g.torres.slice().reverse().map((m) => '<li>\n            <a href="empreendimento/'
      + esc(m.slug) + '.html">\n              '
      + (m.foto ? '<span class="marco-foto"><img src="' + m.foto.src + '"' + (m.foto.srcset ? ' srcset="' + m.foto.srcset + '" sizes="(min-width: 1200px) 30vw, (min-width: 700px) 46vw, 92vw"' : '') + ' alt="' + esc(m.nome) + '" loading="lazy" decoding="async"></span>' : '')
      + '\n              <span class="marco-ficha">\n                <h4>' + esc(m.nome) + '</h4>\n                '
      + (m.andares ? '<span class="marco-andares">' + m.andares + ' ' + esc(T().andares) + '</span>' : '')
      + '\n                <p>' + esc(m.descricao) + '</p>\n              </span>\n            </a>\n          </li>')
      .join('\n          ');
    return '<section class="marco-ano revela">\n        <h3 class="marco-rotulo"><span>'
      + esc(g.ano) + '</span></h3>\n        <ol class="marco-lista">\n          '
      + itens + '\n        </ol>\n      </section>';
  }).join('\n      ');

  const programas = (sobre.banners || []).map((b, i) => '<li class="revela">\n          '
    + '<span class="programa-ordem" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>\n          '
    + '<h3>' + esc(texto(tr(b, 'title'))) + '</h3>\n          '
    + '<p>' + esc(texto(tr(b, 'description'))) + '</p>\n          '
    + (b.url ? '<a class="elo" href="' + esc(b.url) + '" target="_blank" rel="noopener">'
        + esc(texto(tr(b, 'cta')) || T().saibaMais) + '</a>' : '')
    + '\n        </li>').join('\n        ');

  const estilo = sobre.style && texto(tr(sobre.style, 'description'));

  const seo = seoDe('sobre');
  const html = cabeca(seo.titulo, seo.descricao, false, false, 'sobre.html') + `
  <!-- ======================= ABERTURA ========================
       O texto institucional vem inteiro do CMS. Nada aqui é escrito à
       mão: os três números saem da contagem dos 34 marcos, e por isso
       dizem "até ${anoFim}" — a prosa fala de 44 empreendimentos até
       2026, que é outro recorte, e dois números diferentes lado a lado
       sem o recorte escrito viram contradição na cara do leitor. -->
  <section class="secao sobre-abertura">
    <div class="faixa">
      <div class="sobre-grade">
        <h1 class="revela">${esc(texto(tr(u, 'title')) || 'Nossa História')}</h1>
        <div class="sobre-prosa revela atraso-1">
          ${paragrafos(tr(u, 'description'))}
        </div>
      </div>
      <dl class="sobre-dados revela atraso-2">
        <div><dt>${esc(T().primeiroLanc)}</dt><dd>${esc(anoIni)}</dd></div>
        <div><dt>${esc(T().torresAte(anoFim))}</dt><dd>${marcos.length}</dd></div>
        <div><dt>${esc(T().andaresDe)}</dt><dd>${maisBaixo}&thinsp;–&thinsp;${maisAlto}</dd></div>
      </dl>
    </div>
  </section>

  <!-- ======================= A LINHA DO CÉU ========================
       Uma barra por lançamento, com a altura proporcional ao número de
       andares da torre. O eixo de baixo são os anos. Não é enfeite: é o
       mesmo dado da lista que vem logo abaixo, desenhado. As barras
       sobem do chão quando a seção entra na tela — com clip-path, não
       com escala, senão a foto dentro da barra achata. -->
  <section class="secao horizonte-secao secao-escura">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div>
          <span class="rotulo">${esc(T().lancamentosPeriodo(marcos.length, anoIni, anoFim))}</span>
          <h2>${esc(T().linhaDoCeu)}</h2>
        </div>
        <p class="lead">${esc(T().linhaLead(primeira.nome, primeira.andares, anoIni, campeao ? campeao.nome : '', maisAlto))}</p>
      </div>
    </div>
    <div class="trilho-caixa revela" data-trilho>
      <div class="trilho horizonte" tabindex="0" role="region" aria-label="${esc(T().anosLancados)}">
        ${horizonte}
      </div>
      <div class="trilho-leme faixa">
        <div class="trilho-barra" aria-hidden="true"><span data-trilho-progresso></span></div>
        <div class="trilho-setas">
          <button class="trilho-seta" type="button" data-passo="-1" aria-label="${esc(T().anteriores)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8"/></svg>
          </button>
          <button class="trilho-seta" type="button" data-passo="1" aria-label="${esc(T().seguintes)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8"/></svg>
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- ======================= OS MARCOS ========================
       A mesma trajetória escrita, com todo o texto do CMS preservado. O
       ano fica grudado na lateral enquanto o grupo dele passa: é o que
       diz em que ponto da história o leitor está, sem repetir o número
       dentro de cada cartão. -->
  <section class="secao marcos-secao">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div>
          <span class="rotulo">${esc(T().anoAano)}</span>
          <h2>${esc(T().oQueSubiu)}</h2>
        </div>
      </div>
      ${listaMarcos}
    </div>
  </section>
${estilo ? `
  <!-- ======================= O ESTILO ========================
       A frase que a Dallo escreveu sobre o próprio jeito de trabalhar,
       sozinha no escuro. É o fecho da história. -->
  <section class="secao estilo-secao secao-escura">
    <div class="faixa">
      <p class="frase-grande revela">${esc(estilo)}</p>
    </div>
  </section>` : ''}
${programas ? `
  <!-- ======================= FORA DO CANTEIRO ========================
       Os quatro programas que a Dallo mantém. As imagens deles moram no
       CMS e nunca entraram no acervo, então aqui eles são texto e link —
       o conteúdo não se perde e nenhuma caixa fica vazia esperando foto
       que não existe. -->
  <section class="secao programas-secao">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div>
          <span class="rotulo">${esc(T().foraCanteiro)}</span>
          <h2>${esc(T().jeitoDallo)}</h2>
        </div>
      </div>
      <ol class="programas">
        ${programas}
      </ol>
    </div>
  </section>` : ''}
` + pe();
  fs.writeFileSync(path.join(saidaLang(), 'sobre.html'), html);
}

/* ---- Fale conosco ----
   Era a última página ainda no layout antigo: títulos no estilo padrão,
   duas fotos de escritório numa grade genérica e seis atributos `style`
   inline no HTML. Agora segue a mesma linguagem do resto — abertura em
   foto larga, os dois escritórios como peças editoriais com a foto
   sangrando, e o contato direto em destaque.

   Nada de formulário: o CMS lista os campos (`formulario`), mas não há
   servidor nenhum para receber um POST neste site estático. Inventar um
   formulário que não envia seria pior que não ter — o caminho real é o
   telefone de cada escritório e o WhatsApp, que já existem. */
function gerarContato() {
  const escs = contato.escritorios || [];
  const seo = seoDe('contato');
  const banner = contato.banner;

  const html = cabeca(seo.titulo, seo.descricao, false, false, 'contato.html') + `
  <section class="secao contato-abertura">
    <div class="faixa">
      <div class="cabeca-dupla revela">
        <div>
          <span class="rotulo">${esc(T().escritorios(escs.length))}</span>
          <h1>${esc(T().faleConosco)}</h1>
        </div>
        <p class="lead">${esc(T().contatoLead)}</p>
      </div>
    </div>
    ${banner ? `<figure class="contato-cena revela atraso-1">
      ${imagem(banner, '', '100vw', false)}
    </figure>` : ''}
  </section>

  <section class="secao contato-escritorios">
    <div class="faixa">
      ${escs.map((e, i) => {
        const tel = String(e.telefone || '').replace(/\D/g, '');
        return `<article class="escritorio revela${i ? ' atraso-1' : ''}">
        <figure class="escritorio-foto">
          ${imagem(e.foto, T().escritorio + ' ' + e.nome, '(min-width: 900px) 46vw, 92vw', false)}
        </figure>
        <div class="escritorio-ficha">
          <span class="escritorio-ordem" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <h2>${esc(e.nome)}</h2>
          <p class="escritorio-endereco">${esc(e.endereco)}</p>
          ${e.telefone ? `<a class="escritorio-tel" href="tel:${esc(tel)}">${esc(e.telefone)}</a>` : ''}
          ${e.atendimento ? `<p class="escritorio-horario">${esc(e.atendimento)}</p>` : ''}
        </div>
      </article>`;
      }).join('\n      ')}
    </div>
  </section>

  <section class="secao secao-escura contato-zap">
    <div class="faixa">
      <p class="frase-media revela">${esc(T().zapChamada)}</p>
      <a class="botao botao-vazado revela atraso-1" href="https://wa.me/554732671111" target="_blank" rel="noopener">${esc(T().zap)}</a>
    </div>
  </section>
` + pe(false, false, true);
  fs.writeFileSync(path.join(saidaLang(), 'contato.html'), html);
}

/* ---- executa ----
   O site inteiro sai três vezes: português na raiz, inglês em /en/ e
   espanhol em /es/, com os mesmos slugs. Os arquivos (css, fontes, img,
   midia) são escritos uma vez só, na raiz, e as páginas das outras
   línguas apontam para lá com ../ — não há cópia de mídia por idioma. */
LINGUAS.forEach((l) => {
  LANG = l;
  fs.mkdirSync(path.join(saidaLang(), 'empreendimento'), { recursive: true });
  gerarHome();
  gerarListagem();
  gerarSobre();
  gerarContato();
  torres.forEach(gerarTorre);
});
LANG = 'pt';

console.log('paginas:   ' + LINGUAS.length * (4 + torres.length) + ' (' + (4 + torres.length) + ' x ' + LINGUAS.length + ' idiomas: ' + LINGUAS.join(', ') + ')');
console.log('midia:     ' + copiados + ' arquivos copiados');
console.log('ausentes:  ' + ausentes);
if (faltando.length) {
  fs.writeFileSync(path.join(SAIDA, '_midia-ausente.txt'), [...new Set(faltando)].join('\n'));
  console.log('           lista em _midia-ausente.txt');
}
