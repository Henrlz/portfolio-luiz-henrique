// Camada de dados compartilhada entre o site (chatbot) e o painel administrativo.
//
// IMPORTANTE: esta versão usa localStorage como "banco de dados" de demonstração.
// Isso funciona porque o site e o /admin rodam na mesma origem (mesmo domínio),
// mas os dados ficam presos ao navegador/dispositivo de quem agendou — a loja só
// vê os agendamentos feitos no MESMO navegador do computador da loja, ou quando
// publicado no mesmo domínio e acessado pelo mesmo dispositivo/perfil de navegador.
// Para uso real, com clientes agendando de qualquer celular e a loja vendo tudo
// em tempo real, é necessário trocar este arquivo por chamadas a um backend
// (Firebase, Supabase, ou uma API própria). Veja README.md, seção "Próximos passos".

const MdecorStorage = (() => {
  const KEY = 'mdecor_appointments_v1';

  function getAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Erro ao ler agendamentos', e);
      return [];
    }
  }

  function saveAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function add(appointment) {
    const list = getAll();
    const record = {
      id: 'ag_' + Math.random().toString(36).slice(2, 10),
      status: 'pendente', // pendente | confirmado | cancelado
      createdAt: new Date().toISOString(),
      ...appointment,
    };
    list.push(record);
    saveAll(list);
    return record;
  }

  function updateStatus(id, status) {
    const list = getAll();
    const idx = list.findIndex((a) => a.id === id);
    if (idx >= 0) {
      list[idx].status = status;
      saveAll(list);
    }
    return list;
  }

  function remove(id) {
    const list = getAll().filter((a) => a.id !== id);
    saveAll(list);
    return list;
  }

  // Retorna horários já ocupados (pendente ou confirmado) para uma data (YYYY-MM-DD)
  function takenSlots(dateStr) {
    return getAll()
      .filter((a) => a.date === dateStr && a.status !== 'cancelado')
      .map((a) => a.time);
  }

  return { getAll, add, updateStatus, remove, takenSlots };
})();
