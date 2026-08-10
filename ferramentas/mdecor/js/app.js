// Renderização do catálogo, filtros de categoria e modal de detalhes.
// Os produtos vêm do CedroDecorProducts (localStorage), que já nasce populado
// com o catálogo de demonstração definido em products-data.js.

// Texto mostrado como marcador de posição quando um produto ainda não tem foto.
const CATEGORY_PLACEHOLDER = {
  sofas: 'Sofá',
  mesas: 'Mesa',
  camas: 'Cama',
  estantes: 'Estante',
  racks: 'Rack',
  poltronas: 'Poltrona',
};

// Categorias que têm estofado/tecido (sofás, poltronas e cabeceiras de cama),
// onde faz sentido mostrar a informação sobre estampas e tecidos especiais.
const UPHOLSTERED_CATEGORIES = ['sofas', 'poltronas', 'camas'];

const currency = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function discountPercent(p) {
  if (!p.oldPrice || p.oldPrice <= p.price) return null;
  return Math.round((1 - p.price / p.oldPrice) * 100);
}

function tint(hex, amount) {
  // Clareia uma cor hex para usar como fundo do card (mistura com branco)
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

let activeFilter = 'todos';
// guarda a cor selecionada por produto (id -> índice da cor)
const selectedColorIndex = {};

function findProduct(id) {
  return CedroDecorProducts.getById(id);
}

function mediaBgStyle(product) {
  const idx = selectedColorIndex[product.id] || 0;
  const color = (product.colors && product.colors[idx]) || { hex: '#cbbfa9' };
  return `background: linear-gradient(160deg, ${tint(color.hex, 0.72)}, ${tint(color.hex, 0.42)});`;
}

function stockBadge(p) {
  if (CedroDecorProducts.isOutOfStock(p)) {
    return { text: 'Esgotado', className: 'badge-out' };
  }
  if (CedroDecorProducts.isLowStock(p)) {
    return { text: `Últimas ${p.stock} unidades`, className: 'badge-low' };
  }
  if (p.badge) {
    return { text: p.badge, className: 'badge-promo' };
  }
  return null;
}

function mediaTemplate(p, mediaId) {
  const badge = stockBadge(p);
  const placeholder = CATEGORY_PLACEHOLDER[p.category] || 'Produto';
  return `
    <div class="product-media" id="${mediaId}" style="${mediaBgStyle(p)}">
      ${badge ? `<span class="product-badge ${badge.className}">${badge.text}</span>` : ''}
      ${p.image
        ? `<img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.remove()" />`
        : `<span class="media-icon">${placeholder}</span>`}
    </div>
  `;
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const all = CedroDecorProducts.getAll();
  const list = activeFilter === 'todos'
    ? all
    : all.filter((p) => p.category === activeFilter);

  if (!list.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--ink-600)">Nenhum produto nesta categoria no momento.</p>`;
    return;
  }

  grid.innerHTML = list.map((p) => cardTemplate(p)).join('');
}

function cardTemplate(p) {
  const idx = selectedColorIndex[p.id] || 0;
  const outOfStock = CedroDecorProducts.isOutOfStock(p);
  const lowStock = CedroDecorProducts.isLowStock(p);
  return `
    <article class="product-card" data-id="${p.id}">
      ${mediaTemplate(p, `media-${p.id}`)}
      <div class="product-body">
        <span class="product-cat">${CATEGORY_LABELS[p.category] || p.category}</span>
        <h3 class="product-name">${p.name}</h3>
        <div class="swatches" role="group" aria-label="Cores disponíveis">
          ${(p.colors || []).map((c, i) => `
            <span class="swatch ${i === idx ? 'active' : ''}"
                  style="background:${c.hex}"
                  title="${c.name}"
                  data-product="${p.id}" data-color-index="${i}"></span>
          `).join('')}
        </div>
        <div class="product-price-row">
          ${p.oldPrice ? `<span class="price-old">${currency(p.oldPrice)}</span>` : ''}
          <span class="price-now">${currency(p.price)}</span>
          ${discountPercent(p) ? `<span class="price-discount">-${discountPercent(p)}%</span>` : ''}
        </div>
        ${lowStock ? `<p class="stock-warning">Apenas ${p.stock} em estoque — corre lá!</p>` : ''}
        ${outOfStock ? `<p class="stock-warning stock-out">Sem estoque no momento</p>` : ''}
        <div class="product-actions">
          <button class="btn btn-outline btn-sm" data-action="details" data-id="${p.id}">Ver detalhes</button>
          <button class="btn btn-gold btn-sm" data-action="schedule" data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>
            ${outOfStock ? 'Indisponível' : 'Agendar visita'}
          </button>
        </div>
      </div>
    </article>
  `;
}

