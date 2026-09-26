/* A planta do showroom.

   Tudo aqui é desenhado a partir das medidas em dados.js: 1 metro = 100
   unidades do viewBox. O cômodo usa l/p do ambiente e cada móvel usa l/p da
   peça, então o desenho nunca discorda da ficha técnica — mudou a medida no
   catálogo, mudou o desenho.

   O marcador não teleporta: ele desce até o corredor, anda por ele e entra
   pela porta, que é o que a ideia do site promete. */
(function () {
  'use strict';

  const M = 100;                 // 1 metro
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Onde cada ambiente fica na planta (canto superior esquerdo, em metros).
  // O tamanho vem de AMBIENTES.
  const POSICAO = {
    sala:       { x: 0.4, y: 0.4 },
    jantar:     { x: 7.4, y: 0.4 },
    escritorio: { x: 0.4, y: 7.4 },
    quarto:     { x: 4.8, y: 7.4 }
  };

  const CORREDOR = { x: 0.4, y: 5.8, l: 11.9, p: 1.2 };
  const ENTRADA  = { x: 0.7, y: 6.4 };

  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const n = document.createElementNS(svgNS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  const amb = (id) => AMBIENTES.find((a) => a.id === id);
  const caixa = (id) => {
    const a = amb(id), pos = POSICAO[id];
    return { x: pos.x, y: pos.y, l: a.l, p: a.p, cx: pos.x + a.l / 2, cy: pos.y + a.p / 2 };
  };

  /* ---------- móveis em planta ---------- */
  // Distribui as peças do ambiente encostadas nas paredes, que é como móvel
  // de verdade fica. Retorna posição em metros.
  function arranjo(idAmbiente) {
    const c = caixa(idAmbiente);
    const pecas = PECAS.filter((p) => p.ambiente === idAmbiente);
    const margem = 0.18;
    const saida = [];

    let topoX = c.x + margem;      // parede de cima
    let baseX = c.x + margem;      // parede de baixo
    let ladoY = c.y + margem;      // parede esquerda

    pecas.forEach((peca, i) => {
      const lado = i % 3;
      if (lado === 0 && topoX + peca.l < c.x + c.l - margem) {
        saida.push({ peca, x: topoX, y: c.y + margem, girado: false });
        topoX += peca.l + 0.25;
      } else if (lado === 1 && baseX + peca.l < c.x + c.l - margem) {
        saida.push({ peca, x: baseX, y: c.y + c.p - margem - peca.p, girado: false });
        baseX += peca.l + 0.25;
      } else if (ladoY + peca.l < c.y + c.p - margem) {
        // encostada na parede esquerda: gira 90°, então ocupa p x l
        saida.push({ peca, x: c.x + margem, y: ladoY, girado: true });
        ladoY += peca.l + 0.25;
      } else if (topoX + peca.l < c.x + c.l - margem) {
        saida.push({ peca, x: topoX, y: c.y + margem, girado: false });
        topoX += peca.l + 0.25;
      }
    });

    return saida;
  }

  function desenharMovel(grupo, item) {
    const { peca, x, y, girado } = item;
    const l = (girado ? peca.p : peca.l) * M;
    const p = (girado ? peca.l : peca.p) * M;

    const g = el('g', { class: 'movel', 'data-peca': peca.id });
    g.appendChild(el('rect', { x: x * M, y: y * M, width: l, height: p, rx: 3 }));

    // marca de encosto: a linha grossa indica as costas do móvel
    if (peca.forma === 'sofa' || peca.forma === 'chaise' || peca.forma === 'cama') {
      g.appendChild(el('line', {
        class: 'costas',
        x1: x * M, y1: y * M + 3, x2: x * M + l, y2: y * M + 3
      }));
    }
    grupo.appendChild(g);
  }

  /* ---------- planta ---------- */
  const alvo = document.getElementById('plantaSvg');
  if (!alvo) return;

  const svg = el('svg', {
    viewBox: '0 0 1300 1260',
    class: 'planta',
    role: 'group',
    'aria-label': 'Planta do showroom com quatro ambientes'
  });

  // papel quadriculado de 0,5 m
  const defs = el('defs');
  const pat = el('pattern', { id: 'grade', width: 50, height: 50, patternUnits: 'userSpaceOnUse' });
  pat.appendChild(el('path', { d: 'M50 0H0V50', fill: 'none', class: 'grade-linha' }));
  defs.appendChild(pat);

  // Luz do teto: quando você entra na sala, ela acende.
  const brilho = el('radialGradient', { id: 'luzTeto', cx: '50%', cy: '42%', r: '62%' });
  const p1 = el('stop', { offset: '0%' });  p1.setAttribute('stop-color', 'rgba(240,168,72,0.34)');
  const p2 = el('stop', { offset: '55%' }); p2.setAttribute('stop-color', 'rgba(240,168,72,0.12)');
  const p3 = el('stop', { offset: '100%' }); p3.setAttribute('stop-color', 'rgba(240,168,72,0)');
  brilho.appendChild(p1); brilho.appendChild(p2); brilho.appendChild(p3);
  defs.appendChild(brilho);
  svg.appendChild(defs);
  svg.appendChild(el('rect', { x: 0, y: 0, width: 1300, height: 1260, fill: 'url(#grade)' }));

  // corredor
  const gCorr = el('g', { class: 'corredor' });
  gCorr.appendChild(el('rect', {
    x: CORREDOR.x * M, y: CORREDOR.y * M,
    width: CORREDOR.l * M, height: CORREDOR.p * M
  }));
  svg.appendChild(gCorr);

  // entrada
  const gEnt = el('g', { class: 'entrada' });
  gEnt.appendChild(el('line', { x1: 40, y1: 580, x2: 40, y2: 700 }));
  gEnt.appendChild(el('text', { x: 62, y: 566, class: 'rotulo-peq' }));
  gEnt.lastChild.textContent = 'ENTRADA';
  svg.appendChild(gEnt);

  const salas = {};

  AMBIENTES.forEach((a) => {
    const c = caixa(a.id);
    const g = el('g', {
      class: 'sala',
      'data-ambiente': a.id,
      tabindex: '0',
      role: 'button',
      'aria-label': `${a.nome}, ${a.l} por ${a.p} metros`
    });

    g.style.setProperty('--sala-cor', a.cor);
    g.appendChild(el('rect', {
      class: 'piso',
      x: c.x * M, y: c.y * M, width: c.l * M, height: c.p * M
    }));

    g.appendChild(el('rect', {
      class: 'luz-sala',
      x: c.x * M, y: c.y * M, width: c.l * M, height: c.p * M,
      fill: 'url(#luzTeto)'
    }));

    const gm = el('g', { class: 'moveis' });
    arranjo(a.id).forEach((item) => desenharMovel(gm, item));
    g.appendChild(gm);

    g.appendChild(el('rect', {
      class: 'parede',
      x: c.x * M, y: c.y * M, width: c.l * M, height: c.p * M
    }));

    // O rótulo sobe para o terço de cima: no centro ele cobriria o marcador
    // de "onde você está", que fica no meio da sala.
    const texto = a.curto.toUpperCase();
    const larguraRot = Math.max(texto.length * 19 + 34, 190);
    const yRot = (c.y + c.p * 0.3) * M;
    g.appendChild(el('rect', {
      class: 'rotulo-fundo',
      x: c.cx * M - larguraRot / 2, y: yRot - 38,
      width: larguraRot, height: 70, rx: 8
    }));

    const t = el('text', { class: 'rotulo', x: c.cx * M, y: yRot - 10 });
    t.textContent = texto;
    g.appendChild(t);

    const medida = el('text', { class: 'rotulo-peq', x: c.cx * M, y: yRot + 22 });
    medida.textContent = `${String(a.l).replace('.', ',')} × ${String(a.p).replace('.', ',')} m`;
    g.appendChild(medida);

    g.addEventListener('click', () => entrar(a.id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrar(a.id); }
    });

    svg.appendChild(g);
    salas[a.id] = g;
  });

  // marcador "você está aqui"
  const gVoce = el('g', { class: 'voce' });
  gVoce.appendChild(el('circle', { class: 'voce-halo', r: 26, cx: 0, cy: 0 }));
  gVoce.appendChild(el('circle', { class: 'voce-ponto', r: 9, cx: 0, cy: 0 }));
  svg.appendChild(gVoce);

  alvo.appendChild(svg);

  /* ---------- caminhar ---------- */
  let atual = { x: ENTRADA.x, y: ENTRADA.y };
  let animando = null;

  function porMarcador(x, y) {
    gVoce.setAttribute('transform', `translate(${x * M} ${y * M})`);
  }
  porMarcador(atual.x, atual.y);

  // Caminho em L pelo corredor: desce até ele, anda na horizontal e sobe/desce
  // para dentro da sala. É isso que dá a sensação de percorrer a loja.
  function rota(de, para) {
    const yCorr = CORREDOR.y + CORREDOR.p / 2;
    return [
      { x: de.x, y: de.y },
      { x: de.x, y: yCorr },
      { x: para.x, y: yCorr },
      { x: para.x, y: para.y }
    ];
  }

  function andar(destino, aoChegar) {
    if (animando) cancelAnimationFrame(animando);
    if (reduzido) { atual = destino; porMarcador(destino.x, destino.y); aoChegar && aoChegar(); return; }

    const pontos = rota(atual, destino);
    const trechos = [];
    let total = 0;
    for (let i = 0; i < pontos.length - 1; i++) {
      const d = Math.hypot(pontos[i + 1].x - pontos[i].x, pontos[i + 1].y - pontos[i].y);
      trechos.push(d);
      total += d;
    }
    if (total < 0.01) { aoChegar && aoChegar(); return; }

    const duracao = Math.min(1500, 380 + total * 95);
    const inicio = performance.now();

    function passo(agora) {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let restante = suave * total;
      let i = 0;
      while (i < trechos.length && restante > trechos[i]) { restante -= trechos[i]; i++; }
      if (i >= trechos.length) { i = trechos.length - 1; restante = trechos[i]; }

      const f = trechos[i] ? restante / trechos[i] : 1;
      const x = pontos[i].x + (pontos[i + 1].x - pontos[i].x) * f;
      const y = pontos[i].y + (pontos[i + 1].y - pontos[i].y) * f;
      porMarcador(x, y);

      if (t < 1) animando = requestAnimationFrame(passo);
      else { atual = destino; animando = null; aoChegar && aoChegar(); }
    }
    animando = requestAnimationFrame(passo);
  }

  /* ---------- entrar num ambiente ---------- */
  let ambienteAtual = null;

  function entrar(id, semRolar) {
    const a = amb(id);
    if (!a) return;
    const c = caixa(id);

    Object.entries(salas).forEach(([k, g]) => g.classList.toggle('is-dentro', k === id));
    document.querySelectorAll('.mapa-nav a').forEach((link) => {
      link.classList.toggle('is-on', link.getAttribute('href') === '#' + id);
    });

    // a tinta do capítulo passa a valer na página inteira
    document.documentElement.style.setProperty('--cor', a.cor);

    const dica = document.getElementById('dicaPlanta');
    if (dica) dica.innerHTML = `Capítulo aberto: <strong>${a.nome.toLowerCase()}</strong> · página ${a.pagina}`;

    andar({ x: c.cx, y: c.cy }, () => {
      if (ambienteAtual !== id) {
        ambienteAtual = id;
        document.dispatchEvent(new CustomEvent('ambiente:mudou', { detail: { id } }));
      }
      if (!semRolar) {
        const sec = document.getElementById('ambiente');
        if (sec) sec.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'start' });
      }
    });

    if (history.replaceState) history.replaceState(null, '', '#' + id);
  }

  /* ---------- menu de ambientes ---------- */
  const nav = document.getElementById('mapaNav');
  if (nav) {
    AMBIENTES.forEach((a) => {
      const link = document.createElement('a');
      link.href = '#' + a.id;
      link.textContent = a.curto;
      link.addEventListener('click', (e) => { e.preventDefault(); entrar(a.id); fecharMenu(); });
      nav.appendChild(link);
    });
  }

  const hamb = document.getElementById('hamb');
  function fecharMenu() {
    if (!nav || !hamb) return;
    nav.classList.remove('is-open');
    hamb.setAttribute('aria-expanded', 'false');
  }
  if (hamb && nav) {
    hamb.addEventListener('click', () => {
      const aberto = nav.classList.toggle('is-open');
      hamb.setAttribute('aria-expanded', String(aberto));
    });
  }

  /* ---------- plantinha decorativa da seção "a loja" ---------- */
  const mini = document.getElementById('lojaPlantinha');
  if (mini) {
    const s = el('svg', { viewBox: '0 0 1300 1260', class: 'planta planta-mini' });
    s.appendChild(el('rect', { x: 0, y: 0, width: 1300, height: 1260, fill: 'url(#grade)' }));
    AMBIENTES.forEach((a) => {
      const c = caixa(a.id);
      s.appendChild(el('rect', { class: 'parede', x: c.x * M, y: c.y * M, width: c.l * M, height: c.p * M }));
      const gm = el('g', { class: 'moveis' });
      arranjo(a.id).forEach((item) => desenharMovel(gm, item));
      s.appendChild(gm);
    });
    s.appendChild(el('rect', {
      class: 'corredor-mini',
      x: CORREDOR.x * M, y: CORREDOR.y * M, width: CORREDOR.l * M, height: CORREDOR.p * M
    }));
    mini.appendChild(s);
  }

  // abre no ambiente da URL, se houver
  const daUrl = (location.hash || '').replace('#', '');
  if (amb(daUrl)) entrar(daUrl, true);

  window.PLANTA = { entrar, arranjo, caixa, M };
})();
