import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, RefreshCw } from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';
import { loadAdminSettings, saveAdminSettings } from '../../utils/adminData';

const CURRENCY_OPTIONS = ['NGN', 'USD', 'GHS'];
const TIMEZONE_OPTIONS = ['Africa/Lagos', 'UTC', 'America/New_York'];
const LANGUAGE_OPTIONS = ['English', 'French'];
const DATE_FORMAT_OPTIONS = ['DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD'];
const SESSION_TIMEOUT_OPTIONS = [15, 30, 45, 60];
const PAYMENT_GATEWAYS = ['Flutterwave', 'Paystack', 'Manual'];
const PAYOUT_SCHEDULES = ['Daily', 'Weekly (Every Friday)', 'Bi-Weekly', 'Monthly'];

type SettingsState = Record<string, any>;

export default function Settings() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const data = await loadAdminSettings();
      setSettings(data);
    } catch (error: any) {
      setBanner({ type: 'error', text: error?.message || 'Could not load admin settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateField = useCallback((key: string, value: any) => {
    setSettings((current) => ({ ...(current || {}), [key]: value }));
  }, []);

  const saveChanges = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setBanner(null);
    try {
      await saveAdminSettings(settings);
      setBanner({ type: 'success', text: 'Admin settings saved successfully.' });
    } catch (error: any) {
      setBanner({ type: 'error', text: error?.message || 'Failed to save admin settings.' });
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const companySummary = useMemo(() => {
    if (!settings) return [];
    return [
      { label: 'Company Name', value: settings.companyName },
      { label: 'Address', value: settings.companyAddress },
      { label: 'Phone', value: settings.companyPhone },
      { label: 'Email', value: settings.companyEmail },
    ];
  }, [settings]);

  if (loading || !settings) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Settings</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryBtn} onPress={loadSettings}>
            <RefreshCw size={16} color="#111827" />
            <Text style={styles.secondaryBtnText}>Reload</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={saveChanges} disabled={saving}>
            <Check size={16} color={BRAND.green} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </Pressable>
        </View>
      </View>

      {banner ? (
        <View style={[styles.banner, banner.type === 'success' ? styles.bannerSuccess : styles.bannerError]}>
          <Text style={[styles.bannerText, banner.type === 'success' ? styles.bannerTextSuccess : styles.bannerTextError]}>{banner.text}</Text>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.gridLayout}>
          <View style={[styles.columnView, isCompact && styles.columnViewCompact]}>
            <View style={[styles.card, glass]}>
              <Text style={styles.cardTitle}>Company Profile</Text>
              <View style={styles.profileBox}>
                <View style={styles.logoContainer}>
                  <Image source={require('../../assets/images/logo.jpg')} style={{ width: 110, height: 44 }} resizeMode="contain" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  {companySummary.map((item) => (
                    <Text key={item.label} style={styles.infoText}>
                      <Text style={styles.infoBold}>{item.label}:</Text> {item.value}
                    </Text>
                  ))}
                </View>
              </View>
              <View style={styles.formGrid}>
                <LabeledInput label="Company Name" value={settings.companyName} onChangeText={(value) => updateField('companyName', value)} />
                <LabeledInput label="Company Phone" value={settings.companyPhone} onChangeText={(value) => updateField('companyPhone', value)} />
                <LabeledInput label="Company Email" value={settings.companyEmail} onChangeText={(value) => updateField('companyEmail', value)} keyboardType="email-address" />
                <LabeledInput label="Company Address" value={settings.companyAddress} onChangeText={(value) => updateField('companyAddress', value)} multiline />
              </View>
            </View>

            <View style={[styles.card, glass]}>
              <Text style={styles.cardTitle}>Notification Settings</Text>
              <ToggleRow label="Email Notifications" value={settings.emailAlerts} onValueChange={(value) => updateField('emailAlerts', value)} />
              <ToggleRow label="SMS Alerts" value={settings.smsAlerts} onValueChange={(value) => updateField('smsAlerts', value)} />
              <ToggleRow label="Push Alerts" value={settings.pushAlerts} onValueChange={(value) => updateField('pushAlerts', value)} />
            </View>

            <View style={[styles.card, glass]}>
              <Text style={styles.cardTitle}>Security Settings</Text>
              <ToggleRow label="Two-Factor Authentication" value={settings.twoFactorEnabled} onValueChange={(value) => updateField('twoFactorEnabled', value)} />
              <LabeledInput
                label="Password Policy"
                value={settings.passwordPolicy}
                onChangeText={(value) => updateField('passwordPolicy', value)}
                multiline
              />
            </View>
          </View>

          <View style={[styles.columnView, isCompact && styles.columnViewCompact]}>
            <View style={[styles.card, glass]}>
              <Text style={styles.cardTitle}>General Settings</Text>
              <View style={styles.formGrid}>
                <SelectGroup label="Default Currency" value={settings.defaultCurrency} options={CURRENCY_OPTIONS} onChange={(value) => updateField('defaultCurrency', value)} />
                <SelectGroup label="Time Zone" value={settings.timeZone} options={TIMEZONE_OPTIONS} onChange={(value) => updateField('timeZone', value)} />
                <SelectGroup label="Language" value={settings.language} options={LANGUAGE_OPTIONS} onChange={(value) => updateField('language', value)} />
                <SelectGroup label="Date Format" value={settings.dateFormat} options={DATE_FORMAT_OPTIONS} onChange={(value) => updateField('dateFormat', value)} />
                <SelectGroup
                  label="Session Timeout"
                  value={`${settings.sessionTimeoutMinutes} Minutes`}
                  options={SESSION_TIMEOUT_OPTIONS.map((value) => `${value} Minutes`)}
                  onChange={(value) => updateField('sessionTimeoutMinutes', Number(String(value).replace(/\D/g, '')))}
                />
              </View>
            </View>

            <View style={[styles.card, glass]}>
              <Text style={styles.cardTitle}>Payment & Billing</Text>
              <View style={styles.formGrid}>
                <SelectGroup label="Payment Gateway" value={settings.paymentGateway} options={PAYMENT_GATEWAYS} onChange={(value) => updateField('paymentGateway', value)} />
                <SelectGroup label="Payout Schedule" value={settings.payoutSchedule} options={PAYOUT_SCHEDULES} onChange={(value) => updateField('payoutSchedule', value)} />
                <LabeledInput
                  label="Commission Rate (%)"
                  value={String(settings.commissionRate)}
                  onChangeText={(value) => updateField('commissionRate', Number(value.replace(/[^\d.]/g, '')) || 0)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={[styles.card, glass]}>
              <Text style={styles.cardTitle}>Operational Notes</Text>
              <Text style={styles.supportingText}>
                These settings now persist for the admin app, drive the finance/preferences surfaces, and are ready to be wrapped with stricter auth and RLS once the build phase is complete.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.labelDark}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.textInput, multiline && styles.textArea]}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.labelDark}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
        thumbColor={value ? BRAND.green : '#F9FAFB'}
      />
    </View>
  );
}

function SelectGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.labelDark}>{label}</Text>
      <View style={styles.optionWrap}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable key={option} style={[styles.optionChip, active && styles.optionChipActive]} onPress={() => onChange(option)}>
              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 320 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  secondaryBtnText: { color: '#111827', fontWeight: '700', fontSize: 14 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BRAND.lime, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  saveBtnText: { color: BRAND.green, fontWeight: '800', fontSize: 14 },
  banner: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 18 },
  bannerSuccess: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  bannerError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  bannerText: { fontSize: 13, fontWeight: '700' },
  bannerTextSuccess: { color: '#047857' },
  bannerTextError: { color: '#B91C1C' },
  gridLayout: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  columnView: { flex: 1, minWidth: 400, gap: 24 },
  columnViewCompact: { minWidth: '100%' as any },
  card: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, elevation: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  profileBox: { flexDirection: 'row', gap: 20, marginBottom: 22, alignItems: 'center', flexWrap: 'wrap' },
  logoContainer: { padding: 10, backgroundColor: '#00281a', borderRadius: 8 },
  infoText: { color: '#4B5568', fontSize: 14, marginBottom: 6 },
  infoBold: { fontWeight: '700', color: '#1a1a1a' },
  formGrid: { gap: 18 },
  inputGroup: { gap: 8 },
  labelDark: { fontWeight: '700', color: '#1a1a1a', fontSize: 14 },
  textInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', color: '#111827', fontSize: 14 },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  optionChipActive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  optionChipText: { fontSize: 13, color: '#374151', fontWeight: '700' },
  optionChipTextActive: { color: BRAND.green },
  supportingText: { color: '#4B5568', fontSize: 14, lineHeight: 22 },
});
