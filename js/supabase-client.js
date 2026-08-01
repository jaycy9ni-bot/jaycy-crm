// ============================================================
// Jaycy CRM V3 - Supabase 客户端 & 认证管理
// ============================================================
window.JC = window.JC || {};

JC.Supabase = (() => {
  const SUPABASE_URL = 'https://arfisoyqdmchncafjixs.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_H1vJKXa1oNChW-AQNTjXJw_y7kMdkTl';

  let client = null;
  let session = null;

  function getClient() {
    if (!client && window.supabase) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return client;
  }

  // 获取当前会话
  async function getSession() {
    const c = getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    session = data.session;
    return session;
  }

  // 获取当前用户
  async function getUser() {
    const s = await getSession();
    return s ? s.user : null;
  }

  // 诊断当前登录状态
  async function getAuthStatus() {
    const c = getClient();
    if (!c) return { ok: false, message: 'Supabase client 未初始化' };
    const { data } = await c.auth.getSession();
    const s = data.session;
    if (!s) return { ok: false, message: '未登录（无 session）' };
    return { ok: true, user: s.user, token: s.access_token.slice(0,20) + '...' };
  }

  // 邮箱注册
  async function signUp(email, password) {
    const c = getClient();
    if (!c) return { error: 'Supabase 未初始化' };
    return await c.auth.signUp({ email, password });
  }

  // 邮箱登录
  async function signIn(email, password) {
    const c = getClient();
    if (!c) return { error: 'Supabase 未初始化' };
    return await c.auth.signInWithPassword({ email, password });
  }

  // 登出
  async function signOut() {
    const c = getClient();
    if (!c) return;
    await c.auth.signOut();
    session = null;
  }

  // 获取 profile
  async function getProfile() {
    const user = await getUser();
    if (!user) return null;
    const c = getClient();
    const { data } = await c.from('profiles').select('*').eq('id', user.id).single();
    return data;
  }

  // 更新 profile
  async function updateProfile(updates) {
    const user = await getUser();
    if (!user) return null;
    const c = getClient();
    return await c.from('profiles').update(updates).eq('id', user.id);
  }

  // 获取工作模块
  async function getWorkModules() {
    const c = getClient();
    const { data } = await c.from('work_modules').select('*').order('code');
    return data || [];
  }

  // 监听认证状态变化
  function onAuthChange(callback) {
    const c = getClient();
    if (!c) return;
    c.auth.onAuthStateChange((event, s) => {
      session = s;
      callback(event, s);
    });
  }

  return {
    getClient,
    getSession,
    getUser,
    getAuthStatus,
    signUp,
    signIn,
    signOut,
    getProfile,
    updateProfile,
    getWorkModules,
    onAuthChange
  };
})();
