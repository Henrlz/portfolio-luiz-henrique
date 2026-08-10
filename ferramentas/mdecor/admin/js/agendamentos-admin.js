// Tela de agendamentos do painel — pensada para ser bem simples de usar:
// listas por dia, filtros por status e botões grandes de ação.

CedroDecorAuth.requireLogin();

let statusFilter = 'todos';

function formatDateBR(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function dayLabel(iso) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (iso === today) return `Hoje — ${formatDateBR(iso)}`;
  if (iso === tomorrow) return `Amanhã — ${formatDateBR(iso)}`;
  return formatDateBR(iso);
}

function renderAppointments() {
  const all = CedroDecorStorage.getAll();
  const list = statusFilter === 'todos' ? all : all.filter((a) => a.status === statusFilter);
  const container = document.getElementById('appointments-container');

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nenhum agendamento ${statusFilter === 'todos' ? '' : `com status "${statusFilter}"`} por aqui ainda.</p>
      </div>
    `;
    return;
  }

  const byDate = {};
  list.forEach((a) => {
    byDate[a.date] = byDate[a.date] || [];
    byDate[a.date].push(a);
  });
  const dates = Object.keys(byDate).sort();

  container.innerHTML = dates.map((date) => `
    <div class="day-group">
      <h3>${dayLabel(date)}</h3>
      ${byDate[date]
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((a) => appointmentCard(a)).join('')}
    </div>
  `).join('');
}

function appointmentCard(a) {
  const productLine = a.productName
    ? a.productName
    : (a.productCategory ? (CATEGORY_LABELS[a.productCategory] || a.productCategory) : '');
  const waLink = `https://wa.me/55${a.phone.replace(/\D/g, '')}`;
  return `
    <div class="appt-card" data-id="${a.id}">
      <div class="appt-time">${a.time}</div>
      <div class="appt-info">
        <strong>${a.name}</strong>
        <span><a href="tel:${a.phone.replace(/\D/g, '')}">${a.phone}</a> · <a href="${waLink}" target="_blank" rel="noopener">WhatsApp</a></span>
        ${productLine ? `<span>${productLine}</span>` : ''}
      </div>
      <span class="status-badge ${a.status}">${a.status}</span>
      <div class="appt-actions">
        ${a.status !== 'confirmado' ? `<button class="btn btn-sm btn-primary" data-action="confirmar">Confirmar</button>` : ''}
        ${a.status !== 'cancelado' ? `<button class="btn btn-sm btn-outline" data-action="cancelar">Cancelar</button>` : ''}
        <button class="btn btn-sm btn-outline" data-action="excluir" style="color:var(--danger);border-color:var(--danger)">Excluir</button>
      </div>
    </div>
  `;
}

document.getElementById('status-filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  statusFilter = btn.dataset.status;
  document.querySelectorAll('#status-filters .filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
  renderAppointments();
});

document.getElementById('appointments-container').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const card = btn.closest('.appt-card');
  const id = card.dataset.id;
  const { action } = btn.dataset;

  if (action === 'confirmar') {
    CedroDecorStorage.updateStatus(id, 'confirmado');
    showToast('Agendamento confirmado!');
  }
  if (action === 'cancelar') {
    CedroDecorStorage.updateStatus(id, 'cancelado');
    showToast('Agendamento cancelado.');
  }
  if (action === 'excluir') {
    if (confirm('Tem certeza que deseja excluir este agendamento? Essa ação não pode ser desfeita.')) {
      CedroDecorStorage.remove(id);
      showToast('Agendamento excluído.');
    }
  }
  renderAppointments();
});

renderAppointments();
