import { supabase } from '../supabase';

const ACTIVE_STAGES = [
  'awaiting_rider_acceptance',
  'awaiting_source_terminal',
  'received_at_source_terminal',
  'linehaul_in_transit',
  'received_at_destination_terminal',
  'awaiting_final_mile_rider',
  'out_for_delivery',
];

const TERMINAL_BACKLOG_STAGES = [
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
    at_source_hub: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'received_at_source_terminal').length,
    linehaul: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'linehaul_in_transit').length,
    awaiting_final_mile: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'awaiting_final_mile_rider').length,
    out_for_delivery: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'out_for_delivery').length,
    exception: safeShipments.filter((shipment: any) => shipment.dispatch_stage === 'exception').length,
  };

  const terminalLoads = safeTerminals.map((terminal: any) => ({
    ...terminal,
    inbound: safeShipments.filter((shipment: any) => shipment.source_terminal_id === terminal.id && shipment.dispatch_stage === 'awaiting_source_terminal').length,
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

  const [{ data: riderLocations }, { data: shipments }] = await Promise.all([
    supabase
      .from('rider_locations')
      .select('rider_id, lat, lng, is_online, last_seen, current_shipment_id, metadata, profiles(id, full_name, phone_number)')
      .order('last_seen', { ascending: false }),
    supabase
      .from('shipments')
      .select('id, tracking_id, assigned_rider_id, final_mile_rider_id, dispatch_stage, status, pickup_state, delivery_state, updated_at, created_at'),
  ]);

  const safeLocations = riderLocations || [];
  const safeShipments = shipments || [];

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
      terminalCode: row.metadata?.terminal_code || row.metadata?.state || 'N/A',
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

export async function updateFleetVehicleStatus(riderId: string, nextStatus: string) {
  const { data: existing } = await supabase
    .from('rider_locations')
    .select('metadata')
    .eq('rider_id', riderId)
    .maybeSingle();

  const nextMetadata = {
    ...(existing?.metadata || {}),
    status: nextStatus,
    updated_by_admin_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('rider_locations')
    .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq('rider_id', riderId);

  if (error) throw error;
}
