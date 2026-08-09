// Tela de produtos do painel — pensada para uma pessoa sem experiência com
// tecnologia conseguir cadastrar, editar e remover produtos sozinha.

MdecorAuth.requireLogin();

const CATEGORY_PLACEHOLDER = {
  sofas: 'Sofá',
  mesas: 'Mesa',
  camas: 'Cama',
  estantes: 'Estante',
  racks: 'Rack',
  poltronas: 'Poltrona',
};
const currency = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let searchTerm = '';
let editingId = null;
let currentPhotoDataUrl = null;

document.getElementById('low-stock-hint-num').textContent = LOW_STOCK_THRESHOLD;

// ---------- Categoria (select) ----------
function fillCategorySelect() {
  const select = document.getElementById('f-category');
  select.innerHTML = Object.entries(CATEGORY_LABELS)
    .filter(([key]) => key !== 'todos')
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join('');
}
fillCategorySelect();

// ---------- Grade de produtos ----------
function renderGrid() {
  const grid = document.getElementById('admin-products-grid');
  const all = MdecorProducts.getAll();
  const list = searchTerm
    ? all.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : all;

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Nenhum produto encontrado. Clique em "+ Adicionar produto" para começar.</p></div>`;
    return;
  }

  grid.innerHTML = list.map((p) => {
    let pill = `<span class="stock-pill ok">${p.stock ?? 0} em estoque</span>`;
    if (MdecorProducts.isOutOfStock(p)) pill = `<span class="stock-pill out">Esgotado</span>`;
    else if (MdecorProducts.isLowStock(p)) pill = `<span class="stock-pill low">Últimas ${p.stock} unidades</span>`;

    const hasDiscount = p.oldPrice && p.oldPrice > p.price;
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

    return `
      <div class="admin-product-card" data-id="${p.id}">
        <div class="admin-product-media">
          ${p.image ? `<img src="${p.image}" alt="${p.name}" />` : `<span class="media-icon">${CATEGORY_PLACEHOLDER[p.category] || 'Produto'}</span>`}
        </div>
        <div class="admin-product-body">
          <span class="cat">${CATEGORY_LABELS[p.category] || p.category}</span>
          <h4>${p.name}</h4>
          <div class="price">
            ${currency(p.price)}
            ${hasDiscount ? `<span style="font-size:12px;font-weight:700;color:var(--danger);margin-left:6px">-${discountPercent}%</span>` : ''}
          </div>
          ${pill}
          <div class="admin-product-actions">
            <button class="btn btn-outline btn-sm" data-action="editar">Editar</button>
            <button class="btn btn-outline btn-sm" data-action="excluir" style="color:var(--danger);border-color:var(--danger)">Excluir</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('search-input').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderGrid();
});

document.getElementById('admin-products-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.closest('.admin-product-card').dataset.id;
  if (btn.dataset.action === 'editar') openForm(id);
  if (btn.dataset.action === 'excluir') {
    const p = MdecorProducts.getById(id);
    if (confirm(`Tem certeza que deseja excluir "${p.name}"? Essa ação não pode ser desfeita.`)) {
      MdecorProducts.remove(id);
      renderGrid();
      showToast('Produto excluído.');
    }
  }
});

// ---------- Cores dinâmicas ----------
function addColorRow(name = '', hex = '#8a6a4b') {
  const wrap = document.getElementById('color-rows');
  const row = document.createElement('div');
  row.className = 'color-row';
  row.innerHTML = `
    <input type="color" value="${hex}" class="color-hex" />
    <input type="text" class="form-input color-name" placeholder="Nome da cor (ex: Cinza Grafite)" value="${name}" />
    <button type="button" class="remove-color" title="Remover cor">✕</button>
  `;
  row.querySelector('.remove-color').addEventListener('click', () => {
    if (document.querySelectorAll('.color-row').length > 1) row.remove();
    else alert('O produto precisa ter pelo menos uma cor.');
  });
  wrap.appendChild(row);
}

document.getElementById('add-color-btn').addEventListener('click', () => addColorRow());

function getColorsFromForm() {
  return [...document.querySelectorAll('.color-row')].map((row) => ({
    name: row.querySelector('.color-name').value.trim() || 'Cor única',
    hex: row.querySelector('.color-hex').value,
  }));
}

