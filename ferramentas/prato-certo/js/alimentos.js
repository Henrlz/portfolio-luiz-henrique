/* Base local de alimentos do dia a dia, valores por 100 g.
   Fonte de referência: TACO (Tabela Brasileira de Composição de Alimentos),
   arredondados; alguns itens (salmão, atum, grão-de-bico) vêm do USDA.
   Servem para a busca responder na hora e funcionar sem internet; o que não
   estiver aqui vai para a base Open Food Facts (produtos de mercado).
   p = porção típica em gramas, u = como a pessoa fala essa porção.
   Formato: [nome, kcal, prot, carb, gord, fibra, p, u] */
var Alimentos = (function () {
  'use strict';

  var LISTA = [
    /* cereais e massas */
    ['Arroz branco cozido', 128, 2.5, 28.1, 0.2, 1.6, 100, '1 escumadeira rasa'],
    ['Arroz integral cozido', 124, 2.6, 25.8, 1.0, 2.7, 100, '1 escumadeira rasa'],
    ['Macarrão cozido', 102, 3.4, 19.9, 0.5, 1.3, 110, '1 pegador'],
    ['Aveia em flocos', 394, 13.9, 66.6, 8.5, 9.1, 30, '3 colheres de sopa'],
    ['Pão francês', 300, 8.0, 58.6, 3.1, 2.3, 50, '1 unidade'],
    ['Pão de forma integral', 253, 9.4, 49.9, 3.7, 6.9, 25, '1 fatia'],
    ['Cuscuz de milho cozido', 113, 2.2, 25.3, 0.7, 2.1, 120, '1 fatia'],
    /* leguminosas */
    ['Feijão carioca cozido', 76, 4.8, 13.6, 0.5, 8.5, 100, '1 concha'],
    ['Feijão preto cozido', 77, 4.5, 14.0, 0.5, 8.4, 100, '1 concha'],
    ['Lentilha cozida', 93, 6.3, 16.3, 0.5, 7.9, 100, '1 concha'],
    ['Grão-de-bico cozido', 164, 8.9, 27.4, 2.6, 7.6, 100, '1 concha'],
    /* carnes, aves, peixes, ovos */
    ['Peito de frango grelhado', 159, 32.0, 0, 2.5, 0, 120, '1 filé médio'],
    ['Coxa de frango cozida sem pele', 167, 26.9, 0, 5.8, 0, 90, '1 coxa'],
    ['Patinho grelhado', 219, 35.9, 0, 7.3, 0, 100, '1 bife médio'],
    ['Alcatra grelhada', 241, 31.9, 0, 11.5, 0, 100, '1 bife médio'],
    ['Carne moída refogada', 212, 26.7, 0, 10.9, 0, 80, '3 colheres de sopa'],
    ['Ovo cozido', 146, 13.3, 0.6, 9.5, 0, 50, '1 unidade'],
    ['Ovo frito', 240, 15.6, 1.2, 18.6, 0, 50, '1 unidade'],
    ['Tilápia grelhada', 128, 26.2, 0, 2.7, 0, 120, '1 filé'],
    ['Salmão grelhado', 206, 22.1, 0, 12.4, 0, 120, '1 posta'],
    ['Atum em lata (natural)', 116, 25.5, 0, 0.8, 0, 80, '1/2 lata'],
    ['Presunto fatiado', 129, 14.3, 1.4, 7.4, 0, 30, '2 fatias'],
    /* tubérculos */
    ['Batata inglesa cozida', 52, 1.2, 11.9, 0, 1.3, 130, '1 batata média'],
    ['Batata-doce cozida', 77, 0.6, 18.4, 0.1, 2.2, 130, '1 batata média'],
    ['Mandioca cozida', 125, 0.6, 30.1, 0.3, 1.6, 100, '1 pedaço'],
    /* frutas */
    ['Banana prata', 98, 1.3, 26.0, 0.1, 2.0, 70, '1 unidade'],
    ['Maçã', 56, 0.3, 15.2, 0, 1.3, 130, '1 unidade'],
    ['Laranja', 37, 1.0, 8.9, 0.1, 0.8, 180, '1 unidade'],
    ['Mamão papaia', 40, 0.5, 10.4, 0.1, 1.0, 170, '1/2 mamão'],
    ['Manga', 64, 0.4, 16.7, 0.3, 1.6, 140, '1 fatia grande'],
    ['Uva', 53, 0.7, 13.6, 0.2, 0.9, 100, '1 cacho pequeno'],
    ['Morango', 30, 0.9, 6.8, 0.3, 1.7, 100, '6 unidades'],
    ['Melancia', 33, 0.9, 8.1, 0, 0.1, 200, '1 fatia'],
    ['Abacaxi', 48, 0.9, 12.3, 0.1, 1.0, 120, '2 fatias'],
    ['Abacate', 96, 1.2, 6.0, 8.4, 6.3, 100, '4 colheres de sopa'],
    /* verduras e legumes */
    ['Alface', 11, 1.3, 1.7, 0.2, 1.8, 30, '1 prato de sobremesa'],
    ['Tomate', 15, 1.1, 3.1, 0.2, 1.2, 80, '1/2 tomate'],
    ['Cenoura crua', 34, 1.3, 7.7, 0.2, 3.2, 60, '1/2 cenoura'],
    ['Pepino', 10, 0.9, 2.0, 0.1, 1.1, 60, '1/2 pepino'],
    ['Brócolis cozido', 25, 2.1, 4.4, 0.5, 3.4, 80, '1 ramo'],
    ['Couve refogada', 90, 1.7, 8.7, 6.6, 5.7, 50, '1 escumadeira'],
    /* laticínios */
    ['Leite integral', 61, 3.2, 4.7, 3.3, 0, 200, '1 copo'],
    ['Leite desnatado', 35, 3.4, 4.9, 0.1, 0, 200, '1 copo'],
    ['Iogurte natural integral', 51, 4.1, 1.9, 3.0, 0, 170, '1 pote'],
    ['Queijo mussarela', 330, 22.6, 3.0, 25.2, 0, 20, '1 fatia'],
    ['Queijo minas frescal', 264, 17.4, 3.2, 20.2, 0, 30, '1 fatia'],
    ['Requeijão cremoso', 257, 9.6, 2.4, 23.4, 0, 30, '1 colher de sopa cheia'],
    /* gorduras, oleaginosas, doces */
    ['Manteiga', 726, 0.4, 0.1, 82.4, 0, 10, '1 colher de sobremesa'],
    ['Azeite de oliva', 884, 0, 0, 100, 0, 13, '1 colher de sopa'],
    ['Pasta de amendoim', 588, 25.0, 20.0, 50.0, 6.0, 15, '1 colher de sopa'],
    ['Castanha-do-pará', 643, 14.5, 15.1, 63.5, 7.9, 15, '3 unidades'],
    ['Amendoim torrado', 585, 23.0, 21.0, 50.0, 8.0, 30, '1 punhado'],
    ['Açúcar refinado', 387, 0.3, 99.5, 0, 0, 10, '1 colher de sobremesa'],
    ['Mel', 309, 0.4, 84.0, 0, 0, 20, '1 colher de sopa'],
    ['Chocolate ao leite', 540, 7.2, 59.4, 30.3, 2.2, 25, '3 quadradinhos'],
    ['Café sem açúcar', 1, 0.1, 0.0, 0, 0, 50, '1 xícara de cafezinho'],

    /* ovos */
    ['Ovo cru (inteiro)', 143, 13.0, 1.6, 8.9, 0, 50, '1 unidade'],
    ['Clara de ovo cozida', 52, 10.9, 0.7, 0.2, 0, 33, '1 clara'],
    ['Gema de ovo cozida', 355, 15.9, 1.6, 31.9, 0, 17, '1 gema'],
    ['Ovo de codorna cozido', 158, 13.0, 0.4, 11.1, 0, 10, '1 unidade'],
    /* frutas */
    ['Banana nanica', 92, 1.4, 23.8, 0.1, 1.9, 90, '1 unidade'],
    ['Pera', 57, 0.4, 15.2, 0.1, 3.1, 150, '1 unidade'],
    ['Kiwi', 51, 1.3, 11.5, 0.6, 2.7, 70, '1 unidade'],
    ['Melão', 29, 0.7, 7.5, 0, 0.3, 150, '1 fatia'],
    ['Goiaba vermelha', 54, 1.1, 13.0, 0.4, 6.2, 100, '1 unidade pequena'],
    ['Maracujá (polpa)', 68, 2.0, 12.3, 2.1, 1.1, 50, '1/2 maracujá'],
    ['Tangerina (mexerica)', 38, 0.8, 9.6, 0.1, 0.9, 130, '1 unidade'],
    ['Mamão formosa', 45, 0.8, 11.6, 0.1, 1.8, 170, '1 fatia'],
    ['Açaí (polpa sem açúcar)', 58, 0.8, 6.2, 3.9, 2.6, 100, '1 pacote pequeno'],
    ['Uva-passa', 299, 3.1, 79.2, 0.5, 3.7, 20, '1 punhado'],
    ['Tâmara', 282, 2.5, 75.0, 0.4, 8.0, 24, '3 unidades'],
    /* verduras e legumes */
    ['Abobrinha cozida', 15, 1.1, 3.0, 0.2, 1.4, 80, '3 colheres de sopa'],
    ['Beterraba cozida', 32, 1.3, 7.2, 0.1, 1.9, 60, '3 fatias'],
    ['Chuchu cozido', 19, 0.4, 4.8, 0, 1.0, 80, '3 colheres de sopa'],
    ['Couve-flor cozida', 23, 1.9, 4.5, 0.2, 2.1, 80, '1 ramo'],
    ['Espinafre cozido', 23, 3.0, 3.8, 0.3, 2.4, 60, '3 colheres de sopa'],
    ['Cebola crua', 39, 1.7, 8.9, 0.1, 2.2, 30, '3 rodelas'],
    ['Milho verde cozido', 96, 3.4, 21.0, 1.5, 2.4, 80, '1 espiga pequena'],
    ['Repolho cru', 17, 0.9, 3.9, 0.1, 1.9, 40, '1 prato de sobremesa'],
    /* cereais, farinhas, salgados */
    ['Tapioca (goma hidratada)', 240, 0, 60.0, 0, 0, 50, '1 tapioca pequena'],
    ['Pão de queijo', 363, 5.1, 34.2, 24.6, 0.6, 30, '1 unidade'],
    ['Farinha de mandioca', 361, 1.6, 87.9, 0.3, 6.4, 20, '1 colher de sopa cheia'],
    ['Biscoito cream cracker', 432, 10.1, 68.7, 14.4, 2.5, 18, '3 biscoitos'],
    /* proteínas */
    ['Sardinha em lata', 208, 24.6, 0, 11.5, 0, 60, '1/2 lata'],
    ['Camarão cozido', 99, 24.0, 0.2, 0.3, 0, 80, '8 unidades'],
    ['Bacon frito', 541, 37.0, 1.4, 42.0, 0, 15, '2 fatias'],
    ['Tofu', 76, 8.1, 1.9, 4.8, 0.3, 100, '1 fatia grande'],
    /* laticínios */
    ['Iogurte grego natural', 97, 9.0, 3.9, 5.0, 0, 170, '1 pote'],
    ['Queijo parmesão ralado', 431, 38.0, 4.1, 29.0, 0, 10, '1 colher de sopa'],
    ['Ricota', 140, 12.6, 3.8, 8.1, 0, 40, '1 fatia'],
    ['Cream cheese', 342, 6.0, 4.0, 34.0, 0, 20, '1 colher de sopa'],
    /* oleaginosas e sementes */
    ['Amêndoa', 579, 21.2, 21.6, 49.9, 12.5, 20, '1 punhado'],
    ['Noz', 654, 15.2, 13.7, 65.2, 6.7, 20, '3 unidades'],
    ['Castanha de caju', 553, 18.2, 30.2, 43.9, 3.3, 20, '1 punhado'],
    ['Chia', 486, 16.5, 42.1, 30.7, 34.4, 10, '1 colher de sopa'],
    ['Linhaça', 534, 18.3, 28.9, 42.2, 27.3, 10, '1 colher de sopa'],
    /* bebidas (por 100 ml, 1 ml ≈ 1 g) */
    ['Suco de laranja natural', 45, 0.7, 10.4, 0.2, 0.2, 200, '1 copo'],
    ['Refrigerante de cola', 42, 0, 10.6, 0, 0, 350, '1 lata'],
    ['Cerveja', 43, 0.5, 3.6, 0, 0, 350, '1 lata'],
    ['Água de coco', 22, 0, 5.3, 0, 0, 200, '1 copo'],
    /* fast food genérico */
    ['Batata frita (tipo fast food)', 312, 3.4, 41.0, 15.0, 3.8, 110, '1 porção média']
  ].map(function (a, i) {
    return {
      id: 'taco-' + i, origem: 'base', nome: a[0],
      kcal: a[1], prot: a[2], carb: a[3], gord: a[4], fibra: a[5],
      porcao: a[6], unidade: a[7], marca: ''
    };
  });

  /* Redes de fast food. ATENÇÃO: não achei tabela oficial brasileira acessível;
     estes são valores APROXIMADOS por unidade vendida, tirados de bases públicas
     de terceiros (variam de uma fonte para outra) e do cardápio dos EUA.
     Servem de estimativa. Para o número exato, cadastre o item pela foto da
     tabela nutricional (Meus alimentos).
     Formato: [rede, item, kcal, prot, carb, gord, gramas da unidade] — por unidade. */
  var REDES = [
    ["McDonald's", 'Big Mac', 563, 25.9, 44.0, 32.8, 215],
    ["McDonald's", 'Cheeseburger', 300, 15.0, 32.0, 13.0, 115],
    ["McDonald's", 'McNuggets (10 unidades)', 410, 23.0, 26.0, 25.0, 162],
    ["McDonald's", 'Batata frita média', 320, 5.0, 43.0, 15.0, 111],
    ['Burger King', 'Whopper', 677, 31.0, 51.0, 40.0, 361],
    ['Pizza Hut', 'Pizza de brigadeiro (1 fatia)', 198, 4.0, 34.0, 4.0, 68],
    ['Subway', 'Sanduíche de peru 15 cm', 280, 18.0, 46.0, 3.5, 220]
  ].map(function (r, i) {
    var k = 100 / r[6];
    return {
      id: 'rede-' + i, origem: 'rede', nome: r[1], marca: r[0],
      kcal: r[2] * k, prot: r[3] * k, carb: r[4] * k, gord: r[5] * k, fibra: 0,
      porcao: r[6], unidade: '1 unidade (' + r[6] + ' g)'
    };
  });
  REDES.forEach(function (a) { LISTA.push(a); });

  /* marcas para o filtro de saúde (ver saude.js). "acucar" e "sodio" só onde o
     alimento passa do limite da lupa da ANVISA por 100 g/100 ml. */
  var MARCAS = {
    'Macarrão cozido': ['gluten'], 'Aveia em flocos': ['gluten'], 'Pão francês': ['gluten'],
    'Pão de forma integral': ['gluten'], 'Biscoito cream cracker': ['gluten', 'sodio'],
    'Peito de frango grelhado': ['carne'], 'Coxa de frango cozida sem pele': ['carne'], 'Patinho grelhado': ['carne'],
    'Alcatra grelhada': ['carne'], 'Carne moída refogada': ['carne'], 'Presunto fatiado': ['carne', 'sodio'],
    'Bacon frito': ['carne', 'sodio'],
    'Ovo cozido': ['ovo'], 'Ovo frito': ['ovo'], 'Ovo cru (inteiro)': ['ovo'], 'Clara de ovo cozida': ['ovo'],
    'Gema de ovo cozida': ['ovo'], 'Ovo de codorna cozido': ['ovo'],
    'Tilápia grelhada': ['peixe'], 'Salmão grelhado': ['peixe'], 'Atum em lata (natural)': ['peixe'],
    'Sardinha em lata': ['peixe'], 'Camarão cozido': ['crustaceo'],
    'Leite integral': ['leite'], 'Leite desnatado': ['leite'], 'Iogurte natural integral': ['leite'],
    'Iogurte grego natural': ['leite'], 'Queijo mussarela': ['leite'], 'Queijo minas frescal': ['leite'],
    'Requeijão cremoso': ['leite'], 'Queijo parmesão ralado': ['leite', 'sodio'], 'Ricota': ['leite'],
    'Cream cheese': ['leite'], 'Manteiga': ['leite'], 'Pão de queijo': ['leite', 'ovo'],
    'Chocolate ao leite': ['leite', 'acucar'],
    'Pasta de amendoim': ['amendoim'], 'Amendoim torrado': ['amendoim'],
    'Castanha-do-pará': ['castanhas'], 'Amêndoa': ['castanhas'], 'Noz': ['castanhas'], 'Castanha de caju': ['castanhas'],
    'Tofu': ['soja'], 'Mel': ['animal', 'acucar'], 'Açúcar refinado': ['acucar'],
    'Uva-passa': ['acucar'], 'Tâmara': ['acucar'], 'Refrigerante de cola': ['acucar'], 'Cerveja': ['alcool'],
    /* redes: receitas padrão (pão de trigo, queijo, carne, maionese com ovo) */
    'Big Mac': ['gluten', 'leite', 'carne', 'ovo'], 'Cheeseburger': ['gluten', 'leite', 'carne'],
    'McNuggets (10 unidades)': ['gluten', 'carne'], 'Whopper': ['gluten', 'carne', 'ovo'],
    'Pizza de brigadeiro (1 fatia)': ['gluten', 'leite', 'acucar'], 'Sanduíche de peru 15 cm': ['gluten', 'carne']
  };
  LISTA.forEach(function (a) { a.marcas = MARCAS[a.nome] || []; });

  /* miniaturas: Fluent Emoji 3D (Microsoft, licença MIT), num commit fixo do
     repositório servido pelo jsDelivr. Sem ícone fiel, usa o prato genérico. */
  var EMOJI_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets/';
  var GENERICO = 'Fork and knife with plate';
  var ICONES = {
    'Cooked rice': ['Arroz branco cozido', 'Arroz integral cozido'],
    'Spaghetti': ['Macarrão cozido'],
    'Bowl with spoon': ['Aveia em flocos', 'Açaí (polpa sem açúcar)', 'Iogurte natural integral', 'Iogurte grego natural'],
    'Baguette bread': ['Pão francês'],
    'Bread': ['Pão de forma integral', 'Pão de queijo'],
    'Ear of corn': ['Cuscuz de milho cozido', 'Milho verde cozido'],
    'Beans': ['Feijão carioca cozido', 'Feijão preto cozido', 'Lentilha cozida', 'Grão-de-bico cozido'],
    'Poultry leg': ['Peito de frango grelhado', 'Coxa de frango cozida sem pele', 'McNuggets (10 unidades)'],
    'Cut of meat': ['Patinho grelhado', 'Alcatra grelhada', 'Carne moída refogada'],
    'Egg': ['Ovo cozido', 'Ovo cru (inteiro)', 'Clara de ovo cozida', 'Gema de ovo cozida', 'Ovo de codorna cozido'],
    'Cooking': ['Ovo frito'],
    'Fish': ['Tilápia grelhada', 'Salmão grelhado'],
    'Canned food': ['Atum em lata (natural)', 'Sardinha em lata'],
    'Bacon': ['Presunto fatiado', 'Bacon frito'],
    'Potato': ['Batata inglesa cozida', 'Mandioca cozida'],
    'Roasted sweet potato': ['Batata-doce cozida'],
    'Banana': ['Banana prata', 'Banana nanica'],
    'Red apple': ['Maçã'],
    'Tangerine': ['Laranja', 'Tangerina (mexerica)'],
    'Mango': ['Manga'],
    'Grapes': ['Uva', 'Uva-passa'],
    'Strawberry': ['Morango'],
    'Watermelon': ['Melancia'],
    'Pineapple': ['Abacaxi'],
    'Avocado': ['Abacate'],
    'Pear': ['Pera'],
    'Kiwi fruit': ['Kiwi'],
    'Melon': ['Melão'],
    'Leafy green': ['Alface', 'Couve refogada', 'Espinafre cozido', 'Repolho cru'],
    'Tomato': ['Tomate'],
    'Carrot': ['Cenoura crua'],
    'Cucumber': ['Pepino', 'Abobrinha cozida', 'Chuchu cozido'],
    'Broccoli': ['Brócolis cozido', 'Couve-flor cozida'],
    'Onion': ['Cebola crua'],
    'Glass of milk': ['Leite integral', 'Leite desnatado'],
    'Cheese wedge': ['Queijo mussarela', 'Queijo minas frescal', 'Requeijão cremoso', 'Queijo parmesão ralado', 'Ricota', 'Cream cheese'],
    'Butter': ['Manteiga'],
    'Olive': ['Azeite de oliva'],
    'Peanuts': ['Pasta de amendoim', 'Amendoim torrado'],
    'Chestnut': ['Castanha-do-pará', 'Amêndoa', 'Noz', 'Castanha de caju'],
    'Seedling': ['Chia', 'Linhaça'],
    'Honey pot': ['Mel'],
    'Chocolate bar': ['Chocolate ao leite'],
    'Hot beverage': ['Café sem açúcar'],
    'Tropical drink': ['Suco de laranja natural'],
    'Cup with straw': ['Refrigerante de cola'],
    'Beer mug': ['Cerveja'],
    'Coconut': ['Água de coco'],
    'Flatbread': ['Tapioca (goma hidratada)'],
    'Cookie': ['Biscoito cream cracker'],
    'Fried shrimp': ['Camarão cozido'],
    'French fries': ['Batata frita (tipo fast food)', 'Batata frita média'],
    'Hamburger': ['Big Mac', 'Cheeseburger', 'Whopper'],
    'Pizza': ['Pizza de brigadeiro (1 fatia)'],
    'Sandwich': ['Sanduíche de peru 15 cm']
  };
  var ICONE_DE = {};
  Object.keys(ICONES).forEach(function (emoji) { ICONES[emoji].forEach(function (nome) { ICONE_DE[nome] = emoji; }); });

  function urlEmoji(emoji) {
    return EMOJI_BASE + encodeURIComponent(emoji) + '/3D/' + emoji.toLowerCase().replace(/ /g, '_') + '_3d.png';
  }
  /* ícone de um alimento pelo nome (base local); o genérico para o resto */
  function icone(nome) { return urlEmoji(ICONE_DE[nome] || GENERICO); }
  var ICONE_GENERICO = urlEmoji(GENERICO);
  LISTA.forEach(function (a) { a.img = icone(a.nome); });

  /* tira acento e caixa: "Pão" casa com "pao" */
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function textoDe(a) { return norm(a.nome + ' ' + (a.marca || '')).replace(/'/g, ''); }
  LISTA.forEach(function (a) { a._n = textoDe(a); });

  /* todas as palavras da busca precisam aparecer (nome ou marca); quem começa com a
     busca vem antes. "extras" são os alimentos que a própria pessoa cadastrou. */
  function buscar(q, extras) {
    var palavras = norm(q).replace(/'/g, '').split(/\s+/).filter(Boolean);
    if (!palavras.length) return [];
    var todos = (extras || []).map(function (a) { a._n = textoDe(a); return a; }).concat(LISTA);
    var achados = todos.filter(function (a) {
      return palavras.every(function (w) { return a._n.indexOf(w) !== -1; });
    });
    var inicio = norm(q).trim();
    achados.sort(function (x, y) {
      var a = x._n.indexOf(inicio) === 0 ? 0 : 1;
      var b = y._n.indexOf(inicio) === 0 ? 0 : 1;
      return a - b || x.nome.length - y.nome.length;
    });
    return achados.slice(0, 10);
  }

  return { LISTA: LISTA, buscar: buscar, norm: norm, icone: icone, ICONE_GENERICO: ICONE_GENERICO };
})();
