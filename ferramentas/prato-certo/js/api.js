/* Busca de produtos na Open Food Facts (base aberta e colaborativa, sem chave).
   Usa o endpoint cgi/search.pl porque ele libera CORS para o navegador.
   Como a base é feita por voluntários, tem dado errado: filtramos o que não
   fecha a conta (kcal ≠ 4·prot + 4·carb + 9·gord) em vez de mostrar lixo. */
var Api = (function () {
  'use strict';

  var BASE = 'https://world.openfoodfacts.org/cgi/search.pl';
  var CAMPOS = 'code,product_name,brands,nutriments,serving_size,serving_quantity,quantity,allergens_tags,traces_tags,ingredients_analysis_tags,categories_tags,image_front_thumb_url';

  /* miniatura do produto: só aceita o servidor de imagens da própria base */
  function miniatura(p) {
    var u = p.image_front_thumb_url;
    return typeof u === 'string' && /^https:\/\/images\.openfoodfacts\.org\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(u) ? u : '';
  }

  /* marcas para o filtro de saúde a partir do que a própria base informa */
  var ALERGENO = {
    'en:gluten': 'gluten', 'en:milk': 'leite', 'en:eggs': 'ovo', 'en:peanuts': 'amendoim', 'en:nuts': 'castanhas',
    'en:fish': 'peixe', 'en:crustaceans': 'crustaceo', 'en:molluscs': 'crustaceo', 'en:soybeans': 'soja'
  };
  function marcasDe(p, n) {
    var m = {};
    (p.allergens_tags || []).forEach(function (t) { if (ALERGENO[t]) m[ALERGENO[t]] = 1; });
    var analise = p.ingredients_analysis_tags || [];
    if (analise.indexOf('en:non-vegetarian') !== -1) m.carne = 1;
    if (analise.indexOf('en:non-vegan') !== -1) m.animal = 1;
    var bebida = (p.categories_tags || []).some(function (c) { return /beverages|bebidas|drinks/.test(c); });
    if ((p.categories_tags || []).some(function (c) { return /alcoholic|alcoolic|beers|wines|cervej/.test(c); })) m.alcool = 1;
    var acucar = num(n.sugars_100g), sodio = num(n.sodium_100g);
    if (acucar != null && acucar >= (bebida ? 7.5 : 15)) m.acucar = 1;
    if (sodio != null && sodio >= 0.6) m.sodio = 1;
    return Object.keys(m);
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  /* kcal por 100 g; se só vier kJ, converte */
  function kcalDe(n) {
    var k = num(n['energy-kcal_100g']);
    if (k == null) {
      var kj = num(n['energy-kj_100g']);
      if (kj != null) k = kj / 4.184;
    }
    return k;
  }

  function converter(p) {
    var n = p.nutriments || {};
    var nome = (p.product_name || '').trim();
    var kcal = kcalDe(n);
    if (!nome || kcal == null) return null;

    var prot = num(n.proteins_100g), carb = num(n.carbohydrates_100g), gord = num(n.fat_100g);
    if (prot == null || carb == null || gord == null) return null;

    /* sanidade: ninguém passa de 900 kcal/100 g, e a conta tem que fechar */
    if (kcal < 0 || kcal > 900 || prot + carb + gord > 105) return null;
    var calc = prot * 4 + carb * 4 + gord * 9;
    if (kcal > 20 && Math.abs(calc - kcal) > Math.max(40, kcal * 0.35)) return null;

    var serv = num(p.serving_quantity);
    return {
      id: 'off-' + p.code, origem: 'off', nome: nome,
      marca: (p.brands || '').split(',')[0].trim(),
      kcal: kcal, prot: prot, carb: carb, gord: gord,
      fibra: num(n.fiber_100g) || 0,
      porcao: serv && serv > 0 && serv < 1000 ? serv : 100,
      unidade: serv && serv > 0 && serv < 1000 ? (p.serving_size || serv + ' g') : '100 g',
      marcas: marcasDe(p, n),
      img: miniatura(p)
    };
  }

  function url(q, soBrasil) {
    var u = BASE + '?search_terms=' + encodeURIComponent(q) +
      '&search_simple=1&action=process&json=1&page_size=20&fields=' + CAMPOS;
    if (soBrasil) u += '&tagtype_0=countries&tag_contains_0=contains&tag_0=brazil';
    return u;
  }

  async function pedir(u, signal) {
    var ctl = new AbortController();
    var tempo = setTimeout(function () { ctl.abort(); }, 12000);
    if (signal) signal.addEventListener('abort', function () { ctl.abort(); });
    try {
      var r = await fetch(u, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(tempo);
    }
  }

  /* tenta só produtos do Brasil; se vier pouco, abre para o mundo.
     O serviço às vezes devolve 503: tenta uma segunda vez. */
  async function buscar(q, signal) {
    async function tentar(soBrasil) {
      try {
        return await pedir(url(q, soBrasil), signal);
      } catch (e) {
        if (signal && signal.aborted) throw e;
        await new Promise(function (ok) { setTimeout(ok, 700); });
        return await pedir(url(q, soBrasil), signal);
      }
    }

    var dados = await tentar(true);
    var lista = (dados.products || []).map(converter).filter(Boolean);
    if (lista.length < 4) {
      try {
        var mais = await tentar(false);
        var vistos = {};
        lista.forEach(function (a) { vistos[a.id] = 1; });
        (mais.products || []).map(converter).filter(Boolean).forEach(function (a) {
          if (!vistos[a.id]) lista.push(a);
        });
      } catch (e) {
        if (signal && signal.aborted) throw e;
      }
    }
    return lista.slice(0, 12);
  }

  /* um produto pelo código de barras; null se não existe ou está incompleto */
  async function porCodigo(codigo) {
    var u = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(codigo) +
      '.json?fields=' + CAMPOS;
    var dados = await pedir(u);
    if (!dados || dados.status !== 1 || !dados.product) return null;
    dados.product.code = dados.product.code || codigo;
    return converter(dados.product);
  }

  return { buscar: buscar, porCodigo: porCodigo };
})();
