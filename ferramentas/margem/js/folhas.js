/* Diagrama o trabalho em folhas A4 de verdade (mm), quebrando parágrafo e tabela
   entre páginas, segurando título junto do texto e pondo cada nota no pé da folha
   onde ela é chamada.
   ABNT (NBR 14724): conta desde a folha de rosto, mostra a partir da primeira folha textual.
   APA 7: folha de rosto do estudante e número em todas as folhas. */

(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const caixaAlta = (s) => String(s).toLocaleUpperCase('pt-BR');
  // campo da capa que falta aparece marcado na folha, nunca como texto de mentira
  const ou = (v, rotulo, f = (x) => x) => (v && String(v).trim() ? esc(f(String(v).trim())) : `<span class="falta">${rotulo}</span>`);

  function fichas(runs) {
    const out = [];
    runs.forEach((r) => {
      if (r.nota) { out.push({ t: '', nota: r.nota, n: r.n }); return; }
      r.t.split(/(\s+)/).forEach((pedaco) => {
        if (!pedaco) return;
        const ult = out[out.length - 1];
        if (/^\s+$/.test(pedaco) && ult && !ult.nota) ult.t += pedaco;
        else out.push({ t: pedaco, b: r.b, i: r.i });
      });
    });
    return out;
  }

  function htmlRuns(toks) {
    let h = '', aberto = null;
    toks.forEach((k) => {
      if (k.nota) { h += `<sup class="nr">${k.n || '*'}</sup>`; return; }
      const f = (k.b ? 'b' : '') + (k.i ? 'i' : '');
      if (f !== aberto) {
        if (aberto) h += '</span>';
        if (f) h += `<span class="${f.split('').map((c) => 'r' + c).join(' ')}">`;
        aberto = f || null;
      }
      h += esc(k.t);
    });
    if (aberto) h += '</span>';
    return h;
  }

  const notasDe = (toks) => toks.filter((k) => k.nota);

  function el(item, toks, cont) {
    const e = document.createElement(item.kind === 'titulo' || item.kind === 'secao' ? 'h3' : 'p');
    e.dataset.id = item.id;
    if (item.kind === 'titulo') {
      e.className = 't t' + item.nivel;
      e.innerHTML = (item.num ? `<span class="t__num">${item.num}</span> ` : '') + htmlRuns(toks);
    } else if (item.kind === 'secao') {
      e.className = 't ts';
      e.innerHTML = htmlRuns(toks);
    } else {
      const classe = { p: 'par', cit: 'cit', li: 'li', ref: 'ref', chave: 'chave' }[item.kind] || 'par';
      e.className = classe + (item.pre ? ' pre' : '') + (cont ? ' cont' : '');
      e.innerHTML = htmlRuns(toks);
    }
    return e;
  }

  /* ---------- ilustrações ---------- */

  const PX_MM = 25.4 / 96;

  function tamanhoFigura(item, larguraMax) {
    const altMax = 150;
    if (!item.w || !item.h) return { w: larguraMax * 0.7, h: larguraMax * 0.7 * 0.75 };
    let w = Math.min(larguraMax, item.w * PX_MM);
    let h = w * item.h / item.w;
    if (h > altMax) { h = altMax; w = h * item.w / item.h; }
    return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
  }

  function legendaHtml(item, op, parte) {
    const sufixo = { continua: ' (continua)', continuacao: ' (continuação)', conclusao: ' (conclusão)' }[parte] || '';
    if (op.norma === 'apa') {
      return `<p class="ilu__num">${item.rotulo} ${item.num}${sufixo}</p><p class="ilu__tit">${ou(item.legenda, 'título da ' + item.rotulo.toLowerCase())}</p>`;
    }
    return `<p class="ilu__leg">${item.rotulo} ${item.num} – ${ou(item.legenda, 'título da ' + item.rotulo.toLowerCase())}${sufixo}</p>`;
  }

  function fonteHtml(item, op, ano) {
    if (op.norma === 'apa') return item.fonte ? `<p class="ilu__fonte"><i>Nota.</i> ${esc(item.fonte)}</p>` : '';
    // a NBR 14724 pede fonte sempre, mesmo quando é produção do próprio autor
    return `<p class="ilu__fonte">Fonte: ${item.fonte ? esc(item.fonte) : `elaborado pelo autor (${esc(ano || new Date().getFullYear())}).`}</p>`;
  }

  function elTabela(item, op, ano, cabecalho, linhas, parte) {
    const e = document.createElement('figure');
    e.className = 'ilu ilu--tabela';
    e.dataset.id = item.id;
    const quadro = item.rotulo === 'Quadro';
    const th = cabecalho.map((c) => `<th>${esc(c)}</th>`).join('');
    const tr = linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    e.innerHTML = legendaHtml(item, op, parte) +
      `<table class="tb${quadro ? ' tb--quadro' : ''}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>` +
      (parte === 'continua' || parte === 'continuacao' ? '' : fonteHtml(item, op, ano));
    return e;
  }

  function elFigura(item, op, ano, larguraMax) {
    const e = document.createElement('figure');
    e.className = 'ilu ilu--figura';
    e.dataset.id = item.id;
    const t = tamanhoFigura(item, larguraMax);
    e.innerHTML = legendaHtml(item, op) +
      `<img src="${item.src}" alt="${esc(item.legenda || item.rotulo + ' ' + item.num)}" style="width:${t.w}mm;height:${t.h}mm">` +
      fonteHtml(item, op, ano);
    return e;
  }

  /* ---------- folhas ---------- */

  function criarFolha(destino, numero, mostra, tipo) {
    const moldura = document.createElement('div');
    moldura.className = 'moldura';
    const f = document.createElement('article');
    f.className = 'folha folha--' + tipo;
    f.innerHTML =
      `<div class="folha__num">${mostra ? numero : ''}</div>` +
      '<div class="cotas" aria-hidden="true"><i class="c-top"></i><i class="c-esq"></i><i class="c-dir"></i><i class="c-base"></i></div>' +
      '<div class="folha__corpo"><div class="notas"></div></div>';
    moldura.appendChild(f);
    destino.appendChild(moldura);
    const corpo = f.lastChild;
    return { folha: f, corpo, notas: corpo.lastChild, numero };
  }

  const estoura = (f) => f.corpo.scrollHeight > f.corpo.clientHeight + 1;
  const vazia = (f) => f.corpo.childElementCount === 1;
  const por = (f, e) => f.corpo.insertBefore(e, f.notas);

  // põe o elemento e as notas que ele chama. Se couber, devolve como desfazer; se não, desfaz e devolve null
  function tentar(f, e, notas) {
    por(f, e);
    const ps = notas.map((k) => {
      const p = document.createElement('p');
      p.className = 'nota-rod';
      p.innerHTML = `<sup>${k.n}</sup> ${esc(k.nota)}`;
      f.notas.appendChild(p);
      return p;
    });
    const desfazer = () => { e.remove(); ps.forEach((p) => p.remove()); };
    if (!estoura(f)) return desfazer;
    desfazer();
    return null;
  }
  // coloca de qualquer jeito: na folha vazia, o que não cabe entra assim mesmo (e é cortado)
  function forcar(f, e, notas) {
    if (tentar(f, e, notas)) return;
    por(f, e);
    notas.forEach((k) => f.notas.insertAdjacentHTML('beforeend', `<p class="nota-rod"><sup>${k.n}</sup> ${esc(k.nota)}</p>`));
  }

  function render(destino, modelo, capa, op) {
    destino.innerHTML = '';
    const apa = op.norma === 'apa';
    destino.classList.toggle('apa', apa);
    const larguraTexto = apa ? 165.1 : 160;
    let conta = 0;
    const paginaDe = {};
    const folhas = [];
    const nova = (tipo, mostra) => {
      const numero = tipo === 'capa' ? null : ++conta;
      const f = criarFolha(destino, numero, apa ? true : mostra, tipo);
      folhas.push(f);
      return f;
    };

    const autores = (capa.autores || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const autoresHtml = (fn) => (autores.length ? autores.map((a) => `<p>${esc(fn(a))}</p>`).join('') : `<p>${ou('', 'autor(es)')}</p>`);
    const tituloHtml = (fn) => `<span class="rb">${ou(capa.titulo, 'título do trabalho', fn)}</span>` + (capa.subtitulo ? `: ${esc(capa.subtitulo)}` : '');

    // fluxo: corre os itens enchendo folhas, quebrando parágrafo e tabela onde precisa
    function fluxo(itens, tipo, mostra, inicio) {
      let f = inicio || null;
      const garantir = () => { if (!f) f = nova(tipo, mostra); };
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        garantir();
        const quebra = it.kind === 'secao' || (!apa && it.kind === 'titulo' && it.nivel === 1 && op.novaPagina);
        if (quebra && !vazia(f)) f = nova(tipo, mostra);

        if (it.kind === 'titulo' || it.kind === 'secao') {
          const toks = fichas(it.runs);
          const notas = notasDe(toks);
          const e = el(it, toks);
          let desfazer = tentar(f, e, notas);
          if (!desfazer && !vazia(f)) { f = nova(tipo, mostra); desfazer = tentar(f, e, notas); }
          if (!desfazer) forcar(f, e, notas);
          // título não fica sozinho no pé da página: precisa caber com duas linhas do que vem depois
          const prox = itens[i + 1];
          if (desfazer && prox && prox.runs && prox.kind !== 'titulo' && prox.kind !== 'secao' && f.corpo.childElementCount > 2) {
            const amostra = el(prox, fichas(prox.runs).filter((k) => !k.nota).slice(0, 22));
            por(f, amostra);
            const nao = estoura(f);
            amostra.remove();
            if (nao) {
              desfazer();
              f = nova(tipo, mostra);
              forcar(f, e, notas);
            }
          }
          paginaDe[it.id] = f.numero;
          continue;
        }

        if (it.kind === 'figura') {
          const e = elFigura(it, op, capa.ano, larguraTexto);
          if (!tentar(f, e, []) && !vazia(f)) f = nova(tipo, mostra);
          if (!e.isConnected) forcar(f, e, []);
          paginaDe[it.id] = f.numero;
          continue;
        }

        if (it.kind === 'tabela') {
          const [cab, ...corpo] = it.linhas && it.linhas.length ? it.linhas : [['']];
          let resto = corpo;
          let parte = 'unica';
          paginaDe[it.id] = null;
          while (true) {
            const ultima = parte === 'unica' ? 'unica' : 'conclusao';
            const e = elTabela(it, op, capa.ano, cab, resto, ultima);
            if (tentar(f, e, [])) { if (paginaDe[it.id] === null) paginaDe[it.id] = f.numero; break; }
            // maior número de linhas que cabe aqui, repetindo o cabeçalho
            let lo = 0, hi = resto.length - 1;
            while (lo < hi) {
              const mid = Math.ceil((lo + hi) / 2);
              const desfazer = tentar(f, elTabela(it, op, capa.ano, cab, resto.slice(0, mid), parte === 'unica' ? 'continua' : 'continuacao'), []);
              if (desfazer) { desfazer(); lo = mid; } else hi = mid - 1;
            }
            if (lo === 0) {
              if (vazia(f)) { por(f, e); if (paginaDe[it.id] === null) paginaDe[it.id] = f.numero; break; }
              f = nova(tipo, mostra);
              continue;
            }
            por(f, elTabela(it, op, capa.ano, cab, resto.slice(0, lo), parte === 'unica' ? 'continua' : 'continuacao'));
            if (paginaDe[it.id] === null) paginaDe[it.id] = f.numero;
            resto = resto.slice(lo);
            parte = 'continuacao';
            f = nova(tipo, mostra);
          }
          continue;
        }

        let toks = fichas(it.runs);
        let cont = false;
        while (toks.length) {
          const e = el(it, toks, cont);
          if (tentar(f, e, notasDe(toks))) break;
          // maior pedaço que cabe na folha atual, com as notas que ele chama
          let lo = 0, hi = toks.length - 1;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            const pedaco = toks.slice(0, mid);
            const desfazer = tentar(f, el(it, pedaco, cont), notasDe(pedaco));
            if (desfazer) { desfazer(); lo = mid; } else hi = mid - 1;
          }
          if (lo === 0) {
            if (vazia(f)) { forcar(f, el(it, toks, cont), notasDe(toks)); break; }
            f = nova(tipo, mostra);
            continue;
          }
          const pedaco = toks.slice(0, lo);
          const parte = el(it, pedaco, cont);
          parte.classList.add('partido');
          forcar(f, parte, notasDe(pedaco));
          toks = toks.slice(lo);
          cont = true;
          f = nova(tipo, mostra);
        }
      }
      return f;
    }

    // linhas tipo sumário: texto, pontilhado e página (preenchida depois do texto paginado)
    const linhasComPagina = [];
    function paginaDeLista(titulo, linhas, tipo) {
      let f = nova(tipo, false);
      const h = document.createElement('h3');
      h.className = 't ts';
      h.textContent = titulo;
      por(f, h);
      linhas.forEach(({ classe, num, html, id }) => {
        const l = document.createElement('div');
        l.className = 'sum ' + classe;
        l.innerHTML = `<span class="sum__num">${num || ''}</span><span class="sum__txt">${html}</span><span class="sum__pts"></span><span class="sum__pg">00</span>`;
        por(f, l);
        if (estoura(f)) { l.remove(); f = nova(tipo, false); por(f, l); }
        linhasComPagina.push({ l, id });
      });
    }

    if (apa) {
      /* ---------- APA 7: folha de rosto do estudante ---------- */
      const f = nova('rosto', true);
      f.corpo.classList.add('cp', 'cp--apa');
      f.corpo.insertAdjacentHTML('afterbegin',
        `<div class="apa__topo"><p class="rb">${ou(capa.titulo, 'título do trabalho')}${capa.subtitulo ? ': ' + esc(capa.subtitulo) : ''}</p></div>` +
        `<div class="apa__dados">${autoresHtml((a) => a)}` +
        `<p>${[capa.curso, capa.instituicao].filter(Boolean).map(esc).join(', ') || ou('', 'curso e instituição')}</p>` +
        `<p>${ou(capa.disciplina, 'disciplina')}</p>` +
        `<p>${ou(capa.orientador, 'professor(a)')}</p>` +
        `<p>${ou(capa.data, 'data de entrega')}</p></div>`);

      if (modelo.pre.length) fluxo(modelo.pre, 'pre', true);

      // o texto abre em folha nova com o título do trabalho em negrito, centralizado
      const ft = nova('texto', true);
      const h = document.createElement('h3');
      h.className = 't apa__titulo';
      h.innerHTML = `${ou(capa.titulo, 'título do trabalho')}${capa.subtitulo ? ': ' + esc(capa.subtitulo) : ''}`;
      por(ft, h);
      fluxo(modelo.texto, 'texto', true, ft);
      return { folhas: folhas.length, paginaDe, ultima: conta };
    }

    /* ---------- ABNT ---------- */

    const rodape = `<div class="cp__fim"><p>${ou(capa.cidade, 'cidade')}</p><p>${ou(capa.ano, 'ano')}</p></div>`;

    if (op.capa) {
      const f = nova('capa', false);
      f.corpo.classList.add('cp');
      f.corpo.insertAdjacentHTML('afterbegin',
        `<div class="cp__topo"><p class="rb">${ou(capa.instituicao, 'instituição', caixaAlta)}</p>` +
        (capa.curso ? `<p>${esc(caixaAlta(capa.curso))}</p>` : '') + '</div>' +
        `<div class="cp__autor">${autoresHtml(caixaAlta)}</div>` +
        `<div class="cp__titulo"><p>${tituloHtml(caixaAlta)}</p></div>` + rodape);
    }

    const natureza = `<p>${ou(capa.natureza, 'natureza do trabalho (ex.: Trabalho de Conclusão de Curso apresentado ao…)')}</p>`;

    if (op.rosto) {
      const f = nova('rosto', false);
      f.corpo.classList.add('cp');
      f.corpo.insertAdjacentHTML('afterbegin',
        `<div class="cp__autor cp__autor--topo">${autoresHtml(caixaAlta)}</div>` +
        `<div class="cp__titulo"><p>${tituloHtml(caixaAlta)}</p></div>` +
        `<div class="cp__natureza">${natureza}` +
        (capa.orientador ? `<p class="cp__orient">Orientador(a): ${esc(capa.orientador)}</p>` : '') + '</div>' + rodape);
    }

    if (op.aprovacao) {
      const f = nova('aprovacao', false);
      f.corpo.classList.add('cp');
      const banca = (capa.banca || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const membros = banca.length ? banca : [capa.orientador ? capa.orientador + ' (orientador)' : '', '', ''];
      f.corpo.insertAdjacentHTML('afterbegin',
        `<div class="cp__autor cp__autor--topo">${autoresHtml(caixaAlta)}</div>` +
        `<div class="ap__titulo"><p>${tituloHtml(caixaAlta)}</p></div>` +
        `<div class="cp__natureza cp__natureza--ap">${natureza}</div>` +
        '<p class="ap__data">Aprovado em: ____ de ______________ de ______.</p>' +
        '<p class="ap__banca">BANCA EXAMINADORA</p>' +
        `<div class="ap__membros">${membros.map((m) => {
          const [nome, inst] = m.split(/\s+[–—-]\s+/);
          return `<div class="ap__membro"><span class="ap__linha"></span><p>${nome ? esc(nome) : '&nbsp;'}</p>${inst ? `<p>${esc(inst)}</p>` : ''}</div>`;
        }).join('')}</div>`);
    }

    if (capa.dedicatoria && capa.dedicatoria.trim()) {
      const f = nova('dedicatoria', false);
      f.corpo.classList.add('cp', 'cp--pe');
      f.corpo.insertAdjacentHTML('afterbegin', `<div class="ded">${capa.dedicatoria.trim().split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}</div>`);
    }

    // agradecimentos (e dedicatória/epígrafe que vieram no texto): cada seção na sua folha
    if (modelo.agrad.length) fluxo(modelo.agrad, 'pre', false);

    if (capa.epigrafe && capa.epigrafe.trim()) {
      const f = nova('epigrafe', false);
      f.corpo.classList.add('cp', 'cp--pe');
      f.corpo.insertAdjacentHTML('afterbegin',
        `<div class="ded ded--epi">${capa.epigrafe.trim().split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}` +
        (capa.epigrafeAutor ? `<p class="ded__autor">${esc(capa.epigrafeAutor)}</p>` : '') + '</div>');
    }

    if (modelo.resumo.length) fluxo(modelo.resumo, 'pre', false);

    modelo.listas.forEach((lista) => paginaDeLista(lista.titulo, lista.itens.map((it) => ({
      classe: 'sum--ilu', html: `${it.rotulo} ${it.num} – ${esc(it.legenda || '(sem título)')}`, id: it.id
    })), 'lista'));

    if (modelo.siglas.length) {
      let f = nova('lista', false);
      const h = document.createElement('h3');
      h.className = 't ts';
      h.textContent = 'LISTA DE ABREVIATURAS E SIGLAS';
      por(f, h);
      modelo.siglas.forEach((s) => {
        const l = document.createElement('div');
        l.className = 'sigla';
        l.innerHTML = `<span class="sigla__s">${esc(s.sigla)}</span><span>${esc(s.nome)}</span>`;
        por(f, l);
        if (estoura(f)) { l.remove(); f = nova('lista', false); por(f, l); }
      });
    }

    if (op.sumario && modelo.sumario.length) {
      paginaDeLista('SUMÁRIO', modelo.sumario.map((it) => ({
        classe: 'sum--' + (it.kind === 'secao' ? 's' : it.nivel), num: it.kind === 'titulo' ? it.num : '', html: htmlRuns(fichas(it.runs).filter((k) => !k.nota)), id: it.id
      })), 'sumario');
    }

    fluxo(modelo.texto, 'texto', true);

    linhasComPagina.forEach(({ l, id }) => { l.querySelector('.sum__pg').textContent = paginaDe[id] || ''; });

    return { folhas: folhas.length, paginaDe, ultima: conta };
  }

  window.Folhas = { render, fichas, tamanhoFigura };
})();
