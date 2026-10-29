/* Decide o que é cada parágrafo (título, citação, referência, tabela...) e monta o
   trabalho na ordem da NBR 14724: pré-textuais, textuais, pós-textuais. */

(function () {
  'use strict';

  const { textoDe, juntarRuns } = window.Ler;

  const SECOES = [
    [/^resumo$/i, 'resumo'],
    [/^resumen$/i, 'resumo'],
    [/^abstract$/i, 'resumo'],
    [/^agradecimentos?$/i, 'agrad'],
    [/^(dedicat[oó]ria|ep[ií]grafe)$/i, 'agrad'],
    [/^refer[eê]ncias(\s+bibliogr[aá]ficas)?$/i, 'refs'],
    [/^bibliografia$/i, 'refs'],
    [/^gloss[aá]rio$/i, 'pos'],
    [/^ap[eê]ndices?\b.*/i, 'pos'],
    [/^anexos?\b.*/i, 'pos'],
    [/^sum[aá]rio$/i, 'sumario'],
    [/^[ií]ndice$/i, 'sumario'],
    [/^lista\s+de\s+.+/i, 'sumario']
  ];
  // 'pre' é o nome antigo de agradecimentos, de trabalhos salvos antes
  const PRE = new Set(['resumo', 'agrad', 'pre']);

  const NUMERO = /^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(\S.*)$/;
  const maiuscula = (s) => s === s.toLocaleUpperCase('pt-BR') && /[A-ZÀ-Ý]{3}/.test(s);
  const curto = (s, n = 120) => s.length <= n && !/[.;,]$/.test(s);

  // "Tabela 2 – Título", "Figura 3: Título", "Gráfico 1 - Título"
  const LEGENDA = /^(tabela|quadro|figura|gr[aá]fico|imagem|ilustra[cç][aã]o|fotografia|mapa|esquema|diagrama|fluxograma)\s*(\d+)?\s*[–—:.-]?\s*(.*)$/i;
  const FONTE = /^fonte\s*:\s*(.+)$/i;
  const ROTULOS = { tabela: 'Tabela', quadro: 'Quadro', figura: 'Figura', grafico: 'Gráfico', imagem: 'Figura', ilustracao: 'Figura', fotografia: 'Fotografia', mapa: 'Mapa', esquema: 'Esquema', diagrama: 'Diagrama', fluxograma: 'Fluxograma' };
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

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
      if (r.nota) { out.push(r); return; }
      if (corta >= r.t.length) { corta -= r.t.length; return; }
      out.push({ ...r, t: r.t.slice(corta) });
      corta = 0;
    });
    return juntarRuns(out);
  }

  // Tira as aspas de abertura e de fechamento de uma citação longa: na ABNT ela vai sem aspas.
  function semAspas(runs) {
    if (runs.some((r) => r.nota)) return runs;
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

  // Tabela com maioria de células numéricas é Tabela (IBGE); com texto é Quadro
  function rotuloTabela(linhas) {
    const corpo = linhas.slice(1).flat().filter(Boolean);
    const num = corpo.filter((c) => /^[\d\s.,%R$()+-]+$/.test(c)).length;
    return corpo.length && num / corpo.length >= 0.4 ? 'Tabela' : 'Quadro';
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

  // legenda logo antes e "Fonte:" logo depois da tabela ou figura viram parte dela
  function grudarLegendas(blocos) {
    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      if (b.tipo !== 'tabela' && b.tipo !== 'figura') continue;
      const ant = blocos[i - 1];
      const m = ant && ['p', 'fora'].includes(ant.tipo) && LEGENDA.exec(textoDe(ant.runs).trim());
      if (m && textoDe(ant.runs).length < 220 && (m[2] || m[3])) {
        const rot = ROTULOS[semAcento(m[1].toLowerCase())];
        if (rot && (b.tipo === 'tabela') === ['Tabela', 'Quadro'].includes(rot)) b.rotulo = rot;
        else if (rot && b.tipo === 'figura' && !['Tabela', 'Quadro'].includes(rot)) b.rotulo = rot;
        b.legenda = m[3].trim();
        blocos.splice(i - 1, 1);
        i--;
      }
      const dep = blocos[i + 1];
      const f = dep && ['p', 'fora'].includes(dep.tipo) && FONTE.exec(textoDe(dep.runs).trim());
      if (f) { b.fonte = f[1].trim(); blocos.splice(i + 1, 1); }
    }
  }

  function marcar(paras) {
    const blocos = [];
    let modo = null;          // 'sumario' | 'refs' | 'pre'
    let viuSecao = false;
    const antes = [];         // linhas antes da primeira seção: capa, folha de rosto, cabeçalho

    paras.forEach((p) => {
      if (p.dica === 'tabela') {
        blocos.push(bloco('tabela', [], { linhas: p.linhas, rotulo: rotuloTabela(p.linhas), legenda: '', fonte: '' }));
        return;
      }
      if (p.dica === 'figura') {
        blocos.push(bloco('figura', [], { src: p.src, w: p.w || 0, h: p.h || 0, rotulo: 'Figura', legenda: p.alt && !/^(imagem|image|picture)\s*\d*$/i.test(p.alt) ? p.alt : '', fonte: '' }));
        return;
      }
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
          blocos.push(bloco('fora', p.runs, { motivo: 'sumário ou lista antiga' }));
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
      } else if (maiuscula(t) && curto(t, 90) && abre && !LEGENDA.test(t)) {
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

    grudarLegendas(blocos);

    const capa = lerCapa(antes.filter(({ bloco: b }) => blocos.includes(b)));
    capa.tituloBlocos.forEach((b, k) => {
      b.tipo = k === 0 ? 'capa' : 'fora';
      delete b.motivo;
      if (k === 0) b.runs = [{ t: capa.campos.titulo + (capa.campos.subtitulo ? ': ' + capa.campos.subtitulo : ''), b: false, i: false }];
    });
    if (capa.temCapa) antes.forEach(({ bloco: b }) => { if (b.tipo === 'fora') b.motivo = 'capa do arquivo · foi pra ficha'; });

    return { blocos, capa: capa.campos, temCapa: capa.temCapa };
  }

  /* ---------- siglas ---------- */

  const LIGA = /^(de|da|do|das|dos|e|em|para|a|o|na|no|com|à)$/i;
  // "Conselho Federal de Psicologia (CFP)": as iniciais das palavras de peso batem com a sigla
  function siglas(blocos) {
    const achadas = new Map();
    blocos.forEach((b) => {
      if (!['p', 'li', 'cit'].includes(b.tipo)) return;
      const t = textoDe(b.runs);
      const re = /\(([A-ZÀ-Ý][A-ZÀ-Ý0-9-]{1,9})\)/g;
      let m;
      while ((m = re.exec(t))) {
        const sigla = m[1];
        const letras = sigla.replace(/[^A-ZÀ-Ý]/g, '');
        if (letras.length < 2 || achadas.has(sigla)) continue;
        const antes = t.slice(0, m.index).trim().split(/\s+/);
        const nome = [];
        let pesos = 0;
        for (let k = antes.length - 1; k >= 0 && pesos < letras.length; k--) {
          const w = antes[k].replace(/[,;:]$/, '');
          nome.unshift(w);
          if (!LIGA.test(w)) pesos++;
        }
        const iniciais = nome.filter((w) => !LIGA.test(w)).map((w) => semAcento(w[0]).toUpperCase()).join('');
        if (iniciais === semAcento(letras)) achadas.set(sigla, nome.join(' ').replace(/^./, (c) => c.toUpperCase()));
      }
    });
    return [...achadas].map(([sigla, nome]) => ({ sigla, nome })).sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR'));
  }

  /* ---------- citações no estilo APA ---------- */

  const tituloCaso = (s) => s.toLocaleLowerCase('pt-BR').replace(/(^|[\s-])(\S)/g, (m, a, c) => a + c.toLocaleUpperCase('pt-BR'))
    .replace(/\s(D[aeo]s?|E|Em|Para)(?=\s)/g, (m) => m.toLocaleLowerCase('pt-BR'));

  // (SILVA; SOUZA, 2012, p. 3) → (Silva & Souza, 2012, p. 3); (FREUD apud LIMA, 2010) → (Freud, como citado em Lima, 2010)
  function citacaoAPA(texto) {
    return texto.replace(/\(([^()]*\b(1[5-9]\d{2}|20\d{2})[^()]*)\)/g, (todo, dentro) => {
      if (!/[A-ZÀ-Ý]{2,}/.test(dentro)) return todo;
      const obras = [];
      let pend = [];
      dentro.split(';').forEach((seg) => {
        const s = seg.trim();
        if (!/\d{4}/.test(s)) { pend.push(s); return; }
        const [nome, ...resto] = s.split(',');
        const autores = pend.concat(nome.trim()).map((a) => a.replace(/\b([A-ZÀ-Ý][A-ZÀ-Ý'-]+(?:\s+[A-ZÀ-Ý][A-ZÀ-Ý'-]+)*)\b/g, (n) => tituloCaso(n)));
        let quem = autores.length > 2 ? autores[0] + ' et al.' : autores.join(' & ');
        quem = quem.replace(/\s+apud\s+/i, ', como citado em ');
        obras.push(quem + (resto.length ? ',' + resto.join(',') : ''));
        pend = [];
      });
      if (pend.length) return todo;
      return '(' + obras.join('; ') + ')';
    });
  }

  /* ---------- montar ---------- */

  const chaveOrdem = (runs) => semAcento(textoDe(runs)).toUpperCase();

  function montar(blocos, opcoes) {
    const apa = opcoes.norma === 'apa';
    const agrad = [], resumo = [], texto = [];
    const cont = [0, 0, 0, 0, 0];
    const contIlu = {};
    let grupo = null;
    let nNota = 0;

    // numera as notas na ordem em que aparecem e, na APA, converte as citações
    const preparar = (runs) => runs.map((r) => {
      if (r.nota) return { ...r, n: ++nNota };
      return apa ? { ...r, t: citacaoAPA(r.t) } : r;
    });

    blocos.forEach((b) => {
      if (b.tipo === 'fora' || b.tipo === 'capa' || b.tipo === 'subtitulo') return;
      if (b.tipo === 'secao') {
        grupo = b.papel || 'pos';
        let runs = b.runs;
        if (apa) runs = [{ t: tituloCaso(textoDe(b.runs)), b: false, i: false }];
        const item = { kind: 'secao', runs, papel: grupo, id: b.id };
        if (grupo === 'resumo') resumo.push(item);
        else if (PRE.has(grupo)) agrad.push(item);
        else texto.push(item);
        return;
      }
      if (b.tipo === 'titulo') {
        grupo = null;
        const n = b.nivel || 1;
        cont[n - 1]++;
        for (let k = n; k < 5; k++) cont[k] = 0;
        // nível pulado (2 → 2.1.1) conta o intermediário como 1, e o próximo do mesmo nível segue dele
        for (let k = 0; k < n - 1; k++) if (!cont[k]) cont[k] = 1;
        let runs = preparar(b.runs);
        if (apa && maiuscula(textoDe(runs))) runs = runs.map((r) => (r.nota ? r : { ...r, t: tituloCaso(r.t) }));
        texto.push({ kind: 'titulo', nivel: n, num: apa ? '' : cont.slice(0, n).join('.'), runs, id: b.id });
        return;
      }
      if (b.tipo === 'tabela' || b.tipo === 'figura') {
        const rot = b.rotulo || (b.tipo === 'tabela' ? 'Tabela' : 'Figura');
        contIlu[rot] = (contIlu[rot] || 0) + 1;
        texto.push({
          kind: b.tipo, rotulo: rot, num: contIlu[rot], legenda: b.legenda || '', fonte: b.fonte || '', id: b.id,
          linhas: b.linhas, src: b.src, w: b.w, h: b.h
        });
        return;
      }
      const item = { kind: b.tipo, runs: preparar(b.runs), id: b.id };
      if (grupo === 'resumo') { item.pre = true; resumo.push(item); }
      else if (PRE.has(grupo)) { item.pre = true; item.agrad = true; agrad.push(item); }
      else texto.push(item);
    });

    if (opcoes.ordenarRefs || apa) {
      for (let i = 0; i < texto.length; i++) {
        if (texto[i].kind !== 'ref') continue;
        let j = i;
        while (j < texto.length && texto[j].kind === 'ref') j++;
        const fatia = texto.slice(i, j).sort((a, b) => chaveOrdem(a.runs).localeCompare(chaveOrdem(b.runs), 'pt-BR'));
        texto.splice(i, j - i, ...fatia);
        i = j;
      }
    }

    const ilustracoes = texto.filter((it) => it.kind === 'tabela' || it.kind === 'figura');
    // uma lista para cada tipo, como recomenda a NBR 14724 (lista de figuras, de quadros, de tabelas…)
    const listas = [];
    if (!apa && opcoes.listas !== false) {
      const ordem = ['Figura', 'Gráfico', 'Fotografia', 'Mapa', 'Esquema', 'Diagrama', 'Fluxograma', 'Quadro', 'Tabela'];
      const plural = { Figura: 'FIGURAS', Gráfico: 'GRÁFICOS', Fotografia: 'FOTOGRAFIAS', Mapa: 'MAPAS', Esquema: 'ESQUEMAS', Diagrama: 'DIAGRAMAS', Fluxograma: 'FLUXOGRAMAS', Quadro: 'QUADROS', Tabela: 'TABELAS' };
      ordem.forEach((rot) => {
        const itens = ilustracoes.filter((it) => it.rotulo === rot);
        if (itens.length) listas.push({ titulo: 'LISTA DE ' + plural[rot], itens });
      });
    }

    const sumario = texto.filter((it) => it.kind === 'titulo' || it.kind === 'secao');
    return {
      pre: agrad.concat(resumo), agrad, resumo, texto, sumario, listas,
      siglas: !apa && opcoes.siglas !== false ? siglas(blocos) : [],
      notas: nNota
    };
  }

  // Uma seção sem número escolhida à mão: descobre o papel pelo nome
  function papelManual(runs) {
    const s = papelDe(textoDe(runs).trim());
    return s && s.papel !== 'sumario' ? s.papel : 'pos';
  }

  window.Marcar = { marcar, montar, papelManual, novoId, siglas, citacaoAPA, tituloCaso };
})();
