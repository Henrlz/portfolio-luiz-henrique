/* Conferências que a banca faz e o aluno esquece: citação sem referência, referência
   que ninguém citou, dado de paciente no texto, resumo fora da medida, citação direta
   sem página, referência fora do formato e ilustração sem título ou fonte.
   Cada achado pode trazer um conserto, aplicado por corrigir(). */

(function () {
  'use strict';

  const { textoDe, juntarRuns } = window.Ler;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const NAO_SOBRENOME = new Set(['IN', 'APUD', 'CF', 'P', 'V', 'N', 'ET', 'AL', 'IBIDEM', 'IDEM', 'OP', 'CIT', 'COMO', 'CITADO', 'EM']);
  const corte = (s, n = 110) => (s.length > n ? s.slice(0, n) + '…' : s);
  const TEXTO = ['p', 'cit', 'li'];

  /* ---------- citações x referências ---------- */

  function citacoes(blocos) {
    const achadas = [];
    blocos.forEach((b) => {
      if (!TEXTO.includes(b.tipo)) return;
      const t = textoDe(b.runs);

      // (SOBRENOME, 2010, p. 3) · (SILVA; SOUZA, 2012) · (FREUD, 1912/2010) · (Silva & Souza, 2012) na APA
      const par = /\(([^()]*\d{4}[^()]*)\)/g;
      let m;
      while ((m = par.exec(t))) {
        m[1].split(';').reduce((pend, seg) => {
          const s = seg.trim();
          const anos = s.match(/\b(1[5-9]\d{2}|20\d{2})[a-z]?\b/g);
          if (!anos) { pend.push(s); return pend; }
          const nome = (pend[0] || s).split(',')[0].replace(/\bet al\.?/i, '').replace(/\s*&.*$/, '').replace(/,?\s*como citado em.*$/i, '').trim();
          const sob = norm(nome).split(' ')[0];
          const ehNome = /^[A-ZÀ-Ý]/.test(nome) && (nome === nome.toUpperCase() || /^[A-ZÀ-Ý][a-zà-ÿ]+/.test(nome));
          if (sob && /^[A-Z]/.test(sob) && !NAO_SOBRENOME.has(sob) && ehNome) {
            achadas.push({ sobrenome: norm(nome), anos: anos.map((a) => a.slice(0, 4)), texto: '(' + m[1] + ')', bloco: b.id });
          }
          return [];
        }, []);
      }

      // Silva (2010) · Freud (1912/2010) · Lima e Costa (2021) · Conselho Federal de Psicologia (2018)
      const narr = /((?:[A-ZÀ-Ý][a-zà-ÿ]+)(?:\s+(?:de|da|do|dos|das|e|&)?\s*[A-ZÀ-Ý][a-zà-ÿ]+){0,4}(?:\s+et al\.)?)\s+\((\d{4}[a-z]?(?:\/\d{4})?)[^)]*\)/g;
      while ((m = narr.exec(t))) {
        const nome = m[1].replace(/\s+et al\.$/, '');
        const palavras = nome.split(/\s+/);
        const conectivo = ['Segundo', 'Para', 'Conforme', 'Como', 'Em', 'No', 'Na', 'De', 'Ao', 'Já', 'Desde'].includes(palavras[0]);
        achadas.push({ sobrenome: norm(conectivo && palavras.length > 1 ? palavras.slice(1).join(' ') : nome), anos: m[2].match(/\d{4}/g), texto: m[0], bloco: b.id });
      }
    });
    return achadas;
  }

  function referencias(blocos) {
    return blocos.filter((b) => b.tipo === 'ref').map((b) => {
      const t = textoDe(b.runs);
      return { entrada: norm(t.split(/[,.(]/)[0]), anos: t.match(/\b(1[5-9]\d{2}|20\d{2})\b/g) || [], texto: t, bloco: b.id };
    });
  }

  function casa(cit, ref) {
    const nomes = [cit.sobrenome, cit.sobrenome.split(' ').pop(), cit.sobrenome.split(/ E | & /)[0]];
    const bateNome = nomes.some((n) => n && (ref.entrada === n || ref.entrada.startsWith(n + ' ') || (ref.entrada.startsWith(n) && n.length > 5)));
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
    return { totalCitacoes: cits.length, totalRefs: refs.length, semRef, naoCitadas: refs.filter((r) => !r.citada) };
  }

  /* ---------- sigilo ---------- */

  // sem flag i: o papel aceita maiúscula no começo, mas o nome tem que começar com maiúscula de verdade
  const PAPEIS = '(?:[Pp]aciente|[Cc]liente|[Pp]articipante|[Ee]ntrevistad[oa]|[Uu]su[aá]ri[oa]|[Aa]nalisand[oa]|[Ss]ujeito|[Cc]rian[cç]a|[Aa]dolescente|[Mm]enin[oa]|[Mm][aã]e|[Pp]ai|[Ee]sposa|[Mm]arido|[Ii]rm[aã]o?|[Aa]v[oó]|[Ss]enhora?|[Ss]ra?\\.)';
  const NOME = "([A-ZÀ-Ý][a-zà-ÿ]+(?:\\s+(?:d[aeo]s?\\s+)?[A-ZÀ-Ý][a-zà-ÿ]+){0,3})";
  const NAO_NOME = new Set(['A', 'O', 'Em', 'No', 'Na', 'Que', 'Com', 'Ao', 'Se', 'Ela', 'Ele', 'Durante', 'Após', 'Quando', 'Segundo', 'Para']);
  const PROFISSOES = '(?:enfermeir[oa]|professor[a]?|médic[oa]|advogad[oa]|engenheir[oa]|motorista|policial|vendedor[a]?|estudante|bancári[oa]|psicólog[oa]|dentista|pedreiro|cozinheir[oa]|diarista|empresári[oa]|militar|servidor[a]? públic[oa]|gerente|secretári[oa]|costureir[oa]|agricultor[a]?|cabeleireir[oa]|vereador[a]?|pastor[a]?|padre)';

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
      if (!TEXTO.includes(b.tipo)) return;
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

      // idade exata + profissão ou cidade na mesma frase: sozinhos não dizem nada, juntos apontam alguém
      t.split(/(?<=[.!?])\s+/).forEach((frase) => {
        const idade = /\b(\d{1,2}) anos\b/.exec(frase);
        if (!idade) return;
        const prof = new RegExp('\\b' + PROFISSOES + '\\b', 'i').exec(frase);
        const lugar = /\b(?:moradora?|residente|natural|que mora|vive|nascid[oa])\s+(?:de|em|no|na)\s+[A-ZÀ-Ý][a-zà-ÿ]+/.exec(frase) || /\bde\s+(?:[A-ZÀ-Ý][a-zà-ÿ]+\s?){1,3}(?=[,.;]|\s+que|\s+e\b)/.exec(frase.slice(idade.index));
        if (!prof && !lugar) return;
        achados.push({
          tipo: 'combo', rotulo: 'Combinação que identifica', alvo: idade[0], bloco: b.id,
          trecho: corte(frase, 200), detalhe: [idade[0], prof && prof[0], lugar && lugar[0].trim()].filter(Boolean).join(' + ')
        });
      });
    });
    return achados;
  }

  const faixa = (n) => (n < 12 ? 'na infância' : n < 18 ? 'na adolescência' : `na faixa dos ${Math.floor(n / 10) * 10} anos`);

  // troca um dado pelo código: nomes viram A, B, C...; idade exata vira faixa; o resto vira [omitido]
  function anonimizar(blocos, achado, codigos) {
    let sub;
    let alvo = achado.alvo;
    if (achado.tipo === 'nome') {
      if (!codigos[achado.alvo]) codigos[achado.alvo] = String.fromCharCode(65 + Object.keys(codigos).length % 26);
      sub = codigos[achado.alvo];
    } else if (achado.tipo === 'combo') {
      // "enfermeira de 34 anos" → "enfermeira na faixa dos 30 anos"
      const n = parseInt(achado.alvo, 10);
      alvo = new RegExp('\\s*(?:\\b(?:de|com)\\s+)?\\b' + n + ' anos\\b');
      sub = ' ' + faixa(n);
    } else sub = '[omitido]';
    let trocou = 0;
    blocos.forEach((b) => {
      if (achado.tipo === 'combo' && b.id !== achado.bloco) return;
      b.runs = b.runs.map((r) => {
        if (r.nota) return r;
        if (alvo instanceof RegExp) {
          if (!alvo.test(r.t)) return r;
          trocou++;
          return { ...r, t: r.t.replace(alvo, sub).replace(/\s{2,}/g, ' ') };
        }
        const n = r.t.split(alvo).length - 1;
        trocou += n;
        return n ? { ...r, t: r.t.split(alvo).join(sub) } : r;
      });
    });
    return { sub: sub.trim(), trocou };
  }

  /* ---------- resumo e palavras-chave (NBR 6028:2021) ---------- */

  function resumo(blocos, norma) {
    const achados = [];
    for (let i = 0; i < blocos.length; i++) {
      const s = blocos[i];
      if (s.tipo !== 'secao' || s.papel !== 'resumo') continue;
      const nome = textoDe(s.runs).trim();
      const ps = [], chaves = [];
      for (let j = i + 1; j < blocos.length && !['secao', 'titulo'].includes(blocos[j].tipo); j++) {
        if (blocos[j].tipo === 'p') ps.push(blocos[j]);
        if (blocos[j].tipo === 'chave') chaves.push(blocos[j]);
      }
      const palavras = ps.reduce((n, b) => n + (textoDe(b.runs).match(/\S+/g) || []).length, 0);
      const [min, max] = norma === 'apa' ? [0, 250] : [150, 500];
      if (palavras && (palavras < min || palavras > max)) {
        achados.push({ grupo: 'resumo', rotulo: nome, bloco: s.id, msg: norma === 'apa' ? `${palavras} palavras: a APA pede até 250.` : `${palavras} palavras: em trabalho acadêmico a NBR 6028 pede de 150 a 500.` });
      }
      if (ps.length > 1) {
        achados.push({ grupo: 'resumo', rotulo: nome, bloco: ps[0].id, msg: `Está em ${ps.length} parágrafos: o resumo é um parágrafo só.`, conserto: { acao: 'juntarResumo', ids: ps.map((b) => b.id), rotulo: 'juntar em um' } });
      }
      if (!chaves.length && ps.length) {
        achados.push({ grupo: 'resumo', rotulo: nome, bloco: s.id, msg: 'Faltam as palavras-chave logo abaixo do resumo.' });
      }
      chaves.forEach((c) => {
        const t = textoDe(c.runs);
        const corpo = t.replace(/^[^:]+:\s*/, '');
        const itens = corpo.replace(/\.$/, '').split(/\s*[;,]\s*|\.\s+/).filter(Boolean);
        const separador = /;/.test(corpo) && !/,/.test(corpo) && !/\.\s+\S/.test(corpo);
        const ponto = /\.$/.test(corpo.trim());
        if (!separador || !ponto) {
          achados.push({ grupo: 'resumo', rotulo: 'Palavras-chave', bloco: c.id, msg: 'Separadas por ponto e vírgula e terminadas em ponto (NBR 6028).', conserto: { acao: 'chave', id: c.id, rotulo: 'corrigir' } });
        }
        if (itens.length < 3 || itens.length > 5) {
          achados.push({ grupo: 'resumo', rotulo: 'Palavras-chave', bloco: c.id, msg: `${itens.length} palavra${itens.length > 1 ? 's' : ''}-chave: o comum nos manuais é de 3 a 5.` });
        }
        const maiusculas = itens.filter((w, k) => /^[A-ZÀ-Ý][a-zà-ÿ]/.test(w) && k >= 0);
        if (norma !== 'apa' && maiusculas.length > 1) {
          achados.push({ grupo: 'resumo', rotulo: 'Palavras-chave', bloco: c.id, msg: `Começam com maiúscula (${maiusculas.slice(0, 3).join(', ')}): a NBR 6028 pede minúscula, menos em nome próprio.` });
        }
      });
    }
    return achados;
  }

  /* ---------- citações diretas ---------- */

  const CITACAO_PERTO = /\(([^()]*\b(?:1[5-9]\d{2}|20\d{2})[^()]*)\)/;
  function diretas(blocos, norma) {
    const achados = [];
    const limite = norma === 'apa' ? 40 : 0;   // APA: bloco a partir de 40 palavras
    blocos.forEach((b) => {
      if (b.tipo === 'p' || b.tipo === 'li') {
        const t = textoDe(b.runs);
        const re = /[“"]([^”"]{12,})[”"]/g;
        let m;
        while ((m = re.exec(t))) {
          const dentro = m[1];
          const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 90);
          // autor citado antes da aspa só vale se estiver na mesma frase
          const antes = t.slice(Math.max(0, m.index - 160), m.index).split(/[.!?]\s+/).pop();
          const cit = CITACAO_PERTO.exec(depois) || /[A-ZÀ-Ý][a-zà-ÿ]+(?: et al\.)?\s+\(\d{4}[^)]*\)/.exec(antes);
          const trecho = corte('“' + dentro + '”', 120);
          const palavras = (dentro.match(/\S+/g) || []).length;
          const longa = norma === 'apa' ? palavras >= limite : dentro.length > 260;
          if (longa) {
            const inteiro = t.trim().replace(/[“"”]/g, '').replace(CITACAO_PERTO, '').replace(/[.\s]/g, '').length - dentro.replace(/[.\s]/g, '').length < 12;
            achados.push({
              grupo: 'diretas', rotulo: 'Citação longa entre aspas', bloco: b.id, trecho,
              msg: norma === 'apa' ? `Tem ${palavras} palavras: a partir de 40 vira citação em bloco, sem aspas.` : 'Passa de três linhas: vira citação longa (recuo de 4 cm, fonte menor, sem aspas).',
              conserto: inteiro ? { acao: 'paraCitacao', id: b.id, rotulo: 'transformar' } : null
            });
          }
          if (!cit) {
            achados.push({ grupo: 'diretas', rotulo: 'Citação direta sem autor e ano', bloco: b.id, trecho, msg: 'Toda citação direta precisa de autor, ano e página.' });
          } else if (!/\bp\.\s*\d|\bpp?\.\s*\d|\bp\.\s*[ivxlc]+|\bpar\.|\bfl\./i.test(cit[0] + depois.slice(0, 40))) {
            achados.push({ grupo: 'diretas', rotulo: 'Citação direta sem página', bloco: b.id, trecho, msg: 'Citação direta pede a página: (AUTOR, ano, p. 00).' });
          }
        }
      }
      if (b.tipo === 'cit') {
        const t = textoDe(b.runs);
        if (!CITACAO_PERTO.test(t.slice(-120))) {
          achados.push({ grupo: 'diretas', rotulo: 'Citação longa sem fonte', bloco: b.id, trecho: corte(t, 120), msg: 'Termina sem (AUTOR, ano, p.). Se o autor foi citado antes, confere se a página está lá.' });
        } else if (!/\bp\.\s*\d|\bpp\.\s*\d/.test(t.slice(-120))) {
          achados.push({ grupo: 'diretas', rotulo: 'Citação longa sem página', bloco: b.id, trecho: corte(t, 120), msg: 'Citação direta pede a página: (AUTOR, ano, p. 00).' });
        }
      }
    });
    return achados;
  }

  /* ---------- formato das referências ---------- */

  const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

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

  // onde está o título (o destaque) de uma referência ABNT sem negrito:
  // capítulo → o livro depois do "In: … (org.)."; artigo → a revista antes de "v."; livro → o título
  function trechoDestaque(t) {
    const inn = /\bIn:\s*/i.exec(t);
    if (inn) {
      // depois do "In:" vêm os autores do livro (com ou sem "(org.)") e então o título do livro
      const depois = t.slice(inn.index + inn[0].length);
      const org = /\(orgs?\.\)\.?\s*/i.exec(depois);
      const ini = org ? org.index + org[0].length : fimAutor(depois);
      if (ini <= 0) return null;
      const a = inn.index + inn[0].length + ini;
      const fim = t.slice(a).search(/[:.]\s|\.$/);
      return fim > 0 ? [a, a + fim] : null;
    }
    const rev = /,\s*(?:[A-ZÀ-Ý][^,]*,\s*)?v\.\s*\d/.exec(t);
    if (rev) {
      const antes = t.lastIndexOf('. ', rev.index);
      return antes > 0 ? [antes + 2, rev.index] : null;
    }
    const ini = fimAutor(t);
    if (ini <= 0 || ini >= t.length) return null;
    const fim = t.slice(ini).search(/[:.]\s|\.$/);
    return fim > 0 ? [ini, ini + fim] : null;
  }

  function formatoRefs(blocos, norma) {
    if (norma === 'apa') return [];
    const achados = [];
    blocos.forEach((b) => {
      if (b.tipo !== 'ref') return;
      const t = textoDe(b.runs);
      const autor = /^([^,.]+)[,.]/.exec(t);
      const base = { grupo: 'refs', bloco: b.id, trecho: corte(t, 100) };
      if (autor && autor[1] !== autor[1].toLocaleUpperCase('pt-BR') && !/^\[?S\.\s*l\./.test(t)) {
        achados.push({ ...base, rotulo: 'Autor sem caixa alta', msg: 'O sobrenome (ou a instituição) vai em maiúsculas: SILVA, Ana.', conserto: { acao: 'refAutor', id: b.id, rotulo: 'corrigir' } });
      }
      if (!/\b(1[5-9]\d{2}|20\d{2})\b|\[\d{2,3}-*\??\]/.test(t)) {
        achados.push({ ...base, rotulo: 'Sem ano', msg: 'Toda referência precisa do ano. Sem data, use uma aproximada entre colchetes, como [2020?].' });
      }
      if (/acess(?:o|ado)\s+em:?\s*\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(t) || /acessado em/i.test(t)) {
        achados.push({ ...base, rotulo: 'Data de acesso', msg: 'No formato da NBR 6023: Acesso em: 3 maio 2026.', conserto: { acao: 'refAcesso', id: b.id, rotulo: 'corrigir' } });
      }
      if (/<\s*https?:\/\/[^>]+>/.test(t)) {
        achados.push({ ...base, rotulo: 'Link entre < >', msg: 'A NBR 6023:2018 não usa mais os sinais < > em volta do link.', conserto: { acao: 'refLink', id: b.id, rotulo: 'corrigir' } });
      }
      if (!b.runs.some((r) => r.b) && trechoDestaque(t)) {
        const [a, z] = trechoDestaque(t);
        achados.push({ ...base, rotulo: 'Sem destaque', msg: `O título da obra (ou da revista) vai em negrito. Proposta: “${corte(t.slice(a, z), 60)}”.`, conserto: { acao: 'refNegrito', id: b.id, rotulo: 'pôr negrito' } });
      }
    });
    return achados;
  }

  /* ---------- ilustrações ---------- */

  function ilustracoes(blocos, norma) {
    const achados = [];
    blocos.forEach((b) => {
      if (b.tipo !== 'tabela' && b.tipo !== 'figura') return;
      const nome = `${b.rotulo || (b.tipo === 'tabela' ? 'Tabela' : 'Figura')}`;
      if (!b.legenda) achados.push({ grupo: 'ilu', rotulo: nome + ' sem título', bloco: b.id, msg: 'Toda ilustração e tabela tem título em cima. Escreve nas Marcações.' });
      if (!b.fonte && norma !== 'apa') achados.push({ grupo: 'ilu', rotulo: nome + ' sem fonte', bloco: b.id, msg: 'A fonte é obrigatória, mesmo quando é sua. Por enquanto sai “elaborado pelo autor (ano)”.' });
    });
    return achados;
  }

  /* ---------- consertos ---------- */

  function corrigir(blocos, conserto) {
    const b = blocos.find((x) => x.id === conserto.id || (conserto.ids && x.id === conserto.ids[0]));
    if (!b) return false;
    const t = textoDe(b.runs);
    switch (conserto.acao) {
      case 'juntarResumo': {
        const outros = conserto.ids.slice(1).map((id) => blocos.find((x) => x.id === id)).filter(Boolean);
        b.runs = juntarRuns(outros.reduce((acc, o) => acc.concat([{ t: ' ' }], o.runs), b.runs));
        outros.forEach((o) => blocos.splice(blocos.indexOf(o), 1));
        return true;
      }
      case 'chave': {
        const m = /^([^:]+:)\s*(.*)$/.exec(t);
        if (!m) return false;
        const itens = m[2].replace(/\.\s*$/, '').split(/\s*[;,]\s*|\.\s+/).filter(Boolean);
        b.runs = [{ t: m[1], b: true, i: false }, { t: ' ' + itens.join('; ') + '.', b: false, i: false }];
        return true;
      }
      case 'paraCitacao':
        b.tipo = 'cit';
        b.runs = [{ t: t.replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim(), b: false, i: false }];
        return true;
      case 'refAutor': {
        const m = /^([^,.]+)([,.])/.exec(t);
        if (!m) return false;
        b.runs = trocarTexto(b.runs, 0, m[1].length, m[1].toLocaleUpperCase('pt-BR'));
        return true;
      }
      case 'refAcesso':
        b.runs = b.runs.map((r) => (r.nota ? r : { ...r, t: r.t.replace(/acess(?:o|ado)\s+em:?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/gi, (m, d, mes, a) => `Acesso em: ${+d} ${MESES[+mes - 1] || mes} ${a.length === 2 ? '20' + a : a}`).replace(/acessado em:?/gi, 'Acesso em:') }));
        return true;
      case 'refLink':
        b.runs = b.runs.map((r) => (r.nota ? r : { ...r, t: r.t.replace(/<\s*(https?:\/\/[^>\s]+)\s*>/g, '$1') }));
        return true;
      case 'refNegrito': {
        const z = trechoDestaque(t);
        if (!z) return false;
        b.runs = juntarRuns([{ t: t.slice(0, z[0]) }, { t: t.slice(z[0], z[1]), b: true }, { t: t.slice(z[1]) }]);
        return true;
      }
      default: return false;
    }
  }

  // troca um intervalo do texto mantendo a formatação do resto
  function trocarTexto(runs, ini, fim, novo) {
    const out = [];
    let pos = 0;
    let posto = false;
    runs.forEach((r) => {
      if (r.nota) { out.push(r); return; }
      const a = pos, z = pos + r.t.length;
      pos = z;
      if (z <= ini || a >= fim) { out.push(r); return; }
      const antes = r.t.slice(0, Math.max(0, ini - a));
      const depois = r.t.slice(Math.max(0, fim - a));
      out.push({ ...r, t: antes + (posto ? '' : novo) + depois });
      posto = true;
    });
    return juntarRuns(out);
  }

  /* ---------- tudo junto ---------- */

  function tudo(blocos, norma) {
    const c = cruzar(blocos);
    const sig = sigilo(blocos);
    const outros = resumo(blocos, norma).concat(diretas(blocos, norma), formatoRefs(blocos, norma), ilustracoes(blocos, norma));
    return { cruz: c, sigilo: sig, outros, total: c.semRef.length + c.naoCitadas.length + sig.length + outros.length };
  }

  window.Conferir = { cruzar, sigilo, anonimizar, resumo, diretas, formatoRefs, ilustracoes, corrigir, tudo, trechoDestaque };
})();
