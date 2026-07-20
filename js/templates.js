// ============================================================
// Jaycy CRM V3 - 快捷回复模板管理
// ============================================================
window.JC = window.JC || {};

JC.Templates = (() => {
  // 模板数据已在 Supabase 的 handle_new_user 触发器中预设
  // 此模块提供便捷的模板获取和渲染方法

  const u = JC.Utils;

  // 根据线索信息推荐模板
  async function recommend(lead, moduleCode = 'xl') {
    const templates = await JC.Store.getTemplates(moduleCode);

    // 本地规则匹配
    if (moduleCode === 'xl') {
      if (lead.status === 'new' && lead.career_stage === '应届') {
        const match = templates.find(t => t.name.includes('应届生'));
        if (match) return match;
      }
      if (lead.status === 'new') {
        const match = templates.find(t => t.category === '欢迎语');
        if (match) return match;
      }
      if (!lead.form_filled) {
        const match = templates.find(t => t.category === '催促');
        if (match) return match;
      }
    }

    // 默认返回第一个
    return templates[0] || null;
  }

  // 生成群名
  function generateGroupName(lead) {
    const parts = ['求职咨询', lead.nickname];
    if (lead.career_stage) parts.push(lead.career_stage);
    if (lead.target_industry) parts.push(lead.target_industry);
    return parts.join('-');
  }

  // 生成欢迎语
  async function generateWelcome(lead) {
    const templates = await JC.Store.getTemplates('xl');
    const welcomeTemplates = templates.filter(t => t.category === '欢迎语');

    let tmpl = welcomeTemplates[0];
    if (lead.career_stage === '应届' || lead.career_stage === '在校生') {
      tmpl = welcomeTemplates.find(t => t.name.includes('应届生')) || tmpl;
    }

    if (tmpl) {
      return u.renderTemplate(tmpl.content, {
        nickname: lead.nickname,
        service_type: lead.service_type || '',
        career_stage: lead.career_stage || '',
      });
    }

    return `你好 ${lead.nickname}～欢迎加入小羚不卷！🎉

这里有最新的远程求职信息、岗位内推和直播分享。

有任何问题随时找我哦 😊`;
  }

  return { recommend, generateGroupName, generateWelcome };
})();
