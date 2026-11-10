/* Contas do Prato Certo — sem DOM, só números.

   TMB: equação de Mifflin-St Jeor (a mais usada hoje em dia em consultório).
     homem:  10·peso + 6,25·altura − 5·idade + 5
     mulher: 10·peso + 6,25·altura − 5·idade − 161
   Gasto diário (GET) = TMB × fator de atividade.
   A meta é o gasto ajustado pelo objetivo; macros saem em gramas.
   Isto é uma estimativa de partida, não prescrição: o corpo de cada pessoa
   foge da média. */
var Calculo = (function () {
  'use strict';

  var FATORES = {
    sedentario: { fator: 1.2,   nome: 'Sedentário',  dica: 'quase não treina' },
    leve:       { fator: 1.375, nome: 'Leve',        dica: '1 a 3 treinos/semana' },
    moderado:   { fator: 1.55,  nome: 'Moderado',    dica: '3 a 5 treinos/semana' },
    intenso:    { fator: 1.725, nome: 'Intenso',     dica: '6 a 7 treinos/semana' },
    atleta:     { fator: 1.9,   nome: 'Muito intenso', dica: 'treino pesado/braçal' }
  };

  /* ajuste sobre o gasto; proteína em g por kg de peso */
  var OBJETIVOS = {
    perderMais: { ajuste: -0.20, prot: 2.0, nome: 'Perder peso (ritmo firme)' },
    perder:     { ajuste: -0.10, prot: 1.8, nome: 'Perder peso (ritmo leve)' },
    manter:     { ajuste:  0.00, prot: 1.6, nome: 'Manter o peso' },
    ganhar:     { ajuste:  0.10, prot: 1.8, nome: 'Ganhar massa' }
  };

  var KCAL_POR_KG = 7700;   /* aproximação clássica de 1 kg de gordura corporal */

  function tmb(p) {
    var base = 10 * p.peso + 6.25 * p.altura - 5 * p.idade;
    return p.sexo === 'm' ? base + 5 : base - 161;
  }

  /* devolve null se o perfil estiver incompleto ou fora de faixa */
  function validar(p) {
    if (!p) return 'Preencha seus dados.';
    if (!(p.idade >= 14 && p.idade <= 100)) return 'Idade entre 14 e 100 anos.';
    if (!(p.peso >= 30 && p.peso <= 300)) return 'Peso entre 30 e 300 kg.';
    if (!(p.altura >= 120 && p.altura <= 230)) return 'Altura entre 120 e 230 cm.';
    if (p.pesoAlvo != null && !(p.pesoAlvo >= 30 && p.pesoAlvo <= 300)) return 'Peso alvo entre 30 e 300 kg.';
    return null;
  }

  function metas(p) {
    var f = FATORES[p.atividade] || FATORES.leve;
    var o = OBJETIVOS[p.objetivo] || OBJETIVOS.manter;
    var base = tmb(p);
    var gasto = base * f.fator;

    /* gestação/amamentação: sem déficit calórico (só com acompanhamento profissional) */
    var gestante = !!(p.saude && Array.isArray(p.saude.condicoes) && p.saude.condicoes.indexOf('gestante') !== -1);
    var ajuste = gestante ? Math.max(o.ajuste, 0) : o.ajuste;
    var semDeficit = gestante && o.ajuste < 0;

    var kcal = gasto * (1 + ajuste);
    /* piso de segurança: nunca abaixo da TMB nem de 1200 kcal */
    var piso = Math.max(base, 1200);
    var limitada = kcal < piso;
    if (limitada) kcal = piso;
    kcal = Math.round(kcal / 10) * 10;

    var prot = Math.round(o.prot * p.peso);
    var gord = Math.round((kcal * 0.25) / 9);
    var carb = Math.round((kcal - prot * 4 - gord * 9) / 4);
    if (carb < 0) carb = 0;

    var saldo = gasto - kcal;                       /* >0: déficit por dia */
    var kgSemana = (saldo * 7) / KCAL_POR_KG;       /* >0: perde, <0: ganha */

    var prazo = null;
    if (p.pesoAlvo != null && p.pesoAlvo !== p.peso && Math.abs(kgSemana) > 0.01) {
      var falta = p.peso - p.pesoAlvo;              /* >0: precisa perder */
      if (falta * kgSemana > 0) {
        var semanas = Math.ceil(Math.abs(falta / kgSemana));
        prazo = { semanas: semanas, dias: semanas * 7, kg: Math.abs(falta) };
      } else {
        prazo = { incoerente: true };
      }
    }

    return {
      tmb: Math.round(base),
      gasto: Math.round(gasto),
      kcal: kcal,
      prot: prot,
      carb: carb,
      gord: gord,
      fibra: Math.round((kcal / 1000) * 14),
      agua: Math.round((p.peso * 35) / 100) / 10,   /* litros */
      kgSemana: Math.round(kgSemana * 100) / 100,
      limitada: limitada,
      semDeficit: semDeficit,
      prazo: prazo,
      imc: Math.round((p.peso / Math.pow(p.altura / 100, 2)) * 10) / 10
    };
  }

  /* itens do diário → totais do dia */
  function somar(itens) {
    var t = { kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0 };
    (itens || []).forEach(function (i) {
      t.kcal += i.kcal; t.prot += i.prot; t.carb += i.carb; t.gord += i.gord; t.fibra += i.fibra || 0;
    });
    return t;
  }

  /* valores por 100 g × quantidade em g */
  function porcao(alimento, gramas) {
    var k = gramas / 100;
    return {
      kcal: alimento.kcal * k,
      prot: alimento.prot * k,
      carb: alimento.carb * k,
      gord: alimento.gord * k,
      fibra: (alimento.fibra || 0) * k
    };
  }

  return {
    FATORES: FATORES, OBJETIVOS: OBJETIVOS,
    tmb: tmb, validar: validar, metas: metas, somar: somar, porcao: porcao
  };
})();
