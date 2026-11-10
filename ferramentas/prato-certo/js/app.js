/* Prato Certo — tela, estado e busca. As contas ficam em calculo.js,
   a base em alimentos.js, a internet em api.js e a foto da tabela em rotulo.js. */
(function () {
  'use strict';

  var CHAVE = 'pratocerto:v1';
  var REFEICOES = [
    { id: 'cafe',   nome: 'Café da manhã' },
    { id: 'almoco', nome: 'Almoço' },
    { id: 'lanche', nome: 'Lanche' },
    { id: 'jantar', nome: 'Jantar' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var n0 = function (n) { return Math.round(n).toLocaleString('pt-BR'); };
  var n1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR'); };

  /* macro que mais pesa nas calorias de um item: dá a cor do arco */
  function domina(i) {
    var p = i.prot * 4, c = i.carb * 4, g = i.gord * 9;
    return p >= c && p >= g ? 'prot' : (c >= g ? 'carb' : 'gord');
  }
  var COR = { prot: 'var(--prot)', carb: 'var(--carb)', gord: 'var(--gord)' };

  /* ---------------- estado e armazenamento ---------------- */
  var estado = { perfil: null, diario: {}, meus: [] };

  /* ---- cookies: só o perfil (cabe em ~300 bytes), como plano B do localStorage ---- */
  var COOKIE_PERFIL = 'pc_perfil', COOKIE_AVISO = 'pc_aviso';
  function caminhoCookie() { return location.pathname.replace(/[^/]*$/, '') || '/'; }
  function gravarCookie(nome, valor, dias) {
    try {
      document.cookie = nome + '=' + encodeURIComponent(valor) + '; max-age=' + Math.round(dias * 86400) +
        '; path=' + caminhoCookie() + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* cookies bloqueados */ }
  }
  function lerCookie(nome) {
    try {
      var partes = document.cookie ? document.cookie.split('; ') : [];
      for (var i = 0; i < partes.length; i++) {
        var k = partes[i].indexOf('=');
        if (partes[i].slice(0, k) === nome) return decodeURIComponent(partes[i].slice(k + 1));
      }
    } catch (e) { /* ignora */ }
    return null;
  }
  function apagarCookie(nome) {
    try { document.cookie = nome + '=; max-age=0; path=' + caminhoCookie() + '; SameSite=Lax'; } catch (e) { /* ok */ }
  }

  /* reconstrói o estado só com tipos e formatos esperados: serve para o que vem do
     localStorage, do cookie e de um arquivo de backup (que pode ter sido editado) */
  var DATA = /^\d{4}-\d{2}-\d{2}$/;
  var num = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  /* número dentro de uma faixa realista: um backup editado não pode trazer 999999 kcal */
  var faixa = function (v, max) { v = num(v); return v < 0 ? 0 : (v > max ? max : v); };
  var txt = function (v, max) { return String(v == null ? '' : v).slice(0, max || 80); };
  function limpoItem(i) {
    if (!i || typeof i !== 'object') return null;
    return { id: txt(i.id, 40) || Math.random().toString(36).slice(2), nome: txt(i.nome, 80), marca: txt(i.marca, 60),
      gramas: faixa(i.gramas, 5000), refeicao: REFEICOES.some(function (r) { return r.id === i.refeicao; }) ? i.refeicao : 'lanche',
      kcal: faixa(i.kcal, 20000), prot: faixa(i.prot, 2000), carb: faixa(i.carb, 2000), gord: faixa(i.gord, 2000), fibra: faixa(i.fibra, 1000) };
  }
  function limpoPerfil(p) {
    if (!p || typeof p !== 'object') return null;
    var q = { sexo: p.sexo === 'f' ? 'f' : 'm', idade: num(p.idade), peso: num(p.peso), altura: num(p.altura),
      atividade: Calculo.FATORES[p.atividade] ? p.atividade : 'leve',
      objetivo: Calculo.OBJETIVOS[p.objetivo] ? p.objetivo : 'manter',
      pesoAlvo: p.pesoAlvo == null || p.pesoAlvo === '' ? null : num(p.pesoAlvo) };
    return Calculo.validar(q) ? null : q;
  }
  function limparEstado(v) {
    var s = { perfil: null, diario: {}, meus: [] };
    if (!v || typeof v !== 'object') return s;
    s.perfil = limpoPerfil(v.perfil);
    if (v.diario && typeof v.diario === 'object') {
      Object.keys(v.diario).slice(0, 800).forEach(function (k) {
        if (!DATA.test(k) || !Array.isArray(v.diario[k])) return;
        var lista = v.diario[k].slice(0, 200).map(limpoItem).filter(Boolean);
        if (lista.length) s.diario[k] = lista;
      });
    }
    if (Array.isArray(v.meus)) {
      s.meus = v.meus.slice(0, 300).map(function (a) {
        if (!a || typeof a !== 'object') return null;
        return { id: txt(a.id, 40) || 'meu-' + Math.random().toString(36).slice(2), origem: 'meu', nome: txt(a.nome, 80), marca: '',
          kcal: faixa(a.kcal, 900), prot: faixa(a.prot, 100), carb: faixa(a.carb, 100), gord: faixa(a.gord, 100), fibra: faixa(a.fibra, 100),
          porcao: num(a.porcao) > 0 ? Math.min(num(a.porcao), 2000) : 100, unidade: txt(a.unidade, 40) || '100 g' };
      }).filter(function (a) { return a && a.nome && a.prot + a.carb + a.gord <= 100.5; });
    }
    return s;
  }

  function carregar() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE));
      if (v && typeof v === 'object') estado = limparEstado(v);
    } catch (e) { /* armazenamento bloqueado ou corrompido: começa vazio */ }
    /* localStorage vazio mas o cookie lembra o perfil (ex.: o navegador limpou o armazenamento) */
    if (!estado.perfil) {
      try {
        var p = limpoPerfil(JSON.parse(lerCookie(COOKIE_PERFIL)));
        if (p) estado.perfil = p;
      } catch (e) { /* cookie ausente ou inválido */ }
    }
  }
  var pediuPersistencia = false;
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* modo privado */ }
    if (estado.perfil) {
      var p = estado.perfil;
      gravarCookie(COOKIE_PERFIL, JSON.stringify({ sexo: p.sexo, idade: p.idade, peso: p.peso, altura: p.altura,
        atividade: p.atividade, objetivo: p.objetivo, pesoAlvo: p.pesoAlvo }), 400);
    }
    /* pede ao navegador para não apagar o armazenamento por falta de espaço */
    if (!pediuPersistencia && navigator.storage && navigator.storage.persist) {
      pediuPersistencia = true;
      navigator.storage.persist().catch(function () { /* ok */ });
    }
  }

  function chaveData(d) {
    var m = d.getMonth() + 1, dia = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dia < 10 ? '0' : '') + dia;
  }
  function deChave(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function somarDias(k, n) { var d = deChave(k); d.setDate(d.getDate() + n); return chaveData(d); }
  var HOJE = chaveData(new Date());
  var diaAtual = HOJE;
  function itensDo(k) { return estado.diario[k] || []; }

  /* ---------------- meta ---------------- */
  var metas = null;

  function preencherSelects() {
    var a = $('atividade'), o = $('objetivo'), r = $('addRefeicao');
    Object.keys(Calculo.FATORES).forEach(function (k) {
      var f = Calculo.FATORES[k];
      a.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(f.nome) + ' · ' + esc(f.dica) + '</option>');
    });
    Object.keys(Calculo.OBJETIVOS).forEach(function (k) {
      o.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(Calculo.OBJETIVOS[k].nome) + '</option>');
    });
    REFEICOES.forEach(function (x) {
      r.insertAdjacentHTML('beforeend', '<option value="' + x.id + '">' + x.nome + '</option>');
    });
    a.value = 'leve';
    o.value = 'manter';
  }

  function lerPerfil() {
    var alvo = $('pesoAlvo').value.trim();
    return {
      sexo: document.querySelector('input[name="sexo"]:checked').value,
      idade: parseFloat($('idade').value),
      peso: parseFloat($('peso').value.replace(',', '.')),
      altura: parseFloat($('altura').value),
      atividade: $('atividade').value,
      objetivo: $('objetivo').value,
      pesoAlvo: alvo ? parseFloat(alvo.replace(',', '.')) : null
    };
  }

  function preencherForm(p) {
    document.querySelector('input[name="sexo"][value="' + p.sexo + '"]').checked = true;
    $('idade').value = p.idade;
    $('peso').value = p.peso;
    $('altura').value = p.altura;
    $('atividade').value = p.atividade;
    $('objetivo').value = p.objetivo;
    $('pesoAlvo').value = p.pesoAlvo != null ? p.pesoAlvo : '';
  }

  function dataEm(dias) {
    var d = new Date(); d.setDate(d.getDate() + dias);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function mostrarMeta() {
    var m = metas, p = estado.perfil;
    var linhas = [
      ['Metabolismo basal', n0(m.tmb) + ' kcal'],
      ['Gasto diário estimado', n0(m.gasto) + ' kcal'],
      ['Fibra', 'pelo menos ' + n0(m.fibra) + ' g'],
      ['Água', 'cerca de ' + n1(m.agua) + ' L'],
      ['IMC', n1(m.imc)]
    ];
    if (Math.abs(m.kgSemana) >= 0.05) {
      linhas.unshift(['Ritmo', (m.kgSemana > 0 ? 'perde' : 'ganha') + ' ~' + n1(Math.abs(m.kgSemana)) + ' kg/semana']);
    }

    var aviso = '';
    if (m.limitada) {
      aviso = '<p class="nota nota--alerta">A meta ficou no piso de segurança (nunca abaixo do metabolismo basal nem de 1.200 kcal). Abaixo disso, só com acompanhamento profissional.</p>';
    }
    if (m.prazo && m.prazo.incoerente) {
      aviso += '<p class="nota nota--alerta">O peso alvo está na direção contrária do objetivo. Ajuste um dos dois.</p>';
    } else if (m.prazo) {
      aviso += '<p class="nota">Para ' + n1(m.prazo.kg) + ' kg nesse ritmo: cerca de <strong>' + m.prazo.semanas +
        ' semanas</strong> (' + m.prazo.dias + ' dias, por volta de ' + esc(dataEm(m.prazo.dias)) + ').</p>';
    }

    $('resultadoMeta').innerHTML =
      '<p class="meta-rot">sua meta por dia</p>' +
      '<p class="meta-num">' + n0(m.kcal) + '<small>kcal</small></p>' +
      '<div class="meta-macros">' +
        '<div style="--c:var(--prot)"><b>' + n0(m.prot) + ' g</b><span>proteína</span></div>' +
        '<div style="--c:var(--carb)"><b>' + n0(m.carb) + ' g</b><span>carbo</span></div>' +
        '<div style="--c:var(--gord)"><b>' + n0(m.gord) + ' g</b><span>gordura</span></div>' +
      '</div>' +
      '<dl class="meta-lista">' +
        linhas.map(function (l) { return '<div><dt>' + l[0] + '</dt><dd>' + l[1] + '</dd></div>'; }).join('') +
      '</dl>' + aviso +
      '<p class="nota nota--fina">Proteína ' + Calculo.OBJETIVOS[p.objetivo].prot + ' g/kg · gordura 25% das calorias · carboidrato: o resto.</p>';
    $('resultadoMeta').hidden = false;
  }

  $('formPerfil').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = lerPerfil();
    var erro = Calculo.validar(p);
    var caixa = $('erroPerfil');
    if (erro) { caixa.textContent = erro; caixa.hidden = false; return; }
    caixa.hidden = true;
    estado.perfil = p;
    salvar();
    aplicarPerfil(true);
  });

  function aplicarPerfil(rolar) {
    metas = Calculo.metas(estado.perfil);
    mostrarMeta();
    $('dia').hidden = false;
    $('semana').hidden = false;
    desenharMeus();
    desenharDia();
    if (rolar) $('dia').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- dia: navegação ---------------- */
  function textoDia(k) {
    if (k === HOJE) return 'hoje';
    if (k === somarDias(HOJE, -1)) return 'ontem';
    return deChave(k).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  $('diaAnt').addEventListener('click', function () { diaAtual = somarDias(diaAtual, -1); fecharAdd(); desenharDia(); });
  $('diaProx').addEventListener('click', function () {
    if (diaAtual < HOJE) { diaAtual = somarDias(diaAtual, 1); fecharAdd(); desenharDia(); }
  });
  $('diaHoje').addEventListener('click', function () { diaAtual = HOJE; fecharAdd(); desenharDia(); });

  /* ---------------- o prato ---------------- */
  var CX = 160;
  /* arco de circunferência de a0 a a1 (graus, a partir do topo, sentido horário) */
  function arco(r, a0, a1) {
    if (a1 - a0 >= 360) a1 = a0 + 359.99;
    var pt = function (a) { var t = (a - 90) * Math.PI / 180; return [CX + r * Math.cos(t), CX + r * Math.sin(t)]; };
    var s = pt(a0), e = pt(a1);
    return 'M' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2);
  }

  function ordenados(itens) {
    var ordem = {}; REFEICOES.forEach(function (r, i) { ordem[r.id] = i; });
    return itens.map(function (i, n) { return { i: i, n: n }; })
      .sort(function (a, b) { return (ordem[a.i.refeicao] - ordem[b.i.refeicao]) || (a.n - b.n); })
      .map(function (x) { return x.i; });
  }

  function aroFino(r, sw, atual, meta, classe) {
    var f = meta > 0 ? Math.min(atual / meta, 1) : 0;
    return '<circle class="p-trilho" cx="' + CX + '" cy="' + CX + '" r="' + r + '" stroke-width="' + sw + '"/>' +
      (f > 0.004 ? '<path class="p-arco p-aro--' + classe + '" d="' + arco(r, 0, f * 360) + '" stroke-width="' + sw + '" stroke-linecap="round"/>' : '');
  }

  function desenharPrato(itens, t) {
    var meta = metas.kcal;
    var resta = meta - t.kcal;
    var segs = '', ang = 0;
    ordenados(itens).forEach(function (i) {
      if (ang >= 359.9) return;
      var varre = Math.min((i.kcal / meta) * 360, 360 - ang);
      if (varre < 0.4) return;
      var folga = varre > 4 ? 0.9 : 0;
      segs += '<path class="p-seg p-seg--' + domina(i) + '" d="' + arco(140, ang + folga, ang + varre - folga) +
        '" stroke-width="20"><title>' + esc(i.nome) + ' · ' + n0(i.kcal) + ' kcal</title></path>';
      ang += varre;
    });
    var extra = '';
    if (t.kcal > meta * 1.02) {
      extra = '<path class="p-extra" d="' + arco(154, 0, Math.min((t.kcal - meta) / meta, 1) * 360) + '" stroke-width="4"/>';
    }
    var centro = resta >= 0
      ? '<text class="p-num" x="160" y="170" text-anchor="middle">' + n0(resta) + '</text><text class="p-rot" x="160" y="194" text-anchor="middle">kcal restantes</text>'
      : '<text class="p-num" x="160" y="170" text-anchor="middle" style="fill:var(--acima)">+' + n0(-resta) + '</text><text class="p-rot" x="160" y="194" text-anchor="middle">kcal acima da meta</text>';

    var svg =
      '<svg class="prato__svg" viewBox="0 0 320 320" role="img" aria-label="' + n0(t.kcal) + ' de ' + n0(meta) + ' calorias no prato do dia">' +
        '<circle class="p-trilho" cx="160" cy="160" r="140" stroke-width="20"/>' + segs + extra +
        aroFino(112, 7, t.prot, metas.prot, 'prot') +
        aroFino(99, 7, t.carb, metas.carb, 'carb') +
        aroFino(86, 7, t.gord, metas.gord, 'gord') +
        '<g transform="translate(0 4)">' + centro + '</g>' +
      '</svg>';

    function linha(nome, atual, alvo, cor) {
      var passou = alvo > 0 && atual > alvo * 1.05;
      return '<div class="nutri' + (passou ? ' nutri--passou' : '') + '" style="--c:' + cor + '"><span>' + nome + '</span><b>' +
        n0(atual) + ' / ' + n0(alvo) + ' g</b></div>';
    }
    $('rotulo').innerHTML = svg +
      '<div class="prato__lista">' +
        '<p class="prato__comido"><b>' + n0(t.kcal) + '</b> de ' + n0(meta) + ' kcal</p>' +
        linha('Proteína', t.prot, metas.prot, 'var(--prot)') +
        linha('Carboidrato', t.carb, metas.carb, 'var(--carb)') +
        linha('Gordura', t.gord, metas.gord, 'var(--gord)') +
        linha('Fibra', t.fibra, metas.fibra, 'var(--ok)') +
      '</div>';
  }

  /* ---------------- refeições ---------------- */
  function desenharRefeicoes(itens) {
    $('refeicoes').innerHTML = REFEICOES.map(function (r) {
      var lista = itens.filter(function (i) { return i.refeicao === r.id; });
      var soma = Calculo.somar(lista);
      var corpo = lista.length ? lista.map(function (i) {
        return '<li class="item" style="--c:' + COR[domina(i)] + '">' +
          '<div class="item__nome"><strong>' + esc(i.nome) + '</strong>' +
            '<small>' + n0(i.gramas) + ' g' + (i.marca ? ' · ' + esc(i.marca) : '') + '</small></div>' +
          '<div class="item__num"><b>' + n0(i.kcal) + ' kcal</b>' +
            '<small>P ' + n0(i.prot) + ' · C ' + n0(i.carb) + ' · G ' + n0(i.gord) + '</small></div>' +
          '<button type="button" class="item__x" data-id="' + esc(i.id) + '" aria-label="Remover ' + esc(i.nome) + '">×</button>' +
          '</li>';
      }).join('') : '<li class="vazio">nada por aqui</li>';
      return '<section class="refeicao"><header><h3>' + r.nome + '</h3><span>' + (lista.length ? n0(soma.kcal) + ' kcal' : '') + '</span></header><ul>' + corpo + '</ul></section>';
    }).join('');
  }

  $('refeicoes').addEventListener('click', function (e) {
    var b = e.target.closest('.item__x');
    if (!b) return;
    var id = b.getAttribute('data-id');
    estado.diario[diaAtual] = itensDo(diaAtual).filter(function (i) { return i.id !== id; });
    if (!estado.diario[diaAtual].length) delete estado.diario[diaAtual];
    salvar();
    desenharDia();
  });

  /* ---------------- sete pratos ---------------- */
  function desenharSemana() {
    var dias = [];
    for (var i = 6; i >= 0; i--) dias.push(somarDias(diaAtual, -i));
    var perto = 0, registrados = 0;

    $('grafico').innerHTML = dias.map(function (k) {
      var lista = itensDo(k), t = Calculo.somar(lista).kcal, tem = lista.length > 0;
      var f = Math.min(t / metas.kcal, 1);
      var cls = !tem ? '' : (t > metas.kcal * 1.1 ? 'mini--acima' : (t >= metas.kcal * 0.9 ? 'mini--meta' : 'mini--abaixo'));
      if (tem) { registrados++; if (t >= metas.kcal * 0.9 && t <= metas.kcal * 1.1) perto++; }
      var rot = deChave(k).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      var C = 22, R = 16;
      var p = function (a) { var r = (a - 90) * Math.PI / 180; return [C + R * Math.cos(r), C + R * Math.sin(r)]; };
      var arc = '';
      if (tem && f > 0.01) {
        var a1 = Math.min(f * 360, 359.9), s = p(0), e = p(a1);
        arc = '<path class="mini__arco" d="M' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + (a1 > 180 ? 1 : 0) + ' 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2) + '" stroke-width="6" stroke-linecap="round"/>';
      }
      return '<button type="button" class="mini ' + cls + (k === diaAtual ? ' mini--sel' : '') + '" data-dia="' + k + '" aria-label="' +
        deChave(k).toLocaleDateString('pt-BR') + ': ' + n0(t) + ' kcal">' +
        '<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="mini__trilho" cx="22" cy="22" r="16" stroke-width="6"/>' + arc + '</svg>' +
        '<span class="mini__dia">' + rot + '</span><span class="mini__kcal">' + (tem ? n0(t) : '·') + '</span></button>';
    }).join('');

    $('semanaNota').textContent = registrados
      ? perto + (perto === 1 ? ' dia' : ' dias') + ' perto da meta (±10%) nos ' + registrados + ' registrados. Toque num prato para abrir o dia.'
      : 'Registre o que come para ver seus sete pratos aqui.';
  }
  $('grafico').addEventListener('click', function (e) {
    var b = e.target.closest('.mini');
    if (!b) return;
    diaAtual = b.getAttribute('data-dia');
    fecharAdd();
    desenharDia();
  });

  function desenharDia() {
    if (!metas) return;
    $('diaTexto').textContent = textoDia(diaAtual);
    $('diaHoje').hidden = diaAtual === HOJE;
    $('diaProx').disabled = diaAtual >= HOJE;
    var itens = itensDo(diaAtual);
    desenharPrato(itens, Calculo.somar(itens));
    desenharRefeicoes(itens);
    desenharSemana();
  }

  /* ---------------- busca ---------------- */
  var buscaTimer = null, buscaCtl = null, ultimaBusca = '';
  var visiveis = [];

  function refeicaoPorHora() {
    var h = new Date().getHours();
    return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : 'jantar';
  }

  var ROTULO_ORIGEM = { off: 'produto', rede: 'rede · aprox.', meu: 'meu' };

  function desenharResultados(lista) {
    visiveis = lista;
    var html = lista.map(function (a, i) {
      return '<li><button type="button" class="res" data-i="' + i + '">' +
        '<span class="res__nome">' + esc(a.nome) + (a.marca ? ' <small>' + esc(a.marca) + '</small>' : '') + '</span>' +
        '<span class="res__num">' + n0(a.kcal) + ' kcal/100 g · P ' + n0(a.prot) + ' · C ' + n0(a.carb) + ' · G ' + n0(a.gord) +
        (ROTULO_ORIGEM[a.origem] ? ' <em class="sel sel--' + a.origem + '">' + ROTULO_ORIGEM[a.origem] + '</em>' : '') + '</span>' +
        '</button></li>';
    }).join('');
    html += '<li><button type="button" class="res res--manual" id="resManual">Não achou? Cadastrar (foto da tabela, código de barras ou digitar)</button></li>';
    $('resultados').innerHTML = html;
    $('resultados').hidden = false;
  }

  $('busca').addEventListener('input', function () {
    var q = this.value.trim();
    clearTimeout(buscaTimer);
    if (buscaCtl) buscaCtl.abort();
    if (q.length < 2) { $('resultados').hidden = true; $('buscaStatus').textContent = ''; return; }
    var locais = Alimentos.buscar(q, estado.meus);
    desenharResultados(locais);
    $('buscaStatus').textContent = 'Buscando produtos na internet…';
    buscaTimer = setTimeout(function () { buscarRemoto(q, locais); }, 400);
  });

  async function buscarRemoto(q, locais) {
    ultimaBusca = q;
    buscaCtl = new AbortController();
    var ctl = buscaCtl;
    try {
      var remotos = await Api.buscar(q, ctl.signal);
      if (ultimaBusca !== q) return;
      var todos = locais.concat(remotos);
      desenharResultados(todos);
      $('buscaStatus').textContent = remotos.length
        ? todos.length + ' resultados (' + remotos.length + ' da internet).'
        : (locais.length ? 'Nada de produto na internet para essa busca.' : 'Nada encontrado. Cadastre o alimento abaixo.');
    } catch (e) {
      if (ctl.signal.aborted && ultimaBusca !== q) return;
      $('buscaStatus').textContent = locais.length
        ? 'A base de produtos não respondeu agora; mostrando só a base local.'
        : 'Não consegui consultar a base de produtos agora. Tente de novo ou cadastre o alimento.';
    }
  }

  $('resultados').addEventListener('click', function (e) {
    if (e.target.closest('#resManual')) { abrirManual(); return; }
    var b = e.target.closest('.res[data-i]');
    if (b) abrirAdd(visiveis[+b.getAttribute('data-i')]);
  });

  /* ---------------- adicionar ao prato ---------------- */
  var escolhido = null;

  function abrirAdd(a) {
    escolhido = a;
    $('formManual').hidden = true;
    $('addNome').textContent = a.nome + (a.marca ? ' · ' + a.marca : '');
    $('addInfo').textContent = 'Porção típica: ' + a.unidade + (a.unidade.indexOf(' g)') === -1 && a.unidade !== '100 g' ? ' (' + n0(a.porcao) + ' g)' : '');
    $('addGramas').value = Math.round(a.porcao);
    $('addRefeicao').value = refeicaoPorHora();
    $('formAdicionar').hidden = false;
    $('resultados').hidden = true;
    atualizarConta();
    $('addGramas').focus();
    $('addGramas').select();
  }
  function fecharAdd() {
    escolhido = null;
    $('formAdicionar').hidden = true;
    $('formManual').hidden = true;
  }
  function atualizarConta() {
    if (!escolhido) return;
    var g = parseFloat($('addGramas').value);
    if (!(g > 0)) { $('addConta').textContent = ''; return; }
    var v = Calculo.porcao(escolhido, g);
    $('addConta').textContent = n0(v.kcal) + ' kcal · proteína ' + n1(v.prot) + ' g · carbo ' + n1(v.carb) + ' g · gordura ' + n1(v.gord) + ' g';
  }
  $('addGramas').addEventListener('input', atualizarConta);

  $('formAdicionar').addEventListener('submit', function (e) {
    e.preventDefault();
    var g = parseFloat($('addGramas').value);
    if (!escolhido || !(g > 0) || g > 5000) { $('addConta').textContent = 'Informe uma quantidade entre 1 e 5000 g.'; return; }
    var v = Calculo.porcao(escolhido, g);
    var item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: escolhido.nome, marca: escolhido.marca || '', gramas: g,
      refeicao: $('addRefeicao').value,
      kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, fibra: v.fibra
    };
    (estado.diario[diaAtual] = itensDo(diaAtual)).push(item);
    salvar();
    fecharAdd();
    $('busca').value = '';
    $('resultados').hidden = true;
    $('buscaStatus').textContent = 'No prato: ' + item.nome + ' (' + n0(item.kcal) + ' kcal).';
    desenharDia();
    $('busca').focus();
  });
  $('addCancelar').addEventListener('click', fecharAdd);

  /* ---------------- cadastro: foto, código de barras ou digitar ---------------- */
  var avisouInconsistencia = false;

  function status(msg, tipo) {
    var s = $('manStatus');
    s.textContent = msg;
    s.className = 'manual__status' + (tipo ? ' manual__status--' + tipo : '');
  }
  function aplicarBase() { $('manPorcaoBox').hidden = document.querySelector('input[name="manBase"]:checked').value !== 'porcao'; }
  document.querySelectorAll('input[name="manBase"]').forEach(function (r) { r.addEventListener('change', aplicarBase); });

  function abrirManual() {
    fecharAdd();
    $('manNome').value = $('busca').value.trim();
    ['manKcal', 'manProt', 'manCarb', 'manGord', 'manFibra', 'manPorcao', 'manCodigo'].forEach(function (id) { $(id).value = ''; });
    document.querySelector('input[name="manBase"][value="100"]').checked = true;
    aplicarBase();
    $('manSalvar').checked = true;
    $('erroManual').hidden = true;
    avisouInconsistencia = false;
    status('');
    $('formManual').hidden = false;
    $('resultados').hidden = true;
    $('manNome').focus();
  }
  $('manCancelar').addEventListener('click', fecharAdd);

  function preencherManual(r) {
    if (r.nome && !$('manNome').value.trim()) $('manNome').value = r.nome;
    document.querySelector('input[name="manBase"][value="' + r.base + '"]').checked = true;
    aplicarBase();
    if (r.porcaoG) $('manPorcao').value = r.porcaoG;
    [['manKcal', 'kcal'], ['manProt', 'prot'], ['manCarb', 'carb'], ['manGord', 'gord'], ['manFibra', 'fibra']].forEach(function (p) {
      if (r[p[1]] != null) $(p[0]).value = Math.round(r[p[1]] * 10) / 10;
    });
    avisouInconsistencia = false;
  }

  /* foto da tabela nutricional */
  $('manFoto').addEventListener('change', async function () {
    var arq = this.files && this.files[0];
    if (!arq) return;
    var campo = this;
    status('Preparando a imagem…');
    try {
      var texto = await Rotulo.ler(arq, function (m) {
        if (m.status === 'recognizing text') status('Lendo a tabela… ' + Math.round(m.progress * 100) + '%');
        else status('Baixando o leitor de texto (só na primeira vez)…');
      });
      var r = Rotulo.interpretar(texto);
      preencherManual(r);
      if (r.achou < 3) {
        status('Li só ' + r.achou + ' de 5 valores. Tente uma foto de frente, com boa luz e a tabela inteira, ou complete abaixo.', 'erro');
      } else {
        status('Pronto: li ' + r.achou + ' de 5 valores. Confira os números abaixo antes de usar.' + (r.avisos.length ? ' ' + r.avisos.join(' ') : ''), 'ok');
      }
    } catch (e) {
      status(e && e.message ? e.message : 'Não consegui ler essa imagem.', 'erro');
    } finally {
      campo.value = '';
    }
  });

  /* código de barras (Open Food Facts) */
  async function buscarCodigo() {
    var cod = $('manCodigo').value.replace(/\D/g, '');
    if (cod.length < 8) { status('Digite o código de barras completo (8 a 14 números).', 'erro'); return; }
    status('Buscando o produto…');
    try {
      var a = await Api.porCodigo(cod);
      if (!a) { status('Não achei esse código, ou o cadastro dele está incompleto. Tire foto da tabela ou digite.', 'erro'); return; }
      preencherManual({ nome: a.nome + (a.marca ? ' (' + a.marca + ')' : ''), base: '100', porcaoG: a.porcao !== 100 ? a.porcao : null,
        kcal: a.kcal, prot: a.prot, carb: a.carb, gord: a.gord, fibra: a.fibra });
      $('manNome').value = a.nome + (a.marca ? ' (' + a.marca + ')' : '');
      status('Achei: ' + a.nome + '. Confira os números abaixo.', 'ok');
    } catch (e) {
      status('A base de produtos não respondeu. Tente de novo em instantes.', 'erro');
    }
  }
  $('manBuscarCodigo').addEventListener('click', buscarCodigo);
  $('manCodigo').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscarCodigo(); } });

  $('formManual').addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = $('manNome').value.trim();
    var base = document.querySelector('input[name="manBase"]:checked').value;
    var porc = parseFloat($('manPorcao').value);
    var v = {
      kcal: parseFloat($('manKcal').value), prot: parseFloat($('manProt').value) || 0,
      carb: parseFloat($('manCarb').value) || 0, gord: parseFloat($('manGord').value) || 0,
      fibra: parseFloat($('manFibra').value) || 0
    };
    var caixa = $('erroManual');
    function erro(msg) { caixa.textContent = msg; caixa.hidden = false; }

    if (!nome) return erro('Dê um nome ao alimento.');
    if (!(v.kcal >= 0)) return erro('Informe as calorias.');
    if (base === 'porcao') {
      if (!(porc > 0)) return erro('Informe de quantos gramas é a porção da tabela.');
      var k = 100 / porc;
      v.kcal *= k; v.prot *= k; v.carb *= k; v.gord *= k; v.fibra *= k;
    }
    if (v.kcal > 900) return erro('Calorias por 100 g acima de 900: confira se a base (100 g ou porção) está certa.');
    if (v.prot + v.carb + v.gord > 100.5) return erro('Proteína + carbo + gordura passa de 100 g em 100 g: confira a base e os números.');

    var esperado = v.prot * 4 + v.carb * 4 + v.gord * 9;
    if (v.kcal > 20 && Math.abs(esperado - v.kcal) > Math.max(40, v.kcal * 0.35) && !avisouInconsistencia) {
      avisouInconsistencia = true;
      return erro('As calorias (' + n0(v.kcal) + ') não batem com os macros (dariam ~' + n0(esperado) + '). Se a foto foi lida errado, corrija; se está certo, clique em "Usar este alimento" de novo.');
    }
    caixa.hidden = true;

    var a = {
      id: 'meu-' + Date.now().toString(36), origem: 'meu', nome: nome, marca: '',
      kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, fibra: v.fibra,
      porcao: base === 'porcao' ? porc : 100,
      unidade: base === 'porcao' ? '1 porção (' + n0(porc) + ' g)' : '100 g'
    };
    if ($('manSalvar').checked) {
      estado.meus.unshift(a);
      salvar();
      desenharMeus();
    }
    abrirAdd(a);
  });

  /* ---------------- meus alimentos ---------------- */
  function desenharMeus() {
    $('meus').hidden = !estado.meus.length;
    $('meusN').textContent = estado.meus.length ? '(' + estado.meus.length + ')' : '';
    $('meusLista').innerHTML = estado.meus.map(function (a) {
      return '<li><span>' + esc(a.nome) + ' <small>' + n0(a.kcal) + ' kcal/100 g</small></span>' +
        '<button type="button" data-id="' + esc(a.id) + '" aria-label="Apagar ' + esc(a.nome) + '">×</button></li>';
    }).join('');
  }
  $('meusLista').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]');
    if (!b) return;
    estado.meus = estado.meus.filter(function (a) { return a.id !== b.getAttribute('data-id'); });
    salvar();
    desenharMeus();
  });

  /* ---------------- exemplo pronto ---------------- */
  var EXEMPLO_PERFIL = { sexo: 'm', idade: 30, peso: 80, altura: 180, atividade: 'moderado', objetivo: 'perder', pesoAlvo: 75 };
  var EXEMPLO_DIAS = [
    [['Ovo cozido', 100, 'cafe'], ['Pão francês', 50, 'cafe'], ['Banana prata', 70, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Feijão carioca cozido', 120, 'almoco'], ['Peito de frango grelhado', 160, 'almoco'], ['Iogurte natural integral', 170, 'lanche'], ['Tilápia grelhada', 150, 'jantar'], ['Batata-doce cozida', 150, 'jantar'], ['Brócolis cozido', 80, 'jantar']],
    [['Aveia em flocos', 40, 'cafe'], ['Leite integral', 200, 'cafe'], ['Banana prata', 70, 'cafe'], ['Arroz branco cozido', 180, 'almoco'], ['Feijão preto cozido', 100, 'almoco'], ['Patinho grelhado', 140, 'almoco'], ['Maçã', 130, 'lanche'], ['Ovo cozido', 100, 'jantar'], ['Macarrão cozido', 200, 'jantar']],
    [['Pão francês', 100, 'cafe'], ['Queijo mussarela', 40, 'cafe'], ['Café sem açúcar', 50, 'cafe'], ['Arroz branco cozido', 200, 'almoco'], ['Alcatra grelhada', 150, 'almoco'], ['Batata inglesa cozida', 130, 'almoco'], ['Chocolate ao leite', 50, 'lanche'], ['Pasta de amendoim', 30, 'lanche'], ['Pão de forma integral', 50, 'jantar'], ['Ovo frito', 100, 'jantar']],
    [['Ovo cozido', 100, 'cafe'], ['Mamão papaia', 170, 'cafe'], ['Arroz integral cozido', 150, 'almoco'], ['Lentilha cozida', 100, 'almoco'], ['Peito de frango grelhado', 150, 'almoco'], ['Iogurte natural integral', 170, 'lanche'], ['Castanha-do-pará', 15, 'lanche'], ['Salmão grelhado', 130, 'jantar'], ['Couve refogada', 50, 'jantar']],
    [['Pão francês', 50, 'cafe'], ['Requeijão cremoso', 30, 'cafe'], ['Laranja', 180, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Feijão carioca cozido', 120, 'almoco'], ['Carne moída refogada', 100, 'almoco'], ['Banana prata', 70, 'lanche'], ['Macarrão cozido', 150, 'jantar'], ['Queijo mussarela', 30, 'jantar']],
    [['Aveia em flocos', 40, 'cafe'], ['Morango', 100, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Peito de frango grelhado', 160, 'almoco'], ['Mandioca cozida', 100, 'almoco'], ['Maçã', 130, 'lanche'], ['Ovo cozido', 100, 'jantar'], ['Abacate', 60, 'jantar']],
    [['Ovo cozido', 100, 'cafe'], ['Pão francês', 50, 'cafe'], ['Banana prata', 70, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Feijão carioca cozido', 120, 'almoco'], ['Peito de frango grelhado', 140, 'almoco']]
  ];

  $('exemplo').addEventListener('click', function () {
    if (Object.keys(estado.diario).length &&
        !window.confirm('Isso substitui seu perfil e seu diário atuais pelo exemplo. Continuar?')) return;
    var diario = {};
    EXEMPLO_DIAS.forEach(function (lista, i) {
      var k = somarDias(HOJE, i - (EXEMPLO_DIAS.length - 1));
      diario[k] = lista.map(function (x, j) {
        var a = Alimentos.LISTA.filter(function (z) { return z.nome === x[0]; })[0];
        var v = Calculo.porcao(a, x[1]);
        return { id: 'ex' + i + '-' + j, nome: a.nome, marca: '', gramas: x[1], refeicao: x[2],
                 kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, fibra: v.fibra };
      });
    });
    estado.perfil = EXEMPLO_PERFIL;
    estado.diario = diario;
    diaAtual = HOJE;
    salvar();
    preencherForm(estado.perfil);
    $('erroPerfil').hidden = true;
    aplicarPerfil(true);
  });

  /* ---------------- backup: levar os dados para outro aparelho, sem conta ---------------- */
  function dataArquivo() { return chaveData(new Date()); }

  $('baixarBackup').addEventListener('click', function () {
    var corpo = JSON.stringify({ app: 'prato-certo', versao: 1, exportado: new Date().toISOString(),
      perfil: estado.perfil, diario: estado.diario, meus: estado.meus }, null, 2);
    var url = URL.createObjectURL(new Blob([corpo], { type: 'application/json' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'prato-certo-backup-' + dataArquivo() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    $('backupStatus').textContent = 'Backup baixado. Guarde o arquivo e use "Restaurar backup" em outro aparelho.';
  });

  $('restaurarBackup').addEventListener('change', function () {
    var arq = this.files && this.files[0];
    var campo = this;
    if (!arq) return;
    function fim(msg, erro) { $('backupStatus').textContent = msg; $('backupStatus').className = 'backup__status' + (erro ? ' backup__status--erro' : ''); campo.value = ''; }
    if (arq.size > 3 * 1024 * 1024) return fim('Arquivo grande demais para ser um backup do Prato Certo.', true);
    var leitor = new FileReader();
    leitor.onerror = function () { fim('Não consegui ler esse arquivo.', true); };
    leitor.onload = function () {
      var dados;
      try { dados = JSON.parse(leitor.result); } catch (e) { return fim('Esse arquivo não é um backup válido (JSON quebrado).', true); }
      if (!dados || dados.app !== 'prato-certo') return fim('Esse arquivo não parece ser um backup do Prato Certo.', true);
      var novo = limparEstado(dados);
      if (!novo.perfil && !Object.keys(novo.diario).length && !novo.meus.length) return fim('O backup está vazio ou com dados inválidos.', true);
      var tem = estado.perfil || Object.keys(estado.diario).length || estado.meus.length;
      if (tem && !window.confirm('Isso substitui os dados atuais deste navegador pelos do backup. Continuar?')) return fim('Restauração cancelada.', false);
      estado = novo;
      salvar();
      if (estado.perfil) { preencherForm(estado.perfil); aplicarPerfil(true); } else { desenharMeus(); }
      diaAtual = HOJE;
      fim('Backup restaurado: ' + Object.keys(estado.diario).length + ' dias e ' + estado.meus.length + ' alimentos seus.', false);
    };
    leitor.readAsText(arq);
  });

  /* ---------------- aviso de armazenamento (uma vez) ---------------- */
  function mostrarAviso() {
    if (lerCookie(COOKIE_AVISO)) return;
    $('aviso').hidden = false;
    $('avisoOk').addEventListener('click', function () {
      gravarCookie(COOKIE_AVISO, '1', 365);
      $('aviso').hidden = true;
    });
  }

  /* ---------------- apagar tudo ---------------- */
  $('apagar').addEventListener('click', function () {
    if (!window.confirm('Apagar seu perfil, seu diário e seus alimentos cadastrados deste navegador?')) return;
    try { localStorage.removeItem(CHAVE); } catch (e) { /* ok */ }
    apagarCookie(COOKIE_PERFIL);
    window.location.reload();
  });

  /* ---------------- início ---------------- */
  preencherSelects();
  carregar();
  if (estado.perfil && !Calculo.validar(estado.perfil)) {
    preencherForm(estado.perfil);
    aplicarPerfil(false);
  }
  mostrarAviso();
})();
