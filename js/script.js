(function () {
  var root = document.documentElement;
  var themeToggle = document.getElementById('themeToggle');
  var stored = localStorage.getItem('theme');
  if (stored) root.setAttribute('data-theme', stored);

  themeToggle.addEventListener('click', function () {
    var current = root.getAttribute('data-theme') === 'dark' ? 'dark' :
      (root.getAttribute('data-theme') === 'light' ? 'light' :
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  var cookieBanner = document.getElementById('cookieBanner');
  var cookieAccept = document.getElementById('cookieAccept');
  if (cookieBanner && cookieAccept) {
    if (!localStorage.getItem('cookieConsent')) {
      setTimeout(function () { cookieBanner.classList.add('show'); }, 500);
    }
    cookieAccept.addEventListener('click', function () {
      localStorage.setItem('cookieConsent', '1');
      cookieBanner.classList.remove('show');
    });
  }

  document.querySelectorAll('.hero-actions .btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var href = btn.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      var settleTimer;
      var done = false;

      function reveal() {
        if (done) return;
        done = true;
        window.removeEventListener('scroll', onScroll);

        var heading = target.querySelector('.section-title');
        if (heading) {
          heading.classList.remove('flash-highlight');
          void heading.offsetWidth;
          heading.classList.add('flash-highlight');
          setTimeout(function () {
            heading.classList.remove('flash-highlight');
          }, 700);
        }
      }

      function onScroll() {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(reveal, 120);
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    });
  });

  var navToggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');
  var navOverlay = document.getElementById('navOverlay');

  function closeNav() {
    nav.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    if (navOverlay) navOverlay.classList.remove('is-open');
  }

  navToggle.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    if (navOverlay) navOverlay.classList.toggle('is-open', isOpen);
  });

  if (navOverlay) navOverlay.addEventListener('click', closeNav);

  nav.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var id = '#' + entry.target.id;
      var link = navLinks.find(function (l) { return l.getAttribute('href') === id; });
      if (!link) return;
      if (entry.isIntersecting) {
        navLinks.forEach(function (l) { l.classList.remove('active'); });
        link.classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px' });

  sections.forEach(function (section) { sectionObserver.observe(section); });

  var revealTargets = document.querySelectorAll(
    '.about-content, .skill-card, .timeline-item, .project-card, .contact-card'
  );
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  var revealObserver = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealTargets.forEach(function (el) { revealObserver.observe(el); });

  var timeline = document.getElementById('timeline');
  var timelineProgress = document.getElementById('timelineProgress');
  var ticking = false;

  function updateTimelineProgress() {
    var rect = timeline.getBoundingClientRect();
    var viewportH = window.innerHeight;
    var progress = (viewportH - rect.top) / (rect.height + viewportH * 0.5);
    progress = Math.max(0, Math.min(1, progress));
    timelineProgress.style.height = (progress * 100) + '%';
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(updateTimelineProgress);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', updateTimelineProgress);
  updateTimelineProgress();

  document.getElementById('year').textContent = new Date().getFullYear();

  var FALLBACK_ROLES = [
    'Desenvolvedor Web',
    'Inteligência Artificial',
    'Web Design',
    'Automação de Processos',
    'Desenvolvedor de Sistemas'
  ];
  var roles = (window.I18N && window.I18N.roles()) || FALLBACK_ROLES;
  var typewriterEl = document.getElementById('typewriter');
  var roleIndex = 0;
  var charIndex = 0;
  var deleting = false;

  // Ao trocar de idioma, recomeça a digitação com a lista traduzida.
  document.addEventListener('i18n:changed', function () {
    roles = (window.I18N && window.I18N.roles()) || FALLBACK_ROLES;
    roleIndex = 0;
    charIndex = 0;
    deleting = false;
    // Limpa na hora: sem isso a palavra do idioma anterior fica na tela até o
    // próximo tick, que pode demorar a pausa inteira de 1,5s.
    typewriterEl.textContent = '';
  });

  function typeLoop() {
    var current = roles[roleIndex];
    var delay;

    if (!deleting) {
      charIndex++;
      typewriterEl.textContent = current.slice(0, charIndex);
      delay = 85;
      if (charIndex === current.length) {
        deleting = true;
        delay = 1500;
      }
    } else {
      charIndex--;
      typewriterEl.textContent = current.slice(0, charIndex);
      delay = 40;
      if (charIndex === 0) {
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        delay = 300;
      }
    }

    setTimeout(typeLoop, delay);
  }

  typeLoop();

  var canvas = document.getElementById('heroCanvas');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var heroSection = canvas.parentElement;
    var mouse = { x: -9999, y: -9999 };
    var W = 0, H = 0;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var points = [];
    var spacing = 34;
    var influenceRadius = 170;

    function getDotColors() {
      var cs = getComputedStyle(document.documentElement);
      return {
        dot: (cs.getPropertyValue('--dot-color') || '120,120,120').trim(),
        active: (cs.getPropertyValue('--dot-color-active') || '9,105,218').trim()
      };
    }
    var colors = getDotColors();

    function buildPoints() {
      points = [];
      var cols = Math.ceil(W / spacing) + 1;
      var rows = Math.ceil(H / spacing) + 1;
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          points.push({ ox: i * spacing, oy: j * spacing });
        }
      }
    }

    function resizeCanvas() {
      var rect = heroSection.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildPoints();
    }

    var isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    if (!isTouchDevice) {
      heroSection.addEventListener('mousemove', function (e) {
        var rect = heroSection.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      });

      heroSection.addEventListener('mouseleave', function () {
        mouse.x = -9999;
        mouse.y = -9999;
      });
    }

    var t = 0;
    function drawDots() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      if (isTouchDevice) {
        mouse.x = W / 2 + Math.cos(t * 0.35) * W * 0.42;
        mouse.y = H / 2 + Math.sin(t * 0.55) * H * 0.32;
      }

      for (var k = 0; k < points.length; k++) {
        var p = points[k];
        var dx = p.ox - mouse.x;
        var dy = p.oy - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        var idle = Math.sin(t * 0.6 + p.ox * 0.02 + p.oy * 0.02) * 1.5;

        var proximity = 0;
        var px = 0, py = 0;
        if (dist < influenceRadius) {
          proximity = 1 - dist / influenceRadius;
          var angle = Math.atan2(dy, dx);
          var wave = Math.sin(dist * 0.05 - t * 3) * proximity * 9;
          px = Math.cos(angle) * wave;
          py = Math.sin(angle) * wave;
        }

        var radius = 1.2 + proximity * 1.8;
        var alpha = 0.32 + proximity * 0.68;
        var color = proximity > 0.06 ? colors.active : colors.dot;

        ctx.beginPath();
        ctx.arc(p.ox + px, p.oy + idle + py, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + color + ', ' + alpha + ')';
        ctx.fill();
      }

      requestAnimationFrame(drawDots);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(drawDots);

    themeToggle.addEventListener('click', function () {
      setTimeout(function () { colors = getDotColors(); }, 50);
    });
  }
})();
