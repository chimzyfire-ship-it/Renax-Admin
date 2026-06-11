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

export type DeliverAndEarnAdminInvite = {
  id: string;
  profile_id: string;
  email: string | null;
  invite_code: string;
  invite_status: 'issued' | 'accepted' | 'expired' | 'revoked';
  rider_app_url: string;
  expires_at: string;
  accepted_at: string | null;
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
  invites: DeliverAndEarnAdminInvite[];
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
  invites: DeliverAndEarnAdminInvite[];
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

type DeliverAndEarnAdminMetricsSnapshot = {
  applications_pending?: number;
  active_operators?: number;
  online_operators?: number;
  vehicles_active?: number;
  pending_earnings?: number;
  available_earnings?: number;
  pending_payouts?: number;
  open_incidents?: number;
  stale_offers?: number;
};

const ADMIN_QUERY_TIMEOUT_MS = 6000;
const ADMIN_OPERATOR_LIMIT = 200;

const toNumber = (value: unknown) => Number(value || 0);

const isPermissionError = (error: any) => {
  const message = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42501'
    || message.includes('permission')
    || message.includes('not authorized')
    || message.includes('admin access required')
    || message.includes('admin permission required')
    || message.includes('deliver & earn admin access required');
};

async function safeQuery<T>(
  label: string,
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  options: { required?: boolean } = {},
): Promise<T | null> {
  try {
    const timeoutResult = new Promise<{ data: T | null; error: any }>((resolve) => {
      setTimeout(() => {
        resolve({
          data: null,
          error: new Error(`${label} query timed out after ${ADMIN_QUERY_TIMEOUT_MS / 1000} seconds`),
        });
      }, ADMIN_QUERY_TIMEOUT_MS);
    });

    const { data, error } = await Promise.race([queryFn(), timeoutResult]);
    if (error) {
      console.warn(`[DeliverAndEarnAdmin] ${label} query error:`, error.message || error);
      if (options.required || isPermissionError(error)) {
        const permissionHint = isPermissionError(error)
          ? ' This staff account is not provisioned with Deliver & Earn admin permissions.'
          : '';
        throw new Error(`${label}: ${error.message || 'query failed'}.${permissionHint}`);
      }
      return null;
    }
    return data;
  } catch (error) {
    console.warn(`[DeliverAndEarnAdmin] ${label} query threw:`, error);
    if (options.required || isPermissionError(error)) {
      throw error instanceof Error ? error : new Error(`${label}: query failed`);
    }
    return null;
  }
}

const emptyAdminData = (): DeliverAndEarnAdminData => ({
  rows: [],
  vehicles: [],
  earnings: [],
  payouts: [],
  incidents: [],
  invites: [],
  stateRules: [],
  dispatchWatchlist: [],
  metrics: {
    applicationsPending: 0,
    activeOperators: 0,
    onlineOperators: 0,
    vehiclesActive: 0,
    pendingEarnings: 0,
    availableEarnings: 0,
    pendingPayouts: 0,
    openIncidents: 0,
    dispatchBacklog: 0,
    staleOffers: 0,
    eligibleCandidates: 0,
  },
});

export async function fetchDeliverAndEarnAdminData(): Promise<DeliverAndEarnAdminData> {
  const base = emptyAdminData();

  const [metrics, profiles, payouts, incidents, stateRules, dispatchWatchlist] = await Promise.all([
    safeQuery<DeliverAndEarnAdminMetricsSnapshot>('deliver_and_earn_admin_overview_metrics', () =>
      supabase.rpc('deliver_and_earn_admin_overview_metrics').maybeSingle()
    , { required: true }),
    safeQuery<DeliverAndEarnAdminProfile[]>('deliver_and_earn_profiles', () =>
      supabase
      .from('deliver_and_earn_profiles')
      .select('*, profiles:profiles!deliver_and_earn_profiles_profile_id_fkey(full_name, email, phone_number)')
      .in('application_status', ['submitted', 'in_review', 'needs_correction', 'approved'])
      .order('updated_at', { ascending: false })
      .limit(ADMIN_OPERATOR_LIMIT)
    , { required: true }),
    safeQuery<DeliverAndEarnAdminPayout[]>('deliver_and_earn_payouts', () =>
      supabase
      .from('deliver_and_earn_payouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    ),
    safeQuery<DeliverAndEarnAdminIncident[]>('deliver_and_earn_incidents', () =>
      supabase
      .from('deliver_and_earn_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    ),
    safeQuery<DeliverAndEarnStateRule[]>('deliver_and_earn_state_rules', () =>
      supabase
      .from('deliver_and_earn_state_rules')
      .select('*')
      .order('state', { ascending: true })
      .limit(50)
    ),
    safeQuery<DeliverAndEarnDispatchWatchlistItem[]>('deliver_and_earn_dispatch_watchlist', () =>
      supabase.rpc('deliver_and_earn_dispatch_watchlist', { p_limit: 50 })
    ),
  ]);

  const operatorIds = ((profiles || []) as DeliverAndEarnAdminProfile[]).map((profile) => profile.profile_id).filter(Boolean);

  const [vehicles, earnings, invites] = operatorIds.length
    ? await Promise.all([
        safeQuery<DeliverAndEarnAdminVehicle[]>('deliver_and_earn_visible_vehicles', () =>
          supabase
            .from('deliver_and_earn_vehicles')
            .select('*')
            .in('operator_id', operatorIds)
            .order('updated_at', { ascending: false })
            .limit(Math.min(operatorIds.length * 3, 600))
        ),
        safeQuery<DeliverAndEarnAdminEarning[]>('deliver_and_earn_visible_earnings', () =>
          supabase
            .from('deliver_and_earn_earnings_ledger')
            .select('*')
            .in('operator_id', operatorIds)
            .in('status', ['pending_delivery', 'pending_dispute_window', 'available'])
            .order('created_at', { ascending: false })
            .limit(1000)
        ),
        safeQuery<DeliverAndEarnAdminInvite[]>('deliver_and_earn_operator_invites', () =>
          supabase
            .from('deliver_and_earn_operator_invites')
            .select('id, profile_id, email, invite_code, invite_status, rider_app_url, expires_at, accepted_at, created_at')
            .in('profile_id', operatorIds)
            .order('created_at', { ascending: false })
            .limit(Math.min(operatorIds.length * 3, 600))
        ),
      ])
    : [[], [], []];

  const vehiclesByOperator = new Map<string, DeliverAndEarnAdminVehicle[]>();
  (vehicles || []).forEach((vehicle) => {
    const list = vehiclesByOperator.get(vehicle.operator_id) ?? [];
    list.push(vehicle);
    vehiclesByOperator.set(vehicle.operator_id, list);
  });

  const earningsByOperator = new Map<string, DeliverAndEarnAdminEarning[]>();
  (earnings || []).forEach((earning) => {
    const list = earningsByOperator.get(earning.operator_id) ?? [];
    list.push(earning);
    earningsByOperator.set(earning.operator_id, list);
  });

  const invitesByOperator = new Map<string, DeliverAndEarnAdminInvite[]>();
  (invites || []).forEach((invite) => {
    const list = invitesByOperator.get(invite.profile_id) ?? [];
    list.push(invite);
    invitesByOperator.set(invite.profile_id, list);
  });

  const rows = (profiles || []).map((profile) => {
    const operatorEarnings = earningsByOperator.get(profile.profile_id) ?? [];
    return {
      ...profile,
      vehicles: vehiclesByOperator.get(profile.profile_id) ?? [],
      invites: invitesByOperator.get(profile.profile_id) ?? [],
      earningsTotal: operatorEarnings.reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
      pendingEarnings: operatorEarnings
        .filter((earning) => ['pending_delivery', 'pending_dispute_window'].includes(earning.status))
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
      availableEarnings: operatorEarnings
        .filter((earning) => earning.status === 'available')
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0),
    };
  });
  const metricNumber = (key: keyof DeliverAndEarnAdminMetricsSnapshot, fallback = 0) =>
    metrics && metrics[key] !== null && metrics[key] !== undefined
      ? toNumber(metrics[key])
      : fallback;

  return {
    rows,
    vehicles: vehicles || base.vehicles,
    earnings: earnings || base.earnings,
    payouts: payouts || base.payouts,
    incidents: incidents || base.incidents,
    invites: invites || base.invites,
    stateRules: stateRules || base.stateRules,
    dispatchWatchlist: dispatchWatchlist || base.dispatchWatchlist,
    metrics: {
      applicationsPending: metricNumber('applications_pending', rows.filter((row) => ['submitted', 'in_review', 'needs_correction'].includes(row.application_status)).length),
      activeOperators: metricNumber('active_operators', rows.filter((row) => row.operator_status === 'active').length),
      onlineOperators: metricNumber('online_operators'),
      vehiclesActive: metricNumber('vehicles_active', (vehicles || []).filter((vehicle) => vehicle.vehicle_status === 'active').length),
      pendingEarnings: metricNumber('pending_earnings', (earnings || [])
        .filter((earning) => ['pending_delivery', 'pending_dispute_window'].includes(earning.status))
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0)),
      availableEarnings: metricNumber('available_earnings', (earnings || [])
        .filter((earning) => earning.status === 'available')
        .reduce((total, earning) => total + toNumber(earning.operator_amount), 0)),
      pendingPayouts: metricNumber('pending_payouts', (payouts || [])
        .filter((payout) => ['requested', 'under_review', 'approved', 'processing'].includes(payout.status))
        .reduce((total, payout) => total + toNumber(payout.amount), 0)),
      openIncidents: metricNumber('open_incidents', (incidents || []).filter((incident) => ['open', 'in_review'].includes(incident.status)).length),
      dispatchBacklog: (dispatchWatchlist || []).length,
      staleOffers: metricNumber('stale_offers', (dispatchWatchlist || []).reduce((total, row) => total + toNumber(row.stale_offer_count), 0)),
      eligibleCandidates: (dispatchWatchlist || []).reduce((total, row) => total + toNumber(row.eligible_candidate_count), 0),
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

export async function createDeliverAndEarnOperatorInvite(params: {
  profileId: string;
  riderAppUrl?: string;
  ttlHours?: number;
}) {
  const defaultRiderAppUrl = process.env.EXPO_PUBLIC_RIDER_APP_URL || 'https://renax-rider-deploy-real.vercel.app';
  const { data, error } = await supabase.rpc('admin_create_deliver_and_earn_operator_invite', {
    p_payload: {
      profile_id: params.profileId,
      rider_app_url: params.riderAppUrl || defaultRiderAppUrl,
      ttl_hours: params.ttlHours || 72,
    },
  });

  if (error) throw error;
  return data as {
    invite_id?: string;
    profile_id?: string;
    email?: string | null;
    invite_url?: string;
    invite_code?: string;
    invite_status?: string;
    expires_at?: string;
    rider_app_url?: string;
    instructions?: string[];
  };
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
