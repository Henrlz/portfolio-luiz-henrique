/* Lê a tabela nutricional de uma foto.
   1) ler(): prepara a imagem e passa pelo Tesseract (OCR) rodando no próprio
      navegador — a foto não é enviada a lugar nenhum; só o leitor (biblioteca e
      dicionário de português) é baixado do jsDelivr, na primeira vez.
   2) interpretar(): puro texto → números. Entende o rótulo brasileiro:
        Informação nutricional | 100 g | 30 g (porção) | %VD
      acha em qual coluna está cada valor pelo cabeçalho, ignora %VD, kJ e sódio. */
var Rotulo = (function () {
  'use strict';

  var TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var carregando = null;
  var worker = null;
  var aoProgredir = null;

  /* ---------------- interpretar o texto ---------------- */
  function limpar(t) {
    return String(t)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/(\d),(\d)/g, '$1.$2')          /* 3,5 → 3.5 */
      .replace(/(\d)[oO](?=\d|\s|g\b)/g, '$10') /* OCR troca 0 por O: "1O" → "10" */
      .replace(/[|¦]/g, ' ')
      .replace(/[ \t]+/g, ' ');
  }

  /* números de uma linha, sem %VD; cada um com a unidade colada (kcal, kj, mg, g) */
  function numeros(linha) {
    /* "(g)" às vezes sai como "(9)": o que está entre parênteses é rótulo, não valor */
    var s = linha.replace(/\([^)]*\)/g, ' ').replace(/\d+(?:\.\d+)?\s*%/g, ' ').replace(/\*+/g, ' ');
    var achados = [];
    var re = /(\d+(?:\.\d+)?)\s*(kcal|kj|mg|g|ml)?(?![a-z])/g, m;
    while ((m = re.exec(s)) !== null) achados.push({ v: parseFloat(m[1]), u: m[2] || '' });
    return achados;
  }

  function interpretar(texto) {
    var t = limpar(texto);
    var linhas = t.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var res = { base: '100', porcaoG: null, kcal: null, prot: null, carb: null, gord: null, fibra: null, achou: 0, avisos: [] };

    /* tamanho da porção: "porção de 30 g" */
    var mp = t.match(/por[cç]ao[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*(g|ml)\b/);
    if (mp) res.porcaoG = parseFloat(mp[1]);

    /* cabeçalho das colunas: linha com "100 g" (ou ml) */
    var ordem = null, nCol = 2;
    for (var i = 0; i < linhas.length; i++) {
      if (/\b100\s*(g|ml)\b/.test(linhas[i])) {
        var cols = [];
        var re = /(\d+(?:\.\d+)?)\s*(g|ml)\b/g, m;
        while ((m = re.exec(linhas[i])) !== null) cols.push(parseFloat(m[1]));
        if (cols.length >= 2) {
          nCol = 2;
          ordem = cols[0] === 100 ? 'cem-primeiro' : (cols[1] === 100 ? 'porcao-primeiro' : null);
          var outra = cols.filter(function (c) { return c !== 100; })[0];
          if (outra && !res.porcaoG) res.porcaoG = outra;
        } else {
          nCol = 1; ordem = 'cem-primeiro';
        }
        break;
      }
    }

    function pegar(nums) {
      if (!nums.length) return null;
      var usar = nums.slice(0, nCol);
      if (nCol === 1 || !ordem) return { a: usar[0], b: usar[1] != null ? usar[1] : null };
      return ordem === 'cem-primeiro'
        ? { a: usar[0], b: usar[1] != null ? usar[1] : null }
        : { a: usar[1] != null ? usar[1] : null, b: usar[0] };
    }

    var achados = { kcal: null, prot: null, carb: null, gord: null, fibra: null };
    var descartados = [];
    var NOMES = { kcal: 'calorias', prot: 'proteína', carb: 'carboidrato', gord: 'gordura', fibra: 'fibra' };

    /* com as duas colunas, os valores precisam ser coerentes: 100 g × porção ÷ 100.
       Se o OCR perdeu um número, a conta não fecha e é melhor não chutar. */
    function coerente(p) {
      if (nCol !== 2 || !ordem || !res.porcaoG || p.b == null || p.a == null) return true;
      var cem = p.a, por = p.b;   /* pegar() já devolve a = 100 g e b = porção */
      return Math.abs(cem * res.porcaoG / 100 - por) <= Math.max(0.35, por * 0.2);
    }

    linhas.forEach(function (l) {
      var chave = null;
      if (/valor energetico|energia|calorias/.test(l)) chave = 'kcal';
      else if (/carboidrat/.test(l)) chave = 'carb';
      else if (/proteina/.test(l)) chave = 'prot';
      else if (/fibra/.test(l)) chave = 'fibra';
      else if (/gordura|lipidio/.test(l) && !/satur|trans|mono|poli|colester/.test(l)) chave = 'gord';
      if (!chave || achados[chave]) return;

      var nums = numeros(l);
      if (chave === 'kcal') {
        var emKcal = nums.filter(function (n) { return n.u === 'kcal'; });
        nums = emKcal.length ? emKcal : nums.filter(function (n) { return n.u !== 'kj'; });
      } else {
        nums = nums.filter(function (n) { return n.u === '' || n.u === 'g'; });
      }
      var p = pegar(nums.map(function (n) { return n.v; }));
      if (!p || p.a == null) return;
      if (!coerente(p)) { descartados.push(NOMES[chave]); return; }
      achados[chave] = p;
    });
    if (descartados.length) res.avisos.push('Não consegui ler com segurança: ' + descartados.join(', ') + '. Digite esse valor.');

    /* decide a base: se achamos a coluna de 100 g, usa ela; senão, os valores são da porção */
    var temCem = ordem === 'cem-primeiro' || (ordem === 'porcao-primeiro' && nCol === 2);
    ['kcal', 'prot', 'carb', 'gord', 'fibra'].forEach(function (k) {
      var a = achados[k];
      if (!a) return;
      res[k] = a.a;
      res.achou++;
    });
    if (temCem) {
      res.base = '100';
    } else if (res.porcaoG) {
      res.base = 'porcao';
      res.avisos.push('Não achei a coluna "100 g"; usei os valores como sendo da porção de ' + res.porcaoG + ' g. Confira.');
    } else {
      res.base = '100';
      res.avisos.push('Não consegui saber se os valores são por 100 g ou por porção. Confira no rótulo.');
    }
    return res;
  }

  /* ---------------- OCR ---------------- */
  function carregarScript() {
    if (window.Tesseract) return Promise.resolve();
    if (carregando) return carregando;
    carregando = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = TESSERACT;
      s.onload = ok;
      s.onerror = function () { carregando = null; falha(new Error('Não consegui baixar o leitor de texto (sem internet?).')); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  async function obterWorker() {
    if (worker) return worker;
    await carregarScript();
    worker = await window.Tesseract.createWorker('por', 1, {
      logger: function (m) { if (aoProgredir) aoProgredir(m); }
    });
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    return worker;
  }

  /* reduz/amplia para ~1800 px de largura, tons de cinza e contraste: o OCR agradece */
  function preparar(arquivo) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        /* lado maior em ~1800 px: reduz foto grande de celular, amplia imagem pequena (até 2,5x) */
        var maior = Math.max(img.naturalWidth, img.naturalHeight);
        var esc = Math.min(1800 / maior, 2.5);
        var w = Math.round(img.naturalWidth * esc), h = Math.round(img.naturalHeight * esc);
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        try {
          var d = x.getImageData(0, 0, w, h), p = d.data, min = 255, max = 0, i;
          for (i = 0; i < p.length; i += 4) {
            var g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
            p[i] = p[i + 1] = p[i + 2] = g;
            if (g < min) min = g; if (g > max) max = g;
          }
          var faixa = Math.max(max - min, 1);
          for (i = 0; i < p.length; i += 4) {
            var v = (p[i] - min) * 255 / faixa;
            p[i] = p[i + 1] = p[i + 2] = v;
          }
          x.putImageData(d, 0, 0);
        } catch (e) { /* sem getImageData: segue com a imagem como está */ }
        ok(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir essa imagem.')); };
      img.src = url;
    });
  }

  async function ler(arquivo, progresso) {
    aoProgredir = progresso || null;
    var tela = await preparar(arquivo);
    var w = await obterWorker();
    var r = await w.recognize(tela);
    return r.data.text || '';
  }

  return { ler: ler, interpretar: interpretar };
})();
