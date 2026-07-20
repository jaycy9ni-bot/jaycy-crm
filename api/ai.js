import OpenAI from 'openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(corsHeaders).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).set(corsHeaders).json({ error: 'Method not allowed' });
  }

  const { action, text, module } = req.body || {};
  if (action !== 'parseChat' || !text || !text.trim()) {
    return res.status(400).set(corsHeaders).json({ error: 'Missing action or text' });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const useDeepSeek = !!(deepseekKey && !deepseekKey.startsWith('placeholder'));
  const apiKey = useDeepSeek ? deepseekKey : openaiKey;

  if (!apiKey || apiKey === 'sk-your-key') {
    return res.status(200).set(corsHeaders).json({ mock: true, ...getMockResponse(text, module) });
  }

  try {
    const openai = useDeepSeek
      ? new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com' })
      : new OpenAI({ apiKey: openaiKey });

    const model = useDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini';
    const systemPrompt = getSystemPrompt(module || 'wa');

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
    });

    const raw = (completion.choices[0]?.message?.content || '{}').trim();
    const clean = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const result = JSON.parse(clean);
    return res.status(200).set(corsHeaders).json(result);
  } catch (err) {
    console.error('AI parse error:', err);
    return res.status(500).set(corsHeaders).json({
      error: 'AI parsing failed',
      message: err.message,
      mock: true,
      ...getMockResponse(text, module),
    });
  }
}

function getSystemPrompt(module) {
  if (module === 'xl') {
    return `你是小羚不卷的求职服务运营专家，擅长从对话中提取求职线索信息。

任务：分析下面这段对话，输出一个严格的 JSON 对象。不要添加任何解释。

{
  "nickname": "昵称",
  "contact": "联系方式",
  "source": "线索来源：朋友圈/私信/群/推荐",
  "service_type": "感兴趣的产品：全能学习包/全景咨询/其他",
  "career_stage": "在校生/应届/1-3年/3-5年/5年+",
  "target_industry": "目标行业",
  "target_role": "目标岗位",
  "urgency": "紧急/一般/观望",
  "tags": [],
  "score": 0,
  "grade": "A/B/C/D"
}

评分规则：
- 已确定要购买产品：+30
- 主动询问价格：+20
- 提供详细求职背景：+20
- 回复积极：+15
- 索要链接/资料：+15
等级：A(80-100)/B(60-79)/C(40-59)/D(<40)
只输出 JSON。`;
  }

  return `你是一名资深的西澳旅游销售专家。

任务：分析聊天记录，输出严格 JSON 对象。只输出 JSON。

{
  "basicInfo": {"nickname":"","contact":"","travelDate":"","travelDays":"","peopleCount":"","relationship":"家庭游/亲子游/情侣游/夫妻游/朋友游/独自出行/未知"},
  "travelStatus": {"ticket":"已购买/正在购买/未购买/未知","visa":"已办理/办理中/未办理/未知"},
  "decisionMaker":"本人/夫妻共同决定/家庭共同决定/未知",
  "budget":"经济型/性价比型/舒适型/高端型/未知",
  "tags":["#家庭游","#高意向"],
  "score":85,
  "grade":"A/B/C/D",
  "concerns":["价格敏感"],
  "recommendedProduct":{"name":"全景七日/明星六日/粉湖轻奢两日游","reason":""},
  "alternativeProducts":[{"name":"","reason":""}],
  "followUp":{"time":"7天后联系","reason":"","content":"","script":"完整跟进话术"}
}

评分规则：出行时间确定+20，已买机票+20，人数明确+15，主动询价+15，预算明确+10，索要资料+5，出行意愿+15
等级：A(80-100)/B(60-79)/C(40-59)/D(<40)
只输出 JSON。`;
}

function getMockResponse(text, module) {
  const hasDate = /\d{4}[\.\-]\d{1,2}[\.\-]\d{1,2}|\d{1,2}[\-\.]\d{1,2}/.test(text);
  const hasTicket = /机票|航班/.test(text);
  const hasPeople = /\d+\s*人/.test(text);
  const hasPrice = /合计|总价|多少钱|价格/.test(text);

  if (module === 'xl') {
    const stage = /应届|校招|毕业生/.test(text) ? '应届' : /在校/.test(text) ? '在校生' : '';
    return {
      nickname: '',
      contact: '',
      source: '',
      service_type: hasPrice ? '全能学习包' : '',
      career_stage: stage,
      target_industry: '',
      target_role: '',
      urgency: hasPrice ? '紧急' : '一般',
      tags: stage ? [`#${stage}`] : [],
      score: hasPrice ? 75 : 50,
      grade: hasPrice ? 'B' : 'C',
    };
  }

  let score = 55;
  if (hasDate) score += 20;
  if (hasTicket) score += 20;
  if (hasPeople) score += 15;
  if (hasPrice) score += 15;
  score = Math.min(100, score);

  return {
    basicInfo: { nickname: '', contact: '', travelDate: hasDate ? '2026.8.1' : '', travelDays: '', peopleCount: hasPeople ? '3' : '', relationship: '' },
    travelStatus: { ticket: hasTicket ? '已购买' : '未购买', visa: '未办理' },
    decisionMaker: '本人',
    budget: '性价比型',
    tags: ['#高意向'],
    score,
    grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
    concerns: hasPrice ? ['价格敏感'] : ['时间未确定'],
    recommendedProduct: { name: '全景七日', reason: '经典行程' },
    alternativeProducts: [{ name: '明星六日', reason: '轻松行程' }],
    followUp: { time: '7天后联系', reason: '等待确认', content: '分享实拍', script: '亲～最近西澳天气很好☀️\n您们人数确定后我帮您算最划算的方案～' },
  };
}
