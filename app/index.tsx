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

function AdminAccessNotice({
  email,
  title = 'Admin access required',
  body = 'This account signed in successfully, but the backend does not see a valid RENAX admin session for protected operations.',
  detail = 'Ask the owner to provision this user with an admin staff role, then sign out and sign back in so the session receives the right claims and RBAC permissions.',
  onSignOut,
}: {
  email?: string | null;
  title?: string;
  body?: string;
  detail?: string;
  onSignOut: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: '#020f09', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ width: '100%', maxWidth: 520, backgroundColor: 'rgba(2, 15, 9, 0.95)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
          {title}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 16 }}>
          {body}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 12 }}>
          Signed-in account: {email || 'unknown'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 }}>
          {detail}
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

const ADMIN_MENU_ACCESS: Record<string, string[]> = {
  dashboard: ['shipment.view_all', 'shipment.view_terminal'],
  shipments: ['shipment.view_all', 'shipment.view_terminal'],
  track_shipments: ['shipment.view_all', 'shipment.view_terminal'],
  terminals: ['terminal.all', 'terminal.manage_own', 'shipment.view_terminal'],
  riders: ['fleet.view_all', 'fleet.view_terminal'],
  deliver_earn: ['deliver_earn.view_all', 'deliver_earn.review_applications'],
  agro: ['shipment.view_all', 'shipment.view_terminal'],
  customers: ['profile.view_all', 'profile.view_terminal'],
  analytics: ['shipment.view_all'],
  earnings: ['shipment.manage_all'],
  settings: ['*'],
  notif_queue: ['ops_alert.manage', 'ops_alert.manage_terminal'],
};

function adminCanUseMenu(adminContext: any, menu: string) {
  const permissions = ADMIN_MENU_ACCESS[menu] || [];
  const userPermissions = Array.isArray(adminContext?.permissions) ? adminContext.permissions : [];
  if (adminContext?.bootstrap_mode || userPermissions.includes('*')) return true;
  if (!permissions.length) return true;
  if (!userPermissions.length || permissions.includes('*')) return false;
  return permissions.some((permission) => userPermissions.includes(permission));
}

function firstAllowedMenu(adminContext: any) {
  return Object.keys(ADMIN_MENU_ACCESS).find((menu) => adminCanUseMenu(adminContext, menu)) || 'dashboard';
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
          setAdminContext(null);
          setAuthIssue(error.message || 'Admin context could not be loaded.');
        } else {
          const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
          if (!data || (!data.bootstrap_mode && permissions.length === 0)) {
            setAdminContext(data || null);
            setAuthIssue('This admin account has an admin claim but no active RENAX admin_staff_roles entry. Protected queues are blocked until the owner assigns a staff role.');
          } else {
            setAdminContext(data);
          }
        }
      } catch (error) {
        console.error('Admin context request failed', error);
        if (isMounted) {
          setAdminContext(null);
          setAuthIssue(error instanceof Error ? error.message : 'Admin context request failed.');
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
    return (
      <AdminAccessNotice
        email={session?.user?.email || null}
        title="Admin claim required"
        body="This login is a normal authenticated user, not a RENAX admin staff session."
        detail="Staff must be provisioned by the owner so their Supabase auth app_metadata includes role admin and their profile has an active admin_staff_roles assignment."
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  if (authIssue) {
    return (
      <AdminAccessNotice
        email={session?.user?.email || null}
        title="Admin staff role required"
        body={authIssue}
        detail="Owner path: create the staff user in Supabase Auth, run provision_admin_staff_by_email(...), then have the staff member sign out and sign back in."
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  const activeMenu = adminCanUseMenu(adminContext, currentMenu)
    ? currentMenu
    : firstAllowedMenu(adminContext);

  const renderContent = () => {
    switch (activeMenu) {
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
              {activeMenu.replace('_', ' ').toUpperCase()}
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
      currentMenu={activeMenu}
      onMenuChange={(menu: string) => setCurrentMenu(menu)}
      onLogout={handleLogout}
      adminContext={adminContext}
    >
      {renderContent()}
    </AdminLayout>
  );
}
