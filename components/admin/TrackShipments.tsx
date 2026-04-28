import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BRAND } from '../../constants/Theme';
import { MapPin, Search, Truck, Warehouse } from 'lucide-react-native';
import { supabase } from '../../supabase';
import { shipmentStatusFromStage, stageColor, stageLabel, stageProgress } from '../../utils/routingService';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function TrackShipments() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [searchQuery, setSearchQuery] = useState('');
  const [shipmentData, setShipmentData] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleTrackShipment = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a tracking ID');
      return;
    }

    setIsLoading(true);
    try {
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('tracking_id', searchQuery.trim())
        .single();

      if (shipmentError || !shipment) {
        alert('Shipment not found');
        setShipmentData(null);
        setTimelineEvents([]);
        setTerminals([]);
        return;
      }

      setShipmentData(shipment);

      const terminalQuery = shipment.source_terminal_id || shipment.destination_terminal_id
        ? supabase.from('terminals').select('*').in('id', [shipment.source_terminal_id, shipment.destination_terminal_id].filter(Boolean))
        : Promise.resolve({ data: [] as any[] });

      const [{ data: events }, { data: terminalData }] = await Promise.all([
        supabase.from('shipment_events').select('*').eq('shipment_id', shipment.id).order('created_at', { ascending: true }),
        terminalQuery,
      ]);

      setTimelineEvents(events || []);
      setTerminals(terminalData || []);
    } catch (err) {
      console.error('Error tracking shipment:', err);
      alert('Failed to fetch shipment');
    } finally {
      setIsLoading(false);
    }
  };

  const stage = shipmentData?.dispatch_stage || 'pending_routing';
  const routingMode = shipmentData?.routing_mode || 'last_mile_local';
  const currentStatus = shipmentData ? shipmentStatusFromStage(stage, routingMode) : 'Pending Routing';
  const progress = shipmentData ? stageProgress(stage, routingMode) : 0;
  const currentColor = stageColor(stage);
  const sourceTerminal = terminals.find((terminal) => terminal.id === shipmentData?.source_terminal_id);
  const destinationTerminal = terminals.find((terminal) => terminal.id === shipmentData?.destination_terminal_id);

  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 24 }}>
        <Text style={styles.pageTitle}>Shipment Tracking {shipmentData ? `(${shipmentData.tracking_id})` : ''}</Text>
        <Text style={styles.subTitle}>
          {shipmentData
            ? `Operational view for ${shipmentData.pickup_state || 'Unknown'} → ${shipmentData.delivery_state || 'Unknown'}`
            : 'Track any shipment ID and review routing, progress, hubs, and workflow events.'}
        </Text>

        <View style={styles.searchBar}>
          <Search color="#004d3d" size={18} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Enter Order ID..."
            placeholderTextColor="#aaa"
          />
          <Pressable style={styles.searchBtn} onPress={handleTrackShipment} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#002B22" size="small" /> : <Text style={styles.searchBtnText}>Track</Text>}
          </Pressable>
        </View>
      </View>

      {!shipmentData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Enter a tracking ID to inspect a shipment.</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            {[
              ['Status', currentStatus],
              ['Dispatch Stage', stageLabel(stage)],
              ['Routing', routingMode === 'relay_terminal' ? 'Terminal Relay' : routingMode === 'manual_review' ? 'Manual Review' : 'Local Delivery'],
              ['Progress', `${progress}%`],
            ].map(([label, value]) => (
              <View key={label} style={[styles.statCard, styles.greenCard, glass]}>
                <Text style={styles.statLabelWhite}>{label}</Text>
                <Text style={[styles.statValueWhite, label === 'Status' && { color: currentColor }]}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: currentColor }]} />
          </View>

          <View style={styles.lowerLayout}>
            <View style={[styles.timelineSection, glass]}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              {timelineEvents.length === 0 ? (
                <Text style={styles.emptyText}>No timeline events recorded yet.</Text>
              ) : (
                timelineEvents.map((event) => (
                  <View key={event.id} style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: stageColor(event.stage || 'pending_routing') }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineTitle}>{stageLabel(event.stage || 'pending_routing')}</Text>
                      <Text style={styles.timelineText}>{event.notes || event.location_name || 'Workflow event recorded.'}</Text>
                      <Text style={styles.timelineDate}>{formatDate(event.created_at)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={[styles.detailsSection, glass]}>
              <Text style={styles.sectionTitle}>Shipment Details</Text>
              <View style={styles.detailsGrid}>
                {[
                  ['Order ID', shipmentData.tracking_id || 'N/A'],
                  ['Sent From', shipmentData.pickup_address || 'N/A'],
                  ['Deliver To', shipmentData.delivery_address || 'N/A'],
                  ['Recipient', shipmentData.recipient_name || 'N/A'],
                  ['Source Hub', sourceTerminal?.name || 'N/A'],
                  ['Destination Hub', destinationTerminal?.name || 'N/A'],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailsBox}>
                    <Text style={styles.detailTitle}>{label}</Text>
                    <Text style={styles.detailValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.hubCard}>
                <Warehouse size={18} color={BRAND.green} />
                <Text style={styles.hubCardText}>
                  {routingMode === 'relay_terminal'
                    ? `${sourceTerminal?.code || 'SRC'} -> ${destinationTerminal?.code || 'DST'} relay path`
                    : routingMode === 'manual_review'
                      ? 'Manual dispatch review required'
                      : 'Direct local rider delivery'}
                </Text>
              </View>

              <View style={styles.locationCard}>
                <MapPin size={16} color={BRAND.green} />
                <Text style={styles.locationCardText}>
                  {`${shipmentData.pickup_state || 'Unknown'} -> ${shipmentData.delivery_state || 'Unknown'}`}
                </Text>
              </View>

              <View style={[styles.statusPill, { borderColor: `${currentColor}44`, backgroundColor: `${currentColor}12` }]}>
                <Truck size={14} color={currentColor} />
                <Text style={[styles.statusPillText, { color: currentColor }]}>{currentStatus}</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  subTitle: { fontSize: 16, color: '#4A5568', marginBottom: 24, fontWeight: '500' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#333', outlineStyle: 'none' as any },
  searchBtn: { backgroundColor: '#004d3d', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { color: '#666', fontSize: 15 },
  statsContainer: { flexDirection: 'row', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 200, borderRadius: 12, padding: 20, elevation: 3 },
  greenCard: { backgroundColor: 'rgba(0, 56, 34, 0.95)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statLabelWhite: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginBottom: 8 },
  statValueWhite: { color: BRAND.white, fontSize: 22, fontWeight: '800' },
  progressBarBg: { height: 8, width: '100%', backgroundColor: '#E5E7EB', borderRadius: 999, marginBottom: 24 },
  progressBarFill: { height: '100%', borderRadius: 999 },
  lowerLayout: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  timelineSection: { flex: 1.1, minWidth: 340, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24 },
  detailsSection: { flex: 0.9, minWidth: 320, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 18 },
  timelineItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  timelineText: { fontSize: 13, color: '#4B5563', marginTop: 4, lineHeight: 20 },
  timelineDate: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  detailsGrid: { gap: 12, marginBottom: 18 },
  detailsBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  detailTitle: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  hubCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, marginBottom: 12 },
  hubCardText: { flex: 1, fontSize: 13, color: '#003822', fontWeight: '600' },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginBottom: 12 },
  locationCardText: { flex: 1, fontSize: 13, color: '#1D4ED8', fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 13, fontWeight: '700' },
});
