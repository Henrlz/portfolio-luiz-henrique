/* Live de demonstração: slides num canvas que vira vídeo, legenda que chega palavra por
   palavra como a automática do YouTube, chat com espectadores e moderador, e a fala do
   final em áudio. A estrutura imita a do player do YouTube para o Taquígrafo ler igual. */

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);

  // ?roteiro=varias: uma live com três palavras-chave (sem a fala gravada)
  const VARIAS = new URLSearchParams(location.search).get('roteiro') === 'varias';
  const FALAS = VARIAS ? [
    [1, 'Boa noite, pessoal. Hoje são três palavras-chave para o certificado, fiquem atentos.'],
    [10, 'A primeira palavra-chave é acolhimento. Repetindo: acolhimento.'],
    [20, 'Acolher é escutar sem julgamento, no tempo do paciente.'],
    [29, 'A segunda palavra-chave é vínculo. De novo: vínculo.'],
    [39, 'Agora a última. A terceira palavra-chave é escuta. Escuta.'],
    [49, 'Obrigada pela presença e até a próxima live.']
  ] : [
    [1, 'Boa noite, pessoal, sejam bem-vindos à nossa live de hoje sobre acolhimento na clínica psicológica.'],
    [9, 'Antes de começar, um aviso: no final eu passo a palavra-chave para o certificado, então fiquem atentos.'],
    [18, 'Acolher não é só receber bem. É criar um espaço em que a pessoa se sinta escutada sem julgamento.'],
    [27, 'Nos primeiros encontros, o mais importante é construir vínculo e combinar o enquadre com clareza.'],
    [36, 'Eu separei três cuidados: escuta atenta, linguagem simples e respeito ao tempo do paciente.'],
    [46, 'Bom, chegamos ao final. A palavra-chave de hoje é acolhimento. Repetindo: acolhimento.'],
    [56, 'Obrigada pela presença e até a próxima live.']
  ];
  const CHAT = VARIAS ? [
    [3, 'Ana Souza', '', 'boa noite!'],
    [15, 'Moderação', 'moderator', '1ª palavra: ACOLHIMENTO'],
    [24, 'Diego', '', 'a palavra chave é empatia'],
    [34, 'Moderação', 'moderator', '2ª palavra: VÍNCULO'],
    [45, 'Moderação', 'moderator', '3ª palavra: ESCUTA'],
    [50, 'Hugo', '', 'obrigado pela live']
  ] : [
    [2, 'Ana Souza', '', 'boa noite!'],
    [5, 'Bruno', '', 'boa noite professora 👋'],
    [12, 'Carla M.', '', 'qual vai ser a palavra?'],
    [21, 'Diego', '', 'a palavra chave é empatia'],
    [31, 'Elisa', '', 'ótima explicação sobre vínculo'],
    [42, 'Fábio', '', 'já tá acabando?'],
    [50, 'Moderação', 'moderator', 'Palavra-chave: ACOLHIMENTO'],
    [52, 'Gabi', '', 'acolhimento!! anotado'],
    [55, 'Hugo', '', 'obrigado pela live']
  ];
  const SLIDES = VARIAS ? [
    [0, 'Três palavras-chave', 'fiquem atentos', []],
    [17, 'O que é acolher?', '', ['Receber sem julgamento', 'Escutar antes de interpretar']],
    [52, 'Obrigada!', 'até a próxima live', []]
  ] : [
    [0, 'Acolhimento na clínica', 'primeiros encontros', []],
    [17, 'O que é acolher?', '', ['Receber sem julgamento', 'Escutar antes de interpretar', 'Construir um espaço seguro']],
    [35, 'Três cuidados', '', ['Escuta atenta', 'Linguagem simples', 'Respeito ao tempo do paciente']],
    [45, 'Palavra-chave', 'ACOLHIMENTO', []],
    [57, 'Obrigada!', 'até a próxima live', []]
  ];
  const FIM = VARIAS ? 56 : 62;
  const PALAVRAS_POR_SEGUNDO = 2.7;

  // as palavras com o instante em que cada uma "chega" na legenda
  const palavras = [];
  FALAS.forEach(([t0, frase]) => frase.split(' ').forEach((p, i) => palavras.push({ t: t0 + i / PALAVRAS_POR_SEGUNDO, p })));

  /* ---------- vídeo: canvas + áudio ---------- */

  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  const g = canvas.getContext('2d');
  const video = $('#video');
  const audio = $('#fala');
  let ctxAudio = null, saidaAlto = null, fonteFala = null;

  function slideEm(t) {
    let s = SLIDES[0];
    SLIDES.forEach((x) => { if (t >= x[0]) s = x; });
    return s;
  }
  let slideDesenhado = null;
  function desenhar(t) {
    const s = slideEm(t);
    if (s === slideDesenhado) return;
    slideDesenhado = s;
    const [, titulo, sub, itens] = s;
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#2b3a28';
    g.fillRect(0, 0, 1280, 18);
    g.fillRect(0, 690, 1280, 30);
    g.fillStyle = '#c8433a';
    g.fillRect(96, 120, 6, 480);
    g.fillStyle = '#1f2a1c';
    const destaque = titulo === 'Palavra-chave';
    g.font = destaque ? '700 72px Arial' : '700 76px Arial';
    g.fillText(titulo, 140, destaque ? 270 : 250);
    if (sub) {
      g.font = destaque ? '700 128px Arial' : '400 48px Arial';
      g.fillStyle = destaque ? '#173b8a' : '#4a5644';
      g.fillText(sub, 140, destaque ? 450 : 330);
    }
    g.font = '400 46px Arial';
    g.fillStyle = '#1f2a1c';
    itens.forEach((it, i) => g.fillText('—  ' + it, 140, 360 + i * 80));
    g.font = '400 26px Arial';
    g.fillStyle = '#e8eedb';
    g.fillText('Live de demonstração · Taquígrafo', 40, 713);
  }

  function prepararVideo() {
    if (video.srcObject) return;
    desenhar(0);
    const stream = canvas.captureStream(15);
    try {
      ctxAudio = new AudioContext();
      fonteFala = ctxAudio.createMediaElementSource(audio);
      const dest = ctxAudio.createMediaStreamDestination();
      fonteFala.connect(dest);
      saidaAlto = ctxAudio.destination;
      if ($('#som').checked) fonteFala.connect(saidaAlto);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    } catch (e) { /* sem áudio: a demonstração segue só com legenda e chat */ }
    video.srcObject = stream;
    video.play().catch(() => {});
  }
  $('#som').addEventListener('change', (e) => {
    if (!fonteFala) return;
    try { if (e.target.checked) fonteFala.connect(saidaAlto); else fonteFala.disconnect(saidaAlto); } catch (err) { /* já estava assim */ }
  });

  /* ---------- legenda: duas linhas que rolam, como a automática ---------- */

  const linhasEl = $('#linhas');
  const cc = $('#botaoCC');
  let linhas = [''];
  function legendaLigada() { return cc.getAttribute('aria-pressed') === 'true'; }
  cc.addEventListener('click', () => {
    cc.setAttribute('aria-pressed', String(!legendaLigada()));
    pintarLegenda();
  });
  function pintarLegenda() {
    $('#legendas').hidden = !legendaLigada() || !linhas.join('').trim();
    linhasEl.replaceChildren(...(legendaLigada() ? linhas.filter(Boolean).slice(-2) : []).map((l) => {
      const linha = document.createElement('span');
      linha.className = 'caption-visual-line';
      const seg = document.createElement('span');
      seg.className = 'ytp-caption-segment';
      seg.textContent = l;
      linha.append(seg);
      return linha;
    }));
  }
  function chegaPalavra(p) {
    const atual = linhas[linhas.length - 1];
    if ((atual + ' ' + p).trim().length > 44) linhas.push(p);
    else linhas[linhas.length - 1] = (atual + ' ' + p).trim();
    if (linhas.length > 2) linhas = linhas.slice(-2);
    pintarLegenda();
  }

  /* ---------- chat ---------- */

  // o chat é montado com elementos, sem HTML em texto: assim a demonstração roda até sob as regras do YouTube
  const chatframe = $('#chatframe');
  function montarChat() {
    const d = chatframe.contentDocument;
    if (!d || d.getElementById('items')) return;
    const estilo = d.createElement('style');
    estilo.textContent = `
      body{margin:0;font:13px/1.4 "Archivo",system-ui,sans-serif;background:#fbfaf5;color:#17171f}
      header{padding:10px 12px;border-bottom:1px solid #e1ddd0;font-weight:600}
      #items{padding:6px 10px;display:flex;flex-direction:column;gap:6px}
      yt-live-chat-text-message-renderer{display:block;animation:entra .3s ease-out}
      #author-name{font-weight:600;color:#56634f;margin-right:6px}
      [author-type="moderator"] #author-name{color:#fff;background:#3a5ba0;padding:0 5px;border-radius:2px}
      [author-type="moderator"] #author-name::after{content:" 🔧"}
      @keyframes entra{from{opacity:0;transform:translateY(6px)}}`;
    d.head.append(estilo);
    const cab = d.createElement('header');
    cab.textContent = 'Chat ao vivo';
    const itens = d.createElement('div');
    itens.id = 'items';
    d.body.append(cab, itens);
  }
  montarChat();
  chatframe.addEventListener('load', montarChat);
  function itensChat() { montarChat(); return chatframe.contentDocument && chatframe.contentDocument.getElementById('items'); }
  function mensagem(autor, papel, texto) {
    const box = itensChat();
    if (!box) return;
    const d = chatframe.contentDocument;
    const m = d.createElement('yt-live-chat-text-message-renderer');
    if (papel) m.setAttribute('author-type', papel);
    const a = d.createElement('span'); a.id = 'author-name'; a.textContent = autor;
    const t = d.createElement('span'); t.id = 'message'; t.textContent = texto;
    m.append(a, t);
    box.append(m);
    while (box.children.length > 30) box.firstChild.remove();
    box.lastChild.scrollIntoView({ block: 'end' });
  }

  /* ---------- relógio da live ---------- */

  let t = 0, velocidade = 1, rodando = false, ultimo = 0, iPalavra = 0, iChat = 0, falaTocou = false;
  const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  function quadro(agora) {
    if (!rodando) return;
    const dt = Math.min(0.25, (agora - ultimo) / 1000);
    ultimo = agora;
    t += dt * velocidade;
    while (iPalavra < palavras.length && palavras[iPalavra].t <= t) chegaPalavra(palavras[iPalavra++].p);
    while (iChat < CHAT.length && CHAT[iChat][0] <= t) { const [, a, p, m] = CHAT[iChat++]; mensagem(a, p, m); }
    if (!falaTocou && t >= 46 && !VARIAS) {
      falaTocou = true;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    desenhar(t);
    $('#tempo').textContent = fmt(t);
    if (t >= FIM) {
      rodando = false;
      linhas = [''];
      pintarLegenda();
      $('#aoVivo').textContent = '■ LIVE ENCERRADA';
      $('#comecar').hidden = false;
      $('#comecar').lastChild.textContent = ' Ver de novo';
      return;
    }
    requestAnimationFrame(quadro);
  }

  function comecar() {
    prepararVideo();
    if (ctxAudio) ctxAudio.resume();
    if (t >= FIM) reiniciar();
    $('#comecar').hidden = true;
    $('#aoVivo').textContent = '● AO VIVO';
    rodando = true;
    ultimo = performance.now();
    requestAnimationFrame(quadro);
  }

  function reiniciar() {
    t = 0; iPalavra = 0; iChat = 0; falaTocou = false; linhas = [''];
    slideDesenhado = null;
    desenhar(0);
    pintarLegenda();
    const box = itensChat();
    if (box) box.replaceChildren();
    audio.pause();
    if (window.Taquigrafo) window.Taquigrafo.limpar();
    $('#tempo').textContent = '0:00';
  }

  $('#comecar').addEventListener('click', comecar);
  $('#recomecar').addEventListener('click', () => { const ia = rodando; rodando = false; reiniciar(); if (ia || video.srcObject) comecar(); });
  document.querySelectorAll('.velocidade [data-v]').forEach((b) => b.addEventListener('click', () => {
    velocidade = +b.dataset.v;
    document.querySelectorAll('.velocidade [data-v]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  }));

  desenhar(0);
  // o pôster é o próprio primeiro slide
  video.poster = canvas.toDataURL('image/png');
  pintarLegenda();

  window.DemoLive = { comecar, reiniciar, get t() { return t; }, set velocidade(v) { velocidade = v; } };
})();
