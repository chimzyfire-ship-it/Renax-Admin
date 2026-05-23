import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

const ACTIVE_STAGES = [
  'awaiting_rider_acceptance',
  'awaiting_source_terminal_dropoff',
  'awaiting_source_terminal',
  'received_at_source_terminal',
  'linehaul_in_transit',
  'received_at_destination_terminal',
  'awaiting_final_mile_rider',
  'out_for_delivery',
];

const TERMINAL_BACKLOG_STAGES = [
  'awaiting_source_terminal_dropoff',
  'awaiting_source_terminal',
  'received_at_source_terminal',
  'linehaul_in_transit',
  'received_at_destination_terminal',
  'awaiting_final_mile_rider',
];

const startOfTodayIso = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
};

const formatLocation = (row: any) =>
  row?.metadata?.location_label || (row?.lat && row?.lng ? `${row.lat.toFixed(3)}, ${row.lng.toFixed(3)}` : 'Unknown');

const DAY_FILTERS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const SETTINGS_STORAGE_KEY = 'renax-admin-settings-v1';

const DEFAULT_ADMIN_SETTINGS = {
  companyName: 'RENAX Logistics',
  companyAddress: '12 Logistics Way, Lagos, Nigeria',
  companyPhone: '+234 901 234 5678',
  companyEmail: 'admin@renaxlogistics.com',
  emailAlerts: true,
  smsAlerts: true,
  pushAlerts: false,
  twoFactorEnabled: true,
  passwordPolicy: 'Minimum 8 characters, must include a number and symbol',
  defaultCurrency: 'NGN',
  timeZone: 'Africa/Lagos',
  language: 'English',
  dateFormat: 'DD-MM-YYYY',
  sessionTimeoutMinutes: 30,
  paymentGateway: 'Flutterwave',
  commissionRate: 12,
  payoutSchedule: 'Weekly (Every Friday)',
};

const startDateForRange = (rangeKey: string) => {
  const days = DAY_FILTERS[rangeKey] || 30;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
};

const formatDayKey = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-CA');

const formatChartLabel = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const sumAmount = (items: any[], key: string) =>
  items.reduce((total, item) => total + Number(item?.[key] || 0), 0);

function buildDayBuckets(rangeKey: string) {
  const start = startDateForRange(rangeKey);
  const days = DAY_FILTERS[rangeKey] || 30;

  return Array.from({ length: days }).map((_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return {
      key: formatDayKey(current),
      label: formatChartLabel(current),
      shipments: 0,
      delivered: 0,
      revenue: 0,
      walletFunding: 0,
      withdrawals: 0,
    };
  });
}

