/*
  Prévia dos projetos: um palco que se abre a partir do clique. O projeto aparece num notebook,
  com o print da página inteira rolando devagar na tela e um brilho na cor do próprio projeto;
  ao lado, número, nome, texto e tecnologias; embaixo, uma película com todos os projetos.
  O conteúdo vem do próprio card (título, descrição longa, tecnologias e link), então a
  tradução continua valendo.
*/
(function () {
  var secao = document.getElementById('projetos');
  if (!secao) return;
  var cards = Array.prototype.slice.call(secao.querySelectorAll('.project-card[data-previa]'));
  if (!cards.length) return;
  var calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raiz = document.documentElement;

  // textos que o i18n.js ainda não tem: ficam aqui, por idioma, para o aviso do leitor de tela e o
  // erro do print não saírem em português no site em inglês (se a chave aparecer no i18n, ela vence)
  var EXTRA = {
    pt: { 'projects.preview_of': 'de', 'projects.preview_error': 'Não deu para carregar a tela deste projeto.' },
    en: { 'projects.preview_of': 'of', 'projects.preview_error': 'Couldn’t load this project’s screen.' },
    es: { 'projects.preview_of': 'de', 'projects.preview_error': 'No se pudo cargar la pantalla de este proyecto.' }
  };

  function t(chave, padrao) {
    var v = window.I18N && window.I18N.t(chave);
    if (v == null) v = (EXTRA[window.I18N && window.I18N.lang] || {})[chave];
    return v == null ? padrao : v;
  }
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function svg(d) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var dois = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------- o palco (montado uma vez) ---------- */

  var palco = el('div', 'palco');
  palco.id = 'previa';
  palco.setAttribute('role', 'dialog');
  palco.setAttribute('aria-modal', 'true');
  palco.setAttribute('aria-labelledby', 'palcoTitulo');
  palco.hidden = true;
  palco.innerHTML =
    '<div class="palco__brilho" aria-hidden="true"></div>' +
    '<div class="palco__grao" aria-hidden="true"></div>' +
    // trocar de projeto muda tudo na tela sem mover o foco: quem usa leitor de tela ouve por aqui
    '<div class="palco__aviso" aria-live="polite" aria-atomic="true"></div>' +
    '<div class="palco__topo">' +
      '<span class="palco__conta"><b class="palco__num"></b><span class="palco__total"></span></span>' +
      '<span class="palco__tag"></span>' +
      '<div class="palco__nav">' +
        '<button type="button" class="palco__bt" data-acao="ant">' + svg('M15 6l-6 6 6 6') + '</button>' +
        '<button type="button" class="palco__bt" data-acao="prox">' + svg('M9 6l6 6-6 6') + '</button>' +
        '<button type="button" class="palco__bt palco__fechar" data-acao="fechar">' + svg('M6 6l12 12M18 6L6 18') + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="palco__miolo">' +
      '<div class="palco__texto">' +
        '<h3 class="palco__titulo" id="palcoTitulo" tabindex="-1"></h3>' +
        '<div class="palco__desc"></div>' +
        '<ul class="palco__stack"></ul>' +
        '<div class="palco__acoes">' +
          '<a class="palco__abrir" target="_blank" rel="noopener"><span></span>' + svg('M7 17L17 7M9 7h8v8') + '</a>' +
          '<span class="palco__dica"></span>' +
        '</div>' +
      '</div>' +
      '<div class="palco__maquina">' +
        '<div class="notebook">' +
          '<div class="notebook__tampa">' +
            '<div class="notebook__barra"><span class="notebook__bolinhas" aria-hidden="true"><i></i><i></i><i></i></span><span class="notebook__url"></span></div>' +
            '<div class="notebook__tela" tabindex="0"><div class="notebook__carrega" aria-hidden="true"><span></span></div><p class="notebook__erro"></p><img alt="" decoding="async"></div>' +
          '</div>' +
          '<div class="notebook__base" aria-hidden="true"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="palco__pelicula" role="tablist"></div>';
  document.body.appendChild(palco);

  var $ = function (s) { return palco.querySelector(s); };
  var tela = $('.notebook__tela'), img = $('.notebook__tela img'), pelicula = $('.palco__pelicula'), aviso = $('.palco__aviso');
  var cabecalho = document.querySelector('.site-header');
  var menuIdioma = document.getElementById('langSwitcher');

  // a película: uma miniatura por projeto
  var quadros = cards.map(function (card, i) {
    var b = el('button', 'quadro');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.innerHTML = '<img src="assets/previas/mini/' + card.getAttribute('data-previa') + '.webp" alt="" loading="lazy" decoding="async"><span class="quadro__num">' + dois(i + 1) + '</span><span class="quadro__nome"></span>';
    b.addEventListener('click', function () { trocar(i); });
    pelicula.appendChild(b);
    return b;
  });

  function rotulos() {
    $('[data-acao="ant"]').setAttribute('aria-label', t('projects.preview_prev', 'Projeto anterior'));
    $('[data-acao="prox"]').setAttribute('aria-label', t('projects.preview_next', 'Próximo projeto'));
    $('[data-acao="fechar"]').setAttribute('aria-label', t('projects.preview_close', 'Fechar'));
    $('.palco__dica').textContent = t('projects.preview_hint', '← → para trocar · Esc fecha');
    pelicula.setAttribute('aria-label', t('projects.title', 'Projetos'));
    quadros.forEach(function (q, i) { q.querySelector('.quadro__nome').textContent = cards[i].querySelector('h3').textContent; });
  }

  /* ---------- mostrar um projeto ---------- */

  var atual = -1, voltarPara = null, rolagem = null, fechando = null, focarDepois = null, mediuTravado = false;

  // aberto "de verdade": visível e não no meio da animação de fechar
  function aberto() { return !palco.hidden && !palco.classList.contains('is-fechando'); }

  function preencher(i) {
    var card = cards[i];
    var id = card.getAttribute('data-previa');
    var titulo = card.querySelector('h3').textContent;
    var tag = card.querySelector('.project-tag');
    var desc = card.querySelector('.project-desc');
    var link = card.querySelector('.project-links a');
    var href = link ? link.getAttribute('href') : '';

    $('.palco__num').textContent = dois(i + 1);
    $('.palco__total').textContent = ' / ' + dois(cards.length);
    $('.palco__tag').textContent = tag ? tag.textContent : '';
    $('.palco__titulo').textContent = titulo;
    // a descrição é estática, deste site (a mesma que o i18n já põe com innerHTML)
    $('.palco__desc').innerHTML = desc ? desc.innerHTML : '';
    var stack = $('.palco__stack');
    stack.innerHTML = '';
    card.querySelectorAll('.tech-stack li').forEach(function (li, k) {
      var c = el('li', null, li.textContent);
      c.style.setProperty('--k', k);
      stack.appendChild(c);
    });
    var abrir = $('.palco__abrir');
    abrir.href = href;
    abrir.querySelector('span').textContent = t('projects.preview_open', 'Abrir o projeto');
    $('.notebook__url').textContent = /^https?:/.test(href) ? href.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'henrlz.github.io/portfolio-luiz-henrique/' + href.replace(/index\.html$/, '');

    // a tela: carrega o print da página inteira e começa a rolar sozinha
    pararRolagem();
    tela.scrollTop = 0;
    tela.classList.remove('is-erro');
    tela.classList.add('is-carregando');
    img.alt = t('projects.preview_shot', 'Tela de') + ' ' + titulo;
    img.onload = function () {
      tela.classList.remove('is-carregando');
      // o print pode chegar depois de a pessoa fechar (ou durante a animação de fechar): aí não
      // liga a rolagem, senão o laço de quadros seguiria rodando com o palco escondido
      if (!aberto()) return;
      corDoProjeto();
      rolarSozinha();
    };
    // sem o print (rede caiu, arquivo faltando): tira o esqueleto piscando e diz o que houve
    img.onerror = function () {
      tela.classList.remove('is-carregando');
      tela.classList.add('is-erro');
      $('.notebook__erro').textContent = t('projects.preview_error', 'Não deu para carregar a tela deste projeto.');
    };
    img.src = 'assets/previas/' + id + '.webp';

    quadros.forEach(function (q, k) {
      var sim = k === i;
      q.classList.toggle('is-ativo', sim);
      q.setAttribute('aria-selected', String(sim));
      q.tabIndex = sim ? 0 : -1;
    });
    var q = quadros[i];
    pelicula.scrollTo({ left: q.offsetLeft - pelicula.clientWidth / 2 + q.clientWidth / 2, behavior: calmo ? 'auto' : 'smooth' });
  }

  // troca de projeto: o texto sai, entra o novo (em cascata) e a tela desliza para o lado
  function mostrar(i, sentido) {
    if (i === atual) return;
    var dir = sentido || (i > atual ? 1 : -1);
    atual = (i + cards.length) % cards.length;
    palco.style.setProperty('--dir', dir);
    palco.classList.remove('is-trocando');
    void palco.offsetWidth;
    palco.classList.add('is-trocando');
    preencher(atual);
    history.replaceState(null, '', '#previa-' + cards[atual].getAttribute('data-previa'));
  }

  // troca pedida pela pessoa (setas, botões, película, dedo): além de mostrar, avisa o leitor de
  // tela ("4 de 10: Cedro Decor") e, se o foco estava na película, leva o foco junto para o quadro
  // novo (tabindex móvel: só o quadro ativo fica no Tab, então o foco não pode ficar no antigo)
  function trocar(i, sentido) {
    if (!aberto()) return;
    i = (i + cards.length) % cards.length;
    if (i === atual) return;
    var naPelicula = quadros.indexOf(document.activeElement) >= 0;
    mostrar(i, sentido);
    aviso.textContent = (atual + 1) + ' ' + t('projects.preview_of', 'de') + ' ' + cards.length + ': ' + cards[atual].querySelector('h3').textContent;
    if (naPelicula) quadros[atual].focus({ preventScroll: true });
  }

  // o brilho atrás do notebook tem a cor do projeto: a média das cores mais vivas do print
  function corDoProjeto() {
    try {
      var c = document.createElement('canvas');
      c.width = 40; c.height = 25;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, img.naturalWidth, Math.min(img.naturalHeight, img.naturalWidth * 0.625), 0, 0, 40, 25);
      var d = g.getImageData(0, 0, 40, 25).data;
      var r = 0, gg = 0, b = 0, peso = 0;
      for (var k = 0; k < d.length; k += 4) {
        var mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]);
        var w = (mx - mn) / 255 + 0.02;
        r += d[k] * w; gg += d[k + 1] * w; b += d[k + 2] * w; peso += w;
      }
      palco.style.setProperty('--cor', 'rgb(' + Math.round(r / peso) + ',' + Math.round(gg / peso) + ',' + Math.round(b / peso) + ')');
    } catch (e) { /* sem cor: fica o brilho padrão */ }
  }

  // a tela rola devagar até o fim, espera e volta; se a pessoa mexer, para e deixa com ela
  function rolarSozinha() {
    pararRolagem();
    if (calmo || !aberto()) return;
    var inicio = null, espera = 1400;
    var max = tela.scrollHeight - tela.clientHeight;
    if (max < 40) return;
    var dur = Math.min(26000, Math.max(6000, max * 9));
    function passo(agora) {
      if (inicio == null) inicio = agora;
      var p = (agora - inicio - espera) / dur;
      if (p >= 0) {
        var ida = p % 2, x = ida <= 1 ? ida : 2 - ida;
        tela.scrollTop = max * (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
      }
      rolagem = requestAnimationFrame(passo);
    }
    rolagem = requestAnimationFrame(passo);
  }
  function pararRolagem() { if (rolagem) cancelAnimationFrame(rolagem); rolagem = null; }
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { tela.addEventListener(ev, pararRolagem, { passive: true }); });

  /* ---------- abrir e fechar ---------- */

  // o palco trava a rolagem da página (html.palco-aberto). O CSS reserva o lugar da barra de rolagem
  // para o site não se reorganizar atrás do palco; mesmo assim, se a janela mudar de tamanho com ele
  // aberto, o site se mede de novo (o canvas do topo, a linha do tempo) e, onde não houver esse
  // lugar reservado, a barra que volta ao destravar não dispara resize: então avisamos nós
  window.addEventListener('resize', function () { if (raiz.classList.contains('palco-aberto')) mediuTravado = true; });
  function destravar() {
    if (!raiz.classList.contains('palco-aberto')) return;
    raiz.classList.remove('palco-aberto');
    if (mediuTravado) {
      mediuTravado = false;
      window.dispatchEvent(new Event('resize'));
    }
  }

  function abrir(i, origem, x, y) {
    // abrir de novo no meio do fechamento: o fim daquele fechamento não pode esconder este palco
    clearTimeout(fechando);
    clearTimeout(focarDepois);
    fechando = null;
    voltarPara = origem || null;
    rotulos();
    atual = -1;
    aviso.textContent = '';
    // o círculo nasce no ponto do clique; se o botão estiver fora da tela (link direto), nasce
    // dentro dela, senão o palco abriria todo recortado
    var r = origem && origem.getBoundingClientRect ? origem.getBoundingClientRect() : null;
    var cx = x != null ? x : r ? r.left + r.width / 2 : innerWidth / 2;
    var cy = y != null ? y : r ? r.top + r.height / 2 : innerHeight / 2;
    palco.style.setProperty('--x', Math.min(Math.max(cx, 0), innerWidth) + 'px');
    palco.style.setProperty('--y', Math.min(Math.max(cy, 0), innerHeight) + 'px');
    palco.hidden = false;
    raiz.classList.add('palco-aberto');
    mostrar(i, 1);
    // o palco se abre a partir do clique
    palco.classList.remove('is-fechando');
    void palco.offsetWidth;
    palco.classList.add('is-abrindo');
    // o foco vai para o título (quem usa leitor de tela ouve o projeto); de novo ao fim da abertura
    var focar = function () { if (aberto() && !palco.contains(document.activeElement)) $('.palco__titulo').focus({ preventScroll: true }); };
    focar();
    focarDepois = setTimeout(focar, calmo ? 0 : 650);
  }

  // devolve o foco a quem abriu. Se esse botão está fora da tela (prévia aberta por link direto) ou
  // escondido atrás do topo fixo, a página rola até ele antes: só com preventScroll o foco iria
  // para um lugar que ninguém vê. Se ele já está à vista, a página não se mexe
  function devolverFoco(alvo) {
    var r = alvo.getBoundingClientRect();
    var topo = cabecalho ? cabecalho.getBoundingClientRect().bottom : 0;
    if (r.top < topo || r.bottom > innerHeight) alvo.scrollIntoView({ block: 'center' });
    alvo.focus({ preventScroll: true });
  }

  // navegando = fechou porque a pessoa clicou num link do topo do site: a página destrava na hora
  // (a rolagem até a seção acontece com o site já solto) e o foco fica com o link, sem voltar ao card
  // (vale também se o link for clicado no meio da animação de fechar)
  function fechar(navegando) {
    if (palco.hidden) return;
    if (navegando) { destravar(); voltarPara = null; }
    if (palco.classList.contains('is-fechando')) return;
    pararRolagem();
    clearTimeout(focarDepois);
    palco.classList.remove('is-abrindo');
    palco.classList.add('is-fechando');
    var fim = function () {
      fechando = null;
      palco.hidden = true;
      palco.classList.remove('is-fechando', 'is-trocando');
      destravar();
      atual = -1;
      if (voltarPara) devolverFoco(voltarPara);
    };
    // o endereço volta para #projetos antes de qualquer navegação: se foi um link do topo, o
    // endereço novo (#contato...) entra por cima deste, e não o contrário
    history.replaceState(null, '', '#projetos');
    if (calmo) fim(); else fechando = setTimeout(fim, 420);
  }

  cards.forEach(function (card, i) {
    card.querySelector('.project-previa').addEventListener('click', function (e) {
      abrir(i, e.currentTarget, e.clientX || null, e.clientY || null);
    });
  });

  palco.addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao]');
    if (!b) return;
    var acao = b.getAttribute('data-acao');
    if (acao === 'fechar') fechar();
    if (acao === 'ant') trocar(atual - 1, -1);
    if (acao === 'prox') trocar(atual + 1, 1);
  });

  // no computador o topo do site fica por cima do palco e continua clicável: um link de lá
  // (Início, Contato, o logo) fecha o palco antes de o navegador seguir o link. Ctrl/Shift/meio
  // abrem outra aba, então o palco fica. Na fase de captura, para rodar antes de tudo
  document.addEventListener('click', function (e) {
    if (palco.hidden || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (e.target.closest && e.target.closest('.site-header a[href], #nav a[href]')) fechar(true);
  }, true);

  // na fase de captura: o seletor de idioma também fecha com Esc (e na fase normal ele já teria
  // fechado antes de olharmos, e o mesmo Esc fecharia o palco junto)
  document.addEventListener('keydown', function (e) {
    // fechado, ou fechando: as teclas são do site (e uma seta no meio da animação trocaria um palco que está sumindo)
    if (!aberto()) return;
    if (e.key === 'Escape') {
      // com o menu de idiomas aberto, o Esc é dele: fecha só o menu
      if (menuIdioma && menuIdioma.classList.contains('is-open')) return;
      e.preventDefault();
      fechar();
      return;
    }
    // Alt+← é "voltar" do navegador; não é nosso
    var livre = !e.altKey && !e.ctrlKey && !e.metaKey;
    if (e.key === 'ArrowRight' && livre) { e.preventDefault(); trocar(atual + 1, 1); }
    if (e.key === 'ArrowLeft' && livre) { e.preventDefault(); trocar(atual - 1, -1); }
    // o foco não sai do palco enquanto ele está aberto. Só conta o que o Tab alcança de verdade:
    // visível e com tabIndex >= 0 (os quadros inativos da película têm -1 pelo tabindex móvel;
    // contando com eles, o "último" era um quadro que o Tab nunca visita e o foco escapava)
    if (e.key === 'Tab') {
      var foco = Array.prototype.filter.call(palco.querySelectorAll('button, a[href], [tabindex]'), function (x) {
        return x.tabIndex >= 0 && !x.disabled && x.offsetParent !== null;
      });
      if (!foco.length) return;
      var primeiro = foco[0], ultimo = foco[foco.length - 1];
      if (!palco.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? ultimo : primeiro).focus(); }
      else if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  }, true);

  // deslizar o dedo na tela do notebook troca de projeto (no celular)
  // (o último ponto vem do touchmove: se o navegador cancelar o toque, ainda dá para saber o gesto)
  var toque = null, ultimoToque = null;
  var maquina = palco.querySelector('.palco__maquina');
  maquina.addEventListener('touchstart', function (e) { toque = ultimoToque = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
  maquina.addEventListener('touchmove', function (e) { ultimoToque = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
  function fimDoToque() {
    if (!toque) return;
    var dx = ultimoToque[0] - toque[0], dy = ultimoToque[1] - toque[1];
    toque = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) trocar(atual + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  }
  maquina.addEventListener('touchend', fimDoToque, { passive: true });
  maquina.addEventListener('touchcancel', fimDoToque, { passive: true });

  // trocou o idioma com o palco aberto: remonta com os textos novos
  document.addEventListener('i18n:changed', function () {
    if (!aberto()) return;
    rotulos();
    var i = atual;
    atual = -1;
    mostrar(i, 1);
  });

  // link direto para a prévia (#previa-margem)
  var m = /^#previa-([\w-]+)$/.exec(location.hash);
  if (m) {
    var k = cards.map(function (c) { return c.getAttribute('data-previa'); }).indexOf(m[1]);
    if (k >= 0) abrir(k, cards[k].querySelector('.project-previa'));
  }

  window.Previa = {
    abrir: function (id) { var k = cards.map(function (c) { return c.getAttribute('data-previa'); }).indexOf(id); if (k >= 0) abrir(k, cards[k].querySelector('.project-previa')); },
    fechar: function () { fechar(); },
    get atual() { return atual >= 0 ? cards[atual].getAttribute('data-previa') : null; }
  };
})();
