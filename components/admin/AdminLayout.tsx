import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  LayoutDashboard,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Truck,
  List,
  MapPin,
  Users,
  User,
  BarChart2,
  CircleDollarSign,
  LogOut,
  Sprout,
  MailWarning,
} from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';
import { supabase } from '../../supabase';
import NotificationDrawer, { AdminNotification } from './NotificationDrawer';

type AdminLayoutProps = {
  children: React.ReactNode;
  currentMenu?: string;
  onMenuChange?: (menu: string) => void;
  onLogout?: () => void;
};

/* ─── Nav Config ──────────────────────────────────────────── */
const SIDEBAR_MENUS = [
  { key: 'dashboard',       label: 'Dashboard',          icon: LayoutDashboard },
  { key: 'shipments',       label: 'Shipments',          icon: Truck },
  { key: 'track_shipments', label: 'Track Shipments',    icon: MapPin },
  { key: 'terminals',       label: 'Terminals',          icon: List },
  { key: 'riders',          label: 'Riders & Drivers',   icon: Users },
  { key: 'agro',            label: 'Agro Transport',     icon: Sprout },
  { key: 'customers',       label: 'Customers',          icon: User },
  { key: 'notif_queue',     label: 'Notification Queue', icon: MailWarning },
  { key: 'analytics',       label: 'Analytics & Reports',icon: BarChart2 },
  { key: 'earnings',        label: 'Earnings & Finance', icon: CircleDollarSign },
  { key: 'settings',        label: 'Settings',           icon: Settings },
];



/* ─── Notification helpers ────────────────────────────────── */
/** Insert a notification row into admin_notifications */
async function pushNotif(
  type: AdminNotification['type'],
  title: string,
  body: string,
  reference_id?: string
) {
  await supabase.from('admin_notifications').insert({ type, title, body, reference_id: reference_id ?? null });
}