export async function fetchAdminOverview() {
  const todayIso = startOfTodayIso();

  const [{ data: shipments }, { data: riderLocations }, { data: terminals }] = await Promise.all([
    supabase
      .from('shipments')
      .select('id, tracking_id, sender_name, recipient_name, pickup_state, delivery_state, routing_mode, dispatch_stage, status, estimated_price, source_terminal_id, destination_terminal_id, created_at, updated_at'),
    supabase
      .from('rider_locations')
      .select('rider_id, is_online, current_shipment_id, last_seen, metadata, profiles(full_name, phone_number)'),
    supabase
      .from('terminals')
      .select('id, name, code, city, state, status'),
  ]);

  const safeShipments = shipments || [];
  const safeRiders = riderLocations || [];
  const safeTerminals = terminals || [];

  const deliveredToday = safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'delivered' && (shipment.updated_at || shipment.created_at) >= todayIso);
  const recentShipments = [...safeShipments]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const stageBreakdown = {
    awaiting_rider_acceptance: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'awaiting_rider_acceptance').length,
    awaiting_source_terminal_dropoff: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'awaiting_source_terminal_dropoff').length,
    at_source_hub: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'received_at_source_terminal').length,
    linehaul: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'linehaul_in_transit').length,
    awaiting_final_mile: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'awaiting_final_mile_rider').length,
    out_for_delivery: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'out_for_delivery').length,
    exception: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'exception').length,
  };

  const terminalLoads = safeTerminals.map((terminal: any) => ({
    ...terminal,
    inbound: safeShipments.filter((shipment: any) => shipment.source_terminal_id === terminal.id && ['awaiting_source_terminal_dropoff', 'awaiting_source_terminal'].includes(shipment.dispatch_stage)).length,
    atHub: safeShipments.filter((shipment: any) => shipment.source_terminal_id === terminal.id && shipment.dispatch_stage === 'received_at_source_terminal').length,
    destinationQueue: safeShipments.filter((shipment: any) => shipment.destination_terminal_id === terminal.id && shipment.dispatch_stage === 'received_at_destination_terminal').length,
    finalMileQueue: safeShipments.filter((shipment: any) => shipment.destination_terminal_id === terminal.id && shipment.dispatch_stage === 'awaiting_final_mile_rider').length,
  }));

  return {
    metrics: {
      activeShipments: safeShipments.filter((shipment: any) => ACTIVE_STAGES.includes(shipment.dispatch_stage)).length,
      relayShipments: safeShipments.filter((shipment: any) => shipment.routing_mode === 'relay_terminal' && ACTIVE_STAGES.includes(shipment.dispatch_stage)).length,
      ridersOnline: safeRiders.filter((rider: any) => rider.is_online).length,
      ridersBusy: safeRiders.filter((rider: any) => !!rider.current_shipment_id || rider.metadata?.status === 'busy').length,
      revenueToday: deliveredToday.reduce((total: number, shipment: any) => total + Number(shipment.estimated_price || 0), 0),
      terminalBacklog: safeShipments.filter((shipment: any) => TERMINAL_BACKLOG_STAGES.includes(shipment.dispatch_stage)).length,
      exceptions: stageBreakdown.exception,
      deliveredToday: deliveredToday.length,
    },
    stageBreakdown,
    terminalLoads: terminalLoads
      .sort((a, b) => (b.inbound + b.atHub + b.destinationQueue + b.finalMileQueue) - (a.inbound + a.atHub + a.destinationQueue + a.finalMileQueue))
      .slice(0, 6),
    recentShipments,
    riderSnapshots: safeRiders
      .map((rider: any) => ({
        id: rider.rider_id,
        name: rider.profiles?.full_name || rider.metadata?.driver_name || 'Unknown Rider',
        phone: rider.profiles?.phone_number || 'N/A',
        isOnline: rider.is_online,
        location: formatLocation(rider),
        currentShipmentId: rider.current_shipment_id,
        vehicleType: rider.metadata?.vehicle_type || 'Motorcycle',
        status: rider.metadata?.status || (rider.is_online ? 'available' : 'offline'),
      }))
      .slice(0, 6),
  };
}

export async function fetchFleetRows() {
  const todayIso = startOfTodayIso();

  const [{ data: riderLocations }, { data: shipments }, { data: terminals }] = await Promise.all([
    supabase
      .from('rider_locations')
      .select('rider_id, lat, lng, is_online, last_seen, current_shipment_id, metadata, profiles(id, full_name, phone_number, preferred_terminal_code, assigned_terminal_id, role, state, city, logistics_roles)')
      .order('last_seen', { ascending: false }),
    supabase
      .from('shipments')
      .select('id, tracking_id, assigned_rider_id, final_mile_rider_id, dispatch_stage, status, pickup_state, delivery_state, updated_at, created_at'),
    supabase
      .from('terminals')
      .select('id, name, code, city, state, address, status'),
  ]);

  const safeLocations = riderLocations || [];
  const safeShipments = shipments || [];
  const safeTerminals = terminals || [];
  const terminalMap = new Map(safeTerminals.map((terminal: any) => [terminal.id, terminal]));
  const terminalCodeMap = new Map(safeTerminals.map((terminal: any) => [terminal.code, terminal]));

  const deliveredTodayByRider = new Map<string, number>();
  safeShipments.forEach((shipment: any) => {
    if (shipment.dispatch_stage !== 'delivered') return;
    if ((shipment.updated_at || shipment.created_at) < todayIso) return;
    const riderIds = [shipment.assigned_rider_id, shipment.final_mile_rider_id].filter(Boolean);
    riderIds.forEach((riderId: string) => {
      deliveredTodayByRider.set(riderId, (deliveredTodayByRider.get(riderId) || 0) + 1);
    });
  });

  const activeShipmentByRider = new Map<string, any>();
  safeShipments.forEach((shipment: any) => {
    if (!ACTIVE_STAGES.includes(shipment.dispatch_stage)) return;
    [shipment.assigned_rider_id, shipment.final_mile_rider_id].filter(Boolean).forEach((riderId: string) => {
      if (!activeShipmentByRider.has(riderId)) activeShipmentByRider.set(riderId, shipment);
    });
  });

  return safeLocations.map((row: any) => {
    const activeShipment = activeShipmentByRider.get(row.rider_id);
    const maintenance = row.metadata?.status === 'maintenance';
    const assignedTerminal = row.profiles?.assigned_terminal_id
      ? terminalMap.get(row.profiles.assigned_terminal_id)
      : null;
    const preferredTerminal = row.profiles?.preferred_terminal_code
      ? terminalCodeMap.get(row.profiles.preferred_terminal_code)
      : null;
    const status = maintenance
      ? 'Maintenance'
      : activeShipment
        ? 'On Delivery'
        : row.is_online
          ? 'Available'
          : 'Offline';

    return {
      riderId: row.rider_id,
      vehicleId: row.metadata?.vehicle_id || `VEH-${String(row.rider_id).slice(0, 6).toUpperCase()}`,
      plateNumber: row.metadata?.plate_number || row.metadata?.plate || 'N/A',
      vehicleType: row.metadata?.vehicle_type || 'Motorcycle',
      riderName: row.profiles?.full_name || row.metadata?.driver_name || 'Unknown Rider',
      phoneNumber: row.profiles?.phone_number || 'N/A',
      status,
      isOnline: row.is_online,
      currentLocation: formatLocation(row),
      lastSeen: row.last_seen,
      terminalCode: assignedTerminal?.code || preferredTerminal?.code || row.metadata?.terminal_code || row.metadata?.state || 'N/A',
      assignedTerminalId: assignedTerminal?.id || row.profiles?.assigned_terminal_id || null,
      assignedTerminalCode: assignedTerminal?.code || null,
      assignedTerminalName: assignedTerminal?.name || null,
      assignedTerminalAddress: assignedTerminal?.address || null,
      preferredTerminalCode: row.profiles?.preferred_terminal_code || preferredTerminal?.code || null,
      preferredTerminalName: preferredTerminal?.name || null,
      operatingState: row.profiles?.state || row.metadata?.state || null,
      operatingCity: row.profiles?.city || row.metadata?.city || null,
      logisticsRoles: row.profiles?.logistics_roles || [],
      accountRole: row.profiles?.role || null,
      mileage: row.metadata?.mileage || 'N/A',
      lastService: row.metadata?.last_service || 'N/A',
      deliveriesToday: deliveredTodayByRider.get(row.rider_id) || 0,
      currentShipment: activeShipment
        ? {
            id: activeShipment.id,
            trackingId: activeShipment.tracking_id,
            route: `${activeShipment.pickup_state || 'Unknown'} -> ${activeShipment.delivery_state || 'Unknown'}`,
            stage: activeShipment.dispatch_stage,
          }
        : null,
      metadata: row.metadata || {},
    };
  });
}

