// ============================================================
// Jaycy CRM V3 - AI 服务（DeepSeek API + OCR）
// ============================================================
window.JC = window.JC || {};

JC.AI = (() => {
  const u = JC.Utils;
  const VERCEL_API = 'https://jaycy-crm-ai.vercel.app/api/ai';

  async function renderAddForm(container, module) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title mb-12">
          🤖 AI 录入 - ${module === 'wa' ? '西澳客户' : '小羚线索'}
        </div>

        <!-- 文本输入 -->
        <div class="form-group">
          <label class="form-label">粘贴聊天记录</label>
          <textarea class="form-textarea" id="ai-chat-text" placeholder="粘贴微信聊天记录...&#10;&#10;支持多段对话，AI 会自动提取关键信息" style="min-height:150px;"></textarea>
        </div>

        <!-- OCR 图片上传 -->
        <div class="form-group">
          <label class="form-label">或上传聊天截图</label>
          <div id="ocr-area" style="border:2px dashed var(--border);border-radius:12px;padding:24px;text-align:center;cursor:pointer;">
            <div style="font-size:32px;">📸</div>
            <p class="text-sm text-muted mt-8">点击上传或粘贴截图</p>
            <p class="text-xs text-muted">支持中英文识别</p>
            <input type="file" id="ocr-input" accept="image/*" style="display:none;" multiple>
          </div>
          <div id="ocr-images" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"></div>
          <div id="ocr-status" class="text-xs text-muted mt-4"></div>
        </div>

        <button class="btn btn-primary btn-block mt-16" id="btn-ai-parse" disabled>
          🔍 AI 解析
        </button>
      </div>

      <!-- 解析结果 -->
      <div id="ai-result" style="display:none;"></div>
    `;

    const textArea = document.getElementById('ai-chat-text');
    const parseBtn = document.getElementById('btn-ai-parse');
    const ocrArea = document.getElementById('ocr-area');
    const ocrInput = document.getElementById('ocr-input');

    // 启用/禁用解析按钮
    const updateBtn = () => {
      parseBtn.disabled = !textArea.value.trim() && ocrTexts.length === 0;
    };
    textArea.addEventListener('input', updateBtn);

    // OCR
    let ocrTexts = [];
    ocrArea.addEventListener('click', () => ocrInput.click());
    ocrInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await processOCR(file);
      }
    });

    // 粘贴图片
    document.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          await processOCR(file);
        }
      }
    });

    async function processOCR(file) {
      const status = document.getElementById('ocr-status');
      status.textContent = '识别中...';
      const imgContainer = document.getElementById('ocr-images');

      // 显示缩略图
      const url = URL.createObjectURL(file);
      const imgEl = document.createElement('img');
      imgEl.src = url;
      imgEl.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;';
      imgContainer.appendChild(imgEl);

      try {
        if (window.Tesseract) {
          const { data: { text } } = await Tesseract.recognize(file, 'chi_sim+eng');
          ocrTexts.push(text);
          status.textContent = `已识别 ${ocrTexts.length} 张图片`;
          updateBtn();
        } else {
          // Tesseract 未加载
          status.textContent = 'OCR 库未加载，请使用文本粘贴';
        }
      } catch (err) {
        status.textContent = '识别失败，请手动输入';
      }
    }

    // AI 解析
    parseBtn.addEventListener('click', async () => {
      const rawText = textArea.value.trim();
      const ocrText = ocrTexts.join('\n');
      const fullText = [rawText, ocrText].filter(Boolean).join('\n\n');

      if (!fullText) { u.toast('请粘贴聊天记录或上传截图'); return; }

      parseBtn.disabled = true;
      parseBtn.textContent = '⏳ AI 解析中...';

      const result = await callAI(fullText, module);

      parseBtn.disabled = false;
      parseBtn.textContent = '🔍 AI 解析';

      if (!result || result.error) {
        u.toast('AI 解析失败: ' + (result?.message || '未知错误'));
        return;
      }

      showResult(result, module);
    });
  }

  async function callAI(text, module) {
    try {
      // 优先用 Vercel 代理
      const resp = await fetch(VERCEL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parseChat', text, module }),
      });
      return await resp.json();
    } catch (err) {
      // 回退：尝试浏览器直连 DeepSeek
      try {
        const profile = await JC.Supabase.getProfile();
        const key = profile?.deepseek_api_key;
        if (key) {
          const resp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: getSystemPrompt(module) },
                { role: 'user', content: text },
              ],
              temperature: 0.2,
            }),
          });
          const data = await resp.json();
          const raw = data.choices?.[0]?.message?.content || '{}';
          const clean = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          return JSON.parse(clean);
        }
      } catch (e2) { /* 降级 */ }
      return { error: 'AI 不可用', mock: true };
    }
  }

  function getSystemPrompt(module) {
    if (module === 'xl') {
      return `你是小羚不卷的求职服务运营专家。从对话中提取求职线索信息。

输出严格 JSON（不要其他内容）：
{
  "nickname": "昵称",
  "contact": "联系方式",
  "source": "来源",
  "service_type": "感兴趣的产品",
  "career_stage": "在校生/应届/1-3年/3-5年/5年+",
  "target_industry": "目标行业",
  "target_role": "目标岗位",
  "urgency": "紧急/一般/观望",
  "tags": ["标签"],
  "score": 0-100,
  "grade": "A/B/C/D"
}`;
    }
    return `你是西澳旅游销售专家。从聊天记录提取信息。

输出严格 JSON：
{
  "basicInfo": {"nickname":"","contact":"","travelDate":"","travelDays":"","peopleCount":"","relationship":""},
  "travelStatus": {"ticket":"","visa":""},
  "decisionMaker":"",
  "budget":"",
  "tags":[],
  "score":0,
  "grade":"",
  "concerns":[],
  "recommendedProduct":{"name":"","reason":""},
  "alternativeProducts":[],
  "followUp":{"time":"","reason":"","content":"","script":""}
}`;
  }

  function showResult(result, module) {
    const container = document.getElementById('ai-result');
    container.style.display = 'block';

    if (module === 'wa') {
      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">📊 AI 解析结果</span>
            <span class="badge badge-${result.grade || 'D'}">${result.grade || '?'}级 · ${result.score || 0}分</span>
          </div>

          <div class="form-group">
            <label class="form-label">昵称</label>
            <input class="form-input" id="ai-nickname" value="${u.esc(result.basicInfo?.nickname || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">出行日期</label>
            <input class="form-input" id="ai-travel-date" value="${u.esc(result.basicInfo?.travelDate || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">人数</label>
            <input class="form-input" id="ai-people" value="${u.esc(result.basicInfo?.peopleCount || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">关系</label>
            <input class="form-input" id="ai-relationship" value="${u.esc(result.basicInfo?.relationship || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">推荐产品</label>
            <input class="form-input" id="ai-product" value="${u.esc(result.recommendedProduct?.name || '')}">
          </div>
          ${result.concerns?.length ? `<div class="mb-12">${result.concerns.map(c => `<span class="tag" style="background:var(--danger-light);">${u.esc(c)}</span>`).join(' ')}</div>` : ''}
          ${result.followUp?.script ? `
            <div class="form-group">
              <label class="form-label">跟进话术</label>
              <textarea class="form-textarea" id="ai-script" style="min-height:80px;">${u.esc(result.followUp.script)}</textarea>
            </div>
          ` : ''}

          <button class="btn btn-primary btn-block mt-12" id="btn-ai-save">💾 确认保存到西澳客户库</button>
        </div>
      `;

      document.getElementById('btn-ai-save').addEventListener('click', async () => {
        await JC.Store.waSaveCustomer({
          nickname: document.getElementById('ai-nickname').value.trim() || '未命名',
          travel_date: document.getElementById('ai-travel-date').value.trim(),
          people_count: document.getElementById('ai-people').value.trim(),
          relationship: document.getElementById('ai-relationship').value.trim(),
          recommended_product: document.getElementById('ai-product').value.trim(),
          follow_up_script: document.getElementById('ai-script')?.value || '',
          ai_score: result.score || 0,
          ai_grade: result.grade || '',
          concerns: result.concerns || [],
          tags: result.tags || [],
          chat_history: document.getElementById('ai-chat-text')?.value || '',
          first_inquiry_date: u.today(),
        });
        u.toast('已保存 ✅');
        JC.Router.navigate('wa');
      });
    } else {
      // 小羚模块
      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">📊 AI 解析结果</span>
            <span class="badge badge-${result.grade || 'B'}">${result.grade || '?'}级</span>
          </div>
          <div class="form-group"><label class="form-label">昵称</label><input class="form-input" id="ai-nickname" value="${u.esc(result.nickname || '')}"></div>
          <div class="form-group"><label class="form-label">来源</label><input class="form-input" id="ai-source" value="${u.esc(result.source || '')}"></div>
          <div class="form-group"><label class="form-label">求职阶段</label><input class="form-input" id="ai-stage" value="${u.esc(result.career_stage || '')}"></div>
          <div class="form-group"><label class="form-label">目标行业</label><input class="form-input" id="ai-industry" value="${u.esc(result.target_industry || '')}"></div>
          <div class="form-group"><label class="form-label">目标岗位</label><input class="form-input" id="ai-role" value="${u.esc(result.target_role || '')}"></div>
          <div class="form-group"><label class="form-label">紧急程度</label>
            <select class="form-select" id="ai-urgency">
              <option ${result.urgency === '紧急' ? 'selected' : ''}>紧急</option>
              <option ${result.urgency === '一般' ? 'selected' : ''}>一般</option>
              <option ${result.urgency === '观望' ? 'selected' : ''}>观望</option>
            </select>
          </div>
          <button class="btn btn-primary btn-block mt-12" id="btn-ai-save">💾 确认保存到小羚线索库</button>
        </div>
      `;

      document.getElementById('btn-ai-save').addEventListener('click', async () => {
        await JC.Store.xlSaveLead({
          nickname: document.getElementById('ai-nickname').value.trim() || '未命名',
          source: document.getElementById('ai-source').value.trim(),
          career_stage: document.getElementById('ai-stage').value.trim(),
          target_industry: document.getElementById('ai-industry').value.trim(),
          target_role: document.getElementById('ai-role').value.trim(),
          urgency: document.getElementById('ai-urgency').value,
          tags: result.tags || [],
          ai_score: result.score || 0,
          ai_grade: result.grade || '',
        });
        u.toast('已保存 ✅');
        JC.Router.navigate('xl');
      });
    }
  }

  return { renderAddForm };
})();
