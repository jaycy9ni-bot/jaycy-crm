import OpenAI from 'openai';

// 允许跨域（前端在 GitHub Pages）
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

  const { action, text } = req.body || {};

  if (action !== 'parseChat' || !text || !text.trim()) {
    return res.status(400).set(corsHeaders).json({ error: 'Missing action or text' });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const useDeepSeek = !!(deepseekKey && !deepseekKey.startsWith('placeholder'));
  const apiKey = useDeepSeek ? deepseekKey : openaiKey;

  // 如果没有 API Key，返回 mock 数据（方便前端联调）
  if (!apiKey || apiKey === 'sk-your-key') {
    return res.status(200).set(corsHeaders).json({
      mock: true,
      ...getMockResponse(text),
    });
  }

  try {
    const openai = useDeepSeek
      ? new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com' })
      : new OpenAI({ apiKey: openaiKey });

    const model = useDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini';
    const responseFormat = useDeepSeek ? undefined : { type: 'json_object' };

    const systemPrompt = `你是一名资深的西澳旅游销售专家，擅长从客户聊天记录中提取关键信息并给出销售建议。

任务：分析下面这段销售聊天记录，输出一个严格的 JSON 对象。不要添加任何解释、注释或 Markdown 代码块，只输出 JSON。

必须严格使用以下英文键名和结构：
{
  "basicInfo": {
    "nickname": "客户昵称或微信名，没有就空字符串",
    "contact": "联系电话，没有就空字符串",
    "travelDate": "出行日期，如 2026.8.1，没有就空字符串",
    "travelDays": "出行天数，没有就空字符串",
    "peopleCount": "人数，没有就空字符串",
    "relationship": "家庭游/亲子游/情侣游/夫妻游/朋友游/独自出行/未知，没有就空字符串"
  },
  "travelStatus": {
    "ticket": "已购买/正在购买/未购买/未知，没有就空字符串",
    "visa": "已办理/办理中/未办理/未知，没有就空字符串"
  },
  "decisionMaker": "本人/夫妻共同决定/家庭共同决定/朋友共同决定/未知，没有就空字符串",
  "budget": "经济型/性价比型/舒适型/高端型/未知，没有就空字符串",
  "tags": ["#家庭游", "#第一次来西澳", "#高意向"],
  "score": 85,
  "grade": "A/B/C/D",
  "concerns": ["价格敏感", "等机票"],
  "recommendedProduct": {
    "name": "根据客户兴趣和出行情况推荐的主推产品，如全景七日/明星六日/粉湖轻奢两日游，没有就空字符串",
    "reason": "一句话说明为什么推荐"
  },
  "alternativeProducts": [
    {"name": "备选产品名称", "reason": "适合什么情况"}
  ],
  "followUp": {
    "time": "7天后联系/14天后联系/30天后联系",
    "reason": "等待机票/等待人数确定/等待签证/等同行人决定/等签证",
    "content": "具体要跟客户分享什么，如分享野花季视频/提醒旺季位置紧张/提醒机票价格波动",
    "script": "一段完整、自然、亲切的中文跟进话术，可以直接复制发给客户"
  }
}

评分规则（0-100分）：
- 已确定出行时间���+20
- 已买机票：+20
- 人数明确：+15
- 主动询价/积极回复：+15
- 预算明确：+10
- 主动索要资料/行程：+5
- 有明确出行意愿：+15

等级规则：
- 80-100：A（高意向）
- 60-79：B（中意向）
- 40-59：C（低意向）
- 40以下：D（长期培育）

注意事项：
1. 必须使用上述英文键名，不要使用中文字段名。
2. 如果聊天记录中没有明确信息，对应字段留空字符串，不要猜测。
3. tags 数组根据客户特征生成，如 #家庭游、#第一次来西澳、#高意向、#9月出行。
4. recommendedProduct 和 alternativeProducts 必须根据客户提到的兴趣或西澳旅游产品来推荐。
5. followUp.script 必须是一段完整、可直接发送的中文话术，不要只写"推荐话术"四个字。
6. 只输出 JSON，不要任何其他文字。`;

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      ...(responseFormat ? { response_format: responseFormat } : {}),
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
      ...getMockResponse(text),
    });
  }
}

function getMockResponse(text) {
  // 根据文本内容做一点点关键词触发，让 mock 不那么假
  const hasTicket = /机票|航班|jq|落地|起飞/.test(text);
  const hasDeposit = /定金|首付|已付|全款/.test(text);
  const hasFamily = /家庭|亲子|孩子|爸妈|父母/.test(text);
  const hasCouple = /情侣|夫妻|蜜月|两口子/.test(text);
  const hasFriends = /朋友|闺蜜|兄弟|同伴|同行/.test(text);
  const hasDate = /\d{4}[\.\-]\d{1,2}[\.\-]\d{1,2}|\d{1,2}[\-\.]\d{1,2}/.test(text);
  const hasPeople = /\d+\s*人/.test(text);
  const hasPrice = /合计|总价|多少钱|价格|澳元|aud/.test(text);

  let score = 55;
  if (hasDate) score += 20;
  if (hasTicket) score += 20;
  if (hasPeople) score += 15;
  if (hasPrice) score += 15;
  if (hasDeposit) score += 15;
  score = Math.min(100, score);

  let grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  let relationship = hasFamily ? '家庭游' : hasCouple ? '夫妻游' : hasFriends ? '朋友游' : '独自出行';

  return {
    basicInfo: {
      nickname: '',
      contact: '',
      travelDate: hasDate ? '2026.8.1' : '',
      travelDays: '',
      peopleCount: hasPeople ? '3' : '',
      relationship: relationship,
    },
    travelStatus: {
      ticket: hasTicket ? '已购买' : '未购买',
      visa: '未办理',
    },
    decisionMaker: '本人',
    budget: '性价比型',
    tags: [relationship === '独自出行' ? '个人游' : `#${relationship}`, '#高意向'],
    score: score,
    grade: grade,
    concerns: hasPrice ? ['价格敏感'] : ['时间未确定'],
    recommendedProduct: {
      name: '全景七日',
      reason: '第一次来西澳，希望经典景点一次玩全',
    },
    alternativeProducts: [
      { name: '明星六日', reason: '偏好轻松行程' },
    ],
    followUp: {
      time: '7天后联系',
      reason: hasTicket ? '等待人数确定' : '等待机票',
      content: '分享野花季视频',
      script: '亲～最近北线野花已经陆续开放啦🌸\n给您看看最近客人的实拍～\n您们人数确定后，我也可以帮您重新核算最划算的房型组合😊',
    },
  };
}
