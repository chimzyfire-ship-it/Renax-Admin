import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowDown, ArrowUp, Calendar, Download } from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';
import { supabase } from '../../supabase';
import { fetchAnalyticsData } from '../../utils/adminData';

const RANGE_OPTIONS = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
];

const formatAmount = (amount: number) => `₦${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const formatHours = (hours: number) => `${hours.toFixed(1)} hrs`;

function exportJsonFile(filename: string, payload: unknown) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsReports() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const isTablet = width < 1180;
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [rangeKey, setRangeKey] = useState('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAnalyticsData(rangeKey);
      setData(response);
    } finally {
      setLoading(false);
    }
  }, [rangeKey]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`analytics-live-${rangeKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, () => loadData())
      .subscribe();

    return () => channel.unsubscribe();
  }, [loadData, rangeKey]);

  const metrics = data?.metrics || {};
  const trend = data?.trend || [];
  const reports = data?.reports || [];
  const topCities = data?.topCities || [];
  const statusBreakdown = data?.statusBreakdown || [];

  const maxShipments = useMemo(() => Math.max(...trend.map((item: any) => item.shipments || 0), 1), [trend]);
  const maxRevenue = useMemo(() => Math.max(...trend.map((item: any) => item.revenue || 0), 1), [trend]);
  const totalStatus = useMemo(() => statusBreakdown.reduce((sum: number, item: any) => sum + item.count, 0), [statusBreakdown]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Analytics & Reports</Text>
        <View style={styles.toolbar}>
          <View style={styles.segmented}>
            {RANGE_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={[styles.segment, rangeKey === option.key && styles.segmentActive]}
                onPress={() => setRangeKey(option.key)}
              >
                <Calendar size={14} color={rangeKey === option.key ? BRAND.green : '#6B7280'} />
                <Text style={[styles.segmentText, rangeKey === option.key && styles.segmentTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.exportBtn} onPress={() => exportJsonFile(`renax-analytics-${rangeKey}.json`, data)}>
            <Download size={18} color={BRAND.green} />
            <Text style={styles.exportBtnText}>Export Report</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND.green} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={styles.statsContainer}>
            {[
              { label: 'Total Shipments', value: String(metrics.totalShipments || 0), trend: 'up', detail: `${rangeKey.toUpperCase()} window` },
              { label: 'Total Revenue', value: formatAmount(metrics.totalRevenue || 0), trend: 'up', detail: 'Delivered shipment revenue' },
              { label: 'Avg. Delivery Time', value: formatHours(metrics.avgDeliveryHours || 0), trend: 'down', detail: 'From created to delivered' },
              { label: 'Success Rate', value: `${Number(metrics.successRate || 0).toFixed(1)}%`, trend: 'up', detail: 'Delivered / total shipments' },
            ].map((card) => (
              <View key={card.label} style={[styles.statCard, glass, isCompact && { minWidth: '100%' }]}>
                <Text style={styles.statLabel}>{card.label}</Text>
                <Text style={styles.statValue}>{card.value}</Text>
                <View style={styles.trendRow}>
                  {card.trend === 'up' ? <ArrowUp size={16} color={BRAND.green} /> : <ArrowDown size={16} color={BRAND.danger} />}
                  <Text style={[styles.trendText, card.trend === 'up' ? styles.trendGreen : styles.trendRed]}>{card.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.middleRow, isTablet && { flexDirection: 'column' }]}>
            <View style={[styles.graphCard, glass, { flex: 2 }, isTablet && { width: '100%' }]}>
              <View style={styles.graphHeader}>
                <Text style={styles.graphTitle}>Shipments & Revenue Trend</Text>
                <View style={styles.legendWrap}>
                  <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: BRAND.green }]} /><Text style={styles.legendText}>Shipments</Text></View>
                  <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} /><Text style={styles.legendText}>Revenue</Text></View>
                </View>
              </View>

              <View style={styles.trendChart}>
                {trend.map((item: any) => (
                  <View key={item.key} style={styles.barGroup}>
                    <View style={styles.barStack}>
                      <View style={[styles.bar, styles.shipmentsBar, { height: `${Math.max((item.shipments / maxShipments) * 100, item.shipments ? 8 : 0)}%` }]} />
                      <View style={[styles.bar, styles.revenueBar, { height: `${Math.max((item.revenue / maxRevenue) * 100, item.revenue ? 8 : 0)}%` }]} />
                    </View>
                    <Text style={styles.axisText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ flex: 1, gap: 24, minWidth: isTablet ? 0 : 300, width: isTablet ? '100%' : undefined }}>
              <View style={[styles.graphCard, glass]}>
                <Text style={styles.graphTitle}>Delivery Status Breakdown</Text>
                <View style={styles.statusStack}>
                  {statusBreakdown.length === 0 ? (
                    <Text style={styles.emptyText}>No shipment activity in this range yet.</Text>
                  ) : (
                    statusBreakdown.map((item: any) => {
                      const percentage = totalStatus ? (item.count / totalStatus) * 100 : 0;
                      return (
                        <View key={item.label} style={styles.statusRow}>
                          <View style={styles.statusRowTop}>
                            <View style={styles.legendRow}>
                              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                              <Text style={styles.legendText}>{item.label}</Text>
                            </View>
                            <Text style={styles.legendText}>{item.count} • {percentage.toFixed(1)}%</Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: item.color }]} />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>

              <View style={[styles.graphCard, glass]}>
                <Text style={styles.graphTitle}>Top Performing Cities</Text>
                <View style={styles.cityChart}>
                  {topCities.length === 0 ? (
                    <Text style={styles.emptyText}>No city performance data yet.</Text>
                  ) : (
                    topCities.map((item: any) => (
                      <View key={item.city} style={styles.cityRow}>
                        <Text style={styles.cityLabel}>{item.city}</Text>
                        <View style={styles.cityBarTrack}>
                          <View style={[styles.cityBarFill, { width: `${(item.count / Math.max(topCities[0]?.count || 1, 1)) * 100}%` }]} />
                        </View>
                        <Text style={styles.cityValue}>{item.count}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.tableContainer, glass]}>
            <Text style={[styles.graphTitle, { marginBottom: 16 }]}>Recent Reports</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: isCompact ? 680 : '100%' }}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.colHeader, { flex: 2 }]}>Report Name</Text>
                  <Text style={[styles.colHeader, { flex: 1 }]}>Period</Text>
                  <Text style={[styles.colHeader, { flex: 1 }]}>Generated On</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>Actions</Text>
                </View>
                {reports.map((item: any) => (
                  <View key={item.id} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.cellText, { fontWeight: '700' }]}>{item.name}</Text>
                      <Text style={styles.cellMeta}>{item.summary}</Text>
                    </View>
                    <Text style={[styles.cellText, { flex: 1 }]}>{item.period}</Text>
                    <Text style={[styles.cellText, { flex: 1 }]}>{new Date(item.generated).toLocaleDateString('en-US')}</Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Pressable style={styles.actionBtnGreen} onPress={() => exportJsonFile(`${item.id}.json`, item)}>
                        <Text style={styles.actionBtnTextWhite}>Download</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  toolbar: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', alignItems: 'center' },
  segmented: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  segmentActive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  segmentText: { color: '#1a1a1a', fontWeight: '600', fontSize: 14 },
  segmentTextActive: { color: BRAND.green },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.lime, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, gap: 8 },
  exportBtnText: { color: BRAND.green, fontWeight: '700', fontSize: 15 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 320 },
  statsContainer: { flexDirection: 'row', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 180, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 20, elevation: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  statLabel: { color: '#4b5563', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  statValue: { color: '#111827', fontSize: 30, fontWeight: '800' },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  trendText: { fontWeight: '700', fontSize: 13, marginLeft: 6 },
  trendGreen: { color: BRAND.green },
  trendRed: { color: BRAND.danger },
  middleRow: { flexDirection: 'row', gap: 24, marginBottom: 24, flexWrap: 'wrap' },
  graphCard: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, elevation: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  graphHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  graphTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  legendWrap: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, fontWeight: '600', color: '#4B5568' },
  trendChart: { height: 260, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 20 },
  barGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  barStack: { height: 210, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 4 },
  bar: { width: '35%', minWidth: 8, borderRadius: 8 },
  shipmentsBar: { backgroundColor: BRAND.green },
  revenueBar: { backgroundColor: '#3B82F6' },
  axisText: { fontSize: 10, color: '#9ca3af' },
  statusStack: { gap: 14, marginTop: 16 },
  statusRow: { gap: 8 },
  statusRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressTrack: { height: 10, backgroundColor: '#EEF2F7', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  cityChart: { gap: 14, marginTop: 16 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cityLabel: { width: 100, fontSize: 12, color: '#4B5568', fontWeight: '700' },
  cityBarTrack: { flex: 1, height: 12, backgroundColor: '#EEF2F7', borderRadius: 999, overflow: 'hidden' },
  cityBarFill: { height: '100%', backgroundColor: BRAND.green, borderRadius: 999 },
  cityValue: { width: 32, textAlign: 'right', fontSize: 12, color: '#1a1a1a', fontWeight: '700' },
  tableContainer: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, elevation: 2, flex: 1 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)', paddingBottom: 12, marginBottom: 12 },
  colHeader: { fontWeight: '700', fontSize: 13, color: '#1a1a1a' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', alignItems: 'center' },
  cellText: { fontSize: 14, color: '#2a2a2a', fontWeight: '500' },
  cellMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  actionBtnGreen: { backgroundColor: BRAND.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnTextWhite: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#6B7280' },
});
