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

  /* Redes de fast food — valores POR UNIDADE VENDIDA.
     McDonald's: tabela do site oficial brasileiro (cópias de jan–set/2026 no Web Archive;
       o site quase nunca informa o peso, então esses itens contam por unidade).
     Burger King: PDF oficial "Tabela Nutricional Geral" (bk-media.burgerking.com.br, revisão jan/2024).
     Demais redes: bases de terceiros (FatSecret Brasil), marcadas como aproximadas.
     Todos conferidos: kcal ≈ 4·prot + 4·carb + 9·gord (até 15%).
     Formato: [rede, item, gramas (0 = não informado), kcal, prot, carb, gord, fibra, sódio mg,
               'o' oficial | 't' terceiros, alérgenos/composição] */
  var REDES_DADOS = [
    ["McDonald's", 'Big Mac', 0, 524, 26, 43, 27, 1.9, 928, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Quarterão com Queijo', 0, 566, 32, 39, 31, 2.8, 1052, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Duplo Quarterão', 0, 836, 52, 39, 52, 3.2, 1257, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McNífico Bacon', 0, 595, 32, 40, 34, 4, 1101, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Cheeseburger', 0, 291, 15, 30, 12, 1.7, 647, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Hamburger', 101, 242, 13, 29, 8, 1.7, 469, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Duplo Cheeseburger', 0, 428, 25, 31, 22, 2, 963, 'o', 'gluten leite carne'],
    ["McDonald's", 'Cheddar McMelt', 0, 509, 29, 33, 29, 3.2, 906, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Duplo Cheddar McMelt', 0, 854, 52, 36, 56, 4.7, 1482, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Duplo Burger Bacon', 0, 441, 27, 35, 22, 2.6, 958, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Triplo Burger', 0, 549, 34, 36, 29, 3, 1152, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Tasty Turbo 1 carne', 0, 800, 36, 41, 55, 3.9, 851, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Tasty Turbo Bacon 1 carne', 0, 888, 43, 41, 61, 4, 1358, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McChicken', 0, 403, 17, 42, 18, 3, 712, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McChicken Bacon', 0, 409, 18, 42, 19, 2.9, 778, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McChicken Duplo', 0, 665, 31, 53, 36, 4.2, 1408, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Chicken Jr.', 171, 349, 12, 43, 15, 2.4, 739, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McCrispy Chicken Deluxe', 303, 593, 32, 53, 28, 4.8, 1125, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McCrispy Chicken Legend', 0, 900, 37, 65, 55, 4.3, 1636, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McCrispy Chicken Bacon Ranch', 0, 730, 35, 65, 37, 5.4, 1567, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Chicken Cheddar McMelt', 0, 391, 19, 41, 19, 3.4, 938, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'McFish', 0, 391, 17, 39, 19, 1.9, 819, 'o', 'gluten leite ovo soja peixe'],
    ["McDonald's", 'Chicken McNuggets 4 unidades', 64, 155, 9.1, 10, 8.6, 0.77, 300, 'o', 'gluten leite soja carne'],
    ["McDonald's", 'Chicken McNuggets 6 unidades', 0, 232, 14, 16, 13, 1.2, 450, 'o', 'gluten leite soja carne'],
    ["McDonald's", 'Chicken McNuggets 10 unidades', 0, 387, 23, 26, 21, 1.9, 750, 'o', 'gluten leite soja carne'],
    ["McDonald's", 'Chicken McNuggets 15 unidades', 0, 581, 34, 39, 32, 2.9, 1126, 'o', 'gluten leite soja carne'],
    ["McDonald's", 'Batata P', 0, 171, 2, 25, 7, 2, 174, 'o', 'soja'],
    ["McDonald's", 'McFritas Média', 0, 295, 4.8, 35, 15, 4.1, 262, 'o', 'soja'],
    ["McDonald's", 'McFritas Grande', 0, 422, 6.9, 50, 22, 5.8, 375, 'o', 'soja'],
    ["McDonald's", 'McFritas Kids', 0, 92, 1.5, 11, 4.7, 1.3, 82, 'o', 'soja'],
    ["McDonald's", 'McFritas Cheddar Bacon', 0, 431, 12, 38, 26, 4.2, 996, 'o', 'leite ovo soja carne'],
    ["McDonald's", 'Casquinha Baunilha', 0, 170, 3.2, 31, 3.9, 0.37, 62, 'o', 'gluten leite'],
    ["McDonald's", 'Casquinha Mista', 0, 167, 3.3, 30, 3.9, 0.4, 62, 'o', 'gluten leite'],
    ["McDonald's", 'Sundae chocolate', 0, 302, 5.2, 45, 12, 2.8, 156, 'o', 'gluten leite soja amendoim'],
    ["McDonald's", 'Sundae caramelo', 0, 307, 5.4, 51, 9.2, 0.97, 154, 'o', 'gluten leite soja amendoim'],
    ["McDonald's", 'Sundae morango', 0, 273, 4.8, 46, 8, 0.76, 85, 'o', 'leite'],
    ["McDonald's", 'Top Sundae chocolate', 0, 396, 6.9, 60, 14, 3.1, 193, 'o', 'gluten leite soja amendoim castanhas'],
    ["McDonald's", "McFlurry M&M's chocolate", 0, 502, 6.2, 81, 17, 3.6, 196, 'o', 'gluten leite soja amendoim'],
    ["McDonald's", 'McFlurry Ovomaltine Rocks chocolate', 0, 468, 5.8, 81, 13, 3.6, 254, 'o', 'gluten leite soja castanhas'],
    ["McDonald's", 'McFlurry Ovomaltine Rocks morango', 226, 453, 5.6, 86, 9.8, 2.3, 187, 'o', 'gluten leite soja castanhas'],
    ["McDonald's", 'McShake Ovomaltine', 0, 562, 8.3, 106, 9.7, 1.9, 259, 'o', 'gluten leite soja'],
    ["McDonald's", 'McShake Morango', 0, 575, 8, 111, 11, 0, 213, 'o', 'gluten leite soja'],
    ["McDonald's", 'Torta de Maçã', 0, 205, 1.8, 29, 8.9, 1, 68, 'o', 'gluten'],
    ["McDonald's", 'Torta de Banana', 0, 198, 2.4, 26, 9.3, 1.8, 87, 'o', 'gluten'],
    ["McDonald's", 'McColosso Chocolate', 0, 265, 4.3, 48, 6.1, 1.5, 103, 'o', 'gluten leite soja'],
    ["McDonald's", 'Egg Burger', 0, 414, 22, 41, 18, 1.8, 635, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Egg Cheese Bacon', 0, 383, 20, 41, 16, 1.7, 942, 'o', 'gluten leite ovo soja carne'],
    ["McDonald's", 'Queijo Quente', 0, 314, 12, 41, 11, 1.7, 719, 'o', 'gluten leite ovo soja'],
    ["McDonald's", 'Pão de Queijo (McCafé)', 45, 136, 3.9, 15, 6.9, 0.34, 277, 'o', 'gluten leite ovo soja amendoim castanhas'],
    ["McDonald's", 'Capuccino 300 ml', 0, 119, 6.9, 17, 2.1, 3.5, 94, 'o', 'leite soja'],
    ["McDonald's", 'Café com Leite 300 ml', 0, 79, 6.4, 10, 1.4, 0.6, 113, 'o', 'leite'],
    ["McDonald's", 'Chocolate Quente 300 ml', 0, 178, 12, 24, 3.4, 2.7, 175, 'o', 'leite soja'],
    ["McDonald's", 'Coca-Cola 500 ml', 0, 209, 0, 53, 0, 0, 24, 'o', ''],
    ["McDonald's", 'Coca-Cola 300 ml', 0, 125, 0, 32, 0, 0, 15, 'o', ''],
    ["McDonald's", 'Coca-Cola Zero Açúcar 500 ml', 0, 0, 0, 0, 0, 0, 70, 'o', ''],
    ["McDonald's", 'Fanta Guaraná 500 ml', 0, 200, 0, 48, 0, 0, 46, 'o', ''],

    ['Burger King', 'Whopper', 364, 819, 39, 48, 51, 6, 1135, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Whopper Duplo', 477, 1167, 65, 48, 76, 6, 1179, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Whopper Furioso', 405, 1067, 50, 55, 64, 5, 1793, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Whopper Jr.', 202, 469, 22, 31, 27, 3, 566, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Whopper Barbecue Bacon', 216, 579, 27, 41, 33, 3, 1239, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Whopper Rodeio', 279, 765, 20, 83, 39, 7, 2233, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Whopper de Plantas', 333, 702, 26, 54, 42, 11, 1707, 'o', 'gluten leite ovo soja'],
    ['Burger King', 'Pão, Carne e Queijo', 132, 363, 21, 28, 18, 2, 379, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Cheeseburger', 158, 408, 22, 31, 20, 2, 723, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Cheeseburger Bacon', 165, 467, 27, 30, 25, 2, 958, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Cheddar', 148, 378, 19, 30, 19, 2, 525, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Cheddar Duplo', 229, 607, 35, 32, 36, 2, 690, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Big King', 266, 739, 35, 44, 46, 2, 1038, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Stacker Duplo Bacon', 249, 864, 49, 46, 53, 1, 1685, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Stacker Triplo', 493, 1675, 108, 47, 113, 4, 2274, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Mega Stacker 2.0', 409, 1311, 75, 50, 87, 4, 2117, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Mega Stacker 3.0', 587, 1913, 113, 54, 134, 4, 3212, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Mega Stacker Cheddar 2.0', 416, 1274, 73, 51, 84, 4, 2020, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'BK Original', 238, 714, 39, 32, 50, 4, 811, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Rodeio', 174, 588, 23, 50, 32, 3, 1252, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Chicken Jr.', 154, 345, 16, 35, 16, 3, 733, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'BK Chicken Crispy', 170, 406, 19, 42, 18, 1, 944, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'Chicken Duplo', 231, 591, 28, 45, 33, 4, 1339, 'o', 'gluten leite ovo soja carne'],
    ['Burger King', 'BK Chicken 4 unidades', 74, 149, 9, 13, 7, 1, 296, 'o', 'gluten leite soja carne'],
    ['Burger King', 'BK Chicken 6 unidades', 111, 223, 14, 20, 10, 1, 444, 'o', 'gluten leite soja carne'],
    ['Burger King', 'BK Chicken 10 unidades', 186, 373, 23, 33, 17, 2, 744, 'o', 'gluten leite soja carne'],
    ['Burger King', 'Batata Frita pequena', 74, 203, 3, 24, 10, 3, 360, 'o', 'gluten'],
    ['Burger King', 'Batata Frita média', 98, 346, 3, 27, 24, 5, 194, 'o', 'gluten'],
    ['Burger King', 'Batata Frita grande', 142, 389, 6, 46, 20, 6, 692, 'o', 'gluten'],
    ['Burger King', 'Balde de Batatas', 284, 778, 12, 92, 40, 12, 1384, 'o', 'gluten'],
    ['Burger King', 'Onion Rings média', 91, 319, 5, 36, 17, 4, 570, 'o', 'gluten'],
    ['Burger King', 'Onion Rings grande', 130, 455, 7, 52, 24, 5, 814, 'o', 'gluten'],
    ['Burger King', 'Batata Suprema média', 221, 368, 9, 36, 20, 3, 337, 'o', 'gluten leite carne'],
    ['Burger King', 'Casquinha de Baunilha', 119, 243, 4, 44, 6, 1, 170, 'o', 'gluten leite soja'],
    ['Burger King', 'Casquinha Mista', 129, 254, 4, 44, 7, 1, 153, 'o', 'gluten leite soja'],
    ['Burger King', 'Casquinha Recheada de Chocolate', 148, 451, 2, 77, 14, 0, 266, 'o', 'gluten leite soja'],
    ['Burger King', 'Sundae de Chocolate', 163, 368, 5, 50, 16, 1, 189, 'o', 'leite soja'],
    ['Burger King', 'Sundae de Morango', 173, 345, 5, 52, 13, 1, 129, 'o', 'leite soja'],
    ['Burger King', 'Sundae de Doce de Leite', 180, 411, 8, 59, 16, 1, 215, 'o', 'leite soja'],
    ['Burger King', 'BK Mix de Ovomaltine', 199, 505, 5, 72, 22, 1, 173, 'o', 'gluten leite soja'],
    ['Burger King', 'BK Mix de Brownie', 193, 406, 6, 60, 15, 1, 199, 'o', 'gluten leite ovo soja'],
    ['Burger King', 'Brownie de Brigadeiro', 50, 181, 3, 22, 9, 1.5, 26, 'o', 'gluten leite ovo'],
    ['Burger King', 'Shake de Chocolate', 390, 752, 6, 122, 25, 0, 511, 'o', 'leite soja'],
    ['Burger King', 'Shake de Morango', 345, 547, 6, 94, 16, 0, 330, 'o', 'leite soja'],
    ['Burger King', 'Shake de Baunilha', 306, 475, 6, 76, 16, 0, 326, 'o', 'leite soja'],
    ['Burger King', 'Baldão de Ovomaltine', 501, 1210, 12, 166, 55, 2, 456, 'o', 'gluten leite soja'],
    ['Burger King', 'Pepsi 200 ml', 0, 87, 0, 22, 0, 0, 0, 'o', ''],
    ['Burger King', 'Guaraná Antarctica 200 ml', 0, 80, 0, 20, 0, 0, 11, 'o', ''],

    ['KFC', 'Crunch Jr', 172, 498, 13.7, 34.4, 34, 0, 0, 't', 'gluten carne'],
    ['KFC', 'Sanduíche Filet Crocante', 211, 512, 24, 39, 32, 0, 0, 't', 'gluten carne'],
    ['Popeyes', 'Double Cheddar', 268, 536, 35, 51, 20, 0, 0, 't', 'gluten leite carne'],
    ['Subway', 'B.M.T. 15 cm', 225, 380, 20.3, 47.1, 12.6, 0, 0, 't', 'gluten carne'],
    ['Subway', 'Presunto e Peito de Peru 15 cm', 245, 312, 22.1, 46.5, 4.4, 0, 0, 't', 'gluten carne'],
    ['Pizza Hut', 'Super Fatia Pepperoni', 255, 617, 25, 73, 24, 0, 0, 't', 'gluten leite carne'],
    ['Pizza Hut', 'Pizza de brigadeiro (1 fatia)', 68, 198, 4, 34, 4, 0, 0, 't', 'gluten leite'],
    ["Domino's", 'Pizza Mussarela Massa Tradicional (1 fatia)', 88, 206, 8, 26, 8, 0, 0, 't', 'gluten leite'],
    ["Domino's", 'Pizza Pepperoni Média Massa Tradicional (1 fatia)', 98, 232, 10, 26, 11, 0, 0, 't', 'gluten leite carne'],
    ["Habib's", 'Esfiha de Carne', 75, 152, 5.5, 22, 4.6, 0, 0, 't', 'gluten carne'],
    ['China in Box', 'Yakisoba de Frango Júnior', 400, 604, 36.5, 79, 16.9, 0, 0, 't', 'gluten soja carne']
  ];

  /* sobremesas, sorvetes, shakes e refrigerantes com açúcar: alto em açúcar pela composição */
  var DOCE = /sundae|mcflurry|shake|casquinha|torta|colosso|mix de|brownie|bald[aã]o de|coca-cola \d|fanta|pepsi|guaran[aá]|chocolate quente|brigadeiro/i;

  /* ícone de cada item de rede pelo nome */
  function emojiRede(nome) {
    var n = nome.toLowerCase();
    if (/nuggets|bk chicken \d/.test(n)) return 'Poultry leg';
    if (/fritas|batata|balde de batatas/.test(n)) return 'French fries';
    if (/onion/.test(n)) return 'Onion';
    if (/casquinha/.test(n)) return 'Soft ice cream';
    if (/sundae|mcflurry|mix de|bald[aã]o/.test(n)) return 'Ice cream';
    if (/shake/.test(n)) return 'Bubble tea';
    if (/torta/.test(n)) return 'Pie';
    if (/brownie|colosso/.test(n)) return 'Chocolate bar';
    if (/capuccino|caf[eé] com leite|chocolate quente/.test(n)) return 'Hot beverage';
    if (/coca|fanta|pepsi|guaran/.test(n)) return 'Cup with straw';
    if (/pizza|fatia pepperoni/.test(n)) return 'Pizza';
    if (/esfiha/.test(n)) return 'Flatbread';
    if (/yakisoba/.test(n)) return 'Takeout box';
    if (/p[aã]o de queijo/.test(n)) return 'Bread';
    if (/queijo quente|15 cm|sandu[ií]che|mcfish|chicken jr|crispy|mcchicken|chicken cheddar|chicken duplo|crunch|filet/.test(n)) return 'Sandwich';
    return 'Hamburger';
  }

  var REDES = REDES_DADOS.map(function (r, i) {
    var ml = /(\d+)\s*ml/i.exec(r[1]);
    var peso = r[2] || (ml ? +ml[1] : 0);   /* bebida: 1 ml ≈ 1 g */
    var base = peso || 100;                  /* sem peso informado: valores guardados "por unidade" */
    var k = 100 / base;
    var marcas = r[10] ? r[10].split(' ') : [];
    /* sódio: ≥ 600 mg por 100 g (lupa ANVISA) ou ≥ 600 mg na unidade (~30% do limite diário de 2 g) */
    if (r[8] >= 600 || (peso && r[8] / peso * 100 >= 600)) marcas.push('sodio');
    if (DOCE.test(r[1]) && r[5] > 0) marcas.push('acucar');
    if (/leite|ovo|carne|peixe/.test(r[10])) marcas.push('animal');
    return {
      id: 'rede-' + i, origem: 'rede', conf: r[9] === 'o' ? 'oficial' : 'terceiros',
      nome: r[1], marca: r[0],
      kcal: r[3] * k, prot: r[4] * k, carb: r[5] * k, gord: r[6] * k, fibra: (r[7] || 0) * k,
      porcao: base, semPeso: !peso,
      unidade: !peso ? '1 unidade' : '1 unidade (' + peso + (ml ? ' ml' : ' g') + ')',
      marcasRede: marcas, emoji: emojiRede(r[1])
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
    'Uva-passa': ['acucar'], 'Tâmara': ['acucar'], 'Refrigerante de cola': ['acucar'], 'Cerveja': ['alcool']
  };
  /* itens de rede já trazem as marcas da própria tabela (ver REDES acima) */
  LISTA.forEach(function (a) { a.marcas = a.marcasRede || MARCAS[a.nome] || []; });

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
    'Poultry leg': ['Peito de frango grelhado', 'Coxa de frango cozida sem pele'],
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
    'French fries': ['Batata frita (tipo fast food)']
  };
  var ICONE_DE = {};
  Object.keys(ICONES).forEach(function (emoji) { ICONES[emoji].forEach(function (nome) { ICONE_DE[nome] = emoji; }); });

  function urlEmoji(emoji) {
    return EMOJI_BASE + encodeURIComponent(emoji) + '/3D/' + emoji.toLowerCase().replace(/ /g, '_') + '_3d.png';
  }
  /* ícone de um alimento pelo nome (base local); o genérico para o resto */
  function icone(nome) { return urlEmoji(ICONE_DE[nome] || GENERICO); }
  var ICONE_GENERICO = urlEmoji(GENERICO);
  LISTA.forEach(function (a) { a.img = a.emoji ? urlEmoji(a.emoji) : icone(a.nome); });

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
