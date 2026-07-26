-- ============================================================
-- Jaycy CRM V3 - 数据库升级2（成单表字段调整 + 产品选项��
-- ============================================================

-- 成单表增加字段
ALTER TABLE wa_deals
  ADD COLUMN IF NOT EXISTS wechat_name TEXT,           -- 客户微信名
  ADD COLUMN IF NOT EXISTS travel_days TEXT,            -- 出行天数
  ADD COLUMN IF NOT EXISTS pickup_dropoff TEXT;         -- 接送机

-- 咨询表增加卡点字段
ALTER TABLE wa_customers
  ADD COLUMN IF NOT EXISTS blocker TEXT;                -- 卡点（客户卡在哪里）