export async function updateStaffTerminalAssignment(riderId: string, terminalId: string) {
  const { data: terminal, error: terminalError } = await supabase
    .from('terminals')
    .select('id, code, name, city, state')
    .eq('id', terminalId)
    .single();

  if (terminalError || !terminal) {
    throw terminalError || new Error('Terminal not found');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      assigned_terminal_id: terminal.id,
      preferred_terminal_code: terminal.code,
    })
    .eq('id', riderId);

  if (profileError) throw profileError;

  const { data: existingLocation } = await supabase
    .from('rider_locations')
    .select('metadata')
    .eq('rider_id', riderId)
    .maybeSingle();

  if (!existingLocation) return;

  const nextMetadata = {
    ...(existingLocation.metadata || {}),
    terminal_code: terminal.code,
    assigned_terminal_id: terminal.id,
    assigned_terminal_name: terminal.name,
    assigned_terminal_city: terminal.city,
    assigned_terminal_state: terminal.state,
    updated_by_admin_at: new Date().toISOString(),
  };

  const { error: locationError } = await supabase
    .from('rider_locations')
    .update({
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('rider_id', riderId);

  if (locationError) throw locationError;
}

export async function updateFleetVehicleStatus(riderId: string, nextStatus: string) {
  const { data: existing } = await supabase
    .from('rider_locations')
    .select('metadata')
    .eq('rider_id', riderId)
    .maybeSingle();

  const normalizedStatus = String(nextStatus || 'offline').toLowerCase();
  const isOnline = normalizedStatus === 'available' || normalizedStatus === 'busy';
  const nextMetadata = {
    ...(existing?.metadata || {}),
    status: normalizedStatus,
    updated_by_admin_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('rider_locations')
    .update({
      is_online: isOnline,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    })
    .eq('rider_id', riderId);

  if (error) throw error;

  const agentPatch: Record<string, any> = {
    availability_status: ['available', 'busy', 'maintenance'].includes(normalizedStatus) ? normalizedStatus : 'offline',
    updated_at: new Date().toISOString(),
  };

  if (normalizedStatus === 'available') {
    agentPatch.last_available_at = new Date().toISOString();
  }

  await supabase
    .from('first_mile_pickup_agents')
    .update(agentPatch)
    .eq('driver_id', riderId);
}

const parseCsvList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const normalizeVehicleType = (vehicleType?: string | null) => {
  const value = String(vehicleType || 'bike').trim().toLowerCase().replace(/\s+/g, '_');
  if (value === 'motorcycle') return 'bike';
  if (value === 'cold_chain') return 'cold_chain_van';
  if (['bike', 'tricycle', 'car', 'van', 'mini_truck', 'truck', 'cold_chain_van', 'cold_chain_truck', 'other'].includes(value)) {
    return value;
  }
  return 'other';
};

export async function enrollFleetStaff(payload: {
  userId: string;
  fullName?: string;
  phoneNumber?: string;
  role?: string;
  serviceProfile?: 'final_mile' | 'first_mile' | 'dual';
  state?: string;
  city?: string;
  vehicleId?: string;
  vehicleCode?: string;
  vehicleType?: string;
  plateNumber?: string;
  capacityKg?: string | number | null;
  capacityVolumeCm3?: string | number | null;
  maxParcelCount?: string | number | null;
  goodsCapabilities?: string | string[] | null;
  assignedTerminalId?: string | null;
}) {
  const userId = String(payload.userId || '').trim();
  if (!userId) throw new Error('Existing user UUID is required');

  const serviceProfile = payload.serviceProfile || 'final_mile';
  const profileRole = payload.role || (serviceProfile === 'final_mile' ? 'rider' : 'driver');
  const terminalId = payload.assignedTerminalId || null;
  const { data: terminal } = terminalId
    ? await supabase.from('terminals').select('*').eq('id', terminalId).maybeSingle()
    : { data: null } as any;
  const nowIso = new Date().toISOString();
  const state = String(payload.state || terminal?.state || '').trim();
  const city = String(payload.city || terminal?.city || '').trim();
  const vehicleType = normalizeVehicleType(payload.vehicleType);
  const vehicleCode = String(payload.vehicleCode || payload.vehicleId || `RENAX-${userId.slice(0, 8)}`).trim().toUpperCase();
  const vehicleId = String(payload.vehicleId || vehicleCode).trim().toUpperCase();
  const baseRoles = new Set<string>([profileRole, profileRole === 'driver' ? 'driver' : 'rider']);

  if (serviceProfile === 'first_mile' || serviceProfile === 'dual') baseRoles.add('first_mile_pickup');
  if (serviceProfile === 'final_mile' || serviceProfile === 'dual') {
    baseRoles.add('rider');
    baseRoles.add('final_mile');
  }

  const logisticsRoles = Array.from(baseRoles);
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: payload.fullName?.trim() || null,
      phone_number: payload.phoneNumber?.trim() || null,
      role: profileRole,
      state: state || null,
      city: city || null,
      logistics_roles: logisticsRoles,
      assigned_terminal_id: terminal?.id || null,
      preferred_terminal_code: terminal?.code || null,
      is_online: false,
      updated_at: nowIso,
    }, { onConflict: 'id' });

  if (profileError) throw profileError;

  const locationMetadata = {
    driver_name: payload.fullName?.trim() || null,
    vehicle_id: vehicleId,
    vehicle_code: vehicleCode,
    vehicle_type: vehicleType,
    plate_number: payload.plateNumber?.trim() || null,
    status: 'offline',
    state: state || null,
    city: city || null,
    terminal_code: terminal?.code || null,
    assigned_terminal_id: terminal?.id || null,
    assigned_terminal_name: terminal?.name || null,
    first_mile_pickup_capable: serviceProfile === 'first_mile' || serviceProfile === 'dual',
    final_mile_capable: serviceProfile === 'final_mile' || serviceProfile === 'dual',
    enrolled_by_admin_at: nowIso,
  };

  const { error: locationError } = await supabase
    .from('rider_locations')
    .upsert({
      rider_id: userId,
      lat: Number(terminal?.lat ?? 9.0765),
      lng: Number(terminal?.lng ?? 7.3986),
      is_online: false,
      current_shipment_id: null,
      metadata: locationMetadata,
      last_seen: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'rider_id' });

  if (locationError) throw locationError;

  if (serviceProfile === 'first_mile' || serviceProfile === 'dual') {
    const goodsCapabilities = parseCsvList(payload.goodsCapabilities);
    const firstMilePayload = {
      driver_id: userId,
      vehicle_code: vehicleCode,
      vehicle_type: vehicleType,
      plate_number: payload.plateNumber?.trim() || null,
      home_terminal_id: terminal?.id || null,
      home_state: state || terminal?.state || 'Lagos',
      home_city: city || terminal?.city || null,
      service_states: state ? [state] : [],
      service_cities: city ? [city] : [],
      capacity_kg: payload.capacityKg ? Number(payload.capacityKg) : null,
      capacity_volume_cm3: payload.capacityVolumeCm3 ? Number(payload.capacityVolumeCm3) : null,
      max_parcel_count: payload.maxParcelCount ? Number(payload.maxParcelCount) : null,
      goods_capabilities: goodsCapabilities.length ? goodsCapabilities : ['documents', 'fragile', 'agro', 'refrigerated', 'general'],
      cold_chain_enabled: vehicleType.includes('cold_chain'),
      registration_status: 'active',
      availability_status: 'offline',
      metadata: { enrolled_from_admin: true, service_profile: serviceProfile },
      updated_at: nowIso,
    };

    const { data: existingAgent, error: existingAgentError } = await supabase
      .from('first_mile_pickup_agents')
      .select('id')
      .eq('driver_id', userId)
      .in('registration_status', ['pending_approval', 'active', 'suspended'])
      .maybeSingle();

    if (existingAgentError) throw existingAgentError;

    const agentQuery = existingAgent?.id
      ? supabase.from('first_mile_pickup_agents').update(firstMilePayload).eq('id', existingAgent.id)
      : supabase.from('first_mile_pickup_agents').insert(firstMilePayload);

    const { error: agentError } = await agentQuery;
    if (agentError) throw agentError;
  }
}

