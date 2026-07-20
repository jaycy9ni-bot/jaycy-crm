// ============================================================
// Jaycy CRM V3 - 西澳模块（客户管理 / 成单 / 回访 / 通知）
// ============================================================
window.JC = window.JC || {};

JC.WA = (() => {
  const u = JC.Utils;
  let currentView = 'customers';
  let currentFilter = 'all';

  async function render(container, view = 'customers') {
    currentView = view;
    container.innerHTML = `
      <div class="filter-bar" id="wa-subnav">
        <span class="filter-chip ${view === 'customers' ? 'active' : ''}" data-view="customers">客户</span>
        <span class="filter-chip ${view === 'deals' ? 'active' : ''}" data-view="deals">成单</span>
        <span class="filter-chip ${view === 'reviews' ? 'active' : ''}" data-view="reviews">回访</span>
        <span class="filter-chip ${view === 'notices' ? 'active' : ''}" data-view="notices">通知</span>
      </div>
      <div id="wa-content"></div>
    `;

    // 子导航绑定
    document.querySelectorAll('#wa-subnav .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const v = chip.dataset.view;
        JC.Router.navigate('wa', v);
      });
    });

    const content = document.getElementById('wa-content');
    switch (view) {
      case 'customers': await renderCustomers(content); break;
      case 'deals': await renderDeals(content); break;
      case 'reviews': await renderReviews(content); break;
      case 'notices': await renderNotices(content); break;
    }
  }

  // ==================== 客户列表 ====================
  async function renderCustomers(container) {
    container.innerHTML = `
      <div class="search-bar">
        <input type="text" class="form-input" id="wa-search" placeholder="搜索昵称/微信/联系方式...">
      </div>
      <div class="filter-bar" id="wa-filter">
        <span class="filter-chip active" data-filter="all">全部</span>
        <span class="filter-chip" data-filter="A">A级</span>
        <span class="filter-chip" data-filter="B">B级</span>
        <span class="filter-chip" data-filter="C">C级</span>
        <span class="filter-chip" data-filter="today">今日跟进</span>
        <span class="filter-chip" data-filter="deal">已成交</span>
      </div>
      <div id="wa-list"><div class="loading"><div class="spinner"></div></div></div>
    `;

    // 搜索
    document.getElementById('wa-search').addEventListener('input', u.debounce(async (e) => {
      await loadCustomerList(e.target.value);
    }, 300));

    // 筛选
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
    if (currentFilter === 'A') filters.grade = 'A';
    else if (currentFilter === 'B') filters.grade = 'B';
    else if (currentFilter === 'C') filters.grade = 'C';
    else if (currentFilter === 'today') filters.todayFollowUp = true;
    else if (currentFilter === 'deal') filters.outcome = '成交';
    if (search) filters.search = search;

    const customers = await JC.Store.waGetCustomers(filters);

    if (customers.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无客户数据</p><p class="text-xs text-muted mt-8">点击底部 + 号录入新客户</p></div>';
      return;
    }

    list.innerHTML = customers.map(c => `
      <div class="card" onclick="JC.WA.showCustomerDetail('${c.id}')" style="cursor:pointer;">
        <div class="flex-between">
          <div class="flex gap-8" style="align-items:center;">
            <strong>${u.esc(c.nickname)}</strong>
            <span class="badge badge-${c.ai_grade || 'D'}">${c.ai_grade || '?'}</span>
            ${c.status === 'deal' ? '<span class="badge badge-A">已成交</span>' : ''}
          </div>
          <span class="text-xs text-muted">${c.ai_score || 0}分</span>
        </div>
        <div class="mt-8 flex gap-8 flex-wrap" style="font-size:13px;color:var(--text-secondary);">
          ${c.travel_date ? `<span>📅 ${u.esc(c.travel_date)}</span>` : ''}
          ${c.people_count ? `<span>👥 ${u.esc(c.people_count)}人</span>` : ''}
          ${c.relationship ? `<span>${u.esc(c.relationship)}</span>` : ''}
        </div>
        ${c.tags && c.tags.length > 0 ? `
          <div class="mt-8">${c.tags.map(t => `<span class="tag">${u.esc(t)}</span>`).join('')}</div>
        ` : ''}
        ${c.recommended_product ? `
          <div class="mt-8 text-sm text-primary">📦 推荐: ${u.esc(c.recommended_product)}</div>
        ` : ''}
        ${c.next_follow_up_date ? `
          <div class="mt-8 text-xs ${u.isOverdue(c.next_follow_up_date) ? 'text-danger' : 'text-muted'}">
            ${u.isOverdue(c.next_follow_up_date) ? '⚠️ 逾期' : '📌'} 跟进: ${u.formatDate(c.next_follow_up_date)}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // ==================== 客户详情弹窗 ====================
  async function showCustomerDetail(id) {
    const customer = await JC.Store.waGetCustomer(id);
    if (!customer) { u.toast('客户不存在'); return; }

    // 获取跟进记录
    const logs = await JC.Store.getFollowUpLogs('wa', id);

    showOverlay(`
      <div class="overlay-header">
        <h3>${u.esc(customer.nickname)}</h3>
        <button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button>
      </div>
      <div class="overlay-body">
        <!-- 评分 & 等级 -->
        <div class="flex-between mb-16">
          <div>
            <span class="badge badge-${customer.ai_grade || 'D'}" style="font-size:16px;padding:4px 12px;">${customer.ai_grade || '?'}级</span>
            <span class="text-sm text-muted ml-8">${customer.ai_score || 0}分</span>
          </div>
          <span class="badge">${u.statusLabel(customer.status, 'wa')}</span>
        </div>

        <!-- 基础信息 -->
        <div class="card">
          <div class="card-title mb-12">📋 基础信息</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;">
            ${infoRow('出行日期', customer.travel_date)}
            ${infoRow('天数', customer.travel_days)}
            ${infoRow('人数', customer.people_count)}
            ${infoRow('关系', customer.relationship)}
            ${infoRow('预算', customer.budget)}
            ${infoRow('机票', customer.ticket_status)}
            ${infoRow('签证', customer.visa_status)}
            ${infoRow('决策人', customer.decision_maker)}
          </div>
        </div>

        <!-- 标签 -->
        ${customer.tags && customer.tags.length > 0 ? `
          <div class="mb-12">${customer.tags.map(t => `<span class="tag">${u.esc(t)}</span>`).join('')}</div>
        ` : ''}

        <!-- 顾虑 -->
        ${customer.concerns && customer.concerns.length > 0 ? `
          <div class="card">
            <div class="card-title mb-8">⚠️ 客户顾虑</div>
            ${customer.concerns.map(c => `<span class="tag" style="background:var(--danger-light);color:var(--danger);">${u.esc(c)}</span>`).join(' ')}
          </div>
        ` : ''}

        <!-- 推荐产品 -->
        ${customer.recommended_product ? `
          <div class="card">
            <div class="card-title mb-8">📦 推荐产品</div>
            <p><strong>${u.esc(customer.recommended_product)}</strong></p>
            <p class="text-sm text-muted mt-4">${u.esc(customer.recommended_reason || '')}</p>
          </div>
        ` : ''}

        <!-- 跟进话术 -->
        ${customer.follow_up_script ? `
          <div class="card">
            <div class="card-header">
              <span class="card-title">💬 跟进话术</span>
              <button class="btn btn-sm btn-outline" onclick="JC.Utils.copyToClipboard(\`${customer.follow_up_script.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)">复制</button>
            </div>
            <p style="white-space:pre-wrap;font-size:14px;">${u.esc(customer.follow_up_script)}</p>
          </div>
        ` : ''}

        <!-- 聊天记录 -->
        ${customer.chat_history ? `
          <div class="card">
            <div class="card-title mb-8">📝 聊天记录</div>
            <p style="white-space:pre-wrap;font-size:13px;color:var(--text-secondary);max-height:200px;overflow-y:auto;">${u.esc(customer.chat_history)}</p>
          </div>
        ` : ''}

        <!-- 跟进日志 -->
        ${logs.length > 0 ? `
          <div class="card">
            <div class="card-title mb-8">📜 跟进记录 (${logs.length})</div>
            ${logs.map(l => `
              <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
                <div class="text-xs text-muted">${u.formatDateTime(l.created_at)} ${l.method || ''}</div>
                <div class="mt-4">${u.esc(l.content)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- 成单信息 -->
        ${customer.status === 'deal' ? `
          <div class="card" style="background:var(--success-light);">
            <div class="card-title mb-8">✅ 成单详情</div>
            <div style="font-size:14px;">
              ${infoRow('产品', customer.deal_product)}
              ${infoRow('金额', customer.deal_amount)}
              ${infoRow('日期', customer.deal_date)}
              ${infoRow('备注', customer.deal_notes)}
            </div>
          </div>
        ` : ''}
      </div>
      <div class="overlay-footer">
        <button class="btn btn-outline flex-1" onclick="JC.WA.editCustomer('${id}')">✏️ 编辑</button>
        <button class="btn btn-outline flex-1" onclick="JC.WA.addFollowUp('${id}')">📝 跟进</button>
        ${customer.status !== 'deal' ? `<button class="btn btn-primary flex-1" onclick="JC.WA.convertToDeal('${id}')">💰 转成单</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="JC.WA.deleteCustomer('${id}')">🗑️</button>
      </div>
    `);
  }

  // ==================== 编辑客户 ====================
  async function editCustomer(id) {
    const c = await JC.Store.waGetCustomer(id);
    if (!c) return;

    document.querySelector('.overlay')?.remove();

    showOverlay(`
      <div class="overlay-header">
        <h3>编辑客户</h3>
        <button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button>
      </div>
      <div class="overlay-body">
        <div class="form-group"><label class="form-label">昵称 *</label><input class="form-input" id="edit-nickname" value="${u.esc(c.nickname)}"></div>
        <div class="form-group"><label class="form-label">联系方式</label><input class="form-input" id="edit-contact" value="${u.esc(c.contact || '')}"></div>
        <div class="form-group"><label class="form-label">微信号</label><input class="form-input" id="edit-wechat" value="${u.esc(c.wechat_id || '')}"></div>
        <div class="form-group"><label class="form-label">出行日期</label><input class="form-input" id="edit-travel-date" value="${u.esc(c.travel_date || '')}" placeholder="如 2026.8.1"></div>
        <div class="form-group"><label class="form-label">人数</label><input class="form-input" id="edit-people" value="${u.esc(c.people_count || '')}"></div>
        <div class="form-group"><label class="form-label">关系</label>
          <select class="form-select" id="edit-relationship">
            ${['','家庭游','亲子游','情侣游','夫妻游','朋友游','独自出行'].map(o => `<option ${c.relationship === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">预算</label>
          <select class="form-select" id="edit-budget">
            ${['','经济型','性价比型','舒适型','高端型'].map(o => `<option ${c.budget === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">机票状态</label>
          <select class="form-select" id="edit-ticket">${['','已购买','正在购买','未购买'].map(o => `<option ${c.ticket_status === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">签证状态</label>
          <select class="form-select" id="edit-visa">${['','已办理','办理中','未办理'].map(o => `<option ${c.visa_status === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">AI 评分</label><input class="form-input" type="number" id="edit-score" value="${c.ai_score || 0}" min="0" max="100"></div>
        <div class="form-group"><label class="form-label">下次跟进日期</label><input class="form-input" type="date" id="edit-follow-up" value="${c.next_follow_up_date || ''}"></div>
        <div class="form-group"><label class="form-label">备注</label><textarea class="form-textarea" id="edit-notes">${u.esc(c.notes || '')}</textarea></div>
      </div>
      <div class="overlay-footer">
        <button class="btn btn-primary btn-block" id="btn-save-edit">💾 保存修改</button>
      </div>
    `);

    document.getElementById('btn-save-edit').addEventListener('click', async () => {
      const updates = {
        id: c.id,
        nickname: document.getElementById('edit-nickname').value.trim(),
        contact: document.getElementById('edit-contact').value.trim(),
        wechat_id: document.getElementById('edit-wechat').value.trim(),
        travel_date: document.getElementById('edit-travel-date').value.trim(),
        people_count: document.getElementById('edit-people').value.trim(),
        relationship: document.getElementById('edit-relationship').value,
        budget: document.getElementById('edit-budget').value,
        ticket_status: document.getElementById('edit-ticket').value,
        visa_status: document.getElementById('edit-visa').value,
        ai_score: parseInt(document.getElementById('edit-score').value) || 0,
        next_follow_up_date: document.getElementById('edit-follow-up').value,
        notes: document.getElementById('edit-notes').value,
      };
      await JC.Store.waSaveCustomer(updates);
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
      <div class="overlay-header">
        <h3>添加跟进记录</h3>
        <button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button>
      </div>
      <div class="overlay-body">
        <p class="text-sm text-muted mb-12">客户: ${u.esc(c.nickname)}</p>
        <div class="form-group">
          <label class="form-label">跟进方式</label>
          <select class="form-select" id="fu-method">
            <option>微信</option><option>电话</option><option>群消息</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">跟进内容</label>
          <textarea class="form-textarea" id="fu-content" placeholder="记录本次跟进内容..."></textarea>
        </div>
      </div>
      <div class="overlay-footer">
        <button class="btn btn-primary btn-block" id="btn-save-fu">💾 保存</button>
      </div>
    `);

    document.getElementById('btn-save-fu').addEventListener('click', async () => {
      const content = document.getElementById('fu-content').value.trim();
      const method = document.getElementById('fu-method').value;
      if (!content) { u.toast('请输入跟进内容'); return; }

      await JC.Store.addFollowUpLog({
        module_code: 'wa',
        customer_id: id,
        content,
        method,
      });

      // 更新最后联系日期
      await JC.Store.waSaveCustomer({ id, last_contact_date: u.today() });

      document.querySelector('.overlay')?.remove();
      u.toast('跟进已记录 ✅');
    });
  }

  // ==================== 转成单 ====================
  async function convertToDeal(id) {
    document.querySelector('.overlay')?.remove();
    const c = await JC.Store.waGetCustomer(id);

    showOverlay(`
      <div class="overlay-header">
        <h3>💰 转成单</h3>
        <button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button>
      </div>
      <div class="overlay-body">
        <p class="text-sm text-muted mb-12">客户: ${u.esc(c.nickname)}</p>
        <div class="form-group"><label class="form-label">产品名称 *</label><input class="form-input" id="deal-product" value="${u.esc(c.recommended_product || '')}"></div>
        <div class="form-group"><label class="form-label">成单金额</label><input class="form-input" id="deal-amount" placeholder="如 3888澳元"></div>
        <div class="form-group"><label class="form-label">成单日期</label><input class="form-input" type="date" id="deal-date" value="${u.today()}"></div>
        <div class="form-group"><label class="form-label">人数</label><input class="form-input" id="deal-people" value="${u.esc(c.people_count || '')}"></div>
        <div class="form-group"><label class="form-label">付款状态</label>
          <select class="form-select" id="deal-payment">
            <option>定金已付</option><option>全款已付</option><option>未付款</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">备注</label><textarea class="form-textarea" id="deal-notes"></textarea></div>
      </div>
      <div class="overlay-footer">
        <button class="btn btn-primary btn-block" id="btn-save-deal">✅ 确认成单</button>
      </div>
    `);

    document.getElementById('btn-save-deal').addEventListener('click', async () => {
      const product = document.getElementById('deal-product').value.trim();
      if (!product) { u.toast('请输入产品名称'); return; }

      // 创建成单记录
      await JC.Store.waSaveDeal({
        customer_id: id,
        product_name: product,
        total_amount: document.getElementById('deal-amount').value.trim(),
        travel_date: document.getElementById('deal-date').value,
        people_count: parseInt(document.getElementById('deal-people').value) || 0,
        payment_status: document.getElementById('deal-payment').value,
        notes: document.getElementById('deal-notes').value,
      });

      // 更新客户状态
      await JC.Store.waSaveCustomer({
        id,
        status: 'deal',
        outcome: '成交',
        deal_product: product,
        deal_amount: document.getElementById('deal-amount').value.trim(),
        deal_date: document.getElementById('deal-date').value,
      });

      document.querySelector('.overlay')?.remove();
      u.toast('成单已记录 🎉');
      JC.Router.renderPage();
    });
  }

  // ==================== 删除客户 ====================
  async function deleteCustomer(id) {
    if (confirm('确定要删除这个客户吗？此操作不可撤销。')) {
      await JC.Store.waDeleteCustomer(id);
      document.querySelector('.overlay')?.remove();
      u.toast('已删除');
      JC.Router.renderPage();
    }
  }

  // ==================== 成单列表 ====================
  async function renderDeals(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const deals = await JC.Store.waGetDeals();

    if (deals.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>暂无成单记录</p></div>';
      return;
    }

    // 汇总
    const totalAmount = deals.reduce((sum, d) => {
      const num = parseFloat(d.total_amount?.replace(/[^0-9.]/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

    container.innerHTML = `
      <div class="card" style="background:var(--success-light);text-align:center;">
        <div class="stat-number" style="color:var(--success);">${deals.length}</div>
        <div class="stat-label">总成单数</div>
        ${totalAmount > 0 ? `<div class="text-sm text-muted mt-4">累计金额: ${totalAmount.toLocaleString()}</div>` : ''}
      </div>
      ${deals.map(d => `
        <div class="card">
          <div class="flex-between">
            <strong>${u.esc(d.product_name)}</strong>
            <span class="badge badge-A">${u.esc(d.payment_status || '')}</span>
          </div>
          <div class="mt-8 text-sm text-muted">
            ${d.total_amount ? `<span>💰 ${u.esc(d.total_amount)}</span>` : ''}
            ${d.people_count ? `<span class="ml-8">👥 ${d.people_count}人</span>` : ''}
          </div>
          <div class="mt-4 text-xs text-muted">📅 ${u.formatDate(d.created_at)}</div>
        </div>
      `).join('')}
    `;
  }

  // ==================== 回访提醒 ====================
  async function renderReviews(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const customers = await JC.Store.waGetCustomers({ todayFollowUp: true });
    const overdue = await JC.Store.waGetCustomers();

    const overdueList = overdue.filter(c => {
      return c.next_follow_up_date && u.isOverdue(c.next_follow_up_date) && c.status !== 'deal' && c.status !== 'lost';
    });

    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-8">📌 今日回访 (${customers.length})</div>
        ${customers.length === 0 ? '<p class="text-sm text-muted">今天没有需要回访的客户</p>' :
          customers.map(c => `
            <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border);">
              <div>
                <strong>${u.esc(c.nickname)}</strong>
                <span class="badge badge-${c.ai_grade || 'D'} ml-8">${c.ai_grade || '?'}</span>
              </div>
              <button class="btn btn-sm btn-outline" onclick="JC.WA.showCustomerDetail('${c.id}')">查看</button>
            </div>
          `).join('')
        }
      </div>

      <div class="card">
        <div class="card-title mb-8">⚠️ 逾期未跟进 (${overdueList.length})</div>
        ${overdueList.length === 0 ? '<p class="text-sm text-muted">没有逾期的客户 👍</p>' :
          overdueList.slice(0, 10).map(c => `
            <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border);">
              <div>
                <strong>${u.esc(c.nickname)}</strong>
                <span class="text-xs text-danger ml-8">逾期: ${u.formatDate(c.next_follow_up_date)}</span>
              </div>
              <button class="btn btn-sm btn-outline" onclick="JC.WA.showCustomerDetail('${c.id}')">查看</button>
            </div>
          `).join('')
        }
      </div>
    `;
  }

  // ==================== 通知管理 ====================
  async function renderNotices(container) {
    const notices = await JC.Store.waGetNotices();

    container.innerHTML = `
      <button class="btn btn-primary btn-block mb-16" id="btn-add-notice">➕ 添加通知</button>
      ${notices.length === 0 ? '<div class="empty-state"><p>暂无老板通知</p></div>' :
        notices.map(n => `
          <div class="card">
            <div class="flex-between">
              <div>
                <span class="badge badge-${n.type === 'discount' ? 'A' : 'C'}">${n.type === 'discount' ? '折扣' : '房态'}</span>
                <strong class="ml-8">${u.esc(n.title)}</strong>
              </div>
              <span class="text-xs ${n.is_active ? 'text-success' : 'text-muted'}">${n.is_active ? '生效中' : '已失效'}</span>
            </div>
            ${n.content ? `<p class="text-sm text-muted mt-8">${u.esc(n.content)}</p>` : ''}
            ${n.valid_from ? `<div class="text-xs text-muted mt-4">有效期: ${u.formatDate(n.valid_from)} ~ ${u.formatDate(n.valid_to)}</div>` : ''}
          </div>
        `).join('')
      }
    `;

    document.getElementById('btn-add-notice')?.addEventListener('click', () => {
      showOverlay(`
        <div class="overlay-header">
          <h3>添加通知</h3>
          <button class="btn-icon" onclick="document.querySelector('.overlay')?.remove()">✕</button>
        </div>
        <div class="overlay-body">
          <div class="form-group"><label class="form-label">类型</label>
            <select class="form-select" id="notice-type"><option value="room_status">房态</option><option value="discount">折扣</option><option value="other">其他</option></select>
          </div>
          <div class="form-group"><label class="form-label">标题 *</label><input class="form-input" id="notice-title" placeholder="如：7月无双床房"></div>
          <div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="notice-content"></textarea></div>
        </div>
        <div class="overlay-footer">
          <button class="btn btn-primary btn-block" id="btn-save-notice">保存</button>
        </div>
      `);

      document.getElementById('btn-save-notice').addEventListener('click', async () => {
        const title = document.getElementById('notice-title').value.trim();
        if (!title) { u.toast('请输入标题'); return; }
        await JC.Store.waSaveNotice({
          type: document.getElementById('notice-type').value,
          title,
          content: document.getElementById('notice-content').value,
        });
        document.querySelector('.overlay')?.remove();
        u.toast('已添加 ✅');
        JC.Router.renderPage();
      });
    });
  }

  // ==================== 工具 ====================
  function infoRow(label, value) {
    if (!value) return '';
    return `<div><span class="text-muted">${label}:</span> ${u.esc(String(value))}</div>`;
  }

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

  return { render, showCustomerDetail, editCustomer, addFollowUp, convertToDeal, deleteCustomer };
})();
