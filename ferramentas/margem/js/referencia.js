/* Monta referência no formato da NBR 6023:2018 ou da APA 7 a partir de campos soltos,
   e converte uma referência ABNT pronta para APA. Devolve runs (para manter o
   negrito da ABNT ou o itálico da APA) e o texto puro. */

(function () {
  'use strict';

  const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const SUFIXOS = /^(j[uú]nior|jr\.?|filho|neto|sobrinho|segundo)$/i;
  const LIGA = /^(d[aeo]s?|e)$/i;
  const titulo = (s) => s.toLocaleLowerCase('pt-BR').replace(/(^|[\s-])(\S)/g, (m, a, c) => a + c.toLocaleUpperCase('pt-BR')).replace(/\s(D[aeo]s?|E)(?=\s|$)/g, (m) => m.toLocaleLowerCase('pt-BR'));

  // "Ana Paula de Souza" → { sob: 'Souza', pre: 'Ana Paula de' }; "SOUZA, Ana" também
  function partes(nome) {
    const s = nome.trim().replace(/\s+/g, ' ');
    if (!s) return null;
    if (s.includes(',')) {
      const [sob, resto] = s.split(/,(.*)/);
      return { sob: sob.trim(), pre: (resto || '').trim() };
    }
    const p = s.split(' ');
    if (p.length === 1) return { sob: p[0], pre: '' };
    if (SUFIXOS.test(p[p.length - 1]) && p.length > 2) return { sob: p.slice(-2).join(' '), pre: p.slice(0, -2).join(' ') };
    return { sob: p[p.length - 1], pre: p.slice(0, -1).join(' ') };
  }

  function umAutor(nome, entidade) {
    if (!nome.trim()) return '';
    if (entidade) return nome.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
    const { sob, pre } = partes(nome);
    return sob.toLocaleUpperCase('pt-BR') + (pre ? ', ' + pre : '');
  }

  // até três autores, todos; quatro ou mais, o primeiro e et al. (a norma permite as duas formas)
  function autores(txt, entidade) {
    const lista = String(txt || '').split('\n').map((n) => umAutor(n, entidade)).filter(Boolean);
    if (!lista.length) return '';
    if (lista.length > 3) return lista[0] + ' et al.';
    return lista.join('; ');
  }

  /* ---------- APA ---------- */

  const iniciais = (pre) => pre.split(/[\s-]+/).filter((w) => w && !LIGA.test(w)).map((w) => w[0].toLocaleUpperCase('pt-BR') + '.').join(' ');

  function autorAPA(nome, entidade, inverso = true) {
    if (!nome || !String(nome).trim()) return '';
    if (entidade) { const s = nome.trim(); return s === s.toUpperCase() ? titulo(s) : s; }
    const p = typeof nome === 'string' ? partes(nome) : nome;
    const sob = p.sob === p.sob.toUpperCase() ? titulo(p.sob) : p.sob;
    const ini = iniciais(p.pre);
    if (!ini) return sob;
    return inverso ? `${sob}, ${ini}` : `${ini} ${sob}`;
  }

  // APA 7: até 20 autores, vírgula e "&" antes do último
  function autoresAPA(lista, entidade, inverso = true) {
    const a = lista.map((n) => autorAPA(n, entidade, inverso)).filter(Boolean);
    if (a.length <= 1) return a[0] || '';
    if (!inverso) return a.length === 2 ? a.join(' & ') : a.slice(0, -1).join(', ') + ', & ' + a[a.length - 1];
    return a.slice(0, -1).join(', ') + ', & ' + a[a.length - 1];
  }

  const comPonto = (s) => (s && !/[.!?]$/.test(s.trim()) ? s.trim() + '.' : (s || '').trim());
  const primeiraMaiuscula = (s) => s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1);

  function montarAPA(tipo, c) {
    const R = [];
    const n = (t) => t && R.push({ t, b: false, i: false });
    const i = (t) => t && R.push({ t, b: false, i: true });
    const lista = c.autoresLista || String(c.autores || '').split('\n').filter((s) => s.trim());
    const ent = c.entidade || tipo === 'norma';
    const aut = autoresAPA(lista, ent);
    const ano = c.ano ? `(${c.ano}).` : '(s.d.).';
    const tit = (c.titulo || '').trim();
    const sub = (c.subtitulo || '').trim();
    const tituloCompleto = tit + (sub ? ': ' + primeiraMaiuscula(sub) : '');
    const edicao = /^\d+$/.test(String(c.edicao || '').trim()) && +c.edicao > 1 ? ` (${+c.edicao}ª ed.)` : (c.edicao && !/^\d+$/.test(c.edicao) ? ` (${String(c.edicao).replace(/\.$/, '')})` : '');
    const link = c.doi ? ' https://doi.org/' + c.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : (c.url ? ' ' + c.url.trim() : '');

    n((aut ? comPonto(aut) : '') + ' ' + ano + ' ');
    if (tipo === 'livro') {
      i(tituloCompleto || 'Título'); n(edicao + '. '); n(c.editora ? comPonto(c.editora) : ''); n(link);
    } else if (tipo === 'capitulo') {
      n(comPonto(tituloCompleto || 'Título do capítulo') + ' ');
      const orgs = String(c.organizadores || '').split('\n').filter((s) => s.trim());
      n('In ' + (orgs.length ? `${autoresAPA(orgs, false, false)} (${orgs.length > 1 ? 'Orgs.' : 'Org.'}), ` : ''));
      i((c.livro || 'Título do livro').trim());
      n(`${edicao ? edicao.replace(/^ \(/, ' (').replace(/\)$/, ', ') : ' ('}pp. ${(c.paginas || '').replace('-', '–')}). `.replace(' (pp. ). ', '. '));
      n(c.editora ? comPonto(c.editora) : ''); n(link);
    } else if (tipo === 'artigo') {
      n(comPonto(tituloCompleto || 'Título do artigo') + ' ');
      i((c.revista || 'Nome da revista').trim());
      if (c.volume) { n(', '); i(String(c.volume).trim()); }
      if (c.numero) n(`(${String(c.numero).trim()})`);
      if (c.paginas) n(', ' + String(c.paginas).trim().replace('-', '–'));
      n('.'); n(link);
    } else {
      i(tituloCompleto || 'Título'); n('. ');
      if (tipo === 'norma' && c.editora && autorAPA(lista[0] || '', true) !== c.editora) n(comPonto(c.editora));
      n(link);
    }
    const runs = window.Ler.juntarRuns(R.map((r) => ({ ...r, t: r.t.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1') })));
    return { runs, texto: runs.map((r) => r.t).join('') };
  }

  /* ---------- ABNT ---------- */

  const ponto = comPonto;

  function edicaoABNT(e) {
    const s = String(e || '').trim();
    if (!s) return '';
    if (/^\d+$/.test(s)) return +s > 1 ? `${s}. ed.` : '';
    return s;
  }

  function acesso(data) {
    const d = data ? new Date(data + 'T12:00:00') : new Date();
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

  function imprenta(c) {
    const local = c.local && c.local.trim() ? c.local.trim() : '[S. l.]';
    const editora = c.editora && c.editora.trim() ? c.editora.trim() : '[s. n.]';
    return `${local}: ${editora}, ${c.ano || '[20--]'}`;
  }

  function online(c) {
    let s = '';
    if (c.doi) s += ` DOI: ${c.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}.`;
    if (c.url) s += ` Disponível em: ${c.url.trim()}. Acesso em: ${acesso(c.acesso)}.`;
    return s;
  }

  function montar(tipo, c, norma) {
    if (norma === 'apa') return montarAPA(tipo, c);
    const R = [];
    const n = (t) => t && R.push({ t, b: false, i: false });
    const b = (t) => t && R.push({ t, b: true, i: false });
    // em resolução e norma o autor é sempre um órgão
    const aut = autores(c.autores, c.entidade || tipo === 'norma');
    const tit = (c.titulo || '').trim();
    const sub = (c.subtitulo || '').trim();

    if (tipo === 'livro') {
      n(aut ? ponto(aut) + ' ' : '');
      b(tit || 'Título');
      n((sub ? ': ' + sub : '') + '. ');
      const ed = edicaoABNT(c.edicao);
      n(ed ? ponto(ed) + ' ' : '');
      n(imprenta(c) + '.');
      n(online(c));
    } else if (tipo === 'capitulo') {
      n(aut ? ponto(aut) + ' ' : '');
      n(ponto((tit || 'Título do capítulo') + (sub ? ': ' + sub : '')) + ' ');
      const org = autores(c.organizadores, false);
      n('In: ' + (org ? `${org} (org.). ` : ''));
      b((c.livro || 'Título do livro').trim());
      n('. ');
      const ed = edicaoABNT(c.edicao);
      n(ed ? ponto(ed) + ' ' : '');
      n(imprenta(c));
      n(c.paginas ? `. p. ${c.paginas.trim()}.` : '.');
      n(online(c));
    } else if (tipo === 'artigo') {
      n(aut ? ponto(aut) + ' ' : '');
      n(ponto((tit || 'Título do artigo') + (sub ? ': ' + sub : '')) + ' ');
      b((c.revista || 'Nome da revista').trim());
      const pt = [];
      if (c.local) pt.push(c.local.trim());
      if (c.volume) pt.push('v. ' + c.volume.trim());
      if (c.numero) pt.push('n. ' + c.numero.trim());
      if (c.paginas) pt.push('p. ' + c.paginas.trim());
      pt.push(c.ano || '[20--]');
      n(', ' + pt.join(', ') + '.');
      n(online(c));
    } else if (tipo === 'site') {
      n(aut ? ponto(aut) + ' ' : '');
      b(tit || 'Título da página');
      n((sub ? ': ' + sub : '') + '. ');
      n(`${c.local && c.local.trim() ? c.local.trim() + ', ' : ''}${c.ano || '[20--]'}.`);
      n(online(c) || ' Disponível em: endereço. Acesso em: ' + acesso(c.acesso) + '.');
    } else if (tipo === 'norma') {
      n(aut ? ponto(aut) + ' ' : '');
      b(tit || 'Resolução nº 0, de 1º de janeiro de 2000');
      n('. ');
      n(c.ementa ? ponto(c.ementa.trim()) + ' ' : '');
      n(imprenta(c) + '.');
      n(online(c));
    }

    const runs = window.Ler.juntarRuns(R.map((r) => ({ ...r, t: r.t.replace(/\s+/g, ' ') })));
    return { runs, texto: runs.map((r) => r.t).join('') };
  }

  /* ---------- ABNT pronta → APA ---------- */

  // fim do bloco de autores: o primeiro ". " que não é inicial de prenome ("Donald W."),
  // a menos que logo depois já venha o título ("Donald W. O brincar e a realidade")
  function fimAutor(t) {
    const re = /\.\s+/g;
    let m;
    while ((m = re.exec(t))) {
      const inicial = /(^|[\s,;])[A-ZÀ-Ý]$/.test(t.slice(0, m.index));
      const titulo = /^\S+\s+[a-zà-ÿ]/.test(t.slice(m.index + m[0].length));
      if (inicial && !titulo) continue;
      return m.index + m[0].length;
    }
    return -1;
  }

  // Lê uma referência ABNT e devolve os campos; null quando não reconhece o formato
  function lerABNT(t) {
    t = t.replace(/\s+/g, ' ').trim();
    const fa = fimAutor(t);
    if (fa < 0) return null;
    const autorTxt = t.slice(0, fa).replace(/\.\s*$/, '');
    const resto = t.slice(fa);
    const c = {};
    if (/^[^,;]+$/.test(autorTxt) && autorTxt === autorTxt.toUpperCase()) {
      c.entidade = true;
      c.autoresLista = [autorTxt];
    } else {
      const etal = /\bet al\.?$/.test(autorTxt);
      const lista = autorTxt.replace(/\s*et al\.?$/, '').split(';').map((s) => s.trim()).filter(Boolean);
      if (!lista.length || !lista.every((a) => /^[A-ZÀ-Ý' -]{2,},/.test(a))) return null;
      c.autoresLista = lista.map((a) => partes(a));
      if (etal) c.autoresLista.push({ sob: 'et al.', pre: '' });
    }
    // ano da publicação: o último antes do "Acesso em" (o "(1912)" no título é da obra original)
    const anos = t.replace(/Acesso em:.*$/i, '').replace(/DOI:.*$/i, '').match(/\b(1[5-9]\d{2}|20\d{2})\b/g) || [];
    c.ano = anos[anos.length - 1] || '';
    const doi = /DOI:\s*(\S+?)\.?(\s|$)/i.exec(t);
    if (doi) c.doi = doi[1];
    const url = /Dispon[íi]vel em:\s*<?(\S+?)>?\.?\s+Acesso/i.exec(t);
    if (url && !doi) c.url = url[1];

    const art = /^(.*?)\.\s+([^.]+?),\s*(?:[^,]+,\s*)?v\.\s*([\w-]+)(?:,\s*n\.\s*([\w-]+))?(?:,\s*p\.\s*([\d–-]+))?/.exec(resto);
    // "(org.)" é opcional: capítulo do próprio autor do livro vem sem ele
    const cap = /^(.*?)\.\s+In:\s*(.*?)(\s*\(orgs?\.\))?\.\s*([^.]+)\.\s*(?:(\d+)\.\s*ed\.\s*)?([^:]+):\s*([^,]+),\s*\d{4}(?:\.\s*p\.\s*([\d–-]+))?/i.exec(resto);
    if (cap) {
      Object.assign(c, { tipo: 'capitulo', titulo: cap[1], livro: cap[4], edicao: cap[5] || '', editora: cap[7].trim(), paginas: cap[8] || '' });
      if (cap[3]) c.organizadores = cap[2].split(';').map((o) => { const p = partes(o); return p.pre ? `${p.pre} ${titulo(p.sob)}` : titulo(p.sob); }).join('\n');
      return c;
    }
    if (art) {
      const [titulo0, ...sub] = art[1].split(': ');
      Object.assign(c, { tipo: 'artigo', titulo: titulo0, subtitulo: sub.join(': '), revista: art[2].trim(), volume: art[3], numero: art[4] || '', paginas: art[5] || '' });
      return c;
    }
    // livro ou documento: título, edição, frases soltas (ementa de resolução) e Local: Editora, ano
    const livro = /^([^.]+?)\.\s*(?:(\d+)\.\s*ed\.\s*)?(?:[^.]+\.\s+)*?([^:.]+):\s*([^,]+),\s*\d{4}/.exec(resto);
    if (livro) {
      const [titulo0, ...sub] = livro[1].split(': ');
      Object.assign(c, { tipo: c.entidade && /^(resolu|lei|portaria|decreto|instru|nota t)/i.test(titulo0) ? 'norma' : 'livro', titulo: titulo0, subtitulo: sub.join(': '), edicao: livro[2] || '', editora: /^\[s\. n\.\]$/i.test(livro[4].trim()) ? '' : livro[4].trim() });
      return c;
    }
    const site = /^([^.]+?)\.\s/.exec(resto);
    if (site && c.url) {
      Object.assign(c, { tipo: 'site', titulo: site[1] });
      return c;
    }
    return null;
  }

  function abntParaApa(texto) {
    const c = lerABNT(texto);
    if (!c) return null;
    if (c.autoresLista && c.autoresLista.some((a) => a.sob === 'et al.')) {
      c.autoresLista = c.autoresLista.filter((a) => a.sob !== 'et al.');
      const r = montarAPA(c.tipo, c);
      // APA lista todos os autores; com "et al." na ABNT, só dá para avisar
      return { ...r, aviso: 'A ABNT usou "et al.": na APA vão todos os autores (até 20). Completa à mão.' };
    }
    return montarAPA(c.tipo, c);
  }

  // Obras que aparecem em quase todo trabalho de psicologia.
  // Confira sempre com a edição que você usou: ano e editora mudam entre impressões.
  const PRONTAS = {
    dsm: {
      rotulo: 'DSM-5-TR (Artmed)',
      tipo: 'livro',
      campos: { autores: 'American Psychiatric Association', entidade: true, titulo: 'Manual diagnóstico e estatístico de transtornos mentais', subtitulo: 'DSM-5-TR', edicao: '5. ed., texto revisado', local: 'Porto Alegre', editora: 'Artmed', ano: '2023' }
    },
    etica: {
      rotulo: 'Código de Ética do CFP',
      tipo: 'livro',
      campos: { autores: 'Conselho Federal de Psicologia', entidade: true, titulo: 'Código de ética profissional do psicólogo', local: 'Brasília, DF', editora: 'CFP', ano: '2005' }
    }
  };

  window.Referencia = { montar, PRONTAS, autores, abntParaApa, lerABNT };
})();