export async function removeFleetStaffFromOps(riderId: string) {
  const nowIso = new Date().toISOString();
  const { data: pickupAgentRows } = await supabase
    .from('first_mile_pickup_agents')
    .select('id')
    .eq('driver_id', riderId)
    .in('registration_status', ['pending_approval', 'active', 'suspended']);
  const pickupAgentIds = (pickupAgentRows || []).map((row: any) => row.id).filter(Boolean);

  await Promise.all([
    supabase
      .from('shipments')
      .update({
        assigned_rider_id: null,
        dispatch_stage: 'awaiting_rider_acceptance',
        status: 'pending',
        updated_at: nowIso,
      })
      .eq('assigned_rider_id', riderId)
      .in('dispatch_stage', ['awaiting_rider_acceptance', 'out_for_delivery']),
    supabase
      .from('shipments')
      .update({
        final_mile_rider_id: null,
        dispatch_stage: 'awaiting_final_mile_rider',
        status: 'in_progress',
        updated_at: nowIso,
      })
      .eq('final_mile_rider_id', riderId)
      .in('dispatch_stage', ['awaiting_final_mile_rider', 'out_for_delivery']),
    supabase
      .from('shipments')
      .update({
        first_mile_pickup_agent_id: null,
        dispatch_stage: 'awaiting_rider_acceptance',
        status: 'pending',
        updated_at: nowIso,
      })
      .eq('first_mile_pickup_agent_id', riderId)
      .in('dispatch_stage', ['awaiting_rider_acceptance', 'awaiting_source_terminal']),
    pickupAgentIds.length
      ? supabase
          .from('pickup_requests')
          .update({
            assigned_agent_id: null,
            orchestration_status: 'awaiting_assignment',
            failure_reason: 'Assigned pickup driver was removed from the ops roster.',
            updated_at: nowIso,
          })
          .in('assigned_agent_id', pickupAgentIds)
          .in('orchestration_status', ['assignment_in_progress', 'assigned', 'en_route'])
      : Promise.resolve({ error: null } as any),
  ]);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role: 'customer',
      logistics_roles: [],
      assigned_terminal_id: null,
      preferred_terminal_code: null,
      is_online: false,
      updated_at: nowIso,
    })
    .eq('id', riderId);

  if (profileError) throw profileError;

  const { data: existingLocation } = await supabase
    .from('rider_locations')
    .select('metadata')
    .eq('rider_id', riderId)
    .maybeSingle();

  const { error: locationError } = await supabase
    .from('rider_locations')
    .update({
      is_online: false,
      current_shipment_id: null,
      metadata: {
        ...(existingLocation?.metadata || {}),
        status: 'offline',
        removed_from_ops: true,
        removed_from_ops_at: nowIso,
      },
      updated_at: nowIso,
      last_seen: nowIso,
    })
    .eq('rider_id', riderId);

  if (locationError) throw locationError;

  await supabase
    .from('first_mile_pickup_agents')
    .update({
      registration_status: 'retired',
      availability_status: 'offline',
      updated_at: nowIso,
    })
    .eq('driver_id', riderId)
    .in('registration_status', ['pending_approval', 'active', 'suspended']);
}

