import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BRAND } from '../../constants/Theme';
import { AlertTriangle, ChevronDown, FileText, MoveRight, RefreshCw, Route, X, Image as ImageIcon, CheckCircle, XCircle, ScanLine } from 'lucide-react-native';
import { supabase } from '../../supabase';
import {
  advanceShipmentStage,
  logShipmentEvent,
  resolveRouting,
  shipmentStatusLabel,
  stageColor,
  stageLabel,
  stageProofLabel,
  stageProgress,
} from '../../utils/routingService';

const STAGE_FILTERS = [
  'All',
  'pending_routing',
  'awaiting_rider_acceptance',
  'awaiting_source_terminal_dropoff',
  'awaiting_source_terminal',
  'received_at_source_terminal',
  'linehaul_in_transit',
  'received_at_destination_terminal',
  'awaiting_final_mile_rider',
  'out_for_delivery',
  'delivered',
  'exception',
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getShipmentStageLabel = (shipment: any) => {
  if (
    shipment?.routing_mode === 'relay_terminal'
    && shipment?.relay_first_mile_strategy === 'renax_pickup'
    && shipment?.dispatch_stage === 'awaiting_rider_acceptance'
    && shipment?.first_mile_pickup_agent_id
  ) {
    return 'First-Mile Vehicle Assigned';
  }

  if (
    shipment?.routing_mode === 'relay_terminal'
    && shipment?.relay_last_mile_strategy === 'recipient_pickup'
    && shipment?.dispatch_stage === 'received_at_destination_terminal'
  ) {
    return 'Awaiting Recipient Pickup';
  }

  return stageLabel(shipment?.dispatch_stage || 'pending_routing');
};

const getAdvanceLabel = (shipment: any) => {
  const stage = shipment.dispatch_stage || 'pending_routing';
  const routing = shipment.routing_mode || 'last_mile_local';
  const isManagedFirstMile =
    routing === 'relay_terminal' &&
    shipment?.relay_first_mile_strategy === 'renax_pickup' &&
    ['awaiting_rider_acceptance', 'awaiting_source_terminal'].includes(stage) &&
    !shipment?.first_mile_pickup_agent_id;

  if (isManagedFirstMile) {
    return 'Manage Pickup';
  }

  if (
    shipment?.routing_mode === 'relay_terminal'
    && shipment?.relay_last_mile_strategy === 'renax_delivery'
    && ['received_at_destination_terminal', 'awaiting_final_mile_rider'].includes(stage)
  ) {
    return 'Manage Final Mile';
  }

  const labels: Record<string, string> = {
    pending_routing: 'Release To Queue',
    awaiting_rider_acceptance: routing === 'relay_terminal' ? 'Manage Pickup' : 'Release Delivery',
    awaiting_source_terminal_dropoff: 'Receive Customer Drop-Off',
    awaiting_source_terminal: 'Check In Source Hub',
    received_at_source_terminal: 'Dispatch Linehaul',
    linehaul_in_transit: 'Receive At Destination Hub',
    received_at_destination_terminal: shipment?.relay_last_mile_strategy === 'recipient_pickup'
      ? 'Confirm Recipient Pickup'
      : 'Release Final Mile',
    awaiting_final_mile_rider: 'Mark Out For Delivery',
    out_for_delivery: 'Mark Delivered',
  };
  return labels[stage] || 'Advance';
};

const EXCEPTION_TYPES = [
  { key: 'delayed',          label: 'Mark Delayed',           color: '#F59E0B', note: 'Shipment is delayed due to external factors.' },
  { key: 'failed_pickup',    label: 'Failed Pickup',          color: '#DC2626', note: 'Rider could not collect the parcel from sender.' },
  { key: 'failed_delivery',  label: 'Failed Delivery',        color: '#DC2626', note: 'Delivery attempt was unsuccessful.' },
  { key: 'damaged',          label: 'Damaged Parcel',         color: '#7C3AED', note: 'Parcel reported as damaged during transit.' },
  { key: 'unavailable',      label: 'Customer Unavailable',   color: '#6B7280', note: 'Customer was unreachable at point of delivery.' },
];

const OPERATOR_STAGE_ACTIONS = [
  { stage: 'awaiting_rider_acceptance', label: 'Rider Queue' },
  { stage: 'awaiting_source_terminal', label: 'Pickup To Hub' },
  { stage: 'received_at_source_terminal', label: 'At Source Hub' },
  { stage: 'linehaul_in_transit', label: 'Linehaul' },
  { stage: 'received_at_destination_terminal', label: 'At Destination Hub' },
  { stage: 'awaiting_final_mile_rider', label: 'Final-Mile Queue' },
  { stage: 'out_for_delivery', label: 'Out For Delivery' },
  { stage: 'delivered', label: 'Delivered' },
];

type ShipmentsProps = {
  initialShipmentId?: string;
  initialStageFilter?: string;
  initialTerminalId?: string;
  focusVersion?: number;
};

export default function Shipments({ initialShipmentId, initialStageFilter, initialTerminalId, focusVersion = 0 }: ShipmentsProps) {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [searchQuery, setSearchQuery] = useState('');
  const [shipments, setShipments] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [stageSuggestions, setStageSuggestions] = useState<any[]>([]);
  const [proofRecords, setProofRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [terminalFilterId, setTerminalFilterId] = useState<string | null>(null);
  const [suggestionFilter, setSuggestionFilter] = useState<'all'|'pending'|'accepted'|'dismissed'|'low'>('all');
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [proofViewerUrl, setProofViewerUrl] = useState<string | null>(null);
  const [showExceptionMenu, setShowExceptionMenu] = useState(false);
  const [hubScanValue, setHubScanValue] = useState('');
  const [showHubScan, setShowHubScan] = useState(false);
  const [pickupQueueRecord, setPickupQueueRecord] = useState<any | null>(null);
  const [pickupCandidates, setPickupCandidates] = useState<any[]>([]);
  const [pickupAttempts, setPickupAttempts] = useState<any[]>([]);
  const [pickupOpsLoading, setPickupOpsLoading] = useState(false);
  const [pickupOpsBusy, setPickupOpsBusy] = useState<string | null>(null);
  const [pickupOpsReason, setPickupOpsReason] = useState('');
  const [dispatchWatchlist, setDispatchWatchlist] = useState<any[]>([]);
  const [dispatchOpsBusy, setDispatchOpsBusy] = useState<string | null>(null);
  const [finalMileWatchlist, setFinalMileWatchlist] = useState<any[]>([]);
  const [finalMileQueueRecord, setFinalMileQueueRecord] = useState<any | null>(null);
  const [finalMileCandidates, setFinalMileCandidates] = useState<any[]>([]);
  const [finalMileOpsLoading, setFinalMileOpsLoading] = useState(false);
  const [finalMileOpsBusy, setFinalMileOpsBusy] = useState<string | null>(null);
  const [finalMileOpsReason, setFinalMileOpsReason] = useState('');
  const [localRiderCandidates, setLocalRiderCandidates] = useState<any[]>([]);
  const [localRiderOpsLoading, setLocalRiderOpsLoading] = useState(false);
  const [localRiderOpsBusy, setLocalRiderOpsBusy] = useState<string | null>(null);
  const [localRiderOpsReason, setLocalRiderOpsReason] = useState('');
  const [deliverEarnCandidates, setDeliverEarnCandidates] = useState<any[]>([]);
  const [deliverEarnOffers, setDeliverEarnOffers] = useState<any[]>([]);
  const [deliverEarnOpsLoading, setDeliverEarnOpsLoading] = useState(false);
  const [deliverEarnOpsBusy, setDeliverEarnOpsBusy] = useState<string | null>(null);
  const [deliverEarnOpsReason, setDeliverEarnOpsReason] = useState('');

  const terminalMap = useMemo(
    () => Object.fromEntries(terminals.map((terminal) => [terminal.id, terminal])),
    [terminals]
  );

  const dispatchStats = useMemo(() => ({
    liveOffers: dispatchWatchlist.filter((item) => Number(item.live_offer_count || 0) > 0).length,
    pendingOps: dispatchWatchlist.filter((item) => item.escalation_status === 'pending_ops').length,
    awaitingAssignment: dispatchWatchlist.filter((item) => !item.assigned_agent_id && Number(item.live_offer_count || 0) === 0 && item.orchestration_status !== 'assigned').length,
    assigned: dispatchWatchlist.filter((item) => !!item.assigned_agent_id).length,
  }), [dispatchWatchlist]);

  const finalMileDispatchStats = useMemo(() => ({
    awaitingRelease: finalMileWatchlist.filter((item) => item.release_required).length,
    openQueue: finalMileWatchlist.filter((item) => item.dispatch_stage === 'awaiting_final_mile_rider' && !item.final_mile_rider_id).length,
    outForDelivery: finalMileWatchlist.filter((item) => item.dispatch_stage === 'out_for_delivery' && !!item.final_mile_rider_id).length,
    candidateReady: finalMileWatchlist.filter((item) => Number(item.candidate_count || 0) > 0).length,
  }), [finalMileWatchlist]);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: shipmentData }, { data: terminalData }, { data: watchlistData }, { data: finalMileWatchlistData }] = await Promise.all([
        supabase.from('shipments').select('*').order('created_at', { ascending: false }),
        supabase.from('terminals').select('*').order('state'),
        supabase.from('first_mile_dispatch_watchlist').select('*'),
        supabase.from('final_mile_dispatch_watchlist').select('*'),
      ]);
      setShipments(shipmentData || []);
      setTerminals(terminalData || []);
      setDispatchWatchlist((watchlistData || []).sort((left: any, right: any) => {
        const leftPending = left.escalation_status === 'pending_ops' ? 0 : 1;
        const rightPending = right.escalation_status === 'pending_ops' ? 0 : 1;
        if (leftPending !== rightPending) return leftPending - rightPending;

        const leftOffer = Number(left.live_offer_count || 0) > 0 ? 0 : 1;
        const rightOffer = Number(right.live_offer_count || 0) > 0 ? 0 : 1;
        if (leftOffer !== rightOffer) return leftOffer - rightOffer;

        const leftSla = left.assignment_sla_at ? new Date(left.assignment_sla_at).getTime() : Number.MAX_SAFE_INTEGER;
        const rightSla = right.assignment_sla_at ? new Date(right.assignment_sla_at).getTime() : Number.MAX_SAFE_INTEGER;
        return leftSla - rightSla;
      }));
      setFinalMileWatchlist((finalMileWatchlistData || []).sort((left: any, right: any) => {
        const leftRelease = left.release_required ? 0 : 1;
        const rightRelease = right.release_required ? 0 : 1;
        if (leftRelease !== rightRelease) return leftRelease - rightRelease;

        const leftQueued = left.dispatch_stage === 'awaiting_final_mile_rider' && !left.final_mile_rider_id ? 0 : 1;
        const rightQueued = right.dispatch_stage === 'awaiting_final_mile_rider' && !right.final_mile_rider_id ? 0 : 1;
        if (leftQueued !== rightQueued) return leftQueued - rightQueued;

        return new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime();
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const filtered = useMemo(() => shipments.filter((shipment) => {
    const query = searchQuery.trim().toLowerCase();
    const queryMatch = !query
      || shipment.tracking_id?.toLowerCase().includes(query)
      || shipment.sender_name?.toLowerCase().includes(query)
      || shipment.recipient_name?.toLowerCase().includes(query)
      || shipment.pickup_address?.toLowerCase().includes(query)
      || shipment.delivery_address?.toLowerCase().includes(query);
    const currentStage = shipment.dispatch_stage || 'pending_routing';
    const statusMatch = statusFilter === 'All' || currentStage === statusFilter;
    const terminalMatch = !terminalFilterId
      || shipment.source_terminal_id === terminalFilterId
      || shipment.destination_terminal_id === terminalFilterId;
    return queryMatch && statusMatch && terminalMatch;
  }), [shipments, searchQuery, statusFilter, terminalFilterId]);

  const isManagedFirstMileShipment = (shipment: any) =>
    shipment?.routing_mode === 'relay_terminal' && shipment?.relay_first_mile_strategy === 'renax_pickup';

  const isManagedFinalMileShipment = (shipment: any) =>
    shipment?.routing_mode === 'relay_terminal' && shipment?.relay_last_mile_strategy === 'renax_delivery';

  const isLocalRiderManagedShipment = (shipment: any) =>
    shipment?.supply_mode !== 'deliver_and_earn' && (shipment?.routing_mode !== 'relay_terminal' || !!shipment?.assigned_rider_id);

  const isDeliverEarnCompatibleShipment = (shipment: any) => {
    const pickupState = String(shipment?.pickup_state || '').trim().toLowerCase();
    const deliveryState = String(shipment?.delivery_state || '').trim().toLowerCase();
    const sameState = !!pickupState && pickupState === deliveryState;
    return shipment?.supply_mode === 'deliver_and_earn'
      || (
        shipment?.routing_mode !== 'relay_terminal'
        && sameState
        && !shipment?.assigned_rider_id
        && !shipment?.final_mile_rider_id
        && ['pending_routing', 'awaiting_rider_acceptance'].includes(shipment?.dispatch_stage || 'pending_routing')
      );
  };

  const locationNameForStage = (shipment: any, stage: string) => {
    if (stage === 'received_at_source_terminal' || stage === 'linehaul_in_transit') {
      return terminalMap[shipment.source_terminal_id]?.name || shipment.pickup_state || shipment.pickup_address;
    }
    if (stage === 'received_at_destination_terminal' || stage === 'awaiting_final_mile_rider') {
      return terminalMap[shipment.destination_terminal_id]?.name || shipment.delivery_state || shipment.delivery_address;
    }
    if (stage === 'awaiting_source_terminal') {
      return shipment.pickup_address || shipment.pickup_state;
    }
    return shipment.delivery_address || shipment.delivery_state || shipment.pickup_address || shipment.pickup_state;
  };

  const loadPickupOpsContext = useCallback(async (shipment: any) => {
    if (!isManagedFirstMileShipment(shipment)) {
      setPickupQueueRecord(null);
      setPickupCandidates([]);
      setPickupAttempts([]);
      return;
    }

    setPickupOpsLoading(true);
    try {
      const { data: queueRecord } = await supabase
        .from('first_mile_pickup_request_queue')
        .select('*')
        .eq('shipment_id', shipment.id)
        .maybeSingle();

      setPickupQueueRecord(queueRecord || null);

      if (!queueRecord?.id) {
        setPickupCandidates([]);
        setPickupAttempts([]);
        return;
      }

      const [{ data: candidateScores }, { data: attemptRows }] = await Promise.all([
        supabase.rpc('first_mile_pickup_candidates', { p_pickup_request_id: queueRecord.id }),
        supabase
          .from('pickup_request_assignment_attempts')
          .select('*')
          .eq('pickup_request_id', queueRecord.id)
          .order('attempt_order', { ascending: false }),
      ]);

      const agentIds = Array.from(new Set([
        ...(candidateScores || []).map((row: any) => row.pickup_agent_id),
        ...(attemptRows || []).map((row: any) => row.pickup_agent_id),
        queueRecord.assigned_agent_id,
      ].filter(Boolean)));

      const agentMap = new Map<string, any>();

      if (agentIds.length > 0) {
        const { data: agentRows } = await supabase
          .from('first_mile_pickup_pool_live')
          .select('*')
          .in('id', agentIds);

        (agentRows || []).forEach((row: any) => {
          agentMap.set(row.id, row);
        });
      }

      setPickupCandidates((candidateScores || []).map((row: any) => ({
        ...agentMap.get(row.pickup_agent_id),
        pickup_agent_id: row.pickup_agent_id,
        score: row.score,
        candidate_driver_id: row.driver_id,
      })));

      setPickupAttempts((attemptRows || []).map((row: any) => ({
        ...row,
        agent: agentMap.get(row.pickup_agent_id) || null,
      })));
    } finally {
      setPickupOpsLoading(false);
    }
  }, []);

  const loadFinalMileOpsContext = useCallback(async (shipment: any) => {
    if (!isManagedFinalMileShipment(shipment)) {
      setFinalMileQueueRecord(null);
      setFinalMileCandidates([]);
      return;
    }

    setFinalMileOpsLoading(true);
    try {
      const [{ data: queueRecord }, { data: candidateRows }] = await Promise.all([
        supabase
          .from('final_mile_dispatch_watchlist')
          .select('*')
          .eq('shipment_id', shipment.id)
          .maybeSingle(),
        supabase.rpc('final_mile_dispatch_candidates', { p_shipment_id: shipment.id }),
      ]);

      setFinalMileQueueRecord(queueRecord || null);
      setFinalMileCandidates(candidateRows || []);
    } finally {
      setFinalMileOpsLoading(false);
    }
  }, []);

  const loadLocalRiderOpsContext = useCallback(async (shipment: any) => {
    if (!isLocalRiderManagedShipment(shipment)) {
      setLocalRiderCandidates([]);
      return;
    }

    setLocalRiderOpsLoading(true);
    try {
      const { data: riderRows } = await supabase
        .from('rider_locations')
        .select('rider_id, is_online, current_shipment_id, last_seen, lat, lng, metadata, profiles(id, full_name, phone_number, role, state, city, logistics_roles, assigned_terminal_id, preferred_terminal_code)')
        .order('last_seen', { ascending: false })
        .limit(80);

      const pickupState = String(shipment.pickup_state || '').toLowerCase();
      const deliveryState = String(shipment.delivery_state || '').toLowerCase();
      const pickupCity = String(shipment.pickup_city || '').toLowerCase();
      const deliveryCity = String(shipment.delivery_city || '').toLowerCase();

      const candidates = (riderRows || [])
        .map((row: any) => {
          const profile = row.profiles || {};
          const logisticsRoles = profile.logistics_roles || [];
          const role = String(profile.role || '').toLowerCase();
          const operatingState = String(profile.state || row.metadata?.state || '').toLowerCase();
          const operatingCity = String(profile.city || row.metadata?.city || '').toLowerCase();
          const roleMatch = ['rider', 'driver'].includes(role)
            && (
              logisticsRoles.length === 0
              || logisticsRoles.some((item: string) => ['rider', 'final_mile', 'driver'].includes(String(item).toLowerCase()))
            );
          const busyElsewhere = row.current_shipment_id && row.current_shipment_id !== shipment.id;
          const stateMatch = operatingState && [pickupState, deliveryState].filter(Boolean).includes(operatingState);
          const cityMatch = operatingCity && [pickupCity, deliveryCity].filter(Boolean).includes(operatingCity);
          const liveScore = row.is_online ? 25 : 0;
          const availabilityScore = busyElsewhere ? -50 : 20;
          const locationScore = cityMatch ? 25 : stateMatch ? 18 : 5;
          const assignmentScore = shipment.assigned_rider_id === row.rider_id ? 100 : liveScore + availabilityScore + locationScore;

          return {
            rider_id: row.rider_id,
            rider_name: profile.full_name || row.metadata?.driver_name || 'Rider',
            rider_phone: profile.phone_number || 'N/A',
            rider_role: role || 'rider',
            logistics_roles: logisticsRoles,
            operating_state: profile.state || row.metadata?.state || 'Unknown state',
            operating_city: profile.city || row.metadata?.city || 'Unknown city',
            vehicle_type: row.metadata?.vehicle_type || 'Motorcycle',
            vehicle_id: row.metadata?.vehicle_id || row.metadata?.vehicle_code || `RID-${String(row.rider_id).slice(0, 6).toUpperCase()}`,
            terminal_code: row.metadata?.terminal_code || profile.preferred_terminal_code || 'N/A',
            is_online: row.is_online,
            current_shipment_id: row.current_shipment_id,
            busy_elsewhere: busyElsewhere,
            last_seen: row.last_seen,
            metadata: row.metadata || {},
            score: assignmentScore,
            role_match: roleMatch,
          };
        })
        .filter((candidate) => candidate.role_match && !candidate.busy_elsewhere)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));

      setLocalRiderCandidates(candidates.slice(0, 10));
    } finally {
      setLocalRiderOpsLoading(false);
    }
  }, []);

  const loadDeliverEarnOpsContext = useCallback(async (shipment: any) => {
    if (!isDeliverEarnCompatibleShipment(shipment)) {
      setDeliverEarnCandidates([]);
      setDeliverEarnOffers([]);
      return;
    }

    setDeliverEarnOpsLoading(true);
    try {
      const [{ data: candidates, error: candidatesError }, { data: offers, error: offersError }] = await Promise.all([
        supabase.rpc('deliver_and_earn_candidates', { p_shipment_id: shipment.id }),
        supabase
          .from('deliver_and_earn_job_offers')
          .select('*')
          .eq('shipment_id', shipment.id)
          .order('created_at', { ascending: false }),
      ]);

      if (candidatesError) {
        console.warn('Deliver & Earn candidates unavailable for this shipment.', candidatesError);
      }
      if (offersError) {
        console.warn('Deliver & Earn offers unavailable for this shipment.', offersError);
      }

      setDeliverEarnCandidates((candidates || []).slice(0, 10));
      setDeliverEarnOffers(offers || []);
    } finally {
      setDeliverEarnOpsLoading(false);
    }
  }, []);

  const loadShipmentDetails = async (shipment: any) => {
    setSelectedShipment(shipment);
    const [{ data: eventData }, { data: suggestionData }, { data: proofData }] = await Promise.all([
      supabase.from('shipment_events').select('*').eq('shipment_id', shipment.id).order('created_at', { ascending: true }),
      supabase.from('shipment_stage_suggestions').select('*').eq('shipment_id', shipment.id).order('created_at', { ascending: false }),
      supabase.from('shipment_stage_proofs').select('*').eq('shipment_id', shipment.id).order('created_at', { ascending: false }),
    ]);
    const resolvedProofs = await Promise.all((proofData || []).map(async (proof: any) => {
      const mediaPath = String(proof?.media_url || '').trim();
      if (!mediaPath || mediaPath.startsWith('data:') || mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
        return proof;
      }

      const { data, error } = await supabase.storage.from('shipment-proofs').createSignedUrl(mediaPath, 60 * 30);
      if (error || !data?.signedUrl) return { ...proof, media_url: null };
      return { ...proof, media_url: data.signedUrl };
    }));
    setTimelineEvents(eventData || []);
    setStageSuggestions(suggestionData || []);
    setProofRecords(resolvedProofs);
    setOverrideReason('');
    setPickupOpsReason('');
    setFinalMileOpsReason('');
    setLocalRiderOpsReason('');
    setDeliverEarnOpsReason('');
    setShowOverrideInput(false);
    setShowExceptionMenu(false);
    setShowHubScan(false);
    await Promise.all([
      loadPickupOpsContext(shipment),
      loadFinalMileOpsContext(shipment),
      loadLocalRiderOpsContext(shipment),
      loadDeliverEarnOpsContext(shipment),
    ]);
  };

  useEffect(() => {
    if (initialStageFilter) {
      setStatusFilter(initialStageFilter);
    } else if (focusVersion > 0 && !initialShipmentId) {
      setStatusFilter('All');
    }

    setTerminalFilterId(initialTerminalId || null);
    if (initialShipmentId) {
      setSearchQuery('');
    }
  }, [focusVersion, initialShipmentId, initialStageFilter, initialTerminalId]);

  useEffect(() => {
    if (!initialShipmentId || loading) return;

    const existing = shipments.find((shipment) => shipment.id === initialShipmentId);
    if (existing) {
      void loadShipmentDetails(existing);
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', initialShipmentId)
        .maybeSingle();

      if (data) {
        await loadShipmentDetails(data);
      }
    })();
  }, [focusVersion, initialShipmentId, loading, shipments]);

  const handleApplySuggestion = async (shipment: any, suggestion: any) => {
    setBusyId(shipment.id);
    try {
      const actionable = (
        (shipment.dispatch_stage === 'awaiting_source_terminal' && suggestion.suggested_stage === 'received_at_source_terminal')
        || (shipment.dispatch_stage === 'linehaul_in_transit' && suggestion.suggested_stage === 'received_at_destination_terminal')
      );

      if (!actionable) return;

      await advanceShipmentStage(
        shipment.id,
        shipment.dispatch_stage || 'pending_routing',
        shipment.routing_mode || 'last_mile_local',
        undefined,
        'admin',
        {
          locationName:
            suggestion.suggested_stage === 'received_at_source_terminal'
              ? terminalMap[shipment.source_terminal_id]?.name
              : terminalMap[shipment.destination_terminal_id]?.name,
          notes: `Admin accepted smart suggestion: ${suggestion.title || suggestion.suggested_stage}.`,
          proofs: [
            {
              stage: suggestion.suggested_stage,
              proof_type: 'gps_geofence',
              notes: suggestion.message || 'Geofence suggestion accepted by admin.',
              confidence_score: Number(suggestion.confidence_score || 0.8),
              metadata: suggestion.metadata || {},
            },
          ],
        }
      );

      await supabase
        .from('shipment_stage_suggestions')
        .update({
          suggestion_status: 'accepted',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', suggestion.id);

      await loadShipments();
      const refreshed = shipments.find((item) => item.id === shipment.id) || shipment;
      await loadShipmentDetails(refreshed);
    } finally {
      setBusyId(null);
    }
  };

  const handleDismissSuggestion = async (suggestion: any) => {
    await supabase
      .from('shipment_stage_suggestions')
      .update({ suggestion_status: 'dismissed', resolved_at: new Date().toISOString() })
      .eq('id', suggestion.id);
    if (selectedShipment) await loadShipmentDetails(selectedShipment);
  };

  const handleAdvance = async (shipment: any, reason?: string) => {
    if (
      isManagedFirstMileShipment(shipment)
      && ['awaiting_rider_acceptance', 'awaiting_source_terminal'].includes(shipment.dispatch_stage || '')
      && !shipment.first_mile_pickup_agent_id
    ) {
      await loadShipmentDetails(shipment);
      return;
    }

    if (isManagedFinalMileShipment(shipment) && ['received_at_destination_terminal', 'awaiting_final_mile_rider'].includes(shipment.dispatch_stage || '')) {
      await loadShipmentDetails(shipment);
      return;
    }

    const finalReason = reason || overrideReason.trim() || 'Admin advanced shipment through the controlled dispatch flow.';
    setBusyId(shipment.id);
    setShowOverrideInput(false);
    try {
      await advanceShipmentStage(
        shipment.id,
        shipment.dispatch_stage || 'pending_routing',
        shipment.routing_mode || 'last_mile_local',
        undefined,
        'admin',
        {
          locationName:
            shipment.dispatch_stage === 'awaiting_source_terminal_dropoff' || shipment.dispatch_stage === 'awaiting_source_terminal'
              ? terminalMap[shipment.source_terminal_id]?.name
              : shipment.dispatch_stage === 'linehaul_in_transit' || shipment.dispatch_stage === 'received_at_destination_terminal'
                ? terminalMap[shipment.destination_terminal_id]?.name
                : shipment.delivery_address || shipment.delivery_state,
          notes: finalReason,
          proofs: [
            {
              stage: shipment.dispatch_stage === 'pending_routing'
                ? shipment.routing_mode === 'relay_terminal' && shipment.relay_first_mile_strategy !== 'renax_pickup'
                  ? 'awaiting_source_terminal_dropoff'
                  : 'awaiting_rider_acceptance'
                : shipment.dispatch_stage === 'awaiting_source_terminal_dropoff'
                  ? 'received_at_source_terminal'
                : shipment.dispatch_stage === 'awaiting_rider_acceptance'
                  ? shipment.routing_mode === 'relay_terminal' ? 'awaiting_source_terminal' : 'out_for_delivery'
                  : shipment.dispatch_stage === 'awaiting_source_terminal'
                    ? 'received_at_source_terminal'
                    : shipment.dispatch_stage === 'received_at_source_terminal'
                      ? 'linehaul_in_transit'
                      : shipment.dispatch_stage === 'linehaul_in_transit'
                        ? 'received_at_destination_terminal'
                        : shipment.dispatch_stage === 'received_at_destination_terminal'
                          ? shipment.relay_last_mile_strategy === 'recipient_pickup'
                            ? 'delivered'
                            : 'awaiting_final_mile_rider'
                          : shipment.dispatch_stage === 'awaiting_final_mile_rider'
                            ? 'out_for_delivery'
                            : 'delivered',
              proof_type: shipment.dispatch_stage === 'awaiting_source_terminal_dropoff' || shipment.dispatch_stage === 'awaiting_source_terminal' || shipment.dispatch_stage === 'linehaul_in_transit'
                ? 'hub_check_in'
                : shipment.dispatch_stage === 'received_at_source_terminal' || shipment.dispatch_stage === 'received_at_destination_terminal'
                  ? 'hub_release'
                  : 'admin_override',
              notes: 'Admin console recorded a stage proof for this transition.',
              confidence_score: shipment.dispatch_stage === 'out_for_delivery' ? 0.72 : 0.8,
            },
          ],
        }
      );
      await loadShipments();
      if (selectedShipment?.id === shipment.id) {
        const updated = shipments.find((item) => item.id === shipment.id);
        if (updated) await loadShipmentDetails(updated);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleReroute = async (shipment: any) => {
    setBusyId(shipment.id);
    try {
      const routing = await resolveRouting(shipment.pickup_address || '', shipment.delivery_address || '', {
        relayFirstMileStrategy: shipment.relay_first_mile_strategy || 'customer_dropoff',
        relayLastMileStrategy: shipment.relay_last_mile_strategy || 'renax_delivery',
      });
      const shipmentType = routing.routing_mode === 'relay_terminal' ? 'inter_state' : 'intra_state';

      const { error } = await supabase.rpc('admin_reroute_shipment', {
        p_payload: {
          shipment_id: shipment.id,
          routing_mode: routing.routing_mode,
          dispatch_stage: routing.dispatch_stage,
          pickup_state: routing.pickup_state,
          pickup_city: routing.pickup_city,
          delivery_state: routing.delivery_state,
          delivery_city: routing.delivery_city,
          source_terminal_id: routing.source_terminal_id,
          destination_terminal_id: routing.destination_terminal_id,
          relay_first_mile_strategy: shipment.relay_first_mile_strategy || 'customer_dropoff',
          relay_last_mile_strategy: shipment.relay_last_mile_strategy || 'renax_delivery',
          shipment_type: shipmentType,
          reason: `Admin rerouted shipment. ${routing.reason}`,
        },
      });
      if (error) throw error;

      await loadShipments();
    } finally {
      setBusyId(null);
    }
  };

  const handleSetException = async (shipment: any, exceptionKey: string) => {
    const exc = EXCEPTION_TYPES.find(e => e.key === exceptionKey);
    if (!exc) return;
    setBusyId(shipment.id);
    setShowExceptionMenu(false);
    try {
      const { error } = await supabase.rpc('admin_update_shipment_stage', {
        p_payload: {
          shipment_id: shipment.id,
          target_stage: 'exception',
          location_name: locationNameForStage(shipment, 'exception'),
          reason: `[${exc.label}] ${exc.note}${overrideReason ? ` — ${overrideReason}` : ''}`,
          proofs: [
            {
              stage: 'exception',
              proof_type: 'manual_admin',
              notes: exc.note,
              confidence_score: 0.72,
              metadata: { exception_type: exc.key },
            },
          ],
        },
      });
      if (error) throw error;
      await loadShipments();
      if (selectedShipment?.id === shipment.id) await loadShipmentDetails(shipment);
    } finally {
      setBusyId(null);
    }
  };

  const handleForceSetStage = async (shipment: any, targetStage: string) => {
    const reason = overrideReason.trim() || `Admin manually moved shipment to ${stageLabel(targetStage)}.`;
    setBusyId(`stage:${shipment.id}:${targetStage}`);
    try {
      const { error } = await supabase.rpc('admin_update_shipment_stage', {
        p_payload: {
          shipment_id: shipment.id,
          target_stage: targetStage,
          location_name: locationNameForStage(shipment, targetStage),
          reason,
          proofs: [
            {
              stage: targetStage,
              proof_type: 'manual_admin',
              notes: reason,
              confidence_score: 0.75,
            },
          ],
        },
      });

      if (error) throw error;

      setOverrideReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelShipment = async (shipment: any) => {
    const reason = overrideReason.trim() || 'Admin cancelled shipment and released all active assignments.';
    setBusyId(`cancel:${shipment.id}`);
    try {
      const { error } = await supabase.rpc('admin_cancel_shipment', {
        p_payload: {
          shipment_id: shipment.id,
          reason,
        },
      });
      if (error) throw error;
      setOverrideReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignLocalRider = async (shipment: any, candidate: any) => {
    const actionKey = `assign-local:${candidate.rider_id}`;
    const reason = localRiderOpsReason.trim() || `Ops assigned ${candidate.rider_name || 'a rider'} to this shipment.`;

    setLocalRiderOpsBusy(actionKey);
    try {
      const { error } = await supabase.rpc('admin_assign_shipment_operator', {
        p_payload: {
          shipment_id: shipment.id,
          assignment_type: 'local_delivery',
          rider_id: candidate.rider_id,
          reason,
        },
      });
      if (error) throw error;
      setLocalRiderOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setLocalRiderOpsBusy(null);
    }
  };

  const handleUnassignLocalRider = async (shipment: any) => {
    if (!shipment.assigned_rider_id) return;

    const reason = localRiderOpsReason.trim() || 'Ops released the assigned rider and returned this shipment to the rider queue.';
    setLocalRiderOpsBusy('unassign-local');
    try {
      const { error } = await supabase.rpc('admin_unassign_shipment_operator', {
        p_payload: {
          shipment_id: shipment.id,
          assignment_type: 'local_delivery',
          reason,
        },
      });
      if (error) throw error;
      setLocalRiderOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setLocalRiderOpsBusy(null);
    }
  };

  const handlePrepareDeliverEarnShipment = async (shipment: any) => {
    const reason = deliverEarnOpsReason.trim() || 'Ops released this same-state shipment to verified Deliver & Earn car operators.';
    setDeliverEarnOpsBusy('prepare');
    try {
      const { error } = await supabase.rpc('admin_prepare_deliver_and_earn_shipment', {
        p_payload: {
          shipment_id: shipment.id,
          reason,
          create_offers: true,
          declared_value_ngn: shipment.declared_value_ngn || null,
          risk_tier: shipment.risk_tier || 'standard',
        },
      });
      if (error) throw error;

      setDeliverEarnOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setDeliverEarnOpsBusy(null);
    }
  };

  const handleReofferDeliverEarnShipment = async (shipment: any) => {
    const reason = deliverEarnOpsReason.trim() || 'Ops restarted Deliver & Earn offers for this shipment.';
    setDeliverEarnOpsBusy('reoffer');
    try {
      const { error } = await supabase.rpc('admin_reoffer_deliver_and_earn_job', {
        p_payload: {
          shipment_id: shipment.id,
          reason,
        },
      });
      if (error) throw error;

      setDeliverEarnOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setDeliverEarnOpsBusy(null);
    }
  };

  const handleReleaseDeliverEarnShipment = async (shipment: any) => {
    const reason = deliverEarnOpsReason.trim() || 'Ops released this shipment back to the standard RENAX rider queue.';
    setDeliverEarnOpsBusy('release-standard');
    try {
      const { error } = await supabase.rpc('admin_release_deliver_and_earn_shipment', {
        p_payload: {
          shipment_id: shipment.id,
          reason,
        },
      });
      if (error) throw error;

      setDeliverEarnOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setDeliverEarnOpsBusy(null);
    }
  };

  const reloadShipmentContext = async (shipmentId: string) => {
    await loadShipments();

    const { data: refreshedShipment } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .maybeSingle();

    if (refreshedShipment) {
      await loadShipmentDetails(refreshedShipment);
    }
  };

  const openShipmentFromWatchlist = async (watchlistItem: any) => {
    const existing = shipments.find((shipment) => shipment.id === watchlistItem.shipment_id);
    if (existing) {
      await loadShipmentDetails(existing);
      return;
    }

    const { data: shipment } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', watchlistItem.shipment_id)
      .maybeSingle();

    if (shipment) {
      await loadShipmentDetails(shipment);
    }
  };

  const handleDispatchHeartbeat = async () => {
    setDispatchOpsBusy('heartbeat');
    try {
      const { error } = await supabase.rpc('admin_process_first_mile_dispatch_backlog', {
        p_payload: { limit: 100 },
      });
      if (error) throw error;
      await loadShipments();
    } finally {
      setDispatchOpsBusy(null);
    }
  };

  const handleReofferWatchlistItem = async (watchlistItem: any) => {
    setDispatchOpsBusy(`reoffer:${watchlistItem.pickup_request_id}`);
    try {
      const { error } = await supabase.rpc('admin_offer_next_first_mile_pickup_candidate', {
        p_payload: {
          pickup_request_id: watchlistItem.pickup_request_id,
          force: false,
          reason: 'Ops manually restarted the dispatch ladder from the watchlist.',
        },
      });
      if (error) throw error;
      await loadShipments();
      if (selectedShipment?.id === watchlistItem.shipment_id) {
        await openShipmentFromWatchlist(watchlistItem);
      }
    } finally {
      setDispatchOpsBusy(null);
    }
  };

  const handleCreatePickupRequest = async (shipment: any) => {
    const reason = pickupOpsReason.trim() || 'Ops created/recovered the first-mile pickup queue record.';

    setPickupOpsBusy('create-pickup-request');
    try {
      const { error } = await supabase.rpc('create_first_mile_pickup_request', {
        p_payload: {
          shipment_id: shipment.id,
          priority: 'normal',
        },
      });
      if (error) throw error;

      try {
        await logShipmentEvent(
          shipment.id,
          shipment.dispatch_stage || 'awaiting_source_terminal',
          terminalMap[shipment.source_terminal_id]?.name || shipment.pickup_state,
          undefined,
          'admin',
          reason
        );
      } catch (eventError) {
        console.warn('Pickup request was created, but the supplemental audit note could not be saved.', eventError);
      }

      setPickupOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setPickupOpsBusy(null);
    }
  };

  const handleOfferNextPickupAgent = async (shipment: any, force = false) => {
    if (!pickupQueueRecord?.id) return;

    const actionKey = force ? 'force-next-offer' : 'offer-next';
    const reason = pickupOpsReason.trim() || (
      force
        ? 'Ops forced the next eligible pickup vehicle offer.'
        : 'Ops offered this pickup request to the next eligible vehicle.'
    );

    setPickupOpsBusy(actionKey);
    try {
      const { error } = await supabase.rpc('admin_offer_next_first_mile_pickup_candidate', {
        p_payload: {
          pickup_request_id: pickupQueueRecord.id,
          force,
          reason,
        },
      });
      if (error) throw error;

      setPickupOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setPickupOpsBusy(null);
    }
  };

  const handleRunPickupDispatchHeartbeat = async (shipment: any) => {
    setPickupOpsBusy('dispatch-heartbeat');
    try {
      const { error } = await supabase.rpc('admin_process_first_mile_dispatch_backlog', {
        p_payload: { limit: 100 },
      });
      if (error) throw error;

      await reloadShipmentContext(shipment.id);
    } finally {
      setPickupOpsBusy(null);
    }
  };

  const handleAssignPickupAgent = async (shipment: any, candidate: any) => {
    if (!pickupQueueRecord?.id) return;

    const actionKey = `assign:${candidate.pickup_agent_id}`;
    const reason = pickupOpsReason.trim() || `Ops assigned ${candidate.driver_name || candidate.vehicle_code || 'a pickup agent'} to this first-mile request.`;

    setPickupOpsBusy(actionKey);
    try {
      const { error } = await supabase.rpc('admin_assign_shipment_operator', {
        p_payload: {
          shipment_id: shipment.id,
          assignment_type: 'first_mile',
          pickup_request_id: pickupQueueRecord.id,
          pickup_agent_id: candidate.pickup_agent_id,
          reason,
        },
      });
      if (error) throw error;

      setPickupOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setPickupOpsBusy(null);
    }
  };

  const handleUnassignPickupAgent = async (shipment: any) => {
    if (!pickupQueueRecord?.id) return;

    const reason = pickupOpsReason.trim() || 'Ops released the current first-mile assignment and returned it to the queue.';

    setPickupOpsBusy('unassign');
    try {
      const { error } = await supabase.rpc('admin_unassign_shipment_operator', {
        p_payload: {
          shipment_id: shipment.id,
          assignment_type: 'first_mile',
          pickup_request_id: pickupQueueRecord.id,
          reason,
        },
      });
      if (error) throw error;

      setPickupOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setPickupOpsBusy(null);
    }
  };

  const handleReleaseFinalMileShipment = async (shipment: any) => {
    const reason = finalMileOpsReason.trim() || 'Destination terminal ops released this parcel into the RENAX final-mile queue.';
    setFinalMileOpsBusy('release');
    try {
      const { error } = await supabase.rpc('admin_update_shipment_stage', {
        p_payload: {
          shipment_id: shipment.id,
          target_stage: 'awaiting_final_mile_rider',
          location_name: terminalMap[shipment.destination_terminal_id]?.name || shipment.delivery_state || null,
          reason,
          proofs: [
            {
              stage: 'awaiting_final_mile_rider',
              proof_type: 'hub_release',
              notes: reason,
              confidence_score: 0.86,
            },
          ],
        },
      });
      if (error) throw error;

      setFinalMileOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setFinalMileOpsBusy(null);
    }
  };

  const handleAssignFinalMileRider = async (shipment: any, candidate: any) => {
    const actionKey = `assign-final-mile:${candidate.rider_id}`;
    const reason = finalMileOpsReason.trim() || `Ops assigned ${candidate.rider_name || 'a final-mile rider'} to complete destination delivery.`;

    setFinalMileOpsBusy(actionKey);
    try {
      const { error } = await supabase.rpc('admin_assign_shipment_operator', {
        p_payload: {
          shipment_id: shipment.id,
          assignment_type: 'final_mile',
          rider_id: candidate.rider_id,
          reason,
        },
      });
      if (error) throw error;

      setFinalMileOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setFinalMileOpsBusy(null);
    }
  };

  const handleUnassignFinalMileRider = async (shipment: any) => {
    const reason = finalMileOpsReason.trim() || 'Ops released the assigned final-mile rider and returned the parcel to the destination queue.';
    setFinalMileOpsBusy('unassign-final-mile');
    try {
      const { error } = await supabase.rpc('admin_unassign_shipment_operator', {
        p_payload: {
          shipment_id: shipment.id,
          assignment_type: 'final_mile',
          reason,
        },
      });
      if (error) throw error;

      setFinalMileOpsReason('');
      await reloadShipmentContext(shipment.id);
    } finally {
      setFinalMileOpsBusy(null);
    }
  };

  const canApplySuggestion = (shipment: any, suggestion: any) => (
    suggestion?.suggestion_status === 'pending' && (
      (shipment.dispatch_stage === 'awaiting_source_terminal' && suggestion.suggested_stage === 'received_at_source_terminal')
      || (shipment.dispatch_stage === 'linehaul_in_transit' && suggestion.suggested_stage === 'received_at_destination_terminal')
    )
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Shipment Dispatch</Text>
          <Text style={styles.subTitle}>Operate local deliveries, terminal relays, and manual-review shipments from one queue.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={loadShipments}>
          <RefreshCw color="#003822" size={16} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.dispatchBoard}>
        <View style={styles.dispatchBoardHeader}>
          <View>
            <Text style={styles.dispatchBoardTitle}>First-Mile Dispatch Watchlist</Text>
            <Text style={styles.dispatchBoardSub}>Supervise the private pickup ladder, restart offers when needed, and spot escalations before SLA drift spreads.</Text>
          </View>
          <Pressable style={styles.dispatchHeartbeatBtn} onPress={handleDispatchHeartbeat} disabled={dispatchOpsBusy === 'heartbeat'}>
            <RefreshCw color="#002B22" size={15} />
            <Text style={styles.dispatchHeartbeatText}>{dispatchOpsBusy === 'heartbeat' ? 'Running...' : 'Run Heartbeat'}</Text>
          </Pressable>
        </View>

        <View style={styles.dispatchStatsRow}>
          {[
            ['Live Offers', dispatchStats.liveOffers],
            ['Pending Ops', dispatchStats.pendingOps],
            ['Awaiting Candidate', dispatchStats.awaitingAssignment],
            ['Assigned', dispatchStats.assigned],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.dispatchStatCard}>
              <Text style={styles.dispatchStatLabel}>{String(label)}</Text>
              <Text style={styles.dispatchStatValue}>{String(value)}</Text>
            </View>
          ))}
        </View>

        {dispatchWatchlist.length === 0 ? (
          <Text style={styles.dispatchEmptyText}>No first-mile dispatch requests are active right now.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.dispatchCardRow}>
              {dispatchWatchlist.slice(0, 10).map((item) => {
                const canReoffer = !item.assigned_agent_id && Number(item.live_offer_count || 0) === 0;
                const isEscalated = item.escalation_status === 'pending_ops';
                const actionKey = `reoffer:${item.pickup_request_id}`;

                return (
                  <View key={item.pickup_request_id} style={[styles.dispatchCard, isEscalated && styles.dispatchCardEscalated]}>
                    <View style={styles.dispatchCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dispatchCardTracking}>{item.tracking_id || item.shipment_id}</Text>
                        <Text style={styles.dispatchCardRoute}>{item.pickup_state || 'Unknown'} {'->'} {item.pickup_city || 'Unknown pickup city'}</Text>
                      </View>
                      <View style={[styles.dispatchStatusPill, isEscalated ? styles.dispatchStatusPillAlert : styles.dispatchStatusPillNeutral]}>
                        <Text style={styles.dispatchStatusPillText}>
                          {String(item.orchestration_status || 'awaiting_assignment').replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.dispatchCardMeta}>
                      {item.source_terminal_code || 'No hub'} • attempts {item.auto_offer_attempt_count || 0} • best {item.best_attempt_score || 'N/A'}
                    </Text>
                    <Text style={styles.dispatchCardMeta}>
                      {Number(item.live_offer_count || 0) > 0
                        ? `Live offer expires ${item.current_offer_expires_at ? formatDate(item.current_offer_expires_at) : 'soon'}`
                        : `SLA ${item.assignment_sla_at ? formatDate(item.assignment_sla_at) : 'not set'}`}
                    </Text>
                    <Text style={styles.dispatchCardMeta}>
                      {item.assigned_vehicle_code
                        ? `Assigned ${item.assigned_vehicle_code} (${item.assigned_vehicle_type || 'vehicle'})`
                        : isEscalated
                          ? item.escalation_reason || 'Ops attention required.'
                          : 'No pickup agent assigned yet'}
                    </Text>

                    <View style={styles.dispatchCardActions}>
                      <Pressable style={styles.dispatchViewBtn} onPress={() => openShipmentFromWatchlist(item)}>
                        <Text style={styles.dispatchViewBtnText}>Open Shipment</Text>
                      </Pressable>
                      {canReoffer ? (
                        <Pressable
                          style={styles.dispatchReofferBtn}
                          onPress={() => handleReofferWatchlistItem(item)}
                          disabled={dispatchOpsBusy === actionKey}
                        >
                          <Text style={styles.dispatchReofferBtnText}>
                            {dispatchOpsBusy === actionKey ? 'Re-offering...' : 'Restart Ladder'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.dispatchBoard}>
        <View style={styles.dispatchBoardHeader}>
          <View>
            <Text style={styles.dispatchBoardTitle}>Final-Mile Dispatch Watchlist</Text>
            <Text style={styles.dispatchBoardSub}>Control destination-terminal release, assign live riders with terminal affinity, and keep last-hand-off work visible before it turns messy.</Text>
          </View>
        </View>

        <View style={styles.dispatchStatsRow}>
          {[
            ['Awaiting Release', finalMileDispatchStats.awaitingRelease],
            ['Open Queue', finalMileDispatchStats.openQueue],
            ['Out For Delivery', finalMileDispatchStats.outForDelivery],
            ['Candidate Ready', finalMileDispatchStats.candidateReady],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.dispatchStatCard}>
              <Text style={styles.dispatchStatLabel}>{String(label)}</Text>
              <Text style={styles.dispatchStatValue}>{String(value)}</Text>
            </View>
          ))}
        </View>

        {finalMileWatchlist.length === 0 ? (
          <Text style={styles.dispatchEmptyText}>No destination-terminal final-mile work is active right now.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.dispatchCardRow}>
              {finalMileWatchlist.slice(0, 10).map((item) => (
                <View key={item.shipment_id} style={[styles.dispatchCard, item.release_required && styles.dispatchCardEscalated]}>
                  <View style={styles.dispatchCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dispatchCardTracking}>{item.tracking_id || item.shipment_id}</Text>
                      <Text style={styles.dispatchCardRoute}>{item.destination_terminal_code || 'Hub'} {'->'} {item.delivery_city || item.delivery_state || 'Recipient area'}</Text>
                    </View>
                    <View style={[styles.dispatchStatusPill, item.release_required ? styles.dispatchStatusPillAlert : styles.dispatchStatusPillNeutral]}>
                      <Text style={styles.dispatchStatusPillText}>
                        {item.release_required ? 'Needs Release' : String(item.dispatch_stage || 'awaiting_final_mile_rider').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.dispatchCardMeta}>
                    {item.destination_terminal_name || 'Destination terminal'} • candidates {item.candidate_count || 0} • best {item.best_candidate_score || 'N/A'}
                  </Text>
                  <Text style={styles.dispatchCardMeta}>
                    {item.final_mile_rider_id
                      ? `Assigned ${item.assigned_rider_name || item.final_mile_rider_id}`
                      : item.release_required
                        ? 'Waiting for ops to release it into the final-mile queue.'
                        : 'No rider assigned yet'}
                  </Text>
                  <Text style={styles.dispatchCardMeta}>{item.delivery_address || 'No delivery address captured yet.'}</Text>

                  <View style={styles.dispatchCardActions}>
                    <Pressable style={styles.dispatchViewBtn} onPress={() => openShipmentFromWatchlist({ shipment_id: item.shipment_id })}>
                      <Text style={styles.dispatchViewBtnText}>Open Shipment</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.actionBar}>
        <View style={styles.searchBox}>
          <Route size={18} color="#6b7280" style={{ marginLeft: 12, marginRight: 8 }} />
          <TextInput
            placeholder="Search tracking ID, sender, recipient, or address..."
            style={styles.searchInput}
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersWrap}>
          {STAGE_FILTERS.map((filter) => {
            const active = statusFilter === filter;
            return (
              <Pressable
                key={filter}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(filter)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {filter === 'All' ? 'All Stages' : stageLabel(filter)}
                </Text>
                <ChevronDown size={12} color={active ? '#002B22' : '#6b7280'} />
              </Pressable>
            );
          })}
        </ScrollView>

        {terminalFilterId ? (
          <Pressable style={styles.activeFilterPill} onPress={() => setTerminalFilterId(null)}>
            <Text style={styles.activeFilterPillText}>
              Hub: {terminalMap[terminalFilterId]?.code || 'Selected terminal'} ×
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.tableContainer, glass]}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={BRAND.green} size="large" />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1620 }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { flex: 1.1 }]}>Shipment ID</Text>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Sender</Text>
                <Text style={[styles.colHeader, { flex: 1.6 }]}>Origin → Destination</Text>
                <Text style={[styles.colHeader, { flex: 1.0 }]}>Routing</Text>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Current Stage</Text>
                <Text style={[styles.colHeader, { flex: 1.1 }]}>Source Hub</Text>
                <Text style={[styles.colHeader, { flex: 1.1 }]}>Destination Hub</Text>
                <Text style={[styles.colHeader, { flex: 0.8 }]}>Progress</Text>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Created</Text>
                <Text style={[styles.colHeader, { flex: 1.8, textAlign: 'center' }]}>Actions</Text>
              </View>

              {filtered.map((item) => {
                const currentStage = item.dispatch_stage || 'pending_routing';
                const routingMode = item.routing_mode || 'last_mile_local';
                const currentStatus = shipmentStatusLabel(currentStage, routingMode);
                const progress = stageProgress(currentStage, routingMode);
                const color = stageColor(currentStage);

                return (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.cellText, styles.strongCell, { flex: 1.1 }]}>{item.tracking_id || item.id}</Text>
                    <Text style={[styles.cellText, { flex: 1.2 }]}>{item.sender_name || item.recipient_name || 'Unknown'}</Text>
                    <View style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.cellText}>{item.pickup_state || item.pickup_city || 'Unknown'}</Text>
                      <MoveRight size={14} color="#6b7280" style={{ marginHorizontal: 6 }} />
                      <Text style={styles.cellText}>{item.delivery_state || item.delivery_city || 'Unknown'}</Text>
                    </View>
                    <Text style={[styles.cellText, { flex: 1.0 }]}>
                      {item.supply_mode === 'deliver_and_earn'
                        ? 'Deliver & Earn'
                        : routingMode === 'relay_terminal'
                          ? 'Relay'
                          : routingMode === 'manual_review'
                            ? 'Review'
                            : 'Local'}
                    </Text>
                    <View style={{ flex: 1.2, gap: 6 }}>
                      <Text style={[styles.cellText, { color }]}>{getShipmentStageLabel(item)}</Text>
                      <Text style={styles.microText}>{currentStatus}</Text>
                    </View>
                    <Text style={[styles.cellText, { flex: 1.1 }]}>{terminalMap[item.source_terminal_id]?.code || 'N/A'}</Text>
                    <Text style={[styles.cellText, { flex: 1.1 }]}>{terminalMap[item.destination_terminal_id]?.code || 'N/A'}</Text>
                    <View style={{ flex: 0.8, paddingRight: 16 }}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                    <Text style={[styles.cellText, { flex: 1.2 }]}>{item.created_at ? formatDate(item.created_at) : 'N/A'}</Text>

                    <View style={styles.rowActions}>
                      <Pressable style={styles.actionBtnGray} onPress={() => loadShipmentDetails(item)}>
                        <FileText size={14} color="#111827" />
                        <Text style={styles.actionBtnTextGray}>Details</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnOutline} onPress={() => handleReroute(item)} disabled={busyId === item.id}>
                        <Text style={styles.actionBtnTextOutline}>{busyId === item.id ? 'Working...' : 'Reroute'}</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnLime} onPress={() => handleAdvance(item)} disabled={busyId === item.id}>
                        <Text style={styles.actionBtnTextLime}>{busyId === item.id ? 'Working...' : getAdvanceLabel(item)}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={!!selectedShipment} transparent animationType="fade" onRequestClose={() => setSelectedShipment(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Shipment Operations</Text>
                <Text style={styles.modalSub}>{selectedShipment?.tracking_id || selectedShipment?.id}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={() => setSelectedShipment(null)}>
                <X size={18} color="#111827" />
              </Pressable>
            </View>

            {selectedShipment && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailsGrid}>
                  {[
                    ['Routing', selectedShipment.routing_mode === 'relay_terminal' ? 'Terminal Relay' : selectedShipment.routing_mode === 'manual_review' ? 'Manual Review' : 'Local Delivery'],
                    ['Carrier Pool', selectedShipment.supply_mode === 'deliver_and_earn' ? 'Deliver & Earn verified car operators' : 'RENAX standard staff rider queue'],
                    ['Stage', getShipmentStageLabel(selectedShipment)],
                    ['Status', shipmentStatusLabel(selectedShipment.dispatch_stage || 'pending_routing', selectedShipment.routing_mode || 'last_mile_local')],
                    ['First Mile Plan', selectedShipment.relay_first_mile_strategy === 'renax_pickup' ? 'RENAX pickup to source terminal' : selectedShipment.routing_mode === 'relay_terminal' ? 'Customer drop-off to source terminal' : 'Direct rider dispatch'],
                    ['Destination Handoff', selectedShipment.relay_last_mile_strategy === 'recipient_pickup' ? 'Recipient pickup at destination terminal' : selectedShipment.routing_mode === 'relay_terminal' ? 'RENAX final-mile delivery from terminal' : 'Direct delivery'],
                    ['Source Hub', terminalMap[selectedShipment.source_terminal_id]?.name || 'N/A'],
                    ['Destination Hub', terminalMap[selectedShipment.destination_terminal_id]?.name || 'N/A'],
                    ['Pickup', selectedShipment.pickup_address || 'N/A'],
                    ['Destination', selectedShipment.delivery_address || 'N/A'],
                    ['Sender', selectedShipment.sender_name || 'Unknown'],
                    ['Recipient', selectedShipment.recipient_name || 'Unknown'],
                    ['Amount', selectedShipment.estimated_price ? `₦${Number(selectedShipment.estimated_price).toLocaleString()}` : 'N/A'],
                    ['Carrier Commission', selectedShipment.carrier_commission_amount ? `₦${Number(selectedShipment.carrier_commission_amount).toLocaleString()}` : selectedShipment.supply_mode === 'deliver_and_earn' ? 'Estimated after acceptance' : 'N/A'],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.detailCard}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.opsControlSection}>
                  <View style={styles.pickupOpsHeader}>
                    <View>
                      <Text style={styles.pickupOpsTitle}>Admin Control Center</Text>
                      <Text style={styles.pickupOpsSub}>Override shipment stage, cancel work, and recover stuck dispatch states from one place.</Text>
                    </View>
                    <View style={styles.opsStatusBadge}>
                      <Text style={styles.opsStatusBadgeText}>{shipmentStatusLabel(selectedShipment.dispatch_stage || 'pending_routing', selectedShipment.routing_mode || 'last_mile_local')}</Text>
                    </View>
                  </View>

                  <TextInput
                    style={styles.overrideInput}
                    placeholder="Operator note for the next admin action..."
                    placeholderTextColor="#9ca3af"
                    value={overrideReason}
                    onChangeText={setOverrideReason}
                    multiline
                  />

                  <View style={styles.opsStageGrid}>
                    {OPERATOR_STAGE_ACTIONS.map((action) => {
                      const active = selectedShipment.dispatch_stage === action.stage;
                      const actionKey = `stage:${selectedShipment.id}:${action.stage}`;
                      return (
                        <Pressable
                          key={action.stage}
                          style={[styles.opsStageBtn, active && styles.opsStageBtnActive]}
                          onPress={() => handleForceSetStage(selectedShipment, action.stage)}
                          disabled={active || busyId === actionKey}
                        >
                          <Text style={[styles.opsStageBtnText, active && styles.opsStageBtnTextActive]}>
                            {busyId === actionKey ? 'Saving...' : action.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.pickupOpsActionRow}>
                    <Pressable
                      style={styles.modalActionSecondary}
                      onPress={() => handleReroute(selectedShipment)}
                      disabled={busyId === selectedShipment.id}
                    >
                      <Text style={styles.modalActionSecondaryText}>Re-run Routing</Text>
                    </Pressable>
                    <Pressable
                      style={styles.pickupOpsReleaseBtn}
                      onPress={() => handleForceSetStage(selectedShipment, 'pending_routing')}
                      disabled={busyId === `stage:${selectedShipment.id}:pending_routing`}
                    >
                      <Text style={styles.pickupOpsReleaseText}>
                        {busyId === `stage:${selectedShipment.id}:pending_routing` ? 'Resetting...' : 'Reset To Routing'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.opsCancelBtn}
                      onPress={() => handleCancelShipment(selectedShipment)}
                      disabled={busyId === `cancel:${selectedShipment.id}`}
                    >
                      <Text style={styles.opsCancelText}>
                        {busyId === `cancel:${selectedShipment.id}` ? 'Cancelling...' : 'Cancel Shipment'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {isDeliverEarnCompatibleShipment(selectedShipment) && (
                  <View style={styles.pickupOpsSection}>
                    <View style={styles.pickupOpsHeader}>
                      <View>
                        <Text style={styles.pickupOpsTitle}>Deliver & Earn Dispatch</Text>
                        <Text style={styles.pickupOpsSub}>Release eligible same-state shipments to verified personal-car operators, restart offers, or return work to the standard RENAX rider queue.</Text>
                      </View>
                      {deliverEarnOpsLoading ? <ActivityIndicator color={BRAND.green} size="small" /> : null}
                    </View>

                    <View style={styles.pickupOpsSummaryRow}>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Pool</Text>
                        <Text style={styles.pickupOpsStatValue}>{selectedShipment.supply_mode === 'deliver_and_earn' ? 'Deliver & Earn' : 'Standard'}</Text>
                      </View>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Candidates</Text>
                        <Text style={styles.pickupOpsStatValue}>{deliverEarnCandidates.length}</Text>
                      </View>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Open Offers</Text>
                        <Text style={styles.pickupOpsStatValue}>{deliverEarnOffers.filter((offer) => offer.offer_status === 'offered').length}</Text>
                      </View>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Accepted</Text>
                        <Text style={styles.pickupOpsStatValue}>{selectedShipment.deliver_and_earn_operator_id ? 'Yes' : 'No'}</Text>
                      </View>
                    </View>

                    <View style={styles.pickupOpsAssignedCard}>
                      <Text style={styles.pickupOpsAssignedLabel}>Current Deliver & Earn Carrier</Text>
                      <Text style={styles.pickupOpsAssignedValue}>
                        {selectedShipment.deliver_and_earn_operator_id
                          ? `Operator ${selectedShipment.deliver_and_earn_operator_id}`
                          : selectedShipment.supply_mode === 'deliver_and_earn'
                            ? 'Waiting for a verified operator to accept'
                            : 'Not released to Deliver & Earn yet'}
                      </Text>
                      <Text style={styles.pickupOpsAssignedMeta}>
                        {selectedShipment.pickup_state || 'Unknown pickup'} {'->'} {selectedShipment.delivery_state || 'Unknown destination'} • {selectedShipment.weight_kg || 0}kg • {selectedShipment.package_category || 'No category'}
                      </Text>
                    </View>

                    <TextInput
                      style={styles.overrideInput}
                      placeholder="Deliver & Earn dispatch note, release reason, or re-offer context..."
                      placeholderTextColor="#9ca3af"
                      value={deliverEarnOpsReason}
                      onChangeText={setDeliverEarnOpsReason}
                      multiline
                    />

                    <View style={styles.pickupOpsActionRow}>
                      {selectedShipment.supply_mode !== 'deliver_and_earn' ? (
                        <Pressable
                          style={styles.pickupOpsPrimaryBtn}
                          onPress={() => handlePrepareDeliverEarnShipment(selectedShipment)}
                          disabled={deliverEarnOpsBusy === 'prepare'}
                        >
                          <Text style={styles.pickupOpsPrimaryText}>
                            {deliverEarnOpsBusy === 'prepare' ? 'Releasing...' : 'Release To Deliver & Earn'}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.pickupOpsPrimaryBtn}
                          onPress={() => handleReofferDeliverEarnShipment(selectedShipment)}
                          disabled={!!selectedShipment.deliver_and_earn_operator_id || deliverEarnOpsBusy === 'reoffer'}
                        >
                          <Text style={styles.pickupOpsPrimaryText}>
                            {deliverEarnOpsBusy === 'reoffer' ? 'Re-offering...' : 'Restart Operator Offers'}
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={styles.pickupOpsSecondaryBtn}
                        onPress={() => loadDeliverEarnOpsContext(selectedShipment)}
                        disabled={deliverEarnOpsLoading}
                      >
                        <Text style={styles.pickupOpsSecondaryText}>{deliverEarnOpsLoading ? 'Refreshing...' : 'Refresh Operators'}</Text>
                      </Pressable>

                      {selectedShipment.supply_mode === 'deliver_and_earn' && !selectedShipment.deliver_and_earn_operator_id ? (
                        <Pressable
                          style={styles.pickupOpsReleaseBtn}
                          onPress={() => handleReleaseDeliverEarnShipment(selectedShipment)}
                          disabled={deliverEarnOpsBusy === 'release-standard'}
                        >
                          <Text style={styles.pickupOpsReleaseText}>
                            {deliverEarnOpsBusy === 'release-standard' ? 'Releasing...' : 'Back To Staff Riders'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <Text style={styles.pickupOpsListTitle}>Eligible Operators</Text>
                    {deliverEarnCandidates.length === 0 ? (
                      <Text style={styles.timelineEmpty}>
                        {selectedShipment.supply_mode === 'deliver_and_earn'
                          ? 'No verified Deliver & Earn operator is currently online and eligible for this state/risk rule.'
                          : 'Release this shipment to Deliver & Earn to calculate live operator candidates.'}
                      </Text>
                    ) : (
                      <View style={styles.pickupCandidateList}>
                        {deliverEarnCandidates.map((candidate) => (
                          <View key={`${candidate.operator_id}:${candidate.vehicle_id}`} style={styles.pickupCandidateCard}>
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text style={styles.pickupCandidateTitle}>{candidate.operator_name || 'Verified operator'}</Text>
                              <Text style={styles.pickupCandidateMeta}>
                                {candidate.vehicle_label || 'Registered vehicle'} • Score {candidate.score ?? 'N/A'}
                              </Text>
                              <Text style={styles.pickupCandidateMeta}>
                                {candidate.state || 'Unknown state'} • {candidate.city || 'Unknown city'} • Seen {candidate.last_seen ? formatDate(candidate.last_seen) : 'recently'}
                              </Text>
                            </View>
                            <View style={styles.rulePill}>
                              <Text style={styles.rulePillText}>Eligible</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {deliverEarnOffers.length > 0 ? (
                      <>
                        <Text style={styles.pickupOpsListTitle}>Recent Offers</Text>
                        <View style={styles.pickupAttemptList}>
                          {deliverEarnOffers.slice(0, 6).map((offer) => (
                            <View key={offer.id} style={styles.pickupAttemptCard}>
                              <Text style={styles.pickupAttemptTitle}>
                                Offer {offer.offer_rank || 1} • {String(offer.offer_status || 'offered').replace(/_/g, ' ')}
                              </Text>
                              <Text style={styles.pickupAttemptMeta}>
                                Score {offer.score ?? 'N/A'} • expires {offer.expires_at ? formatDate(offer.expires_at) : 'soon'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                )}

                {isLocalRiderManagedShipment(selectedShipment) && (
                  <View style={styles.pickupOpsSection}>
                    <View style={styles.pickupOpsHeader}>
                      <View>
                        <Text style={styles.pickupOpsTitle}>Local Rider Assignment</Text>
                        <Text style={styles.pickupOpsSub}>Manually assign, transfer, or release same-state and manual-review shipments.</Text>
                      </View>
                      {localRiderOpsLoading ? <ActivityIndicator color={BRAND.green} size="small" /> : null}
                    </View>

                    <View style={styles.pickupOpsAssignedCard}>
                      <Text style={styles.pickupOpsAssignedLabel}>Current Rider</Text>
                      <Text style={styles.pickupOpsAssignedValue}>
                        {selectedShipment.assigned_rider_id
                          ? localRiderCandidates.find((candidate) => candidate.rider_id === selectedShipment.assigned_rider_id)?.rider_name || `Rider ${selectedShipment.assigned_rider_id}`
                          : 'No local rider assigned yet'}
                      </Text>
                      <Text style={styles.pickupOpsAssignedMeta}>
                        {selectedShipment.pickup_state || 'Unknown pickup'} {'->'} {selectedShipment.delivery_state || 'Unknown destination'}
                      </Text>
                    </View>

                    <TextInput
                      style={styles.overrideInput}
                      placeholder="Assignment note, transfer reason, or release context..."
                      placeholderTextColor="#9ca3af"
                      value={localRiderOpsReason}
                      onChangeText={setLocalRiderOpsReason}
                      multiline
                    />

                    <View style={styles.pickupOpsActionRow}>
                      <Pressable
                        style={styles.pickupOpsSecondaryBtn}
                        onPress={() => loadLocalRiderOpsContext(selectedShipment)}
                        disabled={localRiderOpsLoading}
                      >
                        <Text style={styles.pickupOpsSecondaryText}>{localRiderOpsLoading ? 'Refreshing...' : 'Refresh Riders'}</Text>
                      </Pressable>
                      {selectedShipment.assigned_rider_id ? (
                        <Pressable
                          style={styles.pickupOpsReleaseBtn}
                          onPress={() => handleUnassignLocalRider(selectedShipment)}
                          disabled={localRiderOpsBusy === 'unassign-local'}
                        >
                          <Text style={styles.pickupOpsReleaseText}>{localRiderOpsBusy === 'unassign-local' ? 'Releasing...' : 'Unassign Rider'}</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <Text style={styles.pickupOpsListTitle}>Available Riders</Text>
                    {localRiderCandidates.length === 0 ? (
                      <Text style={styles.timelineEmpty}>No available local riders match this shipment right now.</Text>
                    ) : (
                      <View style={styles.pickupCandidateList}>
                        {localRiderCandidates.map((candidate) => {
                          const isAssigned = selectedShipment.assigned_rider_id === candidate.rider_id;
                          const isTransfer = !!selectedShipment.assigned_rider_id && !isAssigned;
                          const actionKey = `assign-local:${candidate.rider_id}`;
                          return (
                            <View key={candidate.rider_id} style={styles.pickupCandidateCard}>
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text style={styles.pickupCandidateTitle}>{candidate.rider_name}</Text>
                                <Text style={styles.pickupCandidateMeta}>
                                  {candidate.vehicle_id} • {candidate.vehicle_type} • Score {candidate.score}
                                </Text>
                                <Text style={styles.pickupCandidateMeta}>
                                  {candidate.operating_state} • {candidate.operating_city} • {candidate.is_online ? 'online' : 'offline'}
                                </Text>
                                <Text style={styles.pickupCandidateMeta}>Phone: {candidate.rider_phone}</Text>
                              </View>
                              <Pressable
                                style={[styles.pickupCandidateAction, isAssigned && styles.pickupCandidateActionAssigned]}
                                onPress={() => handleAssignLocalRider(selectedShipment, candidate)}
                                disabled={isAssigned || localRiderOpsBusy === actionKey}
                              >
                                <Text style={[styles.pickupCandidateActionText, isAssigned && styles.pickupCandidateActionTextAssigned]}>
                                  {isAssigned ? 'Assigned' : localRiderOpsBusy === actionKey ? 'Working...' : isTransfer ? 'Transfer' : 'Assign'}
                                </Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {isManagedFinalMileShipment(selectedShipment) && (
                  <View style={styles.pickupOpsSection}>
                    <View style={styles.pickupOpsHeader}>
                      <View>
                        <Text style={styles.pickupOpsTitle}>Final-Mile Delivery Control</Text>
                        <Text style={styles.pickupOpsSub}>Release parcels from the destination terminal, assign the best live rider, and recover assignments cleanly when the handoff changes.</Text>
                      </View>
                      {finalMileOpsLoading ? <ActivityIndicator color={BRAND.green} size="small" /> : null}
                    </View>

                    <View style={styles.pickupOpsSummaryRow}>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Queue Stage</Text>
                        <Text style={styles.pickupOpsStatValue}>
                          {finalMileQueueRecord?.dispatch_stage
                            ? String(finalMileQueueRecord.dispatch_stage).replace(/_/g, ' ')
                            : String(selectedShipment.dispatch_stage || 'received_at_destination_terminal').replace(/_/g, ' ')}
                        </Text>
                      </View>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Destination Hub</Text>
                        <Text style={styles.pickupOpsStatValue}>{finalMileQueueRecord?.destination_terminal_code || terminalMap[selectedShipment.destination_terminal_id]?.code || 'N/A'}</Text>
                      </View>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Candidates</Text>
                        <Text style={styles.pickupOpsStatValue}>{finalMileQueueRecord?.candidate_count || finalMileCandidates.length || 0}</Text>
                      </View>
                      <View style={styles.pickupOpsStat}>
                        <Text style={styles.pickupOpsStatLabel}>Best Score</Text>
                        <Text style={styles.pickupOpsStatValue}>{finalMileQueueRecord?.best_candidate_score || (finalMileCandidates[0]?.score ?? 'N/A')}</Text>
                      </View>
                    </View>

                    <View style={styles.pickupOpsAssignedCard}>
                      <Text style={styles.pickupOpsAssignedLabel}>Current Assignment</Text>
                      <Text style={styles.pickupOpsAssignedValue}>
                        {finalMileQueueRecord?.assigned_rider_name
                          ? `${finalMileQueueRecord.assigned_rider_name}${finalMileQueueRecord.assigned_rider_phone ? ` • ${finalMileQueueRecord.assigned_rider_phone}` : ''}`
                          : selectedShipment.final_mile_rider_id
                            ? `Rider ${selectedShipment.final_mile_rider_id}`
                            : 'No final-mile rider assigned yet'}
                      </Text>
                      <Text style={styles.pickupOpsAssignedMeta}>
                        {terminalMap[selectedShipment.destination_terminal_id]?.name || 'Destination terminal'} • {selectedShipment.delivery_state || 'Unknown state'} • {selectedShipment.delivery_city || 'Unknown city'}
                      </Text>
                    </View>

                    <TextInput
                      style={styles.overrideInput}
                      placeholder="Release context, assignment note, or transfer reason..."
                      placeholderTextColor="#9ca3af"
                      value={finalMileOpsReason}
                      onChangeText={setFinalMileOpsReason}
                      multiline
                    />

                    {selectedShipment.dispatch_stage === 'received_at_destination_terminal' ? (
                      <View style={styles.pickupOpsActionRow}>
                        <Pressable
                          style={styles.pickupOpsReleaseBtn}
                          onPress={() => handleReleaseFinalMileShipment(selectedShipment)}
                          disabled={finalMileOpsBusy === 'release'}
                        >
                          <Text style={styles.pickupOpsReleaseText}>
                            {finalMileOpsBusy === 'release' ? 'Releasing...' : 'Release To Final-Mile Queue'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {selectedShipment.final_mile_rider_id ? (
                      <View style={styles.pickupOpsActionRow}>
                        <Pressable
                          style={styles.pickupOpsReleaseBtn}
                          onPress={() => handleUnassignFinalMileRider(selectedShipment)}
                          disabled={finalMileOpsBusy === 'unassign-final-mile'}
                        >
                          <Text style={styles.pickupOpsReleaseText}>
                            {finalMileOpsBusy === 'unassign-final-mile' ? 'Releasing...' : 'Unassign To Queue'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}

                    <Text style={styles.pickupOpsListTitle}>Recommended Final-Mile Riders</Text>
                    {finalMileCandidates.length === 0 ? (
                      <Text style={styles.timelineEmpty}>No live final-mile riders currently match this destination queue.</Text>
                    ) : (
                      <View style={styles.pickupCandidateList}>
                        {finalMileCandidates.map((candidate) => {
                          const isAssigned = selectedShipment.final_mile_rider_id === candidate.rider_id;
                          const isTransfer = !!selectedShipment.final_mile_rider_id && !isAssigned;
                          const actionKey = `assign-final-mile:${candidate.rider_id}`;

                          return (
                            <View key={candidate.rider_id} style={styles.pickupCandidateCard}>
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text style={styles.pickupCandidateTitle}>{candidate.rider_name || 'Eligible rider'}</Text>
                                <Text style={styles.pickupCandidateMeta}>
                                  {candidate.assigned_terminal_code || candidate.preferred_terminal_code || 'No hub code'} • Score {candidate.score ?? 'N/A'} • {candidate.is_online ? 'online' : 'offline'}
                                </Text>
                                <Text style={styles.pickupCandidateMeta}>
                                  {candidate.operating_state || 'Unknown state'} • {candidate.operating_city || 'Unknown city'} • {candidate.rider_role || 'rider'}
                                </Text>
                                {candidate.rider_phone ? (
                                  <Text style={styles.pickupCandidateMeta}>Phone: {candidate.rider_phone}</Text>
                                ) : null}
                              </View>
                              <Pressable
                                style={[
                                  styles.pickupCandidateAction,
                                  isAssigned && styles.pickupCandidateActionAssigned,
                                ]}
                                onPress={() => handleAssignFinalMileRider(selectedShipment, candidate)}
                                disabled={isAssigned || finalMileOpsBusy === actionKey}
                              >
                                <Text style={[styles.pickupCandidateActionText, isAssigned && styles.pickupCandidateActionTextAssigned]}>
                                  {isAssigned ? 'Assigned' : finalMileOpsBusy === actionKey ? 'Working...' : isTransfer ? 'Transfer' : 'Assign'}
                                </Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {isManagedFirstMileShipment(selectedShipment) && (
                  <View style={styles.pickupOpsSection}>
                    <View style={styles.pickupOpsHeader}>
                      <View>
                        <Text style={styles.pickupOpsTitle}>First-Mile Pickup Control</Text>
                        <Text style={styles.pickupOpsSub}>Assign from the dedicated pickup pool, transfer if a driver has issues, or release back to the queue.</Text>
                      </View>
                      {pickupOpsLoading ? <ActivityIndicator color={BRAND.green} size="small" /> : null}
                    </View>

                    {pickupQueueRecord ? (
                      <>
                        <View style={styles.pickupOpsSummaryRow}>
                          <View style={styles.pickupOpsStat}>
                            <Text style={styles.pickupOpsStatLabel}>Queue Status</Text>
                            <Text style={styles.pickupOpsStatValue}>{String(pickupQueueRecord.orchestration_status || 'awaiting_assignment').replace(/_/g, ' ')}</Text>
                          </View>
                          <View style={styles.pickupOpsStat}>
                            <Text style={styles.pickupOpsStatLabel}>Priority</Text>
                            <Text style={styles.pickupOpsStatValue}>{pickupQueueRecord.priority || 'normal'}</Text>
                          </View>
                          <View style={styles.pickupOpsStat}>
                            <Text style={styles.pickupOpsStatLabel}>Attempts</Text>
                            <Text style={styles.pickupOpsStatValue}>{pickupQueueRecord.assignment_attempt_count || 0}</Text>
                          </View>
                          <View style={styles.pickupOpsStat}>
                            <Text style={styles.pickupOpsStatLabel}>Best Score</Text>
                            <Text style={styles.pickupOpsStatValue}>{pickupQueueRecord.best_attempt_score || 'N/A'}</Text>
                          </View>
                        </View>

                        <View style={styles.pickupOpsAssignedCard}>
                          <Text style={styles.pickupOpsAssignedLabel}>Current Assignment</Text>
                          <Text style={styles.pickupOpsAssignedValue}>
                            {pickupQueueRecord.assigned_vehicle_code
                              ? `${pickupQueueRecord.assigned_vehicle_code} • ${pickupQueueRecord.assigned_vehicle_type || 'Vehicle assigned'}`
                              : 'No pickup agent assigned yet'}
                          </Text>
                          <Text style={styles.pickupOpsAssignedMeta}>
                            {pickupQueueRecord.pickup_state || 'Unknown state'} • {pickupQueueRecord.source_terminal_code || 'No hub'} • SLA {pickupQueueRecord.assignment_sla_at ? formatDate(pickupQueueRecord.assignment_sla_at) : 'not set'}
                          </Text>
                        </View>

                        <TextInput
                          style={styles.overrideInput}
                          placeholder="Assignment note, issue reason, or transfer context..."
                          placeholderTextColor="#9ca3af"
                          value={pickupOpsReason}
                          onChangeText={setPickupOpsReason}
                          multiline
                        />

                        <View style={styles.pickupOpsActionRow}>
                          <Pressable
                            style={styles.pickupOpsPrimaryBtn}
                            onPress={() => handleOfferNextPickupAgent(selectedShipment, false)}
                            disabled={!!pickupQueueRecord.assigned_agent_id || pickupOpsBusy === 'offer-next'}
                          >
                            <Text style={styles.pickupOpsPrimaryText}>
                              {pickupOpsBusy === 'offer-next' ? 'Offering...' : 'Offer Next Vehicle'}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.pickupOpsSecondaryBtn}
                            onPress={() => handleOfferNextPickupAgent(selectedShipment, true)}
                            disabled={!!pickupQueueRecord.assigned_agent_id || pickupOpsBusy === 'force-next-offer'}
                          >
                            <Text style={styles.pickupOpsSecondaryText}>
                              {pickupOpsBusy === 'force-next-offer' ? 'Restarting...' : 'Force Restart Ladder'}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.pickupOpsSecondaryBtn}
                            onPress={() => loadPickupOpsContext(selectedShipment)}
                            disabled={pickupOpsLoading}
                          >
                            <Text style={styles.pickupOpsSecondaryText}>
                              {pickupOpsLoading ? 'Refreshing...' : 'Refresh Vehicles'}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.pickupOpsSecondaryBtn}
                            onPress={() => handleRunPickupDispatchHeartbeat(selectedShipment)}
                            disabled={pickupOpsBusy === 'dispatch-heartbeat'}
                          >
                            <Text style={styles.pickupOpsSecondaryText}>
                              {pickupOpsBusy === 'dispatch-heartbeat' ? 'Running...' : 'Run Dispatch Heartbeat'}
                            </Text>
                          </Pressable>
                        </View>

                        {pickupQueueRecord.assigned_agent_id ? (
                          <View style={styles.pickupOpsActionRow}>
                            <Pressable
                              style={styles.pickupOpsReleaseBtn}
                              onPress={() => handleUnassignPickupAgent(selectedShipment)}
                              disabled={pickupOpsBusy === 'unassign'}
                            >
                              <Text style={styles.pickupOpsReleaseText}>{pickupOpsBusy === 'unassign' ? 'Releasing...' : 'Unassign To Queue'}</Text>
                            </Pressable>
                          </View>
                        ) : null}

                        <Text style={styles.pickupOpsListTitle}>Recommended Pickup Agents</Text>
                        {pickupCandidates.length === 0 ? (
                          <Text style={styles.timelineEmpty}>No active pickup candidates matched this request yet.</Text>
                        ) : (
                          <View style={styles.pickupCandidateList}>
                            {pickupCandidates.map((candidate) => {
                              const isAssigned = pickupQueueRecord.assigned_agent_id === candidate.pickup_agent_id;
                              const isTransfer = !!pickupQueueRecord.assigned_agent_id && !isAssigned;
                              const actionKey = `assign:${candidate.pickup_agent_id}`;

                              return (
                                <View key={candidate.pickup_agent_id} style={styles.pickupCandidateCard}>
                                  <View style={{ flex: 1, gap: 4 }}>
                                    <Text style={styles.pickupCandidateTitle}>
                                      {candidate.driver_name || candidate.vehicle_code || 'Pickup agent'}
                                    </Text>
                                    <Text style={styles.pickupCandidateMeta}>
                                      {candidate.vehicle_code || 'No vehicle code'} • {candidate.vehicle_type || 'Vehicle type N/A'} • Score {candidate.score ?? 'N/A'}
                                    </Text>
                                    <Text style={styles.pickupCandidateMeta}>
                                      {candidate.home_state || 'Unknown state'} • {candidate.home_terminal_code || 'No terminal'} • {candidate.availability_status || 'unknown'}
                                    </Text>
                                    {candidate.driver_phone ? (
                                      <Text style={styles.pickupCandidateMeta}>Phone: {candidate.driver_phone}</Text>
                                    ) : null}
                                  </View>
                                  <Pressable
                                    style={[
                                      styles.pickupCandidateAction,
                                      isAssigned && styles.pickupCandidateActionAssigned,
                                    ]}
                                    onPress={() => handleAssignPickupAgent(selectedShipment, candidate)}
                                    disabled={isAssigned || pickupOpsBusy === actionKey}
                                  >
                                    <Text style={[styles.pickupCandidateActionText, isAssigned && styles.pickupCandidateActionTextAssigned]}>
                                      {isAssigned ? 'Assigned' : pickupOpsBusy === actionKey ? 'Working...' : isTransfer ? 'Transfer Vehicle' : 'Assign Vehicle'}
                                    </Text>
                                  </Pressable>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        <Text style={styles.pickupOpsListTitle}>Assignment History</Text>
                        {pickupAttempts.length === 0 ? (
                          <Text style={styles.timelineEmpty}>No assignment attempts have been logged for this request yet.</Text>
                        ) : (
                          <View style={styles.pickupAttemptList}>
                            {pickupAttempts.map((attempt) => (
                              <View key={attempt.id} style={styles.pickupAttemptCard}>
                                <Text style={styles.pickupAttemptTitle}>
                                  Attempt {attempt.attempt_order} • {attempt.agent?.driver_name || attempt.agent?.vehicle_code || 'Pickup agent'}
                                </Text>
                                <Text style={styles.pickupAttemptMeta}>
                                  {attempt.attempt_status} • {attempt.agent?.vehicle_code || 'No vehicle code'} • {attempt.offered_at ? formatDate(attempt.offered_at) : formatDate(attempt.created_at)}
                                </Text>
                                {attempt.offer_reason ? <Text style={styles.pickupAttemptNotes}>{attempt.offer_reason}</Text> : null}
                                {attempt.response_notes ? <Text style={styles.pickupAttemptNotes}>{attempt.response_notes}</Text> : null}
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.pickupOpsEmptyCard}>
                        <Text style={styles.timelineEmpty}>This managed pickup shipment does not have a queue record yet.</Text>
                        <Pressable
                          style={styles.pickupOpsPrimaryBtn}
                          onPress={() => handleCreatePickupRequest(selectedShipment)}
                          disabled={pickupOpsBusy === 'create-pickup-request'}
                        >
                          <Text style={styles.pickupOpsPrimaryText}>
                            {pickupOpsBusy === 'create-pickup-request' ? 'Creating...' : 'Create Pickup Queue'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.modalActions}>
                  {/* Override reason input */}
                  {showOverrideInput ? (
                    <View style={{ width: '100%', marginBottom: 12 }}>
                      <TextInput
                        style={styles.overrideInput}
                        placeholder="Enter reason for this admin action..."
                        placeholderTextColor="#9ca3af"
                        value={overrideReason}
                        onChangeText={setOverrideReason}
                        multiline
                      />
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <Pressable style={styles.modalActionPrimary} onPress={() => handleAdvance(selectedShipment)} disabled={busyId === selectedShipment.id}>
                          <Text style={styles.modalActionPrimaryText}>{busyId === selectedShipment.id ? 'Working...' : `Confirm: ${getAdvanceLabel(selectedShipment)}`}</Text>
                        </Pressable>
                        <Pressable style={styles.modalActionSecondary} onPress={() => setShowOverrideInput(false)}>
                          <Text style={styles.modalActionSecondaryText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable style={styles.modalActionPrimary} onPress={() => setShowOverrideInput(true)} disabled={busyId === selectedShipment.id}>
                      <Text style={styles.modalActionPrimaryText}>{busyId === selectedShipment.id ? 'Working...' : getAdvanceLabel(selectedShipment)}</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.modalActionSecondary} onPress={() => handleReroute(selectedShipment)} disabled={busyId === selectedShipment.id}>
                    <Text style={styles.modalActionSecondaryText}>Re-run Routing</Text>
                  </Pressable>
                  {/* Exception workflow menu */}
                  <Pressable style={styles.modalActionDanger} onPress={() => setShowExceptionMenu(v => !v)} disabled={busyId === selectedShipment.id}>
                    <AlertTriangle size={15} color="#fff" />
                    <Text style={styles.modalActionDangerText}>Exception ▾</Text>
                  </Pressable>
                  {/* Hub scan toggle */}
                  <Pressable style={[styles.modalActionSecondary, { borderColor: '#3B82F6' }]} onPress={() => setShowHubScan(v => !v)}>
                    <ScanLine size={15} color="#3B82F6" />
                    <Text style={[styles.modalActionSecondaryText, { color: '#3B82F6' }]}>Hub Scan</Text>
                  </Pressable>
                </View>

                {/* Exception type menu */}
                {showExceptionMenu && (
                  <View style={styles.exceptionMenu}>
                    <Text style={styles.exceptionMenuTitle}>Select Exception Type</Text>
                    <TextInput
                      style={[styles.overrideInput, { marginBottom: 10 }]}
                      placeholder="Optional: describe what happened..."
                      placeholderTextColor="#9ca3af"
                      value={overrideReason}
                      onChangeText={setOverrideReason}
                    />
                    {EXCEPTION_TYPES.map(exc => (
                      <Pressable key={exc.key} style={[styles.exceptionTypeBtn, { borderColor: exc.color + '55' }]} onPress={() => handleSetException(selectedShipment, exc.key)} disabled={busyId === selectedShipment.id}>
                        <View style={[styles.exceptionTypeDot, { backgroundColor: exc.color }]} />
                        <Text style={[styles.exceptionTypeText, { color: exc.color }]}>{exc.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Hub scan panel */}
                {showHubScan && (
                  <View style={styles.hubScanPanel}>
                    <Text style={styles.hubScanTitle}>Terminal Hub Scan</Text>
                    <Text style={styles.hubScanSub}>Scan or type the parcel QR / barcode value to log a hub check-in event.</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TextInput
                        style={[styles.overrideInput, { flex: 1 }]}
                        placeholder="Paste QR / barcode value..."
                        placeholderTextColor="#9ca3af"
                        value={hubScanValue}
                        onChangeText={setHubScanValue}
                      />
                      <Pressable
                        style={[styles.modalActionPrimary, { alignSelf: 'flex-start' }]}
                        onPress={async () => {
                          if (!hubScanValue.trim() || !selectedShipment) return;
                          try {
                            await logShipmentEvent(selectedShipment.id, selectedShipment.dispatch_stage || 'exception', undefined, undefined, 'admin', `Hub scan recorded: ${hubScanValue.trim()}`);
                          } catch (eventError) {
                            console.warn('Unable to save hub scan audit event.', eventError);
                          }
                          setHubScanValue('');
                          await loadShipmentDetails(selectedShipment);
                        }}
                      >
                        <Text style={styles.modalActionPrimaryText}>Log Scan</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Suggestion filter tabs */}
                <View style={styles.suggestionFilterRow}>
                  {(['all','pending','accepted','dismissed','low'] as const).map(f => (
                    <Pressable key={f} style={[styles.suggFilterChip, suggestionFilter === f && styles.suggFilterChipActive]} onPress={() => setSuggestionFilter(f)}>
                      <Text style={[styles.suggFilterText, suggestionFilter === f && { color: '#002B22' }]}>
                        {f === 'low' ? 'Low Confidence' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.timelineTitle}>Smart Suggestions</Text>
                {(() => {
                  const filtered = stageSuggestions.filter(s => {
                    if (suggestionFilter === 'all') return true;
                    if (suggestionFilter === 'low') return Number(s.confidence_score || 0) < 0.7;
                    return s.suggestion_status === suggestionFilter;
                  });
                  if (filtered.length === 0) return <Text style={styles.timelineEmpty}>No suggestions match this filter.</Text>;
                  return (
                    <View style={styles.suggestionsWrap}>
                      {filtered.map((suggestion) => {
                        const actionable = canApplySuggestion(selectedShipment, suggestion);
                        const isPending = suggestion.suggestion_status === 'pending';
                        const statusTone = suggestion.suggestion_status === 'accepted'
                          ? styles.suggestionAccepted
                          : suggestion.suggestion_status === 'dismissed'
                            ? styles.suggestionDismissed
                            : styles.suggestionPending;
                        return (
                          <View key={suggestion.id} style={styles.suggestionCard}>
                            <View style={styles.suggestionHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.suggestionTitle}>{suggestion.title || stageLabel(suggestion.suggested_stage || 'pending_routing')}</Text>
                                <Text style={styles.suggestionMeta}>
                                  {stageLabel(suggestion.suggested_stage || 'pending_routing')} • {(Number(suggestion.confidence_score || 0) * 100).toFixed(0)}% confidence
                                  {Number(suggestion.confidence_score || 0) < 0.7 ? ' ⚠️ Low' : ''}
                                </Text>
                              </View>
                              <View style={[styles.suggestionBadge, statusTone]}>
                                <Text style={styles.suggestionBadgeText}>{String(suggestion.suggestion_status || 'pending').replace('_', ' ')}</Text>
                              </View>
                            </View>
                            <Text style={styles.suggestionBody}>{suggestion.message || 'Smart location signal recorded for review.'}</Text>
                            <Text style={styles.suggestionMeta}>Source: {suggestion.source || 'system'}{suggestion.metadata?.terminal_code ? ` • Terminal ${suggestion.metadata.terminal_code}` : ''}</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                              {actionable && (
                                <Pressable style={styles.suggestionAction} onPress={() => handleApplySuggestion(selectedShipment, suggestion)} disabled={busyId === selectedShipment.id}>
                                  <CheckCircle size={13} color="#fff" />
                                  <Text style={styles.suggestionActionText}>{busyId === selectedShipment.id ? 'Applying...' : 'Accept'}</Text>
                                </Pressable>
                              )}
                              {isPending && (
                                <Pressable style={styles.suggestionDismissBtn} onPress={() => handleDismissSuggestion(suggestion)}>
                                  <XCircle size={13} color="#6B7280" />
                                  <Text style={styles.suggestionDismissBtnText}>Dismiss</Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}

                <Text style={styles.timelineTitle}>Proof History</Text>
                {proofRecords.length === 0 ? (
                  <Text style={styles.timelineEmpty}>No stage proofs have been submitted for this shipment.</Text>
                ) : (
                  <View style={styles.suggestionsWrap}>
                    {proofRecords.map((proof, i) => (
                      <View key={proof.id || i} style={[styles.suggestionCard, { backgroundColor: '#f0fdf4' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <View style={[styles.exceptionTypeDot, { backgroundColor: stageColor(proof.stage || 'pending_routing') }]} />
                          <Text style={styles.suggestionTitle}>{stageProofLabel(proof.proof_type)} — {stageLabel(proof.stage || 'pending_routing')}</Text>
                          {proof.media_url && (
                            <Pressable onPress={() => setProofViewerUrl(proof.media_url)} style={styles.proofPhotoBtn}>
                              <ImageIcon size={14} color="#047857" />
                              <Text style={styles.proofPhotoBtnText}>View Photo</Text>
                            </Pressable>
                          )}
                        </View>
                        <Text style={styles.suggestionMeta}>
                          {(proof.verified_by_role || 'system').replace(/_/g,' ')} • {(Number(proof.confidence_score || 0)*100).toFixed(0)}% • {formatDate(proof.created_at)}
                        </Text>
                        {proof.notes ? <Text style={[styles.suggestionBody, { marginTop: 4 }]}>{proof.notes}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.timelineTitle}>Shipment Timeline</Text>
                {timelineEvents.length === 0 ? (
                  <Text style={styles.timelineEmpty}>No shipment events have been recorded yet.</Text>
                ) : (
                  timelineEvents.map((event) => (
                    <View key={event.id} style={styles.timelineRow}>
                      <View style={[styles.timelineDot, { backgroundColor: stageColor(event.stage || 'pending_routing') }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineEvent}>{stageLabel(event.stage || 'pending_routing')}</Text>
                        <Text style={styles.timelineNote}>{event.notes || event.location_name || 'Workflow event recorded.'}</Text>
                        <Text style={styles.timelineDate}>{formatDate(event.created_at)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Proof photo viewer */}
      <Modal visible={!!proofViewerUrl} transparent animationType="fade" onRequestClose={() => setProofViewerUrl(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setProofViewerUrl(null)}>
          {Platform.OS === 'web' && proofViewerUrl ? (
            React.createElement('img', { src: proofViewerUrl, style: { maxWidth: '90%', maxHeight: '88vh', borderRadius: 12, objectFit: 'contain' } })
          ) : null}
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 16 }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  subTitle: { fontSize: 15, color: '#4b5563', maxWidth: 760 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  refreshBtnText: { fontSize: 13, fontWeight: '700', color: '#003822' },
  dispatchBoard: { backgroundColor: '#F8FAFC', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 18, marginBottom: 20, gap: 14 },
  dispatchBoardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  dispatchBoardTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  dispatchBoardSub: { fontSize: 13, color: '#475569', maxWidth: 720, lineHeight: 20 },
  dispatchHeartbeatBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BRAND.lime, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  dispatchHeartbeatText: { color: '#002B22', fontSize: 12, fontWeight: '800' },
  dispatchStatsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  dispatchStatCard: { minWidth: 140, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10 },
  dispatchStatLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  dispatchStatValue: { fontSize: 16, color: '#0F172A', fontWeight: '800' },
  dispatchEmptyText: { fontSize: 14, color: '#64748B' },
  dispatchCardRow: { flexDirection: 'row', gap: 12, paddingRight: 12 },
  dispatchCard: { width: 320, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 8 },
  dispatchCardEscalated: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  dispatchCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  dispatchCardTracking: { fontSize: 15, fontWeight: '800', color: '#111827' },
  dispatchCardRoute: { fontSize: 12, color: '#64748B', marginTop: 4 },
  dispatchStatusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  dispatchStatusPillNeutral: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  dispatchStatusPillAlert: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  dispatchStatusPillText: { fontSize: 11, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  dispatchCardMeta: { fontSize: 12, color: '#475569', lineHeight: 18 },
  dispatchCardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  dispatchViewBtn: { backgroundColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  dispatchViewBtnText: { color: '#111827', fontSize: 12, fontWeight: '800' },
  dispatchReofferBtn: { backgroundColor: BRAND.green, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  dispatchReofferBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  actionBar: { gap: 12, marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, height: 44, width: '100%', maxWidth: 420 },
  searchInput: { flex: 1, height: '100%', color: '#1a1a1a', fontSize: 13, outlineStyle: 'none' as any },
  filtersWrap: { gap: 10, paddingRight: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  filterChipActive: { backgroundColor: BRAND.lime, borderColor: BRAND.lime },
  filterChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  filterChipTextActive: { color: '#002B22' },
  activeFilterPill: { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  activeFilterPillText: { color: '#047857', fontSize: 12, fontWeight: '800' },
  tableContainer: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, flex: 1, elevation: 2, minHeight: 500 },
  centerState: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)', paddingBottom: 16, marginBottom: 10 },
  colHeader: { fontWeight: '700', fontSize: 13, color: '#1a1a1a' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)' },
  cellText: { fontSize: 14, color: '#1a1a1a' },
  strongCell: { fontWeight: '700', color: '#003822' },
  microText: { fontSize: 11, color: '#6b7280' },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  rowActions: { flex: 1.8, flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  actionBtnGray: { backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignItems: 'center', flexDirection: 'row', gap: 6 },
  actionBtnTextGray: { color: '#111827', fontWeight: '700', fontSize: 12 },
  actionBtnOutline: { borderWidth: 1, borderColor: BRAND.green, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  actionBtnTextOutline: { color: BRAND.green, fontWeight: '700', fontSize: 12 },
  actionBtnLime: { backgroundColor: BRAND.lime, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  actionBtnTextLime: { color: '#1a1a1a', fontWeight: '700', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 920, maxHeight: '88%', backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
  detailCard: { width: '48%', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  detailLabel: { fontSize: 11, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  opsControlSection: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, padding: 18, marginBottom: 20, gap: 14 },
  opsStatusBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  opsStatusBadgeText: { color: '#92400E', fontSize: 11, fontWeight: '800' },
  opsStageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  opsStageBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  opsStageBtnActive: { backgroundColor: BRAND.lime, borderColor: BRAND.lime },
  opsStageBtnText: { color: '#92400E', fontSize: 12, fontWeight: '800' },
  opsStageBtnTextActive: { color: '#002B22' },
  opsCancelBtn: { alignSelf: 'flex-start', backgroundColor: '#DC2626', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  opsCancelText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  pickupOpsSection: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 18, marginBottom: 20, gap: 14 },
  pickupOpsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  pickupOpsTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  pickupOpsSub: { fontSize: 13, color: '#475569', marginTop: 4, maxWidth: 620 },
  pickupOpsSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickupOpsStat: { minWidth: 120, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  pickupOpsStatLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  pickupOpsStatValue: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  pickupOpsAssignedCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#DCFCE7', borderRadius: 12, padding: 14, gap: 4 },
  pickupOpsAssignedLabel: { fontSize: 11, color: '#047857', fontWeight: '700', textTransform: 'uppercase' },
  pickupOpsAssignedValue: { fontSize: 15, color: '#111827', fontWeight: '700' },
  pickupOpsAssignedMeta: { fontSize: 12, color: '#64748B' },
  pickupOpsActionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pickupOpsPrimaryBtn: { alignSelf: 'flex-start', backgroundColor: BRAND.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pickupOpsPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  pickupOpsSecondaryBtn: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: BRAND.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pickupOpsSecondaryText: { color: BRAND.green, fontWeight: '800', fontSize: 12 },
  pickupOpsReleaseBtn: { alignSelf: 'flex-start', backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FDA4AF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pickupOpsReleaseText: { color: '#BE123C', fontWeight: '800', fontSize: 12 },
  pickupOpsListTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  pickupOpsEmptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, gap: 12, alignItems: 'flex-start' },
  pickupCandidateList: { gap: 10 },
  pickupCandidateCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14 },
  pickupCandidateTitle: { fontSize: 14, color: '#111827', fontWeight: '700' },
  pickupCandidateMeta: { fontSize: 12, color: '#64748B' },
  pickupCandidateAction: { backgroundColor: BRAND.lime, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pickupCandidateActionAssigned: { backgroundColor: '#DCFCE7' },
  pickupCandidateActionText: { color: '#1a1a1a', fontWeight: '800', fontSize: 12 },
  pickupCandidateActionTextAssigned: { color: '#166534' },
  rulePill: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#A7F3D0' },
  rulePillText: { color: '#047857', fontSize: 11, fontWeight: '900' },
  pickupAttemptList: { gap: 10 },
  pickupAttemptCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, gap: 4 },
  pickupAttemptTitle: { fontSize: 13, color: '#111827', fontWeight: '700' },
  pickupAttemptMeta: { fontSize: 12, color: '#64748B' },
  pickupAttemptNotes: { fontSize: 12, color: '#334155', lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  modalActionPrimary: { backgroundColor: BRAND.lime, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  modalActionPrimaryText: { color: '#1a1a1a', fontWeight: '800', fontSize: 13 },
  modalActionSecondary: { borderWidth: 1, borderColor: BRAND.green, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  modalActionSecondaryText: { color: BRAND.green, fontWeight: '800', fontSize: 13 },
  modalActionDanger: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DC2626', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  modalActionDangerText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  timelineTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 14 },
  timelineEmpty: { fontSize: 14, color: '#6b7280' },
  suggestionsWrap: { gap: 12, marginBottom: 24 },
  suggestionCard: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, backgroundColor: '#FAFAF7', padding: 16 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  suggestionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  suggestionBody: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 8 },
  suggestionMeta: { fontSize: 12, color: '#6B7280' },
  suggestionBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  suggestionPending: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  suggestionAccepted: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  suggestionDismissed: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  suggestionBadgeText: { fontSize: 11, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  suggestionAction: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: BRAND.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  suggestionActionText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  suggestionDismissBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  suggestionDismissBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 12 },
  // Suggestion filter
  suggestionFilterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  suggFilterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  suggFilterChipActive: { backgroundColor: BRAND.lime, borderColor: BRAND.lime },
  suggFilterText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  // Override input
  overrideInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 13, color: '#111827', outlineStyle: 'none' as any, width: '100%' },
  // Exception menu
  exceptionMenu: { backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', padding: 16, marginBottom: 20, gap: 8 },
  exceptionMenuTitle: { fontSize: 14, fontWeight: '800', color: '#991B1B', marginBottom: 8 },
  exceptionTypeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  exceptionTypeDot: { width: 10, height: 10, borderRadius: 5 },
  exceptionTypeText: { fontWeight: '700', fontSize: 13 },
  // Hub scan
  hubScanPanel: { backgroundColor: '#EFF6FF', borderRadius: 14, borderWidth: 1, borderColor: '#BFDBFE', padding: 16, marginBottom: 20 },
  hubScanTitle: { fontSize: 14, fontWeight: '800', color: '#1E40AF', marginBottom: 4 },
  hubScanSub: { fontSize: 13, color: '#3B82F6', lineHeight: 20 },
  // Proof photo viewer button
  proofPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#A7F3D0' },
  proofPhotoBtnText: { fontSize: 12, fontWeight: '700', color: '#047857' },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  timelineEvent: { fontSize: 14, fontWeight: '700', color: '#111827' },
  timelineNote: { fontSize: 13, color: '#4b5563', marginTop: 3, lineHeight: 20 },
  timelineDate: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
