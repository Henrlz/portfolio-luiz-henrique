/* Lê .docx, .pdf, .txt/.md ou texto colado e devolve parágrafos crus:
   [{ runs: [{ t, b, i }], dica }]. A dica diz o que o arquivo já sabia
   (h1..h6, citacao, lista, titulodoc, grande) e ajuda a marcar depois. */

(function () {
  'use strict';

  function juntarRuns(runs) {
    const out = [];
    runs.forEach((r) => {
      if (!r.t) return;
      const ult = out[out.length - 1];
      if (ult && !!ult.b === !!r.b && !!ult.i === !!r.i) ult.t += r.t;
      else out.push({ t: r.t, b: !!r.b, i: !!r.i });
    });
    if (out.length) {
      out[0].t = out[0].t.replace(/^\s+/, '');
      out[out.length - 1].t = out[out.length - 1].t.replace(/\s+$/, '');
    }
    return out.map((r) => ({ ...r, t: r.t.replace(/[ \t ]+/g, ' ') })).filter((r) => r.t);
  }

  const textoDe = (runs) => runs.map((r) => r.t).join('');

  /* ---------- texto puro / markdown leve ---------- */

  // **negrito** e *itálico*, porque muita gente cola texto que veio de chat ou de markdown
  function inline(str) {
    const runs = [];
    const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
    let ult = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > ult) runs.push({ t: str.slice(ult, m.index) });
      const s = m[0];
      if (s.startsWith('**') || s.startsWith('__')) runs.push({ t: s.slice(2, -2), b: true });
      else runs.push({ t: s.slice(1, -1), i: true });
      ult = m.index + s.length;
    }
    if (ult < str.length) runs.push({ t: str.slice(ult) });
    return juntarRuns(runs);
  }

  function texto(str) {
    // linhas em branco no começo e no fim não contam na hora de decidir o formato
    const linhas = String(str).replace(/\r\n?/g, '\n').replace(/^\s*\n|\n\s*$/g, '').split('\n');
    const brancas = linhas.filter((l) => !l.trim()).length;
    const cheias = linhas.length - brancas;
    // Texto copiado do Word vem com um parágrafo por linha; texto de .txt
    // costuma quebrar a linha no meio e separar parágrafo com linha em branco.
    const porLinha = brancas < cheias / 4;

    const blocos = [];
    let acc = [];
    const fechar = () => {
      if (acc.length) blocos.push(acc.join(' '));
      acc = [];
    };
    linhas.forEach((l) => {
      const s = l.trim();
      if (!s) { fechar(); return; }
      const solta = /^(#{1,6}\s|>\s?|[-–•●▪◦*]\s|[a-z]\)\s|\d{1,2}[.)]\s)/.test(s);
      if (porLinha || solta) { fechar(); blocos.push(s); return; }
      if (acc.length && /-$/.test(acc[acc.length - 1]) && /^[a-zà-ÿ]/.test(s)) {
        acc[acc.length - 1] = acc[acc.length - 1].slice(0, -1) + s;
      } else acc.push(s);
    });
    fechar();

    return blocos.map((s) => {
      let dica = null;
      const h = /^(#{1,6})\s+(.*)$/.exec(s);
      if (h) { dica = 'h' + h[1].length; s = h[2]; }
      else if (/^>\s?/.test(s)) { dica = 'citacao'; s = s.replace(/^>\s?/, ''); }
      return { runs: inline(s), dica };
    }).filter((p) => p.runs.length);
  }

  /* ---------- .docx (mammoth) ---------- */

  const MAPA_ESTILOS = [
    "p[style-name='Title'] => h1.titulodoc:fresh",
    "p[style-name='Título'] => h1.titulodoc:fresh",
    "p[style-name='Subtitle'] => p.subtitulodoc:fresh",
    "p[style-name='Quote'] => blockquote:fresh",
    "p[style-name='Intense Quote'] => blockquote:fresh",
    "p[style-name='Citação'] => blockquote:fresh",
    "p[style-name='Citação Intensa'] => blockquote:fresh",
    "p[style-name='Citacao'] => blockquote:fresh",
    "p[style-name='Citação longa'] => blockquote:fresh",
    "p[style-name='Citação direta'] => blockquote:fresh",
    "p[style-name='Block Text'] => blockquote:fresh"
  ];

  function runsDoDom(el) {
    const runs = [];
    (function andar(no, b, i) {
      if (no.nodeType === 3) { runs.push({ t: no.nodeValue, b, i }); return; }
      if (no.nodeType !== 1) return;
      const tag = no.tagName;
      if (tag === 'IMG' || tag === 'TABLE') return;
      if (tag === 'BR') { runs.push({ t: ' ', b, i }); return; }
      const nb = b || tag === 'STRONG' || tag === 'B';
      const ni = i || tag === 'EM' || tag === 'I';
      no.childNodes.forEach((f) => andar(f, nb, ni));
    })(el, false, false);
    return juntarRuns(runs);
  }

  async function docx(buffer) {
    if (!window.mammoth) throw new Error('O leitor de Word não carregou. Confere a internet e tenta de novo.');
    const res = await window.mammoth.convertToHtml({ arrayBuffer: buffer }, { styleMap: MAPA_ESTILOS });
    const doc = new DOMParser().parseFromString('<div>' + res.value + '</div>', 'text/html');
    const raiz = doc.body.firstChild;
    const paras = [];
    let tabelas = 0, imagens = raiz.querySelectorAll('img').length;

    function lista(el, nivel) {
      let n = 0;
      el.querySelectorAll(':scope > li').forEach((li) => {
        const copia = li.cloneNode(true);
        copia.querySelectorAll('ul, ol').forEach((x) => x.remove());
        const marca = el.tagName === 'OL' ? String.fromCharCode(97 + (n++ % 26)) + ') ' : '– ';
        const runs = runsDoDom(copia);
        if (runs.length) paras.push({ runs: juntarRuns([{ t: marca }].concat(runs)), dica: 'lista' });
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => lista(sub, nivel + 1));
      });
    }

    raiz.childNodes.forEach((el) => {
      if (el.nodeType !== 1) return;
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) {
        paras.push({ runs: runsDoDom(el), dica: el.classList.contains('titulodoc') ? 'titulodoc' : 'h' + tag[1] });
      } else if (tag === 'BLOCKQUOTE') {
        const ps = el.querySelectorAll('p');
        (ps.length ? ps : [el]).forEach((p) => paras.push({ runs: runsDoDom(p), dica: 'citacao' }));
      } else if (tag === 'UL' || tag === 'OL') {
        lista(el, 0);
      } else if (tag === 'TABLE') {
        tabelas++;
      } else {
        paras.push({ runs: runsDoDom(el), dica: el.classList.contains('subtitulodoc') ? 'subtitulodoc' : null });
      }
    });

    return { paras: paras.filter((p) => p.runs.length), avisos: avisosDe(tabelas, imagens) };
  }

  function avisosDe(tabelas, imagens) {
    const a = [];
    if (tabelas) a.push(`${tabelas} tabela${tabelas > 1 ? 's ficaram' : ' ficou'} de fora: cola de volta no Word depois de baixar.`);
    if (imagens) a.push(`${imagens} imagem${imagens > 1 ? 'ns ficaram' : ' ficou'} de fora: insere no Word depois de baixar.`);
    return a;
  }

  /* ---------- .pdf (pdf.js) ---------- */

  const moda = (arr) => {
    const c = new Map();
    arr.forEach((v) => c.set(v, (c.get(v) || 0) + 1));
    let best = arr[0], n = 0;
    c.forEach((q, v) => { if (q > n) { n = q; best = v; } });
    return best;
  };

  async function pdf(buffer) {
    const lib = window.pdfjsLib;
    if (!lib) throw new Error('O leitor de PDF não carregou. Confere a internet e tenta de novo.');
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc = await lib.getDocument({ data: buffer }).promise;

    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pg = await doc.getPage(n);
      const tc = await pg.getTextContent();
      const linhas = [];
      tc.items.forEach((it) => {
        if (!it.str || !it.str.trim() && !it.hasEOL) return;
        const [a, b, , , x, y] = it.transform;
        const tam = Math.round(Math.hypot(a, b) * 2) / 2;
        let l = linhas.find((q) => Math.abs(q.y - y) < Math.max(2, tam * 0.3));
        if (!l) { l = { y, itens: [], tam: 0 }; linhas.push(l); }
        l.itens.push({ x, w: it.width, s: it.str, tam });
      });
      linhas.forEach((l) => {
        l.itens.sort((p, q) => p.x - q.x);
        let s = '', fim = null;
        l.itens.forEach((it) => {
          if (fim !== null && it.x - fim > it.tam * 0.18 && !/\s$/.test(s) && !/^\s/.test(it.s)) s += ' ';
          s += it.s;
          fim = it.x + it.w;
        });
        l.texto = s.replace(/\s+/g, ' ').trim();
        l.x0 = l.itens[0].x;
        l.x1 = fim;
        l.tam = moda(l.itens.map((i) => i.tam));
      });
      linhas.sort((p, q) => q.y - p.y);
      paginas.push(linhas.filter((l) => l.texto));
    }

    // cabeçalho e rodapé que se repetem em várias páginas saem; número de página solto também
    const conta = new Map();
    paginas.forEach((ls) => {
      const vistos = new Set();
      ls.slice(0, 2).concat(ls.slice(-2)).forEach((l) => {
        const k = l.texto.replace(/\d+/g, '#');
        if (!vistos.has(k)) { vistos.add(k); conta.set(k, (conta.get(k) || 0) + 1); }
      });
    });
    const repetida = (l) => paginas.length > 2 && conta.get(l.texto.replace(/\d+/g, '#')) > paginas.length / 2;

    const todas = [];
    paginas.forEach((ls, pi) => ls.forEach((l, li) => {
      const borda = li < 2 || li >= ls.length - 2;
      if (/^\d{1,4}$/.test(l.texto)) return;
      if (borda && repetida(l)) return;
      todas.push({ ...l, pi });
    }));
    if (!todas.length) {
      throw new Error('Esse PDF não tem texto selecionável (deve ser foto ou escaneado). Sem texto, não tem o que formatar.');
    }

    const corpo = moda(todas.map((l) => l.tam));
    const esq = moda(todas.filter((l) => l.tam === corpo).map((l) => Math.round(l.x0)));
    const dir = todas.filter((l) => l.tam === corpo).map((l) => l.x1).sort((a, b) => a - b);
    const margemDir = dir[Math.floor(dir.length * 0.9)] || 0;
    const gaps = [];
    for (let i = 1; i < todas.length; i++) {
      if (todas[i].pi === todas[i - 1].pi && todas[i].tam === corpo) gaps.push(Math.round(todas[i - 1].y - todas[i].y));
    }
    const passo = moda(gaps) || corpo * 1.5;

    const paras = [];
    let atual = null;
    let gapAnt = null;
    todas.forEach((l, i) => {
      const ant = todas[i - 1];
      let novo = !atual;
      if (ant && atual) {
        const mesmaPg = l.pi === ant.pi;
        const gap = mesmaPg ? ant.y - l.y : null;
        const simples = gap !== null && gap < passo * 0.85;     // referência, citação: espaço simples
        const recuo = l.x0 - esq > corpo * 1.2;
        const curta = ant.x1 < margemDir - corpo * 3;
        const abreTitulo = /^\d{1,2}(\.\d{1,2})*\s+[A-ZÀ-Ý]/.test(l.texto);
        if (Math.abs(l.tam - ant.tam) > 0.6) novo = true;
        else if (gap !== null && gap > passo * 1.35) novo = true;
        // num bloco de espaço simples, o respiro maior entre linhas separa um item do outro
        else if (simples && gapAnt !== null && gap > gapAnt * 1.3) novo = true;
        else if (recuo && Math.abs(l.x0 - ant.x0) > 4) novo = true;
        else if (/^([-–•●▪◦]|[a-z]\)|\d{1,2}\))\s/.test(l.texto)) novo = true;
        // linha que não chega na margem termina parágrafo, título ou item de sumário
        else if (curta && !simples && (/[.:!?”"]$/.test(ant.texto) || /^[A-ZÀ-Ý0-9“"]/.test(l.texto))) novo = true;
        // "1 INTRODUÇÃO" depois de linha curta, de virada de página ou de linha de sumário ("... 7")
        else if (abreTitulo && (curta || gap === null || /\s\d{1,3}$/.test(ant.texto))) novo = true;
        gapAnt = simples && !novo ? Math.min(gapAnt || gap, gap) : (simples ? gap : null);
      }
      if (novo) {
        atual = { linhas: [], tam: l.tam, recuoTodo: l.x0 - esq };
        paras.push(atual);
      }
      atual.linhas.push(l.texto);
      atual.recuoTodo = Math.min(atual.recuoTodo, l.x0 - esq);
    });

    return {
      paras: paras.map((p) => {
        let s = '';
        p.linhas.forEach((t) => {
          if (/-$/.test(s) && /^[a-zà-ÿ]/.test(t)) s = s.slice(0, -1) + t;
          else s += (s ? ' ' : '') + t;
        });
        let dica = null;
        if (p.tam > corpo * 1.12) dica = 'grande';
        else if (p.tam < corpo * 0.95 && p.recuoTodo > corpo * 4 && s.length > 200) dica = 'citacao';
        return { runs: [{ t: s, b: false, i: false }], dica };
      }),
      avisos: ['PDF não guarda negrito nem estrutura: confere as marcações com atenção.']
    };
  }

  /* ---------- entrada ---------- */

  async function arquivo(file) {
    const nome = file.name.toLowerCase();
    if (/\.docx$/.test(nome)) return docx(await file.arrayBuffer());
    if (/\.pdf$/.test(nome)) return pdf(await file.arrayBuffer());
    if (/\.(txt|md|markdown)$/.test(nome) || file.type.startsWith('text/')) return { paras: texto(await file.text()), avisos: [] };
    if (/\.doc$/.test(nome)) throw new Error('Arquivo .doc antigo: abre no Word ou no Google Docs e salva como .docx.');
    if (/\.odt$/.test(nome)) throw new Error('Arquivo .odt: no LibreOffice, usa "Salvar como" e escolhe .docx.');
    throw new Error('Esse tipo de arquivo eu não leio. Manda .docx, .pdf ou .txt, ou cola o texto.');
  }

  window.Ler = { arquivo, texto: (s) => ({ paras: texto(s), avisos: [] }), textoDe, juntarRuns };
})();
