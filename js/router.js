// ============================================================
// Jaycy CRM V3 - 路由管理
// ============================================================
window.JC = window.JC || {};

JC.Router = (() => {
  let currentTab = 'dashboard';    // dashboard / wa / xl / add / settings
  let currentSubTab = null;        // wa: customers/deals/reviews/notices   xl: leads/broadcast/templates/tasks
  let currentModule = 'wa';        // 当前活跃的工作模块（用于 + Tab 自动识别）

  function navigate(tab, subTab = null) {
    currentTab = tab;
    currentSubTab = subTab;
    if (tab === 'wa') currentModule = 'wa';
    if (tab === 'xl') currentModule = 'xl';

    // 更新底部导航高亮
    document.querySelectorAll('.nav-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    // 渲染页面
    renderPage();
  }

  function getState() {
    return { tab: currentTab, subTab: currentSubTab, module: currentModule };
  }

  function getCurrentModule() {
    return currentModule;
  }

  function renderPage() {
    const main = document.getElementById('main');
    if (!main) return;

    switch (currentTab) {
      case 'dashboard':
        if (JC.Dashboard) JC.Dashboard.render(main);
        break;
      case 'wa':
        if (JC.WA) JC.WA.render(main, currentSubTab || 'customers');
        break;
      case 'xl':
        if (JC.XL) JC.XL.render(main, currentSubTab || 'leads');
        break;
      case 'add':
        if (JC.AI) JC.AI.renderAddForm(main, currentModule);
        break;
      case 'settings':
        if (JC.Settings) JC.Settings.render(main);
        break;
    }
  }

  // 暴露到全局
  return { navigate, getState, getCurrentModule, renderPage };
})();
