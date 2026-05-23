-- RENAX managed first-mile pickup stage gate.
-- Keeps new inter-state RENAX-pickup shipments in the pickup-assignment state
-- until a controlled pickup agent verifies the sender pickup OTP.

create or replace function public.verify_and_advance_shipment_stage(
  p_shipment_id uuid,
  p_target_stage text,
  p_location_name text default null,
  p_notes text default null,
  p_otp text default null,
  p_proofs jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_shipment public.shipments%rowtype;
  v_now timestamptz := now();
  v_otp_scope text;
  v_expected_hash text;
  v_expires_at timestamptz;
  v_consumed_at timestamptz;
  v_failed_otp_count integer;
  v_failed_qr_count integer;
  v_summary text;
  v_score numeric(4,2);
  v_requires_otp boolean := false;
  v_verified_column text;
  v_next_status text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_shipment
  from public.shipments
  where id = p_shipment_id
  for update;

  if not found then
    raise exception 'Shipment not found' using errcode = 'P0002';
  end if;

  if not (
    v_shipment.assigned_rider_id = v_uid
    or v_shipment.final_mile_rider_id = v_uid
    or v_shipment.first_mile_pickup_agent_id = v_uid
    or public.has_role_claim('admin')
  ) then
    raise exception 'Shipment is not assigned to this rider' using errcode = '42501';
  end if;

  if p_target_stage not in ('awaiting_source_terminal', 'received_at_source_terminal', 'out_for_delivery', 'delivered') then
    raise exception 'Unsupported rider stage transition target: %', p_target_stage using errcode = 'P0001';
  end if;

  select count(*)
  into v_failed_qr_count
  from public.shipment_security_attempts a
  where a.shipment_id = p_shipment_id
    and a.actor_id = v_uid
    and a.attempt_kind = 'qr_scan'
    and a.outcome = 'failed'
    and a.created_at >= v_now - interval '10 minutes';

  if v_failed_qr_count >= 5 then
    insert into public.shipment_security_attempts (
      shipment_id, actor_id, stage, attempt_kind, outcome, failure_reason
    )
    values (
      p_shipment_id, v_uid, p_target_stage, 'qr_scan', 'blocked', 'too_many_recent_qr_failures'
    );
    raise exception 'Too many QR scan failures. Wait a few minutes and try again.' using errcode = 'P0001';
  end if;

  if p_target_stage in ('awaiting_source_terminal', 'out_for_delivery') then
    v_otp_scope := 'pickup';
    v_expected_hash := v_shipment.pickup_otp_hash;
    v_expires_at := v_shipment.pickup_otp_expires_at;
    v_consumed_at := v_shipment.pickup_otp_consumed_at;
    v_requires_otp := true;
    v_verified_column := 'pickup_verified_at';
  elsif p_target_stage = 'delivered' then
    v_otp_scope := 'delivery';
    v_expected_hash := v_shipment.delivery_otp_hash;
    v_expires_at := v_shipment.delivery_otp_expires_at;
    v_consumed_at := v_shipment.delivery_otp_consumed_at;
    v_requires_otp := true;
    v_verified_column := 'delivery_verified_at';
  elsif p_target_stage = 'received_at_source_terminal' then
    v_verified_column := 'source_hub_verified_at';
  end if;

  if v_requires_otp then
    select count(*)
    into v_failed_otp_count
    from public.shipment_security_attempts a
    where a.shipment_id = p_shipment_id
      and a.actor_id = v_uid
      and a.attempt_kind = 'otp'
      and a.otp_scope = v_otp_scope
      and a.outcome = 'failed'
      and a.created_at >= v_now - interval '15 minutes';

    if v_failed_otp_count >= 5 then
      insert into public.shipment_security_attempts (
        shipment_id, actor_id, stage, attempt_kind, otp_scope, outcome, failure_reason
      )
      values (
        p_shipment_id, v_uid, p_target_stage, 'otp', v_otp_scope, 'blocked', 'too_many_recent_otp_failures'
      );
      raise exception 'Too many OTP failures. Wait a few minutes and try again.' using errcode = 'P0001';
    end if;

    if v_expected_hash is null then
      raise exception 'No active % OTP is available for this shipment', v_otp_scope using errcode = 'P0001';
    end if;

    if v_consumed_at is not null then
      raise exception 'This % OTP has already been used', v_otp_scope using errcode = 'P0001';
    end if;

    if v_expires_at is not null and v_expires_at <= v_now then
      raise exception 'This % OTP has expired', v_otp_scope using errcode = 'P0001';
    end if;

    if p_otp is null or trim(p_otp) = '' or encode(extensions.digest(trim(p_otp), 'sha256'), 'hex') <> v_expected_hash then
      insert into public.shipment_security_attempts (
        shipment_id, actor_id, stage, attempt_kind, otp_scope, outcome, failure_reason
      )
      values (
        p_shipment_id, v_uid, p_target_stage, 'otp', v_otp_scope, 'failed', 'invalid_otp'
      );
      raise exception 'Verification code did not match' using errcode = 'P0001';
    end if;

    insert into public.shipment_security_attempts (
      shipment_id, actor_id, stage, attempt_kind, otp_scope, outcome
    )
    values (
      p_shipment_id, v_uid, p_target_stage, 'otp', v_otp_scope, 'success'
    );
  end if;

  select
    string_agg(distinct initcap(replace(coalesce(proof_item ->> 'proof_type', ''), '_', ' ')), ' + '),
    coalesce(avg(coalesce((proof_item ->> 'confidence_score')::numeric, 0.75)), 0.75)::numeric(4,2)
  into v_summary, v_score
  from jsonb_array_elements(coalesce(p_proofs, '[]'::jsonb)) as proof_item;

  v_next_status := public.shipment_status_from_stage_db(p_target_stage, coalesce(v_shipment.routing_mode, 'last_mile_local'));

  update public.shipments
  set
    dispatch_stage = p_target_stage,
    status = v_next_status,
    updated_at = v_now,
    latest_stage_confidence = coalesce(v_score, latest_stage_confidence),
    latest_stage_proof_summary = nullif(v_summary, ''),
    pickup_verified_at = case when v_verified_column = 'pickup_verified_at' then v_now else pickup_verified_at end,
    source_hub_verified_at = case when v_verified_column = 'source_hub_verified_at' then v_now else source_hub_verified_at end,
    destination_hub_verified_at = case when v_verified_column = 'destination_hub_verified_at' then v_now else destination_hub_verified_at end,
    out_for_delivery_verified_at = case when p_target_stage = 'out_for_delivery' then v_now else out_for_delivery_verified_at end,
    delivery_verified_at = case when v_verified_column = 'delivery_verified_at' then v_now else delivery_verified_at end,
    pickup_otp_consumed_at = case when v_otp_scope = 'pickup' then v_now else pickup_otp_consumed_at end,
    delivery_otp_consumed_at = case when v_otp_scope = 'delivery' then v_now else delivery_otp_consumed_at end,
    pickup_otp = null,
    delivery_otp = null
  where id = p_shipment_id;

  insert into public.shipment_events (
    shipment_id,
    title,
    description,
    status,
    stage,
    location_name,
    actor_id,
    actor_role,
    notes,
    confidence_score,
    metadata
  )
  values (
    p_shipment_id,
    initcap(replace(p_target_stage, '_', ' ')),
    coalesce(p_notes, format('Shipment moved to %s.', replace(p_target_stage, '_', ' '))),
    p_target_stage,
    p_target_stage,
    coalesce(nullif(trim(p_location_name), ''), 'RENAX Logistics'),
    v_uid,
    case when public.has_role_claim('admin') then 'admin' else 'rider' end,
    p_notes,
    coalesce(v_score, 0.75),
    jsonb_build_object(
      'verification_scope', v_otp_scope,
      'otp_consumed', v_requires_otp,
      'rpc', 'verify_and_advance_shipment_stage'
    )
  );

  insert into public.shipment_stage_proofs (
    shipment_id,
    stage,
    proof_type,
    proof_value,
    media_url,
    notes,
    metadata,
    verified_by_id,
    verified_by_role,
    confidence_score,
    idempotency_key
  )
  select
    p_shipment_id,
    coalesce(proof_item ->> 'stage', p_target_stage),
    proof_item ->> 'proof_type',
    case
      when proof_item ->> 'proof_type' in ('pickup_otp', 'delivery_otp')
        then public.mask_otp_value(proof_item ->> 'proof_value')
      else nullif(proof_item ->> 'proof_value', '')
    end,
    nullif(proof_item ->> 'media_url', ''),
    nullif(proof_item ->> 'notes', ''),
    coalesce(proof_item -> 'metadata', '{}'::jsonb),
    v_uid,
    case when public.has_role_claim('admin') then 'admin' else 'rider' end,
    coalesce((proof_item ->> 'confidence_score')::numeric, 0.75),
    p_shipment_id::text || ':' ||
      coalesce(proof_item ->> 'stage', p_target_stage) || ':' ||
      coalesce(proof_item ->> 'proof_type', 'proof') || ':' ||
      to_char(v_now, 'YYYY-MM-DD')
  from jsonb_array_elements(coalesce(p_proofs, '[]'::jsonb)) as proof_item
  where coalesce(proof_item ->> 'proof_type', '') <> ''
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'shipment_id', p_shipment_id,
    'dispatch_stage', p_target_stage,
    'status', v_next_status,
    'pickup_otp_consumed', v_otp_scope = 'pickup',
    'delivery_otp_consumed', v_otp_scope = 'delivery',
    'verified_at', v_now
  );
end;
$$;

grant execute on function public.verify_and_advance_shipment_stage(uuid, text, text, text, text, jsonb) to authenticated;

update public.shipments
set
  dispatch_stage = 'awaiting_rider_acceptance',
  status = public.shipment_status_from_stage_db('awaiting_rider_acceptance', coalesce(routing_mode, 'relay_terminal')),
  updated_at = now()
where coalesce(routing_mode, '') = 'relay_terminal'
  and coalesce(relay_first_mile_strategy, '') = 'renax_pickup'
  and coalesce(dispatch_stage, '') = 'awaiting_source_terminal'
  and first_mile_pickup_agent_id is null
  and coalesce(status, '') <> 'cancelled';

notify pgrst, 'reload schema';
