// Tela de depoimentos do painel — adicionar, editar e (principalmente)
// excluir avaliações rapidamente, caso chegue algum comentário falso.

CedroDecorAuth.requireLogin();

let editingId = null;

function starRating(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function renderList() {
  const container = document.getElementById('testimonials-admin-list');
  const list = CedroDecorTestimonials.getAll();

  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><p>Nenhum depoimento cadastrado. Clique em "+ Adicionar depoimento" para começar.</p></div>`;
    return;
  }

  container.innerHTML = list.map((t) => `
    <div class="appt-card" data-id="${t.id}">
      <div class="appt-info">
        <strong>${t.name}</strong>
        <span style="color:var(--gold-500);letter-spacing:2px">${starRating(t.rating)}</span>
        ${t.role ? `<span>${t.role}</span>` : ''}
        <p style="margin:8px 0 0;font-size:14px;color:var(--ink-900)">"${t.text}"</p>
      </div>
      <div class="appt-actions">
        <button class="btn btn-sm btn-outline" data-action="editar">Editar</button>
        <button class="btn btn-sm btn-outline" data-action="excluir" style="color:var(--danger);border-color:var(--danger)">Excluir</button>
      </div>
    </div>
  `).join('');
}

function resetForm() {
  document.getElementById('testimonial-form').reset();
  editingId = null;
}

function openForm(id) {
  resetForm();
  const overlay = document.getElementById('testimonial-form-modal');
  if (id) {
    const t = CedroDecorTestimonials.getById(id);
    editingId = id;
    document.getElementById('form-title').textContent = 'Editar depoimento';
    document.getElementById('t-name').value = t.name;
    document.getElementById('t-role').value = t.role || '';
    document.getElementById('t-rating').value = t.rating;
    document.getElementById('t-text').value = t.text;
  } else {
    document.getElementById('form-title').textContent = 'Adicionar depoimento';
  }
  overlay.classList.add('open');
}

function closeForm() {
  document.getElementById('testimonial-form-modal').classList.remove('open');
}

document.getElementById('btn-new-testimonial').addEventListener('click', () => openForm(null));
document.getElementById('form-close-btn').addEventListener('click', closeForm);
document.getElementById('form-cancel-btn').addEventListener('click', closeForm);
document.getElementById('testimonial-form-modal').addEventListener('click', (e) => {
  if (e.target.id === 'testimonial-form-modal') closeForm();
});

document.getElementById('testimonials-admin-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.closest('.appt-card').dataset.id;
  if (btn.dataset.action === 'editar') openForm(id);
  if (btn.dataset.action === 'excluir') {
    const t = CedroDecorTestimonials.getById(id);
    if (confirm(`Tem certeza que deseja excluir o depoimento de "${t.name}"? Essa ação não pode ser desfeita.`)) {
      CedroDecorTestimonials.remove(id);
      renderList();
      showToast('Depoimento excluído.');
    }
  }
});

document.getElementById('testimonial-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const patch = {
    name: document.getElementById('t-name').value.trim(),
    role: document.getElementById('t-role').value.trim(),
    rating: Number(document.getElementById('t-rating').value),
    text: document.getElementById('t-text').value.trim(),
  };

  if (editingId) {
    CedroDecorTestimonials.update(editingId, patch);
    showToast('Depoimento atualizado com sucesso!');
  } else {
    CedroDecorTestimonials.add(patch);
    showToast('Depoimento adicionado com sucesso!');
  }
  closeForm();
  renderList();
});

renderList();
