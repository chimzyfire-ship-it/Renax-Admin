import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AdminAuthScreen from '../components/admin/AdminAuthScreen';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../components/admin/AdminDashboard';
import TrackShipments from '../components/admin/TrackShipments';
import RidersDrivers from '../components/admin/RidersDrivers';
import AgroTransport from '../components/admin/AgroTransport';
import Customers from '../components/admin/Customers';
import AnalyticsReports from '../components/admin/AnalyticsReports';
import EarningsFinance from '../components/admin/EarningsFinance';
import Settings from '../components/admin/Settings';
import Shipments from '../components/admin/Shipments';
import Terminals from '../components/admin/Terminals';
import NotificationQueue from '../components/admin/NotificationQueue';
import { BRAND } from '../constants/Theme';
import { supabase } from '../supabase';

function resolveClaimRole(user: any) {
  const directRole = user?.app_metadata?.role;
  if (typeof directRole === 'string' && directRole.trim()) {
    return directRole.trim().toLowerCase();
  }

  const roles = user?.app_metadata?.roles;
  if (Array.isArray(roles)) {
    const normalizedRoles = roles
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim().toLowerCase());

    if (normalizedRoles.includes('admin')) return 'admin';
    if (normalizedRoles.includes('driver')) return 'driver';
    if (normalizedRoles.includes('rider')) return 'rider';
    if (normalizedRoles.includes('customer')) return 'customer';
  }

  return null;
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#020f09', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={BRAND.lime} size="large" />
    </View>
  );
}

function AdminAccessNotice({ email }: { email?: string | null }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#020f09', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ width: '100%', maxWidth: 520, backgroundColor: 'rgba(2, 15, 9, 0.95)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24 }}>
        <Text style={{ color: BRAND.lime, fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🔒</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
          Admin claim required
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 16 }}>
          This account signed in successfully, but the backend still does not see a valid admin role claim on its session.
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 }}>
          Signed-in account: {email || 'unknown'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 }}>
          To use protected admin actions, this user needs `app_metadata.role = admin` or an `app_metadata.roles` entry containing `admin`.
        </Text>
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [currentMenu, setCurrentMenu] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setHasAdminClaim(resolveClaimRole(nextSession?.user) === 'admin');
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setHasAdminClaim(resolveClaimRole(nextSession?.user) === 'admin');
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;

  if (!session) {
    return <AdminAuthScreen onAuthenticated={() => {}} />;
  }

  if (!hasAdminClaim) {
    return <AdminAccessNotice email={session?.user?.email || null} />;
  }

  const renderContent = () => {
    switch (currentMenu) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'track_shipments':
        return <TrackShipments />;
      case 'terminals':
        return <Terminals />;
      case 'riders':
        return <RidersDrivers />;
      case 'agro':
        return <AgroTransport />;
      case 'customers':
        return <Customers />;
      case 'analytics':
        return <AnalyticsReports />;
      case 'earnings':
        return <EarningsFinance />;
      case 'settings':
        return <Settings />;
      case 'shipments':
        return <Shipments />;
      case 'notif_queue':
        return <NotificationQueue />;
      default:
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: BRAND.text, fontWeight: '600' }}>
              {currentMenu.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={{ fontSize: 16, color: BRAND.subtext, marginTop: 10 }}>
              Module in development
            </Text>
          </View>
        );
    }
  };

  return (
    <AdminLayout
      currentMenu={currentMenu}
      onMenuChange={(menu) => setCurrentMenu(menu)}
      onLogout={() => supabase.auth.signOut()}
    >
      {renderContent()}
    </AdminLayout>
  );
}
