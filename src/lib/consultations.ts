import { supabase } from './supabase';

export type Consultation = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  symptoms: string | null;
  patient_name: string | null;
  patient_age: number | null;
  patient_gender: string | null;
  severity: 'mild' | 'moderate' | 'severe' | null;
  duration: string | null;
  created_at: string;
  accepted_at: string | null;
};

export type Message = {
  id: string;
  consultation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export async function createConsultationRequest(params: {
  symptoms: string;
  severity: 'mild' | 'moderate' | 'severe';
  duration: string;
}): Promise<{ consultation: Consultation | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { consultation: null, error: 'You must be signed in to request a consultation.' };

  // Snapshot the patient's details onto the request so practitioners can
  // triage it without needing access to the patient's profile row.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, age, gender')
    .eq('id', userId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('consultations')
    .insert({
      patient_id: userId,
      status: 'pending',
      symptoms: params.symptoms,
      severity: params.severity,
      duration: params.duration,
      patient_name: profile?.full_name ?? null,
      patient_age: profile?.age ?? null,
      patient_gender: profile?.gender ?? null,
    })
    .select()
    .single();

  if (error) return { consultation: null, error: error.message };
  return { consultation: data as Consultation, error: null };
}

/** Pending requests not yet claimed by any practitioner. */
export async function fetchPendingRequests(): Promise<Consultation[]> {
  const { data } = await supabase
    .from('consultations')
    .select('*')
    .is('professional_id', null)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return (data ?? []) as Consultation[];
}

/** Consultations the caller participates in (patient or practitioner). */
export async function fetchMyConsultations(): Promise<Consultation[]> {
  const { data } = await supabase
    .from('consultations')
    .select('*')
    .not('status', 'eq', 'pending')
    .order('created_at', { ascending: false });
  return (data ?? []) as Consultation[];
}

export async function acceptConsultation(
  consultationId: string,
): Promise<{ consultation: Consultation | null; error: string | null }> {
  const { data, error } = await supabase.rpc('accept_consultation', {
    consultation_id: consultationId,
  });
  if (error) return { consultation: null, error: error.message };
  return { consultation: data as Consultation, error: null };
}

/** Either participant may end an active consultation. */
export async function completeConsultation(
  consultationId: string,
): Promise<{ consultation: Consultation | null; error: string | null }> {
  const { data, error } = await supabase.rpc('complete_consultation', {
    consultation_id: consultationId,
  });
  if (error) return { consultation: null, error: error.message };
  return { consultation: data as Consultation, error: null };
}

export type Rating = {
  id: string;
  consultation_id: string;
  rating: number;
  comment: string | null;
};

export async function fetchRating(consultationId: string): Promise<Rating | null> {
  const { data } = await supabase
    .from('consultation_ratings')
    .select('id, consultation_id, rating, comment')
    .eq('consultation_id', consultationId)
    .maybeSingle();
  return (data as Rating) ?? null;
}

export async function submitRating(params: {
  consultationId: string;
  professionalId: string;
  rating: number;
  comment?: string;
}): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'You must be signed in.' };

  const { error } = await supabase.from('consultation_ratings').insert({
    consultation_id: params.consultationId,
    patient_id: userId,
    professional_id: params.professionalId,
    rating: params.rating,
    comment: params.comment?.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function fetchMessages(consultationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  return (data ?? []) as Message[];
}

export async function sendMessage(
  consultationId: string,
  body: string,
): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'You must be signed in.' };

  const { error } = await supabase.from('messages').insert({
    consultation_id: consultationId,
    sender_id: userId,
    body,
  });
  return { error: error?.message ?? null };
}

// Channel topics must be unique per subscriber — Supabase reuses a channel
// with the same topic, and attaching a listener after subscribe() throws.
let channelSeq = 0;

/** Live message stream for a consultation. Returns an unsubscribe function. */
export function subscribeToMessages(
  consultationId: string,
  onMessage: (message: Message) => void,
): () => void {
  channelSeq += 1;
  const channel = supabase
    .channel(`messages:${consultationId}:${channelSeq}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `consultation_id=eq.${consultationId}`,
      },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Live feed of new pending requests for the practitioner dashboard. */
export function subscribeToPendingRequests(onChange: () => void): () => void {
  channelSeq += 1;
  const channel = supabase
    .channel(`consultations:pending:${channelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'consultations' },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
