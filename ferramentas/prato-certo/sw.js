/* Service worker do Prato Certo: deixa o app instalável e abrindo sem internet.
   - Arquivos do app: guardados na instalação; a página busca a versão nova na rede
     e só usa a cópia guardada se estiver sem internet.
   - Ícones (jsDelivr), fotos de produtos e fontes: usa a cópia guardada e atualiza por trás.
   - Busca de produtos (Open Food Facts): sempre na rede, nunca guardada.
   Ao mudar arquivos do app, suba a VERSAO para os aparelhos pegarem a atualização. */
var VERSAO = 'prato-certo-v2';
var APP = [
  './', './index.html', './manifest.webmanifest', './favicon.svg',
  './css/style.css',
  './js/calculo.js', './js/saude.js', './js/alimentos.js', './js/api.js', './js/rotulo.js', './js/app.js',
  './icones/app-180.png', './icones/app-192.png', './icones/app-512.png'
];
var EXTRAS = 'prato-certo-extras';
var MAX_EXTRAS = 300;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(APP); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== VERSAO && n !== EXTRAS; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

function limitar(cache) {
  cache.keys().then(function (chaves) {
    if (chaves.length > MAX_EXTRAS) chaves.slice(0, chaves.length - MAX_EXTRAS).forEach(function (k) { cache.delete(k); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* API de produtos: só rede */
  if (url.hostname === 'world.openfoodfacts.org') return;

  /* arquivos do próprio app: rede primeiro, cópia guardada se offline */
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp.ok) { var copia = resp.clone(); caches.open(VERSAO).then(function (c) { c.put(req, copia); }); }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  /* ícones, fotos de produtos, fontes e o leitor de texto: cópia guardada e atualiza por trás */
  var guardavel = /(^|\.)jsdelivr\.net$|^images\.openfoodfacts\.org$|^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!guardavel) return;
  e.respondWith(caches.open(EXTRAS).then(function (cache) {
    return cache.match(req).then(function (guardada) {
      var daRede = fetch(req).then(function (resp) {
        if (resp && (resp.ok || resp.type === 'opaque')) { cache.put(req, resp.clone()); limitar(cache); }
        return resp;
      }).catch(function () { return guardada; });
      return guardada || daRede;
    });
  }));
});
