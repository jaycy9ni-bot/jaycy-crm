-- ============================================================
-- Jaycy CRM V3 - 数据库升级
-- 请在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 咨询表增加字段（对应腾讯文档咨询表）
ALTER TABLE wa_customers 
  ADD COLUMN IF NOT EXISTS wechat_name TEXT,
  ADD COLUMN IF NOT EXISTS days TEXT,
  ADD COLUMN IF NOT EXISTS product_interest TEXT,
  ADD COLUMN IF NOT EXISTS inquiry_status TEXT,
  ADD COLUMN IF NOT EXISTS intent_level TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_1 TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_2 TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_3 TEXT,
  ADD COLUMN IF NOT EXISTS room_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_detail TEXT,
  ADD COLUMN IF NOT EXISTS final_payment_date TEXT,
  ADD COLUMN IF NOT EXISTS review TEXT;

-- 2. 成单表增加字段（对应腾讯文档成单表 + 老板要求）
ALTER TABLE wa_deals
  ADD COLUMN IF NOT EXISTS order_date DATE,
  ADD COLUMN IF NOT EXISTS settlement_month TEXT,
  ADD COLUMN IF NOT EXISTS group_date TEXT,
  ADD COLUMN IF NOT EXISTS end_date TEXT,
  ADD COLUMN IF NOT EXISTS customer_info TEXT,
  ADD COLUMN IF NOT EXISTS contact_info TEXT,
  ADD COLUMN IF NOT EXISTS room_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS final_payment_date TEXT,
  ADD COLUMN IF NOT EXISTS review TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT DEFAULT 'Jaycy';

-- 3. 更新触发器（增加上午追单任务）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.work_modules (owner_id, code, name, config)
  VALUES 
    (NEW.id, 'wa', '玩转西澳', '{"peak_hours": ["9:00","16:00-17:00","19:00-21:00"], "first_touch_target_min": 5, "settlement_day": 27}'::jsonb),
    (NEW.id, 'xl', '小羚不卷', '{"working_hours": "10:00-19:00", "broadcast_time": "14:30", "meeting_time": "周三15:00"}'::jsonb);

  INSERT INTO public.tasks (owner_id, module_code, title, task_type, due_time, recurring, priority, auto_created)
  VALUES
    (NEW.id, 'xl', '14:30 微伴群发', 'broadcast', '14:30', 'weekdays', 'high', TRUE),
    (NEW.id, 'xl', '周三例会', 'meeting', '15:00', 'weekly_wed', 'high', TRUE),
    (NEW.id, 'wa', '睡前检查：更新表格+回访', 'daily_review', '21:00', 'daily', 'high', TRUE),
    (NEW.id, 'wa', '上午追单', 'follow_up', '09:30', 'weekdays', 'high', TRUE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
