import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, CheckCircle, Search, ShieldOff, X, XCircle } from 'lucide-react-native';
import { supabase } from '../../supabase';
import { BRAND } from '../../constants/Theme';

/* ─── Types ────────────────────────────────────────────────────────── */
interface CustomerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  role: string;
  is_restricted: boolean | null;
  created_at: string;
  shipment_count?: number;
  last_shipment?: string | null;
}

interface Shipment {
  id: string;
  pickup: string;
  dropoff: string;
  status: string;
  price: string;
  created_at: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
const fmt = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusColor = (s: string) => {
  if (s === 'completed') return '#10b981';
  if (s === 'in_progress') return '#3b82f6';
  if (s === 'pending') return '#f59e0b';
  return '#9ca3af';
};

/* ─── Toast ─────────────────────────────────────────────────────────── */
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <View style={[toastSt.wrap, { backgroundColor: type === 'success' ? '#10b981' : '#ef4444' }]}>
      {type === 'success' ? <CheckCircle size={16} color="#fff" /> : <XCircle size={16} color="#fff" />}
      <Text style={toastSt.text}>{msg}</Text>
    </View>
  );
}
const toastSt = StyleSheet.create({
  wrap: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, zIndex: 9999, elevation: 20 },
  text: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─── Customer Detail Modal ──────────────────────────────────────────── */
function CustomerModal({
  customer,
  onClose,
  onToggleRestrict,
}: {
  customer: CustomerProfile;
  onClose: () => void;
  onToggleRestrict: (id: string, restrict: boolean) => Promise<void>;
}) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [toggling, setToggling] = useState(false);
  const glass = Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px)' } as any) : {};

  useEffect(() => {
    (async () => {
      setLoadingShipments(true);
      const { data } = await supabase
        .from('shipments')
        .select('id, pickup, dropoff, status, price, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setShipments(data ?? []);
      setLoadingShipments(false);
    })();
  }, [customer.id]);

  const handleToggle = async () => {
    setToggling(true);
    await onToggleRestrict(customer.id, !customer.is_restricted);
    setToggling(false);
    onClose();
  };

  const isRestricted = !!customer.is_restricted;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={[modal.sheet, glass]}>
          {/* Header */}
          <View style={modal.header}>
            <View>
              <Text style={modal.name}>{customer.full_name || 'Unnamed Customer'}</Text>
              <Text style={modal.sub}>{customer.email || '—'}</Text>
            </View>
            <Pressable onPress={onClose} style={modal.closeBtn}>
              <X size={20} color="#666" />
            </Pressable>
          </View>

          {/* Info Grid */}
          <View style={modal.infoGrid}>
            <View style={modal.infoCell}>
              <Text style={modal.infoLabel}>Phone</Text>
              <Text style={modal.infoValue}>{customer.phone_number || '—'}</Text>
            </View>
            <View style={modal.infoCell}>
              <Text style={modal.infoLabel}>Joined</Text>
              <Text style={modal.infoValue}>{fmt(customer.created_at)}</Text>
            </View>
            <View style={modal.infoCell}>
              <Text style={modal.infoLabel}>Total Shipments</Text>
              <Text style={modal.infoValue}>{customer.shipment_count ?? '—'}</Text>
            </View>
            <View style={modal.infoCell}>
              <Text style={modal.infoLabel}>Last Shipment</Text>
              <Text style={modal.infoValue}>{fmt(customer.last_shipment)}</Text>
            </View>
          </View>

          {/* Status Banner */}
          <View style={[modal.statusBanner, isRestricted ? modal.restrictedBanner : modal.activeBanner]}>
            {isRestricted ? (
              <><AlertTriangle size={16} color="#ef4444" /><Text style={[modal.statusBannerText, { color: '#ef4444' }]}>This account is currently FROZEN. The customer cannot log in or place shipments.</Text></>
            ) : (
              <><CheckCircle size={16} color="#10b981" /><Text style={[modal.statusBannerText, { color: '#10b981' }]}>Account is ACTIVE. Customer can use all services normally.</Text></>
            )}
          </View>

          {/* Shipment History */}
          <Text style={modal.sectionTitle}>Shipment History</Text>
          {loadingShipments ? (
            <ActivityIndicator color={BRAND.green} style={{ marginVertical: 20 }} />
          ) : shipments.length === 0 ? (
            <Text style={modal.emptyText}>No shipments found for this customer.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {shipments.map((s) => (
                <View key={s.id} style={modal.shipRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={modal.shipRoute} numberOfLines={1}>{s.pickup} → {s.dropoff}</Text>
                    <Text style={modal.shipDate}>{fmt(s.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={modal.shipPrice}>{s.price || '—'}</Text>
                    <View style={[modal.shipStatus, { backgroundColor: statusColor(s.status) + '22' }]}>
                      <Text style={[modal.shipStatusText, { color: statusColor(s.status) }]}>{s.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Action Buttons */}
          <View style={modal.actions}>
            <Pressable
              style={[modal.actionBtn, isRestricted ? modal.unrestrictBtn : modal.restrictBtn]}
              onPress={handleToggle}
              disabled={toggling}
            >
              {toggling ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <ShieldOff size={16} color="#fff" />
                  <Text style={modal.actionBtnText}>
                    {isRestricted ? 'Unfreeze Account' : 'Freeze Account'}
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 640, elevation: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  name: { fontSize: 22, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  infoCell: { flex: 1, minWidth: 140, backgroundColor: '#f9fafb', borderRadius: 12, padding: 14 },
  infoLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { fontSize: 15, color: '#111827', fontWeight: '700' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 20 },
  activeBanner: { backgroundColor: '#d1fae5' },
  restrictedBanner: { backgroundColor: '#fee2e2' },
  statusBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 12 },
  emptyText: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  shipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  shipRoute: { fontSize: 13, fontWeight: '600', color: '#111827', maxWidth: 260 },
  shipDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  shipPrice: { fontSize: 13, fontWeight: '700', color: '#111827' },
  shipStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  shipStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  restrictBtn: { backgroundColor: '#ef4444' },
  unrestrictBtn: { backgroundColor: '#10b981' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cancelBtnText: { color: '#6b7280', fontWeight: '700', fontSize: 14 },
});

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function Customers() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'restricted'>('all');
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const glass = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as any) : {};

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      // Get all customer profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, role, is_restricted, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!profiles) { setCustomers([]); return; }

      // Get shipment counts per customer in one query
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('customer_id, created_at')
        .in('customer_id', profiles.map((p) => p.id));

      // Aggregate counts and last shipment dates
      const countMap: Record<string, { count: number; last: string | null }> = {};
      (shipmentData ?? []).forEach((s) => {
        if (!countMap[s.customer_id]) countMap[s.customer_id] = { count: 0, last: null };
        countMap[s.customer_id].count += 1;
        if (!countMap[s.customer_id].last || s.created_at > countMap[s.customer_id].last!) {
          countMap[s.customer_id].last = s.created_at;
        }
      });

      const enriched = profiles.map((p) => ({
        ...p,
        shipment_count: countMap[p.id]?.count ?? 0,
        last_shipment: countMap[p.id]?.last ?? null,
      }));

      setCustomers(enriched);
    } catch (e: any) {
      showToast(e.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleToggleRestrict = async (id: string, restrict: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_restricted: restrict })
      .eq('id', id);

    if (error) {
      showToast('Failed to update account status', 'error');
      return;
    }
    showToast(restrict ? 'Account frozen successfully' : 'Account restored successfully', 'success');
    await fetchCustomers();
  };

  // Filtered list
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (c.full_name ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone_number ?? '').toLowerCase().includes(q);
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !c.is_restricted) ||
      (statusFilter === 'restricted' && !!c.is_restricted);
    return matchSearch && matchStatus;
  });

  // KPI Counts (from live data)
  const totalCount = customers.length;
  const activeCount = customers.filter((c) => !c.is_restricted).length;
  const restrictedCount = customers.filter((c) => !!c.is_restricted).length;
  const thisMonth = customers.filter((c) => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <View style={styles.container}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Page Header */}
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Customers</Text>
        <Pressable style={styles.refreshBtn} onPress={fetchCustomers}>
          <Text style={styles.refreshBtnText}>↻ Refresh</Text>
        </Pressable>
      </View>

      {/* KPI Cards */}
      <View style={styles.statsContainer}>
        {[
          { label: 'Total Customers', value: totalCount, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
          { label: 'Active Accounts', value: activeCount, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
          { label: 'Frozen Accounts', value: restrictedCount, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'New This Month', value: thisMonth, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, glass, { borderLeftColor: stat.color, backgroundColor: stat.bg }]}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={[styles.statValue, { color: stat.color }]}>
              {loading ? '—' : stat.value.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      {/* Search + Filter Bar */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Search size={16} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email or phone..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <X size={16} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filterRow}>
          {(['all', 'active', 'restricted'] as const).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Table */}
      <View style={[styles.tableContainer, glass]}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={BRAND.green} />
            <Text style={styles.loadingText}>Loading customers from database…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Text style={{ fontSize: 32 }}>👥</Text>
            <Text style={styles.loadingText}>
              {search || statusFilter !== 'all' ? 'No customers match your filters.' : 'No customer accounts found.'}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1100 }}>
              {/* Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { flex: 1.8 }]}>Full Name</Text>
                <Text style={[styles.colHeader, { flex: 2 }]}>Email</Text>
                <Text style={[styles.colHeader, { flex: 1.6 }]}>Phone</Text>
                <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>Shipments</Text>
                <Text style={[styles.colHeader, { flex: 1.3 }]}>Last Shipment</Text>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Joined</Text>
                <Text style={[styles.colHeader, { flex: 1 }]}>Status</Text>
                <Text style={[styles.colHeader, { flex: 1.4, textAlign: 'center' }]}>Actions</Text>
              </View>

              {/* Rows */}
              {filtered.map((c) => {
                const restricted = !!c.is_restricted;
                return (
                  <View key={c.id} style={styles.tableRow}>
                    <Text style={[styles.cellText, { flex: 1.8, fontWeight: '700' }]}>
                      {c.full_name || 'Unnamed'}
                    </Text>
                    <Text style={[styles.cellText, { flex: 2 }]} numberOfLines={1}>
                      {c.email || '—'}
                    </Text>
                    <Text style={[styles.cellText, { flex: 1.6 }]}>
                      {c.phone_number || '—'}
                    </Text>
                    <Text style={[styles.cellText, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>
                      {c.shipment_count ?? 0}
                    </Text>
                    <Text style={[styles.cellText, { flex: 1.3 }]}>{fmt(c.last_shipment)}</Text>
                    <Text style={[styles.cellText, { flex: 1.2 }]}>{fmt(c.created_at)}</Text>

                    <View style={{ flex: 1 }}>
                      <View style={[styles.pill, restricted ? styles.pillRestricted : styles.pillActive]}>
                        <Text style={styles.pillText}>{restricted ? 'Frozen' : 'Active'}</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1.4, flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                      <TouchableOpacity
                        style={styles.btnView}
                        onPress={() => setSelected(c)}
                      >
                        <Text style={styles.btnViewText}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnToggle, restricted ? styles.btnUnfreeze : styles.btnFreeze]}
                        onPress={() => handleToggleRestrict(c.id, !restricted)}
                      >
                        <Text style={styles.btnToggleText}>
                          {restricted ? 'Unfreeze' : 'Freeze'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Customer Detail Modal */}
      {selected && (
        <CustomerModal
          customer={selected}
          onClose={() => setSelected(null)}
          onToggleRestrict={handleToggleRestrict}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  refreshBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  refreshBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  statsContainer: { flexDirection: 'row', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 180, borderRadius: 14, padding: 20, borderLeftWidth: 4, elevation: 2 },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  statValue: { fontSize: 32, fontWeight: '800' },
  toolbar: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  searchWrap: { flex: 1, minWidth: 240, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', outlineStyle: 'none' } as any,
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  filterChipActive: { backgroundColor: BRAND.green, borderColor: BRAND.green },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: '#fff' },
  tableContainer: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 20, flex: 1, elevation: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  loadingText: { color: '#9ca3af', fontSize: 15, fontWeight: '500' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.07)', paddingBottom: 14, marginBottom: 4 },
  colHeader: { fontWeight: '700', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  cellText: { fontSize: 14, color: '#1a1a1a' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  pillActive: { backgroundColor: '#d1fae5' },
  pillRestricted: { backgroundColor: '#fee2e2' },
  pillText: { fontSize: 11, fontWeight: '700', color: '#111827' },
  btnView: { backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7 },
  btnViewText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  btnToggle: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7 },
  btnFreeze: { backgroundColor: '#fee2e2' },
  btnUnfreeze: { backgroundColor: '#d1fae5' },
  btnToggleText: { fontSize: 12, fontWeight: '700', color: '#111827' },
});