export async function fetchAnalyticsData(rangeKey = '30d') {
  const startDate = startDateForRange(rangeKey);
  const [{ data: shipments }, { data: riderLocations }, { data: terminals }] = await Promise.all([
    supabase
      .from('shipments')
      .select('id, tracking_id, delivery_state, routing_mode, dispatch_stage, estimated_price, distance_km, created_at, updated_at')
      .gte('created_at', startDate.toISOString()),
    supabase
      .from('rider_locations')
      .select('rider_id, is_online, metadata'),
    supabase
      .from('terminals')
      .select('id, name, code, state, city'),
  ]);

  const safeShipments = shipments || [];
  const safeRiders = riderLocations || [];
  const safeTerminals = terminals || [];
  const dayBuckets = buildDayBuckets(rangeKey);
  const bucketMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));

  let deliveredCount = 0;
  let deliveryHoursTotal = 0;

  safeShipments.forEach((shipment: any) => {
    const createdKey = formatDayKey(shipment.created_at);
    const createdBucket = bucketMap.get(createdKey);
    if (createdBucket) createdBucket.shipments += 1;

    if (shipment.dispatch_stage === 'delivered') {
      deliveredCount += 1;
      const deliveredKey = formatDayKey(shipment.updated_at || shipment.created_at);
      const deliveredBucket = bucketMap.get(deliveredKey);
      if (deliveredBucket) {
        deliveredBucket.delivered += 1;
        deliveredBucket.revenue += Number(shipment.estimated_price || 0);
      }

      const createdAt = new Date(shipment.created_at).getTime();
      const deliveredAt = new Date(shipment.updated_at || shipment.created_at).getTime();
      if (deliveredAt >= createdAt) {
        deliveryHoursTotal += (deliveredAt - createdAt) / (1000 * 60 * 60);
      }
    }
  });

  const totalShipments = safeShipments.length;
  const totalRevenue = safeShipments
    .filter((shipment: any) => shipment.dispatch_stage === 'delivered')
    .reduce((total: number, shipment: any) => total + Number(shipment.estimated_price || 0), 0);
  const successRate = totalShipments ? (deliveredCount / totalShipments) * 100 : 0;
  const avgDeliveryHours = deliveredCount ? deliveryHoursTotal / deliveredCount : 0;

  const statusBreakdownRaw = [
    { label: 'Delivered', count: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'delivered').length, color: '#10B981' },
    { label: 'Out for Delivery', count: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'out_for_delivery').length, color: '#0EA5E9' },
    { label: 'Terminal Relay', count: safeShipments.filter((shipment: any) => shipment.routing_mode === 'relay_terminal' && shipment.dispatch_stage !== 'delivered').length, color: '#7C3AED' },
    { label: 'Exception', count: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'exception').length, color: '#DC2626' },
  ];

  const topCities = Object.entries(
    safeShipments.reduce((acc: Record<string, number>, shipment: any) => {
      const city = shipment.delivery_state || 'Unknown';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 6)
    .map(([city, count]) => ({ city, count }));

  const reports = [
    {
      id: 'ops-summary',
      name: 'Operations Summary',
      period: `Last ${DAY_FILTERS[rangeKey] || 30} days`,
      generated: new Date().toISOString(),
      summary: `${totalShipments} shipments analysed`,
    },
    {
      id: 'terminal-load',
      name: 'Terminal Load Snapshot',
      period: `Current as of ${new Date().toLocaleDateString('en-US')}`,
      generated: new Date().toISOString(),
      summary: `${safeTerminals.length} active terminals`,
    },
    {
      id: 'rider-presence',
      name: 'Rider Presence Snapshot',
      period: `Current as of ${new Date().toLocaleDateString('en-US')}`,
      generated: new Date().toISOString(),
      summary: `${safeRiders.filter((rider: any) => rider.is_online).length} riders online`,
    },
  ];

  return {
    metrics: {
      totalShipments,
      totalRevenue,
      avgDeliveryHours,
      successRate,
      ridersOnline: safeRiders.filter((rider: any) => rider.is_online).length,
    },
    trend: dayBuckets,
    statusBreakdown: statusBreakdownRaw.filter((item) => item.count > 0),
    topCities,
    reports,
  };
}

export async function fetchFinanceData(rangeKey = '30d') {
  const startDate = startDateForRange(rangeKey);
  const [{ data: shipments }, { data: walletTransactions }, { data: walletWithdrawals }, { data: riderLocations }] = await Promise.all([
    supabase
      .from('shipments')
      .select('id, tracking_id, payment_method, dispatch_stage, estimated_price, created_at, updated_at, sender_name, recipient_name')
      .gte('created_at', startDate.toISOString()),
    supabase
      .from('wallet_transactions')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('wallet_withdrawals')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('rider_locations')
      .select('rider_id'),
  ]);

  const safeShipments = shipments || [];
  const safeWalletTransactions = walletTransactions || [];
  const safeWalletWithdrawals = walletWithdrawals || [];
  const safeRiders = riderLocations || [];
  const todayIso = startOfTodayIso();
  const dayBuckets = buildDayBuckets(rangeKey);
  const bucketMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));

  safeShipments.forEach((shipment: any) => {
    if (shipment.dispatch_stage !== 'delivered') return;
    const key = formatDayKey(shipment.updated_at || shipment.created_at);
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    bucket.revenue += Number(shipment.estimated_price || 0);
    bucket.delivered += 1;
  });

  safeWalletTransactions.forEach((transaction: any) => {
    const key = formatDayKey(transaction.created_at);
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    if (transaction.type === 'topup') bucket.walletFunding += Number(transaction.amount || 0);
    if (transaction.type === 'withdrawal') bucket.withdrawals += Number(transaction.amount || 0);
  });

  const deliveredShipments = safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'delivered');
  const totalEarnings = sumAmount(deliveredShipments, 'estimated_price');
  const revenueToday = deliveredShipments
    .filter((shipment: any) => (shipment.updated_at || shipment.created_at) >= todayIso)
    .reduce((total: number, shipment: any) => total + Number(shipment.estimated_price || 0), 0);
  const pendingPayouts = safeWalletWithdrawals
    .filter((withdrawal: any) => withdrawal.status === 'pending')
    .reduce((total: number, withdrawal: any) => total + Number(withdrawal.amount || 0), 0);
  const avgEarningsPerRider = safeRiders.length ? totalEarnings / safeRiders.length : 0;

  const paymentMethodBreakdown = Object.entries(
    deliveredShipments.reduce((acc: Record<string, number>, shipment: any) => {
      const method = shipment.payment_method || 'Unknown';
      acc[method] = (acc[method] || 0) + Number(shipment.estimated_price || 0);
      return acc;
    }, {})
  )
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([label, amount], index) => ({
      label,
      amount: Number(amount),
      color: ['#10B981', '#3B82F6', '#F59E0B', '#7C3AED', '#DC2626'][index % 5],
    }));

  const recentTransactions = [
    ...safeWalletTransactions.map((transaction: any) => ({
      id: transaction.reference || transaction.id,
      date: transaction.created_at,
      description: transaction.description || transaction.type,
      entity: transaction.method || transaction.type,
      amount: Number(transaction.amount || 0),
      status: transaction.status || 'pending',
      category: transaction.type,
    })),
    ...deliveredShipments.slice(0, 12).map((shipment: any) => ({
      id: shipment.tracking_id || shipment.id,
      date: shipment.updated_at || shipment.created_at,
      description: 'Delivered shipment revenue',
      entity: shipment.recipient_name || shipment.sender_name || 'Customer',
      amount: Number(shipment.estimated_price || 0),
      status: 'completed',
      category: 'shipment_revenue',
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 16);

  return {
    metrics: {
      totalEarnings,
      revenueToday,
      pendingPayouts,
      avgEarningsPerRider,
      walletFunding: safeWalletTransactions
        .filter((transaction: any) => transaction.type === 'topup' && transaction.status === 'success')
        .reduce((total: number, transaction: any) => total + Number(transaction.amount || 0), 0),
    },
    trend: dayBuckets,
    breakdown: paymentMethodBreakdown,
    recentTransactions,
  };
}

export async function loadAdminSettings() {
  const { data: { user } } = await supabase.auth.getUser();
  const storageKey = `${SETTINGS_STORAGE_KEY}:${user?.id || 'mock-admin'}`;
  const stored = await AsyncStorage.getItem(storageKey);
  const parsed = stored ? JSON.parse(stored) : {};

  let profile = null;
  if (user?.id) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone_number, email')
      .eq('id', user.id)
      .maybeSingle();
    profile = data;
  }

  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...parsed,
    companyEmail: parsed.companyEmail || profile?.email || DEFAULT_ADMIN_SETTINGS.companyEmail,
    companyPhone: parsed.companyPhone || profile?.phone_number || DEFAULT_ADMIN_SETTINGS.companyPhone,
  };
}

