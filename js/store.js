// ============================================================
// Jaycy CRM V3 - 数据层（Supabase CRUD + localStorage 离线缓存）
// ============================================================
window.JC = window.JC || {};

JC.Store = (() => {
  const client = () => JC.Supabase.getClient();
  const u = JC.Utils;

  // ==================== 西澳客户 ====================
  async function waGetCustomers(filters = {}) {
    let query = client().from('wa_customers').select('*');
    if (filters.grade) query = query.eq('ai_grade', filters.grade);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.outcome) query = query.eq('outcome', filters.outcome);
    if (filters.search) query = query.or(`nickname.ilike.%${filters.search}%,contact.ilike.%${filters.search}%,wechat_id.ilike.%${filters.search}%`);
    if (filters.todayFollowUp) query = query.eq('next_follow_up_date', u.today());
    query = query.order('ai_score', { ascending: false });
    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return data;
  }

  async function waGetCustomer(id) {
    const { data } = await client().from('wa_customers').select('*').eq('id', id).single();
    return data;
  }

  async function waSaveCustomer(customer) {
    if (customer.id) {
      customer.updated_at = new Date().toISOString();
      return await client().from('wa_customers').update(customer).eq('id', customer.id);
    }
    return await client().from('wa_customers').insert(customer);
  }

  async function waDeleteCustomer(id) {
    return await client().from('wa_customers').delete().eq('id', id);
  }

  async function waGetDeals() {
    const { data } = await client().from('wa_deals').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  async function waSaveDeal(deal) {
    if (deal.id) {
      return await client().from('wa_deals').update(deal).eq('id', deal.id);
    }
    return await client().from('wa_deals').insert(deal);
  }

  async function waGetNotices() {
    const { data } = await client().from('wa_notices').select('*').eq('is_active', true).order('created_at', { ascending: false });
    return data || [];
  }

  async function waSaveNotice(notice) {
    return await client().from('wa_notices').insert(notice);
  }

  async function waUpdateNotice(id, updates) {
    return await client().from('wa_notices').update(updates).eq('id', id);
  }

  // ==================== 小羚线索 ====================
  async function xlGetLeads(filters = {}) {
    let query = client().from('xl_leads').select('*');
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.formFilled !== undefined) query = query.eq('form_filled', filters.formFilled);
    if (filters.groupAdded !== undefined) query = query.eq('group_added', filters.groupAdded);
    if (filters.search) query = query.or(`nickname.ilike.%${filters.search}%,contact.ilike.%${filters.search}%,wechat_id.ilike.%${filters.search}%`);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return data;
  }

  async function xlGetLead(id) {
    const { data } = await client().from('xl_leads').select('*').eq('id', id).single();
    return data;
  }

  async function xlSaveLead(lead) {
    if (lead.id) {
      lead.updated_at = new Date().toISOString();
      return await client().from('xl_leads').update(lead).eq('id', lead.id);
    }
    return await client().from('xl_leads').insert(lead);
  }

  async function xlDeleteLead(id) {
    return await client().from('xl_leads').delete().eq('id', id);
  }

  // ==================== 任务 ====================
  async function getTasks(filters = {}) {
    let query = client().from('tasks').select('*');
    if (filters.moduleCode) query = query.eq('module_code', filters.moduleCode);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dueDate) query = query.eq('due_date', filters.dueDate);
    if (filters.today) query = query.eq('due_date', u.today());
    query = query.order('due_time', { ascending: true }).order('priority', { ascending: true });
    const { data } = await query;
    return data || [];
  }

  async function saveTask(task) {
    if (task.id) {
      return await client().from('tasks').update(task).eq('id', task.id);
    }
    return await client().from('tasks').insert(task);
  }

  async function completeTask(id) {
    return await client().from('tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', id);
  }

  // ==================== 跟进记录 ====================
  async function addFollowUpLog(log) {
    return await client().from('follow_up_logs').insert(log);
  }

  async function getFollowUpLogs(moduleCode, customerId) {
    const { data } = await client().from('follow_up_logs').select('*')
      .eq('module_code', moduleCode)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  // ==================== 模板 ====================
  async function getTemplates(moduleCode) {
    const { data } = await client().from('reply_templates').select('*')
      .eq('module_code', moduleCode)
      .order('category').order('usage_count', { ascending: false });
    return data || [];
  }

  async function saveTemplate(tmpl) {
    if (tmpl.id) {
      return await client().from('reply_templates').update(tmpl).eq('id', tmpl.id);
    }
    return await client().from('reply_templates').insert(tmpl);
  }

  async function incrementTemplateUsage(id) {
    // 增加使用计数
    const { data } = await client().from('reply_templates').select('usage_count').eq('id', id).single();
    if (data) {
      await client().from('reply_templates').update({ usage_count: (data.usage_count || 0) + 1 }).eq('id', id);
    }
  }

  // ==================== 统计 ====================
  async function getDashboardStats() {
    const [waAll, waDeals, waLost, waAB, xlAll, xlConverted, tasksToday, notices] = await Promise.all([
      client().from('wa_customers').select('id,ai_grade,status', { count: 'exact', head: true }),
      client().from('wa_customers').select('id', { count: 'exact', head: true }).eq('status', 'deal'),
      client().from('wa_customers').select('id', { count: 'exact', head: true }).eq('status', 'lost'),
      client().from('wa_customers').select('id', { count: 'exact', head: true }).in('ai_grade', ['A', 'B']),
      client().from('xl_leads').select('id,status', { count: 'exact', head: true }),
      client().from('xl_leads').select('id', { count: 'exact', head: true }).eq('status', 'converted'),
      client().from('tasks').select('id', { count: 'exact', head: true }).eq('due_date', u.today()).eq('status', 'pending'),
      client().from('wa_notices').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    return {
      waTotal: waAll.count || 0,
      waDeals: waDeals.count || 0,
      waLost: waLost.count || 0,
      waHighIntent: waAB.count || 0,
      xlTotal: xlAll.count || 0,
      xlConverted: xlConverted.count || 0,
      tasksToday: tasksToday.count || 0,
      activeNotices: notices.count || 0,
    };
  }

  return {
    // 西澳
    waGetCustomers, waGetCustomer, waSaveCustomer, waDeleteCustomer,
    waGetDeals, waSaveDeal,
    waGetNotices, waSaveNotice, waUpdateNotice,
    // 小羚
    xlGetLeads, xlGetLead, xlSaveLead, xlDeleteLead,
    // 任务
    getTasks, saveTask, completeTask,
    // 跟进
    addFollowUpLog, getFollowUpLogs,
    // 模板
    getTemplates, saveTemplate, incrementTemplateUsage,
    // 统计
    getDashboardStats,
  };
})();
