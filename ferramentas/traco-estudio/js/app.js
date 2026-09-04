(function () {
  'use strict';

  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- carregando ---------------- */
  var carregando = document.getElementById('carregando');
  if (carregando) {
    var esconder = function () { carregando.classList.add('sumiu'); };
    if (document.readyState === 'complete') esconder();
    else window.addEventListener('load', esconder);
    // Se algum recurso travar o load, a página não pode ficar presa atrás
    // do overlay.
    setTimeout(esconder, 6000);
  }

  /* ---------------- folha de flash ---------------- */
  var PECAS = [
    { cat: 'tradicional', nome: 'Andorinha', nota: 'peito · 3 h' },
    { cat: 'blackwork', nome: 'Mancha sólida', nota: 'ombro · 5 h' },
    { cat: 'fineline', nome: 'Ramo de oliveira', nota: 'antebraço · 2 h' },
    { cat: 'lettering', nome: 'Frase manuscrita', nota: 'costela · 1 h' },
    { cat: 'tradicional', nome: 'Âncora', nota: 'panturrilha · 4 h' },
    { cat: 'blackwork', nome: 'Bracelete', nota: 'braço · 4 h' },
    { cat: 'fineline', nome: 'Constelação', nota: 'costas · 2 h' },
    { cat: 'tradicional', nome: 'Rosa clássica', nota: 'antebraço · 3 h' },
    { cat: 'lettering', nome: 'Inicial em serifa', nota: 'nuca · 40 min' },
    { cat: 'blackwork', nome: 'Preenchimento', nota: 'perna · 2 sessões' },
    { cat: 'fineline', nome: 'Linha contínua', nota: 'costas · 3 h' },
    { cat: 'tradicional', nome: 'Punhal', nota: 'coxa · 4 h' }
  ];

  var grid = document.getElementById('grid');
  var vazio = document.getElementById('vazio');
  var filtro = 'todos';
  var naTela = [];

  var obsFlash = 'IntersectionObserver' in window && !reduzido
    ? new IntersectionObserver(function (entradas, obs) {
        entradas.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        });
      }, { threshold: 0.06 })
    : null;

  function numero(i) { return '#' + String(i + 1).padStart(2, '0'); }

  function desenharGrid() {
    naTela = PECAS.filter(function (p) { return filtro === 'todos' || p.cat === filtro; });
    grid.innerHTML = '';

    naTela.forEach(function (peca, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flash';
      btn.setAttribute('aria-label', 'Ampliar ' + peca.nome);

      var wrap = document.createElement('span');
      wrap.className = 'wrap';

      var ph = document.createElement('span');
      ph.className = 'ph';
      ph.setAttribute('data-ph', 'sua foto');

      var num = document.createElement('span');
      num.className = 'ph-num';
      num.textContent = numero(i);
      ph.appendChild(num);
      wrap.appendChild(ph);

      var cap = document.createElement('figcaption');
      cap.innerHTML = '<span>' + peca.nome + '</span><span class="cat">' + peca.cat + '</span>';

      btn.appendChild(wrap);
      btn.appendChild(cap);
      btn.addEventListener('click', function () { abrirLupa(i); });
      grid.appendChild(btn);

      if (obsFlash) obsFlash.observe(btn);
      else btn.classList.add('is-in');
    });

    vazio.hidden = naTela.length > 0;
  }

  document.querySelectorAll('.pick').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.pick').forEach(function (b) {
        b.classList.remove('is-on');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-on');
      btn.setAttribute('aria-selected', 'true');
      filtro = btn.getAttribute('data-filter');
      desenharGrid();
    });
  });

  desenharGrid();

  /* ---------------- lupa ---------------- */
  var lupa = document.getElementById('lupa');
  var lupaNum = document.getElementById('lupaNum');
  var lupaCap = document.getElementById('lupaCap');
  var lupaX = document.getElementById('lupaX');
  var lupaAnt = document.getElementById('lupaAnt');
  var lupaProx = document.getElementById('lupaProx');
  var iLupa = 0;
  var focoAnterior = null;

  function pintarLupa() {
    var peca = naTela[iLupa];
    if (!peca) return;
    lupaNum.textContent = numero(iLupa);
    lupaCap.innerHTML = '<span>' + peca.nome + '</span><span>' + peca.nota + '</span>';
  }

  function abrirLupa(i) {
    iLupa = i;
    focoAnterior = document.activeElement;
    pintarLupa();
    lupa.hidden = false;
    document.body.style.overflow = 'hidden';
    lupaX.focus();
  }

  function fecharLupa() {
    lupa.hidden = true;
    document.body.style.overflow = '';
    if (focoAnterior) focoAnterior.focus();
  }

  function girar(d) {
    if (!naTela.length) return;
    iLupa = (iLupa + d + naTela.length) % naTela.length;
    pintarLupa();
  }

  lupaX.addEventListener('click', fecharLupa);
  lupaAnt.addEventListener('click', function () { girar(-1); });
  lupaProx.addEventListener('click', function () { girar(1); });
  lupa.addEventListener('click', function (e) { if (e.target === lupa) fecharLupa(); });

  document.addEventListener('keydown', function (e) {
    if (lupa.hidden) return;
    if (e.key === 'Escape') fecharLupa();
    else if (e.key === 'ArrowLeft') girar(-1);
    else if (e.key === 'ArrowRight') girar(1);
  });

  /* ---------------- máquina que tatua a linha ---------------- */
  // A máquina fica presa na tela enquanto a seção passa. A altura da tinta é
  // sempre a distância entre o topo da seção e a ponta da agulha, então os
  // dois nunca saem de sincronia — nem em resize, nem em zoom.
  var viva = document.getElementById('numeros');
  var rail = document.getElementById('vivaRail');
  var tinta = document.getElementById('tinta');
  var maq = document.getElementById('maq');
  var dados = Array.prototype.slice.call(document.querySelectorAll('.dado'));
  var pingos = [];

  function montarPingos() {
    pingos.forEach(function (p) { p.remove(); });
    pingos = [];
    var railTop = rail.getBoundingClientRect().top;
    dados.forEach(function (dado) {
      var r = dado.getBoundingClientRect();
      var pingo = document.createElement('span');
      pingo.className = 'pingo';
      pingo.style.top = (r.top + r.height / 2 - railTop) + 'px';
      rail.appendChild(pingo);
      pingos.push(pingo);
    });
  }

  function tatuar() {
    var rRail = rail.getBoundingClientRect();
    var pontaAgulha = maq.getBoundingClientRect().bottom;
    var altura = Math.max(0, Math.min(pontaAgulha - rRail.top, rRail.height));
    tinta.style.height = altura + 'px';

    dados.forEach(function (dado, i) {
      var r = dado.getBoundingClientRect();
      var passou = r.top + r.height / 2 < pontaAgulha;
      dado.classList.toggle('is-on', passou);
      if (pingos[i]) pingos[i].classList.toggle('is-on', passou);
    });
  }

  if (viva && rail && tinta && maq) {
    if (reduzido) {
      // Sem movimento: entrega a linha inteira tatuada e os dados legíveis.
      tinta.style.height = '100%';
      dados.forEach(function (d) { d.classList.add('is-on'); });
      montarPingos();
      pingos.forEach(function (p) { p.classList.add('is-on'); });
    } else {
      var agendado = false;
      var aoRolar = function () {
        if (agendado) return;
        agendado = true;
        window.requestAnimationFrame(function () {
          tatuar();
          agendado = false;
        });
      };
      montarPingos();
      tatuar();
      window.addEventListener('scroll', aoRolar, { passive: true });
      window.addEventListener('resize', function () {
        montarPingos();
        tatuar();
      });
      window.addEventListener('load', function () {
        montarPingos();
        tatuar();
      });
    }
  }

  /* ---------------- menu ---------------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  burger.addEventListener('click', function () {
    var aberto = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(aberto));
    document.body.style.overflow = aberto ? 'hidden' : '';
  });

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  var linksNav = Array.prototype.slice.call(nav.querySelectorAll('a'));
  var secoes = linksNav
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && secoes.length) {
    var obsNav = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        linksNav.forEach(function (a) {
          a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    secoes.forEach(function (s) { obsNav.observe(s); });
  }

  /* ---------------- ficha → WhatsApp ---------------- */
  // Estúdio fictício: sem número real aqui. Vazio faz a ficha mostrar a
  // mensagem montada em vez de abrir uma conversa — basta pôr o número do
  // estúdio para o envio passar a valer.
  var ZAP = '';
  var ficha = document.getElementById('ficha');
  var nota = document.getElementById('nota');

  ficha.addEventListener('submit', function (e) {
    e.preventDefault();

    var ids = ['nome', 'ideia', 'regiao', 'tamanho'];
    var faltando = [];

    ids.forEach(function (id) {
      var campo = document.getElementById(id);
      var vazioCampo = !campo.value.trim();
      campo.closest('.linha').classList.toggle('erro', vazioCampo);
      if (vazioCampo) faltando.push(id);
    });

    if (faltando.length) {
      nota.classList.remove('nota-ok');
      nota.textContent = 'Falta preencher o que está marcado em vermelho.';
      document.getElementById(faltando[0]).focus();
      return;
    }

    var texto =
      'Oi! Sou ' + document.getElementById('nome').value.trim() + '.\n' +
      'Ideia: ' + document.getElementById('ideia').value.trim() + '\n' +
      'Onde: ' + document.getElementById('regiao').value.trim() + '\n' +
      'Tamanho: ' + document.getElementById('tamanho').value.trim();

    if (ZAP) {
      nota.textContent = 'Abrindo o WhatsApp...';
      window.open('https://wa.me/' + ZAP + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
      return;
    }

    nota.classList.add('nota-ok');
    nota.textContent = '';
    var titulo = document.createElement('strong');
    titulo.textContent = 'Mensagem pronta — no estúdio real, isto abre o WhatsApp:';
    var corpo = document.createElement('span');
    corpo.className = 'nota-msg';
    corpo.textContent = texto;
    nota.appendChild(titulo);
    nota.appendChild(corpo);
  });

  ficha.querySelectorAll('input, textarea').forEach(function (campo) {
    campo.addEventListener('input', function () {
      campo.closest('.linha').classList.remove('erro');
    });
  });

  /* ---------------- aviso ---------------- */
  var aviso = document.getElementById('aviso');
  var avisoOk = document.getElementById('avisoOk');
  var CHAVE = 'traco:aviso';

  function jaViu() {
    try { return localStorage.getItem(CHAVE) === '1'; } catch (e) { return true; }
  }

  if (!jaViu()) setTimeout(function () { aviso.hidden = false; }, 900);

  avisoOk.addEventListener('click', function () {
    try { localStorage.setItem(CHAVE, '1'); } catch (e) { /* modo privado */ }
    aviso.hidden = true;
  });
})();
