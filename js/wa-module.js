// ============================================================
// Jaycy CRM V3 - 西澳模块
// 咨询表（智能表格风格下拉选择）+ 成单表（匹配老板要求）
// ============================================================
window.JC = window.JC || {};

JC.WA = (() => {
  const u = JC.Utils;

  // 产品选项（22个）
  const PRODUCTS = [
    '玛格丽特河一日', '波浪岩一日', '粉湖两日', '粉湖三日',
    '纯玩三日A', '纯玩三日B', '纯玩三日C',
    '纯玩四日A', '纯玩四日B', '纯玩四日C',
    '纯玩五日', '轻松四日', '杰伦五日', '经典五日', '浪漫五日',
    '明星六日', '纯粹六日', '奇观六日', '全景七日'
  ];

  // 意向程度选项
  const INTENT_LEVELS = [
    '高（在等签证或者朋友）',
    '中高（有希望）',
    '中低（咨询过但意向不明显）',
    '低（没怎么回复过或者未透露有效信息）',
    '距离出游时间还太远',
    '已流失（时间对不上/没有意向景点/出游时间已过）'
  ];

  // 订单状态
  const ORDER_STATUS = ['已完成', '待出行', '进行中', '已取消'];

  // 房型
  const ROOM_TYPES = ['大床房', '双床房', '单人间', '双床房（拼房）', '家庭房', ''];

  let currentView = 'customers';
  let currentFilter = 'all';

  async function render(container, view = 'customers') {
    currentView = view;
    container.innerHTML = `
      <div class="filter-bar" id="wa-subnav">
        <span class="filter-chip ${view === 'customers' ? 'active' : ''}" data-view="customers">📋 咨询表</span>
        <span class="filter-chip ${view === 'deals' ? 'active' : ''}" data-view="deals">💰 成单表</span>
        <span class="filter-chip ${view === 'reviews' ? 'active' : ''}" data-view="reviews">📞 回访</span>
        <span class="filter-chip ${view === 'notices' ? 'active' : ''}" data-view="notices">🔔 通知</span>
      </div>
      <div id="wa-content"></div>
    `;

    document.querySelectorAll('#wa-subnav .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => JC.Router.navigate('wa', chip.dataset.view));
    });

    const content = document.getElementById('wa-content');
    switch (view) {
      case 'customers': await renderCustomers(content); break;
      case 'deals': await renderDeals(container); break;
      case 'reviews': await renderReviews(content); break;
      case 'notices': await renderNotices(content); break;
    }
  }

  // ==================== 咨询表 ====================
  async function renderCustomers(container) {
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="btn btn-primary flex-1" onclick="JC.Router.navigate('add')">➕ 添加客户</button>
        <button class="btn btn-outline flex-1" onclick="JC.WA.exportCustomersCSV()">📥 导出咨询表</button>
      </div>
      <div class="search-bar"><input type="text" class="form-input" id="wa-search" placeholder="搜索微信名/联系方式..."></div>
      <div class="filter-bar" id="wa-filter">
        <span class="filter-chip active" data-filter="all">全部</span>
        <span class="filter-chip" data-filter="高">高</span>
        <span class="filter-chip" data-filter="中高">中高</span>
        <span class="filter-chip" data-filter="中低">中低</span>
        <span class="filter-chip" data-filter="低">低</span>
        <span class="filter-chip" data-filter="today">今日跟进</span>
        <span class="filter-chip" data-filter="deal">已成交</span>
      </div>
      <div id="wa-list"><div class="loading"><div class="spinner"></div></div></div>
    `;

    document.getElementById('wa-search').addEventListener('input', u.debounce(async (e) => {
      await loadCustomerList(e.target.value);
    }, 300));

    document.querySelectorAll('#wa-filter .filter-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        document.querySelectorAll('#wa-filter .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        await loadCustomerList(document.getElementById('wa-search')?.value || '');
      });
    });

    await loadCustomerList();
  }

  async function loadCustomerList(search = '') {
    const list = document.getElementById('wa-list');
    if (!list) return;

    const filters = {};
    if (['高', '中高', '中低', '低'].includes(currentFilter)) filters.intent = currentFilter;
    if (currentFilter === 'deal') filters.status = '已成交';
    if (currentFilter === 'today') filters.todayFollow = true;
    if (search) filters.search = search;

    const customers = await JC.Store.waGetCustomers(filters);

    if (!customers.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无咨询记录</p><p class="text-xs text-muted mt-8">点击底部 + 号录入新客户</p></div>';
      return;
    }

    list.innerHTML = customers.map(c => {
      const name = c.wechat_name || c.nickname || '未命名';
      const intentColor = c.intent_level?.startsWith('高') ? 'var(--success)' : c.intent_level?.startsWith('中高') ? 'var(--primary)' : c.intent_level?.startsWith('中低') ? 'var(--warning)' : 'var(--danger)';
      const intentBg = c.intent_level?.startsWith('高') ? 'var(--success-light)' : c.intent_level?.startsWith('中高') ? 'var(--primary-light)' : c.intent_level?.startsWith('中低') ? 'var(--warning-light)' : 'var(--danger-light)';
      const isDeal = c.inquiry_status === '已成交';
      return `
        <div class="card" onclick="JC.WA.showDetail('${c.id}')" style="cursor:pointer;${isDeal ? 'border-left:4px solid var(--success);' : ''}">
          <div class="flex-between">
            <div class="flex gap-8" style="align-items:center;">
              <strong>${u.esc(name)}</strong>
              ${c.intent_level ? `<span class="badge" style="background:${intentBg};color:${intentColor};">${c.intent_level}</span>` : ''}
              ${isDeal ? '<span class="badge badge-A">✅ 已成交</span>' : ''}
            </div>
            <span class="text-xs text-muted">${u.formatDate(c.first_inquiry_date)}</span>
          </div>
          <div class="mt-8 flex gap-8 flex-wrap" style="font-size:13px;color:var(--text-secondary);">
            ${c.plan_date ? `<span>📅 ${u.esc(c.plan_date || c.travel_date)}</span>` : ''}
            ${c.days ? `<span>📆 ${u.esc(c.days)}天</span>` : ''}
            ${c.people ? `<span>👥 ${u.esc(c.people || c.people_count)}人</span>` : ''}
            ${c.product_interest ? `<span>📦 ${u.esc(c.product_interest)}</span>` : ''}
          </div>
          ${c.blocker ? `<div class="mt-8 text-sm" style="color:var(--danger);">🚫 卡点: ${u.esc(c.blocker)}</div>` : ''}
          <div class="mt-8 text-sm ${u.isOverdue(c.next_follow_up_date) ? 'text-danger' : 'text-muted'}">
            ${c.inquiry_status || c.status || ''}
            ${c.next_follow_up_date ? ' · 下次跟进: ' + u.formatDate(c.next_follow_up_date) : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ==================== 客户详情 ====================
  async function showDetail(id) {
    const c = await JC.Store.waGetCustomer(id);
    if (!c) { u.toast('客户不存在'); return; }

    const relevantNotices = await JC.Store.checkNoticeRelevance(c);
    const logs = await JC.Store.getFollowUpLogs('wa', id);
    const name = c.wechat_name || c.nickname || '未命名';

    const intentColor = c.intent_level?.startsWith('高') ? 'var(--success)' : c.intent_level?.startsWith('中高') ? 'var(--primary)' : c.intent_level?.startsWith('中低') ? 'var(--warning)' : 'var(--danger)';
    const intentBg = c.intent_level?.startsWith('高') ? 'var(--success-light)' : c.intent_level?.startsWith('中高') ? 'var(--primary-light)' : c.intent_level?.startsWith('中低') ? 'var(--warning-light)' : 'var(--danger-light)';

    showOverlay(`
      <div class="overlay-header">
        <h3>${u.esc(name)}</h3>
        <button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button>
      </div>
      <div class="overlay-body">
        <div class="flex-between mb-16">
          <span class="badge" style="background:${intentBg};color:${intentColor};font-size:16px;padding:4px 12px;">${c.intent_level || '?'}意向</span>
          <span class="badge">${u.esc(c.inquiry_status || c.status || '')}</span>
        </div>

        ${relevantNotices.length > 0 ? `
        <div class="card" style="border:2px solid var(--danger);background:var(--danger-light);margin-bottom:12px;">
          <div class="font-bold mb-4" style="color:var(--danger);">⚠️ 相关老板通知</div>
          ${relevantNotices.map(n => `<div class="text-sm">• ${u.esc(n.title)}${n.content ? '：' + u.esc(n.content) : ''}</div>`).join('')}
        </div>` : ''}

        <div class="card">
          <div class="card-title mb-12">📋 咨询信息</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;">
            ${kv('首询日期', u.formatDate(c.first_inquiry_date))}
            ${kv('微信名', c.wechat_name || c.nickname)}
            ${kv('联系方式', c.contact)}
            ${kv('计划出行', c.plan_date || c.travel_date)}
            ${kv('天数', c.days || c.travel_days)}
            ${kv('人数', c.people || c.people_count)}
            ${kv('意向套餐', c.product_interest || c.recommended_product)}
            ${kv('意向程度', c.intent_level)}
            ${kv('是否成单', c.inquiry_status === '已成交' ? '是' : '否')}
          </div>
        </div>

        ${c.blocker ? `<div class="card"><div class="card-title mb-8">🚫 卡点</div><p class="text-sm">${u.esc(c.blocker)}</p></div>` : ''}

        ${(c.follow_up_1 || c.follow_up_2 || c.follow_up_3) ? `
        <div class="card">
          <div class="card-title mb-8">📝 跟进记录</div>
          ${c.follow_up_1 ? `<div class="text-sm mb-8" style="padding:8px;background:var(--bg);border-radius:6px;">跟进1: ${u.esc(c.follow_up_1)}</div>` : ''}
          ${c.follow_up_2 ? `<div class="text-sm mb-8" style="padding:8px;background:var(--bg);border-radius:6px;">跟进2: ${u.esc(c.follow_up_2)}</div>` : ''}
          ${c.follow_up_3 ? `<div class="text-sm" style="padding:8px;background:var(--bg);border-radius:6px;">跟进3: ${u.esc(c.follow_up_3)}</div>` : ''}
        </div>` : ''}

        ${c.follow_up_script ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">💬 AI 跟进话术</span>
            <button class="btn btn-sm btn-outline" onclick="JC.Utils.copyToClipboard(\`${c.follow_up_script.replace(/`/g,'\\`').replace(/\\/g,'\\\\')}\`)">复制</button>
          </div>
          <p style="white-space:pre-wrap;font-size:14px;">${u.esc(c.follow_up_script)}</p>
        </div>` : ''}

        ${logs.length > 0 ? `
        <div class="card">
          <div class="card-title mb-8">📜 跟进日志 (${logs.length})</div>
          ${logs.map(l => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;"><div class="text-xs text-muted">${u.formatDateTime(l.created_at)}</div><div class="mt-4">${u.esc(l.content)}</div></div>`).join('')}
        </div>` : ''}
      </div>
      <div class="overlay-footer">
        <button class="btn btn-outline flex-1" onclick="JC.WA.editCustomer('${id}')">✏️ 编辑</button>
        <button class="btn btn-outline flex-1" onclick="JC.WA.addFollowUp('${id}')">📝 跟进</button>
        ${c.inquiry_status !== '已成交' ? `<button class="btn btn-primary flex-1" onclick="JC.WA.convertToDeal('${id}')">💰 转成单</button>` : ''}
      </div>
    `);
  }

  // ==================== 编辑客户（下拉选择） ====================
  async function editCustomer(id) {
    const c = await JC.Store.waGetCustomer(id);
    if (!c) return;
    document.querySelector('.overlay')?.remove();

    const productOptions = ['', ...PRODUCTS].map(p => `<option ${c.product_interest === p ? 'selected' : ''}>${p}</option>`).join('');
    const intentOptions = ['', ...INTENT_LEVELS].map(o => `<option ${c.intent_level === o ? 'selected' : ''}>${o}</option>`).join('');
    const statusOptions = ['咨询中', '已报价', '考虑中', '后续无回复', '无回复', '已成交', '已流失'].map(o => `<option ${(c.inquiry_status || c.status) === o ? 'selected' : ''}>${o}</option>`).join('');

    showOverlay(`
      <div class="overlay-header"><h3>编辑客户</h3><button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button></div>
      <div class="overlay-body">
        <div class="form-group"><label class="form-label">微信名 *</label><input class="form-input" id="e-name" value="${u.esc(c.wechat_name || c.nickname || '')}"></div>
        <div class="form-group"><label class="form-label">联系方式</label><input class="form-input" id="e-contact" value="${u.esc(c.contact || '')}"></div>
        <div class="form-group"><label class="form-label">首询日期</label><input class="form-input" type="date" id="e-first-date" value="${c.first_inquiry_date || ''}"></div>
        <div class="form-group"><label class="form-label">计划出行日期</label><input class="form-input" id="e-plan-date" value="${u.esc(c.plan_date || c.travel_date || '')}" placeholder="如 2026.8.1"></div>
        <div class="form-group"><label class="form-label">出行天数</label><input class="form-input" id="e-days" value="${u.esc(c.days || c.travel_days || '')}" placeholder="如 3"></div>
        <div class="form-group"><label class="form-label">人数</label><input class="form-input" id="e-people" value="${u.esc(c.people || c.people_count || '')}"></div>
        <div class="form-group"><label class="form-label">意向套餐</label><select class="form-select" id="e-product">${productOptions}</select></div>
        <div class="form-group"><label class="form-label">意向程度</label><select class="form-select" id="e-intent">${intentOptions}</select></div>
        <div class="form-group"><label class="form-label">卡点</label><input class="form-input" id="e-blocker" value="${u.esc(c.blocker || '')}" placeholder="客户卡在哪里？如等机票/等签证/价格敏感"></div>
        <div class="form-group"><label class="form-label">状态</label><select class="form-select" id="e-status">${statusOptions}</select></div>
        <div class="form-group"><label class="form-label">跟进-1</label><textarea class="form-textarea" id="e-fu1" style="min-height:60px;">${u.esc(c.follow_up_1 || '')}</textarea></div>
        <div class="form-group"><label class="form-label">跟进-2</label><textarea class="form-textarea" id="e-fu2" style="min-height:60px;">${u.esc(c.follow_up_2 || '')}</textarea></div>
        <div class="form-group"><label class="form-label">跟进-3</label><textarea class="form-textarea" id="e-fu3" style="min-height:60px;">${u.esc(c.follow_up_3 || '')}</textarea></div>
        <div class="form-group"><label class="form-label">下次跟进日期</label><input class="form-input" type="date" id="e-next-fu" value="${c.next_follow_up_date || ''}"></div>
      </div>
      <div class="overlay-footer"><button class="btn btn-primary btn-block" id="btn-save">💾 保存</button></div>
    `);

    document.getElementById('btn-save').addEventListener('click', async () => {
      await JC.Store.waSaveCustomer({
        id, wechat_name: document.getElementById('e-name').value.trim(), nickname: document.getElementById('e-name').value.trim(),
        contact: document.getElementById('e-contact').value.trim(),
        first_inquiry_date: document.getElementById('e-first-date').value,
        plan_date: document.getElementById('e-plan-date').value.trim(), travel_date: document.getElementById('e-plan-date').value.trim(),
        days: document.getElementById('e-days').value.trim(), travel_days: document.getElementById('e-days').value.trim(),
        people: document.getElementById('e-people').value.trim(), people_count: document.getElementById('e-people').value.trim(),
        product_interest: document.getElementById('e-product').value,
        intent_level: document.getElementById('e-intent').value,
        blocker: document.getElementById('e-blocker').value.trim(),
        inquiry_status: document.getElementById('e-status').value, status: document.getElementById('e-status').value,
        follow_up_1: document.getElementById('e-fu1').value, follow_up_2: document.getElementById('e-fu2').value, follow_up_3: document.getElementById('e-fu3').value,
        next_follow_up_date: document.getElementById('e-next-fu').value,
      });
      document.querySelector('.overlay')?.remove();
      u.toast('已保存 ✅');
      JC.Router.renderPage();
    });
  }

  // ==================== 添加跟进 ====================
  async function addFollowUp(id) {
    document.querySelector('.overlay')?.remove();
    const c = await JC.Store.waGetCustomer(id);

    showOverlay(`
      <div class="overlay-header"><h3>添加跟进 - ${u.esc(c.wechat_name || c.nickname)}</h3><button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button></div>
      <div class="overlay-body">
        <div class="form-group"><label class="form-label">跟进内容</label><textarea class="form-textarea" id="fu-content" placeholder="记录本次跟进内容..."></textarea></div>
        <div class="form-group"><label class="form-label">下次跟进日期</label><input class="form-input" type="date" id="fu-next-date"></div>
      </div>
      <div class="overlay-footer"><button class="btn btn-primary btn-block" id="btn-save-fu">💾 保存</button></div>
    `);

    document.getElementById('btn-save-fu').addEventListener('click', async () => {
      const content = document.getElementById('fu-content').value.trim();
      if (!content) { u.toast('请输入跟进内容'); return; }
      const updates = { id };
      if (!c.follow_up_1) updates.follow_up_1 = content;
      else if (!c.follow_up_2) updates.follow_up_2 = content;
      else updates.follow_up_3 = content;
      const nextDate = document.getElementById('fu-next-date').value;
      if (nextDate) updates.next_follow_up_date = nextDate;
      await JC.Store.waSaveCustomer(updates);
      await JC.Store.addFollowUpLog({ module_code: 'wa', customer_id: id, content, method: '微信' });
      document.querySelector('.overlay')?.remove();
      u.toast('跟进已记录 ✅');
      JC.Router.renderPage();
    });
  }

  // ==================== 转成单 ====================
  async function convertToDeal(id) {
    document.querySelector('.overlay')?.remove();
    const c = await JC.Store.waGetCustomer(id);
    const name = c.wechat_name || c.nickname || '';

    const productOptions = ['', ...PRODUCTS].map(p => `<option ${(c.product_interest || c.recommended_product) === p ? 'selected' : ''}>${p}</option>`).join('');
    const roomOptions = ROOM_TYPES.map(r => `<option ${r ? '' : ''}>${r}</option>`).join('');
    const statusOptions = ORDER_STATUS.map(o => `<option ${o === '待出行' ? 'selected' : ''}>${o}</option>`).join('');

    showOverlay(`
      <div class="overlay-header"><h3>💰 转成单 - ${u.esc(name)}</h3><button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button></div>
      <div class="overlay-body">
        <div class="form-group"><label class="form-label">客户微信名</label><input class="form-input" id="d-wechat" value="${u.esc(name)}"></div>
        <div class="form-group"><label class="form-label">产品 *</label><select class="form-select" id="d-product">${productOptions}</select></div>
        <div class="form-group"><label class="form-label">客户信息（姓名+性别）</label><input class="form-input" id="d-customer-info" value="${u.esc(name)}"></div>
        <div class="form-group"><label class="form-label">联系方式</label><input class="form-input" id="d-contact" value="${u.esc(c.contact || '')}"></div>
        <div class="form-group"><label class="form-label">出行日期</label><input class="form-input" id="d-travel-date" value="${u.esc(c.plan_date || c.travel_date || '')}"></div>
        <div class="form-group"><label class="form-label">出行天数</label><input class="form-input" id="d-days" value="${u.esc(c.days || c.travel_days || '')}"></div>
        <div class="form-group"><label class="form-label">人数</label><input class="form-input" id="d-people" value="${u.esc(c.people || c.people_count || '')}"></div>
        <div class="form-group"><label class="form-label">房型</label><select class="form-select" id="d-room">${roomOptions}</select></div>
        <div class="form-group"><label class="form-label">总价（AUD）</label><input class="form-input" id="d-price" placeholder="如 1198"></div>
        <div class="form-group"><label class="form-label">付款方式</label><input class="form-input" id="d-pay-method" placeholder="微信转账/澳币转账"></div>
        <div class="form-group"><label class="form-label">付款状态</label><input class="form-input" id="d-pay-status" placeholder="全款/定金+尾款"></div>
        <div class="form-group"><label class="form-label">成单日期 *</label><input class="form-input" type="date" id="d-order-date" value="${u.today()}"><div class="text-xs text-muted mt-4">⚠️ 提成按成单日期计算，27号为月结算分割线</div></div>
        <div class="form-group"><label class="form-label">尾款日期</label><input class="form-input" id="d-final-pay" placeholder="如 6.18"></div>
        <div class="form-group">
          <label class="form-label">接送机</label>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="display:flex;align-items:center;gap:4px;font-size:14px;"><input type="checkbox" id="d-pickup-check"> 接送机</label>
            <input class="form-input flex-1" id="d-pickup-flight" placeholder="航班号（如 MU739）">
          </div>
        </div>
        <div class="form-group"><label class="form-label">备注</label><textarea class="form-textarea" id="d-notes" style="min-height:60px;"></textarea></div>
        <div class="form-group"><label class="form-label">订单状态</label><select class="form-select" id="d-status">${statusOptions}</select></div>
      </div>
      <div class="overlay-footer"><button class="btn btn-primary btn-block" id="btn-save-deal">✅ 确认成单</button></div>
    `);

    document.getElementById('btn-save-deal').addEventListener('click', async () => {
      const product = document.getElementById('d-product').value;
      if (!product) { u.toast('请选择产品'); return; }
      const orderDate = document.getElementById('d-order-date').value;

      await JC.Store.waSaveDeal({
        customer_id: id,
        wechat_name: document.getElementById('d-wechat').value.trim(),
        product_name: product,
        order_date: orderDate,
        customer_info: document.getElementById('d-customer-info').value.trim(),
        contact_info: document.getElementById('d-contact').value.trim(),
        travel_date: document.getElementById('d-travel-date').value.trim(),
        travel_days: document.getElementById('d-days').value.trim(),
        people_count: parseInt(document.getElementById('d-people').value) || 0,
        room_type: document.getElementById('d-room').value,
        total_amount: document.getElementById('d-price').value.trim(),
        payment_method: document.getElementById('d-pay-method').value.trim(),
        payment_status: document.getElementById('d-pay-status').value.trim(),
        final_payment_date: document.getElementById('d-final-pay').value.trim(),
        pickup_dropoff: (document.getElementById('d-pickup-check')?.checked ? '☑ ' : '') + (document.getElementById('d-pickup-flight')?.value || ''),
        notes: document.getElementById('d-notes').value,
        agent_name: 'Jaycy',
        group_date: c.first_inquiry_date || u.today(),
      });

      await JC.Store.waSaveCustomer({ id, inquiry_status: '已成交', intent_level: '高' });
      document.querySelector('.overlay')?.remove();
      u.toast('成单已记录 🎉');
      JC.Router.renderPage();
    });
  }

  // ==================== 成单表 ====================
  async function renderDeals(container) {
    const content = document.getElementById('wa-content') || container;
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const deals = await JC.Store.waGetDeals();

    // 按结算月份分组
    const groups = {};
    for (const d of deals) {
      const month = d.settlement_month || '未分类';
      if (!groups[month]) groups[month] = [];
      groups[month].push(d);
    }
    const sortedMonths = Object.keys(groups).sort().reverse();

    let totalAmount = 0;
    deals.forEach(d => {
      const num = parseFloat(d.total_amount?.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) totalAmount += num;
    });

    content.innerHTML = `
      <button class="btn btn-primary btn-block mb-12" onclick="JC.WA.addManualDeal()">➕ 添加成单</button>
      <div class="card" style="background:var(--success-light);text-align:center;margin-bottom:16px;">
        <div class="stat-number" style="color:var(--success);">${deals.length}</div>
        <div class="stat-label">总成单数 · 累计 ${totalAmount.toLocaleString()} AUD</div>
        <button class="btn btn-outline btn-sm mt-8" onclick="JC.WA.exportDealsCSV()">📥 导出成单表（给老板）</button>
      </div>
      ${sortedMonths.map(month => `
        <div style="margin-bottom:8px;">
          <div style="background:var(--primary);color:#fff;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;margin-bottom:8px;">
            📅 ${month} · ${groups[month].length}单
          </div>
          ${groups[month].map(d => `
            <div class="card" style="margin-bottom:8px;">
              <div class="flex-between">
                <strong style="font-size:14px;">${u.esc(d.product_name)}</strong>
                <span class="badge badge-A">${d.settlement_month || ''}</span>
              </div>
              <div class="mt-8 text-sm text-muted">
                ${d.wechat_name ? `<span>💬 ${u.esc(d.wechat_name)}</span>` : ''}
                ${d.customer_info ? `<span class="ml-8">👤 ${u.esc(u.truncate(d.customer_info, 15))}</span>` : ''}
                ${d.people_count ? `<span class="ml-8">👥 ${d.people_count}人</span>` : ''}
                ${d.total_amount ? `<span class="ml-8">💰 ${u.esc(d.total_amount)}</span>` : ''}
              </div>
              <div class="mt-4 flex gap-8 text-xs flex-wrap">
                ${d.order_date ? `<span style="color:var(--primary);">📅 成单: ${u.formatDate(d.order_date)}</span>` : '<span style="color:var(--danger);">⚠️ 无成单日期</span>'}
                ${d.travel_date ? `<span class="text-muted">出行: ${u.esc(d.travel_date)}</span>` : ''}
                ${d.travel_days ? `<span class="text-muted">${d.travel_days}天</span>` : ''}
                ${d.room_type ? `<span class="text-muted">${u.esc(d.room_type)}</span>` : ''}
                ${d.payment_status ? `<span class="text-muted">${u.esc(u.truncate(d.payment_status, 15))}</span>` : ''}
              </div>
              ${d.pickup_dropoff && d.pickup_dropoff !== '无' ? `<div class="mt-4 text-xs text-primary">🚗 ${u.esc(d.pickup_dropoff)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  // ==================== 导出成单 CSV ====================
  async function exportDealsCSV() {
    const deals = await JC.Store.waGetDeals();
    // 字段顺序：序号/接单号/订单状态/成单日期/拉群日期/出行日期/出行天数/人数/产品/客户微信名/客户信息/联系方式/房型/总价/付款方式/付款状态/尾款日期/接送机/备注/评价/结算月份
    const headers = ['序号','接单号','订单状态','成单日期','拉群日期','出行日期','出行天数','人数','产品','客户微信名','客户信息','联系方式','房型','总价/付款备注','付款方式','付款状态','尾款日期','接送机','备注','评价','结算月份'];
    const rows = deals.map((d, i) => [
      i+1, d.agent_name || 'Jaycy', '已完成', d.order_date || '', d.group_date || '',
      d.travel_date || '', d.travel_days || '', d.people_count || '', d.product_name,
      d.wechat_name || '', d.customer_info || '', d.contact_info || '',
      d.room_type || '', d.total_amount || '', d.payment_method || '', d.payment_status || '',
      d.final_payment_date || '', d.pickup_dropoff || '', d.notes || '', d.review || '', d.settlement_month || ''
    ]);
    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c || '').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `成单表-Jaycy-${u.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    u.toast('导出完成 ✅');
  }

  // ==================== 导出咨询 CSV ====================
  async function exportCustomersCSV() {
    const customers = await JC.Store.waGetCustomers();
    // 咨询表导出字段（对齐群内实际信息：无联系方式，只有微信名+聊天内容）
    const headers = ['序号','微信名','微信号/联系方式','计划出行日期','出行天数','人数','意向套餐','意向程度','卡点','状态','首询日期','跟进1','跟进2','跟进3','下次跟进日期','聊天记录'];
    const rows = customers.map((c, i) => [
      i+1,
      c.wechat_name || c.nickname || '',
      c.contact || '',
      c.plan_date || c.travel_date || '',
      c.days || c.travel_days || '',
      c.people || c.people_count || '',
      c.product_interest || c.recommended_product || '',
      c.intent_level || '',
      c.blocker || '',
      c.inquiry_status || c.status || '',
      c.first_inquiry_date || '',
      c.follow_up_1 || '',
      c.follow_up_2 || '',
      c.follow_up_3 || '',
      c.next_follow_up_date || '',
      c.chat_history || ''
    ]);
    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c || '').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `咨询表-Jaycy-${u.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    u.toast('导出完成 ✅');
  }

  // ==================== 手动添加成单（独立，无需关联客户） ====================
  async function addManualDeal() {
    document.querySelector('.overlay')?.remove();
    const productOptions = ['', ...PRODUCTS].map(p => `<option>${p}</option>`).join('');
    const roomOptions = ROOM_TYPES.map(r => `<option>${r}</option>`).join('');
    const statusOptions = ORDER_STATUS.map(o => `<option ${o === '待出行' ? 'selected' : ''}>${o}</option>`).join('');

    showOverlay(`
      <div class="overlay-header"><h3>➕ 手动添加成单</h3><button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button></div>
      <div class="overlay-body">
        <div class="form-group"><label class="form-label">客户微信名</label><input class="form-input" id="d-wechat" placeholder="客户微信昵称"></div>
        <div class="form-group"><label class="form-label">产品 *</label><select class="form-select" id="d-product">${productOptions}</select></div>
        <div class="form-group"><label class="form-label">客户信息（姓名+性别）</label><input class="form-input" id="d-customer-info"></div>
        <div class="form-group"><label class="form-label">联系方式</label><input class="form-input" id="d-contact"></div>
        <div class="form-group"><label class="form-label">出行日期</label><input class="form-input" id="d-travel-date" placeholder="如 2026.8.1"></div>
        <div class="form-group"><label class="form-label">出行天数</label><input class="form-input" id="d-days" placeholder="如 3"></div>
        <div class="form-group"><label class="form-label">人数</label><input class="form-input" id="d-people" placeholder="如 2"></div>
        <div class="form-group"><label class="form-label">房型</label><select class="form-select" id="d-room">${roomOptions}</select></div>
        <div class="form-group"><label class="form-label">总价（AUD）</label><input class="form-input" id="d-price" placeholder="如 1198"></div>
        <div class="form-group"><label class="form-label">付款方式</label><input class="form-input" id="d-pay-method" placeholder="微信转账/澳币转账"></div>
        <div class="form-group"><label class="form-label">付款状态</label><input class="form-input" id="d-pay-status" placeholder="全款/定金+尾款"></div>
        <div class="form-group"><label class="form-label">成单日期 *</label><input class="form-input" type="date" id="d-order-date" value="${u.today()}"><div class="text-xs text-muted mt-4">⚠️ 提成按成单日期计算，27号为月结算分割线</div></div>
        <div class="form-group"><label class="form-label">尾款日期</label><input class="form-input" id="d-final-pay" placeholder="如 6.18"></div>
        <div class="form-group">
          <label class="form-label">接送机</label>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="display:flex;align-items:center;gap:4px;font-size:14px;"><input type="checkbox" id="d-pickup-check"> 接送机</label>
            <input class="form-input flex-1" id="d-pickup-flight" placeholder="航班号（如 MU739）">
          </div>
        </div>
        <div class="form-group"><label class="form-label">备注</label><textarea class="form-textarea" id="d-notes" style="min-height:60px;"></textarea></div>
        <div class="form-group"><label class="form-label">订单状态</label><select class="form-select" id="d-status">${statusOptions}</select></div>
      </div>
      <div class="overlay-footer"><button class="btn btn-primary btn-block" id="btn-save-manual-deal">✅ 保存成单</button></div>
    `);

    document.getElementById('btn-save-manual-deal').addEventListener('click', async () => {
      const product = document.getElementById('d-product').value;
      if (!product) { u.toast('请选择产品'); return; }
      const orderDate = document.getElementById('d-order-date').value || u.today();

      await JC.Store.waSaveDeal({
        wechat_name: document.getElementById('d-wechat').value.trim(),
        product_name: product,
        order_date: orderDate,
        customer_info: document.getElementById('d-customer-info').value.trim(),
        contact_info: document.getElementById('d-contact').value.trim(),
        travel_date: document.getElementById('d-travel-date').value.trim(),
        travel_days: document.getElementById('d-days').value.trim(),
        people_count: parseInt(document.getElementById('d-people').value) || 0,
        room_type: document.getElementById('d-room').value,
        total_amount: document.getElementById('d-price').value.trim(),
        payment_method: document.getElementById('d-pay-method').value.trim(),
        payment_status: document.getElementById('d-pay-status').value.trim(),
        final_payment_date: document.getElementById('d-final-pay').value.trim(),
        pickup_dropoff: (document.getElementById('d-pickup-check')?.checked ? '☑ ' : '') + (document.getElementById('d-pickup-flight')?.value || ''),
        notes: document.getElementById('d-notes').value,
        agent_name: 'Jaycy',
        group_date: u.today(),
      });

      document.querySelector('.overlay')?.remove();
      u.toast('成单已记录 🎉');
      JC.Router.renderPage();
    });
  }

  function renderAddCustomerButton() { return null; }

  // ==================== 回访提醒 ====================
  async function renderReviews(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const customers = await JC.Store.waGetCustomers();
    const todayFollow = customers.filter(c => c.next_follow_up_date === u.today());
    const overdue = customers.filter(c => c.next_follow_up_date && u.isOverdue(c.next_follow_up_date) && c.inquiry_status !== '已成交');

    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-8">📌 今日回访 (${todayFollow.length})</div>
        ${!todayFollow.length ? '<p class="text-sm text-muted">今天没有需要回访的客户 👍</p>' :
          todayFollow.map(c => `<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border);"><div><strong>${u.esc(c.wechat_name || c.nickname)}</strong><span class="badge ml-8">${c.intent_level || '?'}</span></div><button class="btn btn-sm btn-outline" onclick="JC.WA.showDetail('${c.id}')">查看</button></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title mb-8" style="color:var(--danger);">⚠️ 逾期未跟进 (${overdue.length})</div>
        ${!overdue.length ? '<p class="text-sm text-muted">没有逾期的客户 👍</p>' :
          overdue.slice(0, 20).map(c => `<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border);"><div><strong>${u.esc(c.wechat_name || c.nickname)}</strong><span class="text-xs text-danger ml-8">逾期: ${u.formatDate(c.next_follow_up_date)}</span></div><button class="btn btn-sm btn-outline" onclick="JC.WA.showDetail('${c.id}')">查看</button></div>`).join('')}
      </div>
    `;
  }

  // ==================== 老板通知 ====================
  async function renderNotices(container) {
    const notices = await JC.Store.waGetNotices();
    container.innerHTML = `
      <button class="btn btn-primary btn-block mb-16" id="btn-add-notice">➕ 添加通知</button>
      ${!notices.length ? '<div class="empty-state"><p>暂无通知</p></div>' :
        notices.map(n => `
          <div class="card" style="border-left:4px solid ${n.type === 'discount' ? 'var(--success)' : 'var(--danger)'};">
            <div class="flex-between">
              <div><span class="badge" style="background:${n.type === 'discount' ? 'var(--success-light)' : 'var(--danger-light)'};color:${n.type === 'discount' ? 'var(--success)' : 'var(--danger)'};">${n.type === 'discount' ? '折扣' : n.type === 'room_status' ? '房态' : '通知'}</span><strong class="ml-8">${u.esc(n.title)}</strong></div>
              <button class="btn btn-sm btn-ghost" onclick="JC.Store.waDismissNotice('${n.id}').then(()=>JC.Router.renderPage())">归档</button>
            </div>
            ${n.content ? `<p class="text-sm text-muted mt-8">${u.esc(n.content)}</p>` : ''}
          </div>
        `).join('')}
    `;
    document.getElementById('btn-add-notice')?.addEventListener('click', () => {
      showOverlay(`
        <div class="overlay-header"><h3>添加老板通知</h3><button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button></div>
        <div class="overlay-body">
          <div class="form-group"><label class="form-label">类型</label><select class="form-select" id="n-type"><option value="room_status">房态</option><option value="discount">折扣</option><option value="other">其他</option></select></div>
          <div class="form-group"><label class="form-label">标题 *</label><input class="form-input" id="n-title" placeholder="如：7月15日粉湖无双床房"></div>
          <div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="n-content"></textarea></div>
        </div>
        <div class="overlay-footer"><button class="btn btn-primary btn-block" id="btn-save-notice">保存</button></div>
      `);
      document.getElementById('btn-save-notice').addEventListener('click', async () => {
        const title = document.getElementById('n-title').value.trim();
        if (!title) { u.toast('请输入标题'); return; }
        await JC.Store.waSaveNotice({ type: document.getElementById('n-type').value, title, content: document.getElementById('n-content').value });
        document.querySelector('.overlay')?.remove();
        u.toast('已添加 ✅');
        JC.Router.renderPage();
      });
    });
  }

  // ==================== 工具 ====================
  function kv(label, value) {
    if (!value) return '';
    return `<div><span class="text-muted">${label}:</span> ${u.esc(String(value))}</div>`;
  }

  function showOverlay(html) {
    const existing = document.querySelector('.overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="overlay-content">${html}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  return { render, showDetail, editCustomer, addFollowUp, convertToDeal, exportDealsCSV, exportCustomersCSV, addManualDeal, PRODUCTS, INTENT_LEVELS, ROOM_TYPES, ORDER_STATUS, renderAddCustomerButton };
})();
