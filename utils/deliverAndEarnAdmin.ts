import { supabase } from '../supabase';

export type DeliverAndEarnAdminProfile = {
  profile_id: string;
  application_status: string;
  operator_status: string;
  trust_tier: string;
  operating_state: string;
  operating_city: string | null;
  training_status: string;
  identity_status: string;
  licence_status: string;
  bank_status: string;
  risk_score: number;
  total_completed_shipments: number;
  total_incidents: number;
  approval_notes: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
};

export type DeliverAndEarnAdminVehicle = {
  id: string;
  operator_id: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  vehicle_year: number | null;
  color: string | null;
  plate_number: string;
  ownership_type: string;
  capacity_kg: number | null;
  vehicle_status: string;
  inspection_status: string;
  insurance_expires_at: string | null;
  roadworthiness_expires_at: string | null;
  registration_expires_at: string | null;
};

export type DeliverAndEarnAdminEarning = {
  id: string;
  operator_id: string;
  shipment_id: string;
  operator_amount: number;
  gross_delivery_fee: number;
  status: string;
  created_at: string;
};

export type DeliverAndEarnAdminPayout = {
  id: string;
  operator_id: string;
  amount: number;
  status: string;
  requested_at: string;
  paid_at: string | null;
};

export type DeliverAndEarnAdminIncident = {
  id: string;
  operator_id: string | null;
  incident_type: string;
  severity: string;
  status: string;
  created_at: string;
};

export type DeliverAndEarnStateRule = {
  state: string;
  enabled: boolean;
  operator_payout_pct: number;
  renax_platform_share_pct: number;
  insurance_reserve_pct: number;
  payment_tax_admin_reserve_pct: number;
  max_weight_kg: number;
  max_declared_value_ngn_starter: number;
  max_declared_value_ngn_standard: number;
  max_declared_value_ngn_trusted: number;
};

export type DeliverAndEarnDispatchWatchlistItem = {
  shipment_id: string;
  tracking_id: string | null;
  pickup_state: string | null;
  pickup_city: string | null;
  delivery_state: string | null;
  delivery_city: string | null;
  dispatch_stage: string;
  estimated_price: number | null;
  weight_kg: number | null;
  package_category: string | null;
  live_offer_count: number;
  stale_offer_count: number;
  declined_offer_count: number;
  eligible_candidate_count: number;
  last_offer_at: string | null;
  next_offer_expires_at: string | null;
  minutes_waiting: number;
  updated_at: string | null;
};

export type DeliverAndEarnAdminRow = DeliverAndEarnAdminProfile & {
  vehicles: DeliverAndEarnAdminVehicle[];
  earningsTotal: number;
  pendingEarnings: number;
  availableEarnings: number;
};

export type DeliverAndEarnAdminData = {
  rows: DeliverAndEarnAdminRow[];
  vehicles: DeliverAndEarnAdminVehicle[];
  earnings: DeliverAndEarnAdminEarning[];
  payouts: DeliverAndEarnAdminPayout[];
  incidents: DeliverAndEarnAdminIncident[];
  stateRules: DeliverAndEarnStateRule[];
  dispatchWatchlist: DeliverAndEarnDispatchWatchlistItem[];
  metrics: {
    applicationsPending: number;
    activeOperators: number;
    onlineOperators: number;
    vehiclesActive: number;
    pendingEarnings: number;
    availableEarnings: number;
    pendingPayouts: number;
    openIncidents: number;
    dispatchBacklog: number;
    staleOffers: number;
    eligibleCandidates: number;
  };
};

const toNumber = (value: unknown) => Number(value || 0);

