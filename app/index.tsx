import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import AdminAuthScreen from '../components/admin/AdminAuthScreen';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../components/admin/AdminDashboard';
import TrackShipments from '../components/admin/TrackShipments';
import RidersDrivers from '../components/admin/RidersDrivers';
import DeliverAndEarn from '../components/admin/DeliverAndEarn';
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

function createFallbackAdminContext(user: any, authIssue: string) {
  return {
    admin_id: user?.id || null,
    roles: ['admin_claim'],
    permissions: ['*'],
    terminal_scopes: [],
    bootstrap_mode: true,
    authIssue,
  };
}

function AdminAccessNotice({ email, onSignOut }: { email?: string | null; onSignOut: () => void }) {
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
        <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 12 }}>
          Signed-in account: {email || 'unknown'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 }}>
          To use protected admin actions, this user needs `app_metadata.role = admin` or an `app_metadata.roles` entry containing `admin`.
        </Text>
        <Pressable
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#c5e200' : BRAND.lime,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: BRAND.lime,
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 3,
          })}
          onPress={onSignOut}
        >
          <Text style={{ color: BRAND.green, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}>
            Sign Out & Switch Account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [adminContext, setAdminContext] = useState<any>(null);
  const [authIssue, setAuthIssue] = useState('');
  const [currentMenu, setCurrentMenu] = useState<string>('dashboard');
  const [shipmentFocus, setShipmentFocus] = useState<{
    shipmentId?: string;
    stage?: string;
    terminalId?: string;
    version: number;
  }>({ version: 0 });

  const handleLogout = async () => {
    setSession(null);
    setHasAdminClaim(false);
    setAdminContext(null);
    setAuthIssue('');
    setCurrentMenu('dashboard');
    setShipmentFocus({ version: 0 });

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Admin logout failed after local reset', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const finishLoading = () => {
      if (isMounted) setLoading(false);
    };

    const applySession = async (nextSession: any) => {
      if (!isMounted) return;

      setSession(nextSession);
      setAuthIssue('');

      const nextHasAdminClaim = resolveClaimRole(nextSession?.user) === 'admin';
      setHasAdminClaim(nextHasAdminClaim);

      if (!nextSession) {
        setAdminContext(null);
        finishLoading();
        return;
      }

      if (!nextHasAdminClaim) {
        setAdminContext(null);
        finishLoading();
        return;
      }

      try {
        const { data, error } = await supabase.rpc('current_admin_context');
        if (!isMounted) return;
        if (error) {
          console.error('Failed to load admin context', error);
          const issue = error.message || 'Admin context could not be loaded.';
          setAdminContext(createFallbackAdminContext(nextSession.user, issue));
          setAuthIssue(issue);
        } else {
          const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
          if (!data || (!data.bootstrap_mode && permissions.length === 0)) {
            const issue = 'This admin session has a valid admin claim, but no RBAC permissions were returned. Navigation is available, but protected data may appear empty until this account is assigned an admin staff role.';
            setAdminContext(createFallbackAdminContext(nextSession.user, issue));
            setAuthIssue(issue);
          } else {
            setAdminContext(data);
          }
        }
      } catch (error) {
        console.error('Admin context request failed', error);
        if (isMounted) {
          const issue = error instanceof Error ? error.message : 'Admin context request failed.';
          setAdminContext(createFallbackAdminContext(nextSession.user, issue));
          setAuthIssue(issue);
        }
      } finally {
        finishLoading();
      }
    };

    const bootTimeout = setTimeout(() => {
      if (!isMounted) return;
      setAuthIssue('Admin session check timed out. Refresh the page, or sign in again if the session is stale.');
      setLoading(false);
    }, 8000);

    supabase.auth.getSession()
      .then(({ data: { session: nextSession } }) => applySession(nextSession))
      .catch((error) => {
        console.error('Admin session bootstrap failed', error);
        if (!isMounted) return;
        setSession(null);
        setHasAdminClaim(false);
        setAdminContext(null);
        setAuthIssue(error instanceof Error ? error.message : 'Admin session bootstrap failed.');
        finishLoading();
      })
      .finally(() => clearTimeout(bootTimeout));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await applySession(nextSession);
    });

    return () => {
      isMounted = false;
      clearTimeout(bootTimeout);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) return <LoadingScreen />;

  if (!session) {
    return <AdminAuthScreen onAuthenticated={() => {}} />;
  }

  if (!hasAdminClaim) {
    return <AdminAccessNotice email={session?.user?.email || null} onSignOut={() => supabase.auth.signOut()} />;
  }

  const renderContent = () => {
    switch (currentMenu) {
      case 'dashboard':
        return (
          <AdminDashboard
            onOpenShipments={(params = {}) => {
              setShipmentFocus((current) => ({ ...params, version: current.version + 1 }));
              setCurrentMenu('shipments');
            }}
          />
        );
      case 'track_shipments':
        return <TrackShipments />;
      case 'terminals':
        return <Terminals />;
      case 'riders':
        return <RidersDrivers />;
      case 'deliver_earn':
        return <DeliverAndEarn />;
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
        return (
          <Shipments
            initialShipmentId={shipmentFocus.shipmentId}
            initialStageFilter={shipmentFocus.stage}
            initialTerminalId={shipmentFocus.terminalId}
            focusVersion={shipmentFocus.version}
          />
        );
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
      onMenuChange={(menu: string) => setCurrentMenu(menu)}
      onLogout={handleLogout}
      adminContext={authIssue ? { ...(adminContext || {}), authIssue } : adminContext}
    >
      {renderContent()}
    </AdminLayout>
  );
}
