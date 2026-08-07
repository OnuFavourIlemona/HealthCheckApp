import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProDashboardScreen } from '../screens/pro/ProDashboardScreen';
import { ProPatientsScreen } from '../screens/pro/ProPatientsScreen';
import { ProPaymentsScreen } from '../screens/pro/ProPaymentsScreen';
import { ProScheduleScreen } from '../screens/pro/ProScheduleScreen';
import type { ProTabsParamList } from './types';
import { AnimatedTabBar, type TabIconMap } from './AnimatedTabBar';

const Tab = createBottomTabNavigator<ProTabsParamList>();

const tabIcons: TabIconMap = {
  Dashboard: { active: 'grid', inactive: 'grid-outline' },
  Patients: { active: 'people', inactive: 'people-outline' },
  Schedule: { active: 'calendar', inactive: 'calendar-outline' },
  Payments: { active: 'wallet', inactive: 'wallet-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function ProTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} tabIcons={tabIcons} />}
    >
      <Tab.Screen name="Dashboard" component={ProDashboardScreen} />
      <Tab.Screen name="Patients" component={ProPatientsScreen} />
      <Tab.Screen name="Schedule" component={ProScheduleScreen} />
      <Tab.Screen name="Payments" component={ProPaymentsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
