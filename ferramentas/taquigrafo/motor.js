/* Motor do Taquígrafo: roda escondido dentro do YouTube (iframe) e faz o que o YouTube
   não deixa fazer lá dentro: ler texto do vídeo (Tesseract) e reconhecer fala (Vosk).
   Conversa com o script só por postMessage, e só com origens conhecidas. */

(function () {
  'use strict';

  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const VOSK = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
  const MODELO_PT = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-pt-0.3.tar.gz';

  // YouTube, a própria demonstração e testes locais
  const permitida = (o) => o === 'https://www.youtube.com' || o === 'https://youtube.com' || o === location.origin ||
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o);

  if (window.parent === window) return;   // aberta sozinha: só mostra a explicação
  // quem abriu: pelo referrer ou pelo "olá" que o script manda quando o iframe carrega
  let pai = null;
  try { pai = new URL(document.referrer).origin; } catch (e) { pai = null; }
  if (pai && !permitida(pai)) pai = null;
  const enviar = (msg) => pai && window.parent.postMessage(msg, pai);
  const estado = (fonte, texto) => enviar({ tipo: 'estado', fonte, texto });

  const carregados = {};
  function carregar(src) {
    if (!carregados[src]) {
      carregados[src] = new Promise((ok, falha) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = () => falha(new Error('não baixou ' + src));
        document.head.append(s);
      });
    }
    return carregados[src];
  }

  /* ---------- tela: Tesseract ---------- */

  let ocr = null;
  function iniciarOCR() {
    if (!ocr) {
      estado('tela', 'carregando leitor…');
      ocr = carregar(TESSERACT).then(() => window.Tesseract.createWorker('por')).then((w) => { estado('tela', 'olhando'); return w; });
      ocr.catch((e) => { estado('tela', 'erro: ' + e.message); ocr = null; });
    }
    return ocr;
  }
  async function lerImagem(img) {
    try {
      const w = await iniciarOCR();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      img.close && img.close();
      const r = await w.recognize(c);
      enviar({ tipo: 'ocr', texto: r.data.text, confianca: Math.round(r.data.confidence) });
    } catch (e) {
      enviar({ tipo: 'ocr', texto: '', erro: e.message });
    }
  }

  /* ---------- voz: Vosk ---------- */

  let voz = null;   // { rec, taxa } quando pronto
  let iniciandoVoz = null;
  let modeloPronto = null;   // o modelo fica guardado: desligar e ligar de novo não baixa outra vez
  function iniciarVoz(taxa) {
    if (iniciandoVoz) return iniciandoVoz;
    estado('voz', modeloPronto ? 'ligando…' : 'baixando modelo (32 MB)…');
    modeloPronto = modeloPronto || carregar(VOSK).then(() => window.Vosk.createModel(MODELO_PT));
    modeloPronto.catch(() => { modeloPronto = null; });
    iniciandoVoz = modeloPronto
      .then((modelo) => {
        const rec = new modelo.KaldiRecognizer(taxa);
        rec.on('result', (m) => { if (m.result && m.result.text) enviar({ tipo: 'voz', final: true, texto: m.result.text }); });
        rec.on('partialresult', (m) => { enviar({ tipo: 'voz', parcial: (m.result && m.result.partial) || '' }); });
        voz = { rec, taxa, modelo };
        estado('voz', 'escutando');
      })
      .catch((e) => { estado('voz', 'erro: ' + e.message); iniciandoVoz = null; });
    return iniciandoVoz;
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window.parent || !ev.data) return;
    const m = ev.data;
    if (m.tipo === 'ola') {
      if (!permitida(ev.origin)) return;
      pai = ev.origin;
      enviar({ tipo: 'pronto' });
      return;
    }
    if (ev.origin !== pai) return;
    if (m.tipo === 'ocr-iniciar') iniciarOCR();
    else if (m.tipo === 'ocr' && m.imagem) lerImagem(m.imagem);
    else if (m.tipo === 'voz-iniciar') iniciarVoz(m.sampleRate || 16000);
    else if (m.tipo === 'audio' && voz && m.dados) {
      try { voz.rec.acceptWaveformFloat(m.dados, voz.taxa); } catch (e) { estado('voz', 'erro: ' + e.message); }
    } else if (m.tipo === 'voz-parar' && voz) {
      try { voz.rec.remove(); } catch (e) { /* já parado */ }
      voz = null;
      iniciandoVoz = null;
    }
  });

  enviar({ tipo: 'pronto' });
})();
