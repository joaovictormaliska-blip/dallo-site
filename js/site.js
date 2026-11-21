/* Construtora Dallo — comportamento mínimo.
   Sem dependências e sem build: o site é estático e abre direto do disco. */
(function () {
  'use strict';

  /* ---- idioma ----
     O site.js é UM arquivo para as três línguas: as frases que ele
     escreve em tempo de execução (a contagem da busca, o aviso de
     filtro) vêm da página, num <script type="application/json">. Os
     valores em português ficam aqui como rede — se o bloco sumir, o
     site fala português em vez de ficar mudo. */
  var D = (function () {
    var padrao = {
      verTorre: 'Ver {n} torre', verTorres: 'Ver {n} torres',
      torre: '{n} torre', torres: '{n} torres',
      filtrandoPor: 'Filtrando por', limpar: 'limpar', ou: 'ou',
      suites: 'suítes', pronto: 'pronto para morar', obra: 'em construção',
      emp: '{n} empreendimento', emps: '{n} empreendimentos',
      faixas: { ate150: 'até 150 m²', '150-250': '150 a 250 m²',
        '250-400': '250 a 400 m²', '400+': 'acima de 400 m²' }
    };
    var el = document.getElementById('i18n');
    if (!el) return padrao;
    try {
      var vindo = JSON.parse(el.textContent);
      for (var k in vindo) if (vindo[k]) padrao[k] = vindo[k];
      return padrao;
    } catch (e) { return padrao; }
  }());
  var frase = function (molde, n) { return String(molde).replace('{n}', n); };

  /* ---- seletor de idioma ----
     A lista é de links de verdade e funciona sem script nenhum; o que o
     script faz é escondê-la até alguém pedir. Fecha no Esc e no clique
     fora, como qualquer menu suspenso tem de fechar. */
  (function () {
    var caixa = document.querySelector('.idiomas');
    if (!caixa) return;
    var botao = caixa.querySelector('.idiomas-atual');
    var lista = caixa.querySelector('.idiomas-lista');
    if (!botao || !lista) return;
    var fechar = function () {
      caixa.classList.remove('aberto');
      lista.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    };
    botao.addEventListener('click', function (e) {
      e.stopPropagation();
      var abrindo = lista.hidden;
      caixa.classList.toggle('aberto', abrindo);
      lista.hidden = !abrindo;
      botao.setAttribute('aria-expanded', abrindo ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!caixa.contains(e.target)) fechar();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lista.hidden) { fechar(); botao.focus(); }
    });
  }());


  /* ---- revelação na rolagem ----
     Entrada discreta e UMA VEZ só: quem já apareceu sai da lista.

     Feito na rolagem, e não com IntersectionObserver. O observador seria
     mais barato, mas aqui ele esconde CONTEÚDO (`opacity: 0`), e um
     efeito decorativo não pode derrubar a leitura se o aviso não chegar.
     Medido neste projeto: o observador dispara a primeira chamada com
     tudo fora da tela e depois nunca mais entrega — e qualquer bandeira
     de "já disparou" dá falso positivo justamente por causa dessa
     primeira chamada.

     O custo é controlado: a conta só roda quando há algo pendente, no
     máximo uma vez por quadro, e a lista encolhe até zerar — aí o
     ouvinte se remove sozinho. */
  var pendentes = [].slice.call(document.querySelectorAll('.revela'));
  if (pendentes.length) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pendentes.forEach(function (el) { el.classList.add('dentro'); });
      pendentes = [];
    } else {
      var ultimaConta = 0;
      var conferirRevela = function () {
        ultimaConta = Date.now();
        var alturaJanela = window.innerHeight;
        pendentes = pendentes.filter(function (el) {
          var r = el.getBoundingClientRect();
          /* só segue pendente o que ainda está ABAIXO da dobra. O que já
             passou por cima (r.bottom < 0) é revelado: num salto de
             âncora, ou numa rolagem rápida que pule o bloco, ele ficaria
             invisível para sempre até alguém voltar. */
          if (r.top > alturaJanela * 0.88) return true;
          el.classList.add('dentro');
          return false;
        });
        if (!pendentes.length) {
          window.removeEventListener('scroll', agendarRevela);
          window.removeEventListener('resize', agendarRevela);
        }
      };
      /* Limiar de TEMPO, não requestAnimationFrame: medido neste projeto,
         o rAF para de ser entregue quando a janela não está pintando, e
         com ele some a revelação inteira. Data.now() não depende de
         quadro nenhum. */
      var agendarRevela = function () {
        if (Date.now() - ultimaConta < 80) return;
        conferirRevela();
      };
      window.addEventListener('scroll', agendarRevela, { passive: true });
      window.addEventListener('resize', agendarRevela);
      window.addEventListener('load', agendarRevela);
      conferirRevela();
    }
  }

  /* ---- menu ----
     Na tela larga a navegação está sempre à mostra, na própria faixa. No
     celular ela desce da faixa, e o que manda é uma classe no cabeçalho —
     não `hidden` no <nav>, que esconderia os links também no desktop. */
  var topo = document.querySelector('.topo');
  var abrir = document.querySelector('.topo-abrir');
  var fecharMenu = function () {};
  if (topo && abrir) {
    var trocar = function (mostrar) {
      topo.classList.toggle('aberto', mostrar);
      abrir.setAttribute('aria-expanded', mostrar ? 'true' : 'false');
      abrir.setAttribute('aria-label', mostrar ? 'Fechar menu' : 'Abrir menu');
    };
    fecharMenu = function () { if (topo.classList.contains('aberto')) trocar(false); };
    abrir.addEventListener('click', function () {
      trocar(!topo.classList.contains('aberto'));
    });
    topo.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') trocar(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && topo.classList.contains('aberto')) { trocar(false); abrir.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!topo.classList.contains('aberto')) return;
      if (topo.contains(e.target)) return;
      trocar(false);
    });
  }

  /* ---- a barra fica transparente sobre a primeira dobra ----
     Sobre a dobra ela não tem fundo: o céu da foto faz esse papel. Passando
     dela, volta a ser branca. A barra NÃO recolhe com a rolagem — fica
     sempre à mostra.

     O limite é o pé do palco, medido uma vez e guardado: pedir
     `getBoundingClientRect()` a cada rolagem obriga o navegador a refazer
     o layout em todo quadro. */
  var palcoDaDobra = document.querySelector('.abertura-palco');
  if (palcoDaDobra && document.querySelector('.topo')) {
    var pePalco = 0;
    var medirPe = function () {
      var y = 0, el = palcoDaDobra;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      pePalco = y + palcoDaDobra.offsetHeight;
    };
    var conferirCeu = function () {
      document.body.classList.toggle('topo-no-ceu', window.pageYOffset < pePalco);
    };
    medirPe(); conferirCeu();
    window.addEventListener('scroll', conferirCeu, { passive: true });
    window.addEventListener('resize', function () { medirPe(); conferirCeu(); });
    window.addEventListener('load', function () { medirPe(); conferirCeu(); });
  }

  /* ---- busca da primeira dobra ----
     Conta antes do clique. A cada mexida ela recalcula, para CADA opção,
     quantas torres sobrariam se você a escolhesse — ignorando o que já
     está escolhido no próprio campo, que é como busca por facetas tem de
     contar. Opção que daria zero apaga, e o botão diz o número que vai
     encontrar. Assim ninguém cai numa lista vazia.

     As 45 fichas vêm embutidas na página, então a conta é local: sem ida
     ao servidor, sem espera, sem estado para sincronizar. */
  var forma = document.querySelector('.busca');
  var fonte = document.getElementById('busca-acervo');
  if (forma && fonte) {
    var acervo = [];
    try { acervo = JSON.parse(fonte.textContent); } catch (e) { acervo = []; }
  }
  if (forma && acervo && acervo.length) {
    var placar = forma.querySelector('[data-busca-contagem]');
    var irPara = forma.querySelector('.busca-ir');

    var escolha = function () {
      var d = new FormData(forma);
      return {
        cidade: d.get('cidade') || '',
        suites: d.getAll('suites').map(Number),
        faixa: d.get('faixa') || '',
        estagio: d.get('estagio') || '',
      };
    };
    var casa = function (t, e, menos) {
      if (menos !== 'cidade' && e.cidade && t.c !== e.cidade) return false;
      if (menos !== 'suites' && e.suites.length &&
          !e.suites.some(function (n) { return t.s.indexOf(n) >= 0; })) return false;
      if (menos !== 'faixa' && e.faixa && t.f !== e.faixa) return false;
      if (menos !== 'estagio' && e.estagio && t.e !== e.estagio) return false;
      return true;
    };
    var conta = function (e, menos, teste) {
      var n = 0;
      for (var i = 0; i < acervo.length; i++) {
        if (casa(acervo[i], e, menos) && (!teste || teste(acervo[i]))) n++;
      }
      return n;
    };

    var atualizar = function () {
      var e = escolha();
      var total = conta(e, null, null);
      if (placar) placar.textContent = frase(total === 1 ? D.verTorre : D.verTorres, total);
      if (irPara) irPara.disabled = total === 0;

      [].forEach.call(forma.querySelectorAll('select[name]'), function (sel) {
        var campo = sel.name;
        [].forEach.call(sel.options, function (op) {
          var rotulo = op.dataset.rotulo || op.textContent;
          if (!op.value) { op.disabled = false; op.textContent = rotulo; return; }
          var n = conta(e, campo, function (t) {
            return campo === 'cidade' ? t.c === op.value
              : campo === 'faixa' ? t.f === op.value
              : t.e === op.value;
          });
          /* Nunca desabilitar o que está selecionado: tirar do ar a opção
             que o leitor acabou de escolher tranca ele na escolha. */
          op.disabled = n === 0 && !op.selected;
          op.textContent = rotulo + (n ? ' (' + n + ')' : '');
        });
      });

      [].forEach.call(forma.querySelectorAll('.busca-ficha'), function (f) {
        var inp = f.querySelector('input');
        var v = Number(inp.value);
        var n = conta(e, 'suites', function (t) { return t.s.indexOf(v) >= 0; });
        if (n === 0) f.setAttribute('data-vazio', ''); else f.removeAttribute('data-vazio');
        inp.disabled = n === 0 && !inp.checked;
        f.title = frase(n === 1 ? D.torre : D.torres, n);
      });
    };

    forma.addEventListener('change', atualizar);
    atualizar();
  }

  /* ---- depoimentos: a frase abre dentro da foto ----
     O botão de verdade é o nome, porque ele tem texto e o teclado alcança.
     A foto só repassa o clique para ele — assim o mouse clica onde é
     natural sem que a leitura de tela ganhe um controle sem nome. */
  var cartoes = document.querySelectorAll('.gente');
  if (cartoes.length) {
    var fechar = function (menos) {
      [].forEach.call(cartoes, function (c) {
        if (c === menos) return;
        c.classList.remove('aberta');
        var b = c.querySelector('.gente-nome');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    };
    [].forEach.call(cartoes, function (c) {
      var botao = c.querySelector('.gente-nome');
      var foto = c.querySelector('.gente-foto');
      if (!botao) return;
      var virar = function () {
        var abre = !c.classList.contains('aberta');
        fechar(c);
        c.classList.toggle('aberta', abre);
        botao.setAttribute('aria-expanded', abre ? 'true' : 'false');
      };
      botao.addEventListener('click', virar);
      if (foto) foto.addEventListener('click', virar);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fechar(null);
    });
  }

  /* ---- leme dos trilhos ----
     Setas que andam um cartão por clique e uma barra que mostra onde se
     está na fila. A barra não é enfeite: num trilho que corre para o lado
     não há como adivinhar quanto falta, e pontinhos só diriam o número de
     itens, não a posição dentro deles.

     A conta usa `scrollWidth`/`clientWidth`, que o navegador já tem — não
     mede cartão por cartão. */
  [].forEach.call(document.querySelectorAll('.trilho-caixa'), function (caixa) {
    var trilho = caixa.querySelector('.trilho');
    var setas = caixa.querySelectorAll('.trilho-seta');
    var progresso = caixa.querySelector('[data-trilho-progresso]');
    if (!trilho) return;

    function largura() {
      var a = trilho.children[0], b = trilho.children[1];
      if (!a) return trilho.clientWidth;
      if (!b) return a.getBoundingClientRect().width;
      return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
    }
    function conferir() {
      var curso = trilho.scrollWidth - trilho.clientWidth;
      [].forEach.call(setas, function (s) {
        var pra = +s.dataset.passo;
        s.disabled = pra < 0 ? trilho.scrollLeft <= 2 : trilho.scrollLeft >= curso - 2;
      });
      if (progresso) {
        /* a largura da barrinha é a fatia visível da fila; a posição é o
           quanto já se andou do que sobra */
        var fatia = Math.max(.12, trilho.clientWidth / trilho.scrollWidth);
        var andado = curso > 0 ? trilho.scrollLeft / curso : 0;
        progresso.style.width = (fatia * 100).toFixed(2) + '%';
        progresso.style.transform = 'translateX(' + (andado * (100 / fatia - 100)).toFixed(2) + '%)';
      }
    }
    [].forEach.call(setas, function (s) {
      s.addEventListener('click', function () {
        /* quem pediu menos movimento não leva a fila deslizando na cara */
        var suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        trilho.scrollBy({ left: +s.dataset.passo * largura(), behavior: suave ? 'smooth' : 'auto' });
      });
    });
    trilho.addEventListener('scroll', conferir, { passive: true });
    window.addEventListener('resize', conferir);
    window.addEventListener('load', conferir);
    conferir();
  });

  /* ---- filmes das dobras ----
     A home tem cinco vídeos somando dezenas de MB. Nenhum deles entra na
     rede antes de a dobra chegar perto: a fonte só é criada aí. Quando a
     dobra sai da tela o vídeo pausa, para não desenhar quadro à toa. */
  var filmes = document.querySelectorAll('.dobra-filme');

  /* Quem pede menos movimento, ou está com economia de dados ligada, não
     recebe vídeo nenhum: nem o do hero, nem os dos projetos. A fonte não
     chega a ser criada, então não há download — e a dobra fica com o
     pôster, que já é a foto. */
  var quietude = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var poupando = navigator.connection && navigator.connection.saveData;

  if (filmes.length && !quietude && !poupando && 'IntersectionObserver' in window) {
    var ligar = function (v) {
      if (v.dataset.ligado) return;
      v.dataset.ligado = '1';
      [['webm', 'video/webm'], ['mp4', 'video/mp4']].forEach(function (par) {
        var url = v.dataset[par[0]];
        if (!url) return;
        var s = document.createElement('source');
        s.src = url; s.type = par[1];
        v.appendChild(s);
      });
      /* o pôster só sai quando houver quadro de verdade; se o vídeo não
         carregar, ele fica, e a dobra continua inteira */
      v.addEventListener('playing', function () { v.setAttribute('data-tocando', ''); }, { once: true });
      v.load();
    };
    var olho = new IntersectionObserver(function (itens) {
      itens.forEach(function (i) {
        if (!i.isIntersecting) { if (i.target.dataset.ligado) i.target.pause(); return; }
        ligar(i.target);
        var p = i.target.play();
        if (p && p.catch) p.catch(function () {});
      });
    }, { rootMargin: '220px 0px' });
    /* O hero traz data-proporcao-min, e a regra sai da geometria, nao
       do tamanho da tela. O master e 2,82:1; com object-fit: cover a
       fatia que sobra do quadro e (largura/altura) / 2,82. A 1,4 de
       proporcao sobra metade do plano, que ainda e um plano:

         1440x900  -> 1,60  57% do quadro   roda
         1366x768  -> 1,78  63%             roda
          820x1100 -> 0,74  26%             nao roda
          390x844  -> 0,46  16%             nao roda

       Abaixo disso a dobra fica com o poster, que e a foto de antes — e
       de quebra nao gasta 3 MB de dados moveis. Um master 16:9 ou
       vertical derruba esta regra. */
    [].forEach.call(filmes, function (v) {
      var minimo = parseFloat(v.getAttribute("data-proporcao-min"));
      if (minimo && (window.innerWidth / window.innerHeight) < minimo) return;
      /* so quem VAI tocar comeca escondido atras do poster; o que nunca
         vai tocar fica visivel desde o inicio, senao a dobra fica preta */
      v.setAttribute("data-vai-tocar", "");
      olho.observe(v);
    });
  }

  /* ---- filtros da listagem ----
     Filtra pelo que o leitor procura de fato: a cidade e se ainda há unidade.
     Os dados vêm em data- no próprio cartão, então não há busca nem rede. */
  var filtros = document.querySelector('[data-filtros]');
  if (filtros) {
    var torres = [].slice.call(document.querySelectorAll('.torre'));
    var contador = document.querySelector('[data-contagem]');
    var vazio = document.querySelector('[data-vazio]');
    var atual = { cidade: 'todas', estado: 'todos' };

    /* A busca da home manda os critérios na própria URL. Suítes, metragem
       e estágio não têm botão aqui, então entram como uma camada extra
       por cima dos filtros da página — e ganham um aviso com saída, para
       o leitor saber por que a lista chegou curta. */
    var url = new URLSearchParams(location.search);
    var veioDaBusca = {
      suites: url.getAll('suites').map(Number),
      faixa: url.get('faixa') || '',
      estagio: url.get('estagio') || '',
    };
    var cidadeNaUrl = url.get('cidade') || '';
    if (cidadeNaUrl) atual.cidade = cidadeNaUrl;

    function aplicar() {
      var n = 0;
      torres.forEach(function (t) {
        var d = t.dataset;
        var mostra = (atual.cidade === 'todas' || d.cidade === atual.cidade)
          && (atual.estado === 'todos' || d.estado === atual.estado)
          && (!veioDaBusca.suites.length || veioDaBusca.suites.some(function (s) {
              return (d.suites || '').split(',').indexOf(String(s)) >= 0;
            }))
          && (!veioDaBusca.faixa || d.faixa === veioDaBusca.faixa)
          && (!veioDaBusca.estagio || d.estagio === veioDaBusca.estagio);
        t.hidden = !mostra;
        if (mostra) n++;
      });
      if (contador) contador.textContent = frase(n === 1 ? D.emp : D.emps, n);
      if (vazio) vazio.hidden = n > 0;
    }

    if (cidadeNaUrl) {
      var alvo = filtros.querySelector('button[data-grupo="cidade"][data-valor="' + cidadeNaUrl + '"]');
      if (alvo) {
        filtros.querySelectorAll('button[data-grupo="cidade"]').forEach(function (o) {
          o.setAttribute('aria-pressed', o === alvo ? 'true' : 'false');
        });
      }
    }
    if (veioDaBusca.suites.length || veioDaBusca.faixa || veioDaBusca.estagio) {
      var ditos = [];
      if (veioDaBusca.suites.length) ditos.push(veioDaBusca.suites.join(' ' + D.ou + ' ') + ' ' + D.suites);
      if (veioDaBusca.faixa) ditos.push(D.faixas[veioDaBusca.faixa] || veioDaBusca.faixa);
      if (veioDaBusca.estagio) ditos.push(veioDaBusca.estagio === 'pronto' ? D.pronto : D.obra);
      var aviso = document.createElement('p');
      aviso.className = 'aviso-busca';
      aviso.innerHTML = D.filtrandoPor + ' ' + ditos.join(' · ') +
        ' <a href="' + location.pathname + '">' + D.limpar + '</a>';
      /* depois da ÚLTIMA fileira de botões, não entre as duas */
      var ultima = document.querySelector('[data-filtros-estado]') || filtros;
      ultima.parentNode.insertBefore(aviso, ultima.nextSibling);
    }

    /* As duas fileiras, e não só a primeira. O ouvinte estava preso a
       `filtros`, que é a fileira das CIDADES; a de estado vive noutro
       elemento ([data-filtros-estado]) e por isso nunca recebeu clique
       nenhum — "Com unidades", "Comercializados" e "Entregues" eram
       botões mortos, que mudavam de aparência sem filtrar nada.

       O aria-pressed também precisa varrer as duas: procurar o grupo
       dentro de uma fileira só deixava a outra com dois botões marcados
       ao mesmo tempo. */
    var fileiras = [filtros, document.querySelector('[data-filtros-estado]')].filter(Boolean);
    fileiras.forEach(function (fila) {
      fila.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-grupo]');
        if (!b) return;
        var grupo = b.dataset.grupo;
        atual[grupo] = b.dataset.valor;
        fileiras.forEach(function (f) {
          f.querySelectorAll('button[data-grupo="' + grupo + '"]').forEach(function (o) {
            o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
          });
        });
        aplicar();
      });
    });
    aplicar();
  }
})();
