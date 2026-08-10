// Camada de dados dos produtos — usada pelo site (vitrine) e pelo painel /admin.
//
// Mesma observação do storage.js: por enquanto os produtos ficam salvos no
// localStorage do navegador. Ou seja, os produtos que a loja cadastrar no
// computador do /admin só aparecem no site quando acessados no MESMO navegador.
// Para os clientes verem os produtos de qualquer celular, é necessário um
// backend de verdade (Firebase, Supabase, etc). Veja README.md.

const CedroDecorProducts = (() => {
  const KEY = 'cedrodecor_products_v1';

  function seedIfEmpty() {
    if (localStorage.getItem(KEY) === null) {
      localStorage.setItem(KEY, JSON.stringify(PRODUCTS));
    }
  }

  function getAll() {
    seedIfEmpty();
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      console.error('Erro ao ler produtos', e);
      return [];
    }
  }

  function saveAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function getById(id) {
    return getAll().find((p) => p.id === id) || null;
  }

  function add(product) {
    const list = getAll();
    const record = {
      id: 'p_' + Math.random().toString(36).slice(2, 10),
      ...product,
    };
    list.unshift(record);
    saveAll(list);
    return record;
  }

  function update(id, patch) {
    const list = getAll();
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      saveAll(list);
      return list[idx];
    }
    return null;
  }

  function remove(id) {
    saveAll(getAll().filter((p) => p.id !== id));
  }

  // Restaura o catálogo de demonstração original (útil para desfazer bagunça em testes)
  function resetToDemoDefaults() {
    localStorage.setItem(KEY, JSON.stringify(PRODUCTS));
  }

  function isLowStock(product) {
    return typeof product.stock === 'number' && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  }

  function isOutOfStock(product) {
    return typeof product.stock === 'number' && product.stock <= 0;
  }

  return { getAll, getById, add, update, remove, resetToDemoDefaults, isLowStock, isOutOfStock };
})();
