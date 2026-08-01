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
        <div class="card-title mb-12">📥 Excel 文件导入</div>
        <p class="text-sm text-muted mb-12">上传 .xlsx 文件，自动解析并导入</p>

        <div style="border:2px dashed var(--border);border-radius:12px;padding:16px;text-align:center;margin-bottom:12px;cursor:pointer;" id="upload-deals-zone">
          <div style="font-size:28px;">📊</div>
          <p class="text-sm mt-4" style="font-weight:600;">导入成单表 Excel</p>
          <p class="text-xs text-muted mt-4">点击选择 .xlsx 文件</p>
          <input type="file" id="upload-deals-input" accept=".xlsx,.xls" style="display:none;">
        </div>

        <div style="border:2px dashed var(--border);border-radius:12px;padding:16px;text-align:center;cursor:pointer;" id="upload-customers-zone">
          <div style="font-size:28px;">📋</div>
          <p class="text-sm mt-4" style="font-weight:600;">导入咨询表 Excel</p>
          <p class="text-xs text-muted mt-4">点击选择 .xlsx 文件</p>
          <input type="file" id="upload-customers-input" accept=".xlsx,.xls" style="display:none;">
        </div>

        <p id="import-status" class="text-xs mt-8" style="display:none;"></p>
      </div>

      <div class="card">
        <div class="card-title mb-12">📤 数据导出</div>
        <button class="btn btn-outline btn-sm btn-block mb-8" id="btn-export-customers">📥 导出咨询表 (.xls)</button>
        <button class="btn btn-outline btn-sm btn-block mb-8" id="btn-export-deals">📥 导出成单表 (.xls)</button>
        <button class="btn btn-outline btn-sm btn-block" id="btn-export-json">📥 导出全部 JSON 备份</button>
      </div>

      <div class="card">
        <div class="card-title mb-12">🗑️ 数据清理</div>
        <p class="text-sm text-muted mb-8">清理幽灵数据（之前导入失败的残留）</p>
        <button class="btn btn-danger btn-sm btn-block mb-8" id="btn-clean-orphans" style="background:#EF4444;color:#fff;border:none;">🗑️ 清理幽灵数据</button>
        <button class="btn btn-outline btn-sm btn-block" id="btn-auth-check">🔍 诊断登录状态</button>
        <p id="clean-status" class="text-xs text-muted mt-4" style="display:none;"></p>
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
    document.getElementById('btn-export-customers').addEventListener('click', () => JC.WA.exportCustomersCSV());
    document.getElementById('btn-export-deals').addEventListener('click', () => JC.WA.exportDealsCSV());

    // 文件上传导入 - 成单表
    const dealsZone = document.getElementById('upload-deals-zone');
    const dealsInput = document.getElementById('upload-deals-input');
    dealsZone.addEventListener('click', () => dealsInput.click());
    dealsInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('import-status');
      status.style.display = 'block';
      status.style.color = 'var(--text-secondary)';
      status.textContent = '⏳ 正在解析 Excel 文件...';
      dealsZone.style.opacity = '0.5';
      try {
        const result = await JC.ExcelImport.importDeals(file, (done, total, ok, err) => {
          status.textContent = `📊 导入成单: ${done}/${total} · 成功 ${ok} · 失败 ${err}`;
        });
        status.style.color = result.fail > 0 ? 'var(--warning)' : 'var(--success)';
        status.textContent = `✅ 成单导入完成！成功 ${result.success} 条，失败 ${result.fail} 条（共解析 ${result.total} 条，表头在第${result.headerIdx+1}行）`;
        if (result.errors.length > 0) {
          status.textContent += `\n错误示例: ${result.errors.slice(0,3).join(' | ')}`;
        }
        u.toast(`成单导入: 成功 ${result.success} 条`);
      } catch (e) {
        status.style.color = 'var(--danger)';
        status.textContent = '❌ 导入失败: ' + (e.message || '未知错误');
      }
      dealsZone.style.opacity = '1';
      dealsInput.value = '';
    });

    // 文件上传导入 - 咨询表
    const custZone = document.getElementById('upload-customers-zone');
    const custInput = document.getElementById('upload-customers-input');
    custZone.addEventListener('click', () => custInput.click());
    custInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('import-status');
      status.style.display = 'block';
      status.style.color = 'var(--text-secondary)';
      status.textContent = '⏳ 正在解析 Excel 文件...';
      custZone.style.opacity = '0.5';
      try {
        const result = await JC.ExcelImport.importCustomers(file, (done, total, ok, err) => {
          status.textContent = `📋 导入咨询: ${done}/${total} · 成功 ${ok} · 失败 ${err}`;
        });
        status.style.color = result.fail > 0 ? 'var(--warning)' : 'var(--success)';
        status.textContent = `✅ 咨询导入完成！成功 ${result.success} 条，失败 ${result.fail} 条（共解析 ${result.total} 条，表头在第${result.headerIdx+1}行）`;
        if (result.errors.length > 0) {
          status.textContent += `\n错误示例: ${result.errors.slice(0,3).join(' | ')}`;
        }
        u.toast(`咨询导入: 成功 ${result.success} 条`);
      } catch (e) {
        status.style.color = 'var(--danger)';
        status.textContent = '❌ 导入失败: ' + (e.message || '未知错误');
      }
      custZone.style.opacity = '1';
      custInput.value = '';
    });
    document.getElementById('btn-export-json').addEventListener('click', async () => {
      const [wa, deals, tasks] = await Promise.all([JC.Store.waGetCustomers(), JC.Store.waGetDeals(), JC.Store.getTasks()]);
      const blob = new Blob([JSON.stringify({ waCustomers: wa, waDeals: deals, tasks, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `jaycy-crm-${u.today()}.json`; a.click();
      u.toast('导出完成 ✅');
    });
    document.getElementById('btn-clean-orphans').addEventListener('click', async () => {
      if (!confirm('确定要清理幽灵数据吗？（之前导入失败、owner_id 为空的数据）。此操作不可撤销。')) return;
      const btn = document.getElementById('btn-clean-orphans');
      const status = document.getElementById('clean-status');
      btn.disabled = true;
      btn.textContent = '⏳ 清理中...';
      status.style.display = 'block';
      status.textContent = '正在清理...';
      try {
        const c = JC.Supabase.getClient();
        const r1 = await c.from('wa_customers').delete({ count: 'exact' }).is('owner_id', null);
        const r2 = await c.from('wa_deals').delete({ count: 'exact' }).is('owner_id', null);
        const total = (r1.count || 0) + (r2.count || 0);
        status.textContent = `✅ 已清理 ${total} 条幽灵数据（咨询 ${r1.count || 0} + 成单 ${r2.count || 0}）`;
        btn.textContent = '✅ 清理完成';
        u.toast(`已清理 ${total} 条幽灵数据`);
        setTimeout(() => { btn.textContent = '🗑️ 清理幽灵数据'; btn.disabled = false; }, 3000);
      } catch (e) {
        status.textContent = '❌ 清理失败: ' + (e.message || '未知错误');
        btn.textContent = '🗑️ 重试清理';
        btn.disabled = false;
      }
    });
    document.getElementById('btn-auth-check').addEventListener('click', async () => {
      const status = document.getElementById('clean-status');
      status.style.display = 'block';
      status.textContent = '正在检查登录状态...';
      const auth = await JC.Supabase.getAuthStatus();
      if (auth.ok) {
        status.textContent = `✅ 已登录，用户: ${auth.user.email}，token前缀: ${auth.token}`;
      } else {
        status.textContent = `❌ ${auth.message}`;
      }
    });
  }

  return { render };
})();
