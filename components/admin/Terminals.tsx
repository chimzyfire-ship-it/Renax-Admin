import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MapPin, RefreshCw, Warehouse } from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';
import { supabase } from '../../supabase';
import { advanceShipmentStage, stageColor, stageLabel } from '../../utils/routingService';

export default function Terminals() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [terminals, setTerminals] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: terminalData }, { data: shipmentData }] = await Promise.all([
        supabase.from('terminals').select('*').order('state'),
        supabase.from('shipments').select('*').eq('routing_mode', 'relay_terminal').order('created_at', { ascending: false }),
      ]);
      setTerminals(terminalData || []);
      setShipments(shipmentData || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const terminalQueues = useMemo(() => terminals.map((terminal) => {
    const sourceIncoming = shipments.filter((shipment) => shipment.source_terminal_id === terminal.id && shipment.dispatch_stage === 'awaiting_source_terminal');
    const sourceReady = shipments.filter((shipment) => shipment.source_terminal_id === terminal.id && shipment.dispatch_stage === 'received_at_source_terminal');
    const destinationIncoming = shipments.filter((shipment) => shipment.destination_terminal_id === terminal.id && shipment.dispatch_stage === 'received_at_destination_terminal');
    const finalMileQueue = shipments.filter((shipment) => shipment.destination_terminal_id === terminal.id && shipment.dispatch_stage === 'awaiting_final_mile_rider');
    const linehaul = shipments.filter((shipment) => (shipment.source_terminal_id === terminal.id || shipment.destination_terminal_id === terminal.id) && shipment.dispatch_stage === 'linehaul_in_transit');

    return {
      terminal,
      sourceIncoming,
      sourceReady,
      destinationIncoming,
      finalMileQueue,
      linehaul,
    };
  }), [terminals, shipments]);

  const runAdvance = async (shipment: any) => {
    setBusyId(shipment.id);
    try {
      await advanceShipmentStage(
        shipment.id,
        shipment.dispatch_stage || 'pending_routing',
        shipment.routing_mode || 'relay_terminal',
        undefined,
        'admin',
        {
          locationName: shipment.dispatch_stage === 'awaiting_source_terminal'
            ? terminals.find((terminal) => terminal.id === shipment.source_terminal_id)?.name
            : terminals.find((terminal) => terminal.id === shipment.destination_terminal_id)?.name,
          notes: shipment.dispatch_stage === 'awaiting_source_terminal'
            ? 'Terminal staff checked parcel into the source hub queue.'
            : shipment.dispatch_stage === 'received_at_source_terminal'
              ? 'Terminal staff released parcel onto linehaul.'
              : shipment.dispatch_stage === 'linehaul_in_transit'
                ? 'Terminal staff confirmed arrival at destination hub.'
                : 'Terminal team advanced the relay milestone.',
          proofs: [
            {
              stage: shipment.dispatch_stage === 'awaiting_source_terminal'
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
              proof_type: shipment.dispatch_stage === 'received_at_source_terminal' || shipment.dispatch_stage === 'received_at_destination_terminal'
                ? 'hub_release'
                : 'hub_check_in',
              notes: 'Terminal-admin confirmation recorded from dispatch console.',
              confidence_score: 0.8,
            },
          ],
        }
      );
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Terminals</Text>
          <Text style={styles.subTitle}>Operate source-hub intake, linehaul release, destination-hub arrival, and final-mile queues from one place.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <RefreshCw color="#003822" size={16} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND.green} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {terminalQueues.map(({ terminal, sourceIncoming, sourceReady, destinationIncoming, finalMileQueue, linehaul }) => (
            <View key={terminal.id} style={[styles.card, glass]}>
              <View style={styles.cardHead}>
                <View style={styles.iconWrap}>
                  <Warehouse size={18} color={BRAND.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{terminal.name}</Text>
                  <Text style={styles.cardCode}>{terminal.code} • {terminal.status}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <MapPin size={15} color={BRAND.green} />
                <Text style={styles.metaText}>{terminal.city}, {terminal.state}</Text>
              </View>
              <Text style={styles.address}>{terminal.address || 'No address provided'}</Text>

              <View style={styles.queueStats}>
                {[
                  ['Intake', sourceIncoming.length],
                  ['Ready Linehaul', sourceReady.length],
                  ['In Linehaul', linehaul.length],
                  ['Arrival', destinationIncoming.length],
                  ['Final Mile', finalMileQueue.length],
                ].map(([label, value]) => (
                  <View key={String(label)} style={styles.statPill}>
                    <Text style={styles.statValue}>{String(value)}</Text>
                    <Text style={styles.statLabel}>{String(label)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Source Terminal Queue</Text>
                {[...sourceIncoming, ...sourceReady].slice(0, 4).map((shipment) => (
                  <View key={shipment.id} style={styles.queueRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.queueTracking}>{shipment.tracking_id || shipment.id}</Text>
                      <Text style={styles.queueRoute}>{shipment.pickup_state} → {shipment.delivery_state}</Text>
                      <Text style={[styles.queueStage, { color: stageColor(shipment.dispatch_stage || 'pending_routing') }]}>
                        {stageLabel(shipment.dispatch_stage || 'pending_routing')}
                      </Text>
                    </View>
                    <Pressable style={styles.queueActionBtn} onPress={() => runAdvance(shipment)} disabled={busyId === shipment.id}>
                      <Text style={styles.queueActionText}>{busyId === shipment.id ? '...' : shipment.dispatch_stage === 'awaiting_source_terminal' ? 'Check In' : 'Dispatch'}</Text>
                    </Pressable>
                  </View>
                ))}
                {sourceIncoming.length + sourceReady.length === 0 && <Text style={styles.emptyText}>No source-hub work pending.</Text>}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Destination Terminal Queue</Text>
                {[...destinationIncoming, ...finalMileQueue].slice(0, 4).map((shipment) => (
                  <View key={shipment.id} style={styles.queueRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.queueTracking}>{shipment.tracking_id || shipment.id}</Text>
                      <Text style={styles.queueRoute}>{shipment.pickup_state} → {shipment.delivery_state}</Text>
                      <Text style={[styles.queueStage, { color: stageColor(shipment.dispatch_stage || 'pending_routing') }]}>
                        {stageLabel(shipment.dispatch_stage || 'pending_routing')}
                      </Text>
                    </View>
                    <Pressable style={styles.queueActionBtn} onPress={() => runAdvance(shipment)} disabled={busyId === shipment.id}>
                      <Text style={styles.queueActionText}>
                        {busyId === shipment.id ? '...' : shipment.dispatch_stage === 'received_at_destination_terminal' ? 'Release Rider' : 'Open Queue'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
                {destinationIncoming.length + finalMileQueue.length === 0 && <Text style={styles.emptyText}>No destination-hub work pending.</Text>}
              </View>

              <View style={styles.footerRow}>
                <View>
                  <Text style={styles.footerLabel}>Capacity</Text>
                  <Text style={styles.footerValue}>{terminal.capacity || 0}</Text>
                </View>
                <View>
                  <Text style={styles.footerLabel}>Manager</Text>
                  <Text style={styles.footerValue}>{terminal.manager_name || 'Unassigned'}</Text>
                </View>
                <View>
                  <Text style={styles.footerLabel}>Live Status</Text>
                  <Text style={styles.footerValue}>{linehaul.length ? `${linehaul.length} moving` : 'Stable'}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  subTitle: { fontSize: 15, color: '#4b5563', maxWidth: 760 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  refreshBtnText: { fontSize: 13, fontWeight: '700', color: '#003822' },
  centerState: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  card: { width: '48%', minWidth: 360, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  cardHead: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  cardCode: { fontSize: 12, fontWeight: '600', color: BRAND.green, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  metaText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  address: { fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 18 },
  queueStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  statPill: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minWidth: 86 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#003822' },
  statLabel: { fontSize: 11, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  section: { marginBottom: 18, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 10, textTransform: 'uppercase' },
  queueRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  queueTracking: { fontSize: 14, fontWeight: '700', color: '#003822' },
  queueRoute: { fontSize: 12, color: '#4B5563', marginTop: 3 },
  queueStage: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  queueActionBtn: { backgroundColor: BRAND.lime, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  queueActionText: { fontSize: 12, fontWeight: '800', color: '#002B22' },
  emptyText: { fontSize: 13, color: '#9CA3AF', paddingVertical: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 },
  footerLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  footerValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '700' },
});
