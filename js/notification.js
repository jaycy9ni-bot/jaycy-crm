// ============================================================
// Jaycy CRM V3 - 通知 & 定时提醒系统
// ============================================================
window.JC = window.JC || {};

JC.Notification = (() => {
  const u = JC.Utils;
  let checkerInterval = null;

  function init() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function startTaskChecker() {
    if (checkerInterval) clearInterval(checkerInterval);
    checkTasks();
    checkerInterval = setInterval(checkTasks, 60000);
  }

  async function checkTasks() {
    try {
      const tasks = await JC.Store.getTasks({ today: true });
      const now = u.nowTime();
      const pending = tasks.filter(t => t.status === 'pending');

      updateBadge(pending.length);

      // 检查刚好到时间的任务（前后1分钟）
      const justDue = pending.filter(t => {
        if (!t.due_time) return false;
        const [th, tm] = t.due_time.split(':').map(Number);
        const [nh, nm] = now.split(':').map(Number);
        return Math.abs((th * 60 + tm) - (nh * 60 + nm)) <= 1;
      });

      for (const task of justDue) {
        showReminder(task);
      }

      // 睡前检查（21:00-23:00）
      if (now >= '21:00' && now <= '23:00') {
        const dailyReview = pending.find(t => t.task_type === 'daily_review');
        if (dailyReview) showEveningChecklist();
      }

      // 上午追单提醒（9:30-11:00，仅工作日）
      if (now >= '09:30' && now <= '11:00' && u.isWeekday()) {
        const followUp = pending.find(t => t.task_type === 'follow_up' && t.module_code === 'wa');
        if (followUp) showMorningFollowUp();
      }
    } catch (e) { /* 静默 */ }
  }

  function updateBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  function showReminder(task) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`⏰ ${task.title}`, {
        body: task.description || `${task.module_code === 'wa' ? '西澳' : '小羚'}提醒`,
        icon: '/jaycy-crm/icons/icon-192.png',
      });
    }
    showPopup(task.title, task.description, async () => {
      await JC.Store.completeTask(task.id);
      JC.Router.renderPage();
    });
  }

  function showPopup(title, desc, onDone) {
    const existing = document.getElementById('reminder-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'reminder-popup';
    popup.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:300;padding:20px;';
    popup.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">⏰</div>
        <h3 style="margin-bottom:8px;">${u.esc(title)}</h3>
        ${desc ? `<p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">${u.esc(desc)}</p>` : ''}
        <button class="btn btn-primary btn-block" id="reminder-done">✓ 知道了</button>
      </div>
    `;
    document.body.appendChild(popup);
    popup.querySelector('#reminder-done').addEventListener('click', () => { popup.remove(); if (onDone) onDone(); });
    popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
  }

  function showEveningChecklist() {
    const today = u.today();
    if (localStorage.getItem('jc_evening') === today) return;
    if (document.getElementById('reminder-popup')) return;

    showPopup('🌙 睡前检查', '今天新咨询都录入了吗？\n今天有成单需要记的吗？\n有需要回访的客户吗？', async () => {
      localStorage.setItem('jc_evening', today);
      const tasks = await JC.Store.getTasks({ today: true });
      const review = tasks.find(t => t.task_type === 'daily_review' && t.status === 'pending');
      if (review) await JC.Store.completeTask(review.id);
    });
  }

  function showMorningFollowUp() {
    const today = u.today();
    if (localStorage.getItem('jc_morning_fu') === today) return;
    if (document.getElementById('reminder-popup')) return;

    showPopup('📋 上午追单时间', '打开客户列表，逐个检查：\n• 机票买了吗？\n• 签证办了吗？\n• 人数确定了吗？\n• 房型需要调整吗？', async () => {
      localStorage.setItem('jc_morning_fu', today);
      const tasks = await JC.Store.getTasks({ today: true });
      const fu = tasks.find(t => t.task_type === 'follow_up' && t.status === 'pending');
      if (fu) await JC.Store.completeTask(fu.id);
    });
  }

  function showPanel() {
    const existing = document.getElementById('notif-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:250;display:flex;justify-content:flex-end;';
    panel.innerHTML = `<div style="width:100%;max-width:360px;background:#fff;height:100%;overflow-y:auto;padding:16px;" onclick="event.stopPropagation()">
      <div class="flex-between mb-16"><h3>🔔 通知</h3><button class="btn-icon" onclick="document.getElementById('notif-panel').remove()">✕</button></div>
      <div id="notif-list"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
    panel.addEventListener('click', () => panel.remove());
    document.body.appendChild(panel);

    JC.Store.getTasks({ today: true }).then(tasks => {
      const list = document.getElementById('notif-list');
      if (!list) return;
      if (!tasks.length) { list.innerHTML = '<div class="empty-state"><p>暂无通知</p></div>'; return; }
      const modLabel = { wa: '🦘', xl: '🦊', common: '📌' };
      list.innerHTML = tasks.map(t => `
        <div style="padding:12px;border-radius:8px;margin-bottom:8px;background:${t.status === 'completed' ? 'var(--success-light)' : 'var(--bg)'};">
          <div class="flex-between"><span style="font-weight:600;">${modLabel[t.module_code] || ''} ${u.esc(t.title)}</span><span class="text-xs text-muted">${t.due_time || ''}</span></div>
          ${t.status === 'pending' ? `<button class="btn btn-sm btn-primary mt-8" onclick="JC.Store.completeTask('${t.id}').then(()=>{document.getElementById('notif-panel').remove();JC.Router.renderPage();})">标记完成</button>` : '<span class="badge badge-A text-xs mt-8">已完成</span>'}
        </div>
      `).join('');
    });
  }

  return { init, startTaskChecker, showPanel };
})();