function openProductModal(id) {
  const p = findProduct(id);
  if (!p) return;
  const idx = selectedColorIndex[p.id] || 0;
  const outOfStock = CedroDecorProducts.isOutOfStock(p);
  const lowStock = CedroDecorProducts.isLowStock(p);
  const overlay = document.getElementById('product-modal');
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="modal-close-btn" aria-label="Fechar">✕</button>
      ${mediaTemplate(p, 'modal-media')}
      <div class="modal-body">
        <span class="product-cat">${CATEGORY_LABELS[p.category] || p.category}</span>
        <h3>${p.name}</h3>
        <p class="modal-desc">${p.description || ''}</p>
        ${p.dimensions ? `<div class="modal-dim">Dimensões: ${p.dimensions}</div>` : ''}
        ${UPHOLSTERED_CATEGORIES.includes(p.category) ? `<div class="modal-dim">Estampas e tecidos: personalizamos a estampa deste estofado. Também temos tecido impermeável e resistente a arranhões de pet.</div>` : ''}
        <div>
          <div class="modal-colors-label">Cores disponíveis</div>
          <div class="swatches" style="margin-top:8px">
            ${(p.colors || []).map((c, i) => `
              <span class="swatch ${i === idx ? 'active' : ''}"
                    style="background:${c.hex}; width:26px; height:26px;"
                    title="${c.name}"
                    data-product="${p.id}" data-color-index="${i}" data-modal="1"></span>
            `).join('')}
          </div>
        </div>
        <div class="modal-price">
          ${p.oldPrice ? `<span class="price-old">${currency(p.oldPrice)}</span>` : ''}
          ${currency(p.price)}
          ${discountPercent(p) ? `<span class="price-discount">-${discountPercent(p)}%</span>` : ''}
        </div>
        ${lowStock ? `<p class="stock-warning">Apenas ${p.stock} em estoque — corre lá!</p>` : ''}
        ${outOfStock ? `<p class="stock-warning stock-out">Sem estoque no momento</p>` : ''}
        <div class="modal-actions">
          <button class="btn btn-primary btn-block" data-action="schedule" data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>
            ${outOfStock ? 'Produto indisponível' : 'Agendar visita para ver este produto'}
          </button>
        </div>
      </div>
    </div>
  `;
  overlay.classList.add('open');
  document.getElementById('modal-close-btn').addEventListener('click', closeProductModal);
}

function closeProductModal() {
  const overlay = document.getElementById('product-modal');
  overlay.classList.remove('open');
  overlay.innerHTML = '';
}

function initProducts() {
  renderProducts();

  document.getElementById('filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    activeFilter = btn.dataset.category;
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderProducts();
  });

  document.getElementById('products-grid').addEventListener('click', (e) => {
    const swatch = e.target.closest('.swatch');
    if (swatch) {
      const { product, colorIndex } = swatch.dataset;
      selectedColorIndex[product] = Number(colorIndex);
      const card = swatch.closest('.product-card');
      card.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      const media = document.getElementById(`media-${product}`);
      const p = findProduct(product);
      media.style = mediaBgStyle(p);
      return;
    }
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn || actionBtn.disabled) return;
    const { action, id } = actionBtn.dataset;
    if (action === 'details') openProductModal(id);
    if (action === 'schedule') {
      const p = findProduct(id);
      closeProductModal();
      window.CedroDecorChat.openWithProduct(p);
    }
  });

  document.getElementById('product-modal').addEventListener('click', (e) => {
    if (e.target.id === 'product-modal') closeProductModal();
    const swatch = e.target.closest('.swatch[data-modal="1"]');
    if (swatch) {
      const { product, colorIndex } = swatch.dataset;
      selectedColorIndex[product] = Number(colorIndex);
      swatch.closest('.swatches').querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      const p = findProduct(product);
      document.getElementById('modal-media').style = mediaBgStyle(p);
    }
    const actionBtn = e.target.closest('[data-action="schedule"]');
    if (actionBtn && !actionBtn.disabled) {
      const p = findProduct(actionBtn.dataset.id);
      closeProductModal();
      window.CedroDecorChat.openWithProduct(p);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProductModal();
  });

  // Se o painel /admin alterar os produtos em outra aba, atualiza a vitrine automaticamente.
  window.addEventListener('storage', (e) => {
    if (e.key === 'cedrodecor_products_v1') renderProducts();
  });
}

document.addEventListener('DOMContentLoaded', initProducts);
