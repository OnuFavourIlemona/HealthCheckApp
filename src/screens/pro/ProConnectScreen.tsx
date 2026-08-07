import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RateConsultationSheet } from '../../components/RateConsultationSheet';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { type HealthProfile } from '../../lib/dashboard';
import {
  completeConsultation,
  fetchMessages,
  fetchRating,
  sendMessage,
  submitRating,
  subscribeToMessages,
  type Consultation,
  type Message,
} from '../../lib/consultations';
import { addPatientNote, fetchNotesForPatient, type PractitionerNote } from '../../lib/practitionerNotes';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme';

type PractitionerProfile = {
  full_name: string | null;
  specialty: string | null;
  years_of_experience: number | null;
  is_verified: boolean | null;
};

type RatingSummary = { average: number; count: number };
type Review = { rating: number; comment: string | null; created_at: string };

type Props = NativeStackScreenProps<RootStackParamList, 'ProConnect'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initialsOf(name: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProConnectScreen({ navigation, route }: Props) {
  const consultationId = route.params?.consultationId;
  const scrollRef = useRef<ScrollView>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [practitionerProfile, setPractitionerProfile] = useState<PractitionerProfile | null>(null);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [patientHealth, setPatientHealth] = useState<HealthProfile | null>(null);
  const [patientNotes, setPatientNotes] = useState<PractitionerNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!cancelled) setUserId(sessionData.session?.user.id ?? null);

      if (!consultationId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const [{ data: consultationRow }, history, existingRating] = await Promise.all([
        supabase.from('consultations').select('*').eq('id', consultationId).maybeSingle(),
        fetchMessages(consultationId),
        fetchRating(consultationId),
      ]);
      if (cancelled) return;
      setConsultation((consultationRow as Consultation) ?? null);
      setMessages(history);
      setHasRated(existingRating != null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  // Once we know who's who, load whichever side's extra context applies:
  // the patient sees the practitioner's background and reviews, the
  // practitioner sees the patient's saved health info and risk scores.
  useEffect(() => {
    if (!consultation || !userId) return;
    let cancelled = false;
    const patientView = consultation.patient_id === userId;

    (async () => {
      if (patientView && consultation.professional_id) {
        const [{ data: profile }, { data: ratings }] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, specialty, years_of_experience, is_verified')
            .eq('id', consultation.professional_id)
            .maybeSingle(),
          supabase
            .from('consultation_ratings')
            .select('rating, comment, created_at')
            .eq('professional_id', consultation.professional_id)
            .order('created_at', { ascending: false }),
        ]);
        if (cancelled) return;
        setPractitionerProfile((profile as PractitionerProfile) ?? null);
        const ratingRows = (ratings ?? []) as Review[];
        setReviews(ratingRows);
        setRatingSummary(
          ratingRows.length > 0
            ? {
                average: ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingRows.length,
                count: ratingRows.length,
              }
            : null,
        );
      } else if (!patientView && consultation.patient_id) {
        const [{ data: health }, notes] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, age, gender, bmi, sleep_hours, smoking, family_diabetes, hypertension, fasting_glucose_mgdl')
            .eq('id', consultation.patient_id)
            .maybeSingle(),
          fetchNotesForPatient(consultation.patient_id),
        ]);
        if (cancelled) return;
        setPatientHealth((health as HealthProfile) ?? null);
        setPatientNotes(notes);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultation, userId]);

  // Live incoming messages.
  useEffect(() => {
    if (!consultationId) return;
    const unsubscribe = subscribeToMessages(consultationId, (message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
    });
    return unsubscribe;
  }, [consultationId]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !consultationId || sending) return;
    setDraft('');
    setSending(true);
    const { error } = await sendMessage(consultationId, body);
    setSending(false);
    if (error) setDraft(body); // restore so the text isn't lost
  };

  const isPatientView = userId != null && consultation?.patient_id === userId;
  const otherPartyName = isPatientView
    ? practitionerProfile?.full_name ?? 'Your practitioner'
    : consultation?.patient_name ?? 'Patient';
  const isActive = consultation?.status === 'active';

  const handleEnd = async () => {
    if (!consultationId || ending) return;
    setEnding(true);
    const { consultation: updated, error } = await completeConsultation(consultationId);
    setEnding(false);
    if (error || !updated) return;
    setConsultation(updated);
    // Patients are asked to rate straight after the consultation ends.
    if (isPatientView && !hasRated) setRatingVisible(true);
  };

  const handleAddNote = async () => {
    const text = noteDraft.trim();
    if (!text || !consultation?.patient_id || savingNote) return;
    setSavingNote(true);
    const { note, error } = await addPatientNote(consultation.patient_id, consultationId ?? null, text);
    setSavingNote(false);
    if (error || !note) return;
    setPatientNotes((prev) => [note, ...prev]);
    setNoteDraft('');
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (!consultationId || !consultation?.professional_id) return;
    setRatingError(null);
    setRatingSubmitting(true);
    const { error } = await submitRating({
      consultationId,
      professionalId: consultation.professional_id,
      rating,
      comment,
    });
    setRatingSubmitting(false);
    if (error) {
      setRatingError(error);
      return;
    }
    setHasRated(true);
    setRatingVisible(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primaryGreen} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>ProConnect</Text>
            <Text style={styles.headerSubtitle}>Secure. Private. Professional.</Text>
          </View>
          {isActive ? (
            <Pressable style={styles.endButton} onPress={handleEnd} disabled={ending}>
              {ending ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Text style={styles.endButtonText}>End</Text>
              )}
            </Pressable>
          ) : (
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={26}
              color={colors.primaryGreen}
            />
          )}
        </View>

        {!consultationId || !consultation ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyText}>This conversation is no longer available.</Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {/* Patient/consultation card */}
              <View style={styles.patientCard}>
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarText}>
                    {initialsOf(isPatientView ? practitionerProfile?.full_name ?? 'Dr' : consultation.patient_name)}
                  </Text>
                </View>
                <View style={styles.patientInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.patientName}>{otherPartyName}</Text>
                    {isPatientView && practitionerProfile?.is_verified ? (
                      <MaterialCommunityIcons name="check-decagram" size={16} color={colors.primaryGreen} />
                    ) : null}
                  </View>
                  {isPatientView && practitionerProfile ? (
                    <Text style={styles.patientDemographic}>
                      {[
                        practitionerProfile.specialty,
                        practitionerProfile.years_of_experience != null
                          ? `${practitionerProfile.years_of_experience} yrs experience`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                  {!isPatientView && consultation.patient_age ? (
                    <Text style={styles.patientDemographic}>
                      {consultation.patient_gender
                        ? `${consultation.patient_gender}, ${consultation.patient_age}`
                        : `Age ${consultation.patient_age}`}
                    </Text>
                  ) : null}
                  <View style={styles.statusRow}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.statusText}>
                      {consultation.status === 'active' ? 'Consultation active' : consultation.status}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Practitioner background + reviews, patient side only */}
              {isPatientView ? (
                <View style={styles.symptomsCard}>
                  <View style={styles.reviewsHeaderRow}>
                    <Text style={styles.symptomsTitle}>About your practitioner</Text>
                    {ratingSummary ? (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={13} color="#C77B00" />
                        <Text style={styles.ratingBadgeText}>
                          {ratingSummary.average.toFixed(1)} ({ratingSummary.count})
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {reviews.length === 0 ? (
                    <Text style={styles.symptomsText}>No reviews yet from other patients.</Text>
                  ) : (
                    <>
                      {(reviewsExpanded ? reviews : reviews.slice(0, 2)).map((review, index) => (
                        <View
                          key={`${review.created_at}-${index}`}
                          style={[styles.reviewRow, index > 0 && styles.reviewRowSpacing]}
                        >
                          <View style={styles.reviewStarsRow}>
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <Ionicons
                                key={starIndex}
                                name={starIndex < review.rating ? 'star' : 'star-outline'}
                                size={13}
                                color="#C77B00"
                              />
                            ))}
                          </View>
                          {review.comment ? (
                            <Text style={styles.reviewComment}>{review.comment}</Text>
                          ) : null}
                        </View>
                      ))}
                      {reviews.length > 2 ? (
                        <Pressable onPress={() => setReviewsExpanded((v) => !v)} hitSlop={6}>
                          <Text style={styles.reviewsToggle}>
                            {reviewsExpanded ? 'Show less' : `Show all ${reviews.length} reviews`}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}

              {/* Patient health summary, practitioner side only */}
              {!isPatientView && patientHealth ? (
                <View style={styles.symptomsCard}>
                  <Text style={styles.symptomsTitle}>Patient health summary</Text>
                  <View style={styles.symptomsMetaRow}>
                    {patientHealth.bmi != null ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>BMI {patientHealth.bmi}</Text>
                      </View>
                    ) : null}
                    {patientHealth.sleep_hours != null ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{patientHealth.sleep_hours}h sleep</Text>
                      </View>
                    ) : null}
                    {patientHealth.smoking ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>Smoker</Text>
                      </View>
                    ) : null}
                    {patientHealth.family_diabetes ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>Family diabetes</Text>
                      </View>
                    ) : null}
                    {patientHealth.hypertension ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>High BP</Text>
                      </View>
                    ) : null}
                    {patientHealth.fasting_glucose_mgdl != null ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{patientHealth.fasting_glucose_mgdl} mg/dL glucose</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Private clinical notes, practitioner side only. Never shown to the patient. */}
              {!isPatientView && consultation.patient_id ? (
                <View style={styles.symptomsCard}>
                  <View style={styles.reviewsHeaderRow}>
                    <Text style={styles.symptomsTitle}>My notes on this patient</Text>
                    <Ionicons name="eye-off-outline" size={15} color={colors.textMuted} />
                  </View>
                  <Text style={styles.notesHint}>Only visible to you, across every consultation with this patient.</Text>

                  <View style={styles.noteInputRow}>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Add a note about this patient..."
                      placeholderTextColor={colors.inputPlaceholder}
                      value={noteDraft}
                      onChangeText={setNoteDraft}
                      multiline
                    />
                    <Pressable
                      style={[styles.noteAddButton, !noteDraft.trim() && styles.sendButtonDisabled]}
                      onPress={handleAddNote}
                      disabled={!noteDraft.trim() || savingNote}
                    >
                      {savingNote ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Ionicons name="add" size={18} color={colors.white} />
                      )}
                    </Pressable>
                  </View>

                  {patientNotes.length > 0 ? (
                    <View style={styles.notesList}>
                      {patientNotes.map((note, index) => (
                        <View key={note.id} style={[styles.noteRow, index > 0 && styles.reviewRowSpacing]}>
                          <Text style={styles.noteText}>{note.note}</Text>
                          <Text style={styles.noteDate}>{formatTime(note.created_at)} · {new Date(note.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Reported symptoms */}
              {consultation.symptoms ? (
                <View style={styles.symptomsCard}>
                  <Text style={styles.symptomsTitle}>Reported symptoms</Text>
                  <Text style={styles.symptomsText}>{consultation.symptoms}</Text>
                  <View style={styles.symptomsMetaRow}>
                    {consultation.duration ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{consultation.duration}</Text>
                      </View>
                    ) : null}
                    {consultation.severity ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{consultation.severity}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Privacy banner */}
              <View style={styles.privacyBanner}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.darkAccentGreen} />
                <Text style={styles.privacyText}>
                  This conversation is private and secure.{'\n'}Do not share personal contact details.
                </Text>
              </View>

              {/* Messages */}
              {messages.length === 0 ? (
                <Text style={styles.noMessages}>
                  No messages yet. Say hello to get the consultation started.
                </Text>
              ) : (
                messages.map((message) => {
                  const mine = message.sender_id === userId;
                  return (
                    <View
                      key={message.id}
                      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                    >
                      <Text style={styles.bubbleText}>{message.body}</Text>
                      <View style={styles.bubbleMeta}>
                        <Text style={styles.bubbleTime}>{formatTime(message.created_at)}</Text>
                        {mine ? (
                          <Ionicons name="checkmark-done" size={15} color={colors.primaryGreen} />
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Input bar — only while the consultation is open */}
            {isActive ? (
              <View style={styles.inputRow}>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.inputPlaceholder}
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    onSubmitEditing={handleSend}
                  />
                </View>
                <Pressable
                  style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!draft.trim()}
                >
                  <Ionicons name="send" size={20} color={colors.white} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.endedBar}>
                <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                <Text style={styles.endedText}>This consultation has ended.</Text>
                {isPatientView && !hasRated ? (
                  <Pressable onPress={() => setRatingVisible(true)}>
                    <Text style={styles.rateLink}>Rate it</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            <Text style={styles.disclaimer}>
              HealthCheck does not replace professional medical advice. In an emergency call 112.
            </Text>
          </>
        )}
      </KeyboardAvoidingView>

      <RateConsultationSheet
        visible={ratingVisible}
        submitting={ratingSubmitting}
        error={ratingError}
        onSubmit={handleSubmitRating}
        onDismiss={() => setRatingVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  endButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 54,
    alignItems: 'center',
  },
  endButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.danger,
  },
  endedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F4F4F4',
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 24,
    marginBottom: 4,
  },
  endedText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  rateLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.primaryGreen,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  patientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.darkAccentGreen,
  },
  patientInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patientName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16.5,
    color: colors.textPrimary,
  },
  patientDemographic: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryGreen,
  },
  statusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryGreen,
    textTransform: 'capitalize',
  },
  symptomsCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  symptomsTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  symptomsText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 5,
  },
  symptomsMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metaPill: {
    backgroundColor: colors.pillGreenBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.darkAccentGreen,
    textTransform: 'capitalize',
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4E0',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  ratingBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#C77B00',
  },
  reviewRow: {
    marginTop: 10,
  },
  reviewRowSpacing: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 4,
  },
  reviewsToggle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.primaryGreen,
    marginTop: 10,
  },
  notesHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textPrimary,
    maxHeight: 90,
  },
  noteAddButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesList: {
    marginTop: 12,
  },
  noteRow: {
    marginTop: 0,
  },
  noteText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  noteDate: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.pillGreenBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  privacyText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  noMessages: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 28,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.pillGreenBg,
    borderTopRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F2',
    borderTopLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  inputBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    maxHeight: 110,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    color: colors.textPrimary,
    maxHeight: 90,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  disclaimer: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
