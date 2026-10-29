/* Lê .docx, .pdf, .txt/.md ou texto colado e devolve parágrafos crus:
   [{ runs: [{ t, b, i, nota? }], dica }]. Nota de rodapé é um run vazio com o texto em `nota`. A dica diz o que o arquivo já sabia
   (h1..h6, citacao, lista, titulodoc, grande, tabela, figura) e ajuda a marcar depois. */

(function () {
  'use strict';

  function juntarRuns(runs) {
    const out = [];
    runs.forEach((r) => {
      if (r.nota) { out.push({ t: '', b: false, i: false, nota: r.nota }); return; }
      if (!r.t) return;
      const ult = out[out.length - 1];
      if (ult && !ult.nota && !!ult.b === !!r.b && !!ult.i === !!r.i) ult.t += r.t;
      else out.push({ t: r.t, b: !!r.b, i: !!r.i });
    });
    const comTexto = out.filter((r) => !r.nota);
    if (comTexto.length) {
      comTexto[0].t = comTexto[0].t.replace(/^\s+/, '');
      comTexto[comTexto.length - 1].t = comTexto[comTexto.length - 1].t.replace(/\s+$/, '');
    }
    return out.map((r) => (r.nota ? r : { ...r, t: r.t.replace(/[ \t ]+/g, ' ') })).filter((r) => r.t || r.nota);
  }

  const textoDe = (runs) => runs.map((r) => r.t).join('');

  /* ---------- texto puro / markdown leve ---------- */

  // **negrito**, *itálico* e nota [^1], porque muita gente cola texto que veio de chat ou de markdown
  function inline(str, notas = {}) {
    const runs = [];
    const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[\^[^\]]+\])/g;
    let ult = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > ult) runs.push({ t: str.slice(ult, m.index) });
      const s = m[0];
      if (s.startsWith('[^')) {
        const n = notas[s.slice(2, -1)];
        if (n) runs.push({ t: '', nota: n }); else runs.push({ t: s });
      } else if (s.startsWith('**') || s.startsWith('__')) runs.push({ t: s.slice(2, -2), b: true });
      else runs.push({ t: s.slice(1, -1), i: true });
      ult = m.index + s.length;
    }
    if (ult < str.length) runs.push({ t: str.slice(ult) });
    return juntarRuns(runs);
  }

  // linha de tabela: separada por tab (veio do Excel/Word) ou por barras (markdown)
  const celulasTab = (s) => (s.includes('\t') ? s.split('\t').map((c) => c.trim()) : null);
  const celulasMd = (s) => (/^\|.*\|$/.test(s.trim()) ? s.trim().slice(1, -1).split('|').map((c) => c.trim()) : null);
  const separadorMd = (s) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(s.trim());

  function texto(str) {
    // linhas em branco no começo e no fim não contam na hora de decidir o formato
    let linhas = String(str).replace(/\r\n?/g, '\n').replace(/^\s*\n|\n\s*$/g, '').split('\n');

    // notas no fim, no formato markdown: [^1]: texto da nota
    const notas = {};
    linhas = linhas.filter((l) => {
      const m = /^\s*\[\^([^\]]+)\]:\s*(.+)$/.exec(l);
      if (m) { notas[m[1]] = m[2].trim(); return false; }
      return true;
    });

    // tabelas viram um bloco só antes de qualquer outra coisa
    const tabelas = [];
    const marcadas = [];
    for (let i = 0; i < linhas.length; i++) {
      const tab = celulasTab(linhas[i]) || celulasMd(linhas[i]);
      if (!tab || tab.length < 2) { marcadas.push(linhas[i]); continue; }
      const fim = (k) => k < linhas.length && (separadorMd(linhas[k]) || (celulasTab(linhas[k]) || celulasMd(linhas[k]) || []).length >= 2);
      let j = i;
      const rows = [];
      while (fim(j)) {
        if (!separadorMd(linhas[j])) rows.push(celulasTab(linhas[j]) || celulasMd(linhas[j]));
        j++;
      }
      if (rows.length >= 2) {
        tabelas.push(rows);
        marcadas.push('\u0000TABELA' + (tabelas.length - 1));
        i = j - 1;
      } else marcadas.push(linhas[i]);
    }
    linhas = marcadas;
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
      const solta = /^(#{1,6}\s|>\s?|[-–•●▪◦*]\s|[a-z]\)\s|\d{1,2}[.)]\s|\u0000TABELA)/.test(s) || /^(tabela|quadro|figura|gr[aá]fico|fonte)\b/i.test(s);
      if (porLinha || solta) { fechar(); blocos.push(s); return; }
      if (acc.length && /-$/.test(acc[acc.length - 1]) && /^[a-zà-ÿ]/.test(s)) {
        acc[acc.length - 1] = acc[acc.length - 1].slice(0, -1) + s;
      } else acc.push(s);
    });
    fechar();

    return blocos.map((s) => {
      const tb = /^\u0000TABELA(\d+)$/.exec(s);
      if (tb) return { runs: [], dica: 'tabela', linhas: tabelas[+tb[1]] };
      let dica = null;
      const h = /^(#{1,6})\s+(.*)$/.exec(s);
      if (h) { dica = 'h' + h[1].length; s = h[2]; }
      else if (/^>\s?/.test(s)) { dica = 'citacao'; s = s.replace(/^>\s?/, ''); }
      return { runs: inline(s, notas), dica };
    }).filter((p) => p.runs.length || p.linhas);
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

  // notas: o mammoth põe a chamada como <a href="#footnote-1"> e o texto num <ol> no fim
  function runsDoDom(el, notas = {}) {
    const runs = [];
    (function andar(no, b, i) {
      if (no.nodeType === 3) { runs.push({ t: no.nodeValue, b, i }); return; }
      if (no.nodeType !== 1) return;
      const tag = no.tagName;
      if (tag === 'IMG' || tag === 'TABLE') return;
      if (tag === 'BR') { runs.push({ t: ' ', b, i }); return; }
      if (tag === 'A' && /^#(footnote|endnote)-/.test(no.getAttribute('href') || '')) {
        const n = notas[no.getAttribute('href').slice(1)];
        if (n) runs.push({ t: '', nota: n });
        return;
      }
      const nb = b || tag === 'STRONG' || tag === 'B';
      const ni = i || tag === 'EM' || tag === 'I';
      no.childNodes.forEach((f) => andar(f, nb, ni));
    })(el, false, false);
    return juntarRuns(runs);
  }

  const medir = (src) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => ok({ w: 0, h: 0 });
    img.src = src;
  });

  async function docx(buffer) {
    if (!window.mammoth) throw new Error('O leitor de Word não carregou. Confere a internet e tenta de novo.');
    const res = await window.mammoth.convertToHtml({ arrayBuffer: buffer }, { styleMap: MAPA_ESTILOS });
    const doc = new DOMParser().parseFromString('<div>' + res.value + '</div>', 'text/html');
    const raiz = doc.body.firstChild;
    const paras = [];

    const notas = {};
    raiz.querySelectorAll('li[id^="footnote-"], li[id^="endnote-"]').forEach((li) => {
      li.querySelectorAll('a[href^="#footnote-ref"], a[href^="#endnote-ref"]').forEach((a) => a.remove());
      notas[li.id] = li.textContent.replace(/\s+/g, ' ').trim();
      const ol = li.parentElement;
      li.remove();
      if (ol && !ol.children.length) ol.remove();
    });

    function lista(el, nivel) {
      let n = 0;
      el.querySelectorAll(':scope > li').forEach((li) => {
        const copia = li.cloneNode(true);
        copia.querySelectorAll('ul, ol').forEach((x) => x.remove());
        const marca = el.tagName === 'OL' ? String.fromCharCode(97 + (n++ % 26)) + ') ' : '– ';
        const runs = runsDoDom(copia, notas);
        if (runs.length) paras.push({ runs: juntarRuns([{ t: marca }].concat(runs)), dica: 'lista' });
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => lista(sub, nivel + 1));
      });
    }

    function tabela(el) {
      const linhas = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
      const largura = Math.max(0, ...linhas.map((l) => l.length));
      const cheias = linhas.filter((l) => l.some(Boolean)).map((l) => l.concat(Array(largura - l.length).fill('')));
      if (cheias.length) paras.push({ runs: [], dica: 'tabela', linhas: cheias });
    }

    // imagem dentro de um parágrafo sai como figura logo depois dele
    function imagens(el) {
      el.querySelectorAll('img').forEach((img) => {
        if (/^data:image\/(png|jpe?g|gif)/.test(img.getAttribute('src') || '')) {
          paras.push({ runs: [], dica: 'figura', src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' });
        }
      });
    }

    raiz.childNodes.forEach((el) => {
      if (el.nodeType !== 1) return;
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) {
        paras.push({ runs: runsDoDom(el, notas), dica: el.classList.contains('titulodoc') ? 'titulodoc' : 'h' + tag[1] });
      } else if (tag === 'BLOCKQUOTE') {
        const ps = el.querySelectorAll('p');
        (ps.length ? ps : [el]).forEach((p) => paras.push({ runs: runsDoDom(p, notas), dica: 'citacao' }));
      } else if (tag === 'UL' || tag === 'OL') {
        lista(el, 0);
      } else if (tag === 'TABLE') {
        tabela(el);
      } else {
        paras.push({ runs: runsDoDom(el, notas), dica: el.classList.contains('subtitulodoc') ? 'subtitulodoc' : null });
        imagens(el);
      }
    });

    // tamanho de exibição: o que o Word guarda em wp:extent (EMU), não o tamanho em pixels da imagem
    const figuras = paras.filter((p) => p.dica === 'figura');
    let extensoes = [];
    try {
      if (window.JSZip && figuras.length) {
        const xml = await (await window.JSZip.loadAsync(buffer)).file('word/document.xml').async('string');
        extensoes = [...xml.matchAll(/<wp:(?:inline|anchor)\b[\s\S]*?<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => ({ w: +m[1] / 9525, h: +m[2] / 9525 }));
      }
    } catch (e) { /* sem as medidas do Word, usa o tamanho da imagem */ }
    await Promise.all(figuras.map(async (p, k) => Object.assign(p, extensoes.length === figuras.length ? extensoes[k] : await medir(p.src))));

    const avisos = [];
    const nt = paras.filter((p) => p.dica === 'tabela').length;
    const nNotas = Object.keys(notas).length;
    const partes = [];
    if (figuras.length) partes.push(`${figuras.length} imagem${figuras.length > 1 ? 'ns' : ''}`);
    if (nt) partes.push(`${nt} tabela${nt > 1 ? 's' : ''}`);
    if (nNotas) partes.push(`${nNotas} nota${nNotas > 1 ? 's' : ''} de rodapé`);
    if (partes.length) avisos.push(`Vieram junto: ${partes.join(', ')}. Confere título e fonte de cada ilustração nas Marcações.`);
    avisos.push('Gráfico desenhado dentro do Word (e não colado como imagem) não vem: cola ele como imagem antes de enviar.');
    return { paras: paras.filter((p) => p.runs.length || p.dica === 'tabela' || p.dica === 'figura'), avisos };
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
