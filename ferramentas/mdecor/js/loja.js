/* Catálogo: peças do ambiente escolhido, filtro por cor e ficha com cotas.

   Cada peça aparece com a planta dela desenhada em escala ao lado da foto.
   Se a foto não carregar, o desenho assume o lugar — é gerado por código a
   partir das medidas, então nunca quebra. */
(function () {
  'use strict';

  const svgNS = 'http://www.w3.org/2000/svg';
  const grade = document.getElementById('pecas');
  const vazio = document.getElementById('vazio');
  const coresFiltro = document.getElementById('coresFiltro');
  const nomeEl = document.getElementById('ambienteNome');
  const descEl = document.getElementById('ambienteDesc');
  const medidaEl = document.getElementById('ambienteMedida');

  let ambienteAtual = null;
  let corAtual = null;

  const reais = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const metros = (n) => String(n.toFixed(2)).replace('.', ',') + ' m';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------- desenho da peça em planta, com cotas ---------- */
  function plantaDaPeca(peca, comCotas) {
    // Folga assimétrica: a cota da profundidade fica girada à direita e a da
    // largura embaixo, então esses dois lados precisam de mais espaço — sem
    // isso o número sai cortado pela borda do viewBox.
    const pad = comCotas ? 18 : 10;
    const folgaDir = comCotas ? 62 : 10;
    const folgaBaixo = comCotas ? 52 : 10;
    const esc100 = 100;
    const l = peca.l * esc100;
    const p = peca.p * esc100;
    const w = l + pad + folgaDir;
    const h = p + pad + folgaBaixo;

    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.setAttribute('class', 'peca-planta');
    s.setAttribute('aria-hidden', 'true');

    const add = (tag, attrs, texto) => {
      const n = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      if (texto != null) n.textContent = texto;
      s.appendChild(n);
      return n;
    };

    add('rect', { class: 'pp-corpo', x: pad, y: pad, width: l, height: p, rx: 3 });

    if (peca.forma === 'sofa' || peca.forma === 'chaise' || peca.forma === 'cama') {
      add('line', { class: 'pp-costas', x1: pad, y1: pad + 4, x2: pad + l, y2: pad + 4 });
    }
    if (peca.forma === 'mesa' || peca.forma === 'cadeira') {
      add('line', { class: 'pp-fina', x1: pad + 8, y1: pad + 8, x2: pad + l - 8, y2: pad + p - 8 });
      add('line', { class: 'pp-fina', x1: pad + l - 8, y1: pad + 8, x2: pad + 8, y2: pad + p - 8 });
    }

    if (comCotas) {
      // cota da largura, embaixo
      const yc = pad + p + 18;
      add('line', { class: 'pp-cota', x1: pad, y1: yc, x2: pad + l, y2: yc });
      add('line', { class: 'pp-cota', x1: pad, y1: yc - 5, x2: pad, y2: yc + 5 });
      add('line', { class: 'pp-cota', x1: pad + l, y1: yc - 5, x2: pad + l, y2: yc + 5 });
      add('text', { class: 'pp-num', x: pad + l / 2, y: yc - 7 }, metros(peca.l));

      // cota da profundidade, na direita
      const xc = pad + l + 20;
      add('line', { class: 'pp-cota', x1: xc, y1: pad, x2: xc, y2: pad + p });
      add('line', { class: 'pp-cota', x1: xc - 5, y1: pad, x2: xc + 5, y2: pad });
      add('line', { class: 'pp-cota', x1: xc - 5, y1: pad + p, x2: xc + 5, y2: pad + p });
      add('text', {
        class: 'pp-num', x: xc + 16, y: pad + p / 2,
        transform: `rotate(-90 ${xc + 16} ${pad + p / 2})`
      }, metros(peca.p));
    }
    return s;
  }

  /* ---------- card ---------- */
  function card(peca) {
    const art = document.createElement('article');
    art.className = 'peca';

    const midia = document.createElement('div');
    midia.className = 'peca-midia';

    const desenho = document.createElement('div');
    desenho.className = 'peca-desenho';
    desenho.appendChild(plantaDaPeca(peca, false));
    midia.appendChild(desenho);

    const img = document.createElement('img');
    img.src = peca.img;
    img.alt = peca.nome;
    img.loading = 'lazy';
    // Sem foto, o desenho técnico fica sozinho — e continua fazendo sentido.
    img.addEventListener('error', () => { img.remove(); midia.classList.add('so-desenho'); });
    midia.appendChild(img);

    if (peca.selo) {
      const selo = document.createElement('span');
      selo.className = 'selo';
      selo.textContent = peca.selo;
      midia.appendChild(selo);
    }
    art.appendChild(midia);

    const corpo = document.createElement('div');
    corpo.className = 'peca-corpo';
    corpo.innerHTML = `
      <h3>${esc(peca.nome)}</h3>
      <p class="peca-sub">${esc(peca.sub || '')}</p>
      <p class="peca-med">${metros(peca.l)} × ${metros(peca.p)} × ${metros(peca.a)} (a)</p>
      <p class="peca-preco">
        ${peca.de ? `<s>${reais(peca.de)}</s>` : ''}
        <strong>${reais(peca.preco)}</strong>
      </p>`;

    const cores = document.createElement('div');
    cores.className = 'peca-cores';
    peca.cores.forEach((c) => {
      const b = document.createElement('span');
      b.className = 'cor';
      b.style.background = c.hex;
      b.title = c.nome;
      cores.appendChild(b);
    });
    corpo.appendChild(cores);

    if (peca.estoque <= ESTOQUE_BAIXO) {
      const av = document.createElement('p');
      av.className = 'estoque-baixo';
      av.textContent = peca.estoque === 0
        ? 'Esgotado — encomenda sob medida'
        : `Últimas ${peca.estoque} peças`;
      corpo.appendChild(av);
    }

    const btn = document.createElement('button');
    btn.className = 'btn btn-linha';
    btn.type = 'button';
    btn.textContent = 'Ver ficha';
    btn.addEventListener('click', () => abrirFicha(peca));
    corpo.appendChild(btn);

    art.appendChild(corpo);
    return art;
  }

  /* ---------- ficha ---------- */
  const modal = document.getElementById('modal');
  const modalCorpo = document.getElementById('modalCorpo');
  const modalX = document.getElementById('modalX');
  let focoAnterior = null;

  function abrirFicha(peca) {
    focoAnterior = document.activeElement;
    const a = AMBIENTES.find((x) => x.id === peca.ambiente);

    modalCorpo.innerHTML = `
      <p class="cota-label">${esc(a ? a.nome : '')} · ficha técnica</p>
      <h3 id="mNome">${esc(peca.nome)}</h3>
      <p class="peca-sub">${esc(peca.sub || '')}</p>
      <div class="ficha-grade">
        <div class="ficha-desenho" id="fichaDesenho"></div>
        <div class="ficha-dados">
          <p class="linha">${esc(peca.desc)}</p>
          <dl class="med-lista">
            <div><dt>Largura</dt><dd>${metros(peca.l)}</dd></div>
            <div><dt>Profundidade</dt><dd>${metros(peca.p)}</dd></div>
            <div><dt>Altura</dt><dd>${metros(peca.a)}</dd></div>
            <div><dt>Ocupa no chão</dt><dd>${(peca.l * peca.p).toFixed(2).replace('.', ',')} m²</dd></div>
          </dl>
          <p class="cota-label">Cores</p>
          <div class="peca-cores" id="fichaCores"></div>
          <p class="peca-preco grande">
            ${peca.de ? `<s>${reais(peca.de)}</s>` : ''}
            <strong>${reais(peca.preco)}</strong>
          </p>
          ${peca.estoque <= ESTOQUE_BAIXO ? `<p class="estoque-baixo">Últimas ${peca.estoque} peças</p>` : ''}
          <a class="btn btn-solido" href="#visita" data-fechar>Agendar visita para ver</a>
        </div>
      </div>`;

    document.getElementById('fichaDesenho').appendChild(plantaDaPeca(peca, true));
    const cores = document.getElementById('fichaCores');
    peca.cores.forEach((c) => {
      const w = document.createElement('span');
      w.className = 'cor-nome';
      w.innerHTML = `<span class="cor" style="background:${esc(c.hex)}"></span>${esc(c.nome)}`;
      cores.appendChild(w);
    });

    modalCorpo.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharFicha));

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalX.focus();
  }

  function fecharFicha() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (focoAnterior) focoAnterior.focus();
  }

  modalX.addEventListener('click', fecharFicha);
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharFicha(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) fecharFicha();
  });

  /* ---------- render ---------- */
  function coresDoAmbiente(id) {
    const mapa = new Map();
    PECAS.filter((p) => p.ambiente === id).forEach((p) => {
      p.cores.forEach((c) => { if (!mapa.has(c.nome)) mapa.set(c.nome, c.hex); });
    });
    return [...mapa.entries()].map(([nome, hex]) => ({ nome, hex }));
  }

  function render() {
    if (!ambienteAtual) return;
    const a = AMBIENTES.find((x) => x.id === ambienteAtual);
    nomeEl.textContent = a.nome;
    descEl.textContent = a.desc;
    medidaEl.textContent = `${String(a.l).replace('.', ',')} × ${String(a.p).replace('.', ',')} m · ${(a.l * a.p).toFixed(1).replace('.', ',')} m²`;

    coresFiltro.innerHTML = '';
    coresDoAmbiente(ambienteAtual).forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cor cor-btn' + (corAtual === c.nome ? ' is-on' : '');
      b.style.background = c.hex;
      b.title = c.nome;
      b.setAttribute('aria-label', 'Filtrar por ' + c.nome);
      b.setAttribute('aria-pressed', String(corAtual === c.nome));
      b.addEventListener('click', () => {
        corAtual = corAtual === c.nome ? null : c.nome;
        render();
      });
      coresFiltro.appendChild(b);
    });

    const lista = PECAS
      .filter((p) => p.ambiente === ambienteAtual)
      .filter((p) => !corAtual || p.cores.some((c) => c.nome === corAtual));

    grade.innerHTML = '';
    lista.forEach((p) => grade.appendChild(card(p)));
    vazio.hidden = lista.length > 0;
  }

  const limpar = document.getElementById('limparCor');
  if (limpar) limpar.addEventListener('click', () => { corAtual = null; render(); });

  document.addEventListener('ambiente:mudou', (e) => {
    ambienteAtual = e.detail.id;
    corAtual = null;
    render();
  });

  /* ---------- depoimentos ---------- */
  const deposGrade = document.getElementById('deposGrade');
  if (deposGrade) {
    DEPOIMENTOS_PADRAO.forEach((d) => {
      const c = document.createElement('figure');
      c.className = 'depo';
      c.innerHTML = `
        <div class="depo-nota" aria-label="${d.nota} de 5">${'★'.repeat(d.nota)}${'☆'.repeat(5 - d.nota)}</div>
        <blockquote>${esc(d.texto)}</blockquote>
        <figcaption><strong>${esc(d.nome)}</strong><span>${esc(d.cidade)}</span></figcaption>`;
      deposGrade.appendChild(c);
    });
  }

  window.LOJA = { abrirFicha, plantaDaPeca };
})();
