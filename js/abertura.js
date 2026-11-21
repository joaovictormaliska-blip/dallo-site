/* ==========================================================================
   A abertura da Dallo, dirigida pela rolagem.

   A cena é UM SVG: o papel com o buraco e a marca, no mesmo desenho. O
   zoom é feito ENCOLHENDO O viewBox — como aproximar uma câmera —, e não
   ampliando camadas.

   Cinco coisas aqui foram aprendidas doendo, antes neste mesmo projeto:
   1. Camada nenhuma é ampliada por transform. Camada ampliada pede textura
      do tamanho ampliado, e acima de ~16k a placa larga pedaços que ficam
      PRESOS na tela. Por isso a marca antes parava em 3,4×.
   2. ...e parar em 3,4× foi o que descolou o O do buraco: o buraco crescia
      ~59× e o anel do O ficava para trás, pequeno, no meio da foto. Com um
      viewBox que encolhe, os dois são o MESMO desenho e não têm como se
      separar — e não há teto de ampliação, porque é vetor redesenhado.
   3. O relógio de quadros pode sumir. Se sumir, `raf` fica com um pedido
      que nunca chega e `if (!raf)` tranca tudo para sempre: daí a rede.
   4. Nada de mola com relógio próprio. Medido: a rolagem parava em 115 ms
      e a cena continuava sozinha por 1,2 s. Isto é arrastado, não jogado.
   5. Nada de uma segunda cópia da imagem para trocar no fim. Atrás do
      papel está a dobra de verdade, a mesma que fica depois.
   ========================================================================== */
