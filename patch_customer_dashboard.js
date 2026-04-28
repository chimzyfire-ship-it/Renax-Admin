const fs = require('fs');
const file = '/Users/apple/Desktop/RENAX-Logistics/components/CustomerDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Imports
code = code.replace(
  "import { LayoutDashboard, Navigation, PlusCircle, Clock, CreditCard, Settings, Headphones, Bell, ChevronDown, Truck, Calendar, Package, TrendingUp } from 'lucide-react-native';",
  "import { LayoutDashboard, Navigation, PlusCircle, Clock, CreditCard, Settings, Headphones, Bell, ChevronDown, Truck, Calendar, Package, TrendingUp, Menu } from 'lucide-react-native';"
);
code = code.replace(
  "import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, Platform } from 'react-native';",
  "import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, Platform, LayoutAnimation, UIManager, ImageBackground } from 'react-native';\nimport MapView from 'react-native-maps';"
);

// Enable LayoutAnimation
code = code.replace(
  "export default function CustomerDashboard({ userState = 'Lagos', userName = 'Adewale' }) {",
  "if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {\n  UIManager.setLayoutAnimationEnabledExperimental(true);\n}\n\nexport default function CustomerDashboard({ userState = 'Lagos', userName = 'Adewale' }) {"
);

// 2. Add isSidebarCollapsed state & toggle
code = code.replace(
  "const [activeNav, setActiveNav] = useState('dashboard');",
  "const [activeNav, setActiveNav] = useState('dashboard');\n  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);\n\n  const toggleSidebar = () => {\n    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);\n    setIsSidebarCollapsed(!isSidebarCollapsed);\n  };"
);

// 3. Update renderSidebar
code = code.replace(
  "const renderSidebar = () => (\n    <View style={styles.sidebar}>",
  "const renderSidebar = () => (\n    <View style={[styles.sidebar, { width: isSidebarCollapsed ? 90 : 260 }]}>"
);

code = code.replace(
  "style={styles.sidebarLogoImg}",
  "style={[styles.sidebarLogoImg, isSidebarCollapsed && { width: 45, height: 45 }]}"
);

code = code.replace(
  "paddingHorizontal: 24,",
  "paddingHorizontal: isSidebarCollapsed ? 0 : 24, justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',"
);

code = code.replace(
  "{!isMobile && (",
  "{!isSidebarCollapsed && !isMobile && ("
);

// 4. Update renderTopBar
code = code.replace(
  "<View>\n        <Text style={styles.welcomeText}>{t('dash.welcome')}, {userName}</Text>\n        <Text style={styles.welcomeSub}>{t('dash.subtitle')}</Text>\n      </View>",
  "<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>\n        <Pressable onPress={toggleSidebar} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8 }}>\n          <Menu color=\"#121212\" size={24} />\n        </Pressable>\n        <View>\n          <Text style={styles.welcomeText}>{t('dash.welcome')}, {userName}</Text>\n          <Text style={styles.welcomeSub}>{t('dash.subtitle')}</Text>\n        </View>\n      </View>"
);

// 5. Update renderContent background
code = code.replace(
  "<View style={{ flex: 1, backgroundColor: '#f4f6f8' }}>",
  "<View style={{ flex: 1, backgroundColor: 'transparent' }}>"
);

// 6. Update renderDashboard background
code = code.replace(
  "<ScrollView style={styles.main} contentContainerStyle={{ padding: 36, paddingBottom: 80 }}>",
  "<ScrollView style={{ flex: 1, backgroundColor: 'transparent' }} contentContainerStyle={{ padding: 36, paddingBottom: 80 }}>"
);

// 7. Update Map in Dashboard
let mapCode = `<View style={styles.mapFallback}>
            <MapView style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,20,13,0.6)' }]} />
            <Text style={[styles.mapFallbackText, { zIndex: 2 }]}>🗺️  {t('dash.map')}</Text>
            <Text style={{ color: '#ccfd3a', fontFamily: 'Outfit_6', marginTop: 8, zIndex: 2 }}>
              Tracking RNX-1207 | Est. Arrival: 16:30 Today
            </Text>
            <View style={[styles.mapInner, { zIndex: 2 }]}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Outfit_4' }}>
                {userState} → Benin City → Warri → Port Harcourt
              </Text>
            </View>
          </View>`;
code = code.replace(/<View style=\{styles\.mapFallback\}>[\s\S]*?<\/View>\n          <\/View>/, mapCode);

// 8. Apply Tabs Background in return
code = code.replace(
  "<View style={{ flex: 1 }}>\n        {renderContent()}\n      </View>",
  "<ImageBackground source={require('../assets/images/Tabs Background.png')} style={{ flex: 1 }} resizeMode=\"cover\">\n        {renderContent()}\n      </ImageBackground>"
);

// 9. Fix logo size and styles
code = code.replace(
  "width: 150,\n    height: 60,",
  "width: 200,\n    height: 80,"
);
code = code.replace(
  "backgroundColor: '#f4f6f8',",
  "backgroundColor: 'transparent'," // In root and main
);
// replace second occurrence
code = code.replace(
  "backgroundColor: '#f4f6f8',",
  "backgroundColor: 'transparent',"
);

fs.writeFileSync(file, code);
console.log("CustomerDashboard patched successfully.");
