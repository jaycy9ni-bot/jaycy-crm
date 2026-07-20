-- ============================================================
-- Jaycy CRM V3 - Supabase 数据库建表脚本
-- 请在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ============================================================

-- 1. 用户资料表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  deepseek_api_key TEXT,
  default_module TEXT DEFAULT 'wa',
  notification_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 工作模块表
CREATE TABLE IF NOT EXISTS work_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, code)
);

-- 3. 西澳客户表
CREATE TABLE IF NOT EXISTS wa_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES work_modules(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  contact TEXT,
  wechat_id TEXT,
  first_inquiry_date DATE,
  chat_history TEXT,
  travel_date TEXT,
  travel_days TEXT,
  people_count TEXT,
  relationship TEXT,
  budget TEXT,
  ticket_status TEXT,
  visa_status TEXT,
  decision_maker TEXT,
  ai_score INTEGER DEFAULT 0,
  ai_grade TEXT,
  concerns TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  recommended_product TEXT,
  recommended_reason TEXT,
  alternative_products JSONB DEFAULT '[]'::jsonb,
  last_contact_date DATE,
  next_follow_up_date DATE,
  follow_up_reason TEXT,
  follow_up_script TEXT,
  status TEXT DEFAULT 'active',
  outcome TEXT,
  lost_reason TEXT,
  group_status TEXT,
  welcome_sent BOOLEAN DEFAULT FALSE,
  deal_product TEXT,
  deal_amount TEXT,
  deal_date DATE,
  deal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 小羚线索表
CREATE TABLE IF NOT EXISTS xl_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES work_modules(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  contact TEXT,
  wechat_id TEXT,
  source TEXT,
  service_type TEXT,
  career_stage TEXT,
  target_industry TEXT,
  target_role TEXT,
  urgency TEXT,
  form_filled BOOLEAN DEFAULT FALSE,
  form_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'new',
  tags TEXT[] DEFAULT '{}',
  ai_score INTEGER DEFAULT 0,
  ai_grade TEXT,
  group_added BOOLEAN DEFAULT FALSE,
  group_name_changed BOOLEAN DEFAULT FALSE,
  welcome_sent BOOLEAN DEFAULT FALSE,
  group_name TEXT,
  last_reply_template TEXT,
  last_contact_date DATE,
  next_follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 成单表（西澳专用）
CREATE TABLE IF NOT EXISTS wa_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES wa_customers(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_code TEXT,
  travel_date DATE,
  people_count INTEGER,
  total_amount TEXT,
  payment_status TEXT,
  special_requests TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 跟进记录表（两模块共用）
CREATE TABLE IF NOT EXISTS follow_up_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  customer_id UUID NOT NULL,
  content TEXT NOT NULL,
  method TEXT,
  ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 任务/待办表（两模块共用）
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  due_date DATE,
  due_time TEXT,
  recurring TEXT,
  related_customer_id UUID,
  auto_created BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 快捷回复模板表
CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  action_url TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 房态/折扣通知表（西澳专用）
CREATE TABLE IF NOT EXISTS wa_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AI Prompt 模板表
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS 策略（所有表统一模式）
-- ============================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- work_modules
ALTER TABLE work_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wm_select" ON work_modules FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "wm_insert" ON work_modules FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "wm_update" ON work_modules FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "wm_delete" ON work_modules FOR DELETE USING (owner_id = auth.uid());

-- wa_customers
ALTER TABLE wa_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wac_select" ON wa_customers FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "wac_insert" ON wa_customers FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "wac_update" ON wa_customers FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "wac_delete" ON wa_customers FOR DELETE USING (owner_id = auth.uid());

-- xl_leads
ALTER TABLE xl_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xll_select" ON xl_leads FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "xll_insert" ON xl_leads FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "xll_update" ON xl_leads FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "xll_delete" ON xl_leads FOR DELETE USING (owner_id = auth.uid());

-- wa_deals
ALTER TABLE wa_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wad_select" ON wa_deals FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "wad_insert" ON wa_deals FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "wad_update" ON wa_deals FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "wad_delete" ON wa_deals FOR DELETE USING (owner_id = auth.uid());

-- follow_up_logs
ALTER TABLE follow_up_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ful_select" ON follow_up_logs FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "ful_insert" ON follow_up_logs FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ful_update" ON follow_up_logs FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "ful_delete" ON follow_up_logs FOR DELETE USING (owner_id = auth.uid());

-- tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "t_select" ON tasks FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "t_insert" ON tasks FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "t_update" ON tasks FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "t_delete" ON tasks FOR DELETE USING (owner_id = auth.uid());

-- reply_templates
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt_select" ON reply_templates FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "rt_insert" ON reply_templates FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "rt_update" ON reply_templates FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "rt_delete" ON reply_templates FOR DELETE USING (owner_id = auth.uid());

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "n_select" ON notifications FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "n_insert" ON notifications FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "n_update" ON notifications FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "n_delete" ON notifications FOR DELETE USING (owner_id = auth.uid());

-- wa_notices
ALTER TABLE wa_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wan_select" ON wa_notices FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "wan_insert" ON wa_notices FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "wan_update" ON wa_notices FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "wan_delete" ON wa_notices FOR DELETE USING (owner_id = auth.uid());

-- ai_prompt_templates
ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apt_select" ON ai_prompt_templates FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "apt_insert" ON ai_prompt_templates FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "apt_update" ON ai_prompt_templates FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "apt_delete" ON ai_prompt_templates FOR DELETE USING (owner_id = auth.uid());

-- ============================================================
-- 触发器：新用户注册时自动创建 profiles 记录
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- 为新用户创建两个默认工作模块
  INSERT INTO public.work_modules (owner_id, code, name, config)
  VALUES 
    (NEW.id, 'wa', '玩转西澳', '{"peak_hours": ["9:00","16:00-17:00","19:00-21:00"], "first_touch_target_min": 5}'::jsonb),
    (NEW.id, 'xl', '小羚不卷', '{"working_hours": "10:00-19:00", "broadcast_time": "14:30", "meeting_time": "周三15:00"}'::jsonb);

  -- 创建默认周期任务
  INSERT INTO public.tasks (owner_id, module_code, title, task_type, due_time, recurring, priority, auto_created)
  VALUES
    (NEW.id, 'xl', '14:30 微伴群发', 'broadcast', '14:30', 'weekdays', 'high', TRUE),
    (NEW.id, 'xl', '朋友圈发送', 'social', NULL, 'daily', 'normal', TRUE),
    (NEW.id, 'xl', '周三例会', 'meeting', '15:00', 'weekly_wed', 'high', TRUE),
    (NEW.id, 'wa', '睡前检查：更新表格+回访', 'daily_review', '21:00', 'daily', 'high', TRUE);

  -- 创建默认快捷回复模板
  INSERT INTO public.reply_templates (owner_id, module_code, name, category, content, variables, is_default)
  VALUES
    (NEW.id, 'xl', '通用欢迎语', '欢迎语', '你好 {nickname}～欢迎加入小羚不卷！🎉\n\n这里有最新的远程求职信息、岗位内推和直播分享。\n\n可以先看看我们的【全能学习包】，里面包含了岗位表、内推表、直播回放和英语角等资源～\n\n有任何问题随时找我哦 😊', ARRAY['{nickname}'], TRUE),
    (NEW.id, 'xl', '应届生欢迎语', '欢迎语', '你好 {nickname}～欢迎加入！🎓\n\n作为应届生，建议你先了解一下我们的【全能学习包】，里面有专门针对校招的岗位表和内推信息～\n\n另外也可以预约【全景咨询】，和我们的求职导师深度聊聊你的职业方向 😊', ARRAY['{nickname}'], TRUE),
    (NEW.id, 'xl', '催促填表', '催促', 'Hi {nickname}～之前发给你的深度求职服务线索表还没收到你的填写哦 📝\n\n填完这个表，我们的专业顾问可以更精准地帮你匹配机会～\n\n需要我重新发你链接吗？', ARRAY['{nickname}'], TRUE),
    (NEW.id, 'xl', '产品介绍-学习包', '报价', 'Hi {nickname}～给你介绍一下【全能学习包】👇\n\n📋 包含内容：\n• 最新远程岗位表（每周更新）\n• 内推机会表\n• 直播分享回放\n• 英语角活动\n\n💰 价格私聊～\n\n感兴趣的话我发你详细内容？', ARRAY['{nickname}'], TRUE),
    (NEW.id, 'xl', '产品介绍-全景咨询', '报价', 'Hi {nickname}～【全景咨询】是和我们的求职导师进行3小时的一对一电话咨询 📞\n\n导师会帮你：\n• 梳理职业方向\n• 分析简历问题\n• 制定求职策略\n\n💰 详情私聊～感兴趣的话我帮你预约时间？', ARRAY['{nickname}'], TRUE),
    (NEW.id, 'wa', '首触问候', '问候', '您好～欢迎咨询西澳旅游！☀️\n\n请问您们大概什么时间出行呢？几个人一起？\n\n我这边可以根据您的需求推荐最合适的路线～', ARRAY['{}'], TRUE),
    (NEW.id, 'wa', '价格追问回复', '报价', '亲～价格方面我帮您详细算一下：\n\n{product} 目前的套餐价格是 xxx/人，包含了 {inclusions}\n\n如果人数更多的话，单价会更优惠哦～\n\n您们是几个人一起呢？我帮您算个精确的报价 😊', ARRAY['{product}', '{inclusions}'], TRUE),
    (NEW.id, 'wa', '行程结束回访', '跟进', '亲～行程结束啦，西澳玩得怎么样呀？🌅\n\n有没有什么特别喜欢的景点或者觉得可以改进的地方？\n\n方便的话可以给我们一个好评嘛～下次再来玩我给您老客户优惠 😊', ARRAY['{}'], TRUE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
