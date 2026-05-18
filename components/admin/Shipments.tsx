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
  shipmentStatusFromStage,
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

const getAdvanceLabel = (shipment: any) => {
  const stage = shipment.dispatch_stage || 'pending_routing';
  const routing = shipment.routing_mode || 'last_mile_local';
  const isManagedFirstMile =
    routing === 'relay_terminal' &&
    shipment?.relay_first_mile_strategy === 'renax_pickup' &&
    stage === 'awaiting_source_terminal' &&
    !shipment?.first_mile_pickup_agent_id;

  if (isManagedFirstMile) {
    return 'Manage Pickup';
  }

  const labels: Record<string, string> = {
    pending_routing: 'Release To Queue',
    awaiting_rider_acceptance: routing === 'relay_terminal' ? 'Assign First Mile' : 'Release Delivery',
    awaiting_source_terminal_dropoff: 'Receive Customer Drop-Off',
    awaiting_source_terminal: 'Check In Source Hub',
    received_at_source_terminal: 'Dispatch Linehaul',
    linehaul_in_transit: 'Receive At Destination Hub',
    received_at_destination_terminal: 'Release Final Mile',
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

export default function Shipments() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [searchQuery, setSearchQuery] = useState('');
  const [shipments, setShipments] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [stageSuggestions, setStageSuggestions] = useState<any[]>([]);
  const [proofRecords, setProofRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
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

  const terminalMap = useMemo(
    () => Object.fromEntries(terminals.map((terminal) => [terminal.id, terminal])),
    [terminals]
  );

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: shipmentData }, { data: terminalData }] = await Promise.all([
        supabase.from('shipments').select('*').order('created_at', { ascending: false }),
        supabase.from('terminals').select('*').order('state'),
      ]);
      setShipments(shipmentData || []);
      setTerminals(terminalData || []);
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
    return queryMatch && statusMatch;
  }), [shipments, searchQuery, statusFilter]);

  const isManagedFirstMileShipment = (shipment: any) =>
    shipment?.routing_mode === 'relay_terminal' && shipment?.relay_first_mile_strategy === 'renax_pickup';

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
    setShowOverrideInput(false);
    setShowExceptionMenu(false);
    setShowHubScan(false);
    await loadPickupOpsContext(shipment);
  };

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
    if (isManagedFirstMileShipment(shipment) && shipment.dispatch_stage === 'awaiting_source_terminal' && !shipment.first_mile_pickup_agent_id) {
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
                          ? 'awaiting_final_mile_rider'
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
      });
      const shipmentType = routing.routing_mode === 'relay_terminal' ? 'inter_state' : 'intra_state';

      await supabase
        .from('shipments')
        .update({
          routing_mode: routing.routing_mode,
          dispatch_stage: routing.dispatch_stage,
          status: shipmentStatusFromStage(routing.dispatch_stage, routing.routing_mode),
          pickup_state: routing.pickup_state,
          pickup_city: routing.pickup_city,
          delivery_state: routing.delivery_state,
          delivery_city: routing.delivery_city,
          source_terminal_id: routing.source_terminal_id,
          destination_terminal_id: routing.destination_terminal_id,
          shipment_type: shipmentType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      await logShipmentEvent(
        shipment.id,
        routing.dispatch_stage,
        routing.source_terminal_id ? terminalMap[routing.source_terminal_id]?.name : routing.pickup_state,
        undefined,
        'admin',
        `Admin rerouted shipment. ${routing.reason}`
      );

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
      await supabase
        .from('shipments')
        .update({ dispatch_stage: 'exception', status: 'exception', updated_at: new Date().toISOString() })
        .eq('id', shipment.id);
      await logShipmentEvent(
        shipment.id, 'exception', undefined, undefined, 'admin',
        `[${exc.label}] ${exc.note}${overrideReason ? ` — ${overrideReason}` : ''}`,
      );
      await loadShipments();
      if (selectedShipment?.id === shipment.id) await loadShipmentDetails(shipment);
    } finally {
      setBusyId(null);
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

  const handleAssignPickupAgent = async (shipment: any, candidate: any) => {
    if (!pickupQueueRecord?.id) return;

    const actionKey = `assign:${candidate.pickup_agent_id}`;
    const reason = pickupOpsReason.trim() || `Ops assigned ${candidate.driver_name || candidate.vehicle_code || 'a pickup agent'} to this first-mile request.`;

    setPickupOpsBusy(actionKey);
    try {
      if (pickupQueueRecord.assigned_agent_id && pickupQueueRecord.assigned_agent_id !== candidate.pickup_agent_id) {
        const { error } = await supabase.rpc('transfer_first_mile_pickup_agent', {
          p_payload: {
            pickup_request_id: pickupQueueRecord.id,
            pickup_agent_id: candidate.pickup_agent_id,
            reason,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('assign_first_mile_pickup_agent', {
          p_payload: {
            pickup_request_id: pickupQueueRecord.id,
            pickup_agent_id: candidate.pickup_agent_id,
            offer_reason: reason,
          },
        });
        if (error) throw error;
      }

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
      const { error } = await supabase.rpc('unassign_first_mile_pickup_agent', {
        p_payload: {
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
                    <Text style={[styles.cellText, { flex: 1.0 }]}>{routingMode === 'relay_terminal' ? 'Relay' : routingMode === 'manual_review' ? 'Review' : 'Local'}</Text>
                    <View style={{ flex: 1.2, gap: 6 }}>
                      <Text style={[styles.cellText, { color }]}>{stageLabel(currentStage)}</Text>
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
                    ['Stage', stageLabel(selectedShipment.dispatch_stage || 'pending_routing')],
                    ['Status', shipmentStatusLabel(selectedShipment.dispatch_stage || 'pending_routing', selectedShipment.routing_mode || 'last_mile_local')],
                    ['Source Hub', terminalMap[selectedShipment.source_terminal_id]?.name || 'N/A'],
                    ['Destination Hub', terminalMap[selectedShipment.destination_terminal_id]?.name || 'N/A'],
                    ['Pickup', selectedShipment.pickup_address || 'N/A'],
                    ['Destination', selectedShipment.delivery_address || 'N/A'],
                    ['Sender', selectedShipment.sender_name || 'Unknown'],
                    ['Recipient', selectedShipment.recipient_name || 'Unknown'],
                    ['Amount', selectedShipment.estimated_price ? `₦${Number(selectedShipment.estimated_price).toLocaleString()}` : 'N/A'],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.detailCard}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>

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
                                      {isAssigned ? 'Assigned' : pickupOpsBusy === actionKey ? 'Working...' : isTransfer ? 'Transfer' : 'Assign'}
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
                      <Text style={styles.timelineEmpty}>This managed pickup shipment does not have a queue record yet.</Text>
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
                          await logShipmentEvent(selectedShipment.id, selectedShipment.dispatch_stage || 'exception', undefined, undefined, 'admin', `Hub scan recorded: ${hubScanValue.trim()}`);
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
  actionBar: { gap: 12, marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, height: 44, width: '100%', maxWidth: 420 },
  searchInput: { flex: 1, height: '100%', color: '#1a1a1a', fontSize: 13, outlineStyle: 'none' as any },
  filtersWrap: { gap: 10, paddingRight: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  filterChipActive: { backgroundColor: BRAND.lime, borderColor: BRAND.lime },
  filterChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  filterChipTextActive: { color: '#002B22' },
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
  pickupOpsReleaseBtn: { alignSelf: 'flex-start', backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FDA4AF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pickupOpsReleaseText: { color: '#BE123C', fontWeight: '800', fontSize: 12 },
  pickupOpsListTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  pickupCandidateList: { gap: 10 },
  pickupCandidateCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14 },
  pickupCandidateTitle: { fontSize: 14, color: '#111827', fontWeight: '700' },
  pickupCandidateMeta: { fontSize: 12, color: '#64748B' },
  pickupCandidateAction: { backgroundColor: BRAND.lime, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pickupCandidateActionAssigned: { backgroundColor: '#DCFCE7' },
  pickupCandidateActionText: { color: '#1a1a1a', fontWeight: '800', fontSize: 12 },
  pickupCandidateActionTextAssigned: { color: '#166534' },
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
