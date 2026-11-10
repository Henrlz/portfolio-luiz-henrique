/* Prato Certo — telas (conta → questionário → painel), estado e busca.
   Contas em calculo.js, regras de saúde em saude.js, base em alimentos.js,
   internet em api.js e leitura da foto da tabela em rotulo.js. */
(function () {
  'use strict';

  var CHAVE = 'pratocerto:v1';
  var REFEICOES = [
    { id: 'cafe',   nome: 'Café da manhã' },
    { id: 'almoco', nome: 'Almoço' },
    { id: 'lanche', nome: 'Lanche' },
    { id: 'jantar', nome: 'Jantar' }
  ];
  var MARCAS_CADASTRO = ['gluten', 'leite', 'ovo', 'amendoim', 'castanhas', 'peixe', 'crustaceo', 'soja', 'carne'];

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var n0 = function (n) { return Math.round(n).toLocaleString('pt-BR'); };
  var n1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR'); };

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 5200);
  }

  /* =================== estado e armazenamento =================== */
  var estado = { conta: null, perfil: null, diario: {}, meus: [] };

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

  /* tudo que vem do armazenamento, do cookie ou de um backup é reconstruído aqui,
     com tipos e faixas realistas (um arquivo editado não injeta HTML nem 999999 kcal) */
  var DATA = /^\d{4}-\d{2}-\d{2}$/;
  var num = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var faixa = function (v, max) { v = num(v); return v < 0 ? 0 : (v > max ? max : v); };
  var txt = function (v, max) { return String(v == null ? '' : v).slice(0, max || 80); };
  var marcasValidas = function (m) {
    return Array.isArray(m) ? m.filter(function (x, i) { return Saude.MARCA_TEXTO[x] && m.indexOf(x) === i; }) : [];
  };

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
      pesoAlvo: p.pesoAlvo == null || p.pesoAlvo === '' ? null : num(p.pesoAlvo),
      saude: Saude.limpar(p.saude) };
    if (q.sexo !== 'f') q.saude.condicoes = q.saude.condicoes.filter(function (c) { return c !== 'gestante'; });
    return Calculo.validar(q) ? null : q;
  }
  function limpaConta(c) {
    if (!c || typeof c !== 'object') return null;
    return { nome: txt(c.nome, 40).trim(), criada: txt(c.criada, 30) };
  }
  function limparEstado(v) {
    var s = { conta: null, perfil: null, diario: {}, meus: [] };
    if (!v || typeof v !== 'object') return s;
    s.conta = limpaConta(v.conta);
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
          porcao: num(a.porcao) > 0 ? Math.min(num(a.porcao), 2000) : 100, unidade: txt(a.unidade, 40) || '100 g',
          marcas: marcasValidas(a.marcas) };
      }).filter(function (a) { return a && a.nome && a.prot + a.carb + a.gord <= 100.5; });
    }
    /* perfil antigo sem conta: cria uma conta sem nome */
    if (s.perfil && !s.conta) s.conta = { nome: '', criada: '' };
    return s;
  }

  function carregar() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE));
      if (v && typeof v === 'object') estado = limparEstado(v);
    } catch (e) { /* bloqueado ou corrompido: começa vazio */ }
    if (!estado.perfil) {
      try {
        var c = JSON.parse(lerCookie(COOKIE_PERFIL));
        var p = c && limpoPerfil(c.perfil || c);
        if (p) { estado.perfil = p; estado.conta = limpaConta(c.conta) || { nome: '', criada: '' }; }
      } catch (e) { /* cookie ausente ou inválido */ }
    }
  }
  var pediuPersistencia = false;
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* modo privado */ }
    if (estado.perfil) {
      gravarCookie(COOKIE_PERFIL, JSON.stringify({ conta: estado.conta, perfil: estado.perfil }), 400);
    }
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

  /* =================== telas =================== */
  function mostrarTela(id) {
    ['telaConta', 'telaQuest', 'telaApp'].forEach(function (t) { $(t).hidden = t !== id; });
    window.scrollTo(0, 0);
  }

  /* =================== 1. conta =================== */
  $('entrarGoogle').addEventListener('click', function () {
    toast('O login com Google é só ilustrativo neste projeto. Crie a conta local logo abaixo: leva um minuto.');
    $('contaNome').focus();
  });

  $('formConta').addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = $('contaNome').value.trim().replace(/\s+/g, ' ');
    if (nome.length < 2) { $('erroConta').textContent = 'Digite como você quer ser chamado(a).'; $('erroConta').hidden = false; return; }
    $('erroConta').hidden = true;
    estado.conta = { nome: nome.slice(0, 40), criada: new Date().toISOString() };
    salvar();
    iniciarQuest(false);
  });

  $('verDemo').addEventListener('click', function () { carregarExemplo(); });

  /* =================== 2. questionário =================== */
  var rascunho = null, passo = 0, editando = false;

  function opcoesAtividade() {
    return Object.keys(Calculo.FATORES).map(function (k) { return { v: k, t: Calculo.FATORES[k].nome, d: Calculo.FATORES[k].dica }; });
  }
  function opcoesObjetivo() {
    return Object.keys(Calculo.OBJETIVOS).map(function (k) { return { v: k, t: Calculo.OBJETIVOS[k].nome }; });
  }

  var PASSOS = [
    { id: 'sexo', tipo: 'opcoes', titulo: 'Qual é o seu sexo biológico?', ajuda: 'Entra na fórmula do metabolismo basal.',
      opcoes: function () { return [{ v: 'f', t: 'Feminino' }, { v: 'm', t: 'Masculino' }]; } },
    { id: 'idade', tipo: 'numero', titulo: 'Quantos anos você tem?', unidade: 'anos', min: 14, max: 100 },
    { id: 'altura', tipo: 'numero', titulo: 'Qual é a sua altura?', unidade: 'cm', min: 120, max: 230 },
    { id: 'peso', tipo: 'numero', titulo: 'E o seu peso atual?', unidade: 'kg', min: 30, max: 300, decimal: true },
    { id: 'atividade', tipo: 'opcoes', titulo: 'Como é a sua rotina de atividade física?', opcoes: opcoesAtividade },
    { id: 'objetivo', tipo: 'opcoes', titulo: 'Qual é o seu objetivo?', opcoes: opcoesObjetivo },
    { id: 'pesoAlvo', tipo: 'numero', titulo: 'Tem um peso que quer atingir?', ajuda: 'Opcional: serve para estimar o prazo.',
      unidade: 'kg', min: 30, max: 300, decimal: true, opcional: true,
      se: function (r) { return r.objetivo !== 'manter'; } },
    { id: 'condicoes', tipo: 'multi', titulo: 'Você tem alguma destas condições de saúde?',
      ajuda: 'Usamos isso para esconder ou sinalizar alimentos. Pode marcar mais de uma.',
      opcoes: function (r) {
        return Saude.CONDICOES.filter(function (c) { return !c.so || c.so === r.sexo; })
          .map(function (c) { return { v: c.id, t: c.nome, d: c.dica }; });
      } },
    { id: 'alergias', tipo: 'multi', titulo: 'Tem alergia a algum alimento?', ajuda: 'Alimentos com esses ingredientes não vão aparecer na busca.',
      opcoes: function () { return Saude.ALERGIAS.map(function (a) { return { v: a.id, t: a.nome }; }); } },
    { id: 'dieta', tipo: 'opcoes', titulo: 'Segue alguma alimentação específica?',
      opcoes: function () { return Saude.DIETAS.map(function (d) { return { v: d.id, t: d.nome, d: d.dica }; }); } },
    { id: 'resumo', tipo: 'resumo', titulo: 'Tudo pronto' }
  ];

  function passosAtivos() { return PASSOS.filter(function (p) { return !p.se || p.se(rascunho); }); }

  function valorDe(id) {
    if (id === 'condicoes' || id === 'alergias' || id === 'dieta') return rascunho.saude[id];
    return rascunho[id];
  }
  function definir(id, v) {
    if (id === 'condicoes' || id === 'alergias' || id === 'dieta') rascunho.saude[id] = v;
    else rascunho[id] = v;
  }

  function iniciarQuest(editar) {
    editando = !!editar;
    rascunho = estado.perfil
      ? JSON.parse(JSON.stringify(estado.perfil))
      : { sexo: null, idade: null, altura: null, peso: null, atividade: null, objetivo: null, pesoAlvo: null, saude: Saude.vazio() };
    passo = 0;
    $('questCancelar').hidden = !editando;
    mostrarTela('telaQuest');
    desenharPasso();
  }

  function desenharPasso() {
    var lista = passosAtivos();
    if (passo >= lista.length) passo = lista.length - 1;
    var p = lista[passo];
    var total = lista.length - 1;  /* o resumo não conta como pergunta */
    $('questPasso').textContent = p.tipo === 'resumo' ? 'Resumo' : 'Pergunta ' + (passo + 1) + ' de ' + total;
    $('questBarra').style.width = Math.round(((passo + (p.tipo === 'resumo' ? 1 : 0)) / total) * 100) + '%';
    $('questVoltar').hidden = passo === 0;
    $('questPular').hidden = !p.opcional;
    $('questAvancar').textContent = p.tipo === 'resumo' ? (editando ? 'Salvar e voltar ao painel' : 'Ir para o meu painel') : 'Continuar';
    $('erroQuest').hidden = true;

    var corpo = '<h1 class="quest__tit">' + esc(p.titulo) + '</h1>' + (p.ajuda ? '<p class="quest__ajuda">' + esc(p.ajuda) + '</p>' : '');
    if (p.id === 'sexo' && estado.conta && estado.conta.nome && !editando) {
      corpo = '<p class="quest__ola">Olá, ' + esc(estado.conta.nome) + '! Vamos montar o seu plano.</p>' + corpo;
    }

    if (p.tipo === 'numero') {
      var v = valorDe(p.id);
      corpo += '<label class="numero"><input id="qNum" type="number" inputmode="' + (p.decimal ? 'decimal' : 'numeric') + '" step="' + (p.decimal ? '0.1' : '1') +
        '" min="' + p.min + '" max="' + p.max + '" value="' + (v != null ? esc(v) : '') + '" aria-label="' + esc(p.titulo) + '"><span>' + esc(p.unidade) + '</span></label>';
    } else if (p.tipo === 'opcoes' || p.tipo === 'multi') {
      var multi = p.tipo === 'multi';
      var atual = valorDe(p.id);
      corpo += '<div class="opcoes" role="' + (multi ? 'group' : 'radiogroup') + '" aria-label="' + esc(p.titulo) + '">' +
        p.opcoes(rascunho).map(function (o) {
          var marcado = multi ? (atual || []).indexOf(o.v) !== -1 : atual === o.v;
          return '<label class="opcao' + (marcado ? ' opcao--sel' : '') + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="qOpc" value="' + esc(o.v) + '"' + (marcado ? ' checked' : '') + '>' +
            '<span class="opcao__marca" aria-hidden="true"></span><span class="opcao__txt"><b>' + esc(o.t) + '</b>' + (o.d ? '<small>' + esc(o.d) + '</small>' : '') + '</span></label>';
        }).join('') + '</div>';
      if (multi) corpo += '<p class="quest__ajuda quest__ajuda--fim">Nenhuma? É só continuar.</p>';
    } else if (p.tipo === 'resumo') {
      corpo += resumoQuest();
    }
    $('questCorpo').innerHTML = corpo;
    var foco = $('questCorpo').querySelector('#qNum, input[name="qOpc"]');
    if (foco) foco.focus();
  }

  function resumoQuest() {
    var m = Calculo.metas(rascunho);
    var r = Saude.resumo(rascunho);
    var linhas = '<div class="resumo-q">' +
      '<div class="resumo-q__kcal"><span>Meta diária</span><b>' + n0(m.kcal) + '</b><small>kcal</small></div>' +
      '<div class="resumo-q__macros">' +
        '<div><b>' + n0(m.prot) + ' g</b><span>proteína</span></div>' +
        '<div><b>' + n0(m.carb) + ' g</b><span>carboidrato</span></div>' +
        '<div><b>' + n0(m.gord) + ' g</b><span>gordura</span></div>' +
      '</div></div>';
    linhas += '<ul class="lista-check">';
    if (r.esconde.length) linhas += '<li>Vamos <b>esconder</b> da busca alimentos com: ' + esc(r.esconde.join(', ')) + '.</li>';
    if (r.avisa.length) linhas += '<li>Vamos <b>sinalizar</b> alimentos com ' + esc(r.avisa.join(' e ')) + '.</li>';
    if (!r.esconde.length && !r.avisa.length) linhas += '<li>Nenhum filtro de saúde: todos os alimentos aparecem.</li>';
    if (m.semDeficit) linhas += '<li>Na gestação ou amamentação não aplicamos déficit calórico. Converse com seu médico.</li>';
    if (m.limitada) linhas += '<li>A meta ficou no piso de segurança (não abaixo do seu metabolismo basal nem de 1.200 kcal).</li>';
    linhas += '</ul><p class="quest__ajuda">Você pode mudar essas respostas quando quiser, pelo menu.</p>';
    return linhas;
  }

  /* lê e valida a resposta do passo atual; devolve mensagem de erro ou null */
  function lerPasso(pular) {
    var p = passosAtivos()[passo];
    if (p.tipo === 'numero') {
      var bruto = $('qNum').value.trim().replace(',', '.');
      if (pular || (p.opcional && !bruto)) { definir(p.id, null); return null; }
      var v = parseFloat(bruto);
      if (!(v >= p.min && v <= p.max)) return 'Informe um valor entre ' + p.min + ' e ' + p.max + ' ' + p.unidade + '.';
      definir(p.id, p.decimal ? Math.round(v * 10) / 10 : Math.round(v));
      return null;
    }
    if (p.tipo === 'opcoes') {
      var marcado = document.querySelector('input[name="qOpc"]:checked');
      if (!marcado) return 'Escolha uma opção.';
      definir(p.id, marcado.value);
      if (p.id === 'objetivo' && marcado.value === 'manter') rascunho.pesoAlvo = null;
      if (p.id === 'sexo' && marcado.value === 'm') {
        rascunho.saude.condicoes = rascunho.saude.condicoes.filter(function (c) { return c !== 'gestante'; });
      }
      return null;
    }
    if (p.tipo === 'multi') {
      definir(p.id, Array.prototype.map.call(document.querySelectorAll('input[name="qOpc"]:checked'), function (i) { return i.value; }));
      return null;
    }
    return null;
  }

  function avancar(pular) {
    var lista = passosAtivos();
    var p = lista[passo];
    if (p.tipo === 'resumo') { concluirQuest(); return; }
    var erro = lerPasso(pular);
    if (erro) { $('erroQuest').textContent = erro; $('erroQuest').hidden = false; return; }
    if (p.id === 'pesoAlvo' && rascunho.pesoAlvo != null) {
      var m = Calculo.metas(rascunho);
      if (m.prazo && m.prazo.incoerente) {
        $('erroQuest').textContent = 'Esse peso está na direção contrária do seu objetivo. Ajuste o valor ou pule.';
        $('erroQuest').hidden = false;
        return;
      }
    }
    passo++;
    desenharPasso();
  }

  $('formQuest').addEventListener('submit', function (e) { e.preventDefault(); avancar(false); });
  $('questPular').addEventListener('click', function () { avancar(true); });
  /* voltar: guarda o que já é válido neste passo, sem exigir resposta */
  function guardarSemValidar() {
    var p = passosAtivos()[passo];
    if (p.tipo === 'numero') {
      var v = parseFloat($('qNum').value.trim().replace(',', '.'));
      if (v >= p.min && v <= p.max) definir(p.id, p.decimal ? Math.round(v * 10) / 10 : Math.round(v));
    } else if (p.tipo === 'opcoes') {
      var marcado = document.querySelector('input[name="qOpc"]:checked');
      if (marcado) definir(p.id, marcado.value);
    } else if (p.tipo === 'multi') {
      lerPasso(false);
    }
  }
  $('questVoltar').addEventListener('click', function () { if (passo > 0) { guardarSemValidar(); passo--; desenharPasso(); } });
  $('questCancelar').addEventListener('click', function () { mostrarTela('telaApp'); });
  /* escolher uma opção única já avança: menos cliques */
  $('questCorpo').addEventListener('change', function (e) {
    if (e.target.name !== 'qOpc') return;
    document.querySelectorAll('#questCorpo .opcao').forEach(function (o) {
      o.classList.toggle('opcao--sel', o.querySelector('input').checked);
    });
    if (e.target.type === 'radio') setTimeout(function () { avancar(false); }, 220);
  });

  function concluirQuest() {
    var p = limpoPerfil(rascunho);
    if (!p) { $('erroQuest').textContent = 'Alguma resposta ficou fora do esperado. Volte e confira.'; $('erroQuest').hidden = false; return; }
    estado.perfil = p;
    if (!estado.conta) estado.conta = { nome: '', criada: new Date().toISOString() };
    salvar();
    abrirPainel();
    if (editando) toast('Respostas atualizadas. A meta e os filtros já foram recalculados.');
  }

  /* =================== 3. painel =================== */
  var metas = null, regras = null;

  function iniciais(nome) {
    var partes = (nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '·';
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  }

  function abrirPainel() {
    metas = Calculo.metas(estado.perfil);
    regras = Saude.regras(estado.perfil);
    var nome = (estado.conta && estado.conta.nome) || '';
    $('avatar').textContent = iniciais(nome);
    $('menuNome').textContent = nome || 'Minha conta';
    var h = new Date().getHours();
    $('ola').textContent = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (nome ? ', ' + nome.split(' ')[0] : '') + '.';
    mostrarMeta();
    mostrarSaude();
    desenharMeus();
    diaAtual = HOJE;
    desenharDia();
    mostrarTela('telaApp');
  }

  $('editarRespostas').addEventListener('click', function () { $('menu').open = false; iniciarQuest(true); });
  $('editarSaude').addEventListener('click', function () {
    iniciarQuest(true);
    var idx = passosAtivos().map(function (p) { return p.id; }).indexOf('condicoes');
    if (idx > -1) { passo = idx; desenharPasso(); }
  });
  document.addEventListener('click', function (e) {
    if ($('menu').open && !e.target.closest('#menu')) $('menu').open = false;
  });

  function dataEm(dias) {
    var d = new Date(); d.setDate(d.getDate() + dias);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function mostrarMeta() {
    var m = metas, p = estado.perfil;
    var linhas = [
      ['Metabolismo basal', n0(m.tmb) + ' kcal'],
      ['Gasto diário estimado', n0(m.gasto) + ' kcal'],
      ['Fibra', 'mín. ' + n0(m.fibra) + ' g'],
      ['Água', '~' + n1(m.agua) + ' L'],
      ['IMC', n1(m.imc)]
    ];
    if (Math.abs(m.kgSemana) >= 0.05) linhas.unshift(['Ritmo estimado', (m.kgSemana > 0 ? '−' : '+') + n1(Math.abs(m.kgSemana)) + ' kg/semana']);
    var notas = '';
    if (m.semDeficit) notas += '<p class="nota nota--alerta">Gestação ou amamentação: a meta não tem déficit calórico. Siga a orientação do seu médico.</p>';
    if (m.limitada) notas += '<p class="nota nota--alerta">A meta ficou no piso de segurança (não abaixo do metabolismo basal nem de 1.200 kcal).</p>';
    if (m.prazo && !m.prazo.incoerente) {
      notas += '<p class="nota">Para ' + n1(m.prazo.kg) + ' kg nesse ritmo: cerca de <b>' + m.prazo.semanas + ' semanas</b>, por volta de ' + esc(dataEm(m.prazo.dias)) + '.</p>';
    }
    $('resultadoMeta').innerHTML =
      '<div class="meta-kcal"><b>' + n0(m.kcal) + '</b><span>kcal por dia</span></div>' +
      '<div class="meta-macros">' +
        '<div style="--c:var(--prot)"><b>' + n0(m.prot) + ' g</b><span>Proteína</span></div>' +
        '<div style="--c:var(--carb)"><b>' + n0(m.carb) + ' g</b><span>Carboidrato</span></div>' +
        '<div style="--c:var(--gord)"><b>' + n0(m.gord) + ' g</b><span>Gordura</span></div>' +
      '</div>' +
      '<dl class="lista-dados">' + linhas.map(function (l) { return '<div><dt>' + l[0] + '</dt><dd>' + l[1] + '</dd></div>'; }).join('') + '</dl>' +
      notas +
      '<p class="nota-fina">' + esc(Calculo.OBJETIVOS[p.objetivo].nome) + ' · proteína ' + Calculo.OBJETIVOS[p.objetivo].prot + ' g/kg · gordura 25% · carboidrato: o restante.</p>';
  }

  function mostrarSaude() {
    var s = estado.perfil.saude;
    var nomes = function (lista, ids) { return ids.map(function (id) { return lista.filter(function (x) { return x.id === id; })[0].nome; }); };
    var chips = nomes(Saude.CONDICOES, s.condicoes).concat(nomes(Saude.ALERGIAS, s.alergias).map(function (a) { return 'Alergia: ' + a; }));
    if (s.dieta !== 'nenhuma') chips.push('Dieta ' + s.dieta);
    var r = Saude.resumo(estado.perfil);
    var html = chips.length
      ? '<ul class="chips-lista">' + chips.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>'
      : '<p class="nota-fina">Nenhuma condição, alergia ou dieta informada.</p>';
    if (r.esconde.length) html += '<p class="saude-linha"><span class="ponto ponto--esconde"></span>Escondendo: ' + esc(r.esconde.join(', ')) + '</p>';
    if (r.avisa.length) html += '<p class="saude-linha"><span class="ponto ponto--avisa"></span>Sinalizando: ' + esc(r.avisa.join(', ')) + '</p>';
    if (s.condicoes.indexOf('hipertensao') !== -1) html += '<p class="nota-fina">Referência da OMS: até 2 g de sódio por dia (cerca de 5 g de sal).</p>';
    if (s.condicoes.indexOf('diabetes') !== -1) html += '<p class="nota-fina">A distribuição de carboidratos ao longo do dia deve ser definida com seu médico ou nutricionista.</p>';
    $('saudeResumo').innerHTML = html;
  }

  /* ---------- dia: navegação ---------- */
  function textoDia(k) {
    if (k === HOJE) return 'Hoje';
    if (k === somarDias(HOJE, -1)) return 'Ontem';
    return deChave(k).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  $('diaAnt').addEventListener('click', function () { diaAtual = somarDias(diaAtual, -1); fecharAdd(); desenharDia(); });
  $('diaProx').addEventListener('click', function () { if (diaAtual < HOJE) { diaAtual = somarDias(diaAtual, 1); fecharAdd(); desenharDia(); } });
  $('diaHoje').addEventListener('click', function () { diaAtual = HOJE; fecharAdd(); desenharDia(); });

  /* ---------- resumo: anel + barras ---------- */
  function desenharResumo(t) {
    var meta = metas.kcal, resta = meta - t.kcal, frac = Math.min(t.kcal / meta, 1);
    var R = 54, C = 2 * Math.PI * R, passou = t.kcal > meta * 1.05;
    function barra(nome, atual, alvo, cor, unid) {
      var pct = alvo > 0 ? Math.min(atual / alvo, 1) * 100 : 0;
      var acima = alvo > 0 && atual > alvo * 1.05;
      return '<div class="macro' + (acima ? ' macro--acima' : '') + '" style="--c:' + cor + '">' +
        '<div class="macro__txt"><span>' + nome + '</span><b>' + n0(atual) + '<small> / ' + n0(alvo) + ' ' + unid + '</small></b></div>' +
        '<div class="macro__trilho"><i style="width:' + pct.toFixed(1) + '%"></i></div></div>';
    }
    $('rotulo').innerHTML =
      '<div class="anel' + (passou ? ' anel--acima' : '') + '">' +
        '<svg viewBox="0 0 128 128" role="img" aria-label="' + n0(t.kcal) + ' de ' + n0(meta) + ' calorias">' +
          '<circle class="anel__trilho" cx="64" cy="64" r="' + R + '"/>' +
          '<circle class="anel__valor" cx="64" cy="64" r="' + R + '" transform="rotate(-90 64 64)" stroke-dasharray="' + (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="anel__centro"><b>' + n0(Math.abs(resta)) + '</b><span>' + (resta >= 0 ? 'kcal restantes' : 'kcal acima') + '</span></div>' +
      '</div>' +
      '<div class="resumo__dados">' +
        '<div class="resumo__kcal"><div><span>Consumido</span><b>' + n0(t.kcal) + '</b></div><div><span>Meta</span><b>' + n0(meta) + '</b></div></div>' +
        barra('Proteína', t.prot, metas.prot, 'var(--prot)', 'g') +
        barra('Carboidrato', t.carb, metas.carb, 'var(--carb)', 'g') +
        barra('Gordura', t.gord, metas.gord, 'var(--gord)', 'g') +
        barra('Fibra', t.fibra, metas.fibra, 'var(--fibra)', 'g') +
      '</div>';
  }

  /* ---------- refeições ---------- */
  function desenharRefeicoes(itens) {
    $('refeicoes').innerHTML = REFEICOES.map(function (r) {
      var lista = itens.filter(function (i) { return i.refeicao === r.id; });
      var soma = Calculo.somar(lista);
      var corpo = lista.length ? lista.map(function (i) {
        return '<li class="item">' +
          '<div class="item__nome"><strong>' + esc(i.nome) + '</strong><small>' + n0(i.gramas) + ' g' + (i.marca ? ' · ' + esc(i.marca) : '') +
            ' · P ' + n0(i.prot) + ' · C ' + n0(i.carb) + ' · G ' + n0(i.gord) + '</small></div>' +
          '<b class="item__kcal">' + n0(i.kcal) + ' kcal</b>' +
          '<button type="button" class="item__x" data-id="' + esc(i.id) + '" aria-label="Remover ' + esc(i.nome) + '">×</button></li>';
      }).join('') : '<li class="vazio">Nada registrado</li>';
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

  /* ---------- semana: barras clicáveis ---------- */
  function desenharSemana() {
    var dias = [];
    for (var i = 6; i >= 0; i--) dias.push(somarDias(diaAtual, -i));
    var totais = dias.map(function (k) { return Calculo.somar(itensDo(k)).kcal; });
    var topo = Math.max(metas.kcal * 1.3, Math.max.apply(null, totais));
    var perto = 0, registrados = 0;
    var barras = dias.map(function (k, i) {
      var t = totais[i], tem = itensDo(k).length > 0;
      var cls = !tem ? 'dia--vazio' : (t > metas.kcal * 1.1 ? 'dia--acima' : (t >= metas.kcal * 0.9 ? 'dia--meta' : 'dia--abaixo'));
      if (tem) { registrados++; if (t >= metas.kcal * 0.9 && t <= metas.kcal * 1.1) perto++; }
      var rot = deChave(k).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return '<button type="button" class="dia ' + cls + (k === diaAtual ? ' dia--sel' : '') + '" data-dia="' + k + '" aria-label="' +
        deChave(k).toLocaleDateString('pt-BR') + ': ' + n0(t) + ' kcal">' +
        '<span class="dia__col"><i style="height:' + (tem ? Math.max((t / topo) * 100, 3) : 0).toFixed(1) + '%"></i></span>' +
        '<span class="dia__rot">' + rot + '</span></button>';
    }).join('');
    /* as colunas ocupam a área menos o respiro de cima (18 px) e os rótulos embaixo (23 px) */
    var frac = (metas.kcal / topo).toFixed(4);
    $('grafico').innerHTML = '<div class="semana__area"><span class="semana__meta" style="bottom:calc(23px + (100% - 41px) * ' + frac + ')"><em>meta</em></span>' + barras + '</div>';
    $('semanaNota').textContent = registrados
      ? perto + (perto === 1 ? ' dia' : ' dias') + ' perto da meta (±10%) em ' + registrados + ' registrado' + (registrados > 1 ? 's' : '') + '. Toque numa barra para abrir o dia.'
      : 'Registre suas refeições para acompanhar a semana.';
  }
  $('grafico').addEventListener('click', function (e) {
    var b = e.target.closest('.dia');
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
    desenharResumo(Calculo.somar(itens));
    desenharRefeicoes(itens);
    desenharSemana();
  }

  /* =================== busca com filtro de saúde =================== */
  var buscaTimer = null, buscaCtl = null, ultimaBusca = '';
  var visiveis = [], mostrarEscondidos = false, ultimaLista = [];
  var ROTULO_ORIGEM = { off: 'produto', rede: 'rede · aprox.', meu: 'meu' };

  function refeicaoPorHora() {
    var h = new Date().getHours();
    return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : 'jantar';
  }

  function desenharResultados(lista) {
    ultimaLista = lista;
    var livres = [], presos = [];
    lista.forEach(function (a) {
      var av = Saude.avaliar(a, regras);
      (av.bloqueio ? presos : livres).push({ a: a, av: av });
    });
    visiveis = livres.map(function (x) { return x.a; });

    var html = livres.map(function (x, i) {
      var a = x.a;
      return '<li><button type="button" class="res" data-i="' + i + '">' +
        '<span class="res__nome">' + esc(a.nome) + (a.marca ? ' <small>' + esc(a.marca) + '</small>' : '') +
          (ROTULO_ORIGEM[a.origem] ? ' <em class="selo selo--' + a.origem + '">' + ROTULO_ORIGEM[a.origem] + '</em>' : '') + '</span>' +
        '<span class="res__num">' + n0(a.kcal) + ' kcal/100 g · P ' + n0(a.prot) + ' · C ' + n0(a.carb) + ' · G ' + n0(a.gord) + '</span>' +
        (x.av.avisos.length ? '<span class="res__aviso">⚠ ' + esc(x.av.avisos.join(' · ')) + '</span>' : '') +
        '</button></li>';
    }).join('');

    if (presos.length) {
      html += '<li class="escondidos"><button type="button" class="link link--peq" id="verEscondidos">' +
        presos.length + (presos.length === 1 ? ' alimento escondido' : ' alimentos escondidos') + ' pelo seu perfil de saúde · ' +
        (mostrarEscondidos ? 'ocultar' : 'ver quais') + '</button></li>';
      if (mostrarEscondidos) {
        html += presos.map(function (x) {
          return '<li class="res res--preso"><span class="res__nome">' + esc(x.a.nome) + (x.a.marca ? ' <small>' + esc(x.a.marca) + '</small>' : '') + '</span>' +
            '<span class="res__preso">' + esc(x.av.bloqueio) + '</span></li>';
        }).join('');
      }
    }
    html += '<li><button type="button" class="res res--manual" id="resManual">Não achou? Cadastrar pela foto da tabela, código de barras ou digitando</button></li>';
    $('resultados').innerHTML = html;
    $('resultados').hidden = false;
  }

  $('busca').addEventListener('input', function () {
    var q = this.value.trim();
    clearTimeout(buscaTimer);
    if (buscaCtl) buscaCtl.abort();
    mostrarEscondidos = false;
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
      desenharResultados(locais.concat(remotos));
      $('buscaStatus').textContent = remotos.length
        ? visiveis.length + ' resultados (' + remotos.length + ' da internet).'
        : (locais.length ? 'Nenhum produto na internet para essa busca.' : 'Nada encontrado. Cadastre o alimento abaixo.');
    } catch (e) {
      if (ctl.signal.aborted && ultimaBusca !== q) return;
      $('buscaStatus').textContent = locais.length
        ? 'A base de produtos não respondeu agora; mostrando só a base local.'
        : 'Não consegui consultar a base de produtos agora. Tente de novo ou cadastre o alimento.';
    }
  }

  $('resultados').addEventListener('click', function (e) {
    if (e.target.closest('#resManual')) { abrirManual(); return; }
    if (e.target.closest('#verEscondidos')) { mostrarEscondidos = !mostrarEscondidos; desenharResultados(ultimaLista); return; }
    var b = e.target.closest('.res[data-i]');
    if (b) abrirAdd(visiveis[+b.getAttribute('data-i')]);
  });

  /* ---------- adicionar ---------- */
  var escolhido = null;

  function abrirAdd(a) {
    escolhido = a;
    $('formManual').hidden = true;
    $('addNome').textContent = a.nome + (a.marca ? ' · ' + a.marca : '');
    $('addInfo').textContent = 'Porção típica: ' + a.unidade + (a.unidade.indexOf(' g)') === -1 && a.unidade !== '100 g' ? ' (' + n0(a.porcao) + ' g)' : '');
    var av = Saude.avaliar(a, regras);
    $('addAtencao').hidden = !av.avisos.length;
    $('addAtencao').textContent = av.avisos.length ? 'Atenção: ' + av.avisos.join(' · ') + '. Consuma com moderação.' : '';
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
      nome: escolhido.nome, marca: escolhido.marca || '', gramas: g, refeicao: $('addRefeicao').value,
      kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, fibra: v.fibra
    };
    (estado.diario[diaAtual] = itensDo(diaAtual)).push(item);
    salvar();
    fecharAdd();
    $('busca').value = '';
    $('resultados').hidden = true;
    $('buscaStatus').textContent = 'Adicionado: ' + item.nome + ' (' + n0(item.kcal) + ' kcal).';
    desenharDia();
    $('busca').focus();
  });
  $('addCancelar').addEventListener('click', fecharAdd);

  /* ---------- cadastro: foto, código de barras ou digitar ---------- */
  var avisouInconsistencia = false;

  $('manMarcas').insertAdjacentHTML('beforeend', MARCAS_CADASTRO.map(function (m) {
    return '<label class="chip"><input type="checkbox" name="manMarca" value="' + m + '"><span>' + esc(Saude.MARCA_TEXTO[m].replace('contém ', '')) + '</span></label>';
  }).join(''));

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
    document.querySelectorAll('input[name="manMarca"]').forEach(function (c) { c.checked = false; });
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
    (r.marcas || []).forEach(function (m) {
      var c = document.querySelector('input[name="manMarca"][value="' + m + '"]');
      if (c) c.checked = true;
    });
    avisouInconsistencia = false;
  }

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
      var alerg = r.marcas && r.marcas.length ? ' Marquei pelo rótulo: ' + r.marcas.map(function (m) { return Saude.MARCA_TEXTO[m].replace('contém ', ''); }).join(', ') + '.' : '';
      if (r.achou < 3) status('Li só ' + r.achou + ' de 5 valores. Tente uma foto de frente, com boa luz e a tabela inteira, ou complete abaixo.' + alerg, 'erro');
      else status('Pronto: li ' + r.achou + ' de 5 valores. Confira antes de usar.' + (r.avisos.length ? ' ' + r.avisos.join(' ') : '') + alerg, 'ok');
    } catch (e) {
      status(e && e.message ? e.message : 'Não consegui ler essa imagem.', 'erro');
    } finally {
      campo.value = '';
    }
  });

  async function buscarCodigo() {
    var cod = $('manCodigo').value.replace(/\D/g, '');
    if (cod.length < 8) { status('Digite o código de barras completo (8 a 14 números).', 'erro'); return; }
    status('Buscando o produto…');
    try {
      var a = await Api.porCodigo(cod);
      if (!a) { status('Não achei esse código, ou o cadastro dele está incompleto. Tire foto da tabela ou digite.', 'erro'); return; }
      $('manNome').value = a.nome + (a.marca ? ' (' + a.marca + ')' : '');
      preencherManual({ base: '100', porcaoG: a.porcao !== 100 ? a.porcao : null,
        kcal: a.kcal, prot: a.prot, carb: a.carb, gord: a.gord, fibra: a.fibra, marcas: a.marcas });
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
      return erro('As calorias (' + n0(v.kcal) + ') não batem com os macros (dariam ~' + n0(esperado) + '). Corrija, ou clique em "Usar este alimento" de novo para manter.');
    }
    caixa.hidden = true;

    var marcas = Array.prototype.map.call(document.querySelectorAll('input[name="manMarca"]:checked'), function (c) { return c.value; });
    if (marcas.indexOf('carne') !== -1) marcas.push('animal');
    var a = {
      id: 'meu-' + Date.now().toString(36), origem: 'meu', nome: nome, marca: '',
      kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, fibra: v.fibra,
      porcao: base === 'porcao' ? porc : 100,
      unidade: base === 'porcao' ? '1 porção (' + n0(porc) + ' g)' : '100 g',
      marcas: marcas
    };
    var av = Saude.avaliar(a, regras);
    if (av.bloqueio && !window.confirm('Esse alimento não combina com o seu perfil de saúde (' + av.bloqueio + '). Usar mesmo assim?')) return;
    if ($('manSalvar').checked) { estado.meus.unshift(a); salvar(); desenharMeus(); }
    abrirAdd(a);
  });

  /* ---------- meus alimentos ---------- */
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

  /* =================== exemplo (demonstração) =================== */
  var EXEMPLO_PERFIL = { sexo: 'm', idade: 30, peso: 80, altura: 180, atividade: 'moderado', objetivo: 'perder', pesoAlvo: 75,
    saude: { condicoes: ['hipertensao'], alergias: ['crustaceo'], dieta: 'nenhuma' } };
  var EXEMPLO_DIAS = [
    [['Ovo cozido', 100, 'cafe'], ['Pão francês', 50, 'cafe'], ['Banana prata', 70, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Feijão carioca cozido', 120, 'almoco'], ['Peito de frango grelhado', 160, 'almoco'], ['Iogurte natural integral', 170, 'lanche'], ['Tilápia grelhada', 150, 'jantar'], ['Batata-doce cozida', 150, 'jantar'], ['Brócolis cozido', 80, 'jantar']],
    [['Aveia em flocos', 40, 'cafe'], ['Leite integral', 200, 'cafe'], ['Banana prata', 70, 'cafe'], ['Arroz branco cozido', 180, 'almoco'], ['Feijão preto cozido', 100, 'almoco'], ['Patinho grelhado', 140, 'almoco'], ['Maçã', 130, 'lanche'], ['Ovo cozido', 100, 'jantar'], ['Macarrão cozido', 200, 'jantar']],
    [['Pão francês', 100, 'cafe'], ['Queijo mussarela', 40, 'cafe'], ['Café sem açúcar', 50, 'cafe'], ['Arroz branco cozido', 200, 'almoco'], ['Alcatra grelhada', 150, 'almoco'], ['Batata inglesa cozida', 130, 'almoco'], ['Chocolate ao leite', 50, 'lanche'], ['Pasta de amendoim', 30, 'lanche'], ['Pão de forma integral', 50, 'jantar'], ['Ovo frito', 100, 'jantar']],
    [['Ovo cozido', 100, 'cafe'], ['Mamão papaia', 170, 'cafe'], ['Arroz integral cozido', 150, 'almoco'], ['Lentilha cozida', 100, 'almoco'], ['Peito de frango grelhado', 150, 'almoco'], ['Iogurte natural integral', 170, 'lanche'], ['Castanha-do-pará', 15, 'lanche'], ['Salmão grelhado', 130, 'jantar'], ['Couve refogada', 50, 'jantar']],
    [['Pão francês', 50, 'cafe'], ['Requeijão cremoso', 30, 'cafe'], ['Laranja', 180, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Feijão carioca cozido', 120, 'almoco'], ['Carne moída refogada', 100, 'almoco'], ['Banana prata', 70, 'lanche'], ['Macarrão cozido', 150, 'jantar'], ['Queijo mussarela', 30, 'jantar']],
    [['Aveia em flocos', 40, 'cafe'], ['Morango', 100, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Peito de frango grelhado', 160, 'almoco'], ['Mandioca cozida', 100, 'almoco'], ['Maçã', 130, 'lanche'], ['Ovo cozido', 100, 'jantar'], ['Abacate', 60, 'jantar']],
    [['Ovo cozido', 100, 'cafe'], ['Pão francês', 50, 'cafe'], ['Banana prata', 70, 'cafe'], ['Arroz branco cozido', 150, 'almoco'], ['Feijão carioca cozido', 120, 'almoco'], ['Peito de frango grelhado', 140, 'almoco']]
  ];

  function carregarExemplo() {
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
    estado = limparEstado({ conta: { nome: 'Visitante', criada: new Date().toISOString() }, perfil: EXEMPLO_PERFIL, diario: diario, meus: [] });
    salvar();
    abrirPainel();
    toast('Demonstração carregada: perfil com hipertensão e alergia a frutos do mar. Busque "camarão" ou "bacon" para ver o filtro.');
  }

  /* =================== backup =================== */
  $('baixarBackup').addEventListener('click', function () {
    $('menu').open = false;
    var corpo = JSON.stringify({ app: 'prato-certo', versao: 2, exportado: new Date().toISOString(),
      conta: estado.conta, perfil: estado.perfil, diario: estado.diario, meus: estado.meus }, null, 2);
    var url = URL.createObjectURL(new Blob([corpo], { type: 'application/json' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'prato-certo-backup-' + HOJE + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('Backup baixado. Use "Tenho um backup" em outro aparelho para continuar de onde parou.');
  });

  function restaurar(campo) {
    var arq = campo.files && campo.files[0];
    if (!arq) return;
    function fim(msg) { toast(msg); campo.value = ''; }
    if (arq.size > 3 * 1024 * 1024) return fim('Arquivo grande demais para ser um backup do Prato Certo.');
    var leitor = new FileReader();
    leitor.onerror = function () { fim('Não consegui ler esse arquivo.'); };
    leitor.onload = function () {
      var dados;
      try { dados = JSON.parse(leitor.result); } catch (e) { return fim('Esse arquivo não é um backup válido.'); }
      if (!dados || dados.app !== 'prato-certo') return fim('Esse arquivo não parece ser um backup do Prato Certo.');
      var novo = limparEstado(dados);
      if (!novo.perfil && !Object.keys(novo.diario).length && !novo.meus.length) return fim('O backup está vazio ou com dados inválidos.');
      var tem = estado.perfil || Object.keys(estado.diario).length || estado.meus.length;
      if (tem && !window.confirm('Isso substitui os dados atuais deste navegador pelos do backup. Continuar?')) return fim('Restauração cancelada.');
      estado = novo;
      salvar();
      if (estado.perfil) abrirPainel(); else iniciarQuest(false);
      fim('Backup restaurado: ' + Object.keys(estado.diario).length + ' dias e ' + estado.meus.length + ' alimentos seus.');
    };
    leitor.readAsText(arq);
  }
  $('restaurarBackup').addEventListener('change', function () { $('menu').open = false; restaurar(this); });
  $('restaurarBackupEntrada').addEventListener('change', function () { restaurar(this); });

  /* =================== aviso e apagar =================== */
  function mostrarAviso() {
    if (lerCookie(COOKIE_AVISO)) return;
    $('aviso').hidden = false;
    $('avisoOk').addEventListener('click', function () {
      gravarCookie(COOKIE_AVISO, '1', 365);
      $('aviso').hidden = true;
    });
  }

  $('apagar').addEventListener('click', function () {
    $('menu').open = false;
    if (!window.confirm('Apagar sua conta, suas respostas, seu diário e seus alimentos deste navegador? Não dá para desfazer (a não ser que você tenha um backup).')) return;
    try { localStorage.removeItem(CHAVE); } catch (e) { /* ok */ }
    apagarCookie(COOKIE_PERFIL);
    window.location.reload();
  });

  /* =================== início =================== */
  REFEICOES.forEach(function (x) { $('addRefeicao').insertAdjacentHTML('beforeend', '<option value="' + x.id + '">' + x.nome + '</option>'); });
  carregar();
  if (estado.perfil) abrirPainel();
  else if (estado.conta) iniciarQuest(false);
  else mostrarTela('telaConta');
  mostrarAviso();
})();
