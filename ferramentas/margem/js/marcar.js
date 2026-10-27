/* Decide o que é cada parágrafo (título, citação, referência...) e monta o
   trabalho na ordem da NBR 14724: pré-textuais, textuais, pós-textuais. */

(function () {
  'use strict';

  const { textoDe, juntarRuns } = window.Ler;

  const SECOES = [
    [/^resumo$/i, 'resumo'],
    [/^resumen$/i, 'resumo'],
    [/^abstract$/i, 'resumo'],
    [/^agradecimentos?$/i, 'pre'],
    [/^(dedicat[oó]ria|ep[ií]grafe)$/i, 'pre'],
    [/^refer[eê]ncias(\s+bibliogr[aá]ficas)?$/i, 'refs'],
    [/^bibliografia$/i, 'refs'],
    [/^gloss[aá]rio$/i, 'pos'],
    [/^ap[eê]ndices?\b.*/i, 'pos'],
    [/^anexos?\b.*/i, 'pos'],
    [/^sum[aá]rio$/i, 'sumario'],
    [/^[ií]ndice$/i, 'sumario'],
    [/^lista\s+de\s+.+/i, 'sumario']
  ];
  const PRE = new Set(['resumo', 'pre']);

  const NUMERO = /^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(\S.*)$/;
  const maiuscula = (s) => s === s.toLocaleUpperCase('pt-BR') && /[A-ZÀ-Ý]{3}/.test(s);
  const curto = (s, n = 120) => s.length <= n && !/[.;,]$/.test(s);

  function papelDe(t) {
    const limpo = t.replace(NUMERO, '$2').replace(/[:.]$/, '').trim();
    for (const [re, papel] of SECOES) if (re.test(limpo)) return { papel, limpo };
    return null;
  }

  let seq = 0;
  const novoId = () => 'b' + (++seq).toString(36) + Date.now().toString(36).slice(-3);

  function bloco(tipo, runs, extra) {
    return Object.assign({ id: novoId(), tipo, runs }, extra || {});
  }

  function semNumero(runs) {
    const t = textoDe(runs);
    const m = NUMERO.exec(t);
    if (!m) return runs;
    let corta = t.length - m[2].length;
    const out = [];
    runs.forEach((r) => {
      if (corta >= r.t.length) { corta -= r.t.length; return; }
      out.push({ ...r, t: r.t.slice(corta) });
      corta = 0;
    });
    return juntarRuns(out);
  }

  // Tira as aspas de abertura e de fechamento de uma citação longa: na ABNT ela vai sem aspas.
  function semAspas(runs) {
    const t = textoDe(runs);
    let s = t.replace(/^\s*["“«]/, '');
    s = s.replace(/["”»](\s*\([^()]*\d{4}[^()]*\)\s*\.?)\s*$/, '$1').replace(/["”»]\s*\.?\s*$/, (m) => m.includes('.') ? '.' : '');
    if (s === t) return runs;
    return [{ t: s, b: false, i: false }];
  }

  function chave(runs) {
    const t = textoDe(runs);
    const m = /^([^:]+:)\s*(.*)$/.exec(t);
    return m ? [{ t: m[1], b: true, i: false }, { t: ' ' + m[2], b: false, i: false }] : runs;
  }

  /* ---------- marcar ---------- */

  // Seções que abrem o texto mesmo sem número. Antes da primeira seção, linha em
  // maiúsculas só vira título se for uma destas; o resto é capa (curso, nome, título).
  const ABERTURA = /^(introdu[cç][aã]o|apresenta[cç][aã]o|justificativa|objetivos?|metodologia|m[eé]todos?|desenvolvimento|referencial te[oó]rico|fundamenta[cç][aã]o te[oó]rica|revis[aã]o (de|da) literatura|considera[cç][oõ]es iniciais|contextualiza[cç][aã]o)$/i;
  const PESSOA = /^([A-ZÀ-Ý][a-zà-ÿ'.]+|d[aeo]s?|e)(\s+([A-ZÀ-Ý][a-zà-ÿ'.]+|d[aeo]s?|e)){1,4}$/;
  const capitaliza = (s) => s.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\S)/g, (m, a, c) => a + c.toLocaleUpperCase('pt-BR'))
    .replace(/\s(D[aeo]s?|E)(?=\s)/g, (m) => m.toLocaleLowerCase('pt-BR'));
  const pessoa = (s) => PESSOA.test(s) || (maiuscula(s) && PESSOA.test(capitaliza(s)));

  // Lê a capa e a folha de rosto que já vieram no arquivo e devolve o que achou
  function lerCapa(linhas) {
    // título quebrado em duas linhas (comum em PDF): a de baixo começa minúscula
    const grupos = [];
    linhas.forEach((l) => {
      const ult = grupos[grupos.length - 1];
      if (ult && /^[a-zà-ÿ]/.test(l.t)) { ult.t += ' ' + l.t; ult.blocos.push(l.bloco); }
      else grupos.push({ t: l.t, blocos: [l.bloco], dica: l.dica });
    });

    const c = {};
    const usado = new Set();
    grupos.forEach((g, i) => {
      const t = g.t;
      if (!c.instituicao && t.length < 140 && /\b(universidade|faculdade|centro universit[aá]rio|instituto|escola|funda[cç][aã]o)\b/i.test(t)) { c.instituicao = capitaliza(t).replace(/\b(D[aeo]s?|E|Em)\b/g, (m) => m.toLowerCase()); usado.add(i); }
      else if (!c.curso && /^(curso\s+(de|em)\b|bacharelado|licenciatura|gradua[cç][aã]o em)/i.test(t)) { c.curso = capitaliza(t).replace(/\b(De|Em)\b/g, (m) => m.toLowerCase()); usado.add(i); }
      else if (/^(19|20)\d{2}$/.test(t)) {
        c.ano = t; usado.add(i);
        const ant = grupos[i - 1];
        if (ant && !usado.has(i - 1) && ant.t.length < 40 && !/\d/.test(ant.t)) { c.cidade = capitaliza(ant.t); usado.add(i - 1); }
      }
      else if (!c.natureza && t.length > 60 && /apresentad[oa]|requisito|como parte|para obten[cç][aã]o/i.test(t)) { c.natureza = t; usado.add(i); }
      else if (!c.orientador && /^(prof|orientador|orientadora|orienta[cç][aã]o)/i.test(t)) { c.orientador = t.replace(/^orienta(dor|dora|[cç][aã]o)(\(a\))?\s*:\s*/i, ''); usado.add(i); }
    });

    // título: o estilo Título do Word (ou a fonte maior do PDF); senão o que aparece duas
    // vezes (capa e folha de rosto) e não é nome de gente; senão o mais longo; senão o primeiro
    const livres = grupos.map((g, i) => ({ g, i })).filter(({ i }) => !usado.has(i));
    const cand = livres.filter(({ g }) => g.t.split(/\s+/).length >= 2 && g.t.length <= 260 && !pessoa(g.t));
    const vezes = (g) => grupos.filter((h) => h.t.toLowerCase() === g.t.toLowerCase()).length;
    const escolha = livres.find(({ g }) => g.dica === 'titulodoc' || g.dica === 'grande') ||
      cand.find(({ g }) => vezes(g) > 1) ||
      cand.slice().sort((a, b) => b.g.t.length - a.g.t.length)[0] ||
      livres[0];
    let tituloBlocos = [];
    if (escolha) {
      const t = escolha.g.t;
      const m = /^(.+?):\s+(.+)$/.exec(t);
      c.titulo = m ? m[1] : t;
      if (m) c.subtitulo = m[2];
      if (maiuscula(c.titulo)) c.titulo = c.titulo.charAt(0) + c.titulo.slice(1).toLocaleLowerCase('pt-BR');
      tituloBlocos = escolha.g.blocos;
      grupos.forEach((g, i) => { if (g.t.toLowerCase() === escolha.g.t.toLowerCase()) usado.add(i); });
    }

    const autores = [];
    grupos.forEach((g, i) => {
      if (usado.has(i) || g.dica === 'subtitulodoc' || !pessoa(g.t)) return;
      const nome = maiuscula(g.t) ? capitaliza(g.t) : g.t;
      if (!autores.includes(nome)) autores.push(nome);
      usado.add(i);
    });
    if (autores.length && autores.length <= 6) c.autores = autores.join('\n');
    const sub = grupos.find((g) => g.dica === 'subtitulodoc');
    if (sub) c.subtitulo = sub.t;
    return { campos: c, tituloBlocos, temCapa: !!(c.instituicao || c.ano || c.natureza) };
  }

  function marcar(paras) {
    const blocos = [];
    let modo = null;          // 'sumario' | 'refs' | 'pre'
    let viuSecao = false;
    const antes = [];         // linhas antes da primeira seção: capa, folha de rosto, cabeçalho

    paras.forEach((p) => {
      const t = textoDe(p.runs).trim();
      if (!t) return;

      if (modo === 'sumario') {
        if (t.length < 170 && (/(\.{2,}|…|\s)\s*\d{1,3}\s*$/.test(t) || /\.{3,}\s*$/.test(t))) { blocos.push(bloco('fora', p.runs, { motivo: 'sumário antigo' })); return; }
        modo = null;
      }

      const sec = papelDe(t);
      if (sec && curto(t, 60)) {
        viuSecao = true;
        if (sec.papel === 'sumario') {
          blocos.push(bloco('fora', p.runs, { motivo: 'sumário antigo' }));
          modo = 'sumario';
          return;
        }
        blocos.push(bloco('secao', [{ t: sec.limpo.toLocaleUpperCase('pt-BR'), b: false, i: false }], { papel: sec.papel }));
        modo = sec.papel === 'refs' ? 'refs' : PRE.has(sec.papel) ? 'pre' : null;
        return;
      }

      const m = NUMERO.exec(t);
      const abre = viuSecao || ABERTURA.test(t);
      let nivel = 0;
      if (/^h[1-6]$/.test(p.dica || '') && curto(t, 200)) {
        nivel = m ? m[1].split('.').length : +p.dica[1];
      } else if (m && curto(m[2]) && /^[A-ZÀ-Ý]/.test(m[2]) && m[2].split(' ').length <= 16) {
        nivel = m[1].split('.').length;
      } else if (maiuscula(t) && curto(t, 90) && abre) {
        nivel = 1;
      } else if (p.dica === 'grande' && curto(t, 140) && abre) {
        nivel = maiuscula(t) ? 1 : 2;
      }
      if (nivel) {
        viuSecao = true;
        modo = null;
        blocos.push(bloco('titulo', semNumero(p.runs), { nivel: Math.min(5, nivel) }));
        return;
      }

      // antes da primeira seção: capa, folha de rosto ou cabeçalho solto. Parágrafo
      // longo que não é a natureza do trabalho fica como texto.
      if (!viuSecao && (t.length < 300 || /apresentad[oa]|requisito/i.test(t))) {
        const b = bloco('fora', p.runs, { motivo: 'cabeçalho do arquivo' });
        blocos.push(b);
        antes.push({ t, bloco: b, dica: p.dica });
        return;
      }

      if (/^(palavras?[- ]chave|keywords|palabras clave)\s*:/i.test(t)) { blocos.push(bloco('chave', chave(p.runs))); return; }
      if (modo === 'refs') { blocos.push(bloco('ref', p.runs)); return; }
      if (p.dica === 'citacao') { blocos.push(bloco('cit', semAspas(p.runs))); return; }
      if (t.length >= 240 && /^\s*["“«]/.test(t) && /\(\s*[A-ZÀ-Ý][^()]*\d{4}[^()]*\)\s*\.?\s*$/.test(t)) {
        blocos.push(bloco('cit', semAspas(p.runs)));
        return;
      }
      if (p.dica === 'lista' || /^([-–•●▪◦*]|[a-z]\)|\d{1,2}\))\s+/.test(t)) {
        const runs = p.runs.slice();
        if (/^[•●▪◦*-]\s/.test(t)) runs[0] = { ...runs[0], t: runs[0].t.replace(/^[•●▪◦*-]/, '–') };
        blocos.push(bloco('li', runs));
        return;
      }
      blocos.push(bloco('p', p.runs));
    });

    // texto sem nenhuma seção (uma resenha, um ensaio): o que parecia cabeçalho é o próprio texto
    if (!viuSecao) {
      antes.slice(1).forEach(({ bloco: b }) => { b.tipo = 'p'; delete b.motivo; });
      antes.splice(1);
    }

    const capa = lerCapa(antes);
    capa.tituloBlocos.forEach((b, k) => {
      b.tipo = k === 0 ? 'capa' : 'fora';
      delete b.motivo;
      if (k === 0) b.runs = [{ t: capa.campos.titulo + (capa.campos.subtitulo ? ': ' + capa.campos.subtitulo : ''), b: false, i: false }];
    });
    if (capa.temCapa) antes.forEach(({ bloco: b }) => { if (b.tipo === 'fora') b.motivo = 'capa do arquivo · foi pra ficha'; });

    return { blocos, capa: capa.campos, temCapa: capa.temCapa };
  }

  /* ---------- montar ---------- */

  const chaveOrdem = (runs) => textoDe(runs).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

  function montar(blocos, opcoes) {
    const pre = [], texto = [];
    const cont = [0, 0, 0, 0, 0];
    let grupo = null;

    blocos.forEach((b) => {
      if (b.tipo === 'fora' || b.tipo === 'capa' || b.tipo === 'subtitulo') return;
      if (b.tipo === 'secao') {
        grupo = b.papel || 'pos';
        (PRE.has(grupo) ? pre : texto).push({ kind: 'secao', runs: b.runs, papel: grupo, id: b.id });
        return;
      }
      if (b.tipo === 'titulo') {
        grupo = null;
        const n = b.nivel || 1;
        cont[n - 1]++;
        for (let k = n; k < 5; k++) cont[k] = 0;
        // nível pulado (2 → 2.1.1) conta o intermediário como 1, e o próximo do mesmo nível segue dele
        for (let k = 0; k < n - 1; k++) if (!cont[k]) cont[k] = 1;
        const num = cont.slice(0, n).join('.');
        texto.push({ kind: 'titulo', nivel: n, num, runs: b.runs, id: b.id });
        return;
      }
      const item = { kind: b.tipo, runs: b.runs, id: b.id };
      if (PRE.has(grupo)) { item.pre = true; pre.push(item); } else texto.push(item);
    });

    if (opcoes.ordenarRefs) {
      for (let i = 0; i < texto.length; i++) {
        if (texto[i].kind !== 'ref') continue;
        let j = i;
        while (j < texto.length && texto[j].kind === 'ref') j++;
        const fatia = texto.slice(i, j).sort((a, b) => chaveOrdem(a.runs).localeCompare(chaveOrdem(b.runs), 'pt-BR'));
        texto.splice(i, j - i, ...fatia);
        i = j;
      }
    }

    const sumario = texto.filter((it) => it.kind === 'titulo' || it.kind === 'secao');
    return { pre, texto, sumario };
  }

  // Uma seção sem número escolhida à mão: descobre o papel pelo nome
  function papelManual(runs) {
    const s = papelDe(textoDe(runs).trim());
    return s && s.papel !== 'sumario' ? s.papel : 'pos';
  }

  window.Marcar = { marcar, montar, papelManual, novoId };
})();
