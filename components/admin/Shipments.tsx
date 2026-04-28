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
import { AlertTriangle, ChevronDown, FileText, MoveRight, RefreshCw, Route, X } from 'lucide-react-native';
import { supabase } from '../../supabase';
import {
  advanceShipmentStage,
  logShipmentEvent,
  resolveRouting,
  shipmentStatusFromStage,
  stageColor,
  stageLabel,
  stageProgress,
} from '../../utils/routingService';

const STAGE_FILTERS = [
  'All',
  'pending_routing',
  'awaiting_rider_acceptance',
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
  const labels: Record<string, string> = {
    pending_routing: 'Release To Queue',
    awaiting_rider_acceptance: routing === 'relay_terminal' ? 'Assign First Mile' : 'Release Delivery',
    awaiting_source_terminal: 'Check In Source Hub',
    received_at_source_terminal: 'Dispatch Linehaul',
    linehaul_in_transit: 'Receive At Destination Hub',
    received_at_destination_terminal: 'Release Final Mile',
    awaiting_final_mile_rider: 'Mark Out For Delivery',
    out_for_delivery: 'Mark Delivered',
  };
  return labels[stage] || 'Advance';
};

export default function Shipments() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [searchQuery, setSearchQuery] = useState('');
  const [shipments, setShipments] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const loadShipmentDetails = async (shipment: any) => {
    setSelectedShipment(shipment);
    const { data } = await supabase
      .from('shipment_events')
      .select('*')
      .eq('shipment_id', shipment.id)
      .order('created_at', { ascending: true });
    setTimelineEvents(data || []);
  };

  const handleAdvance = async (shipment: any) => {
    setBusyId(shipment.id);
    try {
      await advanceShipmentStage(
        shipment.id,
        shipment.dispatch_stage || 'pending_routing',
        shipment.routing_mode || 'last_mile_local',
        undefined,
        'admin'
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
      const routing = await resolveRouting(shipment.pickup_address || '', shipment.delivery_address || '');
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

  const handleSetException = async (shipment: any) => {
    setBusyId(shipment.id);
    try {
      await supabase
        .from('shipments')
        .update({
          dispatch_stage: 'exception',
          status: 'Exception',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipment.id);
      await logShipmentEvent(shipment.id, 'exception', undefined, undefined, 'admin', 'Admin flagged shipment for exception handling.');
      await loadShipments();
    } finally {
      setBusyId(null);
    }
  };

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
                const currentStatus = shipmentStatusFromStage(currentStage, routingMode);
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
                    ['Status', shipmentStatusFromStage(selectedShipment.dispatch_stage || 'pending_routing', selectedShipment.routing_mode || 'last_mile_local')],
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

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalActionPrimary}
                    onPress={() => handleAdvance(selectedShipment)}
                    disabled={busyId === selectedShipment.id}
                  >
                    <Text style={styles.modalActionPrimaryText}>{busyId === selectedShipment.id ? 'Working...' : getAdvanceLabel(selectedShipment)}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalActionSecondary}
                    onPress={() => handleReroute(selectedShipment)}
                    disabled={busyId === selectedShipment.id}
                  >
                    <Text style={styles.modalActionSecondaryText}>Re-run Routing</Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalActionDanger}
                    onPress={() => handleSetException(selectedShipment)}
                    disabled={busyId === selectedShipment.id}
                  >
                    <AlertTriangle size={15} color="#fff" />
                    <Text style={styles.modalActionDangerText}>Mark Exception</Text>
                  </Pressable>
                </View>

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
  modalActions: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  modalActionPrimary: { backgroundColor: BRAND.lime, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  modalActionPrimaryText: { color: '#1a1a1a', fontWeight: '800', fontSize: 13 },
  modalActionSecondary: { borderWidth: 1, borderColor: BRAND.green, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  modalActionSecondaryText: { color: BRAND.green, fontWeight: '800', fontSize: 13 },
  modalActionDanger: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DC2626', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  modalActionDangerText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  timelineTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 14 },
  timelineEmpty: { fontSize: 14, color: '#6b7280' },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  timelineEvent: { fontSize: 14, fontWeight: '700', color: '#111827' },
  timelineNote: { fontSize: 13, color: '#4b5563', marginTop: 3, lineHeight: 20 },
  timelineDate: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
