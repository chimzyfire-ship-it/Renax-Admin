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
import {
  AlertTriangle,
  CheckCircle,
  Package,
  Search,
  Thermometer,
  Truck,
  Warehouse,
  X,
} from 'lucide-react-native';
import { supabase } from '../../supabase';
import { fetchAgroData } from '../../utils/adminData';
import { stageColor, stageLabel } from '../../utils/routingService';

/* ─── Helpers ─────────────────────────────────────────── */
const PRODUCE_LABELS: Record<string, string> = {
  grains_cereals:       'Grains & Cereals',
  tubers_roots:         'Tubers & Roots',
  vegetables_leafy:     'Leafy Vegetables',
  vegetables_fruiting:  'Fruiting Vegetables',
  fruits_tropical:      'Tropical Fruits',
  livestock_poultry:    'Livestock / Poultry',
  livestock_cattle:     'Cattle',
  fish_seafood:         'Fish & Seafood',
  agro_inputs:          'Agro Inputs',
  processed_foods:      'Processed Foods',
  perishables_mixed:    'Mixed Perishables',
};

const VEHICLE_LABELS: Record<string, string> = {
  open_truck:          'Open Truck',
  covered_van:         'Covered Van',
  refrigerated_truck:  'Refrigerated Truck',
  flatbed_trailer:     'Flatbed Trailer',
  pickup_van:          'Pickup Van',
  motorcycle_box:      'Motorcycle Box',
};

