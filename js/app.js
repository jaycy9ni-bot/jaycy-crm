// ============================================================
// Jaycy CRM V3 - 主控制器
// ============================================================
window.JC = window.JC || {};

JC.App = (() => {
  let currentUser = null;

  async function init() {
    // 渲染基础结构
    renderShell();

    // 检查登录状态
    const session = await JC.Supabase.getSession();
    if (session) {
      currentUser = session.user;
      onLoggedIn();
    } else {
      renderAuthPage();
    }

    // 监听认证状态变化
    JC.Supabase.onAuthChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        currentUser = s?.user;
        onLoggedIn();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        renderAuthPage();
      }
    });
  }

  function renderShell() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `
      <div id="top-bar" class="top-bar" style="display:none">
        <h1 id="top-bar-title">JaycyCRM</h1>
        <div class="top-bar-actions">
          <button class="btn-icon" id="btn-notifications" title="通知">
            🔔
            <span class="badge" id="notif-badge" style="display:none">0</span>
          </button>
          <button class="btn-icon" id="btn-logout" title="退出">🚪</button>
        </div>
      </div>
      <div id="main"></div>
      <div id="bottom-nav" class="bottom-nav" style="display:none">
        <button class="nav-tab active" data-tab="dashboard">
          <span class="nav-icon">🏠</span>
          <span>首页</span>
        </button>
        <button class="nav-tab" data-tab="wa">
          <span class="nav-icon">🦘</span>
          <span>西澳</span>
        </button>
        <button class="nav-tab add-tab" data-tab="add">
          <span class="nav-icon">+</span>
          <span>录入</span>
        </button>
        <button class="nav-tab" data-tab="xl">
          <span class="nav-icon">🦊</span>
          <span>小羚</span>
        </button>
        <button class="nav-tab" data-tab="settings">
          <span class="nav-icon">⚙️</span>
          <span>设置</span>
        </button>
      </div>
    `;

    // 绑定底部导航
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        JC.Router.navigate(target);
      });
    });

    // 退出登录
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      if (confirm('确定要退出登录吗？')) {
        await JC.Supabase.signOut();
      }
    });

    // 通知按钮
    document.getElementById('btn-notifications')?.addEventListener('click', () => {
      if (JC.Notification) JC.Notification.showPanel();
    });
  }

  function renderAuthPage() {
    document.getElementById('top-bar').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';

    const main = document.getElementById('main');
    main.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:20px;">
        <div style="font-size:48px;margin-bottom:16px;">🗃️</div>
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;color:var(--primary)">Jaycy CRM V3</h2>
        <p style="color:var(--text-secondary);margin-bottom:32px;text-align:center;font-size:14px;">西澳客户管理 · 小羚提醒 · AI 驱动</p>

        <div id="auth-form" style="width:100%;max-width:320px;">
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input type="email" id="auth-email" class="form-input" placeholder="your@email.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" id="auth-password" class="form-input" placeholder="至少6位" autocomplete="current-password">
          </div>
          <button id="btn-login" class="btn btn-primary btn-block">登录</button>
          <button id="btn-register" class="btn btn-outline btn-block mt-8">注册新账号</button>
          <p id="auth-msg" style="text-align:center;margin-top:12px;font-size:13px;min-height:20px;"></p>
        </div>
      </div>
    `;

    // 登录
    document.getElementById('btn-login').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const msg = document.getElementById('auth-msg');

      if (!email || !password) {
        msg.textContent = '请填写邮箱和密码';
        msg.style.color = 'var(--danger)';
        return;
      }
      if (password.length < 6) {
        msg.textContent = '密码至少6位';
        msg.style.color = 'var(--danger)';
        return;
      }

      msg.textContent = '登录中...';
      msg.style.color = 'var(--text-secondary)';

      const { data, error } = await JC.Supabase.signIn(email, password);
      if (error) {
        msg.textContent = error.message || '登录失败';
        msg.style.color = 'var(--danger)';
      }
    });

    // 注册
    document.getElementById('btn-register').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const msg = document.getElementById('auth-msg');

      if (!email || !password) {
        msg.textContent = '请填写邮箱和密码';
        msg.style.color = 'var(--danger)';
        return;
      }
      if (password.length < 6) {
        msg.textContent = '密码至少6位';
        msg.style.color = 'var(--danger)';
        return;
      }

      msg.textContent = '注册中...';
      msg.style.color = 'var(--text-secondary)';

      const { data, error } = await JC.Supabase.signUp(email, password);
      if (error) {
        msg.textContent = error.message || '注册失败';
        msg.style.color = 'var(--danger)';
      } else {
        msg.innerHTML = '✅ 注册成功！<br>请检查邮箱确认链接，然后返回登录。';
        msg.style.color = 'var(--success)';
      }
    });

    // 回车登录
    document.getElementById('auth-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
  }

  function onLoggedIn() {
    document.getElementById('top-bar').style.display = 'flex';
    document.getElementById('bottom-nav').style.display = 'flex';

    // 初始化通知系统
    if (JC.Notification) JC.Notification.init();

    // 初始化定时任务检查
    if (JC.Notification) JC.Notification.startTaskChecker();

    // 渲染仪表盘
    JC.Router.navigate('dashboard');
  }

  return { init };
})();
