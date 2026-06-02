import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  AlertCircle,
  Banknote,
  Car,
  CheckCircle2,
  Clock,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';
import {
  fetchDeliverAndEarnAdminData,
  processDeliverAndEarnDispatchBacklog,
  processDeliverAndEarnPayout,
  reviewDeliverAndEarnApplication,
  updateDeliverAndEarnValidation,
  type DeliverAndEarnAdminData,
  type DeliverAndEarnAdminPayout,
  type DeliverAndEarnAdminRow,
} from '../../utils/deliverAndEarnAdmin';

const formatAmount = (amount: number) =>
  `₦${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const statusColor = (status?: string | null) => {
  if (['approved', 'active', 'verified', 'completed', 'paid', 'low', 'resolved', 'dismissed'].includes(status || '')) return '#047857';
  if (['rejected', 'suspended', 'failed', 'expired', 'held', 'high', 'critical'].includes(status || '')) return '#DC2626';
  if (['submitted', 'in_review', 'needs_correction', 'requested', 'processing', 'medium', 'open'].includes(status || '')) return '#B45309';
  return '#4B5563';
};

const statusLabel = (status?: string | null) =>
  status ? status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Not Started';

export default function DeliverAndEarn() {
  const { width } = useWindowDimensions();
  const isCompact = width < 820;
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [data, setData] = useState<DeliverAndEarnAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [validationDates, setValidationDates] = useState({
    insuranceExpiresAt: '',
    roadworthinessExpiresAt: '',
    registrationExpiresAt: '',
  });
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const nextData = await fetchDeliverAndEarnAdminData();
      setData(nextData);
      setMessage('');
    } catch (error) {
      console.error('Failed to load Deliver & Earn admin data', error);
      setMessage('Deliver & Earn admin data is unavailable until the foundation migration is applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = data?.rows ?? [];
    if (!query) return rows;
    return rows.filter((row) => {
      const vehicleText = row.vehicles.map((vehicle) => `${vehicle.plate_number} ${vehicle.make || ''} ${vehicle.model || ''}`).join(' ');
      return [
        row.profiles?.full_name,
        row.profiles?.email,
        row.profiles?.phone_number,
        row.operating_state,
        row.operating_city,
        row.application_status,
        row.operator_status,
        vehicleText,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [data?.rows, search]);

  const handleReview = async (row: DeliverAndEarnAdminRow, action: 'approve' | 'reject' | 'needs_correction' | 'suspend' | 'reactivate') => {
    setBusyId(`${action}:${row.profile_id}`);
    setMessage('');
    try {
      await reviewDeliverAndEarnApplication({
        profileId: row.profile_id,
        action,
        notes: reviewNotes,
        trustTier: row.trust_tier || 'starter',
      });
      setReviewNotes('');
      await loadData();
    } catch (error) {
      console.error('Deliver & Earn review failed', error);
      setMessage(error instanceof Error ? error.message : 'Could not update Deliver & Earn profile.');
    } finally {
      setBusyId('');
    }
  };

  const handleValidationReady = async (row: DeliverAndEarnAdminRow) => {
    const primaryVehicle = row.vehicles[0];
    if (!primaryVehicle) {
      setMessage('A Deliver & Earn operator must register a car before validation can be completed.');
      return;
    }

    setBusyId(`validate:${row.profile_id}`);
    setMessage('');
    try {
      await updateDeliverAndEarnValidation({
        profileId: row.profile_id,
        vehicleId: primaryVehicle.id,
        notes: reviewNotes || 'Admin marked Deliver & Earn validation checks complete.',
        insuranceExpiresAt: validationDates.insuranceExpiresAt,
        roadworthinessExpiresAt: validationDates.roadworthinessExpiresAt,
        registrationExpiresAt: validationDates.registrationExpiresAt,
      });
      setReviewNotes('');
      await loadData();
    } catch (error) {
      console.error('Deliver & Earn validation update failed', error);
      setMessage(error instanceof Error ? error.message : 'Could not update Deliver & Earn validation.');
    } finally {
      setBusyId('');
    }
  };

  const handleDispatchHeartbeat = async () => {
    setBusyId('dispatch-heartbeat');
    setMessage('');
    try {
      const result = await processDeliverAndEarnDispatchBacklog(100);
      await loadData();
      setMessage(`Dispatch heartbeat complete: ${result.expired_offers || 0} expired offers, ${result.offers_created || 0} new offers.`);
    } catch (error) {
      console.error('Deliver & Earn dispatch heartbeat failed', error);
      setMessage(error instanceof Error ? error.message : 'Could not run Deliver & Earn dispatch heartbeat.');
    } finally {
      setBusyId('');
    }
  };

  const handlePayoutStatus = async (
    payout: DeliverAndEarnAdminPayout,
    status: 'approved' | 'paid' | 'held' | 'failed'
  ) => {
    setBusyId(`payout:${status}:${payout.id}`);
    setMessage('');
    try {
      await processDeliverAndEarnPayout({
        payoutId: payout.id,
        status,
        failureReason: status === 'failed' ? reviewNotes : undefined,
      });
      await loadData();
    } catch (error) {
      console.error('Deliver & Earn payout processing failed', error);
      setMessage(error instanceof Error ? error.message : 'Could not process Deliver & Earn payout.');
    } finally {
      setBusyId('');
    }
  };

  const metrics = data?.metrics;

  const statCards = [
    { label: 'Pending Applications', value: String(metrics?.applicationsPending ?? 0), icon: FileCheck2, color: '#B45309' },
    { label: 'Active Operators', value: String(metrics?.activeOperators ?? 0), icon: Users, color: '#047857' },
    { label: 'Online Now', value: String(metrics?.onlineOperators ?? 0), icon: CheckCircle2, color: '#2563EB' },
    { label: 'Active Cars', value: String(metrics?.vehiclesActive ?? 0), icon: Car, color: '#004d3d' },
    { label: 'Queued Dispatch', value: String(metrics?.dispatchBacklog ?? 0), icon: RefreshCw, color: '#0EA5E9' },
    { label: 'Stale Offers', value: String(metrics?.staleOffers ?? 0), icon: AlertCircle, color: '#DC2626' },
    { label: 'Pending Earnings', value: formatAmount(metrics?.pendingEarnings ?? 0), icon: Clock, color: '#B45309' },
    { label: 'Pending Payouts', value: formatAmount(metrics?.pendingPayouts ?? 0), icon: Banknote, color: '#7C3AED' },
    { label: 'Open Incidents', value: String(metrics?.openIncidents ?? 0), icon: ShieldAlert, color: '#DC2626' },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, isCompact && styles.stack]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.pageTitle}>Deliver & Earn</Text>
          <Text style={styles.pageSub}>Public personal-car owners register here, pass RENAX validation, and earn from approved intra-state shipments. This is separate from staff riders and fleet drivers.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.refreshBtn} onPress={handleDispatchHeartbeat} disabled={busyId === 'dispatch-heartbeat'}>
            {busyId === 'dispatch-heartbeat' ? <ActivityIndicator color="#003822" size="small" /> : <RefreshCw size={16} color="#003822" />}
            <Text style={styles.refreshBtnText}>Run Dispatch</Text>
          </Pressable>
          <Pressable style={styles.refreshBtnSecondary} onPress={loadData}>
            <RefreshCw size={16} color="#004d3d" />
            <Text style={styles.refreshBtnSecondaryText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      {message ? (
        <View style={styles.notice}>
          <AlertCircle color="#92400E" size={16} />
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND.green} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
          <View style={styles.statsContainer}>
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <View key={card.label} style={[styles.statCard, glass]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.statLabel}>{card.label}</Text>
                    <Text style={[styles.statValue, { color: card.color }]} adjustsFontSizeToFit numberOfLines={1}>{card.value}</Text>
                  </View>
                  <View style={[styles.iconCircle, { backgroundColor: `${card.color}16` }]}>
                    <Icon color={card.color} size={20} />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.controlsRow, isCompact && styles.stack]}>
            <View style={styles.searchBox}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, phone, plate, state, or status..."
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />
            </View>
            <View style={styles.notesBox}>
              <TextInput
                value={reviewNotes}
                onChangeText={setReviewNotes}
                placeholder="Reviewer note for next action"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />
            </View>
            <View style={styles.expiryGrid}>
              <TextInput
                value={validationDates.insuranceExpiresAt}
                onChangeText={(value) => setValidationDates((current) => ({ ...current, insuranceExpiresAt: value }))}
                placeholder="Insurance expiry YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                style={styles.expiryInput}
              />
              <TextInput
                value={validationDates.roadworthinessExpiresAt}
                onChangeText={(value) => setValidationDates((current) => ({ ...current, roadworthinessExpiresAt: value }))}
                placeholder="Roadworthiness expiry"
                placeholderTextColor="#9CA3AF"
                style={styles.expiryInput}
              />
              <TextInput
                value={validationDates.registrationExpiresAt}
                onChangeText={(value) => setValidationDates((current) => ({ ...current, registrationExpiresAt: value }))}
                placeholder="Registration expiry"
                placeholderTextColor="#9CA3AF"
                style={styles.expiryInput}
              />
            </View>
          </View>

          <View style={[styles.mainGrid, isCompact && styles.stack]}>
            <View style={[styles.panel, glass]}>
              <Text style={styles.sectionTitle}>Applications & Operators</Text>
              <Text style={styles.sectionSub}>Approve only after identity, licence, vehicle, insurance, roadworthiness, and bank payout checks are complete.</Text>

              {filteredRows.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No Deliver & Earn applicants found.</Text>
                </View>
              ) : (
                <View style={styles.operatorList}>
                  {filteredRows.map((row) => (
                    <OperatorRow
                      key={row.profile_id}
                      row={row}
                      busyId={busyId}
                      onReview={handleReview}
                      onValidate={handleValidationReady}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.sidePanel, glass]}>
              <Text style={styles.sectionTitle}>Dispatch Queue</Text>
              <Text style={styles.sectionSub}>Same-state shipments waiting for verified Deliver & Earn operators.</Text>
              <View style={styles.dispatchQueueList}>
                {(data?.dispatchWatchlist ?? []).slice(0, 6).map((item) => (
                  <View key={item.shipment_id} style={styles.dispatchQueueRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.ruleState}>{item.tracking_id || item.shipment_id}</Text>
                      <Text style={styles.ruleMeta}>
                        {item.pickup_city || item.pickup_state || 'Pickup'} to {item.delivery_city || item.delivery_state || 'delivery'} · {item.minutes_waiting || 0} min
                      </Text>
                    </View>
                    <Text style={[styles.statusText, { color: item.live_offer_count > 0 ? '#047857' : '#B45309' }]}>
                      {item.live_offer_count} live · {item.eligible_candidate_count} eligible
                    </Text>
                  </View>
                ))}
                {(data?.dispatchWatchlist ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>No Deliver & Earn shipment is waiting for offers.</Text>
                ) : null}
              </View>

              <Text style={styles.sectionTitle}>State Rules</Text>
              <Text style={styles.sectionSub}>Rollout is state-by-state. Lagos is enabled by default in the foundation migration.</Text>
              <View style={styles.ruleList}>
                {(data?.stateRules ?? []).filter((rule) => rule.enabled).slice(0, 12).map((rule) => (
                  <View key={rule.state} style={styles.ruleRow}>
                    <View>
                      <Text style={styles.ruleState}>{rule.state}</Text>
                      <Text style={styles.ruleMeta}>Max {formatAmount(rule.max_declared_value_ngn_standard)} · {rule.max_weight_kg}kg</Text>
                    </View>
                    <View style={styles.rulePill}>
                      <Text style={styles.rulePillText}>{rule.operator_payout_pct}% payout</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Recent Payouts</Text>
              <View style={styles.ruleList}>
                {(data?.payouts ?? []).slice(0, 6).map((payout) => {
                  const status = String(payout.status || '');
                  const canApprove = ['requested', 'under_review'].includes(status);
                  const canPay = ['approved', 'processing'].includes(status);
                  const canHold = !['paid', 'failed', 'cancelled', 'held'].includes(status);
                  const canFail = !['paid', 'failed', 'cancelled'].includes(status);
                  const payoutBusy = (action: string) => busyId === `payout:${action}:${payout.id}`;

                  return (
                    <View key={payout.id} style={styles.payoutRow}>
                      <View style={styles.payoutTop}>
                        <View>
                          <Text style={styles.ruleState}>{formatAmount(payout.amount)}</Text>
                          <Text style={styles.ruleMeta}>{new Date(payout.requested_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={[styles.statusText, { color: statusColor(payout.status) }]}>{statusLabel(payout.status)}</Text>
                      </View>
                      <View style={styles.payoutActions}>
                        {canApprove ? (
                          <Pressable style={styles.payoutBtnPrimary} onPress={() => handlePayoutStatus(payout, 'approved')} disabled={payoutBusy('approved')}>
                            {payoutBusy('approved') ? <ActivityIndicator color="#002B22" size="small" /> : null}
                            <Text style={styles.payoutBtnPrimaryText}>Approve</Text>
                          </Pressable>
                        ) : null}
                        {canPay ? (
                          <Pressable style={styles.payoutBtnPrimary} onPress={() => handlePayoutStatus(payout, 'paid')} disabled={payoutBusy('paid')}>
                            {payoutBusy('paid') ? <ActivityIndicator color="#002B22" size="small" /> : null}
                            <Text style={styles.payoutBtnPrimaryText}>Paid</Text>
                          </Pressable>
                        ) : null}
                        {canHold ? (
                          <Pressable style={styles.payoutBtnNeutral} onPress={() => handlePayoutStatus(payout, 'held')} disabled={payoutBusy('held')}>
                            <Text style={styles.payoutBtnNeutralText}>Hold</Text>
                          </Pressable>
                        ) : null}
                        {canFail ? (
                          <Pressable style={styles.payoutBtnDanger} onPress={() => handlePayoutStatus(payout, 'failed')} disabled={payoutBusy('failed')}>
                            <Text style={styles.payoutBtnDangerText}>Fail</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Recent Incidents</Text>
              <View style={styles.ruleList}>
                {(data?.incidents ?? []).slice(0, 6).map((incident) => (
                  <View key={incident.id} style={styles.incidentRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.ruleState}>{statusLabel(incident.incident_type)}</Text>
                      <Text style={styles.ruleMeta}>{new Date(incident.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.statusGroup}>
                      <Text style={[styles.statusText, { color: statusColor(incident.severity) }]}>{statusLabel(incident.severity)}</Text>
                      <Text style={[styles.statusText, { color: statusColor(incident.status) }]}>{statusLabel(incident.status)}</Text>
                    </View>
                  </View>
                ))}
                {(data?.incidents ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>No Deliver & Earn incidents recorded.</Text>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function OperatorRow({
  row,
  busyId,
  onReview,
  onValidate,
}: {
  row: DeliverAndEarnAdminRow;
  busyId: string;
  onReview: (row: DeliverAndEarnAdminRow, action: 'approve' | 'reject' | 'needs_correction' | 'suspend' | 'reactivate') => void;
  onValidate: (row: DeliverAndEarnAdminRow) => void;
}) {
  const primaryVehicle = row.vehicles[0];
  const title = row.profiles?.full_name || row.profiles?.email || row.profile_id;
  const isBusy = (action: string) => busyId === `${action}:${row.profile_id}`;
  const validationReady =
    row.identity_status === 'verified' &&
    row.licence_status === 'verified' &&
    row.bank_status === 'verified' &&
    row.training_status === 'completed' &&
    primaryVehicle?.vehicle_status === 'active' &&
    primaryVehicle?.inspection_status === 'verified';
  const canApprove = validationReady && ['submitted', 'in_review', 'needs_correction'].includes(row.application_status);
  const canReactivate = validationReady && row.operator_status === 'suspended' && row.application_status === 'approved';

  return (
    <View style={styles.operatorRow}>
      <View style={styles.operatorTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.operatorName}>{title}</Text>
          <Text style={styles.operatorMeta}>
            {row.operating_city || 'City pending'}, {row.operating_state} · {row.profiles?.phone_number || 'No phone'}
          </Text>
        </View>
        <View style={styles.statusGroup}>
          <Text style={[styles.statusText, { color: statusColor(row.application_status) }]}>{statusLabel(row.application_status)}</Text>
          <Text style={[styles.statusText, { color: statusColor(row.operator_status) }]}>{statusLabel(row.operator_status)}</Text>
        </View>
      </View>

      <View style={styles.vehicleStrip}>
        <Car size={16} color="#004d3d" />
        <Text style={styles.vehicleText}>
          {primaryVehicle
            ? `${primaryVehicle.plate_number} · ${primaryVehicle.vehicle_type} · ${primaryVehicle.make || 'Make'} ${primaryVehicle.model || ''} · ${statusLabel(primaryVehicle.vehicle_status)}`
            : 'No car registered yet'}
        </Text>
      </View>

      <View style={styles.checkGrid}>
        {[
          ['Identity', row.identity_status],
          ['Licence', row.licence_status],
          ['Training', row.training_status],
          ['Bank', row.bank_status],
          ['Car', primaryVehicle?.vehicle_status || 'missing'],
          ['Inspect', primaryVehicle?.inspection_status || 'not_started'],
          ['Trust', row.trust_tier],
          ['Completed', String(row.total_completed_shipments)],
        ].map(([label, value]) => (
          <View key={label} style={styles.checkItem}>
            <Text style={styles.checkLabel}>{label}</Text>
            <Text style={[styles.checkValue, { color: statusColor(value) }]}>{statusLabel(value)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionRow}>
        {canApprove ? (
          <Pressable style={styles.approveBtn} onPress={() => onReview(row, 'approve')} disabled={isBusy('approve')}>
            {isBusy('approve') ? <ActivityIndicator color="#002B22" size="small" /> : <ShieldCheck color="#002B22" size={15} />}
            <Text style={styles.approveBtnText}>Approve</Text>
          </Pressable>
        ) : null}
        {!validationReady && primaryVehicle ? (
          <Pressable style={styles.approveBtn} onPress={() => onValidate(row)} disabled={busyId === `validate:${row.profile_id}`}>
            {busyId === `validate:${row.profile_id}` ? <ActivityIndicator color="#002B22" size="small" /> : <FileCheck2 color="#002B22" size={15} />}
            <Text style={styles.approveBtnText}>Validate Checks</Text>
          </Pressable>
        ) : null}
        {canReactivate ? (
          <Pressable style={styles.approveBtn} onPress={() => onReview(row, 'reactivate')} disabled={isBusy('reactivate')}>
            <ShieldCheck color="#002B22" size={15} />
            <Text style={styles.approveBtnText}>Reactivate</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.neutralBtn} onPress={() => onReview(row, 'needs_correction')} disabled={isBusy('needs_correction')}>
          <Text style={styles.neutralBtnText}>Correction</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={() => onReview(row, row.operator_status === 'active' ? 'suspend' : 'reject')} disabled={isBusy('suspend') || isBusy('reject')}>
          <Text style={styles.dangerBtnText}>{row.operator_status === 'active' ? 'Suspend' : 'Reject'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stack: { flexDirection: 'column' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 18 },
  pageTitle: { fontSize: 32, fontWeight: '800', color: BRAND.text },
  pageSub: { marginTop: 6, fontSize: 15, lineHeight: 22, color: BRAND.subtext, maxWidth: 820 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ccfd3a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  refreshBtnText: { color: '#003822', fontWeight: '800', fontSize: 13 },
  refreshBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  refreshBtnSecondaryText: { color: '#004d3d', fontWeight: '800', fontSize: 13 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 8, padding: 12, marginBottom: 16 },
  noticeText: { flex: 1, color: '#92400E', fontSize: 13, lineHeight: 19 },
  centerState: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  statCard: { minWidth: 190, flex: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statLabel: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  statValue: { marginTop: 7, fontSize: 24, fontWeight: '900' },
  iconCircle: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  controlsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  searchBox: { flex: 1.4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8 },
  notesBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8 },
  searchInput: { paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: '#111827' },
  expiryGrid: { flex: 1.4, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expiryInput: { flex: 1, minWidth: 130, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 13, fontSize: 13, color: '#111827' },
  mainGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  panel: { flex: 1.6, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 18 },
  sidePanel: { flex: 0.9, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 18 },
  sectionTitle: { color: BRAND.text, fontSize: 18, fontWeight: '800' },
  sectionSub: { marginTop: 4, marginBottom: 14, color: BRAND.subtext, fontSize: 13, lineHeight: 20 },
  emptyState: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 14 },
  operatorList: { gap: 12 },
  operatorRow: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 14, backgroundColor: '#fff', gap: 12 },
  operatorTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  operatorName: { color: '#111827', fontSize: 16, fontWeight: '800' },
  operatorMeta: { marginTop: 4, color: '#6B7280', fontSize: 13 },
  statusGroup: { alignItems: 'flex-end', gap: 3 },
  statusText: { fontSize: 12, fontWeight: '800' },
  vehicleStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 10 },
  vehicleText: { flex: 1, color: '#374151', fontSize: 13, lineHeight: 19 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkItem: { minWidth: 110, flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10 },
  checkLabel: { color: '#6B7280', fontSize: 11, fontWeight: '700' },
  checkValue: { marginTop: 4, color: '#111827', fontSize: 13, fontWeight: '800' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#ccfd3a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  approveBtnText: { color: '#002B22', fontSize: 12, fontWeight: '900' },
  neutralBtn: { borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  neutralBtnText: { color: '#374151', fontSize: 12, fontWeight: '800' },
  dangerBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  dangerBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '900' },
  ruleList: { gap: 10 },
  dispatchQueueList: { gap: 10, marginBottom: 18 },
  dispatchQueueRow: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff', padding: 10, gap: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F7', paddingBottom: 10, gap: 12 },
  ruleState: { color: '#111827', fontSize: 14, fontWeight: '800' },
  ruleMeta: { marginTop: 3, color: '#6B7280', fontSize: 12 },
  rulePill: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  rulePillText: { color: '#047857', fontSize: 11, fontWeight: '900' },
  payoutRow: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7', paddingBottom: 10, gap: 8 },
  payoutTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  payoutActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
  incidentRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7', paddingBottom: 10 },
  payoutBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ccfd3a', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  payoutBtnPrimaryText: { color: '#002B22', fontSize: 11, fontWeight: '900' },
  payoutBtnNeutral: { borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  payoutBtnNeutralText: { color: '#374151', fontSize: 11, fontWeight: '800' },
  payoutBtnDanger: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  payoutBtnDangerText: { color: '#DC2626', fontSize: 11, fontWeight: '900' },
});
