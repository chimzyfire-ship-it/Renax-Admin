-- ============================================================
-- RENAX LOGISTICS - INITIAL CORE SCHEMA SETUP
-- Run this in your Supabase SQL Editor to create the base tables.
-- ============================================================

-- 1. PROFILES TABLE (Stores Customers, Riders, Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone_number TEXT,
  role TEXT DEFAULT 'customer', -- 'customer', 'driver', 'admin'
  payment_method TEXT,
  avatar_url TEXT,
  home_lat FLOAT,
  home_lng FLOAT,
  is_online BOOLEAN DEFAULT false,
  is_restricted BOOLEAN DEFAULT false, -- Used by Admin to freeze accounts
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for profiles but allow public read/write for demo purposes
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public profiles write" ON public.profiles FOR ALL USING (true);

-- 2. SHIPMENTS TABLE (For tracking logistics orders)
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  pickup TEXT,
  dropoff TEXT,
  pickup_lat FLOAT,
  pickup_lng FLOAT,
  dropoff_lat FLOAT,
  dropoff_lng FLOAT,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  price TEXT,
  distance_km FLOAT,
  delivery_pin TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public shipments read" ON public.shipments FOR SELECT USING (true);
CREATE POLICY "Public shipments write" ON public.shipments FOR ALL USING (true);

-- 3. MISSIONS TABLE (Legacy / Rider job tracking if still used)
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  pickup TEXT,
  dropoff TEXT,
  pickup_lat FLOAT,
  pickup_lng FLOAT,
  dropoff_lat FLOAT,
  dropoff_lng FLOAT,
  status TEXT DEFAULT 'pending',
  price TEXT,
  distance_km FLOAT,
  delivery_pin TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public missions read" ON public.missions FOR SELECT USING (true);
CREATE POLICY "Public missions write" ON public.missions FOR ALL USING (true);

-- 4. Set up realtime tracking
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.missions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
