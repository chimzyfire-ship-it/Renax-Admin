-- ============================================================
-- RENAX LOGISTICS — FIX shipments_status_check CONSTRAINT
-- Run this in your Supabase SQL Editor.
--
-- Background:
-- The shipments table has a CHECK constraint (shipments_status_check)
-- that only allows a limited set of status values. The original
-- schema comment listed: 'pending', 'in_progress', 'completed', 'cancelled'
-- but the frontend was writing Title Case strings like 'Pending',
-- 'Out for Delivery', etc.
--
-- This migration:
-- 1) Drops the old constraint FIRST (so updates don't violate it)
-- 2) Normalises any existing status values to lowercase
-- 3) Re-creates the constraint with the canonical values
-- ============================================================

-- 1. Drop the old constraint FIRST so the normalisation UPDATEs don't violate it
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_status_check;

-- 2. Normalise existing rows to match the canonical lowercase values
UPDATE public.shipments SET status = 'pending'     WHERE status IN ('Pending', 'Pending Routing', 'Pending Review', 'Awaiting Rider', 'Awaiting First-Mile Rider');
UPDATE public.shipments SET status = 'in_progress' WHERE status IN ('In Transit', 'Out for Delivery', 'En Route to Source Hub', 'At Source Hub', 'Linehaul In Transit', 'At Destination Hub', 'Awaiting Final-Mile Rider', 'In Progress');
UPDATE public.shipments SET status = 'completed'   WHERE status IN ('Delivered', 'Completed');
UPDATE public.shipments SET status = 'cancelled'   WHERE status IN ('Cancelled');
UPDATE public.shipments SET status = 'exception'   WHERE status IN ('Exception');

-- 2b. Catch-all: force any remaining non-conforming rows to 'pending'
UPDATE public.shipments SET status = 'pending'
WHERE status NOT IN ('pending', 'in_progress', 'completed', 'cancelled', 'exception');

-- 3. Re-create the constraint with the canonical machine-readable values
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'exception'));

-- 4. Ensure default aligns
ALTER TABLE public.shipments ALTER COLUMN status SET DEFAULT 'pending';

-- 5. Fix the server-side status mapping function used by verify_and_advance_shipment_stage RPC.
--    The old version returned Title Case strings ('Out for Delivery', 'Pending Routing', etc.)
--    which violate the CHECK constraint. Now returns machine-readable lowercase values.
CREATE OR REPLACE FUNCTION public.shipment_status_from_stage_db(stage_value text, routing_mode_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN stage_value IN ('pending_routing', 'awaiting_rider_acceptance') THEN 'pending'
    WHEN stage_value IN (
      'awaiting_source_terminal',
      'received_at_source_terminal',
      'linehaul_in_transit',
      'received_at_destination_terminal',
      'awaiting_final_mile_rider',
      'out_for_delivery'
    ) THEN 'in_progress'
    WHEN stage_value = 'delivered' THEN 'completed'
    WHEN stage_value = 'cancelled' THEN 'cancelled'
    WHEN stage_value = 'exception' THEN 'exception'
    ELSE 'pending'
  END
$$;