export async function saveAdminSettings(settings: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  const storageKey = `${SETTINGS_STORAGE_KEY}:${user?.id || 'mock-admin'}`;
  await AsyncStorage.setItem(storageKey, JSON.stringify(settings));

  if (user?.id) {
    await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        role: 'admin',
        full_name: settings.companyName,
        phone_number: settings.companyPhone,
        email: settings.companyEmail,
      }, { onConflict: 'id' });
  }

  return settings;
}

/* ─── Agro Transport Data ─────────────────────────────── */

const PRODUCE_LABELS: Record<string, string> = {
  grains_cereals:      'Grains & Cereals',
  tubers_roots:        'Tubers & Roots',
  vegetables_leafy:    'Leafy Vegetables',
  vegetables_fruiting: 'Fruiting Vegetables',
  fruits_tropical:     'Tropical Fruits',
  livestock_poultry:   'Livestock / Poultry',
  livestock_cattle:    'Cattle',
  fish_seafood:        'Fish & Seafood',
  agro_inputs:         'Agro Inputs',
  processed_foods:     'Processed Foods',
  perishables_mixed:   'Mixed Perishables',
};

const VEHICLE_LABELS: Record<string, string> = {
  open_truck:         'Open Truck',
  covered_van:        'Covered Van',
  refrigerated_truck: 'Refrigerated Truck',
  flatbed_trailer:    'Flatbed Trailer',
  pickup_van:         'Pickup Van',
  motorcycle_box:     'Motorcycle Box',
};

