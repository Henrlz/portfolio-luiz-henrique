// Renderização da seção de depoimentos no site principal.

function starRating(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function renderTestimonials() {
  const grid = document.getElementById('testimonials-grid');
  if (!grid) return;
  const list = MdecorTestimonials.getAll();

  if (!list.length) {
    grid.innerHTML = '';
    document.getElementById('depoimentos').style.display = 'none';
    return;
  }

  grid.innerHTML = list.map((t) => `
    <div class="testimonial-card">
      <div class="testimonial-rating">${starRating(t.rating)}</div>
      <p class="testimonial-text">"${t.text}"</p>
      <div class="testimonial-author">
        <strong>${t.name}</strong>
        ${t.role ? `<span>${t.role}</span>` : ''}
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', renderTestimonials);

// Se o painel /admin alterar os depoimentos em outra aba, atualiza aqui também.
window.addEventListener('storage', (e) => {
  if (e.key === 'mdecor_testimonials_v1') renderTestimonials();
});
