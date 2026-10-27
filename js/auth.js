const Auth = {
  init() {
    const form = document.getElementById('login-form');
    if (form) form.addEventListener('submit', event => { event.preventDefault(); this.login(); });
    const toggle = document.getElementById('toggle-password');
    if (toggle) toggle.addEventListener('click', () => {
      const input = document.getElementById('password');
      const icon = document.getElementById('toggle-password-icon');
      input.type = input.type === 'password' ? 'text' : 'password';
      if (icon) icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
    this.checkAuthStatus();
  },

  async login() {
    const usuario = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const button = document.getElementById('btn-login');
    if (!usuario || !password) return Utils.showToast('Ingresa usuario y contraseña', 'warning');
    button.disabled = true;
    try {
      await API.cargarCsrf();
      const session = await API.post('/auth/login', { usuario, password });
      API.setSession(session);
      Utils.showToast('Inicio de sesión exitoso', 'success');
      this.showDashboard();
    } catch (error) {
      Utils.showToast(error.message || 'Credenciales incorrectas', 'error');
    } finally { button.disabled = false; }
  },

  async logout() {
    await API.cerrarSesion().catch(() => {});
    localStorage.removeItem('lastModule');
    this.showLogin();
    Utils.showToast('Sesión cerrada', 'info');
  },

  async checkAuthStatus() {
    try {
      await API.cargarCsrf();
      const session = await API.get('/auth/me');
      API.setSession(session);
      this.showDashboard();
    } catch (_) { this.showLogin(); }
  },

  showLogin() {
    document.getElementById('login-view')?.classList.remove('d-none');
    document.getElementById('dashboard-view')?.classList.add('d-none');
  },

  showDashboard() {
    document.getElementById('login-view')?.classList.add('d-none');
    document.getElementById('dashboard-view')?.classList.remove('d-none');
    Dashboard.init();
  }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
