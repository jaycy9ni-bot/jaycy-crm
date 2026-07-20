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
        <div class="card-title mb-12">👤 账户信息</div>
        <div class="form-group">
          <label class="form-label">邮箱</label>
          <div class="text-sm text-muted">${profile?.email || '-'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">显示名称</label>
          <input type="text" id="set-display-name" class="form-input" value="${u.esc(profile?.display_name || '')}" placeholder="你的昵称">
        </div>
        <button class="btn btn-primary btn-sm" id="btn-save-profile">保存</button>
      </div>

      <div class="card">
        <div class="card-title mb-12">🔑 DeepSeek API</div>
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input type="password" id="set-api-key" class="form-input" value="${u.esc(profile?.deepseek_api_key || '')}" placeholder="sk-...">
          <div class="text-xs text-muted mt-4">用于 Vercel 代理调用，不直接暴露在前端</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-save-api">保存 Key</button>
      </div>

      <div class="card">
        <div class="card-title mb-12">📤 数据管理</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-outline btn-sm" id="btn-export-json">导出 JSON 备份</button>
          <button class="btn btn-outline btn-sm" id="btn-export-csv-wa">导出西澳客户 CSV</button>
          <button class="btn btn-outline btn-sm" id="btn-export-csv-xl">导出小羚线索 CSV</button>
          <button class="btn btn-danger btn-sm" id="btn-clear-data">清空所有数据</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title mb-12">ℹ️ 关于</div>
        <div class="text-sm text-muted">
          <p>Jaycy CRM V3 · 双工作管理系统</p>
          <p class="mt-4">GitHub Pages 部署 · Supabase 数据库</p>
          <p class="mt-4">AI 引擎: DeepSeek (Vercel 代理)</p>
        </div>
      </div>
    `;

    // 保存 profile
    document.getElementById('btn-save-profile').addEventListener('click', async () => {
      const name = document.getElementById('set-display-name').value.trim();
      await JC.Supabase.updateProfile({ display_name: name });
      u.toast('已保存 ✅');
    });

    // 保存 API Key
    document.getElementById('btn-save-api').addEventListener('click', async () => {
      const key = document.getElementById('set-api-key').value.trim();
      await JC.Supabase.updateProfile({ deepseek_api_key: key });
      u.toast('API Key 已保存 ✅');
    });

    // 导出 JSON
    document.getElementById('btn-export-json').addEventListener('click', async () => {
      u.toast('正在导出...');
      try {
        const [waCustomers, xlLeads, waDeals, tasks] = await Promise.all([
          JC.Store.waGetCustomers(),
          JC.Store.xlGetLeads(),
          JC.Store.waGetDeals(),
          JC.Store.getTasks(),
        ]);
        const backup = { waCustomers, xlLeads, waDeals, tasks, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jaycy-crm-backup-${u.today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        u.toast('导出完成 ✅');
      } catch (err) {
        u.toast('导出失败 ❌');
      }
    });

    // 导出西澳 CSV
    document.getElementById('btn-export-csv-wa').addEventListener('click', async () => {
      const customers = await JC.Store.waGetCustomers();
      const headers = ['昵称','联系方式','出行日期','人数','关系','评分','等级','状态','产品','成单金额'];
      const rows = customers.map(c => [
        c.nickname, c.contact, c.travel_date, c.people_count, c.relationship,
        c.ai_score, c.ai_grade, u.statusLabel(c.status, 'wa'),
        c.deal_product || c.recommended_product, c.deal_amount
      ]);
      downloadCSV('西澳客户', headers, rows);
    });

    // 导出小羚 CSV
    document.getElementById('btn-export-csv-xl').addEventListener('click', async () => {
      const leads = await JC.Store.xlGetLeads();
      const headers = ['昵称','联系方式','来源','服务类型','求职阶段','状态','已填表','已拉群'];
      const rows = leads.map(l => [
        l.nickname, l.contact, l.source, l.service_type, l.career_stage,
        u.statusLabel(l.status, 'xl'), l.form_filled ? '是' : '否', l.group_added ? '是' : '否'
      ]);
      downloadCSV('小羚线索', headers, rows);
    });

    // 清空数据
    document.getElementById('btn-clear-data').addEventListener('click', () => {
      if (confirm('⚠️ 确定要清空所有数据吗？此操作不可撤销！\n\n建议先导出备份。')) {
        if (confirm('再次确认：清空所有数据？')) {
          u.toast('请联系管理员在 Supabase 后台执行清空操作');
        }
      }
    });
  }

  function downloadCSV(name, headers, rows) {
    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${JC.Utils.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    JC.Utils.toast('导出完成 ✅');
  }

  return { render };
})();
