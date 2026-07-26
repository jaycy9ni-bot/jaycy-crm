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
        <div class="card-title mb-12">📥 数据导入</div>
        <p class="text-sm text-muted mb-8">导入历史数据（一次性操作）</p>
        <button class="btn btn-warning btn-sm btn-block mb-8" id="btn-import-deals" style="background:#F59E0B;color:#fff;border:none;">📥 导入 45 条历史成单</button>
        <button class="btn btn-warning btn-sm btn-block" id="btn-import-customers" style="background:#8B5CF6;color:#fff;border:none;">📥 导入 208 条历史咨询</button>
        <p id="import-status" class="text-xs text-muted mt-4" style="display:none;"></p>
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
        <button class="btn btn-danger btn-sm btn-block" id="btn-clean-orphans" style="background:#EF4444;color:#fff;border:none;">🗑️ 清理幽灵数据</button>
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
    document.getElementById('btn-import-deals').addEventListener('click', async () => {
      const btn = document.getElementById('btn-import-deals');
      const status = document.getElementById('import-status');
      btn.disabled = true;
      btn.textContent = '⏳ 导入中...';
      status.style.display = 'block';
      status.textContent = '正在导入 45 条成单数据...';

      try {
        const result = await JC.ImportDeals.importAll((done, total, ok, err) => {
          status.textContent = `进度: ${done}/${total} · 成功 ${ok} · 失败 ${err}`;
        });
        status.textContent = `✅ 完成！成功 ${result.success} 条，失败 ${result.fail} 条`;
        btn.textContent = '✅ 导入完成';
        u.toast(`导入完成：成功 ${result.success} 条`);
        // 延迟刷新
        setTimeout(() => { btn.textContent = '📥 导入 45 条历史成单'; btn.disabled = false; }, 3000);
      } catch (e) {
        status.textContent = '❌ 导入失败: ' + (e.message || '未知错误');
        btn.textContent = '📥 重试导入';
        btn.disabled = false;
      }
    });
    document.getElementById('btn-import-customers').addEventListener('click', async () => {
      const btn = document.getElementById('btn-import-customers');
      const status = document.getElementById('import-status');
      btn.disabled = true;
      btn.textContent = '⏳ 导入中...';
      status.style.display = 'block';
      status.textContent = '正在导入 208 条咨询数据...';

      try {
        const result = await JC.ImportCustomers.importAll((done, total, ok, err) => {
          status.textContent = `进度: ${done}/${total} · 成功 ${ok} · 失败 ${err}`;
        });
        status.textContent = `✅ 完成！成功 ${result.success} 条，失败 ${result.fail} 条`;
        btn.textContent = '✅ 导入完成';
        u.toast(`导入完成：成功 ${result.success} 条`);
        setTimeout(() => { btn.textContent = '📥 导入 208 条历史咨询'; btn.disabled = false; }, 3000);
      } catch (e) {
        status.textContent = '❌ 导入失败: ' + (e.message || '未知错误');
        btn.textContent = '📥 重试导入';
        btn.disabled = false;
      }
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
  }

  return { render };
})();