/** Watch shipments table for new inserts / status changes */
function useShipmentWatcher() {
  const handledIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel('admin-shipments-watcher')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shipments' },
        (payload) => {
          const s = payload.new as any;
          if (handledIds.current.has(`ins-${s.id}`)) return;
          handledIds.current.add(`ins-${s.id}`);
          pushNotif(
            'new_shipment',
            'New Shipment Placed',
            `From ${s.pickup ?? '?'} → ${s.dropoff ?? '?'}${s.price ? ` · ${s.price}` : ''}`,
            s.id
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shipments' },
        (payload) => {
          const s = payload.new as any;
          const old = payload.old as any;
          const key = `upd-${s.id}-${s.status}`;
          if (handledIds.current.has(key) || old.status === s.status) return;
          handledIds.current.add(key);
          if (s.status === 'completed') {
            pushNotif('shipment_completed', 'Shipment Delivered ✓', `Delivery from ${s.pickup ?? '?'} → ${s.dropoff ?? '?'} completed.`, s.id);
          } else if (s.status === 'cancelled') {
            pushNotif('shipment_cancelled', 'Shipment Cancelled', `Order from ${s.pickup ?? '?'} was cancelled.`, s.id);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
}

/** Watch profiles for new customers, rider online/offline changes, and frozen accounts */
function useProfileWatcher() {
  const handledIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel('admin-profiles-watcher')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          const p = payload.new as any;
          if (p.role !== 'customer') return;
          if (handledIds.current.has(`new-${p.id}`)) return;
          handledIds.current.add(`new-${p.id}`);
          pushNotif('new_customer', 'New Customer Registered', `${p.full_name ?? p.email ?? 'A new customer'} just signed up.`, p.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const p = payload.new as any;
          const old = payload.old as any;

          // Rider online/offline
          if (p.role === 'driver' && old.is_online !== p.is_online) {
            const key = `online-${p.id}-${p.is_online}`;
            if (!handledIds.current.has(key)) {
              handledIds.current.add(key);
              if (p.is_online) {
                pushNotif('rider_online', 'Rider Came Online', `${p.full_name ?? 'A rider'} is now available for deliveries.`, p.id);
              } else {
                pushNotif('rider_offline', 'Rider Went Offline', `${p.full_name ?? 'A rider'} has gone offline.`, p.id);
              }
            }
          }

          // Customer frozen
          if (p.role === 'customer' && !old.is_restricted && p.is_restricted) {
            const key = `frozen-${p.id}`;
            if (!handledIds.current.has(key)) {
              handledIds.current.add(key);
              pushNotif('customer_frozen', 'Customer Account Frozen', `${p.full_name ?? 'A customer'}'s account has been restricted.`, p.id);
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
}

/* ─── Main Component ──────────────────────────────────────── */
export default function AdminLayout({ children, currentMenu = 'dashboard', onMenuChange, onLogout }: AdminLayoutProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 1024;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  // Sidebar animation
  const expandedWidth = 240;
  const collapsedWidth = 84;
  const sidebarWidth = useSharedValue(expandedWidth);

  useEffect(() => {
    sidebarWidth.value = withTiming(isCollapsed ? collapsedWidth : expandedWidth, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [isCollapsed]);

  const animatedSidebarStyle = useAnimatedStyle(() => ({ width: sidebarWidth.value }));
  const toggleBtnStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sidebarWidth.value - 14 }] }));

  /* ── Load notifications on mount + realtime subscription ── */
  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);
    if (data) setNotifications(data as AdminNotification[]);
  }, []);

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel('admin-notif-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          setNotifications((prev) => [payload.new as AdminNotification, ...prev].slice(0, 60));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? (payload.new as AdminNotification) : n))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadNotifications]);

  /* ── Realtime event watchers ─────────────────────────────── */
  useShipmentWatcher();
  useProfileWatcher();

  /* ── Notification actions ───────────────────────────────── */
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
  }, []);

  /* ── Sidebar renderer ────────────────────────────────────── */
  const SidebarMenuItems = ({ onPress }: { onPress?: () => void }) => (
    <>
      {SIDEBAR_MENUS.map((menu) => {
        const Icon = menu.icon;
        const isActive = currentMenu === menu.key;
        return (
          <TouchableOpacity
            key={menu.key}
            style={[styles.menuItem, isActive && styles.activeMenuItem]}
            onPress={() => {
              onMenuChange && onMenuChange(menu.key);
              onPress?.();
            }}
          >
            <View style={styles.iconBox}>
              <Icon size={20} color={isActive ? BRAND.green : BRAND.white} />
            </View>
            {!isCollapsed && (
              <Text style={[styles.menuText, isActive && styles.activeMenuText]} numberOfLines={1}>
                {menu.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Sidebar toggle button */}
      {!isMobile && (
        <Animated.View style={[styles.toggleBtnWrapper, toggleBtnStyle]}>
          <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.toggleBtn} activeOpacity={0.8}>
            {isCollapsed ? <ChevronRight size={18} color={BRAND.green} /> : <ChevronLeft size={18} color={BRAND.green} />}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <Animated.View style={[styles.sidebar, animatedSidebarStyle]}>
          <View style={styles.sidebarInner}>
            <View style={styles.branding}>
              <Image source={require('../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="cover" />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuContainer}>
              <SidebarMenuItems />
            </ScrollView>
            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={styles.logoutBtn} onPress={() => onLogout && onLogout()}>
                <View style={styles.iconBox}>
                  <LogOut size={20} color={'rgba(255,255,255,0.7)'} />
                </View>
                {!isCollapsed && <Text style={styles.logoutText}>Logout</Text>}
              </TouchableOpacity>
              <Text style={styles.versionText} numberOfLines={1}>
                {isCollapsed ? 'v1.1' : 'RENAX Logistics | v1.1.0'}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Mobile Drawer */}
      {isMobile && mobileNavOpen && (
        <>
          <TouchableOpacity style={styles.mobileOverlay} activeOpacity={1} onPress={() => setMobileNavOpen(false)} />
          <View style={styles.mobileDrawer}>
            <View style={styles.mobileDrawerHeader}>
              <Image source={require('../../assets/images/logo.jpg')} style={styles.mobileDrawerLogo} resizeMode="cover" />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuContainer}>
              <SidebarMenuItems onPress={() => setMobileNavOpen(false)} />
            </ScrollView>
            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={styles.logoutBtn} onPress={() => onLogout && onLogout()}>
                <View style={styles.iconBox}>
                  <LogOut size={20} color={'rgba(255,255,255,0.7)'} />
                </View>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Main Content */}
      <View style={styles.mainArea}>
        <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
          <Image
            source={require('../../assets/images/Tabs Background.png')}
            style={{ position: 'absolute', width: '150%', height: '100%', left: '-25%' }}
            resizeMode="cover"
          />
        </View>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(244, 247, 245, 0.4)' }]} />

        {/* Top Navigation Bar */}
        <View style={[styles.topNav, isMobile && styles.topNavMobile]}>
          <View style={styles.topNavLeft}>
            {isMobile && (
              <TouchableOpacity style={styles.mobileMenuBtn} onPress={() => setMobileNavOpen(true)}>
                <List size={18} color={BRAND.text} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.topNavRight, isMobile && styles.topNavRightMobile]}>
            {/* Bell — live unread badge */}
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => setDrawerOpen(true)}
            >
              <Bell size={20} color={BRAND.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Content */}
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[styles.contentContainer, isMobile && styles.contentContainerMobile]}
        >
          {children}
        </ScrollView>
      </View>

      {/* Notification Drawer */}
      <NotificationDrawer
        visible={drawerOpen}
        notifications={notifications}
        onClose={() => setDrawerOpen(false)}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onNavigate={(section) => onMenuChange && onMenuChange(section)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: BRAND.bg },
  sidebar: { backgroundColor: BRAND.green, overflow: 'hidden', zIndex: 10 },
  toggleBtnWrapper: { position: 'absolute', top: 24, left: 0, zIndex: 50 },
  toggleBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: BRAND.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5,
    elevation: 4, borderWidth: 1, borderColor: '#eee',
  },
  sidebarInner: { paddingTop: 0, justifyContent: 'space-between', width: 240, flex: 1 },
  branding: { marginBottom: 20, height: 120, width: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#00281a' },
  logoImage: { width: '100%', height: '100%' },
  menuContainer: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, height: 48 },
  activeMenuItem: { backgroundColor: BRAND.lime },
  iconBox: { width: 32, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  menuText: { color: '#E2E8F0', fontSize: 14, fontWeight: '500', flex: 1 },
  activeMenuText: { color: BRAND.green, fontWeight: '800' },
  sidebarFooter: { paddingVertical: 20, paddingHorizontal: 20 },
  mobileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 15, 9, 0.5)', zIndex: 40 },
  mobileDrawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 280, backgroundColor: BRAND.green, zIndex: 45 },
  mobileDrawerHeader: { height: 104, backgroundColor: '#00281a', justifyContent: 'center', alignItems: 'center' },
  mobileDrawerLogo: { width: '100%', height: '100%' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginBottom: 10 },
  logoutText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500', flex: 1 },
  versionText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  mainArea: { flex: 1, flexDirection: 'column', position: 'relative', marginLeft: 0 },
  topNav: {
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 40,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  topNavMobile: { height: 'auto', minHeight: 70, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'flex-start', gap: 12 },
  topNavLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  topNavLinks: { flexDirection: 'row', gap: 30 },
  topNavLinksMobile: { gap: 14, flexWrap: 'wrap' },
  topNavLink: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  topNavLinkActive: { borderBottomColor: BRAND.green },
  topNavLinkText: { color: BRAND.text, fontSize: 15, fontWeight: '500' },
  topNavLinkTextActive: { color: BRAND.green, fontWeight: '700' },
  topNavRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  topNavRightMobile: { alignSelf: 'flex-end', gap: 12 },
  mobileMenuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  notificationBtn: { position: 'relative', padding: 8 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: BRAND.danger,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: BRAND.white, fontSize: 10, fontWeight: 'bold' },
  contentScroll: { flex: 1 },
  contentContainer: { padding: 30 },
  contentContainerMobile: { padding: 16 },
});
