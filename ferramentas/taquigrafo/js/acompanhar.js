/* Modo link: a live abre num iframe com a legenda forçada, a pessoa compartilha esta aba
   e a página lê a própria imagem (legenda e slides, com Tesseract) e o próprio som (Vosk).
   O chat, se houver chave, vem da API gratuita do YouTube. As regras de anotar são as
   mesmas do script do Tampermonkey (TaquigrafoNucleo). */

(function () {
  'use strict';

  const N = window.TaquigrafoNucleo;
  const $ = (s) => document.querySelector(s);
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const VOSK = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
  const MODELO_PT = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-pt-0.3.tar.gz';
  const API = 'https://www.googleapis.com/youtube/v3/';

  const guardar = (k, v) => { try { localStorage.setItem('taquigrafo:' + k, JSON.stringify(v)); } catch (e) { /* segue */ } };
  const ler = (k, p) => { try { const s = localStorage.getItem('taquigrafo:' + k); return s ? JSON.parse(s) : p; } catch (e) { return p; } };
  const hora = () => new Date().toLocaleTimeString('pt-BR');

  const estado = {
    id: null,
    rodando: false,
    fontes: { legenda: 'parada', voz: 'desligada', tela: 'desligada', chat: 'sem chave' }
  };
  const legenda = new N.Transcricao();
  const vozTexto = new N.Transcricao();
  let chat = new N.Chat();
  const caderno = new N.Caderno({
    hora,
    aoNovo: (nota) => {
      salvar();
      bipe(nota.tipo === 'palavra');
      if (nota.tipo === 'palavra') notificar(nota);
      pintarNotas(nota);
    },
    aoMudar: () => { salvar(); pintarNotas(); }
  });
  const salvar = () => estado.id && guardar('notas:' + estado.id, caderno.notas.slice(-60));

  /* ---------- link → ID do vídeo ---------- */

  function idDoLink(txt) {
    const s = String(txt).trim();
    if (/^[\w-]{11}$/.test(s)) return { id: s };
    let u;
    try { u = new URL(/^https?:/i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return { id: u.pathname.slice(1, 12) };
    if (!/(^|\.)youtube\.com$/.test(host) && host !== 'youtube-nocookie.com') return null;
    if (u.searchParams.get('v')) return { id: u.searchParams.get('v').slice(0, 11) };
    const m = u.pathname.match(/\/(?:live|embed|shorts|v)\/([\w-]{11})/);
    if (m) return { id: m[1] };
    const canal = u.pathname.match(/^\/(@[\w.-]+)(?:\/live|\/streams)?\/?$/);
    if (canal) return { canal: canal[1] };
    return null;
  }

  async function api(caminho, params) {
    const chave = $('#chave').value.trim();
    const q = new URLSearchParams({ ...params, key: chave });
    const r = await fetch(API + caminho + '?' + q);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const motivo = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || r.status;
      throw new Error({ quotaExceeded: 'a cota grátis do dia acabou', keyInvalid: 'chave inválida', forbidden: 'o canal não libera o chat pela API', liveChatEnded: 'o chat terminou', liveChatNotFound: 'esta live não tem chat' }[motivo] || 'erro da API (' + motivo + ')');
    }
    return j;
  }

  // link de canal (/@canal/live): só dá para achar a live atual com a API
  async function liveDoCanal(handle) {
    const c = await api('channels', { part: 'id', forHandle: handle });
    const canal = c.items && c.items[0] && c.items[0].id;
    if (!canal) throw new Error('canal não encontrado');
    const b = await api('search', { part: 'id', channelId: canal, eventType: 'live', type: 'video', maxResults: 1 });
    const v = b.items && b.items[0] && b.items[0].id && b.items[0].id.videoId;
    if (!v) throw new Error('esse canal não está ao vivo agora');
    return v;
  }

  /* ---------- abrir ---------- */

  const avisoLink = (msg) => { $('#avisoLink').hidden = !msg; $('#avisoLink').textContent = msg || ''; };

  function abrirEmbed(id, src) {
    parar();
    estado.id = id;
    caderno.notas = ler('notas:' + id, []);
    caderno.marcas.clear();
    caderno.janela = null;
    legenda.palavras = []; legenda.cortadas = 0;
    vozTexto.palavras = []; vozTexto.cortadas = 0;
    chat = new N.Chat();
    $('#player').src = src;
    $('#palco').hidden = false;
    estado.fontes.legenda = 'parada';
    pintarLuzes();
    pintarNotas();
    $('#palco').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#formLink').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    avisoLink('');
    const r = idDoLink($('#link').value);
    if (!r) { avisoLink('Não reconheci esse link. Cole o endereço do vídeo da live (youtube.com/watch?v=… ou youtu.be/…).'); return; }
    let id = r.id;
    if (r.canal) {
      if (!$('#chave').value.trim()) { avisoLink('Link de canal só funciona com a chave da API. Abra a live e copie o link do vídeo (watch?v=…), ou cole sua chave abaixo.'); $('#chaveApi').open = true; return; }
      try { id = await liveDoCanal(r.canal); } catch (e) { avisoLink('Não deu: ' + e.message + '.'); return; }
    }
    // legenda forçada (cc_load_policy) em português; o resto é o player normal
    abrirEmbed(id, `https://www.youtube.com/embed/${id}?autoplay=1&cc_load_policy=1&cc_lang_pref=pt&hl=pt-BR&rel=0&playsinline=1`);
  });
  $('#usarDemo').addEventListener('click', () => abrirEmbed('demonstracao', 'live-demo.html' + (window.__TAQUIGRAFO_DEMO_VEL ? '?v=' + window.__TAQUIGRAFO_DEMO_VEL : '')));
  $('#chave').value = ler('chave', '');
  $('#chave').addEventListener('change', () => guardar('chave', $('#chave').value.trim()));

  /* ---------- captura da aba ---------- */

  let fluxo = null, videoAba = null, cortado = false;
  async function capturar() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('este navegador não deixa compartilhar a aba (use Chrome ou Edge no computador)');
    fluxo = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 10, displaySurface: 'browser' },
      audio: { suppressLocalAudioPlayback: false },
      preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude'
    });
    const [trilha] = fluxo.getVideoTracks();
    trilha.addEventListener('ended', parar);
    // Region Capture: o vídeo capturado vira só o retângulo do player, onde quer que ele esteja na página
    cortado = false;
    if (window.CropTarget && trilha.cropTo) {
      try { await trilha.cropTo(await CropTarget.fromElement($('#moldura'))); cortado = true; } catch (e) { cortado = false; }
    }
    videoAba = document.createElement('video');
    videoAba.muted = true;
    videoAba.srcObject = fluxo;
    await videoAba.play();
  }

  // retângulo do player dentro do quadro capturado (quando o navegador não recorta sozinho)
  function regiaoPlayer() {
    const w = videoAba.videoWidth, h = videoAba.videoHeight;
    if (cortado) return { x: 0, y: 0, w, h };
    const r = $('#moldura').getBoundingClientRect();
    const k = w / document.documentElement.clientWidth;
    return { x: r.left * k, y: r.top * k, w: r.width * k, h: r.height * k };
  }

  /* ---------- leitor (um só Tesseract, uma leitura por vez) ---------- */

  const carregados = {};
  const carregar = (src) => (carregados[src] = carregados[src] || new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => falha(new Error('não baixou ' + src));
    document.head.append(s);
  }));
  let leitor = null, lendo = false;
  async function ocr(canvas, psm) {
    if (!leitor) leitor = carregar(TESSERACT).then(() => window.Tesseract.createWorker('por'));
    const w = await leitor;
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const r = await w.recognize(canvas);
    return { texto: r.data.text, confianca: r.data.confidence, palavras: (r.data.words || []).map((x) => ({ texto: x.text, conf: x.confidence })) };
  }

  /* ---------- fonte 1: a legenda, lida da imagem ---------- */

  const faixa = document.createElement('canvas');
  let ultimaFaixa = null, ultimoTextoLegenda = '', legendaVistaEm = 0;

  // A legenda do YouTube é texto branco numa caixa escura. Fica preto o que é claro E tem fundo
  // escuro por perto (a letra); o resto, inclusive slide branco atrás, vira branco.
  function prepararFaixa() {
    const R = regiaoPlayer();
    const sy = R.y + R.h * 0.52, sh = R.h * 0.42;
    // a letra da legenda tem uns 20 px na tela; o Tesseract lê melhor com ela bem maior
    const escala = Math.max(1, Math.min(3, 2400 / R.w));
    const MARGEM = 24;
    const W = Math.round(R.w * escala), H = Math.round(sh * escala);
    faixa.width = W + MARGEM * 2; faixa.height = H + MARGEM * 2;
    const g = faixa.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, faixa.width, faixa.height);
    g.drawImage(videoAba, R.x, sy, R.w, sh, MARGEM, MARGEM, W, H);
    const img = g.getImageData(MARGEM, MARGEM, W, H);
    const d = img.data;
    const lum = new Uint8Array(W * H);
    // fundo da legenda: escuro e neutro (preto/cinza). Letra azul ou vermelha de slide não conta
    const fundo = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
      lum[i] = (r * 299 + gg * 587 + b * 114) / 1000;
      fundo[i] = lum[i] < 90 && Math.max(r, gg, b) - Math.min(r, gg, b) < 40 ? 1 : 0;
    }
    // "perto do fundo" em 2D (somas acumuladas: linha e depois coluna). Olhar só para os lados
    // apagava o meio das barras horizontais (do "t", do "e") e "acolhimento" virava "acolhimenio"
    const rh = Math.round(9 * escala), rv = Math.round(6 * escala);
    const perto = new Uint8Array(W * H);
    const acc = new Int32Array(W + 1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) acc[x + 1] = acc[x] + fundo[y * W + x];
      for (let x = 0; x < W; x++) perto[y * W + x] = acc[Math.min(W, x + rh + 1)] - acc[Math.max(0, x - rh)] > 0 ? 1 : 0;
    }
    const col = new Int32Array(H + 1);
    const perto2 = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) col[y + 1] = col[y] + perto[y * W + x];
      for (let y = 0; y < H; y++) perto2[y * W + x] = col[Math.min(H, y + rv + 1)] - col[Math.max(0, y - rv)] > 0 ? 1 : 0;
    }
    // Só "perto" não basta: a beira do slide claro encostada na caixa virava uma moldura preta.
    // Cada mancha clara é seguida até o fim; letra é mancha baixa e fechada pela caixa. A que
    // encosta na borda da imagem ou é alta demais (o slide, o cenário) fica de fora
    const claro = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) claro[i] = lum[i] > 140 ? 1 : 0;
    const fila = new Int32Array(W * H);
    const maxAlt = R.h * escala * 0.1;
    for (let i0 = 0; i0 < W * H; i0++) {
      if (claro[i0] !== 1) continue;
      let n = 0, topo = H, base = 0, borda = false;
      fila[n++] = i0; claro[i0] = 2;
      for (let k = 0; k < n; k++) {
        const i = fila[k], x = i % W, y = (i - x) / W;
        if (y < topo) topo = y;
        if (y > base) base = y;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) borda = true;
        if (x > 0 && claro[i - 1] === 1) { claro[i - 1] = 2; fila[n++] = i - 1; }
        if (x < W - 1 && claro[i + 1] === 1) { claro[i + 1] = 2; fila[n++] = i + 1; }
        if (y > 0 && claro[i - W] === 1) { claro[i - W] = 2; fila[n++] = i - W; }
        if (y < H - 1 && claro[i + W] === 1) { claro[i + W] = 2; fila[n++] = i + W; }
      }
      if (borda || base - topo > maxAlt) for (let k = 0; k < n; k++) claro[fila[k]] = 3;
    }
    let texto = 0;
    for (let i = 0; i < W * H; i++) {
      const letra = claro[i] === 2 && perto2[i];
      if (letra) texto++;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = letra ? 0 : 255;
    }
    g.putImageData(img, MARGEM, MARGEM);
    // mostra o que está sendo lido, para quem quiser conferir
    const e = $('#espiarCanvas');
    e.getContext('2d').drawImage(faixa, 0, 0, e.width, e.height);
    return texto / (W * H);
  }

  // A legenda fica alguns segundos na tela e é lida várias vezes; o leitor às vezes erra uma letra
  // ("ACOLHIVAENTO"). Junta as leituras do mesmo anúncio e anota a mais frequente
  // (empate: a de maior confiança) quando o anúncio sai da tela ou depois de 6 s.
  let urna = null;
  let pendentes = [];
  function votar(palavra, conf, trecho) {
    if (palavra.length < 3) return;
    if (!urna) urna = { inicio: Date.now(), votos: new Map(), trecho };
    const v = urna.votos.get(palavra) || { n: 0, conf: 0 };
    v.n++; v.conf = Math.max(v.conf, conf);
    urna.votos.set(palavra, v);
    urna.trecho = trecho;
    if (urna.votos.size && [...urna.votos.values()].reduce((s, x) => s + x.n, 0) >= 5) apurar();
  }
  function apurar() {
    if (!urna) return;
    const [palavra, v] = [...urna.votos].sort((a, b) => b[1].n - a[1].n || b[1].conf - a[1].conf)[0];
    const total = [...urna.votos.values()].reduce((s, x) => s + x.n, 0);
    caderno.anotar({ palavra, fonte: 'legenda', trecho: urna.trecho, confianca: v.n >= 2 && v.n / total >= 0.5 ? 'alta' : 'media', motivo: total > 1 ? `${v.n} de ${total} leituras` : '' });
    urna = null;
  }

  // A faixa limpa é quase toda branca: na média, uma palavra nova some. Conta os pontos que mudaram
  function mudou(canvas) {
    const p = document.createElement('canvas');
    p.width = 240; p.height = 60;
    const g = p.getContext('2d', { willReadFrequently: true });
    g.drawImage(canvas, 0, 0, 240, 60);
    const d = g.getImageData(0, 0, 240, 60).data;
    let dif = 0;
    if (ultimaFaixa) for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - ultimaFaixa[i]) > 40) dif++;
    const novo = !ultimaFaixa || dif > 6;
    ultimaFaixa = d;
    return novo;
  }

  const esperas = {};
  function texto(fonte, base, acrescimo) {
    if (!acrescimo.length) return;
    caderno.texto(fonte, base, acrescimo);
    clearTimeout(esperas[fonte]);
    esperas[fonte] = setTimeout(() => caderno.texto(fonte, base, [], true), 3000);
    pintarAgora();
  }

  async function lerLegenda() {
    if (lendo || !videoAba || videoAba.readyState < 2) return;
    const tinta = prepararFaixa();
    if (urna && Date.now() - urna.inicio > 6000) apurar();
    if (tinta < 0.002) {
      apurar();
      if (estado.fontes.legenda === 'lendo' && Date.now() - legendaVistaEm > 90000) { estado.fontes.legenda = 'sem legenda na tela'; pintarLuzes(); }
      return;
    }
    if (!mudou(faixa)) {
      // legenda parada há 2 s com a palavra no fim (o palestrante fez uma pausa): agora ela não muda mais
      if (pendentes.length && Date.now() - legendaVistaEm > 2000) { pendentes.forEach((p) => votar(p.palavra, p.conf, p.trecho)); pendentes = []; }
      return;
    }
    lendo = true;
    try {
      const r = await ocr(faixa, '6');
      // linhas com pelo menos duas letras seguidas; o resto é ruído do leitor
      const linhas = r.texto.split('\n').map((l) => l.replace(/[|_~`]/g, '').trim()).filter((l) => /\p{L}{2,}/u.test(l));
      const t = linhas.join(' ').replace(/\s+/g, ' ').trim();
      if (t && t !== ultimoTextoLegenda) {
        ultimoTextoLegenda = t;
        legendaVistaEm = Date.now();
        if (estado.fontes.legenda !== 'lendo') { estado.fontes.legenda = 'lendo'; pintarLuzes(); }
        // texto corrido só para mostrar e para o trecho do aviso; a palavra sai da votação de cada leitura
        legenda.adicionar(t);
        const d = N.detectar(t);
        pendentes = [];
        const limpa = (s) => N.normal(s).replace(/[^\p{L}\d]/gu, '');
        d.achados.forEach((a) => {
          const w = (r.palavras || []).find((x) => limpa(x.texto) === limpa(a.palavra));
          const conf = w ? w.conf : r.confianca;
          // palavra no fim da legenda pode estar pela metade: espera vir mais texto ou a legenda parar
          if (a.ultima) pendentes.push({ palavra: a.palavra, conf, trecho: t });
          else votar(a.palavra, conf, t);
          // o palestrante costuma repetir ("…é acolhimento. Repetindo: acolhimento"): cada repetição
          // na tela é mais uma leitura da mesma palavra, e conta como voto com a confiança dela
          (r.palavras || []).forEach((x) => {
            const p = x.texto.replace(/^[^\p{L}\d]+|[^\p{L}\d-]+$/gu, '');
            if (x === w || (limpa(p) !== limpa(a.palavra) && !N.parecidas(p, a.palavra))) return;
            votar(p.toUpperCase(), x.conf, t);
          });
        });
        const jaSaiu = caderno.notas.some((n) => n.tipo === 'palavra' && Date.now() - n.quando < 180000);
        if ((d.aviso || d.mencao) && !d.achados.length && !jaSaiu && !urna) caderno.abrirJanela('legenda', t);
        const j = caderno.janela;
        if (j && j.fonte === 'legenda' && Date.now() - j.inicio < 120000 && !j.texto.endsWith(t)) { j.texto = (j.texto + ' ' + t).slice(-900); j.nota.trecho = j.texto; salvar(); pintarNotas(); }
        pintarAgora();
      }
    } catch (e) {
      estado.fontes.legenda = 'erro: ' + e.message; pintarLuzes();
    } finally { lendo = false; }
  }

  /* ---------- fonte 2: slides ---------- */

  const quadro = document.createElement('canvas');
  let ultimoSlide = null, ultimoSlideEm = 0;
  async function lerSlide() {
    if (lendo || !videoAba || !$('#optTela').checked) return;
    const R = regiaoPlayer();
    const w = Math.min(1400, R.w);
    quadro.width = w; quadro.height = Math.round(w * R.h / R.w);
    quadro.getContext('2d').drawImage(videoAba, R.x, R.y, R.w, R.h, 0, 0, quadro.width, quadro.height);
    const p = document.createElement('canvas'); p.width = 32; p.height = 18;
    const g = p.getContext('2d', { willReadFrequently: true }); g.drawImage(quadro, 0, 0, 32, 18);
    const d = g.getImageData(0, 0, 32, 18).data;
    let dif = 0;
    if (ultimoSlide) for (let i = 0; i < d.length; i += 4) dif += Math.abs(d[i] - ultimoSlide[i]);
    const novo = !ultimoSlide || dif / 576 > 8;
    ultimoSlide = d;
    if (!novo && Date.now() - ultimoSlideEm < 20000) return;
    ultimoSlideEm = Date.now();
    lendo = true;
    try {
      const r = await ocr(quadro, '3');
      caderno.tela(r.texto, r.confianca);
      estado.fontes.tela = 'olhando'; pintarLuzes();
    } catch (e) { estado.fontes.tela = 'erro: ' + e.message; pintarLuzes(); } finally { lendo = false; }
  }

  /* ---------- fonte 3: voz (Vosk, no som da aba) ---------- */

  let voz = null, modelo = null;
  async function ligarVoz() {
    if (voz || !fluxo) return;
    if (!fluxo.getAudioTracks().length) { estado.fontes.voz = 'sem som: marque “compartilhar áudio”'; pintarLuzes(); return; }
    estado.fontes.voz = modelo ? 'ligando…' : 'baixando modelo (32 MB)…'; pintarLuzes();
    try {
      // o modelo (32 MB) costuma carregar em 10–30 s; se travar, avisa em vez de ficar "baixando" para sempre
      modelo = modelo || await Promise.race([
        carregar(VOSK).then(() => window.Vosk.createModel(MODELO_PT)),
        new Promise((_, falha) => setTimeout(() => falha(new Error('o modelo de voz não carregou; desmarque e marque de novo')), 150000))
      ]);
      const ctx = new AudioContext();
      await ctx.resume();
      const rec = new modelo.KaldiRecognizer(ctx.sampleRate);
      rec.on('result', (m) => { if (m.result && m.result.text) texto('voz', vozTexto, vozTexto.adicionar(m.result.text)); });
      rec.on('partialresult', (m) => { estado.parcial = (m.result && m.result.partial) || ''; pintarAgora(); });
      const fonte = ctx.createMediaStreamSource(new MediaStream(fluxo.getAudioTracks()));
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (ev) => { try { rec.acceptWaveformFloat(ev.inputBuffer.getChannelData(0).slice(), ctx.sampleRate); } catch (e) { /* um pedaço perdido */ } };
      fonte.connect(proc); proc.connect(ctx.destination);
      voz = { ctx, fonte, proc, rec };
      estado.fontes.voz = 'escutando'; pintarLuzes();
    } catch (e) { estado.fontes.voz = 'erro: ' + e.message; pintarLuzes(); }
  }
  function desligarVoz() {
    if (!voz) return;
    try { voz.proc.disconnect(); voz.fonte.disconnect(); voz.ctx.close(); voz.rec.remove(); } catch (e) { /* já parado */ }
    voz = null;
    estado.fontes.voz = 'desligada'; estado.parcial = ''; pintarLuzes();
  }
  $('#optVoz').addEventListener('change', (e) => { if (e.target.checked) ligarVoz(); else desligarVoz(); });
  $('#optTela').addEventListener('change', (e) => { estado.fontes.tela = e.target.checked ? (estado.rodando ? 'olhando' : 'ligada') : 'desligada'; pintarLuzes(); });

  /* ---------- fonte 4: chat pela API gratuita ---------- */

  let chatTimer = null;
  async function ligarChat() {
    if (!$('#chave').value.trim() || !/^[\w-]{11}$/.test(estado.id)) { estado.fontes.chat = $('#chave').value.trim() ? 'sem chat' : 'sem chave'; pintarLuzes(); return; }
    guardar('chave', $('#chave').value.trim());
    try {
      const v = await api('videos', { part: 'liveStreamingDetails', id: estado.id });
      const chatId = v.items && v.items[0] && v.items[0].liveStreamingDetails && v.items[0].liveStreamingDetails.activeLiveChatId;
      if (!chatId) { estado.fontes.chat = 'esta live não tem chat ativo'; pintarLuzes(); return; }
      let pagina = '', primeira = true;
      const buscar = async () => {
        if (!estado.rodando) return;
        try {
          const r = await api('liveChat/messages', { liveChatId: chatId, part: 'snippet,authorDetails', maxResults: 200, ...(pagina ? { pageToken: pagina } : {}) });
          pagina = r.nextPageToken || pagina;
          // a primeira página é o que já estava no chat: entra na contagem, mas não dispara alerta antigo
          (r.items || []).forEach((it) => {
            const a = it.authorDetails || {};
            const textoMsg = (it.snippet && it.snippet.displayMessage) || '';
            const papel = a.isChatOwner ? 'owner' : a.isChatModerator ? 'moderator' : '';
            const res = chat.mensagem({ autor: a.channelId || a.displayName, texto: textoMsg, papel });
            if (!primeira) caderno.chat(res, a.displayName || '', textoMsg, papel);
          });
          primeira = false;
          estado.fontes.chat = 'lendo'; pintarLuzes();
          // respeita o intervalo que a API pede, e no mínimo 6 s para a cota grátis durar a live inteira
          chatTimer = setTimeout(buscar, Math.max(6000, r.pollingIntervalMillis || 0));
        } catch (e) {
          estado.fontes.chat = e.message; pintarLuzes();
          if (!/cota|chave|terminou|não tem/.test(e.message)) chatTimer = setTimeout(buscar, 15000);
        }
      };
      buscar();
    } catch (e) { estado.fontes.chat = e.message; pintarLuzes(); }
  }

  /* ---------- começar e parar ---------- */

  let ciclo = null, cicloSlide = null;
  $('#comecar').addEventListener('click', async () => {
    try {
      if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
      await capturar();
    } catch (e) {
      estado.fontes.legenda = e.name === 'NotAllowedError' ? 'você não compartilhou a aba' : 'erro: ' + e.message;
      pintarLuzes();
      return;
    }
    estado.rodando = true;
    estado.fontes.legenda = 'procurando';
    $('#comecar').hidden = true; $('#parar').hidden = false; $('#espiar').hidden = false;
    ciclo = setInterval(lerLegenda, 700);
    cicloSlide = setInterval(lerSlide, 4000);
    if ($('#optVoz').checked) ligarVoz();
    if ($('#optTela').checked) estado.fontes.tela = 'olhando';
    ligarChat();
    pintarLuzes();
  });

  function parar() {
    if (pendentes.length) pendentes.forEach((p) => votar(p.palavra, p.conf, p.trecho));
    pendentes = [];
    apurar();
    estado.rodando = false;
    clearInterval(ciclo); clearInterval(cicloSlide); clearTimeout(chatTimer);
    desligarVoz();
    if (fluxo) fluxo.getTracks().forEach((t) => t.stop());
    fluxo = null; videoAba = null; ultimaFaixa = null;
    estado.fontes.legenda = 'parada';
    if (estado.fontes.chat === 'lendo') estado.fontes.chat = 'parado';
    $('#comecar').hidden = false; $('#parar').hidden = true;
    pintarLuzes();
  }
  $('#parar').addEventListener('click', parar);

  /* ---------- aviso, notificação ---------- */

  let audioCtx = null;
  function bipe(forte) {
    try {
      audioCtx = audioCtx || new AudioContext();
      (forte ? [880, 1175, 1568] : [660]).forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        const t0 = audioCtx.currentTime + i * 0.14;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0); o.stop(t0 + 0.25);
      });
    } catch (e) { /* sem som */ }
  }
  function notificar(n) {
    try {
      if (window.Notification && Notification.permission === 'granted') new Notification('Taquígrafo: ' + n.palavra, { body: n.hora + (n.trecho ? ' — “' + n.trecho.slice(-90) + '”' : '') });
    } catch (e) { /* segue */ }
  }

  /* ---------- desenho ---------- */

  const NOME_FONTE = { legenda: 'falada', voz: 'voz', tela: 'na tela', chat: 'chat' };
  function pintarLuzes() {
    const luz = (s) => (/lendo|escutando|olhando/.test(s) ? 'on' : /desligad|parad|sem chave|ligada/.test(s) ? '' : /procurando|baixando|ligando/.test(s) ? 'meio' : 'off');
    $('#luzes').replaceChildren(...[['legenda', 'Legenda'], ['voz', 'Voz'], ['tela', 'Slides'], ['chat', 'Chat']].map(([k, rot]) => {
      const li = document.createElement('li');
      const b = document.createElement('span');
      b.className = 'luz ' + luz(estado.fontes[k]);
      li.append(b, document.createTextNode(rot + ': ' + estado.fontes[k]));
      return li;
    }));
  }
  function pintarAgora() {
    $('#agora').textContent = (voz && estado.parcial ? 'voz: ' + estado.parcial : legenda.ultimas(30)) || 'O que for dito aparece aqui…';
  }
  function pintarNotas(nova) {
    const box = $('#notas');
    const notas = caderno.notas.slice().reverse();
    if (!notas.length) { const p = document.createElement('p'); p.className = 'vazio'; p.textContent = 'Nada anotado ainda.'; box.replaceChildren(p); return; }
    box.replaceChildren(...notas.map((n) => {
      const a = document.createElement('article');
      a.className = 'nota' + (n.tipo === 'aviso' ? ' nota--aviso' : '') + (n === nova ? ' nova' : '');
      const p = document.createElement('div');
      p.className = 'nota__palavra';
      p.textContent = n.tipo === 'aviso' ? 'Atenção: a palavra vai ser dita' : n.palavra;
      const meta = document.createElement('div');
      meta.className = 'nota__meta';
      meta.textContent = [n.hora, n.fontes.map((f) => NOME_FONTE[f] || f).join(' + '), n.tipo === 'aviso' ? '' : (n.confianca === 'alta' ? 'confiável' : 'confira'), n.vezes > 1 ? n.vezes + '×' : '', n.motivo || ''].filter(Boolean).join(' · ');
      a.append(p, meta);
      if (n.trecho) { const t = document.createElement('p'); t.className = 'nota__trecho'; t.textContent = '“' + n.trecho.slice(-300) + '”'; a.append(t); }
      if (n.tipo !== 'aviso') {
        const c = document.createElement('button');
        c.type = 'button'; c.className = 'botao-linha'; c.textContent = 'Copiar';
        c.addEventListener('click', () => { navigator.clipboard.writeText(n.palavra).then(() => { c.textContent = 'Copiado'; setTimeout(() => { c.textContent = 'Copiar'; }, 1500); }, () => { c.textContent = 'Não deu'; }); });
        a.append(c);
      }
      return a;
    }));
  }
  $('#limpar').addEventListener('click', () => caderno.limpar());
  $('#exportar').addEventListener('click', () => {
    const linhas = ['Taquígrafo — ' + (estado.id || ''), ''];
    caderno.notas.forEach((n) => {
      linhas.push(n.tipo === 'aviso' ? `[${n.hora}] AVISO de palavra-chave` : `[${n.hora}] ${n.palavra}  (${n.fontes.join(' + ')}, ${n.confianca === 'alta' ? 'confiável' : 'confira'})`);
      if (n.trecho) linhas.push('    “' + n.trecho + '”');
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([linhas.join('\r\n')], { type: 'text/plain;charset=utf-8' }));
    a.download = 'palavras-chave-' + (estado.id || 'live') + '.txt';
    document.body.append(a); a.click(); a.remove();
  });

  pintarLuzes();
  pintarNotas();
  // veio da capa com o link (acompanhar.html?link=…): já abre a live
  const linkInicial = new URLSearchParams(location.search).get('link');
  if (linkInicial) { $('#link').value = linkInicial; $('#formLink').requestSubmit(); }
  window.Acompanhar = { estado, caderno, idDoLink, abrirEmbed, faixa };
})();
