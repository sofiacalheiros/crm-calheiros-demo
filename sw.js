/* Service worker simples: guarda os ficheiros da app para abrir mais depressa
   e funcionar sem rede. Os dados NÃO passam por aqui. Quando houver API,
   os pedidos à API vão sempre à rede.
   Ao alterar ficheiros, aumente a VERSAO para os telemóveis receberem a nova versão. */
const VERSAO = "crm-v1-41";
const FICHEIROS = ["./", "./index.html",
  "./js/config.js", "./js/store.js", "./js/logic.js", "./js/forms.js", "./js/ui.js",
  "./dados-exemplo.js", "./artigos-exemplo.js", "./stock-exemplo.js", "./seguro-credito-exemplo.js", "./utilizadores-exemplo.js",
  "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png", "./logotipo.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(FICHEIROS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("crm-v1-") && k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // API e fontes externas: rede
  // Rede primeiro, SEM cache do browser (no-store): garante sempre a versão
  // mais recente no GitHub Pages (que guarda ficheiros em cache ~10 min).
  // Se não houver rede, usa a cópia guardada (funciona offline).
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then(r => { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});