const PRODUCE_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#7C3AED',
  '#DC2626', '#0EA5E9', '#84CC16', '#EC4899',
  '#14B8A6', '#F97316', '#6366F1',
];

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/* ─── Component ───────────────────────────────────────── */
export default function AgroTransport() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);

  /* ── Load ───────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAgroData();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Realtime subscription ──────────────────────────── */
  useEffect(() => {
    load();

    const channel = supabase
      .channel('admin-agro-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => load())
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [load]);

  /* ── Derived lists ──────────────────────────────────── */
  const shipments: any[] = data?.shipments || [];
  const stats = data?.stats || {};
  const produceBreakdown: { label: string; count: number; color: string }[] = data?.produceBreakdown || [];
  const vehicleDemand: { label: string; count: number }[] = data?.vehicleDemand || [];
  const agroTerminals: any[] = data?.agroTerminals || [];

  const filteredShipments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter(
      (s) =>
        s.tracking_id?.toLowerCase().includes(q) ||
        s.sender_name?.toLowerCase().includes(q) ||
        s.recipient_name?.toLowerCase().includes(q) ||
        s.pickup_state?.toLowerCase().includes(q) ||
        s.delivery_state?.toLowerCase().includes(q) ||
        PRODUCE_LABELS[s.agro_produce_category]?.toLowerCase().includes(q) ||
        VEHICLE_LABELS[s.agro_vehicle_type]?.toLowerCase().includes(q)
    );
  }, [shipments, searchQuery]);

  /* ── Stat cards config ──────────────────────────────── */
  const statCards = [
    { label: 'Total Agro Jobs',        value: stats.total        ?? 0, icon: Package,      color: '#003822' },
    { label: 'Active Now',             value: stats.active       ?? 0, icon: Truck,         color: '#10B981' },
    { label: 'Cold Chain Required',    value: stats.coldChain    ?? 0, icon: Thermometer,   color: '#0EA5E9' },
    { label: 'Insured Loads',          value: stats.insured      ?? 0, icon: CheckCircle,   color: '#7C3AED' },
    { label: 'Exceptions / Alerts',    value: stats.exceptions   ?? 0, icon: AlertTriangle, color: '#DC2626' },
  ];

  /* ── Render ─────────────────────────────────────────── */
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Agro Transport</Text>
          <Text style={styles.pageSub}>
            Live monitoring of agricultural shipments — produce categories, vehicle demand, cold chain, and agro-ready terminal capacity.
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshBtnText}>Refresh Agro Data</Text>
        </Pressable>
      </View>

      {loading && !data ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND.green} size="large" />
        </View>
      ) : (
        <>
          {/* ── Stats cards ─────────────────────────── */}
          <View style={styles.statsContainer}>
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <View key={card.label} style={[styles.statCard, glass]}>
                  <View>
                    <Text style={styles.statLabel}>{card.label}</Text>
                    <Text style={styles.statValue}>{card.value}</Text>
                  </View>
                  <View style={[styles.iconCircle, { backgroundColor: `${card.color}1A` }]}>
                    <Icon color={card.color} size={20} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── Produce breakdown + Vehicle demand ──── */}
          <View style={styles.twoCol}>
            {/* Produce */}
            <View style={[styles.panel, glass]}>
              <Text style={styles.panelTitle}>Produce Category Breakdown</Text>
              {produceBreakdown.length === 0 ? (
                <Text style={styles.emptyText}>No agro shipments yet.</Text>
              ) : (
                produceBreakdown.map((item) => (
                  <View key={item.label} style={styles.breakdownRow}>
                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                    <Text style={styles.breakdownCount}>{item.count}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Vehicle demand */}
            <View style={[styles.panel, glass]}>
              <Text style={styles.panelTitle}>Vehicle Type Demand</Text>
              {vehicleDemand.length === 0 ? (
                <Text style={styles.emptyText}>No demand data yet.</Text>
              ) : (
                vehicleDemand.map((item, idx) => {
                  const maxCount = vehicleDemand[0]?.count || 1;
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <View key={item.label} style={styles.demandRow}>
                      <Text style={styles.demandLabel}>{item.label}</Text>
                      <View style={styles.demandBarBg}>
                        <View
                          style={[
                            styles.demandBar,
                            {
                              width: `${pct}%` as any,
                              backgroundColor: PRODUCE_COLORS[idx % PRODUCE_COLORS.length],
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.demandCount}>{item.count}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* ── Agro-Ready Terminals ─────────────────── */}
          {agroTerminals.length > 0 && (
            <View style={[styles.panel, glass, { marginBottom: 20 }]}>
              <Text style={styles.panelTitle}>Agro-Ready Terminals</Text>
              <View style={styles.terminalGrid}>
                {agroTerminals.map((t) => (
                  <View key={t.id} style={styles.terminalCard}>
                    <View style={styles.terminalCardRow}>
                      <Warehouse size={16} color={BRAND.green} />
                      <Text style={styles.terminalCode}>{t.code}</Text>
                    </View>
                    <Text style={styles.terminalName}>{t.name}</Text>
                    <Text style={styles.terminalStat}>Capacity: {t.agro_capacity_tonnes}t</Text>
                    <Text style={styles.terminalStat}>Agro Jobs Staged: {t.agroJobsHere}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Shipment Table ────────────────────────── */}
          <View style={styles.searchBox}>
            <Search size={16} color="#6B7280" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholder="Search by tracking ID, produce, vehicle, state, sender..."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={[styles.tableContainer, glass]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: 1480 }}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.colHeader, { flex: 1.4 }]}>Tracking ID</Text>
                  <Text style={[styles.colHeader, { flex: 1.3 }]}>Produce</Text>
                  <Text style={[styles.colHeader, { flex: 1.3 }]}>Vehicle</Text>
                  <Text style={[styles.colHeader, { flex: 0.8 }]}>Tonnage</Text>
                  <Text style={[styles.colHeader, { flex: 1.5 }]}>Route</Text>
                  <Text style={[styles.colHeader, { flex: 1.4 }]}>Stage</Text>
                  <Text style={[styles.colHeader, { flex: 0.7 }]}>Cold Chain</Text>
                  <Text style={[styles.colHeader, { flex: 0.7 }]}>Insured</Text>
                  <Text style={[styles.colHeader, { flex: 1.2 }]}>Created</Text>
                  <Text style={[styles.colHeader, { flex: 1.0, textAlign: 'center' }]}>Details</Text>
                </View>

                {filteredShipments.length === 0 ? (
                  <View style={styles.centerState}>
                    <Text style={styles.emptyText}>No agro shipments match your search.</Text>
                  </View>
                ) : (
                  filteredShipments.map((s) => {
                    const sc = stageColor(s.dispatch_stage);
                    return (
                      <View key={s.id} style={styles.tableRow}>
                        <View style={{ flex: 1.4 }}>
                          <Text style={[styles.cellText, { fontWeight: '700', color: '#003822' }]}>
                            {s.tracking_id || s.id?.slice(0, 8)}
                          </Text>
                          <Text style={styles.cellMeta}>{s.sender_name}</Text>
                        </View>

                        <Text style={[styles.cellText, { flex: 1.3 }]}>
                          {PRODUCE_LABELS[s.agro_produce_category] || s.agro_produce_category || '—'}
                        </Text>

                        <Text style={[styles.cellText, { flex: 1.3 }]}>
                          {VEHICLE_LABELS[s.agro_vehicle_type] || s.agro_vehicle_type || '—'}
                        </Text>

                        <Text style={[styles.cellText, { flex: 0.8 }]}>
                          {s.agro_tonnage ? `${s.agro_tonnage}t` : '—'}
                        </Text>

                        <Text style={[styles.cellText, { flex: 1.5 }]}>
                          {s.pickup_state} → {s.delivery_state}
                        </Text>

                        <View style={{ flex: 1.4 }}>
                          <View style={[styles.stagePill, { backgroundColor: `${sc}18`, borderColor: `${sc}33` }]}>
                            <Text style={[styles.stagePillText, { color: sc }]}>
                              {stageLabel(s.dispatch_stage)}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flex: 0.7, alignItems: 'center' }}>
                          <View style={[styles.flagPill, s.requires_cold_chain ? styles.flagOn : styles.flagOff]}>
                            <Text style={[styles.flagText, s.requires_cold_chain ? styles.flagOnText : styles.flagOffText]}>
                              {s.requires_cold_chain ? 'Yes' : 'No'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flex: 0.7, alignItems: 'center' }}>
                          <View style={[styles.flagPill, s.agro_insured ? styles.flagOn : styles.flagOff]}>
                            <Text style={[styles.flagText, s.agro_insured ? styles.flagOnText : styles.flagOffText]}>
                              {s.agro_insured ? 'Yes' : 'No'}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.cellText, { flex: 1.2 }]}>
                          {formatDate(s.created_at)}
                        </Text>

                        <View style={{ flex: 1.0, alignItems: 'center' }}>
                          <Pressable style={styles.detailBtn} onPress={() => setSelectedShipment(s)}>
                            <Text style={styles.detailBtnText}>View</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── Detail Modal ─────────────────────────────── */}
      <Modal
        visible={!!selectedShipment}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedShipment(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Agro Shipment</Text>
                <Text style={styles.modalSub}>
                  {selectedShipment?.tracking_id || selectedShipment?.id?.slice(0, 8)}
                </Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={() => setSelectedShipment(null)}>
                <X size={18} color="#111827" />
              </Pressable>
            </View>

            {selectedShipment && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailsGrid}>
                  {[
                    ['Sender',         selectedShipment.sender_name],
                    ['Recipient',      selectedShipment.recipient_name],
                    ['From',           selectedShipment.pickup_state],
                    ['To',             selectedShipment.delivery_state],
                    ['Produce',        PRODUCE_LABELS[selectedShipment.agro_produce_category] || selectedShipment.agro_produce_category || '—'],
                    ['Vehicle Needed', VEHICLE_LABELS[selectedShipment.agro_vehicle_type] || selectedShipment.agro_vehicle_type || '—'],
                    ['Tonnage',        selectedShipment.agro_tonnage ? `${selectedShipment.agro_tonnage} metric tons` : '—'],
                    ['Cold Chain',     selectedShipment.requires_cold_chain ? 'Required' : 'Not required'],
                    ['Insured',        selectedShipment.agro_insured ? 'Yes' : 'No'],
                    ['Stage',          stageLabel(selectedShipment.dispatch_stage)],
                    ['Created',        formatDate(selectedShipment.created_at)],
                    ['Last Updated',   formatDate(selectedShipment.updated_at)],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={styles.detailCard}>
                      <Text style={styles.detailLabel}>{String(label)}</Text>
                      <Text style={styles.detailValue}>{String(value ?? '—')}</Text>
                    </View>
                  ))}
                </View>

                {selectedShipment.agro_handling_notes ? (
                  <View style={styles.notesCard}>
                    <Text style={styles.notesLabel}>HANDLING NOTES</Text>
                    <Text style={styles.notesText}>{selectedShipment.agro_handling_notes}</Text>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
    flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  pageSub: { fontSize: 15, color: '#4b5563', maxWidth: 780 },
  refreshBtn: {
    backgroundColor: BRAND.lime,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  refreshBtnText: { color: BRAND.green, fontWeight: '700', fontSize: 14 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  emptyText: { fontSize: 13, color: '#6B7280' },

  // Stats
  statsContainer: { flexDirection: 'row', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 190,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statLabel: { color: '#1a1a1a', fontSize: 13, fontWeight: '700', marginBottom: 5 },
  statValue: { color: '#111827', fontSize: 30, fontWeight: '800' },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },

  // Two column
  twoCol: { flexDirection: 'row', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  panel: {
    flex: 1,
    minWidth: 280,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 14 },

  // Produce breakdown
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { flex: 1, fontSize: 13, color: '#1a1a1a' },
  breakdownCount: { fontSize: 14, fontWeight: '700', color: '#003822' },

  // Vehicle demand
  demandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  demandLabel: { width: 130, fontSize: 12, color: '#4B5563', fontWeight: '600' },
  demandBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  demandBar: { height: '100%', borderRadius: 999 },
  demandCount: { width: 28, fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'right' },

  // Agro terminals
  terminalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  terminalCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  terminalCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  terminalCode: { fontSize: 16, fontWeight: '800', color: '#003822' },
  terminalName: { fontSize: 12, color: '#4B5563', marginBottom: 6 },
  terminalStat: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    outlineStyle: 'none' as any,
  },

  // Table
  tableContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    minHeight: 480,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 14,
    marginBottom: 8,
  },
  colHeader: { fontWeight: '700', fontSize: 12, color: '#4B5568', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  cellText: { fontSize: 13, color: '#1a1a1a' },
  cellMeta: { fontSize: 11, color: '#6B7280', marginTop: 3 },

  stagePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  stagePillText: { fontSize: 11, fontWeight: '700' },

  flagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  flagOn: { backgroundColor: '#DCFCE7', borderColor: '#16A34A33' },
  flagOff: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  flagText: { fontSize: 11, fontWeight: '700' },
  flagOnText: { color: '#16A34A' },
  flagOffText: { color: '#6B7280' },

  detailBtn: {
    backgroundColor: BRAND.lime,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  detailBtnText: { color: BRAND.green, fontSize: 12, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 860,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  detailCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  detailLabel: {
    fontSize: 10, color: '#6B7280', fontWeight: '700',
    textTransform: 'uppercase', marginBottom: 5,
  },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  notesCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 10, color: '#92400E', fontWeight: '700',
    textTransform: 'uppercase', marginBottom: 6,
  },
  notesText: { fontSize: 13, color: '#78350F', lineHeight: 20 },
});
