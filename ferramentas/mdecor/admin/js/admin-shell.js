// Comportamento comum das páginas do painel: menu mobile e botão sair.
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('nav-toggle-admin');
  const sidebar = document.getElementById('admin-sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
  const logout = document.getElementById('logout-link');
  if (logout) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Deseja sair do painel administrativo?')) MdecorAuth.logout();
    });
  }
});

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}
