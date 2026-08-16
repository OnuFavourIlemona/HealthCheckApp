import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { PersonInfoSheet } from '../../components/PersonInfoSheet';
import { RateConsultationSheet } from '../../components/RateConsultationSheet';
import { Avatar } from '../../components/ui/Avatar';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { type HealthProfile } from '../../lib/dashboard';
import {
  completeConsultation,
  editMessage,
  fetchMessages,
  fetchRating,
  sendAudioMessage,
  sendImageMessage,
  sendMessage,
  signedChatAudioUrl,
  signedChatImageUrl,
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
  age: number | null;
  is_verified: boolean | null;
  avatar_url: string | null;
};

type RatingSummary = { average: number; count: number };
type Review = { rating: number; comment: string | null; created_at: string };

type Props = NativeStackScreenProps<RootStackParamList, 'ProConnect'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Resolves a private chat-image path to a temporary signed URL and shows it. */
function ChatImage({ path }: { path: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    signedChatImageUrl(path).then((url) => {
      if (active) setUri(url);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!uri) {
    return (
      <View style={styles.chatImagePlaceholder}>
        <ActivityIndicator size="small" color={colors.primaryGreen} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.chatImage} resizeMode="cover" />;
}

/** Resolves a private chat-audio path to a temporary URL and plays it as a voice note. */
function AudioBubble({
  path,
  mine,
  savedDuration,
}: {
  path: string;
  mine: boolean;
  savedDuration: number | null;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    signedChatAudioUrl(path).then((url) => {
      if (active) setUri(url);
    });
    return () => {
      active = false;
    };
  }, [path]);

  const player = useAudioPlayer(uri ?? undefined);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (!uri) return;
    if (status.playing) player.pause();
    else player.play();
  };

  const total = status.duration || savedDuration || 0;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  const iconColor = mine ? colors.darkAccentGreen : colors.textSecondary;

  return (
    <Pressable style={styles.audioRow} onPress={toggle} disabled={!uri} hitSlop={6}>
      <View style={styles.audioPlayCircle}>
        {!uri ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons name={status.playing ? 'pause' : 'play'} size={16} color={iconColor} />
        )}
      </View>
      <View style={styles.audioTrack}>
        <View style={[styles.audioTrackFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.audioDuration}>{formatDuration(total)}</Text>
    </Pressable>
  );
}

export function ProConnectScreen({ navigation, route }: Props) {
  const consultationId = route.params?.consultationId;
  const scrollRef = useRef<ScrollView>(null);
  // A ref, not state: state set inside an event handler doesn't take effect
  // until the next render, so a fast double-tap on Send can fire twice
  // before the `sending` state flag would have caught the second one.
  const sendingRef = useRef(false);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
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
  const [patientAvatarUrl, setPatientAvatarUrl] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState<PractitionerNote[]>([]);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
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
            .select('full_name, specialty, years_of_experience, age, is_verified, avatar_url')
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
            .select('full_name, age, gender, bmi, height_cm, weight_kg, sleep_hours, smoking, family_diabetes, hypertension, fasting_glucose_mgdl, avatar_url')
            .eq('id', consultation.patient_id)
            .maybeSingle(),
          fetchNotesForPatient(consultation.patient_id),
        ]);
        if (cancelled) return;
        setPatientHealth((health as HealthProfile) ?? null);
        setPatientAvatarUrl((health as { avatar_url?: string | null } | null)?.avatar_url ?? null);
        setPatientNotes(notes);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultation, userId]);

  // Live incoming messages, including edits to messages already in the list.
  useEffect(() => {
    if (!consultationId) return;
    const unsubscribe = subscribeToMessages(consultationId, (message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id)
          ? prev.map((m) => (m.id === message.id ? message : m))
          : [...prev, message],
      );
    });
    return unsubscribe;
  }, [consultationId]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !consultationId || sendingRef.current) return;
    sendingRef.current = true;
    setDraft('');
    setSending(true);
    const { error } = await sendMessage(consultationId, body);
    sendingRef.current = false;
    setSending(false);
    if (error) setDraft(body); // restore so the text isn't lost
  };

  const handleStartEdit = (message: Message) => {
    setEditingId(message.id);
    setEditDraft(message.body);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const handleSaveEdit = async () => {
    const body = editDraft.trim();
    if (!editingId || !body || savingEdit) return;
    setSavingEdit(true);
    const { error } = await editMessage(editingId, body);
    setSavingEdit(false);
    if (error) return; // leave the edit open so they can retry
    setMessages((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, body, edited_at: new Date().toISOString() } : m)),
    );
    setEditingId(null);
    setEditDraft('');
  };

  const handleSendImage = async () => {
    if (!consultationId || sendingImage) return;
    setSendingImage(true);
    await sendImageMessage(consultationId);
    setSendingImage(false);
  };

  const handleStartRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const handleCancelRecording = async () => {
    if (!recorderState.isRecording) return;
    await audioRecorder.stop();
  };

  const handleStopAndSendRecording = async () => {
    if (!consultationId || sendingAudio || !recorderState.isRecording) return;
    const durationSeconds = recorderState.durationMillis / 1000;
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri || durationSeconds < 1) return; // too short to be a real note
    setSendingAudio(true);
    await sendAudioMessage(consultationId, uri, durationSeconds);
    setSendingAudio(false);
  };

  const isPatientView = userId != null && consultation?.patient_id === userId;
  const otherPartyName = isPatientView
    ? practitionerProfile?.full_name ?? 'Your practitioner'
    : consultation?.patient_name ?? 'Patient';
  const otherPartyAvatarUrl = isPatientView ? practitionerProfile?.avatar_url ?? null : patientAvatarUrl;

  const infoRows = isPatientView
    ? [
        practitionerProfile?.specialty ? { label: 'Medical line', value: practitionerProfile.specialty } : null,
        practitionerProfile?.age != null ? { label: 'Age', value: String(practitionerProfile.age) } : null,
        practitionerProfile?.years_of_experience != null
          ? { label: 'Experience', value: `${practitionerProfile.years_of_experience} years` }
          : null,
      ].filter((row): row is { label: string; value: string } => row != null)
    : [
        consultation?.patient_age != null ? { label: 'Age', value: String(consultation.patient_age) } : null,
        consultation?.patient_gender ? { label: 'Gender', value: consultation.patient_gender } : null,
        patientHealth?.height_cm != null ? { label: 'Height', value: `${patientHealth.height_cm} cm` } : null,
        patientHealth?.weight_kg != null ? { label: 'Weight', value: `${patientHealth.weight_kg} kg` } : null,
      ].filter((row): row is { label: string; value: string } => row != null);
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
      {/* On Android the OS pans the window to reveal the input; adding a
          "height" adjustment on top of that double-shifts and leaves a gap,
          so we only pad on iOS and let Android's pan handle it. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
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
                <Pressable onPress={() => setInfoSheetVisible(true)}>
                  <Avatar
                    name={isPatientView ? practitionerProfile?.full_name ?? 'Dr' : consultation.patient_name}
                    avatarUrl={otherPartyAvatarUrl}
                    size={52}
                  />
                </Pressable>
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
                  const isTextOnly = !message.image_url && !message.audio_url && !!message.body;
                  const editable = mine && isTextOnly && isActive;
                  const editingThis = editingId === message.id;

                  if (editingThis) {
                    return (
                      <View key={message.id} style={[styles.bubble, styles.bubbleMine, styles.bubbleEditing]}>
                        <TextInput
                          style={styles.editInput}
                          value={editDraft}
                          onChangeText={setEditDraft}
                          multiline
                          autoFocus
                        />
                        <View style={styles.editActionsRow}>
                          <Pressable onPress={handleCancelEdit} hitSlop={8}>
                            <Text style={styles.editCancelText}>Cancel</Text>
                          </Pressable>
                          <Pressable onPress={handleSaveEdit} disabled={savingEdit} hitSlop={8}>
                            {savingEdit ? (
                              <ActivityIndicator size="small" color={colors.darkAccentGreen} />
                            ) : (
                              <Text style={styles.editSaveText}>Save</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={message.id}
                      onLongPress={editable ? () => handleStartEdit(message) : undefined}
                      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                    >
                      {message.image_url ? <ChatImage path={message.image_url} /> : null}
                      {message.audio_url ? (
                        <AudioBubble
                          path={message.audio_url}
                          mine={mine}
                          savedDuration={message.audio_duration_seconds}
                        />
                      ) : null}
                      {message.body ? <Text style={styles.bubbleText}>{message.body}</Text> : null}
                      <View style={styles.bubbleMeta}>
                        {message.edited_at ? <Text style={styles.bubbleEdited}>edited</Text> : null}
                        <Text style={styles.bubbleTime}>{formatTime(message.created_at)}</Text>
                        {mine ? (
                          <Ionicons name="checkmark-done" size={15} color={colors.primaryGreen} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {/* Input bar — only while the consultation is open */}
            {isActive ? (
              <View style={styles.inputRow}>
                {recorderState.isRecording ? (
                  <View style={styles.recordingBar}>
                    <Pressable onPress={handleCancelRecording} hitSlop={10}>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>
                      Recording... {formatDuration(recorderState.durationMillis / 1000)}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={styles.attachButton}
                      onPress={handleSendImage}
                      disabled={sendingImage}
                    >
                      {sendingImage ? (
                        <ActivityIndicator size="small" color={colors.darkAccentGreen} />
                      ) : (
                        <Ionicons name="image-outline" size={22} color={colors.darkAccentGreen} />
                      )}
                    </Pressable>
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
                  </>
                )}
                <Pressable
                  style={styles.sendButton}
                  onPress={
                    recorderState.isRecording
                      ? handleStopAndSendRecording
                      : draft.trim()
                        ? handleSend
                        : handleStartRecording
                  }
                  disabled={sendingAudio}
                >
                  {sendingAudio ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons
                      name={recorderState.isRecording ? 'checkmark' : draft.trim() ? 'send' : 'mic'}
                      size={20}
                      color={colors.white}
                    />
                  )}
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

      <PersonInfoSheet
        visible={infoSheetVisible}
        name={otherPartyName}
        avatarUrl={otherPartyAvatarUrl}
        verified={isPatientView ? !!practitionerProfile?.is_verified : false}
        rows={infoRows}
        onDismiss={() => setInfoSheetVisible(false)}
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
  bubbleEdited: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginRight: 2,
  },
  bubbleTime: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  bubbleEditing: {
    minWidth: '70%',
  },
  editInput: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  editCancelText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  editSaveText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.darkAccentGreen,
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
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pillGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.danger,
  },
  recordingText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 170,
    paddingVertical: 2,
  },
  audioPlayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    overflow: 'hidden',
  },
  audioTrackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryGreen,
  },
  audioDuration: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    color: colors.textMuted,
    minWidth: 30,
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  chatImagePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
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
