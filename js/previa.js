/*
  Prévia dos projetos: em vez de abrir outra aba, a seção de projetos muda de layout.
  Os cards viram uma lista estreita ao lado e o projeto escolhido aparece grande, com a
  tela dele, o texto completo e o botão para abrir. O conteúdo vem do próprio card
  (título, descrição longa, tecnologias e link), então a tradução continua valendo.
*/
(function () {
  var secao = document.getElementById('projetos');
  if (!secao) return;
  var grade = secao.querySelector('.projects-grid');
  var cards = Array.prototype.slice.call(grade.querySelectorAll('.project-card[data-previa]'));
  if (!cards.length) return;
  var calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function t(chave, padrao) {
    var v = window.I18N && window.I18N.t(chave);
    return v == null ? padrao : v;
  }

  // palco: a grade e o painel lado a lado (o painel só aparece no modo prévia)
  var palco = document.createElement('div');
  palco.className = 'previa-palco';
  grade.parentNode.insertBefore(palco, grade);
  palco.appendChild(grade);

  var painel = document.createElement('section');
  painel.className = 'previa';
  painel.id = 'previa';
  painel.setAttribute('aria-live', 'polite');
  painel.hidden = true;
  palco.appendChild(painel);

  var atual = null;
  var voltarPara = null;

  function botao(classe, rotulo, svg) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = classe;
    b.setAttribute('aria-label', rotulo);
    b.title = rotulo;
    b.innerHTML = svg;
    return b;
  }
  var SETA_ESQ = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var SETA_DIR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var XIS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // monta o painel a partir do card (de novo a cada troca de idioma)
  function montar(card) {
    var id = card.getAttribute('data-previa');
    var titulo = card.querySelector('h3').textContent;
    var tag = card.querySelector('.project-tag');
    var desc = card.querySelector('.project-desc');
    var stack = card.querySelector('.tech-stack');
    var link = card.querySelector('.project-links a');
    var href = link ? link.getAttribute('href') : '';

    var topo = document.createElement('div');
    topo.className = 'previa-topo';
    if (tag) topo.appendChild(tag.cloneNode(true));
    var nav = document.createElement('div');
    nav.className = 'previa-nav';
    var ant = botao('previa-bt', t('projects.preview_prev', 'Projeto anterior'), SETA_ESQ);
    var prox = botao('previa-bt', t('projects.preview_next', 'Próximo projeto'), SETA_DIR);
    var fechar = botao('previa-bt previa-fechar', t('projects.preview_close', 'Fechar'), XIS);
    ant.addEventListener('click', function () { andar(-1); });
    prox.addEventListener('click', function () { andar(1); });
    fechar.addEventListener('click', function () { fecharPrevia(); });
    nav.appendChild(ant); nav.appendChild(prox); nav.appendChild(fechar);
    topo.appendChild(nav);

    // a tela do projeto, numa janela de navegador com o endereço de verdade
    var tela = document.createElement('figure');
    tela.className = 'previa-tela';
    var barra = document.createElement('div');
    barra.className = 'previa-barra';
    barra.innerHTML = '<span class="previa-bolinhas" aria-hidden="true"><i></i><i></i><i></i></span>';
    var url = document.createElement('span');
    url.className = 'previa-url';
    url.textContent = /^https?:/.test(href) ? href.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'henrlz.github.io/portfolio-luiz-henrique/' + href.replace(/index\.html$/, '');
    barra.appendChild(url);
    var img = document.createElement('img');
    img.src = 'assets/previas/' + id + '.webp';
    img.width = 1280;
    img.height = 800;
    img.alt = t('projects.preview_shot', 'Tela de') + ' ' + titulo;
    img.decoding = 'async';
    var abrirTela = document.createElement('a');
    abrirTela.href = href;
    abrirTela.target = '_blank';
    abrirTela.rel = 'noopener';
    abrirTela.tabIndex = -1;
    abrirTela.appendChild(img);
    tela.appendChild(barra);
    tela.appendChild(abrirTela);

    var h = document.createElement('h3');
    h.className = 'previa-titulo';
    h.id = 'previaTitulo';
    h.tabIndex = -1;
    h.textContent = titulo;

    var texto = document.createElement('div');
    texto.className = 'previa-texto';
    // a descrição é estática, deste site (a mesma que o i18n já põe com innerHTML)
    texto.innerHTML = desc ? desc.innerHTML : '';

    var acoes = document.createElement('div');
    acoes.className = 'previa-acoes';
    var abrir = document.createElement('a');
    abrir.className = 'btn btn-primary';
    abrir.href = href;
    abrir.target = '_blank';
    abrir.rel = 'noopener';
    abrir.textContent = t('projects.preview_open', 'Abrir o projeto') + ' ↗';
    var dica = document.createElement('span');
    dica.className = 'previa-dica';
    dica.textContent = t('projects.preview_hint', 'Escolha outro projeto na lista ao lado · Esc fecha');
    acoes.appendChild(abrir);
    acoes.appendChild(dica);

    var corpo = document.createElement('div');
    corpo.className = 'previa-corpo';
    corpo.appendChild(h);
    corpo.appendChild(texto);
    if (stack) corpo.appendChild(stack.cloneNode(true));
    corpo.appendChild(acoes);

    var lado = document.createElement('div');
    lado.className = 'previa-lado';
    lado.appendChild(tela);
    lado.appendChild(corpo);

    painel.innerHTML = '';
    painel.setAttribute('aria-labelledby', 'previaTitulo');
    painel.appendChild(topo);
    painel.appendChild(lado);
  }

  // no modo prévia cada card vira um botão do trilho (com o nome para o mouse e o leitor de tela)
  function trilho(ligar) {
    cards.forEach(function (c) {
      var nome = c.querySelector('h3').textContent;
      if (ligar) {
        c.setAttribute('data-nome', nome);
        c.setAttribute('role', 'button');
        c.setAttribute('aria-label', nome);
        c.tabIndex = 0;
      } else {
        c.removeAttribute('data-nome');
        c.removeAttribute('role');
        c.removeAttribute('aria-label');
        c.removeAttribute('tabindex');
      }
    });
  }

  // troca de layout com transição suave quando o navegador sabe fazer (View Transitions).
  // A troca em si acontece num quadro seguinte: quem precisa do layout novo espera a promessa
  function mudar(fn) {
    if (document.startViewTransition && !calmo) {
      var vt = document.startViewTransition(fn);
      // trocar de projeto rápido interrompe a transição anterior: não é erro
      vt.ready.catch(function () {});
      vt.finished.catch(function () {});
      return vt.updateCallbackDone;
    }
    fn();
    return Promise.resolve();
  }

  // "atual" muda na hora (a transição só desenha depois): abrir logo após fechar não se confunde
  function abrirPrevia(card, origem) {
    if (!atual) voltarPara = origem || card.querySelector('.project-previa');
    atual = card;
    mudar(function () {
      cards.forEach(function (c) {
        var ativo = c === card;
        c.classList.toggle('is-ativo', ativo);
        c.classList.add('is-visible');
        if (ativo) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      });
      montar(card);
      trilho(true);
      painel.hidden = false;
      secao.classList.add('is-previewing');
      document.documentElement.classList.add('previa-aberta');
    }).then(function () {
      // leva o painel para a tela e o foco para o título (quem usa leitor de tela ouve o projeto)
      var topoPalco = palco.getBoundingClientRect().top;
      if (window.innerWidth > 800 && (topoPalco < 0 || topoPalco > window.innerHeight * 0.4)) {
        window.scrollTo({ top: window.scrollY + topoPalco - 84, behavior: calmo ? 'auto' : 'smooth' });
      }
      var tit = document.getElementById('previaTitulo');
      if (tit) tit.focus({ preventScroll: true });
    });
    history.replaceState(null, '', '#previa-' + card.getAttribute('data-previa'));
  }

  function fecharPrevia() {
    if (!atual) return;
    var foco = voltarPara;
    atual = null;
    voltarPara = null;
    mudar(function () {
      secao.classList.remove('is-previewing');
      document.documentElement.classList.remove('previa-aberta');
      painel.hidden = true;
      cards.forEach(function (c) { c.classList.remove('is-ativo'); c.removeAttribute('aria-current'); });
      trilho(false);
    }).then(function () { if (foco && !atual) foco.focus(); });
    history.replaceState(null, '', '#projetos');
  }

  function andar(passo) {
    if (!atual) return;
    var i = cards.indexOf(atual);
    abrirPrevia(cards[(i + passo + cards.length) % cards.length]);
  }

  cards.forEach(function (card) {
    card.querySelector('.project-previa').addEventListener('click', function (e) {
      e.stopPropagation();
      abrirPrevia(card, e.currentTarget);
    });
    // no modo prévia o card inteiro vira item da lista
    card.addEventListener('click', function (e) {
      if (!atual || e.target.closest('a')) return;
      abrirPrevia(card);
    });
    card.addEventListener('keydown', function (e) {
      if (!atual || e.target !== card || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      abrirPrevia(card);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (!atual) return;
    if (e.key === 'Escape') { fecharPrevia(); return; }
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); andar(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); andar(-1); }
  });

  // trocou o idioma com a prévia aberta: remonta com os textos novos
  document.addEventListener('i18n:changed', function () { if (atual) { montar(atual); trilho(true); } });

  // link direto para a prévia (#previa-margem)
  var m = /^#previa-([\w-]+)$/.exec(location.hash);
  if (m) {
    var alvo = cards.filter(function (c) { return c.getAttribute('data-previa') === m[1]; })[0];
    if (alvo) abrirPrevia(alvo);
  }

  window.Previa = { abrir: function (id) { abrirPrevia(cards.filter(function (c) { return c.getAttribute('data-previa') === id; })[0]); }, fechar: fecharPrevia };
})();
