// ==UserScript==
// @name         Taquígrafo — anota as palavras-chave da live
// @namespace    https://henrlz.github.io/portfolio-luiz-henrique/
// @version      1.1.0
// @description  Lê a legenda automática, o chat e (se você ligar) a tela e o áudio de uma live do YouTube, e anota as palavras-chave quando o palestrante anuncia. Tudo no seu navegador.
// @author       Luiz Henrique Pereira
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_setClipboard
// @run-at       document-idle
// @downloadURL  https://henrlz.github.io/portfolio-luiz-henrique/ferramentas/taquigrafo/taquigrafo.user.js
// @updateURL    https://henrlz.github.io/portfolio-luiz-henrique/ferramentas/taquigrafo/taquigrafo.user.js
// ==/UserScript==

/* O Taquígrafo não usa IA para entender a fala: quem transforma voz em texto é a legenda
   automática do próprio YouTube. Aqui só se procura, nesse texto, as frases que anunciam
   uma palavra-chave. Tela (OCR) e voz (reconhecimento local) são opcionais e rodam numa
   página "motor" à parte, porque o YouTube não deixa carregar essas bibliotecas dentro dele. */

(function () {
  'use strict';

  /* =========================================================================
     Detector: funções puras, sem DOM (testáveis fora do navegador)
     ========================================================================= */

  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normal = (s) => semAcento(String(s)).toLowerCase();

  // palavras que aparecem logo depois do gatilho mas não são a palavra-chave
  const ENCHIMENTO = new Set(['a', 'o', 'e', 'um', 'uma', 'de', 'da', 'do', 'que', 'essa', 'esta', 'esse', 'este', 'isso', 'aqui', 'agora', 'entao', 'seguinte',
    'muito', 'bem', 'so', 'simples', 'facil', 'importante', 'gente', 'pessoal', 'galera', 'turma', 'ta', 'ok', 'tipo', 'assim', 'ai', 'la', 'hoje', 'para', 'pra',
    'vou', 'falar', 'dizer', 'repetir', 'novamente', 'de novo', 'mais', 'uma', 'vez', 'ne', 'olha', 'atencao', 'anota', 'anotem', 'palavra', 'chave', 'e', 'eh', 'sera', 'vai', 'ser',
    'musica', 'aplausos', 'risos']);

  // particípio logo depois de "vai ser" é aviso ("vai ser dita"), não a palavra
  const PARTICIPIOS = /^(dita|dito|falada|falado|passada|passado|revelada|revelado|anunciada|anunciado|divulgada|divulgado|mostrada|mostrado|liberada|liberado|informada|informado)$/;

  // gatilhos: depois deles vem a palavra. Live pode ter várias ("a segunda palavra é…",
  // "palavra-chave número 3:…", "1ª palavra: …"), por isso a ordem e o número entram no gatilho
  const VERBO = '\\s*(?:(?:e|eh|sera|vai ser|fica)\\s*[:=-]?|[:=-])\\s';
  const ORDEM = '(?:primeira|segunda|terceira|quarta|quinta|sexta|setima|oitava|nona|decima|proxima|outra|ultima|nova|(?<![\\w])\\d{1,2}[aoª°º])';
  const NUMERO = '(?:numero\\s*|n[o°º.]\\s*)?(?:\\d{1,2}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)';
  const GATILHOS = [
    new RegExp('palavra[\\s-]*chave(?:\\s+(?:de hoje|do dia|da aula|da live|do encontro|desta live|dessa live|para (?:o )?certificado|para (?:a )?presenca|de presenca|' + NUMERO + ')){0,3}' + VERBO, 'g'),
    new RegExp('(?:o|a)?\\s*(?:codigo|senha|token|palavra)\\s+(?:de |da |do |para (?:a |o )?)(?:presenca|certificado|frequencia|confirmacao|validacao)' + VERBO, 'g'),
    /a palavra(?: de hoje| do dia)?\s+(?:e|sera|vai ser)\s/g,
    new RegExp(ORDEM + '\\s*palavra(?:[\\s-]*chave)?(?:\\s+(?:de hoje|do dia))?' + VERBO, 'g'),
    new RegExp('palavra\\s+' + NUMERO + '\\s*[:=-]\\s*', 'g'),
    /(?:anotem|anota|anote|guardem|guarda|escrevam|escreve|copiem|copia)\s+(?:ai\s+)?(?:a|essa|esta)?\s*palavra(?:[\s-]*chave)?\s*(?:que e|e|:|,)?\s/g,
    new RegExp('palavra[\\s-]*chave\\s*(?:' + NUMERO + ')?\\s*:\\s*', 'g')
  ];
  // "as palavras-chave de hoje são acolhimento, vínculo e escuta": uma lista
  const LISTAS = [
    /palavras[\s-]*chaves?(?:\s+(?:de hoje|do dia|da aula|da live|do encontro|para (?:o )?certificado)){0,2}\s*(?:sao|serao|vao ser|:)\s*:?\s/g
  ];
  // avisos: a palavra ainda vai ser dita
  const AVISOS = [
    /vou (?:falar|dizer|passar|dar|soltar|liberar|mostrar) (?:a|o|as|os|a proxima|a outra|mais uma) (?:palavras?|codigos?)/,
    /daqui (?:a|ha) pouco (?:eu )?(?:vou )?(?:passo|falo|digo|libero|passar|falar|dizer)?\s*(?:a|o|as|os|a proxima|a outra|mais uma) (?:palavras?|codigos?)/,
    /fiquem atentos? (?:a|as|para a|para as|pra|pras) (?:proxima |proximas |outra |outras )?palavras?/,
    /no final (?:da live |do encontro |da aula )?(?:eu )?(?:passo|falo|digo|vou passar|vou falar|vou dizer) (?:a|o|as|os) (?:palavras?|codigos?)/,
    /(?:a|o|as|os) (?:proxima |outra |segunda |terceira )?(?:palavras?[\s-]*chaves?|codigo de presenca) (?:vai ser|sera|vao ser|serao) (?:dita|dito|falada|falado|passada|passado|ditas|faladas|passadas)/
  ];
  const MENCAO = /palavras?[\s-]*chaves?|codigo de presenca|codigo do certificado|palavra do certificado/;

  // lê a palavra depois do gatilho: pula enchimento ("a seguinte:") e junta letra soletrada (a c o l h e r)
  function lerPalavra(original, ini) {
    const resto = original.slice(ini, ini + 220);
    const tokens = resto.split(/[\s"“”'«»]+/).map((t) => t.replace(/^[^\p{L}\d]+|[^\p{L}\d-]+$/gu, '')).filter(Boolean);
    const soletrando = (i) => { let n = 0; while (i + n < tokens.length && /^\p{L}$/u.test(tokens[i + n])) n++; return n >= 3; };
    let k = 0;
    // pula enchimento, mas não o "a" que é a primeira letra de uma palavra soletrada
    while (k < tokens.length && k < 8 && ENCHIMENTO.has(normal(tokens[k])) && !soletrando(k)) k++;
    if (k >= tokens.length) return null;
    if (PARTICIPIOS.test(normal(tokens[k]))) return null;
    // soletrada: três ou mais letras soltas seguidas
    let letras = '';
    let j = k;
    while (j < tokens.length && /^\p{L}$/u.test(tokens[j])) { letras += tokens[j]; j++; }
    // "ultima": a palavra é a última coisa dita até agora; na legenda ao vivo ela ainda pode estar pela metade
    if (letras.length >= 3) return { palavra: letras.toUpperCase(), soletrada: true, ultima: j >= tokens.length };
    const hifen = /^(\p{L}-){2,}\p{L}$/u.test(tokens[k]);
    if (hifen) return { palavra: tokens[k].replace(/-/g, '').toUpperCase(), soletrada: true, ultima: k === tokens.length - 1 };
    const p = tokens[k];
    if (p.length < 2 || p.length > 40) return null;
    return { palavra: p.toUpperCase(), soletrada: false, ultima: k === tokens.length - 1 };
  }

  // lista depois de "as palavras-chave são": vai até o ponto final, separada por vírgula ou "e".
  // Cada item guarda a sua posição no texto (assim cada um vira uma anotação)
  function lerLista(original, ini) {
    const resto = original.slice(ini, ini + 260);
    const fim = resto.search(/[.!?;\n]/);
    const trecho = fim >= 0 ? resto.slice(0, fim) : resto;
    const itens = [];
    const re = /[^,]+/g;
    let m;
    while ((m = re.exec(trecho)) && itens.length < 12) {
      const pedaco = m[0], comeco = m.index;
      pedaco.split(/\s+e\s+/).forEach((parte, k, partes) => {
        const off = comeco + pedaco.indexOf(parte);
        const p = lerPalavra(original.slice(0, ini + off + parte.length), ini + off);
        if (!p) return;
        // sem ponto final, o último item pode estar pela metade na legenda ao vivo
        const ultimoItem = fim < 0 && comeco + pedaco.length >= trecho.length && k === partes.length - 1;
        itens.push({ ...p, ultima: ultimoItem, pos: ini + off });
      });
    }
    return itens;
  }

  // procura palavra-chave num pedaço de texto; devolve achados e avisos
  function detectar(texto) {
    const original = String(texto);
    const n = normal(original);   // mesmo comprimento do original (só troca letras)
    const achados = [];
    GATILHOS.forEach((re) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(n))) {
        const p = lerPalavra(original, m.index + m[0].length);
        if (p) achados.push({ ...p, pos: m.index, gatilho: original.slice(m.index, m.index + m[0].length).trim() });
      }
    });
    LISTAS.forEach((re) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(n))) lerLista(original, m.index + m[0].length).forEach((p) => achados.push({ ...p, gatilho: original.slice(m.index, m.index + m[0].length).trim() }));
    });
    // o mesmo trecho pode bater em dois gatilhos: fica um achado por palavra
    const unicos = [];
    achados.sort((a, b) => a.pos - b.pos).forEach((a) => { if (!unicos.some((u) => u.palavra === a.palavra)) unicos.push(a); });
    return {
      achados: unicos,
      aviso: AVISOS.some((re) => re.test(n)),
      mencao: MENCAO.test(n)
    };
  }

  // Legenda ao vivo rola: a linha de cima sai, a de baixo cresce. Junta tudo num texto corrido
  // pela maior sobreposição entre o fim do que já temos e o começo do que está na tela.
  class Transcricao {
    // "cortadas": quantas palavras já saíram pelo começo; com ela cada palavra tem uma posição fixa
    constructor(limite = 4000) { this.palavras = []; this.limite = limite; this.cortadas = 0; }
    adicionar(visivel) {
      const novas = String(visivel).replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(Boolean);
      if (!novas.length) return [];
      const a = this.palavras;
      const cmp = (x) => normal(x).replace(/[^\p{L}\d]/gu, '');
      let melhor = 0;
      const maxK = Math.min(novas.length, a.length, 60);
      for (let k = maxK; k > 0; k--) {
        let ok = true;
        for (let i = 0; i < k; i++) { if (cmp(a[a.length - k + i]) !== cmp(novas[i])) { ok = false; break; } }
        if (ok) { melhor = k; break; }
      }
      // a legenda às vezes corrige a última palavra: se só ela mudou, troca em vez de repetir
      if (!melhor && a.length && novas.length > 1 && cmp(a[a.length - 1]) !== cmp(novas[0])) {
        const idx = a.length - 1;
        for (let k = Math.min(novas.length - 1, a.length, 60); k > 0; k--) {
          let ok = true;
          for (let i = 0; i < k; i++) { if (cmp(a[idx - k + 1 + i]) !== cmp(novas[i])) { ok = false; break; } }
          if (ok && k >= 2) { a.splice(idx - k + 1); melhor = 0; break; }
        }
      }
      const acrescimo = novas.slice(melhor);
      a.push(...acrescimo);
      if (a.length > this.limite) { this.cortadas += a.length - this.limite; a.splice(0, a.length - this.limite); }
      return acrescimo;
    }
    ultimas(n = 80) { return this.palavras.slice(-n).join(' '); }
    // procura nas últimas palavras; cada gatilho ganha um número fixo (para não anotar duas vezes)
    procurar(n = 70, final = false) {
      const ws = this.palavras.slice(-n);
      const texto = ws.join(' ');
      const base = this.cortadas + this.palavras.length - ws.length;
      const d = detectar(texto);
      d.achados = d.achados
        .filter((a) => final || !a.ultima)
        .map((a) => ({ ...a, marca: base + texto.slice(0, a.pos).split(' ').filter(Boolean).length }));
      return d;
    }
  }

  // Chat: moderador e dono valem na hora; usuário comum só quando três pessoas diferentes concordam
  class Chat {
    constructor() { this.votos = new Map(); }
    mensagem({ autor, texto, papel }) {
      const d = detectar(texto);
      const oficial = papel === 'owner' || papel === 'moderator';
      if (oficial) {
        // "palavras-chave: ACOLHIMENTO, VÍNCULO": "palavras" traz todas, "palavra" a primeira
        if (d.achados.length) return { palavra: d.achados[0].palavra, palavras: d.achados.map((a) => a.palavra), confianca: 'alta', motivo: papel === 'owner' ? 'dono do canal' : 'moderador', texto };
        // moderador mandou só a palavra solta, em maiúsculas, logo depois de alguém perguntar
        const sozinha = /^\s*([A-ZÀ-Ý][A-ZÀ-Ý0-9-]{2,30})\s*$/.exec(texto);
        if (sozinha) return { palavra: sozinha[1], confianca: 'media', motivo: (papel === 'owner' ? 'dono do canal' : 'moderador') + ', palavra solta', texto };
        return null;
      }
      if (!d.achados.length || /\?\s*$/.test(texto)) return null;
      const valem = d.achados.map((a) => a.palavra).filter((p) => {
        if (!this.votos.has(p)) this.votos.set(p, new Set());
        const quem = this.votos.get(p);
        quem.add(autor || Math.random());
        return quem.size === 3;
      });
      if (valem.length) return { palavra: valem[0], palavras: valem, confianca: 'media', motivo: '3 pessoas no chat', texto };
      return null;
    }
  }

  // Leitura de tela e reconhecimento de voz erram uma ou duas letras ("ACOLHIVAENTO", "A-OLHIMENIO"):
  // palavras quase iguais contam como a mesma (até 2 letras de diferença nas longas, 1 nas curtas)
  function distancia(a, b) {
    const m = a.length, n = b.length;
    let ant = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = cur;
    }
    return ant[n];
  }
  function parecidas(a, b) {
    const x = normal(a).replace(/[^\p{L}\d]/gu, ''), y = normal(b).replace(/[^\p{L}\d]/gu, '');
    if (x === y) return true;
    const menor = Math.min(x.length, y.length);
    if (menor < 4) return false;
    return distancia(x, y) <= (menor >= 6 ? 2 : 1);
  }

  // Caderno: guarda as anotações e decide o que é palavra nova, repetição, outra fonte ou aviso.
  // Não mexe em tela nem tem relógio próprio: quem usa passa "agora", "hora", "tempo" e os avisos.
  class Caderno {
    constructor(o = {}) {
      this.agora = o.agora || (() => Date.now());
      this.hora = o.hora || (() => '');
      this.tempo = o.tempo || (() => '');
      this.aoNovo = o.aoNovo || (() => {});     // palavra ou aviso novo: apitar, notificar, desenhar
      this.aoMudar = o.aoMudar || (() => {});   // repetição, trecho crescendo, limpeza: salvar e redesenhar
      this.notas = [];
      this.marcas = new Set();
      this.janela = null;                       // depois de um aviso, guarda o que for dito por 2 minutos
      this.ultimoAviso = 0;
    }
    limpar() { this.notas = []; this.marcas.clear(); this.janela = null; this.ultimoAviso = 0; this.aoMudar(); }

    anotar({ palavra, fonte, trecho = '', confianca = 'alta', motivo = '', soletrada = false }) {
      const igual = this.notas.find((a) => a.tipo === 'palavra' && parecidas(a.palavra, palavra) && this.agora() - a.quando < 20 * 60 * 1000);
      if (igual) {
        // a mesma tela relida ou a mesma mensagem não contam como repetição; fala nova e outra fonte, sim
        const novaFonte = !igual.fontes.includes(fonte);
        if (!novaFonte && (fonte === 'tela' || fonte === 'chat')) return igual;
        // grafia diferente (leitura com erro de uma letra): fica a da fonte mais confiável
        if (normal(igual.palavra) !== normal(palavra) && igual.confianca !== 'alta' && confianca === 'alta') {
          igual.lidaComo = igual.palavra;
          igual.palavra = palavra;
        }
        igual.vezes = (igual.vezes || 1) + 1;
        if (novaFonte) igual.fontes.push(fonte);
        igual.confianca = 'alta';
        this.aoMudar();
        return igual;
      }
      const nota = { tipo: 'palavra', palavra, fontes: [fonte], trecho, confianca, motivo, soletrada, hora: this.hora(), tempo: this.tempo(), quando: this.agora(), vezes: 1 };
      this.notas.push(nota);
      this.aoNovo(nota);
      return nota;
    }

    // aviso ("no final eu passo a palavra"): no máximo um por minuto
    abrirJanela(fonte, trecho) {
      if (this.agora() - this.ultimoAviso < 60000) return null;
      this.ultimoAviso = this.agora();
      const nota = { tipo: 'aviso', palavra: '', fontes: [fonte], trecho, hora: this.hora(), tempo: this.tempo(), quando: this.agora() };
      this.janela = { inicio: this.agora(), fonte, texto: trecho, nota };
      this.notas.push(nota);
      this.aoNovo(nota);
      return nota;
    }

    // texto novo de uma fonte de fala (legenda, voz). "final": a última palavra já não vai mudar
    texto(fonte, base, acrescimo, final = false) {
      if (!final && !acrescimo.length) return null;
      const j = this.janela;
      if (acrescimo.length && j && this.agora() - j.inicio < 120000 && j.fonte === fonte) {
        j.texto = (j.texto + ' ' + acrescimo.join(' ')).slice(-900);
        j.nota.trecho = j.texto;
        this.aoMudar();
      }
      const d = base.procurar(70, final);
      let novos = 0;
      d.achados.forEach((a) => {
        const marca = fonte + '@' + a.marca;
        if (this.marcas.has(marca)) return;
        this.marcas.add(marca);
        novos++;
        // trecho em volta do anúncio: um pouco antes, a frase toda e um pouco depois
        const i = a.marca - base.cortadas;
        const trecho = base.palavras.slice(Math.max(0, i - 12), i + 16).join(' ');
        this.anotar({ palavra: a.palavra, fonte, trecho, soletrada: a.soletrada, confianca: a.soletrada ? 'media' : 'alta' });
      });
      // aviso só faz sentido antes: se uma palavra acabou de sair, quem fala "palavra-chave" está
      // repetindo. Só por 45 s: live com várias palavras avisa da próxima logo depois
      const jaSaiu = this.notas.some((n) => n.tipo === 'palavra' && this.agora() - n.quando < 45000);
      // o aviso é procurado só no que acabou de chegar (com um pouco antes): a menção a
      // "palavra-chave" de uma palavra já anotada não pode virar aviso de novo
      const recente = detectar(base.palavras.slice(-(acrescimo.length + 8)).join(' '));
      if (!final && (recente.aviso || recente.mencao) && !novos && !jaSaiu) this.abrirJanela(fonte, base.ultimas(30));
      return d;
    }

    // mensagem do chat já avaliada pelo Chat
    chat(r, autor, textoOriginal, papel) {
      if (r) {
        const notas = (r.palavras || [r.palavra]).map((p) => this.anotar({ palavra: p, fonte: 'chat', trecho: autor + ': ' + r.texto, confianca: r.confianca, motivo: r.motivo }));
        return notas[0];
      }
      if ((papel === 'owner' || papel === 'moderator') && MENCAO.test(normal(textoOriginal))) this.abrirJanela('chat', autor + ': ' + textoOriginal);
      return null;
    }

    // texto lido da tela (slide): "Palavra-chave" como rótulo, com a palavra na linha de baixo
    tela(textoOCR, confiancaOCR) {
      const d = detectar(String(textoOCR).replace(/(palavra[\s-]*chave|c[oó]digo de presen[cç]a)\s*\n+/gi, '$1: ').replace(/\s+/g, ' '));
      d.achados.forEach((a) => this.anotar({ palavra: a.palavra, fonte: 'tela', trecho: String(textoOCR).replace(/\s+/g, ' ').slice(0, 160), confianca: confiancaOCR > 70 ? 'alta' : 'media' }));
      return d;
    }
  }

  const API = { detectar, lerPalavra, Transcricao, Chat, Caderno, normal, parecidas };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  // modo link (acompanhar.html) usa só o núcleo, sem o painel do YouTube
  if (window.__TAQUIGRAFO_NUCLEO) { window.TaquigrafoNucleo = API; return; }

  /* =========================================================================
     No navegador
     ========================================================================= */

  const $ = (s, r = document) => r.querySelector(s);
  const DEMO = !!window.__TAQUIGRAFO_DEMO;
  const MOTOR = window.__TAQUIGRAFO_MOTOR || (DEMO ? new URL('motor.html', location.href).href : 'https://henrlz.github.io/portfolio-luiz-henrique/ferramentas/taquigrafo/motor.html');

  // armazenamento: Tampermonkey quando houver, senão o localStorage (página de demonstração)
  const guardar = (k, v) => { try { if (typeof GM_setValue === 'function') GM_setValue(k, v); else localStorage.setItem('taquigrafo:' + k, JSON.stringify(v)); } catch (e) { /* segue */ } };
  const ler = (k, padrao) => {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(k, padrao);
      const s = localStorage.getItem('taquigrafo:' + k);
      return s ? JSON.parse(s) : padrao;
    } catch (e) { return padrao; }
  };

  // DOM sem innerHTML: o YouTube exige Trusted Types e recusa HTML em string
  function el(tag, props = {}, filhos = []) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(filhos) ? filhos : [filhos]).forEach((f) => f && e.append(f));
    return e;
  }

  // a live abre em /watch?v=, /live/ID ou na página do canal (/@canal/live); o player sabe o ID nos três
  const PAGINA_DE_VIDEO = /\/watch|\/live(\/|$)/;
  const idDoVideo = () => {
    if (DEMO) return 'demo';
    const u = new URL(location.href);
    const flexy = document.querySelector('ytd-watch-flexy[video-id]');
    return u.searchParams.get('v') || (u.pathname.match(/\/(?:live|shorts)\/([\w-]{6,})/) || [])[1] || (flexy && flexy.getAttribute('video-id')) || u.pathname;
  };
  const hora = () => new Date().toLocaleTimeString('pt-BR');
  const tempoVideo = () => {
    const v = $('video');
    // vídeo vindo de fluxo de mídia (a demonstração) não tem um tempo que signifique algo
    if (!v || !isFinite(v.currentTime) || v.srcObject) return '';
    const s = Math.floor(v.currentTime);
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x, i) => (i ? String(x).padStart(2, '0') : x)).join(':').replace(/^0:/, '');
  };

  /* ---------- estado ---------- */

  const estado = {
    video: null,
    fontes: { legenda: 'procurando', chat: 'procurando', tela: 'desligada', voz: 'desligada' }
  };
  const transcricao = new Transcricao();
  const vozTexto = new Transcricao();
  let chat = new Chat();
  const caderno = new Caderno({
    hora: () => hora(),
    tempo: () => tempoVideo(),
    aoNovo: (nota) => {
      salvar();
      if (nota.tipo === 'palavra') {
        bipe(true);
        const f = nota.fontes[0];
        notificar('Taquígrafo: ' + nota.palavra, (f === 'chat' ? 'Do chat' : f === 'tela' ? 'Na tela' : 'Falada') + ' às ' + nota.hora + (nota.trecho ? ' — “' + nota.trecho.slice(-90) + '”' : ''));
      } else bipe(false);
      pintar(nota);
    },
    aoMudar: () => { salvar(); pintar(); }
  });

  function carregar() {
    estado.video = idDoVideo();
    caderno.notas = ler('notas:' + estado.video, []);
    caderno.marcas.clear();
    caderno.janela = null;
    caderno.ultimoAviso = 0;
    transcricao.palavras = []; transcricao.cortadas = 0;
    vozTexto.palavras = []; vozTexto.cortadas = 0;
    ccLigadoEm = 0; legendaVistaEm = 0;
    estado.fontes.legenda = 'procurando';
    chat = new Chat();
    pintar();
  }
  const salvar = () => guardar('notas:' + estado.video, caderno.notas.slice(-60));

  /* ---------- alertas ---------- */

  let audioCtx = null;
  function bipe(forte) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const notas = forte ? [880, 1175, 1568] : [660];
      notas.forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = f;
        o.type = 'sine';
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * 0.14);
        g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + i * 0.14 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + i * 0.14 + 0.22);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + i * 0.14);
        o.stop(audioCtx.currentTime + i * 0.14 + 0.25);
      });
    } catch (e) { /* sem som, segue */ }
  }
  function notificar(titulo, texto) {
    try {
      if (typeof GM_notification === 'function') GM_notification({ title: titulo, text: texto, timeout: 15000 });
      else if (window.Notification && Notification.permission === 'granted') new Notification(titulo, { body: texto });
    } catch (e) { /* segue */ }
  }

  /* ---------- texto falado ---------- */

  const esperas = {};
  function processarTexto(fonte, acrescimo, base) {
    if (!acrescimo.length) return;
    caderno.texto(fonte, base, acrescimo);
    // a última palavra dita pode estar pela metade: espera 3 s de silêncio e olha de novo
    clearTimeout(esperas[fonte]);
    esperas[fonte] = setTimeout(() => caderno.texto(fonte, base, [], true), 3000);
    pintarAoVivo();
  }

  /* ---------- fonte 1: legenda automática ---------- */

  let ultimaLegenda = '';
  let legendaVistaEm = 0;
  let ccTentado = '';
  let ccLigadoEm = 0;
  function lerLegenda() {
    const segs = document.querySelectorAll('.ytp-caption-window-container .ytp-caption-segment, .caption-window .ytp-caption-segment');
    const texto = Array.from(segs).map((s) => s.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (texto && texto !== ultimaLegenda) {
      ultimaLegenda = texto;
      legendaVistaEm = Date.now();
      estado.fontes.legenda = 'ouvindo';
      processarTexto('legenda', transcricao.adicionar(texto), transcricao);
    }
  }
  function ligarCC() {
    const b = $('.ytp-subtitles-button');
    if (!b) return;
    const titulo = normal(b.getAttribute('data-title-no-tooltip') || b.getAttribute('title') || b.getAttribute('aria-label') || '');
    if (/nao ha|indisponi|unavailable|not available/.test(titulo)) { estado.fontes.legenda = 'sem legenda'; return; }
    if (b.getAttribute('aria-pressed') === 'false' && ccTentado !== estado.video) { ccTentado = estado.video; b.click(); }
    if (!ccLigadoEm && b.getAttribute('aria-pressed') === 'true') ccLigadoEm = Date.now();
    // o botão existe mas nada chega: a live não gera legenda (o canal desligou ou o modo de transmissão não tem)
    const v = $('video');
    const tocando = v && !v.paused && !document.querySelector('.ad-showing');
    if (estado.fontes.legenda === 'procurando' && ccLigadoEm && tocando && !legendaVistaEm && Date.now() - ccLigadoEm > 45000) {
      estado.fontes.legenda = 'sem legenda — ligue a Voz';
    }
  }

  /* ---------- fonte 2: chat ao vivo ---------- */

  let chatDoc = null;
  let chatObs = null;
  const vistas = new WeakSet();
  function lerMensagem(no) {
    if (!no || vistas.has(no) || no.tagName !== 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER') return;
    vistas.add(no);
    const texto = (no.querySelector('#message') || {}).textContent || '';
    const autor = (no.querySelector('#author-name') || {}).textContent || '';
    const papel = no.getAttribute('author-type') || '';
    caderno.chat(chat.mensagem({ autor: autor.trim(), texto: texto.trim(), papel }), autor.trim(), texto.trim(), papel);
  }
  function ligarChat() {
    const f = $('#chatframe');
    let d = null;
    try { d = f && f.contentDocument; } catch (e) { d = null; }
    if (!d || !d.body) { estado.fontes.chat = f ? 'procurando' : 'sem chat'; return; }
    if (d === chatDoc) return;
    chatDoc = d;
    if (chatObs) chatObs.disconnect();
    // mensagens que já estavam na tela entram na contagem, mas não disparam alerta antigo
    d.querySelectorAll('yt-live-chat-text-message-renderer').forEach((n) => vistas.add(n));
    chatObs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER') lerMensagem(n);
      else n.querySelectorAll && n.querySelectorAll('yt-live-chat-text-message-renderer').forEach(lerMensagem);
    })));
    chatObs.observe(d.body, { childList: true, subtree: true });
    estado.fontes.chat = 'lendo';
    pintarAoVivo();
  }

  /* ---------- motor (tela e voz): página à parte, sem as restrições do YouTube ---------- */

  let motor = null, motorPronto = null;
  const origemMotor = new URL(MOTOR).origin;
  function abrirMotor() {
    if (motorPronto) return motorPronto;
    motorPronto = new Promise((ok, falha) => {
      motor = el('iframe', { src: MOTOR, title: 'Taquígrafo (motor)', 'aria-hidden': 'true', allow: 'autoplay', style: 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none' });
      const t = setTimeout(() => falha(new Error('o motor não respondeu')), 20000);
      const ouvir = (ev) => {
        if (ev.origin !== origemMotor || ev.source !== motor.contentWindow) return;
        if (ev.data && ev.data.tipo === 'pronto') { clearTimeout(t); ok(); }
      };
      window.addEventListener('message', ouvir);
      motor.addEventListener('load', () => paraMotor({ tipo: 'ola' }));
      document.body.append(motor);
    });
    window.addEventListener('message', (ev) => {
      if (ev.origin !== origemMotor || !motor || ev.source !== motor.contentWindow || !ev.data) return;
      const m = ev.data;
      if (m.tipo === 'ocr') receberOCR(m);
      if (m.tipo === 'voz') receberVoz(m);
      if (m.tipo === 'estado') { estado.fontes[m.fonte] = m.texto; pintarAoVivo(); }
    });
    return motorPronto;
  }
  const paraMotor = (msg, transferir) => motor && motor.contentWindow.postMessage(msg, origemMotor, transferir || []);

  /* ---------- fonte 3: tela (OCR no motor) ---------- */

  let telaTimer = null, telaOcupada = false, ultimoQuadro = null, ultimoOCR = 0;
  const pequena = document.createElement('canvas');
  pequena.width = 64; pequena.height = 36;
  function mudouTela(v) {
    const g = pequena.getContext('2d', { willReadFrequently: true });
    g.drawImage(v, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data;
    const primeiro = !ultimoQuadro;
    let dif = 0;
    if (!primeiro) for (let i = 0; i < d.length; i += 4) dif += Math.abs(d[i] - ultimoQuadro[i]) + Math.abs(d[i + 1] - ultimoQuadro[i + 1]);
    ultimoQuadro = new Uint8ClampedArray(d);
    return primeiro || dif / (64 * 36) > 6;
  }
  async function olharTela() {
    const v = $('video');
    if (telaOcupada || !v || v.readyState < 2 || !v.videoWidth) return;
    let mudou;
    try { mudou = mudouTela(v); } catch (e) { estado.fontes.tela = 'vídeo protegido'; pintarAoVivo(); return; }
    if (!mudou && Date.now() - ultimoOCR < 15000) return;
    telaOcupada = true;
    ultimoOCR = Date.now();
    const c = document.createElement('canvas');
    const w = Math.min(1600, v.videoWidth);
    c.width = w; c.height = Math.round(w * v.videoHeight / v.videoWidth);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    const img = await createImageBitmap(c);
    paraMotor({ tipo: 'ocr', imagem: img }, [img]);
    setTimeout(() => { telaOcupada = false; }, 20000);
  }
  function receberOCR(m) {
    telaOcupada = false;
    if (!m.texto) return;
    caderno.tela(m.texto, m.confianca);
    estado.fontes.tela = 'olhando';
    pintarAoVivo();
  }
  async function alternarTela() {
    if (telaTimer) { clearInterval(telaTimer); telaTimer = null; estado.fontes.tela = 'desligada'; pintarAoVivo(); return; }
    estado.fontes.tela = 'abrindo motor…';
    pintarAoVivo();
    try {
      await abrirMotor();
      paraMotor({ tipo: 'ocr-iniciar' });
      telaTimer = setInterval(olharTela, 3000);
    } catch (e) { estado.fontes.tela = 'motor bloqueado'; pintarAoVivo(); }
  }

  /* ---------- fonte 4: voz (Vosk no motor, para live sem legenda) ---------- */

  let voz = null;
  async function alternarVoz() {
    if (voz) {
      voz.proc.disconnect(); voz.fonte.disconnect(); voz.ctx.close();
      paraMotor({ tipo: 'voz-parar' });
      voz = null;
      estado.fontes.voz = 'desligada';
      pintarAoVivo();
      return;
    }
    const v = $('video');
    if (!v) return;
    estado.fontes.voz = 'abrindo motor…';
    pintarAoVivo();
    try {
      await abrirMotor();
      const ctx = new AudioContext();
      await ctx.resume();
      const stream = v.srcObject instanceof MediaStream ? v.srcObject : v.captureStream ? v.captureStream() : v.mozCaptureStream();
      if (!stream.getAudioTracks().length) throw new Error('sem áudio');
      const fonte = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const passo = ctx.sampleRate / 16000;
      proc.onaudioprocess = (ev) => {
        // reduz para 16 kHz (o que o Vosk usa) antes de mandar: 3x menos dados
        const ent = ev.inputBuffer.getChannelData(0);
        const sai = new Float32Array(Math.floor(ent.length / passo));
        for (let i = 0; i < sai.length; i++) sai[i] = ent[Math.floor(i * passo)];
        paraMotor({ tipo: 'audio', dados: sai }, [sai.buffer]);
      };
      fonte.connect(proc);
      proc.connect(ctx.destination);
      voz = { ctx, fonte, proc };
      paraMotor({ tipo: 'voz-iniciar', sampleRate: 16000 });
    } catch (e) {
      estado.fontes.voz = e.message === 'sem áudio' ? 'vídeo sem áudio' : 'não deu: ' + e.message;
      pintarAoVivo();
    }
  }
  function receberVoz(m) {
    if (m.final && m.texto) processarTexto('voz', vozTexto.adicionar(m.texto), vozTexto);
    if (m.parcial !== undefined) { estado.parcial = m.parcial; pintarAoVivo(); }
  }

  /* ---------- painel: bloco de taquigrafia ---------- */

  const CSS = `
  #taquigrafo{position:fixed;left:18px;bottom:18px;width:310px;z-index:2147483000;font:13px/1.4 "Segoe UI",system-ui,sans-serif;color:#1f2a1c;
    background:#eef3e0;border-radius:4px 4px 6px 6px;box-shadow:0 16px 40px -10px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.12);overflow:hidden}
  #taquigrafo *{box-sizing:border-box}
  #taquigrafo .tq-espiral{height:22px;background:#2b3a28;position:relative;cursor:move;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 10px}
  #taquigrafo .tq-espiral::before{content:"";position:absolute;left:0;right:0;bottom:-7px;height:14px;
    background:radial-gradient(circle at 50% 50%,#c9c9c1 0 3.2px,#6d6d66 3.4px 4.6px,transparent 4.8px) 4px 0/15px 14px repeat-x;pointer-events:none}
  #taquigrafo .tq-nome{color:#e8eedb;font:700 11px/1 "Consolas","Courier New",monospace;letter-spacing:.18em}
  #taquigrafo .tq-bt{background:none;border:0;color:#e8eedb;cursor:pointer;font:600 14px/1 system-ui;padding:2px 4px}
  #taquigrafo .tq-folha{background:repeating-linear-gradient(#eef3e0 0 23px,#b8d0c4 23px 24px);background-position:0 6px;
    padding:12px 12px 10px;max-height:58vh;overflow:auto;position:relative}
  #taquigrafo .tq-folha::before{content:"";position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(200,60,50,.35);pointer-events:none}
  #taquigrafo.tq-min .tq-folha{display:none}
  #taquigrafo .tq-fontes{display:flex;flex-wrap:wrap;gap:4px 10px;margin-bottom:8px;position:relative;z-index:1}
  #taquigrafo .tq-fonte{display:flex;align-items:center;gap:5px;font:11px/1.2 "Consolas","Courier New",monospace;background:#eef3e0;border:0;padding:1px 2px;color:#1f2a1c;cursor:default}
  #taquigrafo button.tq-fonte{cursor:pointer;text-decoration:underline dotted}
  #taquigrafo .tq-luz{width:8px;height:8px;border-radius:50%;background:#9aa394;flex:none}
  #taquigrafo .tq-luz.on{background:#2f9e44;box-shadow:0 0 0 3px rgba(47,158,68,.2)}
  #taquigrafo .tq-luz.meio{background:#e8a317}
  #taquigrafo .tq-luz.off{background:#c0392b}
  #taquigrafo .tq-agora{font:11px/1.35 "Consolas","Courier New",monospace;color:#56634f;background:#eef3e0;position:relative;z-index:1;min-height:30px;margin-bottom:8px;
    border-left:2px solid #b8d0c4;padding-left:6px;max-height:46px;overflow:hidden}
  #taquigrafo .tq-vazio{position:relative;z-index:1;background:#eef3e0;color:#56634f;font-style:italic;margin:6px 0}
  #taquigrafo .tq-nota{position:relative;z-index:1;background:#f7f9ef;border:1px solid #cfdcc7;border-radius:3px;padding:8px 9px;margin-top:8px}
  #taquigrafo .tq-nota.nova{animation:tq-pisca 1.6s ease-out 3}
  @keyframes tq-pisca{0%{background:#fff3a6}100%{background:#f7f9ef}}
  #taquigrafo .tq-palavra{font:700 22px/1.1 "Segoe Print","Bradley Hand","Comic Sans MS",cursive;color:#173b8a;word-break:break-word}
  #taquigrafo .tq-meta{font:10.5px/1.3 "Consolas","Courier New",monospace;color:#56634f;margin-top:3px;display:flex;flex-wrap:wrap;gap:2px 8px}
  #taquigrafo .tq-tag{padding:0 4px;border-radius:2px;background:#dfe9d6}
  #taquigrafo .tq-tag.alta{background:#2f9e44;color:#fff}
  #taquigrafo .tq-tag.media{background:#e8a317;color:#1f2a1c}
  #taquigrafo .tq-trecho{font-size:11.5px;color:#3c4836;margin-top:5px;max-height:5.6em;overflow:auto}
  #taquigrafo .tq-aviso{border-style:dashed;background:#fbf7e9}
  #taquigrafo .tq-aviso .tq-palavra{font-size:14px;color:#8a5a00;font-family:inherit}
  #taquigrafo .tq-acoes{display:flex;gap:6px;margin-top:6px}
  #taquigrafo .tq-mini{border:1px solid #9fb196;background:#fff;border-radius:3px;font:11px/1 system-ui;padding:4px 6px;cursor:pointer;color:#1f2a1c}
  #taquigrafo .tq-rodape{display:flex;gap:6px;justify-content:space-between;margin-top:10px;position:relative;z-index:1}
  `;

  let painel, area, agora, fontesEl;
  function montarPainel() {
    if (painel && painel.isConnected) return;
    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.append(estilo);
    agora = el('div', { class: 'tq-agora', 'aria-live': 'off' });
    fontesEl = el('div', { class: 'tq-fontes' });
    area = el('div', { 'aria-live': 'polite' });
    const min = el('button', { class: 'tq-bt', type: 'button', title: 'Minimizar', text: '–', onclick: () => { painel.classList.toggle('tq-min'); min.textContent = painel.classList.contains('tq-min') ? '+' : '–'; guardar('minimizado', painel.classList.contains('tq-min')); } });
    const topo = el('div', { class: 'tq-espiral' }, [el('span', { class: 'tq-nome', text: 'TAQUÍGRAFO' }), min]);
    const rodape = el('div', { class: 'tq-rodape' }, [
      el('button', { class: 'tq-mini', type: 'button', text: 'Exportar .txt', onclick: exportar }),
      el('button', { class: 'tq-mini', type: 'button', text: 'Limpar', onclick: () => caderno.limpar() })
    ]);
    painel = el('section', { id: 'taquigrafo', 'aria-label': 'Taquígrafo' }, [topo, el('div', { class: 'tq-folha' }, [fontesEl, agora, area, rodape])]);
    if (ler('minimizado', false)) { painel.classList.add('tq-min'); min.textContent = '+'; }
    const pos = ler('posicao', null);
    if (pos) Object.assign(painel.style, { left: Math.min(pos.x, innerWidth - 80) + 'px', top: Math.min(pos.y, innerHeight - 40) + 'px', right: 'auto', bottom: 'auto' });
    arrastavel(topo);
    document.body.append(painel);
    pintar();
  }

  function arrastavel(alca) {
    let ini = null;
    alca.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = painel.getBoundingClientRect();
      ini = { x: e.clientX - r.left, y: e.clientY - r.top };
      alca.setPointerCapture(e.pointerId);
    });
    alca.addEventListener('pointermove', (e) => {
      if (!ini) return;
      const x = Math.max(0, Math.min(innerWidth - 60, e.clientX - ini.x));
      const y = Math.max(0, Math.min(innerHeight - 30, e.clientY - ini.y));
      Object.assign(painel.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    });
    alca.addEventListener('pointerup', () => {
      if (!ini) return;
      ini = null;
      const r = painel.getBoundingClientRect();
      guardar('posicao', { x: Math.round(r.left), y: Math.round(r.top) });
    });
  }

  const LUZ = (s) => (/ouvindo|lendo|olhando|pronta|escutando/.test(s) ? 'on' : /desligad/.test(s) ? '' : /procurando|abrindo|carregando|baixando/.test(s) ? 'meio' : 'off');
  function pintarAoVivo() {
    if (!fontesEl) return;
    fontesEl.replaceChildren(...[['legenda', 'Legenda'], ['chat', 'Chat'], ['tela', 'Tela'], ['voz', 'Voz']].map(([k, rot]) => {
      const s = estado.fontes[k];
      const filhos = [el('span', { class: 'tq-luz ' + LUZ(s) }), document.createTextNode(rot + ': ' + s)];
      if (k === 'tela' || k === 'voz') {
        return el('button', { class: 'tq-fonte', type: 'button', title: k === 'tela' ? 'Ler texto que aparece no vídeo (OCR local)' : 'Reconhecer a fala sem legenda (Vosk, local; baixa ~32 MB na primeira vez)', onclick: k === 'tela' ? alternarTela : alternarVoz }, filhos);
      }
      return el('span', { class: 'tq-fonte' }, filhos);
    }));
    const fala = estado.fontes.voz !== 'desligada' && estado.parcial ? 'voz: ' + estado.parcial : transcricao.ultimas(28);
    agora.textContent = fala || 'O que for dito aparece aqui…';
  }

  function pintar(nova) {
    if (!area) return;
    pintarAoVivo();
    const notas = caderno.notas.slice().reverse();
    if (!notas.length) { area.replaceChildren(el('p', { class: 'tq-vazio', text: 'Nada anotado ainda. Quando o palestrante anunciar a palavra-chave, ela aparece aqui com som e notificação.' })); return; }
    area.replaceChildren(...notas.map((n) => {
      const aviso = n.tipo === 'aviso';
      const meta = el('div', { class: 'tq-meta' }, [
        el('span', { text: n.hora + (n.tempo ? ' · vídeo ' + n.tempo : '') }),
        el('span', { class: 'tq-tag', text: n.fontes.map((f) => ({ legenda: 'falada', chat: 'chat', tela: 'na tela', voz: 'voz' }[f] || f)).join(' + ') }),
        aviso ? null : el('span', { class: 'tq-tag ' + n.confianca, text: n.confianca === 'alta' ? 'confiável' : 'confira' }),
        n.vezes > 1 ? el('span', { text: n.vezes + '×' }) : null,
        n.soletrada ? el('span', { text: 'soletrada' }) : null,
        n.motivo ? el('span', { text: n.motivo }) : null
      ]);
      const acoes = aviso ? null : el('div', { class: 'tq-acoes' }, [
        el('button', { class: 'tq-mini', type: 'button', text: 'Copiar', onclick: (e) => copiar(n.palavra, e.target) })
      ]);
      return el('article', { class: 'tq-nota' + (aviso ? ' tq-aviso' : '') + (n === nova ? ' nova' : '') }, [
        el('div', { class: 'tq-palavra', text: aviso ? 'Atenção: a palavra vai ser dita' : n.palavra }),
        meta,
        n.trecho ? el('div', { class: 'tq-trecho', text: '“' + n.trecho.slice(-320) + '”' }) : null,
        acoes
      ]);
    }));
  }

  function copiar(texto, botao) {
    try {
      if (typeof GM_setClipboard === 'function') GM_setClipboard(texto);
      else navigator.clipboard.writeText(texto);
      botao.textContent = 'Copiado';
      setTimeout(() => { botao.textContent = 'Copiar'; }, 1500);
    } catch (e) { botao.textContent = 'Não deu'; }
  }

  function exportar() {
    const titulo = (document.title || '').replace(/ - YouTube$/, '');
    const linhas = ['Taquígrafo — ' + titulo, location.href, ''];
    caderno.notas.forEach((n) => {
      linhas.push(n.tipo === 'aviso' ? `[${n.hora}] AVISO de palavra-chave` : `[${n.hora}] ${n.palavra}  (${n.fontes.join(' + ')}, ${n.confianca === 'alta' ? 'confiável' : 'confira'}${n.vezes > 1 ? ', ' + n.vezes + 'x' : ''})`);
      if (n.trecho) linhas.push('    “' + n.trecho + '”');
    });
    const blob = new Blob([linhas.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'palavras-chave-' + estado.video + '.txt' });
    document.body.append(a);
    a.click();
    a.remove();
  }

  /* ---------- ciclo ---------- */

  let obsLegenda = null, alvoLegenda = null;
  function vigiar() {
    if (!PAGINA_DE_VIDEO.test(location.pathname) && !DEMO) { if (painel) painel.style.display = 'none'; return; }
    if (painel) painel.style.display = '';
    montarPainel();
    if (idDoVideo() !== estado.video) carregar();
    ligarCC();
    const player = $('#movie_player');
    if (player && player !== alvoLegenda) {
      alvoLegenda = player;
      if (obsLegenda) obsLegenda.disconnect();
      let pendente = false;
      obsLegenda = new MutationObserver(() => {
        if (pendente) return;
        pendente = true;
        setTimeout(() => { pendente = false; lerLegenda(); }, 120);
      });
      obsLegenda.observe(player, { childList: true, subtree: true, characterData: true });
    }
    if (estado.fontes.legenda === 'ouvindo' && Date.now() - legendaVistaEm > 90000) estado.fontes.legenda = 'silêncio';
    ligarChat();
    pintarAoVivo();
  }

  if (!DEMO && window.Notification && Notification.permission === 'default' && typeof GM_notification !== 'function') Notification.requestPermission();
  window.addEventListener('yt-navigate-finish', () => setTimeout(vigiar, 800));
  setInterval(vigiar, 2500);
  vigiar();
  if (DEMO) {
    window.Taquigrafo = {
      ...API, estado, alternarTela, alternarVoz,
      caderno,
      limpar: () => { caderno.limpar(); carregar(); ultimaLegenda = ''; chatDoc = null; }
    };
  }
})();
