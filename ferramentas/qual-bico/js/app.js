/* Qual bico? — etanol x gasolina pelo consumo do carro, não pela regra dos 70%. */

(function () {
  'use strict';

  // Médias de referência (km/l). Servem de ponto de partida; o dono ajusta.
  // Gol: ficha do Gol Power 1.6 2005 em fichacompleta.com.br. Os outros são aproximados.
  const MODELOS = {
    'gol-g3':  { nome: 'Gol G3 1.6 Power 2005',     curto: 'Gol',    e: [7.1, 9.4],  g: [10.4, 13.7], tanque: 51,
                 fonte: 'Ficha técnica do Gol Power 1.6 2005 (Ficha Completa). Já mediu o seu? Muda aí em cima.' },
    'uno':     { nome: 'Uno Mille Fire Flex 1.0',   curto: 'Uno',    e: [8.4, 10.6], g: [12.0, 15.0], tanque: 48 },
    'celta':   { nome: 'Celta 1.0 VHC-E',           curto: 'Celta',  e: [8.0, 10.4], g: [11.4, 14.8], tanque: 54 },
    'strada':  { nome: 'Strada 1.4 Fire',           curto: 'Strada', e: [7.6, 8.9],  g: [10.6, 12.6], tanque: 58 },
    'hb20':    { nome: 'HB20 1.0 2016',             curto: 'HB20',   e: [8.6, 9.9],  g: [12.4, 14.3], tanque: 50 },
    'onix':    { nome: 'Onix 1.0 2020',             curto: 'Onix',   e: [9.4, 10.9], g: [13.3, 15.5], tanque: 44 },
    'meu':     { nome: 'Meu carro (números meus)',  curto: 'carro' }
  };

  const CHAVE = 'qualbico:v1';
  const $ = (id) => document.getElementById(id);

  const estado = Object.assign({
    precoE: 4.199,
    precoG: 6.299,
    modelo: 'gol-g3',
    e: MODELOS['gol-g3'].e.slice(),
    g: MODELOS['gol-g3'].g.slice(),
    tanque: 51,
    trajeto: 'cidade',
    nivel: 20,
    bico: null,          // null = segue o veredito
    valor: null          // último valor abastecido
  }, ler());

  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; }
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* sem storage, segue */ }
  }

  /* ---------- números ---------- */

  const num = (s) => {
    const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  };
  const brl = (v, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const km = (v) => Math.round(v).toLocaleString('pt-BR');

  // "629" -> 6,29 · "6299" -> 6,299 · "6,29" -> 6,29
  function lerPreco(txt) {
    const limpo = String(txt).trim();
    if (/^\d{3,4}$/.test(limpo)) return Number(limpo[0] + '.' + limpo.slice(1));
    return num(limpo);
  }

  function oitavos(f) {
    const nomes = ['vazio', '1/8', '1/4', '3/8', 'meio tanque', '5/8', '3/4', '7/8', 'cheio'];
    return nomes[Math.max(0, Math.min(8, Math.round(f * 8)))];
  }

  /* ---------- a conta ---------- */

  function consumo(par) {
    const [cid, est] = par;
    if (estado.trajeto === 'cidade') return cid;
    if (estado.trajeto === 'estrada') return est;
    return (cid + est) / 2;
  }

  function conta() {
    const kE = consumo(estado.e), kG = consumo(estado.g);
    const pE = estado.precoE, pG = estado.precoG;
    const ok = kE > 0 && kG > 0 && pE > 0 && pG > 0;
    if (!ok) return null;
    const rkE = pE / kE, rkG = pG / kG;          // reais por km
    const corte = kE / kG;                        // até onde o etanol compensa
    const razao = pE / pG;
    const dif = Math.abs(rkE - rkG) / Math.max(rkE, rkG);
    const vence = rkE <= rkG ? 'etanol' : 'gasolina';
    return { kE, kG, pE, pG, rkE, rkG, corte, razao, dif, vence, empate: dif < 0.015 };
  }

  /* ---------- placa de preços ---------- */

  function pintarPreco(input, v) {
    const vis = input.parentElement.querySelector('.preco__vis');
    if (!(v > 0)) { vis.innerHTML = '<span class="preco__vazio">--,--</span>'; return; }
    const s = v.toFixed(3);                      // "6.299"
    const [i, d] = s.split('.');
    const milesimo = d[2] !== '0' ? `<sup>${d[2]}</sup>` : '';
    vis.innerHTML = `${i},${d.slice(0, 2)}${milesimo}`;
  }

  function ligarPreco(id, campo) {
    const input = $(id);
    input.value = brl(estado[campo], estado[campo].toFixed(3).endsWith('0') ? 2 : 3);
    pintarPreco(input, estado[campo]);
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const v = lerPreco(input.value);
      if (v > 0 && v < 20) {
        estado[campo] = v;
        pintarPreco(input, v);
        tudo();
      }
    });
    input.addEventListener('blur', () => {
      input.value = brl(estado[campo], estado[campo].toFixed(3).endsWith('0') ? 2 : 3);
    });
  }

  /* ---------- etiqueta do carro ---------- */

  const camposConsumo = [['eCid', 'e', 0], ['eEst', 'e', 1], ['gCid', 'g', 0], ['gEst', 'g', 1]];

  function preencherEtiqueta() {
    camposConsumo.forEach(([id, comb, i]) => { $(id).value = brl(estado[comb][i], 1); });
    $('tanque').value = estado.tanque;
    $('modelo').value = estado.modelo;
    document.querySelector(`input[name="trajeto"][value="${estado.trajeto}"]`).checked = true;
    $('notaModelo').textContent = estado.modelo === 'meu'
      ? 'Números seus. Ninguém conhece esse carro melhor.'
      : MODELOS[estado.modelo].fonte || 'Média aproximada pra esse modelo. Já mediu o seu? Muda aí em cima.';
  }

  function ligarEtiqueta() {
    const sel = $('modelo');
    Object.entries(MODELOS).forEach(([id, m]) => {
      const o = document.createElement('option');
      o.value = id; o.textContent = m.nome;
      sel.appendChild(o);
    });

    sel.addEventListener('change', () => {
      estado.modelo = sel.value;
      const m = MODELOS[sel.value];
      if (m.e) { estado.e = m.e.slice(); estado.g = m.g.slice(); estado.tanque = m.tanque; }
      preencherEtiqueta();
      tudo();
    });

    camposConsumo.forEach(([id, comb, i]) => {
      const el = $(id);
      el.addEventListener('input', () => {
        const v = num(el.value);
        if (!(v > 0 && v < 60)) return;
        estado[comb][i] = v;
        if (estado.modelo !== 'meu') { estado.modelo = 'meu'; $('modelo').value = 'meu'; }
        $('notaModelo').textContent = 'Números seus. Ninguém conhece esse carro melhor.';
        tudo();
      });
      el.addEventListener('blur', () => { el.value = brl(estado[comb][i], 1); });
    });

    $('tanque').addEventListener('input', (ev) => {
      const v = Math.round(num(ev.target.value));
      if (v >= 20 && v <= 99) { estado.tanque = v; tudo(); }
    });
    $('tanque').addEventListener('blur', (ev) => { ev.target.value = estado.tanque; });

    document.querySelectorAll('input[name="trajeto"]').forEach((r) => {
      r.addEventListener('change', () => { estado.trajeto = r.value; tudo(); });
    });
  }

  /* ---------- veredito ---------- */

  const ESC_MIN = 0.5, ESC_MAX = 0.9;
  const naEscala = (r) => Math.max(0, Math.min(100, (r - ESC_MIN) / (ESC_MAX - ESC_MIN) * 100));
  const pct = (r) => brl(r * 100, 1).replace(',0', '') + '%';

  function veredito(c) {
    const ch = $('vChamada');
    document.body.dataset.vence = c ? (c.empate ? 'empate' : c.vence) : '';
    if (!c) {
      ch.textContent = 'Falta número aí em cima.';
      $('vConta').textContent = $('vSetenta').textContent = $('vTanque').textContent = '';
      return;
    }

    const nome = MODELOS[estado.modelo].curto;
    const doCarro = estado.modelo === 'meu' ? 'no seu carro' : `no seu ${nome}`;

    ch.textContent = c.empate ? 'Dá na mesma.' : (c.vence === 'etanol' ? 'Vai de etanol.' : 'Vai de gasolina.');

    $('vConta').innerHTML =
      `Cada quilômetro sai <b class="t-e">R$ ${brl(c.rkE, 3)}</b> no etanol ` +
      `e <b class="t-g">R$ ${brl(c.rkG, 3)}</b> na gasolina.`;

    // régua
    $('zonaE').style.width = naEscala(c.corte) + '%';
    $('rCorte').style.left = naEscala(c.corte) + '%';
    $('rHoje').style.left = naEscala(c.razao) + '%';
    $('rCorteTxt').textContent = 'limite ' + pct(c.corte);
    $('rHojeTxt').textContent = 'hoje ' + pct(c.razao);
    document.querySelector('.regua').classList.toggle('regua--perto', Math.abs(naEscala(c.corte) - naEscala(c.razao)) < 14);

    const limite = c.pG * c.corte;
    const distancia70 = Math.abs(c.corte - 0.7) * 100;
    const sobre70 = distancia70 < 0.75
      ? 'A tal regra dos 70% até que acerta aqui.'
      : `A regra dos 70% erra por ${brl(distancia70, 1)} ponto${distancia70 >= 1.95 ? 's' : ''} ${doCarro}.`;
    $('vSetenta').innerHTML =
      `${doCarro[0].toUpperCase() + doCarro.slice(1)}, o etanol compensa enquanto custar até ` +
      `<b>${pct(c.corte)}</b> da gasolina, ou seja, até <b>R$ ${brl(limite, 2)}</b> com a gasolina a R$ ${brl(c.pG, 2)}. ` +
      `Hoje está em ${pct(c.razao)}. ${sobre70}`;

    if (c.empate) {
      $('vTanque').textContent = 'A diferença por km é tão pequena que o que decide é outra coisa: partida a frio, cheiro, costume.';
    } else {
      const k = c.vence === 'etanol' ? c.kE : c.kG;
      const kmTanque = estado.tanque * k;
      const economia = kmTanque * Math.abs(c.rkE - c.rkG);
      $('vTanque').innerHTML =
        `Num tanque cheio de ${c.vence} (${estado.tanque} L, uns ${km(kmTanque)} km), ` +
        `a diferença é de <b>R$ ${brl(economia)}</b>.`;
    }
  }

  /* ---------- tambores mecânicos ---------- */

  function montarTambores(el) {
    const int = +el.dataset.int, dec = +el.dataset.dec;
    const fita = '<span class="tambor__fita">' + [0,1,2,3,4,5,6,7,8,9,0].map((n) => `<i>${n}</i>`).join('') + '</span>';
    let html = '';
    for (let i = 0; i < int + dec; i++) {
      if (i === int) html += '<span class="virgula">,</span>';
      html += `<span class="tambor">${fita}</span>`;
    }
    el.innerHTML = html;
    el._fitas = Array.from(el.querySelectorAll('.tambor__fita'));
    el._tambores = Array.from(el.querySelectorAll('.tambor'));
    el._int = int; el._dec = dec;
  }

  // Conta como um hodômetro: o último gira solto, os outros só viram quando os de baixo passam do 9.
  function girar(el, v, solto) {
    const n = el._fitas.length;
    const passo = Math.pow(10, -el._dec);
    const x = solto ? v / passo : Math.round(v / passo);
    el._fitas.forEach((fita, idx) => {
      const k = n - 1 - idx;                       // casa, contando da direita
      const p = Math.pow(10, k);
      const q = x / p;
      let pos;
      if (k === 0) {
        pos = q % 10;
      } else {
        const resto = x % p;
        pos = Math.floor(q) % 10;
        if (resto > p - 1) pos += resto - (p - 1);
      }
      fita.style.transform = `translateY(${-pos * 10 / 11 * 100 / 10}%)`;
      // zeros à esquerda ficam apagados, como na bomba de verdade
      el._tambores[idx].classList.toggle('apagado', idx < el._int - 1 && x < p);
    });
  }

  /* ---------- marcador de combustível ---------- */

  const CX = 110, CY = 120, R = 80;

  function desenharMarcador() {
    const g = $('tracos');
    let s = '';
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI;
      const longo = i % 2 === 0;
      const r1 = R - (longo ? 14 : 8), r2 = R - 2;
      s += `<line x1="${CX + r1 * Math.cos(a)}" y1="${CY - r1 * Math.sin(a)}" x2="${CX + r2 * Math.cos(a)}" y2="${CY - r2 * Math.sin(a)}" class="${longo ? 'traco traco--longo' : 'traco'}"/>`;
    }
    g.innerHTML = s;
    const a = Math.PI - 0.12 * Math.PI;
    document.querySelector('.marcador__reserva')
      .setAttribute('d', `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${(CX + R * Math.cos(a)).toFixed(1)} ${(CY - R * Math.sin(a)).toFixed(1)}`);
  }

  function ponteiro(el, f) {
    el.style.transform = `rotate(${(Math.max(0, Math.min(1, f)) - 0.5) * 180}deg)`;
  }

  /* ---------- bomba ---------- */

  let bombeando = false;

  function bicoAtual(c) {
    if (estado.bico) return estado.bico;
    return c ? c.vence : 'etanol';
  }

  function pintarBicos(c) {
    const b = bicoAtual(c);
    document.querySelectorAll('.bico').forEach((el) => {
      const sim = el.dataset.comb === b;
      el.setAttribute('aria-checked', sim);
      el.classList.toggle('bico--fora', sim);
    });
    document.body.dataset.bico = b;
  }

  function simular(c, valor) {
    const comb = bicoAtual(c);
    const preco = comb === 'etanol' ? estado.precoE : estado.precoG;
    const kml = comb === 'etanol' ? c.kE : c.kG;
    const f0 = estado.nivel / 100;
    const cabe = (1 - f0) * estado.tanque;
    const pedido = valor / preco;
    const litros = Math.min(pedido, cabe);
    return { comb, preco, kml, f0, litros, desarmou: pedido > cabe + 0.0005, gasto: litros * preco, valor };
  }

  function leitura(c, s) {
    const outro = s.comb === 'etanol' ? 'gasolina' : 'etanol';
    const kmlOutro = outro === 'etanol' ? c.kE : c.kG;
    const precoOutro = outro === 'etanol' ? c.pE : c.pG;
    const rodaOutro = (s.gasto / precoOutro) * kmlOutro;
    const roda = s.litros * s.kml;
    const delta = roda - rodaOutro;
    const f1 = s.f0 + s.litros / estado.tanque;
    const onde = { cidade: 'na cidade', estrada: 'na estrada', misto: 'misturando cidade e estrada' }[estado.trajeto];

    let comparacao;
    if (Math.abs(delta) < 3) {
      comparacao = `No bico de ${outro}, o mesmo dinheiro rodaria praticamente igual.`;
    } else if (delta > 0) {
      comparacao = `No bico de ${outro}, o mesmo dinheiro rodaria ${km(rodaOutro)} km. <b>${km(delta)} km a menos.</b>`;
    } else {
      comparacao = `No bico de ${outro}, o mesmo dinheiro rodaria ${km(rodaOutro)} km. <b class="alerta">Tá pegando o bico mais caro: ${km(-delta)} km a mais do outro lado.</b>`;
    }

    const desarme = s.desarmou
      ? `<p class="leitura__desarme">O bico desarmou com <b>R$ ${brl(s.gasto)}</b>: tanque cheio. Os outros R$ ${brl(s.valor - s.gasto)} ficam com você.</p>`
      : '';

    $('leitura').innerHTML =
      `<p class="leitura__km"><span>≈ ${km(roda)}</span> km</p>
       <p class="leitura__onde">rodando ${onde}, com ${brl(s.litros, 2)} L de ${s.comb}</p>
       ${desarme}
       <dl class="leitura__dados">
         <div><dt>Ponteiro</dt><dd>de ${oitavos(s.f0)} pra ${oitavos(f1)}</dd></div>
         <div><dt>Cada R$ 10</dt><dd>${brl(10 / s.preco * s.kml, 0)} km</dd></div>
       </dl>
       <p class="leitura__outro">${comparacao}</p>`;
  }

  function parado(c) {
    ponteiro($('agulha'), estado.nivel / 100);
    ponteiro($('agulhaAntes'), estado.nivel / 100);
    $('agulhaAntes').classList.remove('agulha--vis');
    const preco = bicoAtual(c) === 'etanol' ? estado.precoE : estado.precoG;
    girar($('tPreco'), preco);

    if (!c || !estado.valor) {
      girar($('tTotal'), 0); girar($('tLitros'), 0);
      $('leitura').innerHTML = '<p class="leitura__vazio">Escolhe um valor na bomba.</p>';
      return;
    }
    const s = simular(c, estado.valor);
    girar($('tTotal'), s.gasto); girar($('tLitros'), s.litros);
    ponteiro($('agulha'), s.f0 + s.litros / estado.tanque);
    $('agulhaAntes').classList.add('agulha--vis');
    leitura(c, s);
  }

  function abastecer(valor) {
    const c = conta();
    if (!c || bombeando) return;
    estado.valor = valor;
    salvar();
    const s = simular(c, valor);
    girar($('tPreco'), s.preco);

    bombeando = true;
    document.body.classList.add('bombeando');
    $('leitura').innerHTML = '<p class="leitura__vazio leitura__vazio--rodando">Abastecendo…</p>';
    $('agulhaAntes').classList.add('agulha--vis');
    ponteiro($('agulhaAntes'), s.f0);

    // zera os tambores antes de começar, como a bomba faz ao tirar o bico
    girar($('tTotal'), 0); girar($('tLitros'), 0);
    ponteiro($('agulha'), s.f0);

    const dur = Math.max(1600, Math.min(4200, s.litros * 110));
    let t0 = null;

    setTimeout(() => {
      document.body.classList.add('tambor-solto');
      requestAnimationFrame(function quadro(t) {
        if (t0 === null) t0 = t;
        const p = Math.min(1, (t - t0) / dur);
        // arranca, corre e freia perto do valor, como a pré-determinação
        const e = p - Math.sin(2 * Math.PI * p) / (2 * Math.PI);
        const l = s.litros * e;
        girar($('tLitros'), l, true);
        girar($('tTotal'), l * s.preco, true);
        ponteiro($('agulha'), s.f0 + l / estado.tanque);
        if (p < 1) return requestAnimationFrame(quadro);

        document.body.classList.remove('tambor-solto', 'bombeando');
        girar($('tLitros'), s.litros); girar($('tTotal'), s.gasto);
        ponteiro($('agulha'), s.f0 + s.litros / estado.tanque);
        bombeando = false;
        leitura(c, s);
      });
    }, 420);
  }

  function ligarBomba() {
    ['tTotal', 'tLitros', 'tPreco'].forEach((id) => montarTambores($(id)));
    desenharMarcador();

    document.querySelectorAll('.tecla[data-valor]').forEach((b) => {
      b.addEventListener('click', () => {
        if (bombeando) return;
        document.querySelectorAll('.tecla').forEach((t) => t.classList.toggle('tecla--ativa', t === b));
        abastecer(+b.dataset.valor);
      });
    });

    const outro = $('outroValor');
    outro.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const v = Math.round(num(outro.value));
      if (!(v >= 5 && v <= 999) || bombeando) return;
      document.querySelectorAll('.tecla').forEach((t) => t.classList.toggle('tecla--ativa', t.classList.contains('tecla--outro')));
      abastecer(v);
      outro.blur();
    });

    document.querySelectorAll('.bico').forEach((b) => {
      b.addEventListener('click', () => {
        if (bombeando) return;
        const c = conta();
        estado.bico = b.dataset.comb === (c && c.vence) ? null : b.dataset.comb;
        tudo();
      });
    });

    const nivel = $('nivel');
    nivel.value = estado.nivel;
    nivel.addEventListener('input', () => {
      if (bombeando) { nivel.value = estado.nivel; return; }
      estado.nivel = +nivel.value;
      tudo();
    });
  }

  /* ---------- tudo junto ---------- */

  function tudo() {
    const c = conta();
    veredito(c);
    pintarBicos(c);
    if (!bombeando) parado(c);
    salvar();
  }

  $('rEscala').innerHTML = [50, 60, 70, 80, 90].map((n) => `<span>${n}%</span>`).join('');

  ligarPreco('precoE', 'precoE');
  ligarPreco('precoG', 'precoG');
  ligarEtiqueta();
  preencherEtiqueta();
  ligarBomba();
  tudo();
})();
