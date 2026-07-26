// ============================================================
// Jaycy CRM V3 - 数据层（匹配腾讯文档字段）
// ============================================================
window.JC = window.JC || {};

JC.Store = (() => {
  const client = () => JC.Supabase.getClient();
  const u = JC.Utils;

  // ==================== 西澳客户（对应腾讯文档咨询表） ====================
  async function waGetCustomers(filters = {}) {
    let query = client().from('wa_customers').select('*');
    if (filters.intent) query = query.eq('intent_level', filters.intent);
    if (filters.status) query = query.eq('inquiry_status', filters.status);
    if (filters.search) query = query.or(`nickname.ilike.%${filters.search}%,wechat_name.ilike.%${filters.search}%,contact.ilike.%${filters.search}%`);
    if (filters.todayFollow) query = query.eq('next_follow_up_date', u.today());
    query = query.order('first_inquiry_date', { ascending: false });
    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return data || [];
  }

  async function waGetCustomer(id) {
    const { data } = await client().from('wa_customers').select('*').eq('id', id).single();
    return data;
  }

  async function waSaveCustomer(customer) {
    const user = await JC.Supabase.getUser();
    if (!user) throw new Error('未登录');
    if (!customer.owner_id) customer.owner_id = user.id;
    // 统一日期格式：YYYY.MM.DD → YYYY-MM-DD
    if (customer.first_inquiry_date) {
      const m = String(customer.first_inquiry_date).match(/(\d{4})[\.\-](\d{1,2})[\.\-](\d{1,2})/);
      if (m) customer.first_inquiry_date = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    }
    if (customer.id) {
      customer.updated_at = new Date().toISOString();
      return await client().from('wa_customers').update(customer).eq('id', customer.id);
    }
    return await client().from('wa_customers').insert(customer);
  }

  async function waDeleteCustomer(id) {
    return await client().from('wa_customers').delete().eq('id', id);
  }

  // ==================== 成单（对应腾讯文档成单表） ====================
  async function waGetDeals(filters = {}) {
    let query = client().from('wa_deals').select('*');
    if (filters.settlementMonth) query = query.eq('settlement_month', filters.settlementMonth);
    query = query.order('order_date', { ascending: false }).order('created_at', { ascending: false });
    const { data } = await query;
    return data || [];
  }

  async function waSaveDeal(deal) {
    const user = await JC.Supabase.getUser();
    if (!user) throw new Error('未登录');
    if (!deal.owner_id) deal.owner_id = user.id;
    // 统一日期格式：YYYY.MM.DD → YYYY-MM-DD（Supabase DATE 类型要求）
    if (deal.order_date) {
      const m = String(deal.order_date).match(/(\d{4})[\.\-](\d{1,2})[\.\-](\d{1,2})/);
      if (m) {
        const yr = parseInt(m[1]), mo = parseInt(m[2]), dy = parseInt(m[3]);
        deal.order_date = `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
        if (dy < 27) {
          deal.settlement_month = `${yr}年${mo}月`;
        } else {
          const nextMo = mo === 12 ? 1 : mo + 1;
          const nextYr = mo === 12 ? yr + 1 : yr;
          deal.settlement_month = `${nextYr}年${nextMo}月`;
        }
      }
    }
    if (deal.id) {
      return await client().from('wa_deals').update(deal).eq('id', deal.id);
    }
    return await client().from('wa_deals').insert(deal);
  }

  // ==================== 老板通知 ====================
  async function waGetNotices() {
    const { data } = await client().from('wa_notices').select('*').eq('is_active', true).order('created_at', { ascending: false });
    return data || [];
  }

  async function waSaveNotice(notice) {
    return await client().from('wa_notices').insert(notice);
  }

  async function waDismissNotice(id) {
    return await client().from('wa_notices').update({ is_active: false }).eq('id', id);
  }

  // 检测客户是否受到通知影响
  async function checkNoticeRelevance(customer) {
    const notices = await waGetNotices();
    return notices.filter(n => {
      // 产品匹配
      if (customer.recommended_product && n.title.includes(customer.recommended_product)) return true;
      if (customer.product_interest && n.title.includes(customer.product_interest)) return true;
      // 日期匹配
      if (customer.travel_date && n.title.includes(customer.travel_date)) return true;
      return false;
    });
  }

  // ==================== 任务 & 提醒 ====================
  async function getTasks(filters = {}) {
    let query = client().from('tasks').select('*');
    if (filters.moduleCode) query = query.eq('module_code', filters.moduleCode);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.today) query = query.eq('due_date', u.today());
    query = query.order('due_time', { ascending: true });
    const { data } = await query;
    return data || [];
  }

  async function saveTask(task) {
    if (task.id) return await client().from('tasks').update(task).eq('id', task.id);
    return await client().from('tasks').insert(task);
  }

  async function completeTask(id) {
    return await client().from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
  }

  // ==================== 跟进记录 ====================
  async function addFollowUpLog(log) {
    return await client().from('follow_up_logs').insert(log);
  }

  async function getFollowUpLogs(moduleCode, customerId) {
    const { data } = await client().from('follow_up_logs').select('*')
      .eq('module_code', moduleCode).eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  // ==================== 统计 ====================
  async function getDashboardStats() {
    const today = u.today();
    const [waAll, waDeal, waActive, tasksToday, notices] = await Promise.all([
      client().from('wa_customers').select('id', { count: 'exact', head: true }),
      client().from('wa_deals').select('id', { count: 'exact', head: true }),
      client().from('wa_customers').select('id', { count: 'exact', head: true }).not('inquiry_status', 'in', '("已成交","后续无回复","无回复")'),
      client().from('tasks').select('id', { count: 'exact', head: true }).eq('due_date', today).eq('status', 'pending'),
      client().from('wa_notices').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    return {
      waTotal: waAll.count || 0,
      waDeals: waDeal.count || 0,
      waActive: waActive.count || 0,
      tasksToday: tasksToday.count || 0,
      activeNotices: notices.count || 0,
    };
  }

  // ==================== 数据导入 ====================
  async function bulkImport(customers, deals) {
    for (const c of customers) {
      await waSaveCustomer(c);
    }
    for (const d of deals) {
      await waSaveDeal(d);
    }
  }

  return {
    waGetCustomers, waGetCustomer, waSaveCustomer, waDeleteCustomer,
    waGetDeals, waSaveDeal,
    waGetNotices, waSaveNotice, waDismissNotice, checkNoticeRelevance,
    getTasks, saveTask, completeTask,
    addFollowUpLog, getFollowUpLogs,
    getDashboardStats, bulkImport,
  };
})();
