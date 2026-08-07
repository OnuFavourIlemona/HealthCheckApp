import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PharmacyDashboardScreen } from '../screens/pharmacy/PharmacyDashboardScreen';
import { PharmacyStoreScreen } from '../screens/pharmacy/PharmacyStoreScreen';
import { AnimatedTabBar, type TabIconMap } from './AnimatedTabBar';

const Tab = createBottomTabNavigator();

const tabIcons: TabIconMap = {
  Dashboard: { active: 'grid', inactive: 'grid-outline' },
  'My Store': { active: 'storefront', inactive: 'storefront-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function PharmacyTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} tabIcons={tabIcons} />}
    >
      <Tab.Screen name="Dashboard" component={PharmacyDashboardScreen} />
      <Tab.Screen name="My Store" component={PharmacyStoreScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
