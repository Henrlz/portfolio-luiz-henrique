/* Modo link: a live abre num iframe com a legenda forçada, a pessoa compartilha esta aba
   e a página lê a própria imagem (legenda e slides, com Tesseract) e o próprio som (Whisper).
   O chat, se houver chave, vem da API gratuita do YouTube. As regras de anotar são as
   mesmas do script do Tampermonkey (TaquigrafoNucleo). */

(function () {
  'use strict';

  const N = window.TaquigrafoNucleo;
  const $ = (s) => document.querySelector(s);
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
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
  // a fita guarda a transcrição inteira; salva no navegador sem pressa (a cada poucos segundos)
  let guardaFita = null;
  const fita = new window.TaquigrafoFita.Fita($('#fita'), {
    nucleo: N, hora,
    aoMudar: () => {
      const n = fita ? fita.itens.reduce((s, it) => s + (it.palavras ? it.palavras.length : 0), 0) : 0;
      $('#contagem').textContent = n + (n === 1 ? ' palavra' : ' palavras');
      clearTimeout(guardaFita);
      guardaFita = setTimeout(() => guardavel() && guardar('fita:' + estado.id, fita.dados()), 3000);
    }
  });
  const caderno = new N.Caderno({
    hora,
    aoNovo: (nota) => {
      salvar();
      // lendo uma gravação inteira, as palavras saem todas de uma vez: sem apito nem notificação
      if (!importando) bipe(nota.tipo === 'palavra');
      if (nota.tipo === 'palavra') { if (!importando) notificar(nota); fita.carimbar(nota); }
      pintarNotas(nota);
    },
    // grafia trocada por uma fonte mais confiável: o carimbo da fita acompanha
    aoMudar: () => { salvar(); pintarNotas(); caderno.notas.forEach((n) => n.tipo === 'palavra' && fita.carimbar(n)); }
  });
  const guardavel = () => estado.id && !String(estado.id).startsWith('gravacao-');
  const salvar = () => guardavel() && guardar('notas:' + estado.id, caderno.notas.slice(-60));

  // texto novo de uma fonte de fala: vai para a fita e devolve o acréscimo para procurar a palavra.
  // Com a legenda chegando, a voz não imprime (seria o mesmo texto duas vezes)
  function ouvir(fonte, base, txt, inteiro = false, dito = Date.now()) {
    const antes = base.cortadas + base.palavras.length;
    const acr = inteiro ? base.acrescentar(txt) : base.adicionar(txt);
    const removidas = antes + acr.length - (base.cortadas + base.palavras.length);
    if (fonte === 'legenda' || dito - legendaVistaEm > 20000) fita.receber(fonte, acr, removidas);
    return acr;
  }

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
    if (importando) return;
    parar();
    estado.id = id;
    caderno.notas = ler('notas:' + id, []);
    caderno.marcas.clear();
    caderno.janela = null;
    legenda.palavras = []; legenda.cortadas = 0;
    vozTexto.palavras = []; vozTexto.cortadas = 0;
    chat = new N.Chat();
    fita.restaurar(ler('fita:' + id, null));
    prepararLeitor().catch(() => {});
    $('#player').src = src;
    $('#boasVindas').hidden = true;
    $('#palco').hidden = false;
    $('#moldura').hidden = false; $('#painel').hidden = false; $('#resumoGravado').hidden = true;
    estado.fontes.legenda = 'parada';
    pintarLuzes();
    pintarNotas();
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
      // em silêncio: o som da aba é capturado (a voz continua ouvindo) mas não sai no alto-falante
      audio: { suppressLocalAudioPlayback: $('#optSilencio').checked },
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
  // "lendo": o Tesseract está ocupado (um só, para legenda e slides); "preparando": a faixa está no worker
  let leitor = null, lendo = false, preparando = false;
  // "sessao" muda a cada Parar/troca de live: leitura que termina depois é de outra sessão
  let sessao = 0;
  // o leitor (uns 15 MB na primeira vez) começa a baixar quando a live abre: se só baixasse no
  // "Começar", a palavra dita nos primeiros segundos passava antes de ele ficar pronto
  function prepararLeitor() {
    if (!leitor) leitor = carregar(TESSERACT).then(() => window.Tesseract.createWorker('por'));
    leitor.catch(() => { leitor = null; });
    return leitor;
  }
  // A legenda do YouTube sobe animada: o quadro pego no meio da subida tem letras cortadas ao meio
  // e o leitor devolve lixo ("WIIIIIDITO", "qUvf", "1S5So"). Fica só o que o leitor leu com
  // confiança e tem cara de palavra; linha com pouca confiança sai inteira.
  const LINHA_MIN = 55, PALAVRA_MIN = 40;
  // siglas de duas ou três letras que aparecem em aula (e podem ser a palavra-chave)
  const SIGLAS = /^(?:IA|TI|RH|QI|UX|UI|TV|PC|ONG|SUS|TCC|TDAH|TEA|TOC|CRP|CFP|DSM|CID|ABA|EAD)$/;
  function pareceLixo(w) {
    const p = w.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
    if (!p) return true;
    if (SIGLAS.test(p)) return false;
    // formas de verdade que parecem estranhas: e/ou, aluno(a), ChatGPT, YouTube, iPhone,
    // COVID-19, DSM-5, 14h30, 5G, 1º, A-C-O-L-H-E-R
    if (/^\p{L}+\/\p{L}+$/u.test(p) || /^\p{L}+\((?:a|o|as|os|es)\)$/u.test(w.replace(/[.,;:!?]+$/, ''))) return false;
    // marca: começa com maiúscula e minúsculas (ou "i"/"e": iPhone, eBay) e cada pedaço seguinte
    // tem duas ou mais minúsculas ou é sigla (GPT). "qUvf" e "dIyx" não passam
    if (/^(?:\p{Lu}\p{Ll}{2,}|[ie])(?:\p{Lu}\p{Ll}{2,}|\p{Lu}{2,})+$/u.test(p)) return false;
    if (/^\p{L}{2,}-\d{1,3}$/u.test(p) || /^\d{1,2}h(?:\d{2})?$/.test(p) || /^\d\p{Lu}$/u.test(p) || /^\d{1,2}[ªºao°]$/.test(p)) return false;
    if (/^(?:\p{L}-){2,}\p{L}$/u.test(p)) return false;
    // o relógio do player ("0:35", "1:02:33"), se aparecer
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(p)) return true;
    if (/[%[\]{}()<>|\\/~^_=+*#@$&"”“]/.test(p)) return true;
    if (/(\p{L})\1\1/iu.test(p)) return true;
    if (/^(\p{L})\1+$/u.test(N.normal(p))) return true; // "Áá", "aa"
    if (/\p{Ll}\p{Lu}/u.test(p)) return true;
    if (/[bcdfghjklmnpqrstvwxzç]{5,}/i.test(N.normal(p))) return true;
    if (/\d/.test(p) && /\p{L}/u.test(p)) return true;
    return false;
  }
  // a palavra antes do número diz se ele é parte de um anúncio ("número 2", "palavra-chave 3:")
  const ANTES_DE_NUMERO = /^(?:numero|n[oº°.]?|palavra|palavras|palavrachave|chave|parte|aula|item)$/;
  // e a de depois diz se é uma quantidade de verdade ("4 sessões", "10 minutos")
  const DEPOIS_DE_NUMERO = /^(?:segundos?|minutos?|horas?|dias?|semanas?|mes|meses|anos?|vezes|sessoes|sessao|pessoas?|pacientes?|alunos?|mil|milhoes?|reais|por|%|graus?|etapas?|passos?|pontos?|tipos?|formas?|coisas?|perguntas?|palavras?)$/;
  // Palavra de até três letras: o português tem poucas, e quase todo resto de letra cortada
  // é desse tamanho ("IU", "Vá", "Lis", "ua"). Só passa se estiver aqui ou for sigla conhecida
  const CURTAS = new Set(('a ao aos as e o os ou um uns uma de da do das dos em no na nos nas num numa dum se me te lhe vos eu tu ele ' +
    'ela voce ce ces vc vcs que por pra pro pros pras com sem sob mas nem ja so la ca ai ali ate ha apos eis tal ' +
    'ter ver vir ler rir dar ir ser vai vou foi fui tem vem vim sao sou era dou deu dei fez faz fiz diz pos pus vi ' +
    'viu li leu ri riu ia iam ido ida sei sai cai dai ama amo ame usa use uso age aja doi doa doe voa soa toa poe ' +
    'le ve cre tao nao mao cao pao vao dao hao mes ano dia vez bom boa mau ma sim ne ta to ok oi ola alo ah eh oh ' +
    'uh ui ue uai hum opa ops uau xi ih aha bah som sal mal bem paz luz fe mae pai lar mar sol ceu sul lua rua voz ' +
    'dor cor rei lei fim ego id elo eco oco oca ovo uva asa ave boi par bar mel fel cha mim ti si nu tom cem rim ' +
    'reu veu nua lia ria pia tia tio rio fio avo vo po pe fa noz foz ato ira ora seu sua meu teu tua dez tres dois ' +
    'seis sete oito nove mil app web pix zap pdf url tv top kit bug gol obs etc vs sr sra dr dra tb tbm ex pre ana ' +
    'eva bia leo rui ivo').split(' '));
  function textoConfiavel(r) {
    const partes = [];
    (r.linhas || []).forEach((l) => {
      if (l.conf < LINHA_MIN) return;
      const ws = l.palavras.filter((x) => /\p{L}|\d/u.test(x.texto));
      const minusculas = ws.filter((x) => x.texto !== x.texto.toUpperCase()).length;
      const linhaMinuscula = minusculas >= ws.length / 2;
      const limpo = (w) => w.replace(/[^\p{L}\d]/gu, '');
      // linha que fala de palavra-chave (ou vem logo depois de uma) pode trazer a palavra
      // curta anunciada ("a palavra-chave é ELO"): nela a lista de palavras curtas não vale
      const anuncio = /palavra|chave/.test(N.normal([partes[partes.length - 1] || '', ...ws.map((x) => x.texto)].join(' ').toLowerCase()));
      // letras soltas em sequência (três ou mais) são palavra soletrada: ficam todas
      const soletrada = new Set();
      for (let i = 0; i < ws.length;) {
        let j = i;
        while (j < ws.length && limpo(ws[j].texto).length === 1 && /\p{L}/u.test(limpo(ws[j].texto))) j++;
        if (j - i >= 3) for (let k = i; k < j; k++) soletrada.add(k);
        i = Math.max(j, i + 1);
      }
      // pedacinho maiúsculo ou número solto ("4", "H", "NX") numa legenda minúscula é quase sempre
      // resto de letra cortada: só fica se o leitor tiver muita certeza (sigla conhecida fica)
      const curtoSuspeito = (w) => { const p = limpo(w); return p.length <= 2 && linhaMinuscula && p === p.toUpperCase() && !SIGLAS.test(p); };
      // palavra comprida toda em maiúsculas numa legenda minúscula: ou é ênfase de verdade
      // (ACOLHIMENTO, UNINTER) ou lixo de letra cortada; fica se o leitor tiver certeza
      const maiusculaLonga = (w) => { const p = limpo(w); return linhaMinuscula && p.length >= 5 && p === p.toUpperCase() && /\p{L}/u.test(p); };
      // número logo depois de "número", "palavra-chave"… ou com dois-pontos é parte de anúncio
      const numeroDeAnuncio = (i) => /:/.test(ws[i].texto) || (i > 0 && ANTES_DE_NUMERO.test(N.normal(limpo(ws[i - 1].texto).toLowerCase()))) || (i + 1 < ws.length && /^:/.test(ws[i + 1].texto));
      // um caractere sozinho: letra só se existir sozinha em português (a, e, o, é, à…); número só
      // com quase certeza ou num anúncio; "1", "l" e "I" na ponta da linha são a borda da caixa
      const comecoDeFrase = (i) => i === 0 || /[.!?…]$/.test(ws[i - 1].texto);
      const solto = (x, i) => {
        const p = limpo(x.texto);
        if (soletrada.has(i)) return false;
        // número sozinho: só num anúncio ("número 2") ou antes de uma quantidade ("4 sessões")
        if (/^\d+$/.test(p)) {
          if (numeroDeAnuncio(i)) return false;
          if (p.length > 1) return false;
          const prox = i + 1 < ws.length ? N.normal(limpo(ws[i + 1].texto).toLowerCase()) : '';
          return !DEPOIS_DE_NUMERO.test(prox);
        }
        if (p.length === 1) {
          if ((i === 0 || i === ws.length - 1) && /^[lI|]$/.test(p)) return true;
          // maiúscula sozinha ("E", "A") só no começo de frase; no meio de legenda minúscula é resto
          return !(/^[aeoàé]$/.test(p) || (comecoDeFrase(i) && /^[AEOÀÉ]$/.test(p)) || (!linhaMinuscula && /^[AEOÀÉ]$/.test(p)));
        }
        // duas ou três letras: só palavra curta de verdade ou sigla
        if (!anuncio && p.length <= 3 && /^\p{L}+$/u.test(p) && !SIGLAS.test(p) && !CURTAS.has(N.normal(p).toLowerCase())) return true;
        return false;
      };
      const minimo = (x) => (curtoSuspeito(x.texto) ? 85 : maiusculaLonga(x.texto) ? 80 : PALAVRA_MIN);
      const boas = ws.filter((x, i) => soletrada.has(i) || (x.conf >= minimo(x) && !solto(x, i) && !pareceLixo(x.texto)));
      // linha em que mais da metade é lixo é quadro cortado: não aproveita nem o resto
      if (!boas.length || boas.length < ws.length * 0.5) return;
      // aspas e risquinhos soltos que o leitor gruda na palavra ("é”") saem
      const texto = boas.map((x) => x.texto.replace(/[|_~`"“”«»]/g, '')).filter(Boolean).join(' ');
      if (linhaParada(texto)) return;
      partes.push(texto);
    });
    return partes.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Slide escuro com letra branca, letreiro com o nome do palestrante, logotipo, "AO VIVO": têm a
  // cara da legenda (letra clara em fundo escuro), mas ficam PARADOS. A legenda cresce palavra por
  // palavra e some em poucos segundos. Linha que fica igual por mais de 10 s sem nunca ter crescido
  // é tirada da fita (inclusive o que já tinha entrado dela) e não entra mais.
  const fixas = [];
  const chaveDaLinha = (t) => N.normal(t).replace(/[^\p{L}\d]/gu, '');
  function parecidaLinha(a, b) {
    if (a === b) return true;
    const menor = Math.min(a.length, b.length);
    if (menor < 6 || Math.abs(a.length - b.length) > menor * 0.3) return false;
    let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = cur;
    }
    return ant[b.length] <= Math.max(a.length, b.length) * 0.15;
  }
  function linhaParada(texto) {
    const agora = Date.now();
    const chave = chaveDaLinha(texto);
    if (chave.length < 6) return false;
    // A leitura só acontece quando a faixa muda: numa pausa da fala ninguém é visto, e isso não
    // quer dizer que saiu. Letreiro já reconhecido fica lembrado por 5 min; o resto, por 20 s
    for (let i = fixas.length - 1; i >= 0; i--) if (agora - fixas[i].ultima > (fixas[i].parada ? 300000 : 20000)) fixas.splice(i, 1);
    // ela mesma crescendo (legenda: a linha de baixo ganha palavra), mesmo que só um pouco;
    // depois, a mesma linha lida de novo (com erro de leitura)
    const cresceu = fixas.find((x) => !x.parada && chave.length >= x.chave.length + 2 && chave.startsWith(x.chave.slice(0, Math.max(6, x.chave.length - 2))));
    if (cresceu) { cresceu.legenda = true; cresceu.chave = chave; cresceu.ultima = agora; return false; }
    let f = fixas.find((x) => parecidaLinha(x.chave, chave));
    // "desde": quantas palavras a transcrição tinha quando a linha apareceu (só o que entrou
    // depois disso pode ter vindo dela)
    if (!f) { f = { chave, texto, primeira: agora, ultima: agora, vistas: 0, legenda: false, parada: false, desde: legenda.cortadas + legenda.palavras.length }; fixas.push(f); }
    f.ultima = agora; f.vistas++;
    if (!f.legenda && !f.parada && agora - f.primeira > 10000 && f.vistas >= 6) {
      f.parada = true;
      tirarDaFita(f.texto, f.desde);
    }
    return f.parada;
  }
  // tira da transcrição (e da fita) o que entrou de uma linha parada nos primeiros segundos
  // (só do que entrou depois que ela apareceu: a mesma frase dita antes pela pessoa fica)
  function tirarDaFita(texto, desde) {
    const alvo = texto.split(/\s+/).map(chaveDaLinha).filter(Boolean);
    if (alvo.length < 2) return;
    const ws = legenda.palavras;
    const limite = Math.max(0, ws.length - 250, desde - legenda.cortadas - 2);
    let tiradas = 0;
    for (let ini = ws.length - alvo.length; ini >= limite; ini--) {
      let iguais = 0;
      for (let k = 0; k < alvo.length; k++) if (chaveDaLinha(ws[ini + k] || '') === alvo[k]) iguais++;
      if (iguais >= alvo.length * 0.7) { ws.splice(ini, alvo.length); tiradas++; }
    }
    for (let n = 0; n < tiradas && fita.apagar(texto); n++) { /* pode ter entrado mais de uma vez */ }
  }
  const leituras = []; // as últimas leituras da legenda (o que veio e o que ficou), para conferir

  async function ocr(imagem, psm) {
    const w = await prepararLeitor();
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const r = await w.recognize(imagem);
    return {
      texto: r.data.text, confianca: r.data.confidence,
      palavras: (r.data.words || []).map((x) => ({ texto: x.text, conf: x.confidence })),
      linhas: (r.data.lines || []).map((l) => ({ conf: l.confidence, palavras: (l.words || []).map((x) => ({ texto: x.text, conf: x.confidence })) }))
    };
  }

  /* ---------- fonte 1: a legenda, lida da imagem ---------- */

  const faixa = document.createElement('canvas');
  let ultimoTextoLegenda = '', legendaVistaEm = 0;

  // A limpeza da imagem (pixel a pixel, ~2400 px de largura) roda num Web Worker: na página ela
  // travava o vídeo quase uma vez por segundo. Aqui só se recorta e amplia o quadro (o navegador
  // faz isso fora da página) e se recebe a faixa pronta para o leitor.
  const limpador = new Worker(new URL('js/faixa.js', location.href));
  // (o YouTube ainda mostra a barra uns segundos depois que o mouse sai)
  let sobrePlayer = false, saiuDoPlayer = null;
  // (o mouse parado em cima do player: o YouTube esconde a barra em uns 3 s e a legenda desce de
  // novo; dentro do iframe o movimento não chega aqui, então a faixa volta ao normal sozinha)
  $('#moldura').addEventListener('mouseenter', () => { clearTimeout(saiuDoPlayer); sobrePlayer = true; saiuDoPlayer = setTimeout(() => { sobrePlayer = false; }, 4000); });
  $('#moldura').addEventListener('mouseleave', () => { clearTimeout(saiuDoPlayer); saiuDoPlayer = setTimeout(() => { sobrePlayer = false; }, 3000); });
  let pedido = null;
  limpador.onmessage = (ev) => { const p = pedido; pedido = null; if (p) p(ev.data); };
  async function prepararFaixa(sempre = false) {
    const R = regiaoPlayer();
    // até quase o pé do vídeo: a linha de baixo da legenda do YouTube encosta lá, e o p, o q e o g
    // que passassem do corte sumiam ("práticas" virava "ráticas")
    // (com o mouse em cima do player, a barra de controles aparece no pé e a legenda sobe acima
    // dela: a faixa para antes da barra, senão o relógio e os ícones entravam na leitura)
    const sy = R.y + R.h * 0.52, sh = R.h * (sobrePlayer ? 0.36 : 0.46);
    // a letra da legenda tem uns 20 px na tela; o Tesseract lê melhor com ela bem maior
    const escala = Math.max(1, Math.min(3, 2400 / R.w));
    const quadro = await createImageBitmap(videoAba, R.x, sy, R.w, sh, { resizeWidth: Math.round(R.w * escala), resizeHeight: Math.round(sh * escala), resizeQuality: 'high' });
    const r = await new Promise((ok) => { pedido = ok; limpador.postMessage({ quadro, escala, alturaPlayer: R.h, margem: 24, sempre }, [quadro]); });
    // mostra o que está sendo lido, para quem quiser conferir
    faixa.width = r.imagem.width; faixa.height = r.imagem.height;
    faixa.getContext('2d').drawImage(r.imagem, 0, 0);
    const e = $('#espiarCanvas');
    e.getContext('2d').drawImage(r.imagem, 0, 0, e.width, e.height);
    r.imagem.close();
    return r;
  }

  // A legenda fica alguns segundos na tela e é lida várias vezes; o leitor às vezes erra uma letra
  // ("ACOLHIVAENTO"). Junta as leituras do mesmo anúncio e anota a mais frequente de cada palavra
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
  // Live pode ter várias palavras ("…são acolhimento, vínculo e escuta"): as leituras parecidas
  // formam um grupo, cada grupo vira uma anotação, na ordem em que apareceram
  function apurar() {
    if (!urna) return;
    const grupos = [];
    urna.votos.forEach((v, p) => {
      const g = grupos.find((x) => N.parecidas(x[0][0], p));
      if (g) g.push([p, v]); else grupos.push([[p, v]]);
    });
    grupos.forEach((g) => {
      const [palavra, v] = g.slice().sort((a, b) => b[1].n - a[1].n || b[1].conf - a[1].conf)[0];
      const total = g.reduce((s, x) => s + x[1].n, 0);
      caderno.anotar({ palavra, fonte: 'legenda', trecho: urna.trecho, confianca: v.n >= 2 && v.n / total >= 0.5 ? 'alta' : 'media', motivo: total > 1 ? `${v.n} de ${total} leituras` : '' });
    });
    urna = null;
  }

  const esperas = {};
  function texto(fonte, base, acrescimo) {
    if (!acrescimo.length) return;
    caderno.texto(fonte, base, acrescimo);
    clearTimeout(esperas[fonte]);
    esperas[fonte] = setTimeout(() => caderno.texto(fonte, base, [], true), 3000);
  }

  async function lerLegenda() {
    if (lendo || preparando || !videoAba || videoAba.readyState < 2) return;
    const minha = sessao;
    preparando = true;
    let f;
    try {
      f = await prepararFaixa();
      // A legenda acabou de subir (mudou quase toda): o quadro pode ter pego a animação no meio,
      // com as letras cortadas ao meio. Espera ela parar e lê o quadro parado
      for (let i = 0; f.mudou && f.quanto > 0.3 && i < 3 && videoAba; i++) {
        await new Promise((ok) => setTimeout(ok, 130));
        if (!videoAba) break;
        const outro = await prepararFaixa(true);
        outro.mudou = true;
        f = outro;
        if (outro.quanto < 0.12) break;
      }
    } catch (e) { return; } finally { preparando = false; }
    // o leitor de slides pegou a vez: este quadro não será lido agora, então o próximo tem de
    // contar como novo (senão, com a legenda parada, ele nunca seria lido)
    if (lendo) { limpador.postMessage({ zerar: true }); return; }
    if (!estado.rodando || minha !== sessao) return;
    if (urna && Date.now() - urna.inicio > 6000) apurar();
    if (f.tinta < 0.002) {
      apurar();
      if (estado.fontes.legenda === 'lendo' && Date.now() - legendaVistaEm > 90000) { estado.fontes.legenda = 'sem legenda na tela'; pintarLuzes(); }
      return;
    }
    if (!f.mudou) {
      // legenda parada há 2 s com a palavra no fim (o palestrante fez uma pausa): agora ela não muda mais
      if (pendentes.length && Date.now() - legendaVistaEm > 2000) { pendentes.forEach((p) => votar(p.palavra, p.conf, p.trecho)); pendentes = []; }
      return;
    }
    lendo = true;
    try {
      const r = await ocr(f.blob, '6');
      // parou ou trocou de live enquanto o leitor trabalhava: esta leitura é da sessão anterior
      if (minha !== sessao || !estado.rodando) return;
      const t = textoConfiavel(r);
      leituras.push({ quando: Date.now(), bruto: r.texto, linhas: r.linhas, t });
      if (leituras.length > 400) leituras.shift();
      if (t && t !== ultimoTextoLegenda) {
        ultimoTextoLegenda = t;
        legendaVistaEm = Date.now();
        if (estado.fontes.legenda !== 'lendo') { estado.fontes.legenda = 'lendo'; pintarLuzes(); }
        // texto corrido só para mostrar e para o trecho do aviso; a palavra sai da votação de cada leitura
        const novas = ouvir('legenda', legenda, t);
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
        const jaSaiu = caderno.notas.some((n) => n.tipo === 'palavra' && Date.now() - n.quando < 45000);
        const janelaAntes = caderno.janela;
        if ((d.aviso || d.mencao) && !d.achados.length && !jaSaiu && !urna) caderno.abrirJanela('legenda', t);
        // janela aberta agora já tem a legenda inteira; só as anteriores crescem com as palavras novas
        const j = caderno.janela === janelaAntes ? caderno.janela : null;
        // depois de um aviso, o trecho guardado cresce só com as palavras novas (não a legenda inteira de novo)
        if (j && j.fonte === 'legenda' && Date.now() - j.inicio < 120000 && novas.length) { j.texto = (j.texto + ' ' + novas.join(' ')).slice(-900); j.nota.trecho = j.texto; salvar(); pintarNotas(); }
      }
    } catch (e) {
      estado.fontes.legenda = 'erro: ' + e.message; pintarLuzes();
    } finally { lendo = false; }
  }

  /* ---------- fonte 2: slides ---------- */

  const quadro = document.createElement('canvas');
  let ultimoSlide = null, ultimoSlideEm = 0;
  async function lerSlide() {
    if (lendo || preparando || !videoAba || !$('#optTela').checked) return;
    const minha = sessao;
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
      if (minha !== sessao || !estado.rodando) return;
      caderno.tela(r.texto, r.confianca);
      estado.fontes.tela = 'olhando'; pintarLuzes();
    } catch (e) { estado.fontes.tela = 'erro: ' + e.message; pintarLuzes(); } finally { lendo = false; }
  }

  /* ---------- fonte 3: voz (Whisper, no som da aba) ---------- */

  // O Whisper ouve bem melhor que o Vosk ("IA" não vira "praia"), mas pesa: roda no worker
  // js/ouvido.js. Aqui o som da aba é cortado em trechos de fala (pela energia: começa quando
  // sobe, termina numa pausa) e cada trecho vai para lá.
  const MODELO_VOZ = 'onnx-community/whisper-base';
  const TAXA = 16000;
  let voz = null, ouvido = null, ouvidoPronto = null, ultimoOuvido = '', ultimaDica = '', ligandoVoz = false;
  const ouvidoLog = []; // o que o Whisper devolveu (e quanto demorou), para conferir
  let pedidos = 0; // número de cada trecho mandado ao Whisper; não recomeça quando a voz religa

  function prepararOuvido() {
    if (ouvidoPronto) return ouvidoPronto;
    ouvido = new Worker(new URL('js/ouvido.js', location.href), { type: 'module' });
    const arquivos = {};
    let maiorPct = 0;
    ouvidoPronto = new Promise((ok, falha) => {
      ouvido.onmessage = (ev) => {
        const m = ev.data;
        if (m.tipo === 'progresso') {
          arquivos[m.arquivo] = m;
          const lista = Object.values(arquivos);
          const total = lista.reduce((s, x) => s + (x.total || 0), 0);
          // os arquivos chegam um depois do outro: os de configuração primeiro (a barra pularia
          // para 100%) e cada arquivo pesado aumenta o total (ela voltaria). A conta parte dos
          // ~75 MB do modelo e a barra só anda para a frente
          const pct = Math.min(100, Math.round(100 * lista.reduce((s, x) => s + (x.carregado || 0), 0) / Math.max(total, 75e6)));
          maiorPct = Math.max(maiorPct, pct);
          baixando(maiorPct);
        } else if (m.tipo === 'pronto') ok();
        else if (m.tipo === 'erro' && m.id == null) falha(new Error(m.msg));
        else ouviu(m);
      };
      ouvido.onerror = (e) => falha(new Error(e.message || 'o Whisper não abriu'));
      ouvido.postMessage({ tipo: 'carregar', modelo: MODELO_VOZ });
    });
    ouvidoPronto.catch(() => { if (ouvido) ouvido.terminate(); ouvido = null; ouvidoPronto = null; });
    return ouvidoPronto;
  }

  // a primeira vez baixa uns 80 MB: uma barra mostra que está andando (não travou)
  let ultimoPct = -1;
  function baixando(pct) {
    if (pct === ultimoPct || !ligandoVoz) return;
    ultimoPct = pct;
    estado.fontes.voz = 'baixando o Whisper ' + pct + '%';
    pintarLuzes();
    $('#carregaVoz').hidden = false;
    $('#carregaVozBarra').style.width = pct + '%';
    $('#carregaVozPct').textContent = pct + '%';
  }

  // no silêncio ou na música o Whisper às vezes "ouve" frases prontas (créditos de legenda,
  // despedida de vídeo); e repetir a frase anterior inteira é eco do modelo
  const ALUCINACAO = /amara\.org|legendas? (?:pela|por|da|de)|inscreva-se|obrigad[oa] por assistir|^(?:tchau[,!. ]*)+$|^[\s.…!?-]*$/i;
  function limparOuvido(t) {
    const s = String(t).replace(/\[[^\]]*\]|♪/g, ' ').replace(/\s+/g, ' ').trim()
      // a sigla: "a ia", "da ia", "é ia" e "I.A." viram IA (o verbo "ia" depois de pronome fica)
      .replace(/(?<![\p{L}\d])(a|à|da|na|é|de|com|sobre|pela|uma|essa|esta|nossa|sua|chave:?)\s+ia(?![\p{L}\d])/giu, (_, p) => p + ' IA')
      .replace(/\bI\.A\b\.?|\bI\. A\.(?=\s|$|[,;!?])/g, 'IA')
      // "é IA" colado depois de "palavra-chave" ("palavra chave, EIA")
      .replace(/(palavra[\s-]*chave),?\s+E(IA|TCC)\b/gi, '$1 é $2')
      // … ou ouvido separado: "palavra chave, E a." (é IA, no fim da frase)
      .replace(/(palavra[\s-]*chave),?\s+(?:é\s+)?E\s+a(?=\s*[.,!?]|\s*$)/gi, '$1 é IA');
    if (!s) return '';
    // frase pronta do silêncio some; mas "obrigado por assistir, a palavra-chave é…" fica
    const d = N.detectar(s);
    const anuncio = d.mencao || d.achados.length > 0;
    if (ALUCINACAO.test(s) && s.split(' ').length <= 10 && !anuncio) return '';
    if (N.normal(s) === N.normal(ultimoOuvido)) return '';
    // o Whisper às vezes repete a própria dica (no silêncio): não é fala. Mas a palavra dita
    // sozinha ("Transferência.") ou uma lista curta também estão na dica (no assunto): só conta
    // como eco a frase comprida que não anuncia nada
    if (!anuncio && s.split(' ').length >= 5 && N.normal(ultimaDica).includes(N.normal(s).replace(/[.!?…]+$/, ''))) return '';
    ultimoOuvido = s;
    return s;
  }

  function ouviu(m) {
    ouvidoLog.push({ texto: m.texto, ms: m.ms, segundos: m.segundos, erro: m.msg });
    if (ouvidoLog.length > 50) ouvidoLog.shift();
    if (!voz || m.id !== voz.esperando) return;
    voz.ocupado = false;
    if (m.tipo === 'erro') {
      voz.erro = m.msg; voz.erroEm = Date.now();
      estado.fontes.voz = 'erro: ' + m.msg; pintarLuzes();
      transcrever();
      return;
    }
    voz.erro = null;
    const t = limparOuvido(m.texto);
    if (t) texto('voz', vozTexto, ouvir('voz', vozTexto, t, true, m.quando));
    transcrever();
    mostrarOuvindo();
  }

  // manda o que estiver na fila, junto (até 28 s: o Whisper lê até 30 s de uma vez). Se a fala
  // vier mais rápido do que ele transcreve, os trechos se juntam e ele alcança
  function transcrever() {
    if (!voz || voz.ocupado || !voz.fila.length || !ouvido) return;
    const juntar = [];
    let n = 0;
    while (voz.fila.length && (!juntar.length || n + voz.fila[0].audio.length <= 28 * TAXA)) { n += voz.fila[0].audio.length; juntar.push(voz.fila.shift()); }
    const audio = new Float32Array(Math.min(n, 29 * TAXA));
    let o = 0;
    juntar.forEach((p) => { const cabe = Math.min(p.audio.length, audio.length - o); audio.set(p.audio.subarray(0, cabe), o); o += cabe; });
    voz.ocupado = true;
    voz.esperando = ++pedidos;
    ultimaDica = dicaDeContexto();
    ouvido.postMessage({ tipo: 'ouvir', id: voz.esperando, audio, dica: ultimaDica, quando: juntar[0].quando }, [audio.buffer]);
  }

  // o que o Whisper lê antes de ouvir: o jeito de uma aula ao vivo (com sigla em maiúsculas),
  // as palavras-chave que já saíram e o fim do que já foi dito, para emendar o assunto
  // O assunto (que a pessoa escreve no painel) é o que mais ajuda: o Whisper passa a esperar
  // aqueles termos. Vem com termos de psicologia, o uso mais comum aqui
  const ASSUNTO_PADRAO = 'psicologia, acolhimento, vínculo, escuta, transferência, IA';
  $('#assunto').value = ler('assunto', ASSUNTO_PADRAO);
  $('#assunto').addEventListener('change', () => guardar('assunto', $('#assunto').value.trim()));
  function dicaDeContexto() {
    const assunto = $('#assunto').value.trim();
    const chaves = caderno.notas.filter((n) => n.tipo === 'palavra').map((n) => n.palavra).join(', ');
    const termos = [assunto, chaves].filter(Boolean).join(', ');
    return 'Aula ao vivo, em português.' + (termos ? ' Assunto: ' + termos + '.' : '') + ' Siglas em maiúsculas, como IA.' +
      ' ' + vozTexto.ultimas(30);
  }

  // estado da voz nas luzes e, se a legenda não estiver imprimindo, no pé da fita
  function mostrarOuvindo() {
    if (!voz) { fita.parcial(''); return; }
    const atraso = voz.fila.reduce((s, p) => s + p.audio.length, 0) / TAXA;
    const antes = estado.fontes.voz;
    estado.fontes.voz = voz.erro && Date.now() - voz.erroEm < 15000 ? 'erro: ' + voz.erro
      : atraso > 20 ? 'escutando (atrasada ' + Math.round(atraso) + ' s)' : 'escutando';
    if (estado.fontes.voz !== antes) pintarLuzes();
    // (com a legenda imprimindo, o aviso da voz sai do pé da fita)
    fita.parcial(Date.now() - legendaVistaEm > 20000 ? (voz.ocupado ? 'transcrevendo a fala' : voz.falando ? 'ouvindo' : '') : '');
  }

  // 48 kHz da aba para os 16 kHz do Whisper: média de cada janela (filtra o agudo que viraria ruído)
  function paraTaxa(bloco, passo) {
    if (passo === 1) return bloco.slice();
    const n = Math.floor(bloco.length / passo);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * passo), b = Math.max(a + 1, Math.floor((i + 1) * passo));
      let s = 0;
      for (let k = a; k < b; k++) s += bloco[k];
      out[i] = s / (b - a);
    }
    return out;
  }

  // corta em trechos de fala; o piso de ruído acompanha o ambiente (música de fundo, chiado)
  function cortador(taxa) {
    const passo = taxa / TAXA;
    let trecho = [], falando = false, silencio = 0, piso = 0.004, antes = null, preparo = 0;
    const duracao = () => trecho.reduce((s, p) => s + p.length, 0) / TAXA;
    return (bloco) => {
      const b = paraTaxa(bloco, passo);
      let e = 0;
      for (let i = 0; i < b.length; i++) e += b[i] * b[i];
      const rms = Math.sqrt(e / b.length);
      if (!falando) piso = piso * 0.9 + rms * 0.1;
      const temVoz = rms > Math.max(0.006, piso * 2.2);
      if (temVoz && !falando) { falando = true; trecho = antes ? [antes] : []; preparo = antes ? antes.length : 0; silencio = 0; }
      if (falando) {
        trecho.push(b);
        silencio = temVoz ? 0 : silencio + b.length;
        const dur = duracao();
        const fala = dur - (silencio + preparo) / TAXA;
        if ((silencio >= 0.7 * TAXA && fala >= 0.25) || dur >= 12) {
          enviar(trecho);
          trecho = [];
          falando = dur >= 12 && rms > Math.max(0.006, piso * 2.2);
          silencio = 0; preparo = 0;
        } else if (silencio >= 0.7 * TAXA) { trecho = []; falando = false; silencio = 0; } // estalo curto: não é fala
      }
      antes = b;
      if (voz && voz.falando !== falando) { voz.falando = falando; mostrarOuvindo(); }
    };
  }

  function enviar(trecho) {
    if (!voz) return;
    const n = trecho.reduce((s, p) => s + p.length, 0);
    const audio = new Float32Array(n);
    let o = 0;
    trecho.forEach((p) => { audio.set(p, o); o += p.length; });
    voz.fila.push({ audio, quando: Date.now() - Math.round(1000 * n / TAXA) });
    // mais de um minuto atrasado: o mais velho sai (melhor perder um trecho do que nunca alcançar)
    while (voz.fila.reduce((s, p) => s + p.audio.length, 0) > 60 * TAXA) voz.fila.shift();
    transcrever();
    mostrarOuvindo();
  }

  async function ligarVoz() {
    if (voz || !fluxo || ligandoVoz) return;
    if (!fluxo.getAudioTracks().length) { estado.fontes.voz = 'sem som: marque “compartilhar áudio”'; pintarLuzes(); return; }
    ligandoVoz = true;
    ultimoPct = -1;
    estado.fontes.voz = ouvidoPronto ? 'ligando…' : 'baixando o Whisper…'; pintarLuzes();
    let prazo;
    try {
      await Promise.race([
        prepararOuvido(),
        new Promise((_, falha) => { prazo = setTimeout(() => {
          // o download ficou parado: larga este e começa outro na próxima tentativa
          if (ouvido) ouvido.terminate();
          ouvido = null; ouvidoPronto = null;
          falha(new Error('o Whisper não carregou; desmarque e marque de novo'));
        }, 300000); })
      ]);
      clearTimeout(prazo);
      $('#carregaVoz').hidden = true;
      if (voz || !fluxo || !$('#optVoz').checked) { if (!voz) { estado.fontes.voz = 'desligada'; pintarLuzes(); } return; }
      const ctx = new AudioContext();
      await ctx.resume();
      const fonte = ctx.createMediaStreamSource(new MediaStream(fluxo.getAudioTracks()));
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      voz = { ctx, fonte, proc, fila: [], ocupado: false, falando: false, id: 0, esperando: 0 };
      const cortar = cortador(ctx.sampleRate);
      proc.onaudioprocess = (ev) => cortar(ev.inputBuffer.getChannelData(0));
      fonte.connect(proc); proc.connect(ctx.destination);
      estado.fontes.voz = 'escutando'; pintarLuzes();
    } catch (e) { $('#carregaVoz').hidden = true; estado.fontes.voz = 'erro: ' + e.message; pintarLuzes(); } finally { clearTimeout(prazo); ligandoVoz = false; }
  }
  function desligarVoz() {
    if (!voz) return;
    try { voz.proc.disconnect(); voz.fonte.disconnect(); voz.ctx.close(); } catch (e) { /* já parado */ }
    voz = null;
    estado.fontes.voz = 'desligada'; fita.parcial(''); pintarLuzes();
  }

  // para os testes: passa um som gravado pelo mesmo caminho do som da aba (cortador → Whisper)
  async function simularSom(amostras, taxa) {
    ligandoVoz = true;
    try { await prepararOuvido(); } finally { ligandoVoz = false; $('#carregaVoz').hidden = true; }
    if (!voz) voz = { fila: [], ocupado: false, falando: false, id: 0, esperando: 0 };
    const cortar = cortador(taxa);
    for (let i = 0; i < amostras.length; i += 4096) cortar(amostras.subarray(i, i + 4096));
    for (let i = 0; i < 12; i++) cortar(new Float32Array(4096));
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

  // em silêncio pode ser ligado com a live rodando (o navegador ajusta a captura na hora)
  $('#optSilencio').addEventListener('change', (e) => {
    if (!fluxo) return;
    fluxo.getAudioTracks().forEach((tr) => tr.applyConstraints({ suppressLocalAudioPlayback: e.target.checked }).catch(() => {}));
  });

  /* ---------- gravação: a transcrição inteira de uma vez, sem tocar o vídeo ---------- */

  // Aceita o que o YouTube mostra em "Mostrar transcrição" (a marca de tempo numa linha e a fala
  // na outra, ou as duas juntas), arquivo .srt/.vtt ou texto puro. Devolve [{ t (s) ou null, texto }]
  function separarTrechos(bruto) {
    const tempo = (s) => s.split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
    const MARCA = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;
    const SRT = /^((?:\d{1,2}:)?\d{1,2}:\d{2})[.,]\d{1,3}\s*-->/;
    const linhas = String(bruto).replace(/\r/g, '').split('\n').map((l) => l.trim());
    const trechos = [];
    // .vtt automático do YouTube: cada pedaço repete a linha anterior (a legenda rolando)
    const vtt = /^\uFEFF?\s*WEBVTT\b/i.test(String(bruto));
    // "0:05 texto" na mesma linha: só em colagem que não é .srt/.vtt e em que isso se repete
    // (num texto qualquer, "10:30 começa o intervalo" é fala)
    const comSrt = linhas.some((l) => SRT.test(l));
    const juntas = linhas.filter((l) => /^((?:\d{1,2}:)?\d{1,2}:\d{2})\s+\S/.test(l)).length;
    const podeJunto = !comSrt && juntas >= 3 && juntas >= linhas.filter(Boolean).length * 0.3;
    let t = null, bloco = false, marcaSozinha = false, anteriorMarca = false;
    linhas.forEach((l, i) => {
      if (!l) { bloco = false; anteriorMarca = false; return; }
      // cabeçalho e blocos do .vtt que não são fala
      if (/^WEBVTT\b/i.test(l) || /^(?:Kind|Language)\s*:/i.test(l)) return;
      if (/^(?:NOTE|STYLE|REGION)\b/.test(l)) { bloco = true; return; }
      if (bloco) return;
      // número sozinho só é a numeração do .srt (ou o nome do pedaço do .vtt) se abrir o bloco e a
      // linha seguinte for um horário; senão é fala ("2020", ou "1856" como texto de um pedaço)
      if (/^\d+$/.test(l) && (i === 0 || !linhas[i - 1])) {
        const prox = linhas.slice(i + 1).find(Boolean);
        if (prox && SRT.test(prox)) return;
      }
      // "1 minuto e 5 segundos": o texto para leitor de tela que o YouTube põe junto da marca
      // (encostado nela, antes ou depois; solto no meio da fala, é fala)
      if (/^(?:\d+\s+(?:horas?|minutos?|segundos?)(?:,?\s*(?:e\s+)?)?)+$/i.test(l)) {
        const prox = linhas.slice(i + 1).find(Boolean);
        if (anteriorMarca || (prox && MARCA.test(prox))) { anteriorMarca = false; return; }
      }
      const srt = l.match(SRT);
      if (srt) { t = tempo(srt[1]); anteriorMarca = false; return; }
      if (MARCA.test(l)) { t = tempo(l); marcaSozinha = true; anteriorMarca = true; return; }
      anteriorMarca = false;
      // "0:05 texto" na mesma linha só quando o arquivo não usa marca em linha própria
      // (senão "10:30 da manhã" viraria horário)
      const junto = podeJunto && !marcaSozinha && l.match(/^((?:\d{1,2}:)?\d{1,2}:\d{2})\s+(.+)$/);
      if (junto) t = tempo(junto[1]);
      const texto = (junto ? junto[2] : l).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!texto) return;
      // o .vtt automático do YouTube repete a linha anterior em cada pedaço (a legenda rolando)
      const chave = N.normal(texto);
      if (vtt && trechos.slice(-2).some((x) => N.normal(x.texto) === chave)) return;
      trechos.push({ t, texto });
    });
    return trechos;
  }
  const tempoDoVideo = (s) => {
    if (s == null) return '';
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = Math.floor(s % 60);
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(ss).padStart(2, '0');
  };

  let importando = false;
  const avisoGravado = (msg) => { $('#avisoGravado').hidden = !msg; $('#avisoGravado').textContent = msg || ''; };

  async function lerTranscricao(bruto, nome) {
    if (importando) return;
    const trechos = separarTrechos(bruto);
    if (!trechos.length) { avisoGravado('Não achei texto aí. Copie o painel “Mostrar transcrição” do YouTube, ou abra um arquivo .srt, .vtt ou .txt.'); return; }
    if (estado.rodando && !confirm('Parar de acompanhar a live e ler esta gravação?')) return;
    parar();
    avisoGravado('');
    // a mesma gravação colada de novo cai no mesmo lugar (e não duplica)
    let h = 5381;
    const amostra = trechos.length + '|' + trechos.slice(0, 40).map((x) => x.texto).join(' ');
    for (let i = 0; i < amostra.length; i++) h = ((h << 5) + h + amostra.charCodeAt(i)) >>> 0;
    estado.id = 'gravacao-' + h.toString(36);
    Object.keys(esperas).forEach((k) => clearTimeout(esperas[k]));
    caderno.notas = []; caderno.marcas.clear(); caderno.janela = null; caderno.ultimoAviso = -Infinity;
    $('#player').removeAttribute('src');
    $('#boasVindas').hidden = true;
    $('#palco').hidden = false;
    $('#moldura').hidden = true; $('#painel').hidden = true;
    const resumo = $('#resumoGravado');
    resumo.hidden = false;
    resumo.innerHTML = '<span class="etiqueta">lendo a gravação</span><div class="carrega"><div class="carrega__fita"><span id="gravadoBarra"></span></div><p>imprimindo a fita <b id="gravadoPct">0%</b></p></div>';

    // os horários são do vídeo (0:00 … 1:02:33), não do relógio; sem marca de tempo, ficam em branco
    const comTempo = trechos.some((x) => x.t != null);
    let t = 0;
    const relogios = [caderno.hora, caderno.agora, fita.hora, fita.agora];
    caderno.hora = fita.hora = () => (comTempo ? tempoDoVideo(t) : '');
    caderno.agora = fita.agora = () => t * 1000;
    const base = new N.Transcricao(80000);
    importando = true;
    document.body.classList.add('importando');
    fita.limpar();
    // a fita só desenha a régua e rola no fim (medir milhares de linhas a cada lote travava)
    fita.pausar();
    try {
      // em lotes, com o carregador andando: uma gravação de horas não trava a página
      for (let i = 0; i < trechos.length; i += 120) {
        trechos.slice(i, i + 120).forEach((x, k) => {
          t = x.t != null ? x.t : (i + k) * 4;
          // parágrafo comprido (texto puro) vai em pedaços: a procura olha as últimas 70 palavras
          // e um anúncio no começo de um parágrafo de 100 se perderia
          const ws = x.texto.split(/\s+/);
          for (let p = 0; p < ws.length; p += 40) {
            const acr = base.acrescentar(ws.slice(p, p + 40).join(' '));
            fita.receber('legenda', acr, 0);
            // cada trecho de uma gravação já está completo: a palavra no fim dele vale na hora
            // (na live ela pode estar pela metade e espera o próximo). Sem aviso de "vai ser dita":
            // numa gravação a palavra já está logo ali
            caderno.texto('legenda', base, acr, true);
          }
        });
        const pct = Math.round(100 * Math.min(1, (i + 120) / trechos.length));
        $('#gravadoBarra').style.width = pct + '%';
        $('#gravadoPct').textContent = pct + '%';
        await new Promise((ok) => setTimeout(ok, 0));
      }
    } finally {
      importando = false;
      document.body.classList.remove('importando');
      [caderno.hora, caderno.agora, fita.hora, fita.agora] = relogios;
      fita.retomar();
    }
    pintarNotas();
    const palavras = caderno.notas.filter((n) => n.tipo === 'palavra').length;
    resumo.innerHTML = '';
    const et = document.createElement('span'); et.className = 'etiqueta'; et.textContent = 'gravação lida de uma vez';
    const h2 = document.createElement('h2'); h2.textContent = nome || 'Transcrição colada';
    const p = document.createElement('p');
    p.textContent = base.palavras.length.toLocaleString('pt-BR') + ' palavras' + (comTempo ? ' · ' + tempoDoVideo(trechos[trechos.length - 1].t || 0) + ' de vídeo' : '') +
      ' · ' + (palavras ? palavras + (palavras === 1 ? ' palavra-chave anotada' : ' palavras-chave anotadas') : 'nenhuma palavra-chave anunciada');
    resumo.append(et, h2, p);
    window.scrollTo({ top: 0 });
    // o foco vai para o resultado (estava no botão, que sumiu): o leitor de tela anuncia
    resumo.focus();
  }

  $('#lerTranscricao').addEventListener('click', () => lerTranscricao($('#transcricaoColada').value));
  const lerArquivo = (arq) => { if (arq) arq.text().then((txt) => lerTranscricao(txt, arq.name.replace(/\.(srt|vtt|txt)$/i, ''))); };
  // (o valor volta a vazio: escolher o mesmo arquivo de novo também lê)
  $('#arquivoTranscricao').addEventListener('change', (e) => { lerArquivo(e.target.files[0]); e.target.value = ''; });
  const caixa = $('#soltarAqui');
  caixa.addEventListener('dragover', (e) => { e.preventDefault(); caixa.classList.add('is-sobre'); });
  caixa.addEventListener('dragleave', () => caixa.classList.remove('is-sobre'));
  caixa.addEventListener('drop', (e) => {
    e.preventDefault(); caixa.classList.remove('is-sobre');
    if (e.dataTransfer.files[0]) { lerArquivo(e.dataTransfer.files[0]); return; }
    // texto arrastado (selecionado no YouTube): vai para a caixa, para conferir antes de ler
    const txt = e.dataTransfer.getData('text');
    if (txt) { $('#transcricaoColada').value = txt; $('#transcricaoColada').focus(); }
  });
  $('#irGravado').addEventListener('click', () => {
    if (importando) return;
    if (estado.rodando && !confirm('Parar de acompanhar a live para ler uma gravação?')) return;
    parar();
    // a live para de tocar (escondida, ela seguiria com som e sem botão para parar)
    $('#player').removeAttribute('src');
    $('#palco').hidden = true;
    $('#boasVindas').hidden = false;
    $('#gravado').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#transcricaoColada').focus({ preventScroll: true });
  });

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
    sessao++;
    fixas.length = 0;
    ultimoTextoLegenda = '';
    if (pendentes.length) pendentes.forEach((p) => votar(p.palavra, p.conf, p.trecho));
    pendentes = [];
    apurar();
    estado.rodando = false;
    clearInterval(ciclo); clearInterval(cicloSlide); clearTimeout(chatTimer);
    desligarVoz();
    if (fluxo) fluxo.getTracks().forEach((t) => t.stop());
    fluxo = null; videoAba = null;
    limpador.postMessage({ zerar: true });
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
  // além da notificação, a palavra aparece no título da aba: em silêncio o apito também fica mudo
  // (o navegador cala a aba inteira) e quem está em outra aba ainda vê "★ ACOLHIMENTO"
  const tituloOriginal = document.title;
  let voltaTitulo = null;
  function notificar(n) {
    try {
      if (window.Notification && Notification.permission === 'granted') new Notification('Taquígrafo: ' + n.palavra, { body: n.hora + (n.trecho ? ' — “' + n.trecho.slice(-90) + '”' : '') });
    } catch (e) { /* segue */ }
    document.title = '★ ' + n.palavra + ' · Taquígrafo';
    clearTimeout(voltaTitulo);
    voltaTitulo = setTimeout(() => { document.title = tituloOriginal; }, 60000);
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
  // em ordem de fala e numeradas: live com várias palavras costuma pedir todas, na ordem
  function pintarNotas(nova) {
    // lendo uma gravação, a lista é desenhada uma vez só, no fim (a cada trecho travava a página)
    if (importando) return;
    const box = $('#notas');
    const palavras = caderno.notas.filter((n) => n.tipo === 'palavra');
    $('#qtasPalavras').textContent = palavras.length ? String(palavras.length) : '';
    $('#copiarTodas').hidden = palavras.length < 2;
    if (!caderno.notas.length) { const p = document.createElement('p'); p.className = 'vazio'; p.textContent = 'Nada anotado ainda.'; box.replaceChildren(p); return; }
    box.replaceChildren(...caderno.notas.map((n) => {
      const a = document.createElement('article');
      a.className = 'nota' + (n.tipo === 'aviso' ? ' nota--aviso' : '') + (n === nova ? ' nova' : '');
      if (n.tipo !== 'aviso') {
        const num = document.createElement('span');
        num.className = 'nota__num';
        num.textContent = (palavras.indexOf(n) + 1) + 'ª';
        a.append(num);
      }
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
        c.type = 'button'; c.className = 'botao-fio'; c.textContent = 'copiar';
        c.addEventListener('click', () => copiar(n.palavra, c));
        a.append(c);
      }
      return a;
    }));
    // só a anotação que acabou de chegar puxa a lista (e só dentro dela, sem mexer na página)
    if (nova && box.scrollHeight > box.clientHeight) box.scrollTop = box.scrollHeight;
  }
  function copiar(texto, botao) {
    const antes = botao.textContent;
    navigator.clipboard.writeText(texto).then(() => { botao.textContent = 'copiado'; }, () => { botao.textContent = 'não deu'; });
    setTimeout(() => { botao.textContent = antes; }, 1500);
  }
  $('#copiarTodas').addEventListener('click', (e) => copiar(caderno.notas.filter((n) => n.tipo === 'palavra').map((n) => n.palavra).join('\n'), e.currentTarget));
  $('#limpar').addEventListener('click', () => {
    if (!confirm('Apagar a transcrição e as palavras anotadas desta live?')) return;
    caderno.limpar(); fita.limpar();
  });
  $('#soDestaques').addEventListener('change', (e) => fita.soDestaques(e.target.checked));
  $('#exportar').addEventListener('click', () => {
    // as palavras em cima, a transcrição inteira embaixo (">>" marca o que tem a ver com a palavra-chave)
    const linhas = ['Taquígrafo — ' + (estado.id || ''), 'baixado em ' + new Date().toLocaleString('pt-BR'), '', 'PALAVRAS-CHAVE', ''];
    if (!caderno.notas.length) linhas.push('(nenhuma anotada)');
    caderno.notas.forEach((n) => {
      linhas.push(n.tipo === 'aviso' ? `[${n.hora}] AVISO de palavra-chave` : `[${n.hora}] ${n.palavra}  (${n.fontes.join(' + ')}, ${n.confianca === 'alta' ? 'confiável' : 'confira'})`);
      if (n.trecho) linhas.push('    “' + n.trecho + '”');
    });
    linhas.push('', '', 'TRANSCRIÇÃO  (>> = tem a ver com a palavra-chave)', '', ...fita.texto());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([linhas.join('\r\n')], { type: 'text/plain;charset=utf-8' }));
    a.download = 'taquigrafo-' + (estado.id || 'live') + '.txt';
    document.body.append(a); a.click(); a.remove();
  });

  pintarLuzes();
  pintarNotas();
  // veio da capa com o link (acompanhar.html?link=…): já abre a live
  const linkInicial = new URLSearchParams(location.search).get('link');
  if (linkInicial) { $('#link').value = linkInicial; $('#formLink').requestSubmit(); }
  window.Acompanhar = { estado, caderno, fita, idDoLink, abrirEmbed, faixa, simularSom, ouvidoLog, leituras, textoConfiavel, separarTrechos };
})();
