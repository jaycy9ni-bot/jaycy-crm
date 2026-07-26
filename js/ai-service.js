// ============================================================
// Jaycy CRM V3 - AI 服务（聊天记录解析 → 自动填咨询表）
// ============================================================
window.JC = window.JC || {};

JC.AI = (() => {
  const u = JC.Utils;
  const VERCEL_API = 'https://jaycy-crm-ai.vercel.app/api/ai';
  let ocrTexts = [];

  async function renderAddForm(container, module) {
    ocrTexts = [];
    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-12">🤖 AI 录入客户咨询</div>
        <p class="text-sm text-muted mb-16">粘贴聊天记录或上传截图，AI 自动提取关键信息填入咨询表</p>

        <div class="form-group">
          <label class="form-label">粘贴聊天记录</label>
          <textarea class="form-textarea" id="ai-text" placeholder="粘贴微信聊天记录...&#10;&#10;支持多段对话" style="min-height:150px;"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">或上传截图</label>
          <div id="ocr-drop" style="border:2px dashed var(--border);border-radius:12px;padding:24px;text-align:center;cursor:pointer;">
            <div style="font-size:32px;">📸</div><p class="text-sm text-muted mt-8">点击上传或粘贴截图</p>
            <input type="file" id="ocr-input" accept="image/*" multiple style="display:none;">
          </div>
          <div id="ocr-images" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"></div>
          <div id="ocr-status" class="text-xs text-muted mt-4"></div>
        </div>

        <button class="btn btn-primary btn-block mt-16" id="btn-ai-parse" disabled>🔍 AI 解析</button>
      </div>
      <div id="ai-result" style="display:none;"></div>
    `;

    const textArea = document.getElementById('ai-text');
    const parseBtn = document.getElementById('btn-ai-parse');
    const updateBtn = () => { parseBtn.disabled = !textArea.value.trim() && ocrTexts.length === 0; };
    textArea.addEventListener('input', updateBtn);

    // OCR
    document.getElementById('ocr-drop').addEventListener('click', () => document.getElementById('ocr-input').click());
    document.getElementById('ocr-input').addEventListener('change', async e => {
      for (const f of Array.from(e.target.files)) await doOCR(f);
    });
    document.addEventListener('paste', async e => {
      for (const item of (e.clipboardData?.items || [])) {
        if (item.type.startsWith('image/')) await doOCR(item.getAsFile());
      }
    });

    async function doOCR(file) {
      const status = document.getElementById('ocr-status');
      status.textContent = '识别中...';
      const imgContainer = document.getElementById('ocr-images');
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url; img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;';
      imgContainer.appendChild(img);
      try {
        if (window.Tesseract) {
          const { data: { text } } = await Tesseract.recognize(file, 'chi_sim+eng');
          ocrTexts.push(text);
          status.textContent = `已识别 ${ocrTexts.length} 张`;
          updateBtn();
        } else { status.textContent = 'OCR 库未加载，请使用文本'; }
      } catch { status.textContent = '识别失败，请手动输入'; }
    }

    // AI 解析
    parseBtn.addEventListener('click', async () => {
      const text = [textArea.value.trim(), ...ocrTexts].filter(Boolean).join('\n\n');
      if (!text) { u.toast('请输入内容'); return; }
      parseBtn.disabled = true; parseBtn.textContent = '⏳ AI 解析中...';

      const result = await callAI(text);
      parseBtn.disabled = false; parseBtn.textContent = '🔍 AI 解析';
      if (!result || result.error) { u.toast('解析失败: ' + (result?.message || '未知错误')); return; }
      showResult(result);
    });
  }

  async function callAI(text) {
    try {
      const resp = await fetch(VERCEL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'parseChat', text, module: 'wa' }) });
      return await resp.json();
    } catch {
      try {
        const profile = await JC.Supabase.getProfile();
        if (profile?.deepseek_api_key) {
          const resp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${profile.deepseek_api_key}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '你是西澳旅游销售专家。从聊天记录提取JSON: {"nickname":"","contact":"","travelDate":"","travelDays":"","peopleCount":"","relationship":"","productInterest":"","concerns":[],"score":0,"grade":"","followUpScript":""}。只输出JSON。' }, { role: 'user', content: text }], temperature: 0.2 }),
          });
          const data = await resp.json();
          const raw = (data.choices?.[0]?.message?.content || '{}').replace(/^```json\s*/, '').replace(/\s*```$/, '');
          return JSON.parse(raw);
        }
      } catch {}
      return { error: 'AI 不可用' };
    }
  }

  function showResult(result) {
    const container = document.getElementById('ai-result');
    container.style.display = 'block';
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">📊 AI 解析结果</span>
          <span class="badge badge-${result.grade || 'B'}">${result.grade || '?'}级 · ${result.score || 0}分</span>
        </div>
        <div class="form-group"><label class="form-label">微信名</label><input class="form-input" id="ai-nickname" value="${u.esc(result.nickname || result.basicInfo?.nickname || '')}"></div>
        <div class="form-group"><label class="form-label">联系方式</label><input class="form-input" id="ai-contact" value="${u.esc(result.contact || result.basicInfo?.contact || '')}"></div>
        <div class="form-group"><label class="form-label">计划出行日期</label><input class="form-input" id="ai-date" value="${u.esc(result.travelDate || result.basicInfo?.travelDate || '')}"></div>
        <div class="form-group"><label class="form-label">天数</label><input class="form-input" id="ai-days" value="${u.esc(result.travelDays || result.basicInfo?.travelDays || '')}"></div>
        <div class="form-group"><label class="form-label">人数</label><input class="form-input" id="ai-people" value="${u.esc(result.peopleCount || result.basicInfo?.peopleCount || '')}"></div>
        <div class="form-group"><label class="form-label">意向套餐</label>
          <select class="form-select" id="ai-product">
            <option value="">请选择</option>
            ${['玛格丽特河一日','波浪岩一日','粉湖两日','粉湖三日','纯玩三日A','纯玩三日B','纯玩三日C','纯玩四日A','纯玩四日B','纯玩四日C','纯玩五日','轻松四日','杰伦五日','经典五日','浪漫五日','明星六日','纯粹六日','奇观六日','全景七日'].map(p => {
              const aiProduct = result.productInterest || result.recommendedProduct?.name || '';
              const match = aiProduct && (p === aiProduct || aiProduct.includes(p) || p.includes(aiProduct));
              return `<option ${match ? 'selected' : ''}>${p}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">意向程度</label>
          <select class="form-select" id="ai-intent">
            ${['高','中高','中','低','距离出游时间还太远','已流失'].map(o => {
              const grade = result.grade;
              const defaultIntent = grade === 'A' ? '高' : grade === 'B' ? '中高' : grade === 'C' ? '中' : '低';
              return `<option ${defaultIntent === o ? 'selected' : ''}>${o}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">卡点</label><input class="form-input" id="ai-blocker" value="${u.esc(result.concerns?.join('；') || '')}" placeholder="客户卡在哪里"></div>
        ${result.concerns?.length ? `<div class="mb-12">${result.concerns.map(c => `<span class="tag" style="background:var(--danger-light);">${u.esc(c)}</span>`).join(' ')}</div>` : ''}
        ${result.followUpScript ? `<div class="form-group"><label class="form-label">AI 跟进话术</label><textarea class="form-textarea" id="ai-script" style="min-height:80px;">${u.esc(result.followUpScript)}</textarea></div>` : ''}
        <button class="btn btn-primary btn-block mt-12" id="btn-ai-save">💾 保存到咨询表</button>
      </div>
    `;

    document.getElementById('btn-ai-save').addEventListener('click', async () => {
      const nickname = document.getElementById('ai-nickname').value.trim() || '未命名';
      await JC.Store.waSaveCustomer({
        nickname, wechat_name: nickname,
        contact: document.getElementById('ai-contact').value.trim(),
        plan_date: document.getElementById('ai-date').value.trim(),
        travel_date: document.getElementById('ai-date').value.trim(),
        days: document.getElementById('ai-days').value.trim(),
        people: document.getElementById('ai-people').value.trim(),
        product_interest: document.getElementById('ai-product').value,
        intent_level: document.getElementById('ai-intent').value,
        blocker: document.getElementById('ai-blocker').value.trim(),
        inquiry_status: '咨询中',
        first_inquiry_date: u.today(),
        follow_up_script: document.getElementById('ai-script')?.value || '',
        concerns: result.concerns || [],
        ai_score: result.score || 0,
        ai_grade: result.grade || '',
        chat_history: document.getElementById('ai-text')?.value || '',
      });
      u.toast('已保存 ✅');
      JC.Router.navigate('wa');
    });
  }

  return { renderAddForm };
})();
