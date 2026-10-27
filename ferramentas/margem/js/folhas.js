/* Diagrama o trabalho em folhas A4 de verdade (mm), quebrando parágrafo
   entre páginas, segurando título junto do texto e numerando como a NBR 14724:
   conta desde a folha de rosto, mostra a partir da primeira folha textual. */

(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function fichas(runs) {
    const out = [];
    runs.forEach((r) => {
      r.t.split(/(\s+)/).forEach((pedaco) => {
        if (!pedaco) return;
        if (/^\s+$/.test(pedaco) && out.length) out[out.length - 1].t += pedaco;
        else out.push({ t: pedaco, b: r.b, i: r.i });
      });
    });
    return out;
  }

  function htmlRuns(toks) {
    let h = '', aberto = null;
    toks.forEach((k) => {
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

  function el(item, toks, cont) {
    const e = document.createElement(item.kind === 'titulo' || item.kind === 'secao' ? 'h3' : 'p');
    e.dataset.id = item.id;
    if (item.kind === 'titulo') {
      e.className = 't t' + item.nivel;
      e.innerHTML = `<span class="t__num">${item.num}</span> ${htmlRuns(toks)}`;
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

  function criarFolha(destino, numero, mostra, tipo) {
    const moldura = document.createElement('div');
    moldura.className = 'moldura';
    const f = document.createElement('article');
    f.className = 'folha folha--' + tipo;
    f.innerHTML =
      `<div class="folha__num">${mostra ? numero : ''}</div>` +
      '<div class="cotas" aria-hidden="true"><i class="c-top">3 cm</i><i class="c-esq">3 cm</i><i class="c-dir">2 cm</i><i class="c-base">2 cm</i></div>' +
      '<div class="folha__corpo"></div>';
    moldura.appendChild(f);
    destino.appendChild(moldura);
    return { folha: f, corpo: f.lastChild, numero };
  }

  const estoura = (corpo) => corpo.scrollHeight > corpo.clientHeight + 1;

  function render(destino, modelo, capa, op) {
    destino.innerHTML = '';
    let conta = 0;
    const paginaDe = {};
    const folhas = [];
    const nova = (tipo, mostra) => {
      const numero = tipo === 'capa' ? null : ++conta;
      const f = criarFolha(destino, numero, mostra, tipo);
      folhas.push(f);
      return f;
    };

    const autores = (capa.autores || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const titulo = (capa.titulo || '').trim() || 'Título do trabalho';
    const tituloHtml = `<span class="rb">${esc(titulo.toLocaleUpperCase('pt-BR'))}</span>` +
      (capa.subtitulo ? `: ${esc(capa.subtitulo)}` : '');
    const rodape = `<div class="cp__fim"><p>${esc(capa.cidade || 'Cidade')}</p><p>${esc(capa.ano || '')}</p></div>`;

    if (op.capa) {
      const f = nova('capa', false);
      f.corpo.classList.add('cp');
      f.corpo.innerHTML =
        `<div class="cp__topo"><p class="rb">${esc((capa.instituicao || 'Instituição').toLocaleUpperCase('pt-BR'))}</p>` +
        (capa.curso ? `<p>${esc(capa.curso.toLocaleUpperCase('pt-BR'))}</p>` : '') + '</div>' +
        `<div class="cp__autor">${autores.map((a) => `<p>${esc(a.toLocaleUpperCase('pt-BR'))}</p>`).join('') || '<p>NOME DO AUTOR</p>'}</div>` +
        `<div class="cp__titulo"><p>${tituloHtml}</p></div>` + rodape;
    }

    if (op.rosto) {
      const f = nova('rosto', false);
      f.corpo.classList.add('cp');
      f.corpo.innerHTML =
        `<div class="cp__autor cp__autor--topo">${autores.map((a) => `<p>${esc(a.toLocaleUpperCase('pt-BR'))}</p>`).join('') || '<p>NOME DO AUTOR</p>'}</div>` +
        `<div class="cp__titulo"><p>${tituloHtml}</p></div>` +
        `<div class="cp__natureza"><p>${esc(capa.natureza || 'Trabalho apresentado ao curso de ..., como requisito parcial para ...')}</p>` +
        (capa.orientador ? `<p class="cp__orient">Orientador(a): ${esc(capa.orientador)}</p>` : '') + '</div>' + rodape;
    }

    // fluxo: corre os itens enchendo folhas, quebrando parágrafo onde precisa
    function fluxo(itens, tipo, mostra) {
      let f = null;
      const garantir = () => { if (!f) f = nova(tipo, mostra); };
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        garantir();
        const quebra = it.kind === 'secao' || (it.kind === 'titulo' && it.nivel === 1 && op.novaPagina);
        if (quebra && f.corpo.childElementCount) f = nova(tipo, mostra);

        if (it.kind === 'titulo' || it.kind === 'secao') {
          let e = el(it, fichas(it.runs));
          f.corpo.appendChild(e);
          if (estoura(f.corpo) && f.corpo.childElementCount > 1) {
            e.remove(); f = nova(tipo, mostra); f.corpo.appendChild(e);
          }
          // título não fica sozinho no pé da página: precisa caber com duas linhas do que vem depois
          const prox = itens[i + 1];
          if (prox && prox.kind !== 'titulo' && prox.kind !== 'secao' && f.corpo.childElementCount > 1) {
            const amostra = el(prox, fichas(prox.runs).slice(0, 22));
            f.corpo.appendChild(amostra);
            const nao = estoura(f.corpo);
            amostra.remove();
            if (nao) { e.remove(); f = nova(tipo, mostra); f.corpo.appendChild(e); }
          }
          paginaDe[it.id] = f.numero;
          continue;
        }

        let toks = fichas(it.runs);
        let cont = false;
        while (toks.length) {
          const e = el(it, toks, cont);
          f.corpo.appendChild(e);
          if (!estoura(f.corpo)) break;
          e.remove();
          // maior pedaço que cabe na folha atual
          let lo = 0, hi = toks.length - 1;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            const t = el(it, toks.slice(0, mid), cont);
            f.corpo.appendChild(t);
            const ok = !estoura(f.corpo);
            t.remove();
            if (ok) lo = mid; else hi = mid - 1;
          }
          if (lo === 0) {
            if (!f.corpo.childElementCount) { f.corpo.appendChild(el(it, toks, cont)); break; }
            f = nova(tipo, mostra);
            continue;
          }
          const parte = el(it, toks.slice(0, lo), cont);
          parte.classList.add('partido');
          f.corpo.appendChild(parte);
          toks = toks.slice(lo);
          cont = true;
          f = nova(tipo, mostra);
        }
      }
    }

    // pré-textuais (resumo, agradecimentos): cada seção na sua folha, sem número à vista
    if (modelo.pre.length) fluxo(modelo.pre, 'pre', false);

    // sumário: entra com número provisório e é corrigido depois que o texto é paginado
    const linhasSumario = [];
    if (op.sumario && modelo.sumario.length) {
      let f = nova('sumario', false);
      const h = document.createElement('h3');
      h.className = 't ts';
      h.textContent = 'SUMÁRIO';
      f.corpo.appendChild(h);
      modelo.sumario.forEach((it) => {
        const l = document.createElement('div');
        l.className = 'sum sum--' + (it.kind === 'secao' ? 's' : it.nivel);
        l.innerHTML = (it.kind === 'titulo' ? `<span class="sum__num">${it.num}</span>` : '<span class="sum__num"></span>') +
          `<span class="sum__txt">${htmlRuns(fichas(it.runs))}</span><span class="sum__pts"></span><span class="sum__pg">00</span>`;
        f.corpo.appendChild(l);
        if (estoura(f.corpo)) { l.remove(); f = nova('sumario', false); f.corpo.appendChild(l); }
        linhasSumario.push({ l, id: it.id });
      });
    }

    fluxo(modelo.texto, 'texto', true);

    linhasSumario.forEach(({ l, id }) => { l.querySelector('.sum__pg').textContent = paginaDe[id] || ''; });

    return { folhas: folhas.length, paginaDe, ultima: conta };
  }

  window.Folhas = { render, fichas };
})();
