-- ============================================================
-- RENAX Admin Notifications Table
-- Run this in Supabase SQL Editor after 00_renax_core_setup.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,       -- 'new_shipment' | 'shipment_completed' | 'shipment_cancelled' | 'new_customer' | 'rider_online' | 'rider_offline' | 'customer_frozen' | 'stale_shipment'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  reference_id UUID,               -- shipment_id or profile_id that triggered the event
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Fast queries: unread count + ordered list
CREATE INDEX IF NOT EXISTS idx_admin_notif_read ON public.admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notif_created ON public.admin_notifications(created_at DESC);

-- RLS: open for service-role writes, authenticated admin reads
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can read notifications"   ON public.admin_notifications FOR SELECT USING (true);
CREATE POLICY "Admin can update notifications" ON public.admin_notifications FOR UPDATE USING (true);
CREATE POLICY "Service can insert notifications" ON public.admin_notifications FOR INSERT WITH CHECK (true);

-- Enable Realtime so the dashboard receives live pushes
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

NOTIFY pgrst, 'reload schema';
