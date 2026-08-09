// "Banco de dados" dos depoimentos — mesmo padrão de js/products-store.js.
// Guardado no localStorage, compartilhado entre o site e o /admin quando
// acessados pela mesma origem (veja README.md).

const MdecorTestimonials = (() => {
  const KEY = 'mdecor_testimonials_v1';

  function seedIfEmpty() {
    if (localStorage.getItem(KEY) === null) {
      localStorage.setItem(KEY, JSON.stringify(TESTIMONIALS));
    }
  }

  function getAll() {
    seedIfEmpty();
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      console.error('Erro ao ler depoimentos', e);
      return [];
    }
  }

  function saveAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function getById(id) {
    return getAll().find((t) => t.id === id) || null;
  }

  function add(testimonial) {
    const list = getAll();
    const record = {
      id: 't_' + Math.random().toString(36).slice(2, 10),
      ...testimonial,
    };
    list.unshift(record);
    saveAll(list);
    return record;
  }

  function update(id, patch) {
    const list = getAll();
    const idx = list.findIndex((t) => t.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      saveAll(list);
      return list[idx];
    }
    return null;
  }

  function remove(id) {
    saveAll(getAll().filter((t) => t.id !== id));
  }

  return { getAll, getById, add, update, remove };
})();