const AGRO_ACTIVE_STAGES = [
  'awaiting_rider_acceptance',
  'awaiting_source_terminal_dropoff',
  'awaiting_source_terminal',
  'received_at_source_terminal',
  'linehaul_in_transit',
  'received_at_destination_terminal',
  'awaiting_final_mile_rider',
  'out_for_delivery',
];

const AGRO_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#7C3AED',
  '#DC2626', '#0EA5E9', '#84CC16', '#EC4899',
  '#14B8A6', '#F97316', '#6366F1',
];

export async function fetchAgroData() {
  const [{ data: shipments }, { data: terminals }] = await Promise.all([
    supabase
      .from('shipments')
      .select(
        'id, tracking_id, sender_name, recipient_name, pickup_state, delivery_state, ' +
        'dispatch_stage, status, estimated_price, created_at, updated_at, ' +
        'is_agro_shipment, agro_produce_category, agro_vehicle_type, agro_tonnage, ' +
        'agro_insured, agro_handling_notes, requires_cold_chain'
      )
      .eq('is_agro_shipment', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('terminals')
      .select('id, name, code, city, state, is_agro_ready, agro_capacity_tonnes')
      .eq('is_agro_ready', true),
  ]);

  const agroShipments = shipments || [];
  const agroTerminals = terminals || [];

  // ── Stats ──────────────────────────────────────────────
  const active     = agroShipments.filter((s: any) => AGRO_ACTIVE_STAGES.includes(s.dispatch_stage));
  const coldChain  = agroShipments.filter((s: any) => s.requires_cold_chain);
  const insured    = agroShipments.filter((s: any) => s.agro_insured);
  const exceptions = agroShipments.filter((s: any) => s.dispatch_stage === 'exception');

  // ── Produce category breakdown ─────────────────────────
  const produceCounts: Record<string, number> = {};
  agroShipments.forEach((s: any) => {
    const key = s.agro_produce_category || 'unknown';
    produceCounts[key] = (produceCounts[key] || 0) + 1;
  });
  const produceBreakdown = Object.entries(produceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count], idx) => ({
      label: PRODUCE_LABELS[key] || key,
      count,
      color: AGRO_COLORS[idx % AGRO_COLORS.length],
    }));

  // ── Vehicle type demand ────────────────────────────────
  const vehicleCounts: Record<string, number> = {};
  agroShipments.forEach((s: any) => {
    const key = s.agro_vehicle_type || 'unknown';
    vehicleCounts[key] = (vehicleCounts[key] || 0) + 1;
  });
  const vehicleDemand = Object.entries(vehicleCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      label: VEHICLE_LABELS[key] || key,
      count,
    }));

  // ── Agro terminal load ─────────────────────────────────
  const terminalRows = agroTerminals.map((t: any) => ({
    ...t,
    agroJobsHere: agroShipments.filter(
      (s: any) =>
        AGRO_ACTIVE_STAGES.includes(s.dispatch_stage) &&
        (s.source_terminal_id === t.id || s.destination_terminal_id === t.id)
    ).length,
  }));

  return {
    stats: {
      total:      agroShipments.length,
      active:     active.length,
      coldChain:  coldChain.length,
      insured:    insured.length,
      exceptions: exceptions.length,
    },
    produceBreakdown,
    vehicleDemand,
    agroTerminals: terminalRows,
    shipments: agroShipments,
  };
}
