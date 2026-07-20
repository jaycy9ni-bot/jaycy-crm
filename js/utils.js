// ============================================================
// Jaycy CRM V3 - 工具函数
// ============================================================
window.JC = window.JC || {};

JC.Utils = {
  // HTML 转义（防 XSS）
  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return dateStr; }
  },

  // 格式化时间
  formatTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return '';
    return JC.Utils.formatDate(dateStr) + ' ' + JC.Utils.formatTime(dateStr);
  },

  // 获取今日日期 YYYY-MM-DD
  today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  // 获取当前时间 HH:MM
  nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  // 日期偏移
  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  },

  // 判断是否今天
  isToday(dateStr) {
    return dateStr === JC.Utils.today();
  },

  // 判断是否逾期
  isOverdue(dateStr) {
    if (!dateStr) return false;
    return dateStr < JC.Utils.today();
  },

  // 获取本周一
  monday() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  },

  // 判断是否是周三
  isWednesday() {
    return new Date().getDay() === 3;
  },

  // 判断是否是工作日
  isWeekday() {
    const day = new Date().getDay();
    return day >= 1 && day <= 5;
  },

  // Toast 提示
  toast(msg, duration = 2500) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 24px;border-radius:24px;font-size:14px;z-index:9999;pointer-events:none;transition:opacity 0.3s;opacity:0;max-width:90vw;text-align:center;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => { t.style.opacity = '0'; }, duration);
  },

  // 复制到剪贴板
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      JC.Utils.toast('已复制到剪贴板 ✅');
      return true;
    } catch {
      // 降级方案
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      JC.Utils.toast('已复制到剪贴板 ✅');
      return true;
    }
  },

  // 防抖
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 节流
  throttle(fn, delay = 300) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  },

  // 生成 UUID
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  // 等级颜色映射
  gradeColor(grade) {
    const map = { A: '#10b981', B: '#f59e0b', C: '#ef4444', D: '#8b5cf6' };
    return map[grade] || '#6b7280';
  },

  // 等级背景色
  gradeBg(grade) {
    const map = { A: '#dcfce7', B: '#fef3c7', C: '#fee2e2', D: '#f3e8ff' };
    return map[grade] || '#f3f4f6';
  },

  // 状态中文映射
  statusLabel(status, module) {
    if (module === 'wa') {
      const map = {
        active: '跟进中', deal: '已成交', lost: '已流失', paused: '暂缓',
        '新咨询': '新咨询', '已报价': '已报价', '高意向': '高意向', '待付款': '待付款', '已成交': '已成交', '已流失': '已流失'
      };
      return map[status] || status;
    }
    const map = {
      new: '新线索', contacting: '联系中', converted: '已转化', lost: '已流失'
    };
    return map[status] || status;
  },

  // 优先级颜色
  priorityColor(priority) {
    const map = { urgent: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: '#9ca3af' };
    return map[priority] || '#9ca3af';
  },

  // 截断文本
  truncate(text, len = 50) {
    if (!text) return '';
    return text.length > len ? text.slice(0, len) + '...' : text;
  },

  // 替换模板变量
  renderTemplate(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    return result;
  }
};
