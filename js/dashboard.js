// ============================================================
// Jaycy CRM V3 - 统一仪表盘
// ============================================================
window.JC = window.JC || {};

JC.Dashboard = (() => {
  const u = JC.Utils;

  async function render(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>加载中...</p></div>';

    try {
      const [stats, tasks, notices] = await Promise.all([
        JC.Store.getDashboardStats(),
        JC.Store.getTasks({ today: true }),
        JC.Store.waGetNotices(),
      ]);

      container.innerHTML = `
        <!-- 今日统计 -->
        <div class="stat-grid">
          <div class="stat-card" onclick="JC.Router.navigate('wa')">
            <div class="stat-number">${stats.waTotal}</div>
            <div class="stat-label">📋 咨询客户</div>
          </div>
          <div class="stat-card" onclick="JC.Router.navigate('wa', 'deals')">
            <div class="stat-number" style="color:var(--success)">${stats.waDeals}</div>
            <div class="stat-label">💰 已成交</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color:var(--primary)">${stats.waActive}</div>
            <div class="stat-label">🔄 跟进中</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color:var(--warning)">${stats.tasksToday}</div>
            <div class="stat-label">📌 今日待办</div>
          </div>
        </div>

        <!-- 老板通知（最显眼位置） -->
        ${notices.length > 0 ? `
        <div class="card" style="border-left:4px solid var(--danger);">
          <div class="card-header">
            <span class="card-title">🔔 老板通知（${notices.length}条）</span>
          </div>
          ${notices.map(n => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);">
              <div class="flex-between">
                <div class="flex gap-8">
                  <span class="badge" style="background:${n.type === 'discount' ? 'var(--success-light)' : 'var(--danger-light)'};color:${n.type === 'discount' ? 'var(--success)' : 'var(--danger)'};">
                    ${n.type === 'discount' ? '折扣' : n.type === 'room_status' ? '房态' : '通知'}
                  </span>
                  <strong style="font-size:14px;">${u.esc(n.title)}</strong>
                </div>
                <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();JC.Store.waDismissNotice('${n.id}').then(()=>JC.Router.renderPage())">✕</button>
              </div>
              ${n.content ? `<div class="text-sm text-muted mt-4">${u.esc(n.content)}</div>` : ''}
              ${n.valid_from ? `<div class="text-xs text-muted mt-2">有效期: ${u.formatDate(n.valid_from)} ~ ${u.formatDate(n.valid_to)}</div>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        <!-- 今日待办 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📌 今日待办</span>
            <span class="text-xs text-muted">${u.today()}</span>
          </div>
          ${renderTimeline(tasks)}
        </div>

        <!-- 快捷操作 -->
        <div class="card">
          <div class="card-title mb-12">⚡ 快捷操作</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="JC.Router.navigate('add')">🤖 AI 录入客户</button>
            <button class="btn btn-outline btn-sm" onclick="JC.Router.navigate('wa')">📋 咨询表</button>
            <button class="btn btn-outline btn-sm" onclick="JC.Router.navigate('wa','deals')">💰 成单表</button>
            <button class="btn btn-outline btn-sm" onclick="JC.Router.navigate('wa','notices')">🔔 加通知</button>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>加载失败</p><button class="btn btn-outline btn-sm mt-12" onclick="JC.Router.renderPage()">重试</button></div>`;
    }
  }

  function renderTimeline(tasks) {
    if (!tasks.length) return '<div class="text-center text-muted text-sm" style="padding:16px;">🎉 今天暂无待办</div>';

    const moduleLabel = { wa: '🦘', xl: '🦊', common: '📌' };
    const sorted = [...tasks].sort((a, b) => (a.due_time || '99:99').localeCompare(b.due_time || '99:99'));

    return sorted.map((t, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;${i < sorted.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
        <div style="font-weight:600;min-width:45px;color:var(--text-secondary);font-size:13px;">${t.due_time || '全天'}</div>
        <div style="flex:1;font-size:14px;">
          ${moduleLabel[t.module_code] || ''} ${u.esc(t.title)}
          ${t.description ? `<div class="text-xs text-muted mt-2">${u.esc(t.description)}</div>` : ''}
        </div>
        ${t.status === 'pending' ? `
          <button class="btn btn-sm btn-outline" onclick="JC.Store.completeTask('${t.id}').then(()=>JC.Router.renderPage())">✓</button>
        ` : '<span class="badge badge-A">✓</span>'}
      </div>
    `).join('');
  }

  return { render };
})();
