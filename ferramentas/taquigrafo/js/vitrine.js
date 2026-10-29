/* Capa do Taquígrafo: a máquina da abertura imprime uma live encenada em loop, e o ensaio
   liga a fita de verdade (núcleo + fita) à live de demonstração da página, lendo o texto da
   legenda e as mensagens do chat direto do DOM. */

(function () {
  'use strict';

  const N = window.TaquigrafoNucleo;
  const { Fita } = window.TaquigrafoFita;
  const $ = (s) => document.querySelector(s);
  const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- abertura: as teclas e a fita imprimindo sozinha ---------- */

  const TECLAS = 'S T K P W H R A O * E U F R P B L G T S D Z'.split(' ');
  const teclas = TECLAS.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; });
  $('#teclasCapa').append(...teclas);
  function bater() {
    teclas.forEach((t) => t.classList.remove('acesa'));
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) teclas[Math.floor(Math.random() * teclas.length)].classList.add('acesa');
  }

  // "★PALAVRA": o carimbo cai ali
  const ROTEIRO = [
    'Boa noite, pessoal, sejam bem-vindos à live de hoje.',
    'Hoje são duas palavras-chave para o certificado, fiquem atentos.',
    'Acolher não é só receber bem: é escutar sem julgamento.',
    'A primeira palavra-chave é acolhimento.',
    '★ACOLHIMENTO',
    'Nos primeiros encontros, o que importa é construir vínculo.',
    'A segunda palavra-chave é vínculo. Repetindo: vínculo.',
    '★VÍNCULO',
    'Obrigada e até a próxima!'
  ];
  let relogio = 19 * 3600 + 2 * 60 + 8;
  const horaFalsa = () => { const s = relogio; return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, '0')).join(':'); };
  let quando = 0;
  const capa = new Fita($('#fitaCapa'), { nucleo: N, hora: horaFalsa, agora: () => quando });
  const fila = [];
  ROTEIRO.forEach((frase) => { if (frase[0] === '★') fila.push(frase); else frase.split(' ').forEach((w) => fila.push(w)); });

  let passo = 0, visivel = true, timer = null;
  function imprimir() {
    timer = null;
    if (!visivel) return;
    if (passo >= fila.length) {
      // fim da live encenada: espera, rasga a fita e começa de novo
      timer = setTimeout(() => { capa.limpar(); passo = 0; relogio = 19 * 3600 + 2 * 60 + 8; agendar(); }, 5000);
      return;
    }
    const w = fila[passo++];
    quando += 400; relogio += Math.random() < 0.4 ? 1 : 0;
    if (w[0] === '★') capa.carimbar({ palavra: w.slice(1), quando, hora: horaFalsa(), fontes: ['legenda'] });
    else { capa.receber('legenda', [w]); bater(); }
    agendar(w[0] === '★' ? 1600 : /[.!:]$/.test(w) ? 700 : 170 + Math.random() * 120);
  }
  function agendar(ms = 200) { if (!timer) timer = setTimeout(imprimir, ms); }
  if (calmo) {
    fila.forEach((w) => { quando += 400; if (w[0] === '★') capa.carimbar({ palavra: w.slice(1), quando, hora: horaFalsa(), fontes: ['legenda'] }); else capa.receber('legenda', [w]); });
  } else {
    // só imprime enquanto a máquina está na tela
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) agendar(); }).observe($('#fitaCapa'));
  }

  /* ---------- ensaio: a fita de verdade na live de demonstração ---------- */

  const hora = () => new Date().toLocaleTimeString('pt-BR');
  let legenda = new N.Transcricao();
  let chat = new N.Chat();
  const fita = new Fita($('#fitaEnsaio'), { nucleo: N, hora });
  const estadoEl = $('#estadoEnsaio');
  const caderno = new N.Caderno({
    hora,
    aoNovo: (nota) => {
      if (nota.tipo !== 'palavra') return;
      fita.carimbar(nota);
      estadoEl.textContent = 'anotou: ' + nota.palavra;
      bipe();
    },
    // grafia trocada por uma fonte mais confiável: o carimbo acompanha
    aoMudar: () => caderno.notas.filter((n) => n.tipo === 'palavra').forEach((n) => fita.carimbar(n))
  });

  let ultimoTexto = '', espera = null;
  function lerLegenda() {
    const t = [...document.querySelectorAll('#linhas .ytp-caption-segment')].map((s) => s.textContent).join(' ').trim();
    if (!t || t === ultimoTexto) return;
    ultimoTexto = t;
    const antes = legenda.cortadas + legenda.palavras.length;
    const acr = legenda.adicionar(t);
    const removidas = antes + acr.length - (legenda.cortadas + legenda.palavras.length);
    fita.receber('legenda', acr, removidas);
    if (!caderno.notas.some((n) => n.tipo === 'palavra')) estadoEl.textContent = 'imprimindo';
    if (!acr.length) return;
    caderno.texto('legenda', legenda, acr);
    clearTimeout(espera);
    // a última palavra só vale quando a legenda para de mudar
    espera = setTimeout(() => caderno.texto('legenda', legenda, [], true), 3000);
  }
  new MutationObserver(lerLegenda).observe($('#linhas'), { childList: true, subtree: true, characterData: true });

  function vigiarChat() {
    const d = $('#chatframe').contentDocument;
    const itens = d && d.getElementById('items');
    if (!itens) { setTimeout(vigiarChat, 300); return; }
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((no) => {
      if (no.nodeType !== 1) return;
      const autor = (no.querySelector('#author-name') || {}).textContent || '';
      const texto = (no.querySelector('#message') || {}).textContent || '';
      const papel = no.getAttribute('author-type') || '';
      caderno.chat(chat.mensagem({ autor, texto, papel }), autor, texto, papel);
    }))).observe(itens, { childList: true });
  }
  vigiarChat();

  $('#soDestaquesEnsaio').addEventListener('change', (e) => fita.soDestaques(e.target.checked));

  let audio = null;
  function bipe() {
    try {
      audio = audio || new AudioContext();
      [880, 1175, 1568].forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        const t0 = audio.currentTime + i * 0.13;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.connect(g); g.connect(audio.destination);
        o.start(t0); o.stop(t0 + 0.22);
      });
    } catch (e) { /* sem som */ }
  }

  // demo.js chama isto ao recomeçar a live
  window.Taquigrafo = {
    limpar() {
      legenda = new N.Transcricao(); chat = new N.Chat(); ultimoTexto = '';
      clearTimeout(espera);
      caderno.limpar(); fita.limpar();
      estadoEl.textContent = 'esperando o play';
    },
    fita, caderno
  };
})();
