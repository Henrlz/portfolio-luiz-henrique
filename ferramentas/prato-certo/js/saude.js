/* Perfil de saúde → o que esconder e o que sinalizar.
   Cada alimento tem "marcas" (tags): gluten, leite, ovo, amendoim, castanhas, peixe,
   crustaceo, soja, carne, animal, alcool, acucar, sodio.
   - Alergia, doença celíaca, intolerância e dieta: o alimento SOME da busca.
   - Diabetes e hipertensão: o alimento aparece com um AVISO (não cabe ao app proibir).
   Limites de "alto em" seguem a lupa frontal da ANVISA (RDC 429/2020):
   açúcar ≥ 15 g/100 g (sólidos) ou 7,5 g/100 ml (bebidas); sódio ≥ 600 mg/100 g. */
var Saude = (function () {
  'use strict';

  var CONDICOES = [
    { id: 'diabetes',    nome: 'Diabetes',               dica: 'Sinaliza alimentos com muito açúcar.' },
    { id: 'hipertensao', nome: 'Hipertensão',            dica: 'Sinaliza alimentos com muito sódio.' },
    { id: 'celiaca',     nome: 'Doença celíaca',         dica: 'Esconde alimentos com glúten.' },
    { id: 'lactose',     nome: 'Intolerância à lactose', dica: 'Esconde alimentos com leite.' },
    { id: 'gestante',    nome: 'Gestante ou amamentando', dica: 'Esconde bebida alcoólica e não aplica déficit calórico.', so: 'f' }
  ];

  var ALERGIAS = [
    { id: 'amendoim',  nome: 'Amendoim' },
    { id: 'castanhas', nome: 'Castanhas e nozes' },
    { id: 'ovo',       nome: 'Ovo' },
    { id: 'leite',     nome: 'Leite (proteína do leite)' },
    { id: 'gluten',    nome: 'Trigo / glúten' },
    { id: 'peixe',     nome: 'Peixe' },
    { id: 'crustaceo', nome: 'Crustáceos e frutos do mar' },
    { id: 'soja',      nome: 'Soja' }
  ];

  var DIETAS = [
    { id: 'nenhuma',     nome: 'Como de tudo',  dica: 'Sem restrição por escolha.' },
    { id: 'vegetariana', nome: 'Vegetariana',   dica: 'Sem carnes, aves, peixes e frutos do mar.' },
    { id: 'vegana',      nome: 'Vegana',        dica: 'Sem nenhum produto de origem animal.' }
  ];

  var MARCA_TEXTO = {
    gluten: 'contém glúten', leite: 'contém leite', ovo: 'contém ovo', amendoim: 'contém amendoim',
    castanhas: 'contém castanhas', peixe: 'contém peixe', crustaceo: 'contém frutos do mar', soja: 'contém soja',
    carne: 'contém carne', animal: 'origem animal', alcool: 'bebida alcoólica',
    acucar: 'muito açúcar', sodio: 'muito sódio'
  };

  function vazio() { return { condicoes: [], alergias: [], dieta: 'nenhuma' }; }

  function limpar(s) {
    var ok = function (lista, base) {
      return Array.isArray(lista) ? lista.filter(function (x, i) {
        return base.some(function (b) { return b.id === x; }) && lista.indexOf(x) === i;
      }) : [];
    };
    s = s && typeof s === 'object' ? s : {};
    return {
      condicoes: ok(s.condicoes, CONDICOES),
      alergias: ok(s.alergias, ALERGIAS),
      dieta: DIETAS.some(function (d) { return d.id === s.dieta; }) ? s.dieta : 'nenhuma'
    };
  }

  /* perfil → { esconde: {marca: motivo}, avisa: {marca: motivo} } */
  function regras(perfil) {
    var s = limpar(perfil && perfil.saude);
    var esconde = {}, avisa = {};
    function nomeDe(lista, id) { return lista.filter(function (x) { return x.id === id; })[0].nome; }

    s.alergias.forEach(function (a) { esconde[a] = 'alergia: ' + nomeDe(ALERGIAS, a).toLowerCase(); });
    if (s.condicoes.indexOf('celiaca') !== -1) esconde.gluten = 'doença celíaca';
    if (s.condicoes.indexOf('lactose') !== -1 && !esconde.leite) esconde.leite = 'intolerância à lactose';
    if (s.condicoes.indexOf('gestante') !== -1) esconde.alcool = 'gestação/amamentação';
    if (s.dieta === 'vegetariana' || s.dieta === 'vegana') {
      ['carne', 'peixe', 'crustaceo'].forEach(function (m) { if (!esconde[m]) esconde[m] = 'dieta ' + s.dieta; });
    }
    if (s.dieta === 'vegana') {
      ['leite', 'ovo', 'animal'].forEach(function (m) { if (!esconde[m]) esconde[m] = 'dieta vegana'; });
    }
    if (s.condicoes.indexOf('diabetes') !== -1) avisa.acucar = 'diabetes';
    if (s.condicoes.indexOf('hipertensao') !== -1) avisa.sodio = 'hipertensão';
    return { esconde: esconde, avisa: avisa, ativo: Object.keys(esconde).length + Object.keys(avisa).length > 0 };
  }

  /* um alimento contra as regras → { bloqueio: 'motivo' | null, avisos: ['muito açúcar (diabetes)'] } */
  function avaliar(alimento, r) {
    var marcas = alimento.marcas || [];
    var bloqueio = null, avisos = [];
    marcas.forEach(function (m) {
      if (!bloqueio && r.esconde[m]) bloqueio = MARCA_TEXTO[m] + ' · ' + r.esconde[m];
      if (r.avisa[m]) avisos.push(MARCA_TEXTO[m] + ' (' + r.avisa[m] + ')');
    });
    return { bloqueio: bloqueio, avisos: avisos };
  }

  /* resumo legível do que o perfil faz, para mostrar na tela */
  function resumo(perfil) {
    var r = regras(perfil);
    var esc = Object.keys(r.esconde).map(function (m) { return MARCA_TEXTO[m].replace('contém ', ''); });
    var av = Object.keys(r.avisa).map(function (m) { return MARCA_TEXTO[m]; });
    return { esconde: esc, avisa: av };
  }

  return {
    CONDICOES: CONDICOES, ALERGIAS: ALERGIAS, DIETAS: DIETAS, MARCA_TEXTO: MARCA_TEXTO,
    vazio: vazio, limpar: limpar, regras: regras, avaliar: avaliar, resumo: resumo
  };
})();
