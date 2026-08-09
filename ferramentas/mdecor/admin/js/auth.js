// Login do painel administrativo — versão de demonstração.
//
// ATENÇÃO: esta verificação acontece no navegador (JavaScript), então a senha
// abaixo fica visível para quem souber olhar o código-fonte da página. Isso é
// aceitável para uma demonstração/protótipo, mas NÃO deve ser usado assim em
// produção — antes de divulgar o link do /admin para o público, troque por um
// login de verdade no backend (ver README.md, seção "Próximos passos").

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'mdecor2026';
const SESSION_KEY = 'mdecor_admin_session';

const MdecorAuth = {
  isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  },
  login(user, pass) {
    if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      return true;
    }
    return false;
  },
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  },
  // Chame no topo de toda página protegida do /admin
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
    }
  },
};
