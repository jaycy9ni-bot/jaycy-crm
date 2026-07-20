// ============================================================
// Jaycy CRM V3 - 通知 & 定时提醒系统
// ============================================================
window.JC = window.JC || {};

JC.Notification = (() => {
  const u = JC.Utils;
  let checkerInterval = null;

  function init() {
    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function startTaskChecker() {
    // 每分钟检查一次是否有到期的定时任务
    if (checkerInterval) clearInterval(checkerInterval);
    checkTasks();
    checkerInterval = setInterval(checkTasks, 60000);
  }

  async function checkTasks() {
    try {
      const tasks = await JC.Store.getTasks({ today: true });
      const now = u.nowTime();
      const pending = tasks.filter(t => t.status === 'pending' && t.due_time && t.due_time <= now);

      // 更新通知铃铛
      updateBadge(pending.length);

      // 检查是否有刚好到时间的（前后1分钟内）
      const justDue = tasks.filter(t => {
        if (t.status !== 'pending' || !t.due_time) return false;
        const [th, tm] = t.due_time.split(':').map(Number);
        const [nh, nm] = now.split(':').map(Number);
        const diff = Math.abs((th * 60 + tm) - (nh * 60 + nm));
        return diff <= 1;
      });

      for (const task of justDue) {
        showReminder(task);
      }

      // 睡前检查（21:00-23:00 且未完成）
      if (now >= '21:00' && now <= '23:00') {
        const dailyReview = tasks.find(t => t.task_type === 'daily_review' && t.status === 'pending');
        if (dailyReview) {
          showEveningChecklist();
        }
      }
    } catch (e) { /* 静默失败 */ }
  }

  function updateBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function showReminder(task) {
    // 浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`⏰ ${task.title}`, {
        body: task.description || `${task.module_code === 'wa' ? '西澳' : '小羚'}待办提醒`,
        icon: '/jaycy-crm/icons/icon-192.png',
      });
    }

    // App 内弹窗
    showPopup(task);
  }

  function showPopup(task) {
    // 移除已有弹窗
    const existing = document.getElementById('reminder-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'reminder-popup';
    popup.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;z-index:300;padding:20px;
    `;
    popup.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">⏰</div>
        <h3 style="margin-bottom:8px;">${u.esc(task.title)}</h3>
        ${task.description ? `<p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">${u.esc(task.description)}</p>` : ''}
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary flex-1" id="reminder-done">✓ 已完成</button>
          <button class="btn btn-ghost flex-1" id="reminder-snooze">10分钟后</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelector('#reminder-done').addEventListener('click', async () => {
      await JC.Store.completeTask(task.id);
      popup.remove();
      u.toast('已标记完成 ✅');
    });

    popup.querySelector('#reminder-snooze').addEventListener('click', () => {
      popup.remove();
      u.toast('10分钟后再次提醒');
      // 简单实现：10分钟后再次弹出
      setTimeout(() => showReminder(task), 600000);
    });
  }

  function showEveningChecklist() {
    // 检查今天是否已经弹出过
    const today = u.today();
    const lastShown = localStorage.getItem('jc_evening_checklist');
    if (lastShown === today) return;

    const existing = document.getElementById('reminder-popup');
    if (existing) return; // 如果已有弹窗就不弹

    const popup = document.createElement('div');
    popup.id = 'reminder-popup';
    popup.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;z-index:300;padding:20px;
    `;
    popup.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:320px;width:100%;">
        <div style="font-size:40px;margin-bottom:12px;text-align:center;">🌙</div>
        <h3 style="margin-bottom:16px;text-align:center;">睡前检查清单</h3>
        <div style="font-size:14px;">
          <label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">
            <input type="checkbox" id="check-records"> 📋 更新客户群记录表
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">
            <input type="checkbox" id="check-deals"> 💰 更新成单表
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">
            <input type="checkbox" id="check-reviews"> 📞 回访结束行程的客户
          </label>
        </div>
        <button class="btn btn-primary btn-block mt-16" id="checklist-done">全部完成 ✓</button>
        <button class="btn btn-ghost btn-block mt-8" id="checklist-skip">今天跳过</button>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelector('#checklist-done').addEventListener('click', async () => {
      localStorage.setItem('jc_evening_checklist', today);
      popup.remove();
      // 标记睡前检查任务完成
      const tasks = await JC.Store.getTasks({ today: true });
      const review = tasks.find(t => t.task_type === 'daily_review' && t.status === 'pending');
      if (review) await JC.Store.completeTask(review.id);
      u.toast('辛苦了，晚安 🌙');
    });

    popup.querySelector('#checklist-skip').addEventListener('click', () => {
      localStorage.setItem('jc_evening_checklist', today);
      popup.remove();
    });
  }

  function showPanel() {
    // 移除已有面板
    const existing = document.getElementById('notif-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:250;
      display:flex;justify-content:flex-end;
    `;
    panel.innerHTML = `
      <div style="width:100%;max-width:360px;background:#fff;height:100%;overflow-y:auto;padding:16px;" onclick="event.stopPropagation()">
        <div class="flex-between mb-16">
          <h3>🔔 通知</h3>
          <button class="btn-icon" onclick="document.getElementById('notif-panel').remove()">✕</button>
        </div>
        <div id="notif-list"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `;
    panel.addEventListener('click', () => panel.remove());
    document.body.appendChild(panel);

    // 加载今日任务
    JC.Store.getTasks({ today: true }).then(tasks => {
      const list = document.getElementById('notif-list');
      if (!list) return;
      if (tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>暂无通知</p></div>';
        return;
      }
      const moduleLabel = { wa: '🦘', xl: '🦊', common: '📌' };
      list.innerHTML = tasks.map(t => `
        <div style="padding:12px;border-radius:8px;margin-bottom:8px;background:${t.status === 'completed' ? 'var(--success-light)' : 'var(--bg)'};">
          <div class="flex-between">
            <span style="font-weight:600;">${moduleLabel[t.module_code] || ''} ${u.esc(t.title)}</span>
            <span class="text-xs text-muted">${t.due_time || ''}</span>
          </div>
          ${t.description ? `<div class="text-sm text-muted mt-4">${u.esc(t.description)}</div>` : ''}
          ${t.status === 'pending' ? `
            <button class="btn btn-sm btn-primary mt-8" onclick="JC.Store.completeTask('${t.id}').then(()=>{document.getElementById('notif-panel').remove();JC.Router.renderPage();})">标记完成</button>
          ` : '<span class="badge badge-A text-xs mt-8">已完成</span>'}
        </div>
      `).join('');
    });
  }

  return { init, startTaskChecker, showPanel };
})();
