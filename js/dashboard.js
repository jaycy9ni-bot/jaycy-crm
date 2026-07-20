// ============================================================
// Jaycy CRM V3 - 统一仪表盘
// ============================================================
window.JC = window.JC || {};

JC.Dashboard = (() => {
  const u = JC.Utils;

  async function render(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p class="mt-8">加载仪表盘...</p></div>';

    try {
      const [stats, tasks, notices] = await Promise.all([
        JC.Store.getDashboardStats(),
        JC.Store.getTasks({ today: true }),
        JC.Store.waGetNotices(),
      ]);

      const isWed = u.isWednesday();

      container.innerHTML = `
        <!-- 今日待办统计 -->
        <div class="stat-grid">
          <div class="stat-card" onclick="JC.Router.navigate('wa')">
            <div class="stat-number">${stats.waTotal}</div>
            <div class="stat-label">🦘 西澳客户</div>
          </div>
          <div class="stat-card" onclick="JC.Router.navigate('xl')">
            <div class="stat-number">${stats.xlTotal}</div>
            <div class="stat-label">🦊 小羚线索</div>
          </div>
          <div class="stat-card" onclick="JC.Router.navigate('wa', 'deals')">
            <div class="stat-number" style="color:var(--success)">${stats.waDeals}</div>
            <div class="stat-label">✅ 已成交</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color:var(--warning)">${stats.tasksToday}</div>
            <div class="stat-label">📋 今日待办</div>
          </div>
        </div>

        <!-- 时间轴提醒 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">⏰ 今日时间线</span>
            <span class="text-xs text-muted">${u.today()}</span>
          </div>
          ${renderTimeline(tasks, isWed)}
        </div>

        <!-- 老板通知（西澳） -->
        ${notices.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">🔔 西澳通知</span>
            <span class="badge badge-B">${notices.length}条</span>
          </div>
          ${notices.map(n => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;">
              <span class="badge badge-${n.type === 'discount' ? 'A' : 'C'}" style="margin-right:6px">${n.type === 'discount' ? '折扣' : '房态'}</span>
              <strong>${u.esc(n.title)}</strong>
              ${n.content ? `<div class="text-sm text-muted mt-4">${u.esc(u.truncate(n.content, 60))}</div>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        <!-- 快捷操作 -->
        <div class="card">
          <div class="card-title mb-12">⚡ 快捷操作</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="JC.Router.navigate('add')">🤖 AI 解析录入</button>
            <button class="btn btn-outline btn-sm" onclick="JC.Router.navigate('wa')">📋 西澳客户管理</button>
            <button class="btn btn-outline btn-sm" onclick="JC.Router.navigate('xl')">👥 小羚线索管理</button>
            <button class="btn btn-outline btn-sm" onclick="JC.Router.navigate('xl','broadcast')">📢 群发排期</button>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败：${u.esc(err.message)}</p><button class="btn btn-outline btn-sm mt-12" onclick="JC.Router.renderPage()">重试</button></div>`;
    }
  }

  function renderTimeline(tasks, isWed) {
    if (tasks.length === 0) {
      return '<div class="text-center text-muted text-sm" style="padding:16px">🎉 今天没有待办任务</div>';
    }

    const timeOrdered = [...tasks].sort((a, b) => {
      if (!a.due_time) return 1;
      if (!b.due_time) return -1;
      return a.due_time.localeCompare(b.due_time);
    });

    const moduleLabel = { wa: '🦘', xl: '🦊', common: '📌' };
    const priorityIcon = { urgent: '🔴', high: '🟡', normal: '🔵', low: '⚪' };

    return timeOrdered.map((t, i) => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;${i < timeOrdered.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
        <div style="font-size:14px;font-weight:600;min-width:45px;color:var(--text-secondary);">${t.due_time || '全天'}</div>
        <div style="flex:1">
          <div style="font-size:14px;">
            ${priorityIcon[t.priority] || ''} ${moduleLabel[t.module_code] || ''} ${u.esc(t.title)}
          </div>
          ${t.description ? `<div class="text-xs text-muted mt-2">${u.esc(t.description)}</div>` : ''}
        </div>
        <button class="btn btn-sm ${t.priority === 'urgent' ? 'btn-primary' : 'btn-ghost'}"
          onclick="JC.Store.completeTask('${t.id}').then(()=>JC.Router.renderPage())">
          ✓
        </button>
      </div>
    `).join('');
  }

  return { render };
})();