export async function fetchDeliverAndEarnAdminData(): Promise<DeliverAndEarnAdminData> {
  const [profilesResult, vehiclesResult, earningsResult, payoutsResult, incidentsResult, rulesResult, availabilityResult, dispatchWatchlistResult] = await Promise.all([
    supabase
      .from('deliver_and_earn_profiles')
      .select('*, profiles:profiles!deliver_and_earn_profiles_profile_id_fkey(full_name, email, phone_number)')
      .order('updated_at', { ascending: false }),
    supabase
      .from('deliver_and_earn_vehicles')
      .select('*')
      .order('updated_at', { ascending: false }),
    supabase
      .from('deliver_and_earn_earnings_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('deliver_and_earn_payouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('deliver_and_earn_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('deliver_and_earn_state_rules')
      .select('*')
      .order('state', { ascending: true }),
    supabase
      .from('deliver_and_earn_availability')
      .select('operator_id, is_online'),
    supabase.rpc('deliver_and_earn_dispatch_watchlist', { p_limit: 50 }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (vehiclesResult.error) throw vehiclesResult.error;
  if (earningsResult.error) throw earningsResult.error;
  if (payoutsResult.error) throw payoutsResult.error;
  if (incidentsResult.error) throw incidentsResult.error;
  if (rulesResult.error) throw rulesResult.error;
  if (availabilityResult.error) throw availabilityResult.error;
  if (dispatchWatchlistResult.error) throw dispatchWatchlistResult.error;

  const profiles = (profilesResult.data as DeliverAndEarnAdminProfile[] | null) ?? [];
  const vehicles = (vehiclesResult.data as DeliverAndEarnAdminVehicle[] | null) ?? [];
  const earnings = (earningsResult.data as DeliverAndEarnAdminEarning[] | null) ?? [];
  const payouts = (payoutsResult.data as DeliverAndEarnAdminPayout[] | null) ?? [];
  const incidents = (incidentsResult.data as DeliverAndEarnAdminIncident[] | null) ?? [];
  const stateRules = (rulesResult.data as DeliverAndEarnStateRule[] | null) ?? [];
  const availability = ((availabilityResult.data as { operator_id: string; is_online: boolean }[] | null) ?? []);
  const dispatchWatchlist = (dispatchWatchlistResult.data as DeliverAndEarnDispatchWatchlistItem[] | null) ?? [];

  const vehiclesByOperator = new Map<string, DeliverAndEarnAdminVehicle[]>();
  vehicles.forEach((vehicle) => {
    const list = vehiclesByOperator.get(vehicle.operator_id) ?? [];
    list.push(vehicle);
    vehiclesByOperator.set(vehicle.operator_id, list);
  });

  const earningsByOperator = new Map<string, DeliverAndEarnAdminEarning[]>();
  earnings.forEach((earning) => {
    const list = earningsByOperator.get(earning.operator_id) ?? [];
    list.push(earning);
    earningsByOperator.set(earning.operator_id, list);
  });

  const onlineOperatorIds = new Set(availability.filter((row) => row.is_online).map((row) => row.operator_id));

  const rows = profiles.map((profile) => {
    const operatorEarnings = earningsByOperator.get(profile.profile_id) ?? [];
    return {
      ...profile,
      vehicles: vehiclesByOperator.get(profile.profile_id) ?? [],
      earningsTotal: operatorEarnings.reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
      pendingEarnings: operatorEarnings
        .filter((earning) => ['pending_delivery', 'pending_dispute_window'].includes(earning.status))
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
      availableEarnings: operatorEarnings
        .filter((earning) => earning.status === 'available')
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
    };
  });

  return {
    rows,
    vehicles,
    earnings,
    payouts,
    incidents,
    stateRules,
    dispatchWatchlist,
    metrics: {
      applicationsPending: rows.filter((row) => ['submitted', 'in_review', 'needs_correction'].includes(row.application_status)).length,
      activeOperators: rows.filter((row) => row.operator_status === 'active').length,
      onlineOperators: onlineOperatorIds.size,
      vehiclesActive: vehicles.filter((vehicle) => vehicle.vehicle_status === 'active').length,
      pendingEarnings: earnings
        .filter((earning) => ['pending_delivery', 'pending_dispute_window'].includes(earning.status))
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
      availableEarnings: earnings
        .filter((earning) => earning.status === 'available')
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
      pendingPayouts: payouts
        .filter((payout) => ['requested', 'under_review', 'approved', 'processing'].includes(payout.status))
        .reduce((total, payout) => total + toNumber(payout.amount), 0),
      openIncidents: incidents.filter((incident) => ['open', 'in_review'].includes(incident.status)).length,
      dispatchBacklog: dispatchWatchlist.length,
      staleOffers: dispatchWatchlist.reduce((total, row) => total + toNumber(row.stale_offer_count), 0),
      eligibleCandidates: dispatchWatchlist.reduce((total, row) => total + toNumber(row.eligible_candidate_count), 0),
    },
  };
}

export async function updateDeliverAndEarnValidation(params: {
  profileId: string;
  vehicleId?: string | null;
  notes?: string;
  insuranceExpiresAt?: string;
  roadworthinessExpiresAt?: string;
  registrationExpiresAt?: string;
}) {
  const { data, error } = await supabase.rpc('admin_update_deliver_and_earn_validation', {
    p_payload: {
      profile_id: params.profileId,
      vehicle_id: params.vehicleId || null,
      notes: params.notes || null,
      identity_status: 'verified',
      licence_status: 'verified',
      bank_status: 'verified',
      training_status: 'completed',
      vehicle_status: params.vehicleId ? 'active' : undefined,
      inspection_status: params.vehicleId ? 'verified' : undefined,
      insurance_expires_at: params.insuranceExpiresAt || null,
      roadworthiness_expires_at: params.roadworthinessExpiresAt || null,
      registration_expires_at: params.registrationExpiresAt || null,
    },
  });

  if (error) throw error;
  return data as string;
}

export async function reviewDeliverAndEarnApplication(params: {
  profileId: string;
  action: 'approve' | 'reject' | 'needs_correction' | 'suspend' | 'reactivate';
  notes?: string;
  trustTier?: string;
}) {
  const { data, error } = await supabase.rpc('admin_review_deliver_and_earn_application', {
    p_payload: {
      profile_id: params.profileId,
      action: params.action,
      notes: params.notes || null,
      trust_tier: params.trustTier || 'starter',
    },
  });

  if (error) throw error;
  return data as string;
}

export async function processDeliverAndEarnPayout(params: {
  payoutId: string;
  status: 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'held';
  provider?: string;
  providerReference?: string;
  failureReason?: string;
}) {
  const { data, error } = await supabase.rpc('admin_process_deliver_and_earn_payout', {
    p_payload: {
      payout_id: params.payoutId,
      status: params.status,
      provider: params.provider || null,
      provider_reference: params.providerReference || null,
      failure_reason: params.failureReason || null,
    },
  });

  if (error) throw error;
  return data as string;
}

export async function processDeliverAndEarnDispatchBacklog(limit = 100) {
  const { data, error } = await supabase.rpc('process_deliver_and_earn_dispatch_backlog', {
    p_payload: { limit },
  });

  if (error) throw error;
  return (data || {}) as {
    expired_offers?: number;
    checked_shipments?: number;
    reoffered_shipments?: number;
    offers_created?: number;
  };
}
