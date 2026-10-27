/* Monta referência no formato da NBR 6023:2018 a partir de campos soltos.
   Devolve runs (para manter o negrito do destaque) e o texto puro. */

(function () {
  'use strict';

  const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const SUFIXOS = /^(j[uú]nior|jr\.?|filho|neto|sobrinho|segundo)$/i;

  function umAutor(nome, entidade) {
    const s = nome.trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (entidade) return s.toLocaleUpperCase('pt-BR');
    if (s.includes(',')) {
      const [sob, resto] = s.split(/,(.*)/);
      return sob.trim().toLocaleUpperCase('pt-BR') + ', ' + resto.trim();
    }
    const p = s.split(' ');
    if (p.length === 1) return p[0].toLocaleUpperCase('pt-BR');
    let sob, resto;
    if (SUFIXOS.test(p[p.length - 1]) && p.length > 2) {
      sob = p.slice(-2).join(' ');
      resto = p.slice(0, -2);
    } else {
      sob = p[p.length - 1];
      resto = p.slice(0, -1);
    }
    return sob.toLocaleUpperCase('pt-BR') + ', ' + resto.join(' ');
  }

  // até três autores, todos; quatro ou mais, o primeiro e et al. (a norma permite as duas formas)
  function autores(txt, entidade) {
    const lista = String(txt || '').split('\n').map((n) => umAutor(n, entidade)).filter(Boolean);
    if (!lista.length) return '';
    if (lista.length > 3) return lista[0] + ' et al.';
    return lista.join('; ');
  }

  const ponto = (s) => (s && !/[.!?]$/.test(s.trim()) ? s.trim() + '.' : (s || '').trim());

  function edicao(e) {
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

  function montar(tipo, c) {
    const R = [];
    const n = (t) => t && R.push({ t, b: false, i: false });
    const b = (t) => t && R.push({ t, b: true, i: false });
    // em resolução e norma o autor é sempre um órgão
    const aut = autores(c.autores, c.entidade || tipo === 'norma');
    const titulo = (c.titulo || '').trim();
    const sub = (c.subtitulo || '').trim();

    if (tipo === 'livro') {
      n(aut ? ponto(aut) + ' ' : '');
      b(titulo || 'Título');
      n((sub ? ': ' + sub : '') + '. ');
      const ed = edicao(c.edicao);
      n(ed ? ponto(ed) + ' ' : '');
      n(imprenta(c) + '.');
      n(online(c));
    } else if (tipo === 'capitulo') {
      n(aut ? ponto(aut) + ' ' : '');
      n(ponto((titulo || 'Título do capítulo') + (sub ? ': ' + sub : '')) + ' ');
      const org = autores(c.organizadores, false);
      n('In: ' + (org ? `${org} (org.). ` : ''));
      b((c.livro || 'Título do livro').trim());
      n('. ');
      const ed = edicao(c.edicao);
      n(ed ? ponto(ed) + ' ' : '');
      n(imprenta(c));
      n(c.paginas ? `. p. ${c.paginas.trim()}.` : '.');
      n(online(c));
    } else if (tipo === 'artigo') {
      n(aut ? ponto(aut) + ' ' : '');
      n(ponto((titulo || 'Título do artigo') + (sub ? ': ' + sub : '')) + ' ');
      b((c.revista || 'Nome da revista').trim());
      const partes = [];
      if (c.local) partes.push(c.local.trim());
      if (c.volume) partes.push('v. ' + c.volume.trim());
      if (c.numero) partes.push('n. ' + c.numero.trim());
      if (c.paginas) partes.push('p. ' + c.paginas.trim());
      partes.push(c.ano || '[20--]');
      n(', ' + partes.join(', ') + '.');
      n(online(c));
    } else if (tipo === 'site') {
      n(aut ? ponto(aut) + ' ' : '');
      b(titulo || 'Título da página');
      n((sub ? ': ' + sub : '') + '. ');
      n(`${c.local && c.local.trim() ? c.local.trim() + ', ' : ''}${c.ano || '[20--]'}.`);
      n(online(c) || ' Disponível em: endereço. Acesso em: ' + acesso(c.acesso) + '.');
    } else if (tipo === 'norma') {
      n(aut ? ponto(aut) + ' ' : '');
      b(titulo || 'Resolução nº 0, de 1º de janeiro de 2000');
      n('. ');
      n(c.ementa ? ponto(c.ementa.trim()) + ' ' : '');
      n(imprenta(c) + '.');
      n(online(c));
    }

    const runs = window.Ler.juntarRuns(R.map((r) => ({ ...r, t: r.t.replace(/\s+/g, ' ') })));
    return { runs, texto: runs.map((r) => r.t).join('') };
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

  window.Referencia = { montar, PRONTAS, autores };
})();
