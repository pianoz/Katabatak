(() => {
  if (localStorage.getItem('token')) window.location.href = '/landing';

  window.toggle = () => {
    const l = document.getElementById('login-section');
    const r = document.getElementById('register-section');
    l.style.display = l.style.display === 'none' ? '' : 'none';
    r.style.display = r.style.display === 'none' ? '' : 'none';
  };

  window.login = async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.textContent = '';
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error; return; }
      localStorage.setItem('token', data.token);
      window.location.href = '/landing';
    } catch {
      errEl.textContent = 'Network error';
    }
  };

  window.register = async () => {
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('reg-error');
    errEl.textContent = '';
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error; return; }
      localStorage.setItem('token', data.token);
      window.location.href = '/landing';
    } catch {
      errEl.textContent = 'Network error';
    }
  };
})();
