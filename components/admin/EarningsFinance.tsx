import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowDown, ArrowUp, Calendar, Download } from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';
import { supabase } from '../../supabase';
import { fetchFinanceData } from '../../utils/adminData';

const RANGE_OPTIONS = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
];

const formatAmount = (amount: number) =>
  `₦${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

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

export default function EarningsFinance() {
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
      const response = await fetchFinanceData(rangeKey);
      setData(response);
    } finally {
      setLoading(false);
    }
  }, [rangeKey]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`finance-live-${rangeKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_withdrawals' }, loadData)
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadData, rangeKey]);

  const metrics = data?.metrics || {};
  const trend = data?.trend || [];
  const breakdown = data?.breakdown || [];
  const recentTransactions = data?.recentTransactions || [];

  const maxTrendValue = useMemo(
    () =>
      Math.max(
        ...trend.flatMap((item: any) => [item.revenue || 0, item.walletFunding || 0, item.withdrawals || 0]),
        1
      ),
    [trend]
  );
  const totalBreakdown = useMemo(
    () => breakdown.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
    [breakdown]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Earnings & Finance</Text>
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
          <Pressable style={styles.exportBtn} onPress={() => exportJsonFile(`renax-finance-${rangeKey}.json`, data)}>
            <Download size={18} color={BRAND.green} />
            <Text style={styles.exportBtnText}>Export Statement</Text>
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
              { label: 'Total Earnings', value: formatAmount(metrics.totalEarnings || 0), trend: 'up', detail: 'Delivered shipment revenue' },
              { label: 'Revenue Today', value: formatAmount(metrics.revenueToday || 0), trend: 'up', detail: 'Completed today' },
              { label: 'Pending Payouts', value: formatAmount(metrics.pendingPayouts || 0), trend: 'down', detail: 'Awaiting withdrawal clearance' },
              { label: 'Avg. Earnings per Rider', value: formatAmount(metrics.avgEarningsPerRider || 0), trend: 'up', detail: 'Based on current rider pool' },
              { label: 'Wallet Funding', value: formatAmount(metrics.walletFunding || 0), trend: 'up', detail: 'Successful top-ups in range' },
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
                <Text style={styles.graphTitle}>Revenue, Funding & Withdrawals</Text>
                <View style={styles.legendWrap}>
                  <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: BRAND.green }]} /><Text style={styles.legendText}>Revenue</Text></View>
                  <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} /><Text style={styles.legendText}>Wallet Funding</Text></View>
                  <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendText}>Withdrawals</Text></View>
                </View>
              </View>

              <View style={styles.trendChart}>
                {trend.map((item: any) => (
                  <View key={item.key} style={styles.barGroup}>
                    <View style={styles.barStack}>
                      <View style={[styles.bar, { backgroundColor: BRAND.green, height: `${Math.max((item.revenue / maxTrendValue) * 100, item.revenue ? 8 : 0)}%` }]} />
                      <View style={[styles.bar, { backgroundColor: '#3B82F6', height: `${Math.max((item.walletFunding / maxTrendValue) * 100, item.walletFunding ? 8 : 0)}%` }]} />
                      <View style={[styles.bar, { backgroundColor: '#F59E0B', height: `${Math.max((item.withdrawals / maxTrendValue) * 100, item.withdrawals ? 8 : 0)}%` }]} />
                    </View>
                    <Text style={styles.axisText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.graphCard, glass, { flex: 1, minWidth: isTablet ? 0 : 300, width: isTablet ? '100%' : undefined }]}>
              <Text style={styles.graphTitle}>Payment Method Breakdown</Text>
              <View style={styles.breakdownWrap}>
                {breakdown.length === 0 ? (
                  <Text style={styles.emptyText}>No completed payment activity yet.</Text>
                ) : (
                  breakdown.map((item: any) => {
                    const share = totalBreakdown ? (Number(item.amount || 0) / totalBreakdown) * 100 : 0;
                    return (
                      <View key={item.label} style={styles.breakdownRow}>
                        <View style={styles.breakdownHeader}>
                          <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                            <Text style={styles.legendText}>{item.label}</Text>
                          </View>
                          <Text style={styles.legendText}>{formatAmount(item.amount)} • {share.toFixed(1)}%</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${share}%`, backgroundColor: item.color }]} />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>

          <View style={[styles.tableContainer, glass]}>
            <Text style={[styles.graphTitle, { marginBottom: 16 }]}>Recent Transactions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: isCompact ? 860 : 1020 }}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.colHeader, { flex: 1.2 }]}>Reference</Text>
                  <Text style={[styles.colHeader, { flex: 1 }]}>Date</Text>
                  <Text style={[styles.colHeader, { flex: 2 }]}>Description</Text>
                  <Text style={[styles.colHeader, { flex: 1.4 }]}>Entity</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>Amount</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>Status</Text>
                  <Text style={[styles.colHeader, { flex: 1.1, textAlign: 'center' }]}>Category</Text>
                </View>
                {recentTransactions.length === 0 ? (
                  <Text style={styles.emptyText}>No finance records available in this time range.</Text>
                ) : (
                  recentTransactions.map((item: any) => (
                    <View key={`${item.id}-${item.date}`} style={styles.tableRow}>
                      <Text style={[styles.cellText, { flex: 1.2, fontWeight: '700' }]}>{item.id}</Text>
                      <Text style={[styles.cellText, { flex: 1 }]}>{new Date(item.date).toLocaleDateString('en-US')}</Text>
                      <Text style={[styles.cellText, { flex: 2 }]}>{item.description}</Text>
                      <Text style={[styles.cellText, { flex: 1.4 }]}>{item.entity}</Text>
                      <Text style={[styles.cellText, { flex: 1, textAlign: 'right', fontWeight: '700' }]}>{formatAmount(item.amount)}</Text>
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <View style={[styles.statusPill, getStatusPillStyle(item.status)]}>
                          <Text style={styles.statusPillText}>{formatStatus(item.status)}</Text>
                        </View>
                      </View>
                      <Text style={[styles.cellText, { flex: 1.1, textAlign: 'center' }]}>{formatCategory(item.category)}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function formatStatus(status: string) {
  if (!status) return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCategory(category: string) {
  if (!category) return 'General';
  return category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusPillStyle(status: string) {
  const value = String(status || '').toLowerCase();
  if (value === 'success' || value === 'completed' || value === 'delivered') {
    return { backgroundColor: BRAND.green };
  }
  if (value === 'pending') {
    return { backgroundColor: '#F59E0B' };
  }
  return { backgroundColor: BRAND.danger };
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
  statCard: { flex: 1, minWidth: 190, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 20, elevation: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  statLabel: { color: '#4b5563', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  statValue: { color: '#111827', fontSize: 28, fontWeight: '800' },
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
  bar: { width: '24%', minWidth: 6, borderRadius: 8 },
  axisText: { fontSize: 10, color: '#9ca3af' },
  breakdownWrap: { gap: 14, marginTop: 16 },
  breakdownRow: { gap: 8 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  progressTrack: { height: 10, backgroundColor: '#EEF2F7', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  tableContainer: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, elevation: 2, flex: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)', paddingBottom: 12, marginBottom: 12 },
  colHeader: { fontWeight: '700', fontSize: 13, color: '#1a1a1a' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  cellText: { fontSize: 14, color: '#2a2a2a', fontWeight: '500' },
  statusPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#6B7280' },
});
