// ============================================================
// Jaycy CRM V3 - 设置页面
// ============================================================
window.JC = window.JC || {};

JC.Settings = (() => {
  const u = JC.Utils;

  async function render(container) {
    const profile = await JC.Supabase.getProfile();

    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-12">👤 账户</div>
        <div class="text-sm text-muted mb-8">${profile?.email || '-'}</div>
        <div class="form-group"><label class="form-label">显示名称</label><input class="form-input" id="s-name" value="${u.esc(profile?.display_name || '')}"></div>
        <button class="btn btn-primary btn-sm" id="btn-save-profile">保存</button>
      </div>

      <div class="card">
        <div class="card-title mb-12">🔑 DeepSeek API Key</div>
        <p class="text-sm text-muted mb-8">填入后 AI 录入会直接调用 DeepSeek（前端直连，无需 Vercel）。<br>获取：platform.deepseek.com → API Keys</p>
        <div class="form-group"><label class="form-label">API Key</label><input type="password" class="form-input" id="s-key" value="${u.esc(profile?.deepseek_api_key || '')}" placeholder="sk-..."></div>
        <button class="btn btn-primary btn-sm" id="btn-save-key">保存</button>
      </div>

      <div class="card">
        <div class="card-title mb-12">📤 数据导出</div>
        <button class="btn btn-outline btn-sm btn-block" id="btn-export-deals">导出成单表 CSV</button>
        <button class="btn btn-outline btn-sm btn-block mt-8" id="btn-export-json">导出全部 JSON 备份</button>
      </div>

      <div class="card">
        <div class="card-title mb-12">ℹ️ 关于</div>
        <p class="text-sm text-muted">Jaycy CRM V3 · 双工作管理系统</p>
        <p class="text-xs text-muted mt-4">西澳客户管理 + 小羚提醒 | Supabase + GitHub Pages</p>
      </div>
    `;

    document.getElementById('btn-save-profile').addEventListener('click', async () => {
      await JC.Supabase.updateProfile({ display_name: document.getElementById('s-name').value.trim() });
      u.toast('已保存 ✅');
    });
    document.getElementById('btn-save-key').addEventListener('click', async () => {
      await JC.Supabase.updateProfile({ deepseek_api_key: document.getElementById('s-key').value.trim() });
      u.toast('已保存 ✅');
    });
    document.getElementById('btn-export-deals').addEventListener('click', () => JC.WA.exportDealsCSV());
    document.getElementById('btn-export-json').addEventListener('click', async () => {
      const [wa, deals, tasks] = await Promise.all([JC.Store.waGetCustomers(), JC.Store.waGetDeals(), JC.Store.getTasks()]);
      const blob = new Blob([JSON.stringify({ waCustomers: wa, waDeals: deals, tasks, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `jaycy-crm-${u.today()}.json`; a.click();
      u.toast('导出完成 ✅');
    });
  }

  return { render };
})();
