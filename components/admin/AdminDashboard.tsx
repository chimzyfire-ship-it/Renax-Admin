import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AlertCircle, ArrowUpRight, PackageSearch, RefreshCw, Truck, Users, Warehouse } from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';
import { fetchAdminOverview } from '../../utils/adminData';
import { shipmentStatusFromStage, stageColor, stageLabel } from '../../utils/routingService';
import { supabase } from '../../supabase';

const formatAmount = (amount: number) =>
  `₦${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function AdminDashboard() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const isTablet = width < 1180;
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminOverview();
      setOverview(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();

    const shipmentsChannel = supabase
      .channel('admin-dashboard-shipments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => loadOverview())
      .subscribe();

    const riderLocationsChannel = supabase
      .channel('admin-dashboard-rider-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, () => loadOverview())
      .subscribe();

    return () => {
      shipmentsChannel.unsubscribe();
      riderLocationsChannel.unsubscribe();
    };
  }, [loadOverview]);

  const metrics = overview?.metrics || {};
  const stageBreakdown = overview?.stageBreakdown || {};
  const terminalLoads = overview?.terminalLoads || [];
  const recentShipments = overview?.recentShipments || [];
  const riderSnapshots = overview?.riderSnapshots || [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Operations Command Center</Text>
          <Text style={styles.pageSub}>Live view of shipment flow, riders, terminal pressure, and today&apos;s delivery performance.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={loadOverview}>
          <RefreshCw color="#003822" size={16} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND.green} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={styles.statsContainer}>
            {[
              {
                label: 'Active Shipments',
                value: String(metrics.activeShipments || 0),
                icon: PackageSearch,
                theme: 'green',
              },
              {
                label: 'Riders Online',
                value: String(metrics.ridersOnline || 0),
                icon: Users,
                theme: 'green',
              },
              {
                label: 'Revenue Today',
                value: formatAmount(metrics.revenueToday || 0),
                icon: ArrowUpRight,
                theme: 'green',
              },
              {
                label: 'Terminal Backlog',
                value: String(metrics.terminalBacklog || 0),
                icon: Warehouse,
                theme: 'white',
              },
              {
                label: 'Relay Shipments',
                value: String(metrics.relayShipments || 0),
                icon: Truck,
                theme: 'white',
              },
              {
                label: 'Exceptions',
                value: String(metrics.exceptions || 0),
                icon: AlertCircle,
                theme: 'danger',
              },
            ].map((card) => {
              const Icon = card.icon;
              const isGreen = card.theme === 'green';
              const isDanger = card.theme === 'danger';
              return (
                <View
                  key={card.label}
                  style={[
                    styles.statCard,
                    isCompact && { minWidth: '100%' },
                    isGreen && styles.greenGlassCard,
                    !isGreen && styles.whiteGlassCard,
                    isDanger && styles.dangerGlassCard,
                    glass,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statLabel, isGreen && styles.statLabelWhite]}>{card.label}</Text>
                    <Text
                      style={[
                        styles.statValue,
                        isGreen && styles.statValueLime,
                        !isGreen && styles.statValueDark,
                        isDanger && styles.statValueDanger,
                      ]}
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      {card.value}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.iconCircle,
                      isGreen && styles.iconCircleLime,
                      !isGreen && styles.iconCircleWhite,
                      isDanger && styles.iconCircleDanger,
                    ]}
                  >
                    <Icon color={isGreen ? BRAND.green : isDanger ? BRAND.danger : BRAND.green} size={20} />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.mainGrid, isTablet && { flexDirection: 'column' }]}>
            <View style={[styles.panel, styles.largePanel, glass, isTablet && styles.fullWidthPanel]}>
              <Text style={styles.sectionTitle}>Dispatch Breakdown</Text>
              <View style={styles.breakdownGrid}>
                {[
                  ['Awaiting Rider', stageBreakdown.awaiting_rider_acceptance || 0, '#F59E0B'],
                  ['At Source Hub', stageBreakdown.at_source_hub || 0, '#7C3AED'],
                  ['Linehaul', stageBreakdown.linehaul || 0, '#4F46E5'],
                  ['Awaiting Final Mile', stageBreakdown.awaiting_final_mile || 0, '#0EA5E9'],
                  ['Out For Delivery', stageBreakdown.out_for_delivery || 0, '#10B981'],
                  ['Exception', stageBreakdown.exception || 0, '#DC2626'],
                ].map(([label, value, color]) => (
                  <View key={String(label)} style={[styles.breakdownCard, isCompact && styles.breakdownCardCompact]}>
                    <View style={[styles.breakdownDot, { backgroundColor: String(color) }]} />
                    <Text style={styles.breakdownLabel}>{String(label)}</Text>
                    <Text style={styles.breakdownValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent Shipments</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: isCompact ? 700 : '100%' }}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeadText, { flex: 1.1 }]}>Tracking</Text>
                    <Text style={[styles.tableHeadText, { flex: 1.4 }]}>Route</Text>
                    <Text style={[styles.tableHeadText, { flex: 1.1 }]}>Routing</Text>
                    <Text style={[styles.tableHeadText, { flex: 1.2 }]}>Stage</Text>
                    <Text style={[styles.tableHeadText, { flex: 0.9 }]}>Amount</Text>
                  </View>

                  {recentShipments.length === 0 ? (
                    <Text style={styles.emptyText}>No live shipments yet.</Text>
                  ) : (
                    recentShipments.map((shipment: any) => {
                      const stage = shipment.dispatch_stage || 'pending_routing';
                      const routingMode = shipment.routing_mode || 'last_mile_local';
                      const color = stageColor(stage);
                      return (
                        <View key={shipment.id} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { flex: 1.1, fontWeight: '700', color: '#003822' }]}>{shipment.tracking_id || shipment.id}</Text>
                          <Text style={[styles.tableCell, { flex: 1.4 }]}>{`${shipment.pickup_state || 'Unknown'} -> ${shipment.delivery_state || 'Unknown'}`}</Text>
                          <Text style={[styles.tableCell, { flex: 1.1 }]}>
                            {routingMode === 'relay_terminal' ? 'Relay' : routingMode === 'manual_review' ? 'Review' : 'Local'}
                          </Text>
                          <View style={{ flex: 1.2 }}>
                            <Text style={[styles.tableCell, { color }]}>{stageLabel(stage)}</Text>
                            <Text style={styles.tableMeta}>{shipmentStatusFromStage(stage, routingMode)}</Text>
                          </View>
                          <Text style={[styles.tableCell, { flex: 0.9, fontWeight: '700' }]}>{formatAmount(shipment.estimated_price || 0)}</Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.panel, styles.sidePanel, glass, isTablet && styles.fullWidthPanel]}>
              <Text style={styles.sectionTitle}>Terminal Load</Text>
              {terminalLoads.length === 0 ? (
                <Text style={styles.emptyText}>No terminals found.</Text>
              ) : (
                terminalLoads.map((terminal: any) => (
                  <View key={terminal.id} style={styles.terminalCard}>
                    <View style={styles.terminalHeader}>
                      <View>
                        <Text style={styles.terminalTitle}>{terminal.name}</Text>
                        <Text style={styles.terminalSub}>{terminal.code} • {terminal.city}, {terminal.state}</Text>
                      </View>
                      <Text style={styles.terminalTotal}>
                        {terminal.inbound + terminal.atHub + terminal.destinationQueue + terminal.finalMileQueue}
                      </Text>
                    </View>
                    <View style={styles.terminalStats}>
                      <Text style={styles.terminalStat}>Intake {terminal.inbound}</Text>
                      <Text style={styles.terminalStat}>At Hub {terminal.atHub}</Text>
                      <Text style={styles.terminalStat}>Arrivals {terminal.destinationQueue}</Text>
                      <Text style={styles.terminalStat}>Final Mile {terminal.finalMileQueue}</Text>
                    </View>
                  </View>
                ))
              )}

              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Rider Snapshot</Text>
              {riderSnapshots.length === 0 ? (
                <Text style={styles.emptyText}>No rider location data yet.</Text>
              ) : (
                riderSnapshots.map((rider: any) => (
                  <View key={rider.id} style={styles.riderCard}>
                    <View style={styles.riderHeader}>
                      <Text style={styles.riderName}>{rider.name}</Text>
                      <View style={[styles.riderStatusPill, { backgroundColor: rider.isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)' }]}>
                        <Text style={[styles.riderStatusText, { color: rider.isOnline ? '#047857' : '#6B7280' }]}>
                          {rider.isOnline ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.riderMeta}>{rider.vehicleType} • {rider.phone}</Text>
                    <Text style={styles.riderMeta}>{rider.location}</Text>
                    {rider.currentShipmentId ? <Text style={styles.riderShipment}>Current shipment: {rider.currentShipmentId}</Text> : null}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={[styles.footerPanel, glass]}>
            <Text style={styles.sectionTitle}>Today&apos;s Delivery Summary</Text>
            <View style={styles.footerStats}>
              <View style={styles.footerStatCard}>
                <Text style={styles.footerStatLabel}>Delivered Today</Text>
                <Text style={styles.footerStatValue}>{metrics.deliveredToday || 0}</Text>
              </View>
              <View style={styles.footerStatCard}>
                <Text style={styles.footerStatLabel}>Riders Busy</Text>
                <Text style={styles.footerStatValue}>{metrics.ridersBusy || 0}</Text>
              </View>
              <View style={styles.footerStatCard}>
                <Text style={styles.footerStatLabel}>Last Refresh</Text>
                <Text style={styles.footerStatValueSmall}>{recentShipments[0]?.created_at ? formatDate(recentShipments[0].created_at) : 'Live'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  pageSub: {
    fontSize: 15,
    color: '#4b5563',
    maxWidth: 820,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#003822',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 180,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  greenGlassCard: {
    backgroundColor: 'rgba(0, 56, 34, 0.88)',
  },
  whiteGlassCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(0,0,0,0.06)',
  },
  dangerGlassCard: {
    borderColor: 'rgba(220, 53, 69, 0.3)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleLime: {
    backgroundColor: BRAND.lime,
  },
  iconCircleWhite: {
    backgroundColor: '#F3F4F6',
  },
  iconCircleDanger: {
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
  },
  statLabel: {
    color: BRAND.subtext,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  statLabelWhite: {
    color: 'rgba(255,255,255,0.82)',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
  },
  statValueLime: {
    color: BRAND.lime,
  },
  statValueDark: {
    color: '#111827',
  },
  statValueDanger: {
    color: BRAND.danger,
  },
  mainGrid: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  largePanel: {
    flex: 1.35,
    minWidth: 520,
  },
  sidePanel: {
    flex: 0.85,
    minWidth: 320,
  },
  fullWidthPanel: {
    minWidth: 0,
    width: '100%',
  },
  footerPanel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  breakdownCard: {
    width: '31%',
    minWidth: 140,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  breakdownCardCompact: {
    width: '100%',
    minWidth: 0,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  breakdownValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 12,
    marginBottom: 10,
  },
  tableHeadText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 14,
    color: '#2a2a2a',
    fontWeight: '500',
  },
  tableMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  terminalCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  terminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  terminalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  terminalSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  terminalTotal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#003822',
  },
  terminalStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  terminalStat: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },
  riderCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  riderName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  riderStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  riderStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  riderMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  riderShipment: {
    fontSize: 12,
    color: '#003822',
    fontWeight: '700',
    marginTop: 4,
  },
  footerStats: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  footerStatCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  footerStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  footerStatValue: {
    fontSize: 26,
    color: '#111827',
    fontWeight: '900',
  },
  footerStatValueSmall: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
  },
});
