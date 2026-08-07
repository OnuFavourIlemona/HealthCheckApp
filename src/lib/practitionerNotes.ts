import { supabase } from './supabase';

export type PractitionerNote = {
  id: string;
  patient_id: string;
  consultation_id: string | null;
  note: string;
  created_at: string;
};

/** Every note this practitioner has ever written on this patient, newest first, across all past consultations. */
export async function fetchNotesForPatient(patientId: string): Promise<PractitionerNote[]> {
  const { data } = await supabase
    .from('practitioner_notes')
    .select('id, patient_id, consultation_id, note, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function addPatientNote(
  patientId: string,
  consultationId: string | null,
  note: string,
): Promise<{ note: PractitionerNote | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { note: null, error: 'You must be signed in to add a note.' };

  const { data, error } = await supabase
    .from('practitioner_notes')
    .insert({
      professional_id: userId,
      patient_id: patientId,
      consultation_id: consultationId,
      note: note.trim(),
    })
    .select('id, patient_id, consultation_id, note, created_at')
    .single();

  if (error) return { note: null, error: error.message };
  return { note: data, error: null };
}
