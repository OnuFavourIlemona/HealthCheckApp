import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { setDemoScenario } from './devSimulation';

const supabaseUrl = 'https://ubxkqahfciegflhbexww.supabase.co';
// Publishable key — safe to ship in the client; data access is enforced by RLS.
const supabaseKey = 'sb_publishable_kafFk92VsppMwuBVLkKBCA_4qBBewwj';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type UserRole = 'patient' | 'medical_practitioner' | 'pharmacy';

type SignUpParams = {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
};

export async function signUpWithRole({ email, password, fullName, role }: SignUpParams) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
    },
  });
}

/**
 * Returns the current session's role, or null when signed out.
 * Falls back to the auth metadata role if the profile row is missing.
 */
export async function getSessionRole(): Promise<UserRole | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  // A real session was found — forget any dev-only demo override so it never
  // masks real (or genuinely empty) data for a signed-in user.
  if (__DEV__) {
    setDemoScenario(null);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, deactivated_at')
    .eq('id', session.user.id)
    .maybeSingle();

  // A deleted account is soft-deactivated, not removed. Treat it as signed
  // out everywhere rather than letting it back into the app.
  if (profile?.deactivated_at) {
    await supabase.auth.signOut();
    return null;
  }

  const role = profile?.role ?? session.user.user_metadata?.role;
  if (role === 'medical_practitioner' || role === 'pharmacy' || role === 'patient') {
    return role;
  }
  return 'patient';
}