(function () {
  'use strict';

  var palco = document.querySelector('.abertura-palco');
  var cena = document.querySelector('.abertura');
  var dobra = document.querySelector('.abertura-palco > .dobra-itapema');
  if (!palco || !cena || !dobra) return;

  /* ---- a silhueta do prédio, para as nuvens passarem ATRÁS dele ----
     As nuvens são desenhadas POR CIMA da foto — é a única forma de
     aparecerem no céu dela —, e o que as faz parecer estar atrás do
     prédio é este recorte: elas existem só acima desta linha.

     A linha não foi desenhada no olho. Foi lida da própria foto, coluna a
     coluna, descendo até o primeiro pixel que deixa de ser céu. Os pares
     são (fração da largura, fração da altura) da IMAGEM, não da tela, e o
     script converte conforme o `object-fit: cover` a enquadra. Até 40,6%
     da largura não há prédio nenhum: é céu até embaixo.

     Trocar a foto da dobra pede ler a silhueta de novo.

     DORMENTE desde que o hero virou video. O .dobra-nuvens saiu do HTML
     porque ele existia para por nuvens no CEU DA FOTO, e o video e um
     aereo sem ceu. As tres leituras abaixo ja eram guardadas por
     if (nuvens), entao o codigo nao faz nada e nao custa nada. Ficou aqui
     de proposito: sao vinte pontos medidos a mao, coluna a coluna, e
     voltam a valer no dia em que a dobra voltar a ser imagem parada. As
     nuvens que escondem a emenda entre as dobras sao outras — .emenda-
     nuvens — e continuam funcionando. */
  var IMG_L = 2560, IMG_A = 1438;
  var PREDIO_DE = 0.406;
  var SILHUETA = [
    [0.4219, 0.4193], [0.4531, 0.3839], [0.4844, 0.3616], [0.5000, 0.2914],
    [0.5156, 0.2274], [0.5313, 0.1892], [0.5469, 0.1669], [0.5625, 0.1579],
    [0.5781, 0.1613], [0.5938, 0.1683], [0.6094, 0.1808], [0.6250, 0.2045],
    [0.6406, 0.1871], [0.6563, 0.1773], [0.6875, 0.1857], [0.7500, 0.2010],
    [0.8125, 0.2170], [0.8750, 0.2323], [0.9375, 0.2476], [1.0000, 0.2620]
  ];

  var foto = dobra.querySelector('img');
  var nuvens = dobra.querySelector('.dobra-nuvens');
  var texto = dobra.querySelector('.dobra-texto');
  var svg = cena.querySelector('.abertura-cena');
  var papel = cena.querySelector('.abertura-papel');
  var cortina = cena.querySelector('.abertura-cortina');
  var seta = cena.querySelector('.abertura-seta');
  if (!svg || !papel || !cortina) return;

  var menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ligado = false;

  /* ---- marcos, em frações do curso do palco (420svh) ---- */
  var LETRAS_A = 0.02, LETRAS_B = 0.19;   // as letras saem de trás do D
  var ZOOM_A = 0.28, ZOOM_B = 0.90;       // a câmera entra pelo O
  /* As escritas surgem ANTES de o buraco terminar de abrir, não depois:
     assim o que se vê por ele já é a dobra inteira, foto e texto juntos. */
  var REVELA = 0.68;
  var CORTE = 0.91;                       // o papel deixa de existir

  /* A marca, em suas próprias coordenadas (as do traçado, sem translate):
     138 × 34,659 a partir de (376,188 · 189,404). */
  var MARCA_X = 376.188, MARCA_Y = 189.404, MARCA_L = 138, MARCA_A = 34.659;
  var D_FIM = 413.86;                     // onde o D acaba (27,3% da largura)
  var LETRAS_L = MARCA_X + MARCA_L - D_FIM;

  /* Enquanto só o D aparece, é ELE que fica no meio da tela — e não a marca
     inteira com o D deslocado para a esquerda, que é onde ele acabaria
     parando. Conforme as letras saem, a cena desliza do centro do D para o
     centro da marca, e o D caminha para o seu lugar definitivo enquanto o
     resto nasce à direita dele. São 50,17 unidades de deslize. */
  var CENTRO_D = (MARCA_X + D_FIM) / 2;          /* 395,02 */
  var CENTRO_MARCA = MARCA_X + MARCA_L / 2;      /* 445,188 */

  /* O miolo do O, medido no traçado: 12,36 × 16,6, centro em (497,42 ·
     210,64). Conferido por dois métodos independentes (varredura de
     preenchimento e caixa do traçado), que deram o mesmo centro. */
  var MIOLO_L = 12.36;
  var MIOLO_D = 'M503.596,212.577h0c0,3.662-2.154,6.178-6.29,6.372-4.137-.195-6.066-2.626-6.066-6.261v-3.968c0-3.633,2.124-6.149,6.29-6.372,4.137.224,6.066,2.655,6.066,6.288Z';
  var MIOLO_M = { x: 503.596, y: 212.577 };   /* onde o traçado começa */
  var MIOLO_C = { x: 497.42, y: 210.64 };     /* centro da caixa do miolo */
  var MIOLO_RESTO = MIOLO_D.replace(/^M[-\d.]+,[-\d.]+/, '');

  /* Depois do `M` inicial o traçado é todo relativo, e é isso que torna a
     conta simples: encolher o desenho é multiplicar todos os números. Só é
     usado enquanto o buraco nasce (s de 0 a 1); o zoom em si é do viewBox. */
  function caminhoDoMiolo(s) {
    if (s >= 0.999) return MIOLO_D;
    var corpo = MIOLO_RESTO.replace(/-?\d*\.?\d+/g, function (n) {
      return (parseFloat(n) * s).toFixed(4);
    });
    var mx = MIOLO_C.x + (MIOLO_M.x - MIOLO_C.x) * s;
    var my = MIOLO_C.y + (MIOLO_M.y - MIOLO_C.y) * s;
    return 'M' + mx.toFixed(4) + ',' + my.toFixed(4) + corpo;
  }

  /* O recorte das nuvens: a região de céu, isto é, tudo acima da silhueta.
     `desce` é o quanto a foto já desceu — a silhueta desce com ela, senão
     as nuvens sumiriam atrás de um prédio que não está mais ali. */
  function recortarNuvens(desce) {
    if (!nuvens || !base.nuvensA) return;
    if (Math.abs(desce - base.recorte) < 2) return;   /* nada mudou à vista */
    base.recorte = desce;
    var W = base.nuvensL, A = base.nuvensA;
    var x = function (u) { return (base.cobreX + u * base.cobreL).toFixed(1); };
    var y = function (v) { return (base.cobreY + v * base.cobreA + desce).toFixed(1); };
    var p = ['0px 0px', W.toFixed(1) + 'px 0px'];
    for (var i = SILHUETA.length - 1; i >= 0; i--) {
      p.push(x(SILHUETA[i][0]) + 'px ' + y(SILHUETA[i][1]) + 'px');
    }
    /* antes do prédio é céu até o fim da faixa */
    p.push(x(PREDIO_DE) + 'px ' + A.toFixed(1) + 'px');
    p.push('0px ' + A.toFixed(1) + 'px');
    var corte = 'polygon(' + p.join(',') + ')';
    nuvens.style.webkitClipPath = corte;
    nuvens.style.clipPath = corte;
  }

  var trava = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var suave = function (t) { return t * t * (3 - 2 * t); };
  var desacelera = function (t) { return 1 - Math.pow(1 - t, 3); };

  var cortado = false, revelado = false;
  var base = { w: 0, h: 0, fx: 0, fy: 0, fMax: 1 };

  /* Mede a tela uma vez por tamanho, não a cada quadro: ler a caixa dentro
     do laço força recálculo de layout em todo quadro — e devolve zero
     depois do corte.

     O viewBox inicial é o retângulo da tela medido nas unidades da marca,
     com a marca centrada e larga como a CSS pede (min(46vw, 620px)). */
  function medir() {
    var W = window.innerWidth, H = window.innerHeight;
    if (!W || !H) return;
    var larguraDaMarca = Math.min(W * 0.46, 620);
    var porUnidade = larguraDaMarca / MARCA_L;      /* pixels por unidade */
    base.h1 = H;                 /* a altura da tela, em pixels */
    base.palcoTopo = palco.getBoundingClientRect().top + window.pageYOffset;

    /* O enquadramento da foto pelo `object-fit: cover`, para converter a
       silhueta de coordenadas da imagem para pixels da dobra. */
    if (nuvens) {
      var db = dobra.getBoundingClientRect();
      var esc = Math.max(db.width / IMG_L, db.height / IMG_A);
      base.cobreL = IMG_L * esc;
      base.cobreA = IMG_A * esc;
      base.cobreX = (db.width - base.cobreL) / 2;
      base.cobreY = (db.height - base.cobreA) / 2;
      base.nuvensL = db.width;
      base.nuvensA = nuvens.getBoundingClientRect().height;
      base.recorte = -1e9;       /* força o primeiro recorte */
    }
    /* os três tempos, lidos do CSS para o número não viver em dois lugares */
    var estilo = getComputedStyle(palco);
    var medida = function (nome, padrao) {
      var v = parseFloat(estilo.getPropertyValue(nome));
      return (v > 0 ? v : padrao) * H;
    };
    /* Zero é um valor legítimo aqui — quer dizer "sem descida" —, então o
       padrão só entra quando a propriedade não existe ou não é número. */
    var telasDeSaida = parseFloat(estilo.getPropertyValue('--saida-telas'));
    base.saida = (isNaN(telasDeSaida) ? 1.1 : telasDeSaida) * H;
    base.dobraA = dobra.offsetHeight;
    base.curso = palco.offsetHeight - base.dobraA - base.saida;

    base.w = W / porUnidade;
    base.h = H / porUnidade;
    /* Onde o miolo do O cai na tela, nos dois enquadramentos: com o D no
       meio (início) e com a marca inteira no meio (fim das letras). É por
       esse ponto que o zoom ancora depois. */
    base.fxD = (MIOLO_C.x - CENTRO_D) / base.w + 0.5;
    base.fxMarca = (MIOLO_C.x - CENTRO_MARCA) / base.w + 0.5;
    base.fy = (MIOLO_C.y - (MARCA_Y + MARCA_A / 2)) / base.h + 0.5;
    /* Aproximação máxima: o miolo passa a valer 1,5 tela de largura. A
       folga é o que garante que a forma arredondada cubra os cantos. */
    base.fMax = 1.5 * base.w / MIOLO_L;
  }

  /* `p` é o que se vê (alisado); `bruto` é onde a rolagem está DE FATO.
     O desenho segue `p`, mas o corte segue `bruto` — sempre. Decidir o
     corte pelo valor alisado foi um defeito: num rolar rápido a abertura
     saía mais de um segundo depois de a rolagem ter parado. */
  /* Os dois argumentos são a rolagem EM PIXELS: `px` é o valor amortecido
     pela mola (o que se vê) e `bruto` é o de verdade (o que decide). Daqui
     saem os três progressos — abertura, descida e entrada —, e cada um
     deles é só uma regra de três sobre o seu trecho. */
  function pintar(px, bruto) {
    if (bruto === undefined) bruto = px;
    if (!base.w || !base.curso) return;

    var p = trava(px / base.curso);
    var pBruto = bruto / base.curso;

    /* as letras saem de trás do D: a cortina é um retângulo que se abre */
    var rev = desacelera(trava((p - LETRAS_A) / (LETRAS_B - LETRAS_A)));
    cortina.setAttribute('width', (rev * LETRAS_L).toFixed(3));
    if (seta) seta.style.setProperty('--seta', (rev * (1 - trava((p - 0.21) / 0.07))).toFixed(3));

    /* a câmera entra pelo O: o viewBox encolhe, ancorado no miolo */
    var z = suave(trava((p - ZOOM_A) / (ZOOM_B - ZOOM_A)));
    var f = Math.pow(base.fMax, z);
    var vw = base.w / f, vh = base.h / f;
    /* A câmera faz dois movimentos, um depois do outro:

       1. enquanto as letras saem (`rev`), desliza do D centrado para a
          marca centrada — o D volta ao lugar dele e o resto nasce ao lado;
       2. enquanto o zoom entra (`z`), centraliza no O. Sem isso o anel do
          O sairia pela direita antes da esquerda, deixando uma faixa
          petróleo de um lado só; e no fim a foto fica centrada na tela. */
    var fx = base.fxD + (base.fxMarca - base.fxD) * rev;
    var cx = fx + (0.5 - fx) * z;
    var cy = base.fy + (0.5 - base.fy) * z;
    var vx = MIOLO_C.x - cx * vw, vy = MIOLO_C.y - cy * vh;
    svg.setAttribute('viewBox',
      vx.toFixed(4) + ' ' + vy.toFixed(4) + ' ' + vw.toFixed(4) + ' ' + vh.toFixed(4));

    /* O papel é um retângulo bem maior que a vista, com o miolo do O
       vazado dentro (regra par-ímpar). O buraco só nasce depois que o O
       chega: sem isto, um pedaço de dobra fica aparecendo ao lado do D
       antes de a letra ser revelada. */
    var surge = trava((rev - 0.82) / 0.18);
    var d = 'M' + (vx - vw).toFixed(3) + ',' + (vy - vh).toFixed(3) +
            'h' + (3 * vw).toFixed(3) + 'v' + (3 * vh).toFixed(3) +
            'h' + (-3 * vw).toFixed(3) + 'Z';
    /* 1,06 de folga: o buraco passa um pouco do miolo e a sobra fica sob o
       anel do O, desenhado por cima. Sem a folga, qualquer arredondamento
       de subpixel deixa um fio branco em volta. */
    if (surge > 0) d += caminhoDoMiolo(surge * 1.06);
    papel.setAttribute('d', d);

    /* ---- a saída: os objetos descem e a próxima dobra sobe ----
       Descem só a FOTO e o TEXTO, não a dobra: o que eles descobrem é o
       fundo dela, branco de propósito, igual ao da seção que entra.
       A foto desce um pouco mais que uma tela, o bastante para sair por
       baixo; o texto desce menos, porque se apaga antes — senão ficaria
       boiando sozinho sobre o papel. */
    /* O POP vem antes da descida, e é o que dá vida ao movimento: antes de
       cair, as coisas tomam impulso — sobem um nada e incham um nada. É a
       "antecipação" dos animadores; sem ela a descida começa do nada e
       parece mecânica.

       A curva do pulso é sen²(π·tp): sobe e volta a zero, e começa E
       termina com derivada zero. Isso é o que emenda as duas fases sem
       costura — no instante em que o pop acaba, a descida parte do mesmo
       lugar e com a mesma velocidade (nenhuma). Um seno simples começaria
       com a derivada no máximo, e a mudança se veria como um tranco.

       Depois do pop, a descida ocupa o resto da saída: `td` remapeia o
       trecho que sobra para 0..1, então nada é cortado. */
    /* A descida foi retirada: terminada a abertura, a dobra sobe com a
       rolagem, como qualquer seção. As nuvens ainda precisam do recorte,
       só que com deslocamento zero — a silhueta do prédio não se move. */
    recortarNuvens(0);

    /* as escritas surgem dentro do buraco, com ele ainda abrindo */
    var abre = pBruto >= REVELA;
    if (abre !== revelado) {
      revelado = abre;
      dobra.classList.toggle('revelado', abre);
    }

    /* A cena deixa de existir; a dobra atrás nem soube que ela estava lá.
       O cabeçalho entra agora, e não junto com as escritas: ele é fixo POR
       CIMA da cena, e apareceria boiando no papel branco antes de o buraco
       chegar perto do topo da tela. */
    var fora = pBruto >= CORTE;
    if (fora !== cortado) {
      cortado = fora;
      cena.style.display = fora ? 'none' : '';
      document.body.classList.toggle('abriu', fora);
    }
  }

  /* ---- o avanço: uma mola entre a rolagem e o desenho ----
     É a mola que faz o movimento parecer fluido em vez de seco: a rolagem
     puxa, e a cena vai até lá com peso. K é a rigidez e C o amortecimento;
     C abaixo de 2·√K deixa um respiro no fim do movimento, em vez de
     travar de uma vez.

     Esta mola já esteve aqui e foi tirada por um defeito que NÃO era dela:
     o corte da abertura era decidido pelo valor amortecido, que chega
     atrasado, e numa rolada rápida a cena seguia mais de um segundo depois
     de a página parar. A correção é separar as duas coisas — o que se vê
     segue a mola, as DECISÕES (cortar, revelar, esconder) seguem a rolagem
     de verdade. Com isso a mola pode voltar sem o defeito voltar junto. */
  /* Medido, com um gesto de 300 px e o tempo até a cena alcançar 90% do
     movimento:

         K 10,5 · C 5,6   1,00 s   ← arrastava; a cena chegava um segundo
                                      depois do dedo, e isso se lê como
                                      borrachudo, não como fluido
         K 150  · C 24    0,31 s   ← acompanha de perto e ainda suaviza

     Nenhum dos dois ultrapassa o alvo (amortecimento ~0,98), então não há
     balanço no fim — o que se ganha é só resposta. */
  var K = 150, C = 24;
  var pos = 0, veloc = 0, ultimoMs = 0, raf = 0, ultimoQuadro = 0, rede = 0;

  /* A rolagem dentro do palco, em pixels. A dobra fica grudada por
     `palco − dobra`, e esse trecho se divide em três: ABERTURA (o curso),
     SAÍDA (a foto e o texto descendo) e ENTRADA (a seção subindo). Os
     pontos de divisão vêm do CSS, para não existir o mesmo número escrito
     em dois lugares — é assim que as duas pontas saem do lugar uma da
     outra. Uma leitura só por quadro: `pintar` recebe o valor pronto. */
  /* `pageYOffset` em vez de ler a caixa do palco: ler a caixa obriga o
     navegador a recalcular o layout, e isso acontecia em TODO quadro de
     rolagem. A posição do palco no documento não muda — basta medi-la uma
     vez e subtrair. */
  function destino() {
    return window.pageYOffset - base.palcoTopo;
  }

  /* A rede NÃO pode ser rearmada a cada evento de rolagem. Rolando sem
     parar, o `clearTimeout` empurrava o disparo para sempre e ela nunca
     socorria. Agora, uma vez armada, ela corre até o fim; se ainda houver
     quadros chegando, sai sem fazer nada. */
  function armarRede() {
    if (rede) return;
    rede = setTimeout(function () {
      rede = 0;
      if (performance.now() - ultimoQuadro < 180) return;  /* o relógio está vivo */
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pos = destino(); veloc = 0; ultimoMs = 0;
      pintar(pos);   /* socorro: salta, não anima */
    }, 200);
  }

  function quadro(agora) {
    raf = 0; ultimoQuadro = agora;
    /* A altura da tela manda em tudo aqui — curso, saída e entrada saem
       dela. Confiar só no evento `resize` não basta: ele não chega em
       todo caso em que a altura muda (e já chegou tarde demais, com as
       medidas feitas sobre uma tela que não existia mais). A comparação
       é barata; `medir` só roda quando algo mudou de fato. */
    if (base.h1 !== window.innerHeight) medir();
    var dt = ultimoMs ? Math.min((agora - ultimoMs) / 1000, 1 / 30) : 1 / 60;
    ultimoMs = agora;
    var alvo = destino();
    veloc += (-K * (pos - alvo) - C * veloc) * dt;
    pos += veloc * dt;
    pintar(pos, alvo);
    /* Os limiares são em PIXELS. Um pixel e meio de distância já não se
       enxerga, e parar antes disso só faz a mola arrastar o fim do
       movimento sem nada aparecer na tela. */
    if (Math.abs(alvo - pos) > 1.5 || Math.abs(veloc) > 3) {
      raf = requestAnimationFrame(quadro); armarRede();
    } else {
      pos = alvo; veloc = 0; ultimoMs = 0;
      pintar(pos, alvo);
      clearTimeout(rede); rede = 0;
    }
  }

  function aoRolar() {
    if (!ligado) return;
    if (raf && performance.now() - ultimoQuadro > 180) { cancelAnimationFrame(raf); raf = 0; }
    if (!raf) { ultimoMs = 0; raf = requestAnimationFrame(quadro); }
    armarRede();
  }

  function verificar() {
    ligado = !menosMovimento && window.matchMedia('(min-width: 981px)').matches;
    if (!ligado) {
      /* sem abertura, a dobra é só a dobra: tudo à mostra desde o início */
      cena.style.display = '';
      if (foto) {
        foto.style.transform = '';
        foto.style.visibility = '';
        foto.style.webkitMaskImage = ''; foto.style.maskImage = '';
      }
      if (texto) {
        texto.style.transform = ''; texto.style.opacity = '';
        texto.style.visibility = '';
      }
      if (nuvens) { nuvens.style.webkitClipPath = ''; nuvens.style.clipPath = ''; }
      cortado = false; revelado = true;
      dobra.classList.add('revelado');
      document.body.classList.add('abriu');
    } else {
      medir();
      pos = destino(); veloc = 0;
      pintar(pos);
    }
  }

  verificar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  /* A guarda da altura existe por causa da barra de endereço do celular,
     que entra e sai ao rolar e dispara `resize` sem nada ter mudado de
     fato. Mas ela não pode valer onde a abertura roda: ali a ALTURA manda
     nas medidas — o curso e a saída saem dela —, e ignorar uma janela
     redimensionada na vertical deixava a descida e a subida calculadas em
     cima de uma tela que não existe mais. Como a abertura só liga em tela
     larga, e lá não há barra de endereço indo e vindo, olhar a altura
     quando `ligado` é seguro. */
  var largAnt = window.innerWidth, altAnt = window.innerHeight;
  window.addEventListener('resize', function () {
    var mudou = window.innerWidth !== largAnt ||
                (ligado && window.innerHeight !== altAnt);
    if (!mudou) return;
    largAnt = window.innerWidth; altAnt = window.innerHeight;
    verificar(); aoRolar();
  });
  window.addEventListener('load', function () { verificar(); aoRolar(); });
})();
