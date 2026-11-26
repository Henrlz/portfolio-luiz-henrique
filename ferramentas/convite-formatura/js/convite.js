// Convite de formatura: pergunta com botão "Não" fujão, "Agora tem!" com
// confete e o convite com contagem regressiva. Sem dependências.
(function () {
  'use strict';

  var EVENTO = {
    inicio: new Date(2026, 11, 20, 20, 0, 0),
    fim: new Date(2026, 11, 21, 0, 30, 0),
    local: 'Estância Árvore da Vida',
    endereco: 'Estrada Estância Árvore da Vida, s/n, Sumaré - SP, 13176-050',
  };
  var CORES = ['#f7d65c', '#9fd8a5', '#8ec9ef', '#f2b8cf', '#ffffff', '#f6a6c1'];
  var calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  function guardar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* ok */ } }
  function ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }

  // ------------------------------------------------------------------
  // Cena 1: letras "escritas" uma a uma
  // ------------------------------------------------------------------
  var n = 0;
  document.querySelectorAll('.pergunta .linha').forEach(function (linha) {
    var texto = linha.getAttribute('data-texto');
    linha.setAttribute('aria-hidden', 'true');
    texto.split('').forEach(function (ch) {
      var s = document.createElement('span');
      if (ch === ' ') { s.className = 'espaco'; } else { s.className = 'letra'; s.textContent = ch; s.style.setProperty('--n', n++); }
      linha.appendChild(s);
    });
  });

  // ------------------------------------------------------------------
  // Granulado caindo no fundo da pergunta
  // ------------------------------------------------------------------
  var tela = $('granulado');
  var ctx = tela.getContext('2d');
  var granulos = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var mouse = { x: 0, y: 0 };

  function ajustarGranulado() {
    tela.width = innerWidth * dpr;
    tela.height = innerHeight * dpr;
    var quantos = Math.round(Math.min(90, (innerWidth * innerHeight) / 14000));
    granulos = [];
    for (var i = 0; i < quantos; i++) granulos.push(novoGranulo(true));
  }
  function novoGranulo(espalhar) {
    return {
      x: Math.random() * innerWidth,
      y: espalhar ? Math.random() * innerHeight : -20,
      vy: 0.25 + Math.random() * 0.55,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.02,
      len: 14 + Math.random() * 12,
      cor: CORES[Math.floor(Math.random() * 5)],
      prof: 0.4 + Math.random() * 0.8,
    };
  }
  var granuladoAtivo = true;
  function desenharGranulado() {
    if (!granuladoAtivo) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.lineCap = 'round';
    granulos.forEach(function (g) {
      if (!calmo) { g.y += g.vy * g.prof; g.a += g.va; }
      if (g.y > innerHeight + 30) Object.assign(g, novoGranulo(false));
      var px = (mouse.x - innerWidth / 2) * 0.012 * g.prof;
      var py = (mouse.y - innerHeight / 2) * 0.012 * g.prof;
      ctx.strokeStyle = g.cor;
      ctx.globalAlpha = 0.55 + g.prof * 0.35;
      ctx.lineWidth = 5 * g.prof + 2;
      ctx.beginPath();
      var dx = Math.cos(g.a) * g.len / 2, dy = Math.sin(g.a) * g.len / 2;
      ctx.moveTo(g.x + px - dx, g.y + py - dy);
      ctx.lineTo(g.x + px + dx, g.y + py + dy);
      ctx.stroke();
    });
    requestAnimationFrame(desenharGranulado);
  }
  addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
  addEventListener('resize', ajustarGranulado);
  ajustarGranulado();
  desenharGranulado();

  // ------------------------------------------------------------------
  // Sem botões: a pergunta fica no ar uns 4 segundos, as letras tremem e
  // explodem em confete, e entra o "Agora tem!".
  // ------------------------------------------------------------------
  var pergunta = $('pergunta');

  // Figurinhas: o mesmo trio vai abaixo da pergunta e do "Agora tem!".
  var modelo = $('tpl-selos');
  document.querySelectorAll('[data-selos]').forEach(function (caixa) { caixa.appendChild(modelo.content.cloneNode(true)); });
  var selosPergunta = document.querySelectorAll('#cena-pergunta .selo');
  var caixaPergunta = document.querySelector('#cena-pergunta [data-selos]');
  var caixaAgora = document.querySelector('#cena-agora [data-selos]');

  // Carregamento: as figurinhas aparecem apagadas e acendem uma por uma;
  // quando a última acende, a tela troca. Tempos em ms desde o início da tela.
  var CARGA_PERGUNTA = { aparecer: 900, acender: [1700, 2550, 3400], fim: 4000 };
  var CARGA_AGORA = { aparecer: 450, acender: [1400, 2700, 4000], fim: 5100 };
  var cargas = [];

  function limparCarga() {
    cargas.forEach(clearTimeout);
    cargas = [];
  }

  function carregarSelos(caixa, tempos, aoTerminar) {
    limparCarga();
    var selos = caixa.querySelectorAll('.selo');
    caixa.classList.remove('visivel');
    selos.forEach(function (s) { s.classList.remove('cheio', 'voando'); });
    cargas.push(setTimeout(function () { caixa.classList.add('visivel'); }, tempos.aparecer));
    tempos.acender.forEach(function (t, i) {
      cargas.push(setTimeout(function () {
        selos[i].classList.add('cheio');
        var r = selos[i].getBoundingClientRect();
        estourar(r.left + r.width / 2, r.top + r.height / 2, 16, 4);
      }, t));
    });
    cargas.push(setTimeout(aoTerminar, tempos.fim));
  }

  function agendarExplosao() {
    carregarSelos(caixaPergunta, CARGA_PERGUNTA, explodirPergunta);
  }

  /** Tremida rápida e as letras voam para todos os lados. */
  function explodirPergunta() {
    if (calmo) { irParaAgora(); return; }
    pergunta.classList.add('tremendo');
    setTimeout(function () {
      pergunta.classList.remove('tremendo');
      Array.prototype.slice.call(pergunta.querySelectorAll('.letra')).concat(Array.prototype.slice.call(selosPergunta)).forEach(function (l) {
        var ang = Math.random() * Math.PI * 2;
        var dist = 40 + Math.random() * 60;
        l.style.setProperty('--fx', (Math.cos(ang) * dist).toFixed(1) + 'vw');
        l.style.setProperty('--fy', (Math.sin(ang) * dist).toFixed(1) + 'vh');
        l.style.setProperty('--fr', ((Math.random() - 0.5) * 720).toFixed(0) + 'deg');
        l.classList.add('voando');
      });
      irParaAgora();
    }, 420);
  }

  // ------------------------------------------------------------------
  // Confete
  // ------------------------------------------------------------------
  var cvs = $('confete');
  var cx = cvs.getContext('2d');
  var pecas = [];
  var rodando = false;
  function ajustarConfete() { cvs.width = innerWidth * dpr; cvs.height = innerHeight * dpr; }
  addEventListener('resize', ajustarConfete);
  ajustarConfete();

  function estourar(x, y, quantos, forca) {
    if (calmo) return;
    for (var i = 0; i < quantos; i++) {
      var ang = Math.random() * Math.PI * 2;
      var vel = (0.4 + Math.random()) * forca;
      pecas.push({
        x: x, y: y,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - forca * 0.55,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        w: 6 + Math.random() * 7, h: 3 + Math.random() * 4,
        cor: CORES[Math.floor(Math.random() * CORES.length)],
        tipo: Math.random() < 0.18 ? 'coracao' : Math.random() < 0.5 ? 'fita' : 'papel',
        vida: 0, max: 160 + Math.random() * 90,
      });
    }
    if (!rodando) { rodando = true; requestAnimationFrame(animarConfete); }
  }
  function chuva(segundos) {
    if (calmo) return;
    var fim = performance.now() + segundos * 1000;
    (function gotejar() {
      for (var i = 0; i < 3; i++) {
        pecas.push({ x: Math.random() * innerWidth, y: -12, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2, r: Math.random() * 3, vr: (Math.random() - 0.5) * 0.2, w: 6 + Math.random() * 7, h: 3 + Math.random() * 4, cor: CORES[Math.floor(Math.random() * CORES.length)], tipo: Math.random() < 0.15 ? 'coracao' : 'papel', vida: 0, max: 400 });
      }
      if (!rodando) { rodando = true; requestAnimationFrame(animarConfete); }
      if (performance.now() < fim) setTimeout(gotejar, 60);
    })();
  }
  function coracao(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.35);
    c.bezierCurveTo(-s, -s * 0.3, -s * 0.45, -s, 0, -s * 0.45);
    c.bezierCurveTo(s * 0.45, -s, s, -s * 0.3, 0, s * 0.35);
    c.fill();
  }
  function animarConfete() {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, innerWidth, innerHeight);
    pecas = pecas.filter(function (p) { return p.vida < p.max && p.y < innerHeight + 40; });
    pecas.forEach(function (p) {
      p.vida++;
      p.vy += 0.12; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx + Math.sin(p.vida / 12) * 0.4; p.y += p.vy; p.r += p.vr;
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.r);
      cx.globalAlpha = Math.min(1, (p.max - p.vida) / 40);
      cx.fillStyle = p.cor;
      if (p.tipo === 'coracao') coracao(cx, 7);
      else if (p.tipo === 'fita') { cx.scale(1, Math.cos(p.vida / 6)); cx.fillRect(-p.w / 2, -1.5, p.w * 1.6, 3); }
      else { cx.scale(Math.cos(p.vida / 8), 1); cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      cx.restore();
    });
    if (pecas.length) requestAnimationFrame(animarConfete); else { rodando = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ------------------------------------------------------------------
  // Troca de cenas
  // ------------------------------------------------------------------
  var cenaPergunta = $('cena-pergunta');
  var cenaAgora = $('cena-agora');
  var cenaConvite = $('cena-convite');

  function mostrar(cena) {
    [cenaPergunta, cenaAgora, cenaConvite].forEach(function (c) {
      var ativa = c === cena;
      c.classList.toggle('ativa', ativa);
      c.setAttribute('aria-hidden', String(!ativa));
    });
  }

  function recortes() {
    var caixa = $('recortes');
    caixa.innerHTML = '';
    if (calmo) return;
    var cores = ['#f8e3d3', '#f3c9cf', '#e88aa8', '#fff3ec', '#d9668c'];
    for (var i = 0; i < 26; i++) {
      var d = document.createElement('span');
      var ang = Math.random() * Math.PI * 2;
      var dist = 32 + Math.random() * 30;
      d.className = 'recorte';
      d.style.cssText = 'left:50%;top:46%;--w:' + (14 + Math.random() * 34) + 'px;--h:' + (10 + Math.random() * 22) + 'px;--cor:' + cores[i % cores.length] +
        ';--dx:' + (Math.cos(ang) * dist) + 'vw;--dy:' + (Math.sin(ang) * dist * 0.8) + 'vh;--r:' + ((Math.random() - 0.5) * 540) + 'deg;--d:' + (0.35 + Math.random() * 0.25) + 's';
      caixa.appendChild(d);
    }
  }

  function irParaAgora() {
    limparCarga();
    var r = pergunta.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    estourar(x, y, 160, 11);
    var cortina = document.createElement('div');
    cortina.className = 'cortina';
    cortina.style.setProperty('--x', x + 'px');
    cortina.style.setProperty('--y', y + 'px');
    document.body.appendChild(cortina);
    requestAnimationFrame(function () { requestAnimationFrame(function () { cortina.classList.add('aberta'); }); });
    setTimeout(function () {
      granuladoAtivo = false;
      recortes();
      mostrar(cenaAgora);
      cortina.remove();
      setTimeout(function () { estourar(innerWidth / 2, innerHeight * 0.42, 140, 11); chuva(3.2); }, 450);
      carregarSelos(caixaAgora, CARGA_AGORA, irParaConvite);
    }, 760);
  }

  function irParaConvite() {
    limparCarga();
    guardar('convite:visto', '1');
    mostrar(cenaConvite);
    document.body.classList.add('no-convite');
    window.scrollTo(0, 0);
    iniciarContagem();
    setTimeout(function () { chuva(1.6); }, 900);
  }

  $('pular').addEventListener('click', irParaConvite);
  if (ler('convite:visto')) $('pular').hidden = false;
  agendarExplosao();

  $('de-novo').addEventListener('click', function () {
    document.body.classList.remove('no-convite');
    mostrar(cenaPergunta);
    document.querySelectorAll('.pergunta .letra, #cena-pergunta .selo').forEach(function (l) {
      l.classList.remove('voando');
      l.style.animation = 'none'; void l.offsetWidth; l.style.animation = '';
    });
    granuladoAtivo = true;
    desenharGranulado();
    agendarExplosao();
  });

  // ------------------------------------------------------------------
  // Convite: contagem, mapa, agenda e imagem
  // ------------------------------------------------------------------
  var relogio = null;
  function iniciarContagem() {
    clearInterval(relogio);
    var ultimo = {};
    function tique() {
      var agora = new Date();
      var falta = EVENTO.inicio - agora;
      var titulo = $('contagem-titulo');
      if (falta <= 0) {
        titulo.textContent = agora < EVENTO.fim ? 'É hoje! Já estou te esperando' : 'Já foi, e foi lindo. Obrigada por estar lá!';
        $('contagem').hidden = true;
        clearInterval(relogio);
        return;
      }
      var s = Math.floor(falta / 1000);
      var v = { dias: Math.floor(s / 86400), horas: Math.floor(s % 86400 / 3600), min: Math.floor(s % 3600 / 60), seg: s % 60 };
      Object.keys(v).forEach(function (k) {
        var el = document.querySelector('[data-u="' + k + '"]');
        var txt = k === 'dias' ? String(v[k]) : String(v[k]).padStart(2, '0');
        if (ultimo[k] !== txt) {
          el.textContent = txt;
          el.classList.remove('virou'); void el.offsetWidth; el.classList.add('virou');
          ultimo[k] = txt;
        }
      });
      titulo.textContent = v.dias === 0 ? 'É hoje! Faltam' : 'Faltam';
    }
    tique();
    relogio = setInterval(tique, 1000);
  }

  $('mapa').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(EVENTO.local + ', Sumaré - SP');

  $('agenda').addEventListener('click', function () {
    var p = function (x) { return String(x).padStart(2, '0'); };
    var f = function (d) { return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + 'T' + p(d.getHours()) + p(d.getMinutes()) + '00'; };
    var agora = new Date();
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//convite-formatura//PT-BR', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:formatura-20261220@convite',
      'DTSTAMP:' + agora.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      'DTSTART;TZID=America/Sao_Paulo:' + f(EVENTO.inicio),
      'DTEND;TZID=America/Sao_Paulo:' + f(EVENTO.fim),
      'SUMMARY:Formatura',
      'DESCRIPTION:Depois de 5 longos anos\\, ela vai se formar! Sua presença é muito importante.',
      'LOCATION:' + EVENTO.local + '\\, ' + EVENTO.endereco.replace(/,/g, '\\,'),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Amanhã tem formatura!', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'formatura-20-12-2026.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    var r = this.getBoundingClientRect();
    estourar(r.left + r.width / 2, r.top, 40, 6);
  });

  var moldura = $('moldura');
  $('ver-imagem').addEventListener('click', function () { moldura.showModal(); });
  $('fechar-moldura').addEventListener('click', function () { moldura.close(); });
  moldura.addEventListener('click', function (e) { if (e.target === moldura) moldura.close(); });
})();
