/* Conferências que a banca faz e o aluno esquece:
   citação sem referência, referência que ninguém citou e dado de paciente no texto. */

(function () {
  'use strict';

  const { textoDe } = window.Ler;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const NAO_SOBRENOME = new Set(['IN', 'APUD', 'CF', 'P', 'V', 'N', 'ET', 'AL', 'IBIDEM', 'IDEM', 'OP', 'CIT']);

  /* ---------- citações x referências ---------- */

  function citacoes(blocos) {
    const achadas = [];
    blocos.forEach((b) => {
      if (!['p', 'cit', 'li'].includes(b.tipo)) return;
      const t = textoDe(b.runs);

      // (SOBRENOME, 2010, p. 3) · (SILVA; SOUZA, 2012) · (FREUD, 1912/2010) · (APA, 2023; LIMA, 2020)
      const par = /\(([^()]*\d{4}[^()]*)\)/g;
      let m;
      while ((m = par.exec(t))) {
        m[1].split(';').reduce((pend, seg) => {
          const s = seg.trim();
          const anos = s.match(/\b(1[5-9]\d{2}|20\d{2})[a-z]?\b/g);
          if (!anos) { pend.push(s); return pend; }
          const nome = (pend[0] || s).split(',')[0].replace(/\bet al\.?/i, '').trim();
          const sob = norm(nome).split(' ')[0];
          if (sob && /^[A-ZÇ]/.test(sob) && !NAO_SOBRENOME.has(sob) && sob === norm(nome).split(' ')[0] && nome === nome.toUpperCase()) {
            achadas.push({ sobrenome: norm(nome), anos: anos.map((a) => a.slice(0, 4)), texto: '(' + m[1] + ')', bloco: b.id });
          }
          return [];
        }, []);
      }

      // Silva (2010) · Freud (1912/2010) · Lima e Costa (2021) · Conselho Federal de Psicologia (2018)
      const narr = /((?:[A-ZÀ-Ý][a-zà-ÿ]+)(?:\s+(?:de|da|do|dos|das|e|&)?\s*[A-ZÀ-Ý][a-zà-ÿ]+){0,4}(?:\s+et al\.)?)\s+\((\d{4}[a-z]?(?:\/\d{4})?)[^)]*\)/g;
      while ((m = narr.exec(t))) {
        const nome = m[1].replace(/\s+et al\.$/, '');
        const primeira = nome.split(/\s+/)[0];
        if (['Segundo', 'Para', 'Conforme', 'Como', 'Em', 'No', 'Na', 'De', 'Ao', 'Já', 'Desde'].includes(primeira) && nome.split(/\s+/).length > 1) {
          achadas.push({ sobrenome: norm(nome.split(/\s+/).slice(1).join(' ')), anos: m[2].match(/\d{4}/g), texto: m[0], bloco: b.id });
        } else {
          achadas.push({ sobrenome: norm(nome), anos: m[2].match(/\d{4}/g), texto: m[0], bloco: b.id });
        }
      }
    });
    return achadas;
  }

  function referencias(blocos) {
    return blocos.filter((b) => b.tipo === 'ref').map((b) => {
      const t = textoDe(b.runs);
      const entrada = norm(t.split(/[,.]/)[0]);
      const anos = (t.match(/\b(1[5-9]\d{2}|20\d{2})\b/g) || []);
      return { entrada, anos, texto: t, bloco: b.id };
    });
  }

  function casa(cit, ref) {
    const nomes = [cit.sobrenome, cit.sobrenome.split(' ').pop(), cit.sobrenome.split(/ E | & /)[0]];
    const bateNome = nomes.some((n) => n && (ref.entrada === n || ref.entrada.startsWith(n + ' ') || ref.entrada.startsWith(n) && n.length > 5));
    return bateNome && cit.anos.some((a) => ref.anos.includes(a));
  }

  function cruzar(blocos) {
    const cits = citacoes(blocos);
    const refs = referencias(blocos);
    const semRef = [];
    const vistas = new Set();
    cits.forEach((c) => {
      const r = refs.find((ref) => casa(c, ref));
      if (r) r.citada = true;
      else {
        const k = c.sobrenome + c.anos.join('/');
        if (!vistas.has(k)) { vistas.add(k); semRef.push(c); }
      }
    });
    return {
      totalCitacoes: cits.length,
      totalRefs: refs.length,
      semRef,
      naoCitadas: refs.filter((r) => !r.citada)
    };
  }

  /* ---------- sigilo ---------- */

  // sem flag i: o papel aceita maiúscula no começo, mas o nome tem que começar com maiúscula de verdade
  const PAPEIS = '(?:[Pp]aciente|[Cc]liente|[Pp]articipante|[Ee]ntrevistad[oa]|[Uu]su[aá]ri[oa]|[Aa]nalisand[oa]|[Ss]ujeito|[Cc]rian[cç]a|[Aa]dolescente|[Mm]enin[oa]|[Mm][aã]e|[Pp]ai|[Ee]sposa|[Mm]arido|[Ii]rm[aã]o?|[Aa]v[oó]|[Ss]enhora?|[Ss]ra?\\.)';
  const NOME = "([A-ZÀ-Ý][a-zà-ÿ]+(?:\\s+(?:d[aeo]s?\\s+)?[A-ZÀ-Ý][a-zà-ÿ]+){0,3})";
  const NAO_NOME = new Set(['A', 'O', 'Em', 'No', 'Na', 'Que', 'Com', 'Ao', 'Se', 'Ela', 'Ele', 'Durante', 'Após', 'Quando', 'Segundo', 'Para']);

  const REGRAS = [
    { tipo: 'nome', rotulo: 'Nome de pessoa atendida', re: new RegExp('\\b' + PAPEIS + '\\s+' + NOME, 'g') },
    { tipo: 'cpf', rotulo: 'CPF', re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g },
    { tipo: 'tel', rotulo: 'Telefone', re: /\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b/g },
    { tipo: 'email', rotulo: 'E-mail', re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
    { tipo: 'nasc', rotulo: 'Data de nascimento', re: /\bnascid[oa]\s+em\s+\d{1,2}\/\d{1,2}\/\d{2,4}/gi },
    { tipo: 'end', rotulo: 'Endereço', re: /\b(?:rua|av\.|avenida|travessa|alameda)\s+[A-ZÀ-Ý][^,.;]{2,40},?\s*(?:n[º°.]?\s*)?\d+/gi }
  ];

  function sigilo(blocos) {
    const achados = [];
    blocos.forEach((b) => {
      if (!['p', 'cit', 'li'].includes(b.tipo)) return;
      const t = textoDe(b.runs);
      REGRAS.forEach((r) => {
        r.re.lastIndex = 0;
        let m;
        while ((m = r.re.exec(t))) {
          let alvo = m[0];
          if (r.tipo === 'nome') {
            const nome = m[1];
            if (NAO_NOME.has(nome.split(/\s+/)[0])) continue;
            // nome que já é código (Paciente A, Participante P3) está ok
            if (/^[A-Z]\d?$|^P\d+$/.test(nome)) continue;
            alvo = nome;
          }
          const ini = Math.max(0, m.index - 40);
          achados.push({
            tipo: r.tipo, rotulo: r.rotulo, alvo, bloco: b.id,
            trecho: (ini ? '…' : '') + t.slice(ini, m.index + m[0].length + 40) + (m.index + m[0].length + 40 < t.length ? '…' : '')
          });
        }
      });
    });
    return achados;
  }

  // troca um dado pelo código: nomes viram A, B, C...; o resto vira [omitido]
  function anonimizar(blocos, achado, codigos) {
    let sub;
    if (achado.tipo === 'nome') {
      if (!codigos[achado.alvo]) codigos[achado.alvo] = String.fromCharCode(65 + Object.keys(codigos).length % 26);
      sub = codigos[achado.alvo];
    } else sub = '[omitido]';
    let trocou = 0;
    blocos.forEach((b) => {
      b.runs = b.runs.map((r) => {
        const n = r.t.split(achado.alvo).length - 1;
        trocou += n;
        return n ? { ...r, t: r.t.split(achado.alvo).join(sub) } : r;
      });
    });
    return { sub, trocou };
  }

  window.Conferir = { cruzar, sigilo, anonimizar };
})();
