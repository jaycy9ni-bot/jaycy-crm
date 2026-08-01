// ============================================================
// Jaycy CRM V3 - 通用 Excel 文件导入
// 上传 .xlsx 文件 → SheetJS 解析 → 批量写入 Supabase
// ============================================================
window.JC = window.JC || {};

JC.ExcelImport = (() => {
  const u = JC.Utils;

  // 日期统一：各种格式 → YYYY-MM-DD（Supabase DATE 类型要求）
  function normDate(val) {
    if (!val) return '';
    const s = String(val).trim();
    if (!s || s === '/' || s === 'NaN') return '';
    // Excel 序列号（数字）
    if (/^\d{5}$/.test(s)) {
      const d = new Date((parseInt(s) - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }
    // YYYY.MM.DD 或 YYYY-MM-DD
    let m = s.match(/(\d{4})[\.\-](\d{1,2})[\.\-](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    // M.D 或 M-D
    m = s.match(/^(\d{1,2})[\.\-](\d{1,2})$/);
    if (m) return `2026-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    return s;
  }

  // 计算结算月份
  function calcSettlement(dateStr) {
    const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    const yr = parseInt(m[1]), mo = parseInt(m[2]), dy = parseInt(m[3]);
    if (dy < 27) return `${yr}年${mo}月`;
    const nextMo = mo === 12 ? 1 : mo + 1;
    const nextYr = mo === 12 ? yr + 1 : yr;
    return `${nextYr}年${nextMo}月`;
  }

  // 解析 Excel 文件
  async function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array', cellDates: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // 智能匹配列名（支持中英文、模糊匹配）
  function findCol(headers, keywords) {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || '').toLowerCase().trim();
      for (const kw of keywords) {
        if (h.includes(kw.toLowerCase())) return i;
      }
    }
    return -1;
  }

  // 解析成单表数据
  function parseDeals(rows, headerIdx = 0) {
    const headers = rows[headerIdx] || [];
    const colMap = {
      orderDate: findCol(headers, ['成单日期', 'order_date']),
      groupDate: findCol(headers, ['拉群日期', 'group_date']),
      travelDate: findCol(headers, ['出行日期', 'travel_date']),
      travelDays: findCol(headers, ['出行天数', 'travel_days', '天数']),
      people: findCol(headers, ['人数', 'people']),
      product: findCol(headers, ['产品', 'product']),
      wechatName: findCol(headers, ['微信名', 'wechat_name']),
      customerInfo: findCol(headers, ['客户信息', 'customer_info']),
      contact: findCol(headers, ['联系方式', 'contact']),
      roomType: findCol(headers, ['房型', 'room_type']),
      amount: findCol(headers, ['总价', 'amount', '付款备注']),
      payMethod: findCol(headers, ['付款方式', 'payment_method']),
      payStatus: findCol(headers, ['付款状态', 'payment_status']),
      finalPay: findCol(headers, ['尾款日期', 'final_payment']),
      pickup: findCol(headers, ['接送机', 'pickup']),
      notes: findCol(headers, ['备注', 'notes']),
      review: findCol(headers, ['评价', 'review']),
      orderStatus: findCol(headers, ['订单状态', 'order_status']),
    };

    const deals = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => !c)) continue;

      const orderDate = normDate(row[colMap.orderDate]);
      const product = String(row[colMap.product] || '').trim();
      if (!product) continue; // 没产品名的行跳过

      deals.push({
        wechat_name: String(row[colMap.wechatName] || '').trim(),
        product_name: product,
        order_date: orderDate,
        settlement_month: calcSettlement(orderDate),
        group_date: normDate(row[colMap.groupDate]),
        travel_date: String(row[colMap.travelDate] || '').trim(),
        travel_days: String(row[colMap.travelDays] || '').trim(),
        people_count: parseInt(String(row[colMap.people] || '').match(/\d+/)?.[0]) || 0,
        customer_info: String(row[colMap.customerInfo] || '').trim(),
        contact_info: String(row[colMap.contact] || '').trim(),
        room_type: String(row[colMap.roomType] || '').trim(),
        total_amount: String(row[colMap.amount] || '').trim(),
        payment_method: String(row[colMap.payMethod] || '').trim(),
        payment_status: String(row[colMap.payStatus] || '').trim(),
        final_payment_date: normDate(row[colMap.finalPay]),
        pickup_dropoff: String(row[colMap.pickup] || '').trim(),
        notes: String(row[colMap.notes] || '').trim(),
        review: String(row[colMap.review] || '').trim(),
        order_status: String(row[colMap.orderStatus] || '').trim(),
        agent_name: 'Jaycy',
      });
    }
    return deals;
  }

  // 解析咨询表数据
  function parseCustomers(rows, headerIdx = 0) {
    const headers = rows[headerIdx] || [];
    const colMap = {
      firstDate: findCol(headers, ['首询日期', 'first_inquiry']),
      wechatName: findCol(headers, ['微信名', 'wechat_name']),
      planDate: findCol(headers, ['计划出行日期', 'plan_date', '出行日期']),
      days: findCol(headers, ['天数', 'days', '出行天数']),
      people: findCol(headers, ['人数', 'people']),
      product: findCol(headers, ['意向套餐', 'product', '产品']),
      status: findCol(headers, ['状态', 'status']),
      intent: findCol(headers, ['意向程度', 'intent', '意向']),
      fu1: findCol(headers, ['跟进-1', '跟进1', 'follow_up_1']),
      fu2: findCol(headers, ['跟进-2', '跟进2', 'follow_up_2']),
      fu3: findCol(headers, ['跟进-3', '跟进3', 'follow_up_3']),
    };

    const customers = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => !c)) continue;

      const name = String(row[colMap.wechatName] || '').trim();
      if (!name || name === '（未命名）' || name === '（空白）') continue;

      const status = String(row[colMap.status] || '').trim();
      let cleanStatus = '咨询中';
      if (status === '已成交') cleanStatus = '已成交';
      else if (['后续无回复','无回复','没回复过'].includes(status)) cleanStatus = '后续无回复';
      else if (status) cleanStatus = status;

      customers.push({
        wechat_name: name,
        nickname: name,
        contact: '',
        first_inquiry_date: normDate(row[colMap.firstDate]),
        plan_date: String(row[colMap.planDate] || '').trim(),
        travel_date: String(row[colMap.planDate] || '').trim(),
        days: String(row[colMap.days] || '').trim(),
        travel_days: String(row[colMap.days] || '').trim(),
        people: String(row[colMap.people] || '').trim().match(/\d+/)?.[0] || '',
        people_count: String(row[colMap.people] || '').trim().match(/\d+/)?.[0] || '',
        product_interest: String(row[colMap.product] || '').trim(),
        intent_level: String(row[colMap.intent] || '').trim() || '低',
        inquiry_status: cleanStatus,
        status: cleanStatus,
        blocker: '',
        follow_up_1: String(row[colMap.fu1] || '').trim(),
        follow_up_2: String(row[colMap.fu2] || '').trim(),
        follow_up_3: String(row[colMap.fu3] || '').trim(),
        next_follow_up_date: '',
      });
    }
    return customers;
  }

  // 导入成单
  async function importDeals(file, progressFn) {
    const rows = await parseFile(file);
    // 智能检测表头行
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i] || [];
      const joined = row.join('');
      if (joined.includes('成单日期') || joined.includes('产品') || joined.includes('order_date')) {
        headerIdx = i;
        break;
      }
    }
    const deals = parseDeals(rows, headerIdx);
    let success = 0, fail = 0;
    const errors = [];

    for (let i = 0; i < deals.length; i++) {
      try {
        await JC.Store.waSaveDeal(deals[i]);
        success++;
      } catch (e) {
        fail++;
        errors.push(`第${i+1}行(${deals[i].product_name}): ${e.message}`);
        // 第一条失败就立刻返回，方便诊断
        return { success, fail, total: deals.length, errors, headerIdx, rowsCount: rows.length, firstError: e.message };
      }
      if (progressFn) progressFn(i + 1, deals.length, success, fail);
    }
    return { success, fail, total: deals.length, errors, headerIdx, rowsCount: rows.length };
  }

  // 导入咨询
  async function importCustomers(file, progressFn) {
    const rows = await parseFile(file);
    // 调试：检测表头行
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i] || [];
      const joined = row.join('');
      if (joined.includes('微信名') || joined.includes('首询') || joined.includes('wechat')) {
        headerIdx = i;
        break;
      }
    }
    const customers = parseCustomers(rows, headerIdx);
    let success = 0, fail = 0;
    const errors = [];

    for (let i = 0; i < customers.length; i++) {
      try {
        await JC.Store.waSaveCustomer(customers[i]);
        success++;
      } catch (e) {
        fail++;
        errors.push(`${customers[i].wechat_name}: ${e.message}`);
        // 第一条失败就立刻返回，方便诊断
        return { success, fail, total: customers.length, errors, headerIdx, rowsCount: rows.length, firstError: e.message };
      }
      if (progressFn) progressFn(i + 1, customers.length, success, fail);
    }
    return { success, fail, total: customers.length, errors, headerIdx, rowsCount: rows.length };
  }

  return { importDeals, importCustomers, parseFile, parseDeals, parseCustomers };
})();
