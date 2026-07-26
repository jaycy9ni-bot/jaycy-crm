// ============================================================
// Jaycy CRM V3 - 小羚不卷模块（纯提醒工具，不管理客户数据）
// ============================================================
window.JC = window.JC || {};

JC.XL = (() => {
  const u = JC.Utils;

  async function render(container, view) {
    container.innerHTML = `
      <div id="xl-content"><div class="loading"><div class="spinner"></div></div></div>
    `;
    await renderReminders(document.getElementById('xl-content'));
  }

  async function renderReminders(container) {
    const tasks = await JC.Store.getTasks({ moduleCode: 'xl' });
    const today = u.today();
    const isWed = u.isWednesday();
    const isWeekday = u.isWeekday();

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const completedToday = tasks.filter(t => t.status === 'completed');

    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-12">🦊 小羚不卷 · 每日提醒</div>
        <p class="text-sm text-muted mb-16">微伴系统已管理 tag/话术/群发，CRM 只负责提醒你</p>
      </div>

      <!-- 固定提醒 -->
      <div class="card">
        <div class="card-title mb-12">📌 固定节奏</div>
        <div style="font-size:14px;">
          <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
            <span>⏰ 14:30 微伴群发</span>
            <span class="text-sm ${isWeekday ? 'text-primary' : 'text-muted'}">${isWeekday ? '今天' : '非工作日'}</span>
          </div>
          <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
            <span>📱 朋友圈发送</span>
            <span class="text-sm text-muted">每日</span>
          </div>
          <div class="flex-between" style="padding:10px 0;">
            <span>📞 周三例会 ${isWed ? '🔴' : ''}</span>
            <span class="text-sm ${isWed ? 'text-danger font-bold' : 'text-muted'}">${isWed ? '今天 15:00' : '周三'}</span>
          </div>
        </div>
      </div>

      <!-- 今日待办任务 -->
      <div class="card">
        <div class="card-title mb-12">📋 今日任务 (${pendingTasks.length})</div>
        ${!pendingTasks.length ? '<p class="text-sm text-muted">🎉 今天没有待办</p>' :
          pendingTasks.map(t => `
            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
              <div>
                <strong>${u.esc(t.title)}</strong>
                <div class="text-xs text-muted mt-2">${t.due_time || ''} ${t.recurring ? '· 周期' : ''}</div>
              </div>
              <button class="btn btn-sm btn-outline" onclick="JC.Store.completeTask('${t.id}').then(()=>JC.Router.renderPage())">✓</button>
            </div>
          `).join('')}
      </div>

      <!-- 添加自定义提醒 -->
      <div class="card">
        <div class="card-title mb-12">➕ 添加自定义提醒</div>
        <div class="form-group"><label class="form-label">提醒内容</label><input class="form-input" id="new-reminder-title" placeholder="如：10:00 回复张总私信"></div>
        <div class="form-group"><label class="form-label">提醒时间</label><input class="form-input" type="time" id="new-reminder-time" value="${u.nowTime()}"></div>
        <button class="btn btn-primary btn-block" id="btn-add-reminder">添加提醒</button>
      </div>

      <!-- 今日完成 -->
      ${completedToday.length > 0 ? `
        <div class="card">
          <div class="card-title mb-8">✅ 今日已完成 (${completedToday.length})</div>
          ${completedToday.map(t => `<div class="text-sm text-muted" style="padding:4px 0;">✓ ${u.esc(t.title)}</div>`).join('')}
        </div>
      ` : ''}
    `;

    document.getElementById('btn-add-reminder')?.addEventListener('click', async () => {
      const title = document.getElementById('new-reminder-title').value.trim();
      const time = document.getElementById('new-reminder-time').value;
      if (!title) { u.toast('请输入提醒内容'); return; }
      await JC.Store.saveTask({
        module_code: 'xl', title, due_time: time, due_date: u.today(),
        task_type: 'custom', priority: 'normal', status: 'pending',
      });
      u.toast('已添加 ✅');
      JC.Router.renderPage();
    });
  }

  return { render };
})();
