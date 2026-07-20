// ============================================================
// Jaycy CRM V3 - 小羚不卷模块（线索管理 / 群发 / 模板 / 任务）
// ============================================================
window.JC = window.JC || {};

JC.XL = (() => {
  const u = JC.Utils;
  let currentView = 'leads';
  let currentFilter = 'all';

  async function render(container, view = 'leads') {
    currentView = view;
    container.innerHTML = `
      <div class="filter-bar" id="xl-subnav">
        <span class="filter-chip ${view === 'leads' ? 'active' : ''}" data-view="leads">线索</span>
        <span class="filter-chip ${view === 'broadcast' ? 'active' : ''}" data-view="broadcast">群发</span>
        <span class="filter-chip ${view === 'templates' ? 'active' : ''}" data-view="templates">模板</span>
        <span class="filter-chip ${view === 'tasks' ? 'active' : ''}" data-view="tasks">任务</span>
      </div>
      <div id="xl-content"></div>
    `;

    document.querySelectorAll('#xl-subnav .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        JC.Router.navigate('xl', chip.dataset.view);
      });
    });

    const content = document.getElementById('xl-content');
    switch (view) {
      case 'leads': await renderLeads(content); break;
      case 'broadcast': await renderBroadcast(content); break;
      case 'templates': await renderTemplates(content); break;
      case 'tasks': await renderTasks(content); break;
    }
  }

  // ==================== 线索列表 ====================
  async function renderLeads(container) {
    container.innerHTML = `
      <div class="search-bar">
        <input type="text" class="form-input" id="xl-search" placeholder="搜索昵称/微信...">
      </div>
      <div class="filter-bar" id="xl-filter">
        <span class="filter-chip active" data-filter="all">全部</span>
        <span class="filter-chip" data-filter="new">新线索</span>
        <span class="filter-chip" data-filter="contacting">联系中</span>
        <span class="filter-chip" data-filter="converted">已转化</span>
        <span class="filter-chip" data-filter="no-form">未填表</span>
        <span class="filter-chip" data-filter="no-group">未拉群</span>
      </div>
      <div id="xl-list"><div class="loading"><div class="spinner"></div></div></div>
    `;

    document.getElementById('xl-search').addEventListener('input', u.debounce(async (e) => {
      await loadLeadList(e.target.value);
    }, 300));

    document.querySelectorAll('#xl-filter .filter-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        document.querySelectorAll('#xl-filter .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        await loadLeadList(document.getElementById('xl-search')?.value || '');
      });
    });

    await loadLeadList();
  }

  async function loadLeadList(search = '') {
    const list = document.getElementById('xl-list');
    if (!list) return;

    const filters = {};
    if (currentFilter === 'new') filters.status = 'new';
    else if (currentFilter === 'contacting') filters.status = 'contacting';
    else if (currentFilter === 'converted') filters.status = 'converted';
    else if (currentFilter === 'no-form') filters.formFilled = false;
    else if (currentFilter === 'no-group') filters.groupAdded = false;
    if (search) filters.search = search;

    const leads = await JC.Store.xlGetLeads(filters);

    if (leads.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无线索</p></div>';
      return;
    }

    list.innerHTML = leads.map(l => `
      <div class="card">
        <div class="flex-between">
          <div class="flex gap-8" style="align-items:center;">
            <strong>${u.esc(l.nickname)}</strong>
            <span class="badge">${u.statusLabel(l.status, 'xl')}</span>
          </div>
          <div class="flex gap-8">
            ${!l.group_added ? '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();JC.XL.startGroupFlow(\'' + l.id + '\')">拉群</button>' : '<span class="badge badge-A">已拉群</span>'}
          </div>
        </div>
        <div class="mt-8 flex gap-8 flex-wrap" style="font-size:13px;color:var(--text-secondary);">
          ${l.source ? `<span>📌 ${u.esc(l.source)}</span>` : ''}
          ${l.service_type ? `<span>📦 ${u.esc(l.service_type)}</span>` : ''}
          ${l.career_stage ? `<span>🎓 ${u.esc(l.career_stage)}</span>` : ''}
          ${l.urgency ? `<span>${l.urgency === '紧急' ? '🔴' : '🟢'} ${u.esc(l.urgency)}</span>` : ''}
        </div>
        <div class="mt-8 flex gap-8 flex-wrap" style="font-size:12px;">
          <span style="color:${l.form_filled ? 'var(--success)' : 'var(--text-muted)'}">${l.form_filled ? '✅' : '⬜'} 已填表</span>
          <span style="color:${l.group_added ? 'var(--success)' : 'var(--text-muted)'}">${l.group_added ? '✅' : '⬜'} 已拉群</span>
          <span style="color:${l.welcome_sent ? 'var(--success)' : 'var(--text-muted)'}">${l.welcome_sent ? '✅' : '⬜'} 欢迎语</span>
        </div>
      </div>
    `).join('');
  }

  // ==================== 拉群流程（核心快捷操作） ====================
  async function startGroupFlow(id) {
    const lead = await JC.Store.xlGetLead(id);
    if (!lead) { u.toast('线索不存在'); return; }

    // 获取模板
    const templates = await JC.Store.getTemplates('xl');
    const welcomeTemplates = templates.filter(t => t.category === '欢迎语');

    // AI 生成群名
    const groupName = `求职咨询-${lead.nickname}-${lead.career_stage || '求职'}`;

    showOverlay(`
      <div class="overlay-header">
        <h3>拉群流程: ${u.esc(lead.nickname)}</h3>
        <button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button>
      </div>
      <div class="overlay-body">
        <!-- Step 1: 拉群 -->
        <div class="card" style="border:2px solid var(--primary);">
          <div class="flex-between mb-8">
            <span class="font-bold">Step 1: 拉群</span>
            <span id="step1-status" class="badge ${lead.group_added ? 'badge-A' : ''}">${lead.group_added ? '✅ 已完成' : '⬜ 待完成'}</span>
          </div>
          <p class="text-sm text-muted mb-8">请在微信群中拉入客户和销售</p>
          ${!lead.group_added ? '<button class="btn btn-primary btn-sm" id="btn-step1">✓ 已拉群</button>' : ''}
        </div>

        <!-- Step 2: 改名 -->
        <div class="card mt-12" style="border:2px solid var(--border);">
          <div class="flex-between mb-8">
            <span class="font-bold">Step 2: 改名</span>
            <span id="step2-status" class="badge ${lead.group_name_changed ? 'badge-A' : ''}">${lead.group_name_changed ? '✅ 已完成' : '⬜ 待完成'}</span>
          </div>
          <div class="form-group">
            <label class="form-label">群名模板</label>
            <div class="flex gap-8">
              <input class="form-input flex-1" id="group-name" value="${u.esc(groupName)}">
              <button class="btn btn-outline btn-sm" onclick="JC.Utils.copyToClipboard(document.getElementById('group-name').value)">复制</button>
            </div>
          </div>
          ${!lead.group_name_changed ? '<button class="btn btn-primary btn-sm" id="btn-step2">✓ 已改名</button>' : ''}
        </div>

        <!-- Step 3: 欢迎语 -->
        <div class="card mt-12" style="border:2px solid var(--border);">
          <div class="flex-between mb-8">
            <span class="font-bold">Step 3: 欢迎语</span>
            <span id="step3-status" class="badge ${lead.welcome_sent ? 'badge-A' : ''}">${lead.welcome_sent ? '✅ 已完成' : '⬜ 待完成'}</span>
          </div>
          <div class="form-group">
            <label class="form-label">选择模板</label>
            <select class="form-select" id="welcome-template">
              ${welcomeTemplates.map(t => `<option value="${t.id}">${u.esc(t.name)}</option>`).join('')}
              ${welcomeTemplates.length === 0 ? '<option>暂无模板</option>' : ''}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">预览</label>
            <div id="welcome-preview" class="card" style="background:var(--bg);font-size:14px;white-space:pre-wrap;"></div>
          </div>
          ${!lead.welcome_sent ? '<button class="btn btn-primary btn-sm" id="btn-step3">✓ 已发欢迎语</button>' : ''}
        </div>
      </div>
      <div class="overlay-footer">
        <button class="btn btn-primary btn-block" id="btn-all-done" ${lead.group_added && lead.group_name_changed && lead.welcome_sent ? '' : 'disabled'}>
          🎉 全部完成
        </button>
      </div>
    `);

    // 更新欢迎语预览
    const updatePreview = () => {
      const tid = document.getElementById('welcome-template')?.value;
      const tmpl = welcomeTemplates.find(t => t.id === tid);
      const preview = document.getElementById('welcome-preview');
      if (preview && tmpl) {
        preview.textContent = u.renderTemplate(tmpl.content, { nickname: lead.nickname, service_type: lead.service_type || '', career_stage: lead.career_stage || '' });
      }
    };
    updatePreview();
    document.getElementById('welcome-template')?.addEventListener('change', updatePreview);

    // Step 1
    document.getElementById('btn-step1')?.addEventListener('click', async () => {
      await JC.Store.xlSaveLead({ id, group_added: true });
      document.getElementById('step1-status').textContent = '✅ 已完成';
      document.getElementById('step1-status').className = 'badge badge-A';
      document.getElementById('btn-step1').remove();
      checkAllDone();
      u.toast('已标记 ✓');
    });

    // Step 2
    document.getElementById('btn-step2')?.addEventListener('click', async () => {
      const name = document.getElementById('group-name').value.trim();
      await JC.Store.xlSaveLead({ id, group_name_changed: true, group_name: name });
      document.getElementById('step2-status').textContent = '✅ 已完成';
      document.getElementById('step2-status').className = 'badge badge-A';
      document.getElementById('btn-step2').remove();
      checkAllDone();
      u.toast('已标记 ✓');
    });

    // Step 3
    document.getElementById('btn-step3')?.addEventListener('click', async () => {
      await JC.Store.xlSaveLead({ id, welcome_sent: true });
      const tid = document.getElementById('welcome-template')?.value;
      if (tid) await JC.Store.incrementTemplateUsage(tid);
      document.getElementById('step3-status').textContent = '✅ 已完成';
      document.getElementById('step3-status').className = 'badge badge-A';
      document.getElementById('btn-step3').remove();
      checkAllDone();
      u.toast('已标记 ✓');
    });

    function checkAllDone() {
      const btn = document.getElementById('btn-all-done');
      if (btn) {
        const allDone = document.getElementById('step1-status')?.textContent.includes('✅') &&
                        document.getElementById('step2-status')?.textContent.includes('✅') &&
                        document.getElementById('step3-status')?.textContent.includes('✅');
        btn.disabled = !allDone;
      }
    }

    document.getElementById('btn-all-done')?.addEventListener('click', () => {
      document.querySelector('.overlay')?.remove();
      u.toast('拉群流程完成 🎉');
      JC.Router.renderPage();
    });
  }

  // ==================== 群发排期 ====================
  async function renderBroadcast(container) {
    const tasks = await JC.Store.getTasks({ moduleCode: 'xl' });
    const broadcastTasks = tasks.filter(t => t.task_type === 'broadcast');

    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-8">📢 群发排期</div>
        <p class="text-sm text-muted mb-12">固定群发时间: 工作日 14:30</p>
        ${broadcastTasks.length > 0 ? broadcastTasks.map(t => `
          <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
            <div>
              <strong>${u.esc(t.title)}</strong>
              <span class="text-xs text-muted ml-8">${t.due_time || ''}</span>
            </div>
            <span class="badge badge-${t.status === 'completed' ? 'A' : 'B'}">${t.status === 'completed' ? '已完成' : '待办'}</span>
          </div>
        `).join('') : '<p class="text-sm text-muted">暂无群发任务</p>'}
      </div>

      <div class="card">
        <div class="card-title mb-8">📅 今日排期</div>
        <p class="text-sm text-muted">群发时间: 14:30</p>
        <p class="text-sm text-muted mt-4">内容准备: 在微伴系统后台设置</p>
        <p class="text-sm text-muted mt-4">发送后回来标记完成 ✓</p>
      </div>
    `;
  }

  // ==================== 快捷回复模板 ====================
  async function renderTemplates(container) {
    const templates = await JC.Store.getTemplates('xl');
    const categories = [...new Set(templates.map(t => t.category || '其他'))];

    container.innerHTML = `
      <div class="filter-bar" id="tmpl-cat">
        <span class="filter-chip active" data-cat="all">全部</span>
        ${categories.map(c => `<span class="filter-chip" data-cat="${c}">${u.esc(c)}</span>`).join('')}
      </div>
      <div id="tmpl-list"></div>
    `;

    const renderList = (cat = 'all') => {
      const filtered = cat === 'all' ? templates : templates.filter(t => t.category === cat);
      const list = document.getElementById('tmpl-list');
      list.innerHTML = filtered.map(t => `
        <div class="card">
          <div class="flex-between mb-8">
            <strong>${u.esc(t.name)}</strong>
            <span class="badge">${u.esc(t.category || '')}</span>
          </div>
          <p style="white-space:pre-wrap;font-size:14px;color:var(--text-secondary);">${u.esc(u.truncate(t.content, 100))}</p>
          <div class="mt-8 flex gap-8">
            <button class="btn btn-sm btn-primary" onclick="JC.Utils.copyToClipboard(\`${t.content.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`);JC.Store.incrementTemplateUsage('${t.id}')">复制</button>
          </div>
        </div>
      `).join('') || '<div class="empty-state"><p>暂无模板</p></div>';
    };
    renderList();

    document.querySelectorAll('#tmpl-cat .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#tmpl-cat .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderList(chip.dataset.cat);
      });
    });
  }

  // ==================== 任务 ====================
  async function renderTasks(container) {
    const tasks = await JC.Store.getTasks({ moduleCode: 'xl' });

    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-12">📋 小羚任务</div>
        ${tasks.length === 0 ? '<p class="text-sm text-muted">暂无任务</p>' :
          tasks.map(t => `
            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
              <div>
                <strong>${u.esc(t.title)}</strong>
                <div class="text-xs text-muted mt-2">
                  ${t.due_time ? `⏰ ${t.due_time}` : ''}
                  ${t.recurring ? ` 🔄 ${t.recurring}` : ''}
                  ${t.due_date ? ` 📅 ${u.formatDate(t.due_date)}` : ''}
                </div>
              </div>
              ${t.status === 'pending'
                ? `<button class="btn btn-sm btn-primary" onclick="JC.Store.completeTask('${t.id}').then(()=>JC.Router.renderPage())">✓</button>`
                : '<span class="badge badge-A">已完成</span>'}
            </div>
          `).join('')
        }
      </div>
    `;
  }

  // ==================== 工具 ====================
  function showOverlay(innerHTML) {
    const existing = document.querySelector('.overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="overlay-content">${innerHTML}</div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  return { render, startGroupFlow };
})();
