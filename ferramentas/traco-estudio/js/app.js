(function () {
  'use strict';

  /* ---------------- galeria ---------------- */
  // As "fotos" são placeholders: o objetivo aqui é a interação (filtro,
  // lightbox, teclado), não o acervo.
  var SHOTS = [
    { cat: 'fineline', titulo: 'Ramo de oliveira', nota: 'antebraço · 2 h', ratio: '3 / 4' },
    { cat: 'blackwork', titulo: 'Mancha geométrica', nota: 'ombro · 5 h', ratio: '1 / 1' },
    { cat: 'realismo', titulo: 'Retrato de perfil', nota: 'coxa · 3 sessões', ratio: '3 / 4' },
    { cat: 'lettering', titulo: 'Frase manuscrita', nota: 'costela · 1 h', ratio: '4 / 3' },
    { cat: 'fineline', titulo: 'Constelação', nota: 'costas · 2 h', ratio: '1 / 1' },
    { cat: 'blackwork', titulo: 'Bracelete sólido', nota: 'braço · 4 h', ratio: '3 / 4' },
    { cat: 'realismo', titulo: 'Mão e linha', nota: 'panturrilha · 6 h', ratio: '4 / 3' },
    { cat: 'fineline', titulo: 'Andorinha', nota: 'pulso · 1 h', ratio: '1 / 1' },
    { cat: 'lettering', titulo: 'Inicial em serifa', nota: 'nuca · 40 min', ratio: '3 / 4' },
    { cat: 'blackwork', titulo: 'Preenchimento fechado', nota: 'perna · 2 sessões', ratio: '4 / 3' },
    { cat: 'realismo', titulo: 'Olho em grafite', nota: 'antebraço · 4 h', ratio: '1 / 1' },
    { cat: 'fineline', titulo: 'Linha contínua', nota: 'costas · 3 h', ratio: '3 / 4' }
  ];

  var gallery = document.getElementById('gallery');
  var galleryEmpty = document.getElementById('galleryEmpty');
  var filtroAtual = 'todos';
  var visiveis = [];

  var shotObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.08 })
    : null;

  function renderGallery() {
    visiveis = SHOTS.filter(function (s) {
      return filtroAtual === 'todos' || s.cat === filtroAtual;
    });

    gallery.innerHTML = '';
    visiveis.forEach(function (shot, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shot';
      btn.setAttribute('data-index', String(i));
      btn.setAttribute('aria-label', 'Ampliar ' + shot.titulo);

      var ph = document.createElement('div');
      ph.className = 'ph';
      ph.setAttribute('data-ph', 'sua foto');
      ph.style.aspectRatio = shot.ratio;

      var cap = document.createElement('figcaption');
      cap.innerHTML = '<span>' + shot.titulo + '</span><span class="tag">' + shot.cat + '</span>';

      btn.appendChild(ph);
      btn.appendChild(cap);
      btn.addEventListener('click', function () { abrirLightbox(i); });
      gallery.appendChild(btn);

      if (shotObserver) shotObserver.observe(btn);
      else btn.classList.add('is-in');
    });

    galleryEmpty.hidden = visiveis.length > 0;
  }

  document.querySelectorAll('.filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter').forEach(function (b) {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      filtroAtual = btn.getAttribute('data-filter');
      renderGallery();
    });
  });

  renderGallery();

  /* ---------------- lightbox ---------------- */
  var lightbox = document.getElementById('lightbox');
  var lbImage = document.getElementById('lbImage');
  var lbCaption = document.getElementById('lbCaption');
  var lbClose = document.getElementById('lbClose');
  var lbPrev = document.getElementById('lbPrev');
  var lbNext = document.getElementById('lbNext');
  var lbIndex = 0;
  var ultimoFoco = null;

  function pintarLightbox() {
    var shot = visiveis[lbIndex];
    if (!shot) return;
    lbImage.style.aspectRatio = shot.ratio;
    lbCaption.innerHTML =
      '<span>' + shot.titulo + '</span><span>' + shot.nota + '</span>';
  }

  function abrirLightbox(i) {
    lbIndex = i;
    ultimoFoco = document.activeElement;
    pintarLightbox();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function fecharLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    if (ultimoFoco) ultimoFoco.focus();
  }

  function passar(delta) {
    if (!visiveis.length) return;
    lbIndex = (lbIndex + delta + visiveis.length) % visiveis.length;
    pintarLightbox();
  }

  lbClose.addEventListener('click', fecharLightbox);
  lbPrev.addEventListener('click', function () { passar(-1); });
  lbNext.addEventListener('click', function () { passar(1); });
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) fecharLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') fecharLightbox();
    else if (e.key === 'ArrowLeft') passar(-1);
    else if (e.key === 'ArrowRight') passar(1);
  });

  /* ---------------- menu ---------------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');

  burger.addEventListener('click', function () {
    var aberto = menu.classList.toggle('is-open');
    burger.classList.toggle('is-open', aberto);
    burger.setAttribute('aria-expanded', String(aberto));
    document.body.style.overflow = aberto ? 'hidden' : '';
  });

  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      menu.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  /* ---------------- topo fixo + link ativo ---------------- */
  var topbar = document.getElementById('topbar');
  window.addEventListener('scroll', function () {
    topbar.classList.toggle('is-stuck', window.scrollY > 24);
  }, { passive: true });

  var links = Array.prototype.slice.call(document.querySelectorAll('.menu a'));
  var alvos = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && alvos.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-48% 0px -48% 0px' });
    alvos.forEach(function (s) { navObserver.observe(s); });
  }

  /* ---------------- revelação ---------------- */
  if ('IntersectionObserver' in window) {
    var alvosReveal = document.querySelectorAll(
      '.block-head, .split-art, .split-copy, .steps li, .faq details, .contact-copy, .form, .hero-art'
    );
    alvosReveal.forEach(function (el) { el.classList.add('reveal'); });
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    alvosReveal.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------------- formulário → WhatsApp ---------------- */
  var WHATSAPP = '5519982449452';
  var form = document.getElementById('form');
  var formNote = document.getElementById('formNote');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var campos = ['nome', 'ideia', 'regiao', 'tamanho'];
    var faltando = [];

    campos.forEach(function (id) {
      var input = document.getElementById(id);
      var vazio = !input.value.trim();
      input.closest('.field').classList.toggle('has-error', vazio);
      if (vazio) faltando.push(id);
    });

    if (faltando.length) {
      formNote.textContent = 'Preencha os campos destacados antes de enviar.';
      document.getElementById(faltando[0]).focus();
      return;
    }

    var texto =
      'Oi! Sou ' + document.getElementById('nome').value.trim() + '.\n' +
      'Ideia: ' + document.getElementById('ideia').value.trim() + '\n' +
      'Região: ' + document.getElementById('regiao').value.trim() + '\n' +
      'Tamanho: ' + document.getElementById('tamanho').value.trim();

    formNote.textContent = 'Abrindo o WhatsApp com sua mensagem...';
    window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  });

  form.querySelectorAll('input, textarea').forEach(function (el) {
    el.addEventListener('input', function () {
      el.closest('.field').classList.remove('has-error');
    });
  });

  /* ---------------- aviso de cookies ---------------- */
  var cookie = document.getElementById('cookie');
  var cookieOk = document.getElementById('cookieOk');
  var CHAVE = 'traco:aviso';

  function jaViu() {
    try { return localStorage.getItem(CHAVE) === '1'; } catch (e) { return true; }
  }

  if (!jaViu()) {
    setTimeout(function () { cookie.hidden = false; }, 900);
  }

  cookieOk.addEventListener('click', function () {
    try { localStorage.setItem(CHAVE, '1'); } catch (e) { /* modo privado */ }
    cookie.hidden = true;
  });
})();
