import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import {
  X,
  Package,
  CheckCircle2,
  XCircle,
  UserPlus,
  Wifi,
  WifiOff,
  ShieldOff,
  AlertTriangle,
  Bell,
} from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';

export type NotifType =
  | 'new_shipment'
  | 'shipment_completed'
  | 'shipment_cancelled'
  | 'new_customer'
  | 'rider_online'
  | 'rider_offline'
  | 'customer_frozen'
  | 'stale_shipment';

export interface AdminNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface Props {
  visible: boolean;
  notifications: AdminNotification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (section: string) => void;
}

/* ── Config per type ──────────────────────────────────────── */
const TYPE_CONFIG: Record<
  NotifType,
  { icon: React.ReactNode; color: string; bg: string; section: string }
> = {
  new_shipment:        { icon: <Package size={18} color="#3b82f6" />,      color: '#3b82f6', bg: '#eff6ff', section: 'shipments' },
  shipment_completed:  { icon: <CheckCircle2 size={18} color="#10b981" />, color: '#10b981', bg: '#d1fae5', section: 'shipments' },
  shipment_cancelled:  { icon: <XCircle size={18} color="#ef4444" />,      color: '#ef4444', bg: '#fee2e2', section: 'shipments' },
  new_customer:        { icon: <UserPlus size={18} color="#8b5cf6" />,     color: '#8b5cf6', bg: '#ede9fe', section: 'customers' },
  rider_online:        { icon: <Wifi size={18} color="#10b981" />,         color: '#10b981', bg: '#d1fae5', section: 'riders' },
  rider_offline:       { icon: <WifiOff size={18} color="#9ca3af" />,      color: '#9ca3af', bg: '#f3f4f6', section: 'riders' },
  customer_frozen:     { icon: <ShieldOff size={18} color="#ef4444" />,    color: '#ef4444', bg: '#fee2e2', section: 'customers' },
  stale_shipment:      { icon: <AlertTriangle size={18} color="#f59e0b" />,color: '#f59e0b', bg: '#fef3c7', section: 'shipments' },
};

/* ── Relative time helper ─────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Component ────────────────────────────────────────────── */
export default function NotificationDrawer({
  visible,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: Props) {
  const slideAnim = useRef(new Animated.Value(420)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 420, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const unread = notifications.filter((n) => !n.is_read).length;

  const handleTap = useCallback(
    (n: AdminNotification) => {
      if (!n.is_read) onMarkRead(n.id);
      const cfg = TYPE_CONFIG[n.type];
      if (cfg?.section) {
        onNavigate(cfg.section);
        onClose();
      }
    },
    [onMarkRead, onNavigate, onClose]
  );

  if (!visible && slideAnim._value === 420) return null;

  return (
    <View style={styles.root} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}
      >
        {/* Header */}
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Notifications</Text>
            {unread > 0 && (
              <Text style={styles.unreadCount}>{unread} unread</Text>
            )}
          </View>
          <View style={styles.panelHeaderActions}>
            {unread > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={onMarkAllRead}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        {/* List */}
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : { paddingBottom: 20 }}
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Bell size={36} color="#d1d5db" />
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyBody}>
                New notifications will appear here as soon as activity happens — shipments, riders, customers.
              </Text>
            </View>
          ) : (
            notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.new_shipment;
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.item, !n.is_read && styles.itemUnread]}
                  onPress={() => handleTap(n)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                    {cfg.icon}
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={[styles.itemTitle, !n.is_read && styles.itemTitleBold]}>
                      {n.title}
                    </Text>
                    <Text style={styles.itemDesc} numberOfLines={2}>
                      {n.body}
                    </Text>
                    <Text style={styles.itemTime}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {!n.is_read && <View style={[styles.dot, { backgroundColor: cfg.color }]} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999,
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: 400,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 30,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  unreadCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#374151',
  },
  emptyBody: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  itemUnread: {
    backgroundColor: '#fafffe',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  itemTitleBold: {
    fontWeight: '700',
    color: '#111827',
  },
  itemDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
});
