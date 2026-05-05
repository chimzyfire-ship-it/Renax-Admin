// components/admin/NotificationQueue.tsx
// Ops monitoring dashboard for notification_delivery_queue
// Supports: live refresh, status filter, manual resend of failed OTPs
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { BRAND } from '../../constants/Theme';
import { RefreshCw, Send, AlertCircle, CheckCircle, Clock, XCircle, MailWarning, Siren, PackageSearch } from 'lucide-react-native';
import { supabase } from '../../supabase';

const STATUS_FILTERS = ['all', 'pending', 'sent', 'failed', 'dead_letter'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  pending:     { color: '#F59E0B', icon: Clock,        label: 'Pending'     },
  sent:        { color: '#10B981', icon: CheckCircle,  label: 'Sent'        },
  failed:      { color: '#DC2626', icon: XCircle,      label: 'Failed'      },
  dead_letter: { color: '#7C3AED', icon: MailWarning,  label: 'Dead Letter' },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function NotificationQueue() {
  const [items, setItems] = useState<any[]>([]);
  const [opsAlerts, setOpsAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notification_delivery_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      const { data: alertsData } = await supabase
        .from('ops_alerts')
        .select('*')
        .in('status', ['open', 'acknowledged'])
        .order('last_seen_at', { ascending: false })
        .limit(50);
      setItems(data || []);
      setOpsAlerts(alertsData || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(loadQueue, 30_000);
    return () => clearInterval(timer);
  }, [loadQueue]);

  const filtered = useMemo(() => items.filter(item => {
    const statusMatch = statusFilter === 'all' || item.status === statusFilter;
    const q = search.trim().toLowerCase();
    const textMatch = !q || item.recipient?.toLowerCase().includes(q) || item.body?.toLowerCase().includes(q) || item.template_key?.toLowerCase().includes(q);
    return statusMatch && textMatch;
  }), [items, statusFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, sent: 0, failed: 0, dead_letter: 0 };
    items.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });
    return counts;
  }, [items]);

  const handleResend = async (item: any) => {
    setBusyId(item.id);
    setResendSuccess(null);
    try {
      // Reset to pending so the cron worker picks it up again
      await supabase
        .from('notification_delivery_queue')
        .update({ status: 'pending', retry_count: 0, last_error: null, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      setResendSuccess(item.id);
      await loadQueue();
    } finally {
      setBusyId(null);
    }
  };

  const handleAcknowledgeAlert = async (alert: any) => {
    setBusyId(alert.id);
    try {
      await supabase
        .from('ops_alerts')
        .update({ status: 'acknowledged', resolved_at: null })
        .eq('id', alert.id);
      await loadQueue();
    } finally {
      setBusyId(null);
    }
  };

  const handleResolveAlert = async (alert: any) => {
    setBusyId(alert.id);
    try {
      await supabase
        .from('ops_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', alert.id);
      await loadQueue();
    } finally {
      setBusyId(null);
    }
  };

  const alertStats = useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0 };
    opsAlerts.forEach((alert) => {
      if (alert?.severity && counts[alert.severity as keyof typeof counts] !== undefined) {
        counts[alert.severity as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [opsAlerts]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Notification Queue</Text>
          <Text style={styles.subTitle}>Monitor OTP SMS delivery status, retry failed notifications, and audit queue health.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={loadQueue}>
          <RefreshCw color="#003822" size={16} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Pressable key={key} style={[styles.statCard, statusFilter === key && { borderColor: cfg.color, backgroundColor: cfg.color + '0d' }]} onPress={() => setStatusFilter(key as StatusFilter)}>
              <Icon color={cfg.color} size={22} />
              <Text style={[styles.statCount, { color: cfg.color }]}>{stats[key] ?? 0}</Text>
              <Text style={styles.statLabel}>{cfg.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.alertSummaryRow}>
        <View style={[styles.alertSummaryCard, { borderColor: '#ef4444' }]}>
          <Siren color="#ef4444" size={18} />
          <Text style={styles.alertSummaryCount}>{alertStats.critical}</Text>
          <Text style={styles.alertSummaryLabel}>Critical Ops Alerts</Text>
        </View>
        <View style={[styles.alertSummaryCard, { borderColor: '#f59e0b' }]}>
          <AlertCircle color="#f59e0b" size={18} />
          <Text style={styles.alertSummaryCount}>{alertStats.warning}</Text>
          <Text style={styles.alertSummaryLabel}>Warning Ops Alerts</Text>
        </View>
      </View>

      <View style={[styles.alertPanel, Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } as any : {}]}>
        <View style={styles.alertPanelHeader}>
          <View>
            <Text style={styles.alertPanelTitle}>Operational Alerts</Text>
            <Text style={styles.alertPanelSub}>SMS provider failures, stuck shipments, and long-pending suggestions.</Text>
          </View>
        </View>

        {opsAlerts.length === 0 ? (
          <Text style={styles.alertEmpty}>No open operational alerts right now.</Text>
        ) : (
          <View style={styles.alertList}>
            {opsAlerts.slice(0, 12).map((alert) => {
              const isCritical = alert.severity === 'critical';
              const color = isCritical ? '#dc2626' : alert.severity === 'warning' ? '#f59e0b' : '#0ea5e9';
              return (
                <View key={alert.id} style={[styles.alertRow, { borderColor: color + '55', backgroundColor: color + '10' }]}>
                  <View style={styles.alertRowHead}>
                    <View style={[styles.alertSeverityDot, { backgroundColor: color }]} />
                    <Text style={styles.alertRowTitle}>{alert.title}</Text>
                    <View style={[styles.alertSeverityPill, { borderColor: color + '55' }]}>
                      <Text style={[styles.alertSeverityText, { color }]}>{String(alert.severity).toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.alertRowBody}>{alert.message}</Text>
                  <Text style={styles.alertRowMeta}>
                    {alert.alert_type.replace(/_/g, ' ')} • {alert.metadata?.tracking_id || alert.shipment_id || alert.related_notification_id || alert.related_suggestion_id || 'system'}
                  </Text>
                  <View style={styles.alertActions}>
                    {alert.shipment_id ? (
                      <View style={styles.alertRef}>
                        <PackageSearch color="#374151" size={14} />
                        <Text style={styles.alertRefText}>{alert.metadata?.tracking_id || alert.shipment_id}</Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={[styles.alertActionBtn, styles.alertActionSecondary, busyId === alert.id && { opacity: 0.6 }]}
                      onPress={() => handleAcknowledgeAlert(alert)}
                      disabled={busyId === alert.id}
                    >
                      <Text style={styles.alertActionSecondaryText}>Acknowledge</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.alertActionBtn, styles.alertActionPrimary, busyId === alert.id && { opacity: 0.6 }]}
                      onPress={() => handleResolveAlert(alert)}
                      disabled={busyId === alert.id}
                    >
                      <Text style={styles.alertActionPrimaryText}>Resolve</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Filter row */}
      <View style={styles.actionBar}>
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search recipient, body, or template..."
            style={styles.searchInput}
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map(f => (
            <Pressable key={f} style={[styles.filterChip, statusFilter === f && styles.filterChipActive]} onPress={() => setStatusFilter(f)}>
              <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'dead_letter' ? 'Dead Letter' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Table */}
      <View style={[styles.tableContainer, Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } as any : {}]}>
        {loading ? (
          <View style={styles.centerState}><ActivityIndicator color={BRAND.green} size="large" /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerState}>
            <AlertCircle color="#9ca3af" size={36} />
            <Text style={styles.emptyText}>No notifications match this filter.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1100 }}>
              {/* Table header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Recipient</Text>
                <Text style={[styles.colHeader, { flex: 0.8 }]}>Channel</Text>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Template</Text>
                <Text style={[styles.colHeader, { flex: 2 }]}>Body</Text>
                <Text style={[styles.colHeader, { flex: 0.7 }]}>Status</Text>
                <Text style={[styles.colHeader, { flex: 0.5 }]}>Retries</Text>
                <Text style={[styles.colHeader, { flex: 1.1 }]}>Created</Text>
                <Text style={[styles.colHeader, { flex: 0.9, textAlign: 'center' }]}>Actions</Text>
              </View>

              {filtered.map(item => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                const canResend = item.status === 'failed' || item.status === 'dead_letter';
                return (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.cellText, { flex: 1.2 }]}>{item.recipient || 'N/A'}</Text>
                    <Text style={[styles.cellText, { flex: 0.8, textTransform: 'capitalize' }]}>{item.channel || 'sms'}</Text>
                    <Text style={[styles.cellText, { flex: 1.2 }]}>{item.template_key || '—'}</Text>
                    <Text style={[styles.cellText, { flex: 2, color: '#4b5563' }]} numberOfLines={2}>{item.body || '—'}</Text>
                    <View style={{ flex: 0.7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon color={cfg.color} size={14} />
                      <Text style={[styles.cellText, { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
                    </View>
                    <Text style={[styles.cellText, { flex: 0.5, textAlign: 'center' }]}>{item.retry_count ?? 0}</Text>
                    <Text style={[styles.cellText, { flex: 1.1 }]}>{item.created_at ? formatDate(item.created_at) : '—'}</Text>
                    <View style={{ flex: 0.9, alignItems: 'center' }}>
                      {canResend ? (
                        <Pressable
                          style={[styles.resendBtn, busyId === item.id && { opacity: 0.6 }]}
                          onPress={() => handleResend(item)}
                          disabled={busyId === item.id}
                        >
                          <Send size={13} color="#fff" />
                          <Text style={styles.resendBtnText}>{busyId === item.id ? 'Queuing...' : resendSuccess === item.id ? 'Queued ✓' : 'Resend'}</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.noActionText}>—</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  subTitle: { fontSize: 15, color: '#4b5563', maxWidth: 700 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  refreshBtnText: { fontSize: 13, fontWeight: '700', color: '#003822' },
  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 130, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 18, alignItems: 'center', gap: 8, cursor: 'pointer' as any },
  statCount: { fontSize: 32, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'capitalize' },
  alertSummaryRow: { flexDirection: 'row', gap: 14, marginBottom: 16, flexWrap: 'wrap' },
  alertSummaryCard: { minWidth: 180, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 6 },
  alertSummaryCount: { fontSize: 28, fontWeight: '800', color: '#111827' },
  alertSummaryLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  alertPanel: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 20, marginBottom: 16 },
  alertPanelHeader: { marginBottom: 14 },
  alertPanelTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  alertPanelSub: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  alertEmpty: { fontSize: 14, color: '#6b7280' },
  alertList: { gap: 12 },
  alertRow: { borderWidth: 1, borderRadius: 14, padding: 14 },
  alertRowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  alertSeverityDot: { width: 10, height: 10, borderRadius: 5 },
  alertRowTitle: { fontSize: 14, fontWeight: '800', color: '#111827', flex: 1 },
  alertSeverityPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  alertSeverityText: { fontSize: 11, fontWeight: '800' },
  alertRowBody: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 6 },
  alertRowMeta: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  alertActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  alertRef: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 'auto' as any },
  alertRefText: { fontSize: 12, color: '#374151', fontWeight: '700' },
  alertActionBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  alertActionPrimary: { backgroundColor: BRAND.green },
  alertActionPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  alertActionSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  alertActionSecondaryText: { color: '#374151', fontSize: 12, fontWeight: '800' },
  actionBar: { gap: 12, marginBottom: 16 },
  searchBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, height: 44, paddingHorizontal: 14, justifyContent: 'center', maxWidth: 420 },
  searchInput: { color: '#1a1a1a', fontSize: 13, outlineStyle: 'none' as any },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  filterChipActive: { backgroundColor: BRAND.lime, borderColor: BRAND.lime },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  filterChipTextActive: { color: '#002B22' },
  tableContainer: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, flex: 1, minHeight: 400 },
  centerState: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af', fontWeight: '600' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)', paddingBottom: 14, marginBottom: 8 },
  colHeader: { fontWeight: '700', fontSize: 13, color: '#1a1a1a' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)' },
  cellText: { fontSize: 13, color: '#1a1a1a' },
  resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND.green, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  resendBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  noActionText: { fontSize: 13, color: '#d1d5db' },
});