// ---------- Desconto ----------
function updateDiscountHint() {
  const price = Number(document.getElementById('f-price').value);
  const oldPrice = Number(document.getElementById('f-old-price').value);
  const hint = document.getElementById('discount-hint');

  if (!price || !oldPrice) {
    hint.textContent = 'Preencha os dois preços para calcular';
    hint.classList.remove('ok');
    return;
  }
  if (oldPrice <= price) {
    hint.textContent = 'O preço original deve ser maior que o preço atual';
    hint.classList.remove('ok');
    return;
  }
  const percent = Math.round((1 - price / oldPrice) * 100);
  hint.textContent = `-${percent}% (de ${currency(oldPrice)} por ${currency(price)})`;
  hint.classList.add('ok');
}

function toggleDiscountFields(show) {
  const toggle = document.getElementById('f-discount-toggle');
  const fields = document.getElementById('discount-fields');
  toggle.checked = show;
  fields.style.display = show ? 'grid' : 'none';
  if (!show) document.getElementById('f-old-price').value = '';
  updateDiscountHint();
}

document.getElementById('f-discount-toggle').addEventListener('change', (e) => toggleDiscountFields(e.target.checked));
document.getElementById('f-price').addEventListener('input', updateDiscountHint);
document.getElementById('f-old-price').addEventListener('input', updateDiscountHint);

// ---------- Upload de foto (com redimensionamento) ----------
function resizeImageFile(file, maxWidth = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('photo-upload-area').addEventListener('click', () => {
  document.getElementById('f-photo-input').click();
});
document.getElementById('f-photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  currentPhotoDataUrl = await resizeImageFile(file);
  document.getElementById('photo-preview').innerHTML = `<img src="${currentPhotoDataUrl}" alt="Prévia da foto" />`;
});

// ---------- Abrir / fechar formulário ----------
function resetForm() {
  document.getElementById('product-form').reset();
  document.getElementById('color-rows').innerHTML = '';
  document.getElementById('photo-preview').innerHTML = '<span class="photo-preview-placeholder">Sem foto</span>';
  currentPhotoDataUrl = null;
  editingId = null;
  toggleDiscountFields(false);
  addColorRow();
}

function openForm(id) {
  resetForm();
  const overlay = document.getElementById('product-form-modal');
  if (id) {
    const p = MdecorProducts.getById(id);
    editingId = id;
    document.getElementById('form-title').textContent = 'Editar produto';
    document.getElementById('f-name').value = p.name;
    document.getElementById('f-category').value = p.category;
    document.getElementById('f-stock').value = p.stock ?? 0;
    document.getElementById('f-price').value = p.price;
    document.getElementById('f-badge').value = p.badge || '';
    document.getElementById('f-description').value = p.description || '';
    document.getElementById('f-dimensions').value = p.dimensions || '';
    document.getElementById('color-rows').innerHTML = '';
    (p.colors || []).forEach((c) => addColorRow(c.name, c.hex));
    if (p.oldPrice) {
      document.getElementById('f-old-price').value = p.oldPrice;
      toggleDiscountFields(true);
    }
    if (p.image) {
      currentPhotoDataUrl = p.image;
      document.getElementById('photo-preview').innerHTML = `<img src="${p.image}" alt="Prévia da foto" />`;
    }
  } else {
    document.getElementById('form-title').textContent = 'Adicionar produto';
  }
  overlay.classList.add('open');
}

function closeForm() {
  document.getElementById('product-form-modal').classList.remove('open');
}

document.getElementById('btn-new-product').addEventListener('click', () => openForm(null));
document.getElementById('form-close-btn').addEventListener('click', closeForm);
document.getElementById('form-cancel-btn').addEventListener('click', closeForm);
document.getElementById('product-form-modal').addEventListener('click', (e) => {
  if (e.target.id === 'product-form-modal') closeForm();
});

document.getElementById('product-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const price = Number(document.getElementById('f-price').value);
  const discountOn = document.getElementById('f-discount-toggle').checked;
  const oldPrice = discountOn ? Number(document.getElementById('f-old-price').value) : null;

  if (discountOn && !(oldPrice > price)) {
    alert('Para aplicar desconto, o preço original precisa ser maior que o preço atual.');
    return;
  }

  const patch = {
    name: document.getElementById('f-name').value.trim(),
    category: document.getElementById('f-category').value,
    stock: Number(document.getElementById('f-stock').value),
    price,
    oldPrice,
    badge: document.getElementById('f-badge').value || null,
    description: document.getElementById('f-description').value.trim(),
    dimensions: document.getElementById('f-dimensions').value.trim(),
    colors: getColorsFromForm(),
    image: currentPhotoDataUrl || null,
  };

  if (editingId) {
    MdecorProducts.update(editingId, patch);
    showToast('Produto atualizado com sucesso!');
  } else {
    MdecorProducts.add(patch);
    showToast('Produto adicionado com sucesso!');
  }
  closeForm();
  renderGrid();
});

renderGrid();
