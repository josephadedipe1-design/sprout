'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Leaf, ArrowLeft, ArrowRight, Check, MapPin, Baby, Heart,
  Users, Plus, Eye, EyeOff, Upload, Loader2, Star, Sun, Smile,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AGE_LABEL_TO_MONTHS } from '@/lib/profiles';
import { sendNotificationEmail } from '@/lib/notifications';

// Steps 1–7 are data-collection; step 8 is the confirmation screen.
const TOTAL_STEPS = 8;

const PARENT_STAGES = [
  { id: 'expecting', title: 'Expecting', desc: "I'm pregnant and due soon", Icon: Baby },
  { id: 'parent',   title: 'Already a parent', desc: 'I have a child or children aged 0–5', Icon: Heart },
  { id: 'both',     title: 'Both', desc: "I have a child or children and I'm expecting again", Icon: Users },
];

const CHILD_AGES = ['Under 1 year', '1 year', '2 years', '3 years', '4 years', '5 years'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INTERESTS = [
  'Getting out', 'Feeding', 'Sleep', 'Health', 'Development',
  'Education & learning', 'Wellbeing & mental health', 'Pregnancy & birth',
  'Practical life', 'Just for fun',
];

const PRESET_AVATARS = [
  { id: 'leaf',  Icon: Leaf,  bg: '#d6ede3', color: '#2d7a52' },
  { id: 'star',  Icon: Star,  bg: '#fdf0cc', color: '#b07d10' },
  { id: 'sun',   Icon: Sun,   bg: '#fde8d8', color: '#c05a20' },
  { id: 'smile', Icon: Smile, bg: '#dce8fb', color: '#2c5faa' },
];

export default function SignupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation
  const [step, setStep] = useState(1);

  // Step 1 — credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signingUp, setSigningUp] = useState(false);
  const [userId, setUserId] = useState('');

  // Step 2 — name
  const [fullName, setFullName] = useState('');

  // Step 3 — location
  const [postcode, setPostcode] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [postcodeValidated, setPostcodeValidated] = useState(false);

  // Step 4 — parent type
  const [parentStage, setParentStage] = useState('');

  // Step 5 — due date / children
  const [dueYear, setDueYear] = useState(() => String(new Date().getFullYear()));
  const [dueMonth, setDueMonth] = useState('');
  const [children, setChildren] = useState<string[]>(['']);

  // Step 6 — interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Step 7 — photo
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [avatarUploadFailed, setAvatarUploadFailed] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Derived ──────────────────────────────────────────────────────────────
  const passwordValid =
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^a-zA-Z0-9]/.test(password);

  const showDue = parentStage === 'expecting' || parentStage === 'both';
  const showChildren = parentStage === 'parent' || parentStage === 'both';

  const step5Complete = (() => {
    if (!parentStage) return false;
    if (showDue && !dueMonth) return false;
    if (showChildren && !children.some(c => c !== '')) return false;
    return true;
  })();

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const stepTitle = [
    '', // placeholder for 1-index
    'Create your account',
    'What should we call you?',
    'Where are you based?',
    'Tell us about your family',
    showDue ? 'When are you due?' : 'Tell us about your children',
    'What interests you?',
    'Add a profile photo',
    "You're all set!",
  ][step] ?? '';

  const stepSub = [
    '',
    'Join thousands of parents nearby',
    'Help other parents recognise you',
    'Connect with parents near you',
    'Help us personalise your experience',
    showDue ? 'We\'ll keep you connected with others at the same stage' : 'So parents with similar-aged children can find you',
    'We\'ll use this to personalise your feed',
    'Put a face to your name (you can always add one later)',
    'Welcome to the Sprout community',
  ][step] ?? '';

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function validatePostcode(raw: string) {
    const pc = raw.trim().toUpperCase();
    if (!pc) { setGeocodeError(''); setPostcodeValidated(false); return; }
    const fullPattern = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/;
    if (!fullPattern.test(pc)) {
      setPostcodeValidated(false);
      setGeocodeError('Please enter a full postcode — e.g. SW1A 1AA');
      return;
    }
    setGeocoding(true);
    setGeocodeError('');
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      const data = await res.json();
      if (data.status === 200 && data.result) {
        const { admin_ward, parliamentary_constituency, admin_district, region } = data.result;
        setPostcode(pc);
        setNeighborhood(admin_ward || parliamentary_constituency || '');
        setCity(admin_district || region || '');
        setPostcodeValidated(true);
        setGeocodeError('');
      } else {
        setPostcodeValidated(false);
        setGeocodeError('Postcode not recognised — please check and try again.');
      }
    } catch {
      setPostcodeValidated(false);
      setGeocodeError('Could not validate postcode. Please try again.');
    }
    setGeocoding(false);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function setChildAge(index: number, age: string) {
    setChildren(prev => { const n = [...prev]; n[index] = age; return n; });
  }

  // ── Step handlers ─────────────────────────────────────────────────────────

  // Step 1 → create auth user, then advance to step 2
  async function handleStep1() {
    setSigningUp(true);
    setSignupError('');
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Sign up failed. Please try again.');

      const { data: { user: confirmedUser }, error: getUserError } = await supabase.auth.getUser();
      if (getUserError || !confirmedUser) {
        // Email confirmation required — advance anyway, profile insert will fail gracefully
        setStep(2);
        return;
      }
      setUserId(confirmedUser.id);
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('weak') || msg.toLowerCase().includes('pwned') || msg.toLowerCase().includes('easy to guess')) {
        setSignupError('That password is too common — please choose something more unique.');
      } else {
        setSignupError(msg);
      }
    } finally {
      setSigningUp(false);
    }
  }

  // Step 7 → upload photo + insert profile, then advance to step 8
  async function handleFinalSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const uid = userId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) throw new Error('No user session found. Please try again.');

      // Upload avatar if provided
      let avatarUrl = '';
      if (avatarFile) {
        try {
          const ext = avatarFile.name.split('.').pop() ?? 'jpg';
          const path = `${uid}/avatar.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, avatarFile, { upsert: true });
          if (uploadError) {
            setAvatarUploadFailed(true);
          } else {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
            avatarUrl = publicUrl;
          }
        } catch {
          setAvatarUploadFailed(true);
        }
      }

      // Geocode postcode for lat/lng
      let lat: number | undefined;
      let lng: number | undefined;
      if (postcode) {
        try {
          const geoRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`);
          const geoData = await geoRes.json();
          if (geoData.status === 200 && geoData.result) {
            lat = geoData.result.latitude;
            lng = geoData.result.longitude;
          }
        } catch { /* non-fatal */ }
      }

      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Parent';
      const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0].toUpperCase() : '';
      const dueDate = showDue && dueMonth
        ? `${dueYear}-${String(MONTHS.indexOf(dueMonth) + 1).padStart(2, '0')}-01`
        : null;

      const profilePayload: Record<string, unknown> = {
        id: uid,
        name: fullName || 'New Parent',
        first_name: firstName,
        last_initial: lastInitial,
        postcode,
        postcode_district: postcode.split(' ')[0] || '',
        neighborhood,
        city,
        interests: selectedInterests,
        parent_type: parentStage || 'parent',
        due_date: dueDate,
        bio: '',
        avatar_url: avatarUrl,
      };
      if (lat !== undefined) { profilePayload.lat = lat; profilePayload.lng = lng; }

      const { error: profileError } = await supabase.from('profiles').insert(profilePayload);
      if (profileError) throw profileError;

      // Insert children rows
      const childrenToInsert = children
        .filter(Boolean)
        .map(label => ({ user_id: uid, age_months: AGE_LABEL_TO_MONTHS[label] ?? 0 }));
      if (childrenToInsert.length > 0) {
        await supabase.from('children').insert(childrenToInsert);
      }

      setStep(8);

      sendNotificationEmail({
        type: 'welcome',
        recipientUserId: uid,
        emailData: { recipientName: firstName },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    if (step === 1) { await handleStep1(); return; }
    if (step === 7) { await handleFinalSubmit(); return; }
    if (step === 8) { router.push('/app?welcome=1'); return; }
    setStep(s => s + 1);
  }

  function back() {
    if (step > 1 && step < 8) setStep(s => s - 1);
  }

  const canAdvance = (() => {
    if (step === 1) return email.trim() !== '' && passwordValid && !signingUp;
    if (step === 2) return fullName.trim() !== '';
    if (step === 3) return postcodeValidated;
    if (step === 4) return parentStage !== '';
    if (step === 5) return step5Complete;
    return true; // steps 6, 7, 8 can always advance (interests/photo optional)
  })();

  const isBusy = signingUp || submitting;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">

        {/* Logo + step counter */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold" style={{ color: 'var(--brand)' }}>Sprout</span>
          </Link>
          {step < 8 && (
            <span className="text-sm" style={{ color: '#9a8070' }}>Step {step} of 7</span>
          )}
        </div>

        {/* Progress bar (steps 1–7 only) */}
        {step < 8 && (
          <div className="w-full h-1.5 rounded-full mb-8" style={{ background: '#e8e4de' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ background: 'var(--brand)', width: `${((step - 1) / 6) * 100}%` }}
            />
          </div>
        )}

        <div className="card-sprout p-8">
          {step < 8 && (
            <>
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#2a1f18' }}>{stepTitle}</h2>
              <p className="mb-7 text-sm" style={{ color: '#7a6055' }}>{stepSub}</p>
            </>
          )}

          {/* ── Step 1: Email + Password ── */}
          {step === 1 && (
            <div className="space-y-5">
              {signupError && (
                <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  {signupError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Email</label>
                <input
                  className="input-sprout"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setSignupError(''); }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Password</label>
                <div className="relative">
                  <input
                    className="input-sprout pr-11"
                    type={showPw ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setSignupError(''); }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#9a7060' }}
                    onClick={() => setShowPw(s => !s)}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: '#9a8070' }}>Use a mix of letters, numbers and symbols.</p>
                {password.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {[
                      { label: 'At least 8 characters', met: password.length >= 8 },
                      { label: 'Contains a letter', met: /[a-zA-Z]/.test(password) },
                      { label: 'Contains a number', met: /[0-9]/.test(password) },
                      { label: 'Contains a symbol (!@#$…)', met: /[^a-zA-Z0-9]/.test(password) },
                    ].map(({ label, met }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: met ? '#d6ede3' : '#f0ece5' }}>
                          <Check className="w-2.5 h-2.5" style={{ color: met ? '#2d7a52' : '#c4b0a0' }} />
                        </div>
                        <span className="text-xs" style={{ color: met ? '#2d7a52' : '#9a8070' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Name ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Full name</label>
                <input
                  className="input-sprout"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoFocus
                />
                {fullName.trim() && (() => {
                  const parts = fullName.trim().split(/\s+/);
                  const fn = parts[0];
                  const li = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() + '.' : '';
                  return (
                    <p className="text-xs mt-2" style={{ color: '#9a8070' }}>
                      You&apos;ll appear as <strong style={{ color: '#5a4035' }}>{fn}{li ? ' ' + li : ''}</strong> in the community
                    </p>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── Step 3: Location ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: '#4a3328' }}>Your postcode</label>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#9a8070' }}>
                  We only ever show your area — never your exact address or full postcode.
                </p>
                <div className="flex gap-2">
                  <input
                    className="input-sprout flex-1 uppercase"
                    placeholder="e.g. SW1A 1AA"
                    value={postcode}
                    onChange={e => {
                      setPostcode(e.target.value.toUpperCase());
                      setPostcodeValidated(false);
                      setGeocodeError('');
                    }}
                    onBlur={e => { if (e.target.value.trim()) validatePostcode(e.target.value); }}
                  />
                  <button
                    type="button"
                    onClick={() => validatePostcode(postcode)}
                    disabled={!postcode.trim() || geocoding}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 flex-shrink-0"
                    style={{
                      background: postcodeValidated ? '#d6ede3' : 'var(--brand-light)',
                      color: postcodeValidated ? '#2d7a52' : 'var(--brand)',
                      border: `1px solid ${postcodeValidated ? '#a7d9be' : '#e8c9b4'}`,
                      opacity: !postcode.trim() || geocoding ? 0.5 : 1,
                    }}
                  >
                    {geocoding ? '…' : postcodeValidated ? 'Valid ✓' : 'Check'}
                  </button>
                </div>
                {geocodeError && (
                  <p className="text-xs mt-1.5 font-medium" style={{ color: '#b45309' }}>{geocodeError}</p>
                )}
                {postcodeValidated && city && (
                  <p className="text-xs mt-1.5 font-medium" style={{ color: '#059669' }}>
                    Found: {[neighborhood, city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Parent type ── */}
          {step === 4 && (
            <div className="space-y-2.5">
              {PARENT_STAGES.map(({ id, title, desc, Icon }) => {
                const sel = parentStage === id;
                return (
                  <button
                    key={id}
                    onClick={() => { setParentStage(id); setDueMonth(''); setChildren(['']); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all"
                    style={{ borderColor: sel ? 'var(--brand)' : 'var(--border-color)', background: sel ? 'var(--brand-light)' : 'white' }}
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sel ? 'var(--brand)' : '#f0ece5' }}>
                      <Icon className="w-5 h-5" style={{ color: sel ? 'white' : '#9a7060' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: sel ? 'var(--brand)' : '#2a1f18' }}>{title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>{desc}</p>
                    </div>
                    {sel && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Step 5: Due date / Child ages ── */}
          {step === 5 && (
            <div className="space-y-6">
              {showDue && (
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: '#4a3328' }}>When are you due?</p>
                  {dueMonth ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--brand-light)', border: '1px solid #e8c9b4' }}>
                      <span className="font-semibold text-sm" style={{ color: 'var(--brand)' }}>Due {dueMonth} {dueYear}</span>
                      <button className="ml-auto text-xs underline" style={{ color: '#9a7060' }} onClick={() => setDueMonth('')}>Change</button>
                    </div>
                  ) : (
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                      {(() => {
                        const now = new Date();
                        const validMonths: { month: string; year: number }[] = [];
                        for (let i = 0; i < 10; i++) {
                          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                          validMonths.push({ month: MONTHS[d.getMonth()], year: d.getFullYear() });
                        }
                        const years = Array.from(new Set(validMonths.map(v => v.year)));
                        const monthsForYear = validMonths.filter(v => v.year === Number(dueYear)).map(v => v.month);
                        return (
                          <>
                            {years.length > 1 && (
                              <div className="flex" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                {years.map(y => (
                                  <button key={y} onClick={() => setDueYear(String(y))} className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                                    style={{ background: dueYear === String(y) ? 'var(--brand)' : 'white', color: dueYear === String(y) ? 'white' : '#5a4035' }}>{y}</button>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-px" style={{ background: '#e8e4de' }}>
                              {monthsForYear.map(m => (
                                <button key={m} onClick={() => setDueMonth(m)} className="py-3 text-xs font-medium transition-colors hover:opacity-80"
                                  style={{ background: 'white', color: '#5a4035' }}>{m.slice(0, 3)}</button>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {showChildren && (
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: '#4a3328' }}>Tell us about your child or children</p>
                  <div className="space-y-4">
                    {children.map((childAge, i) => (
                      <div key={i}>
                        <p className="text-xs font-medium mb-2" style={{ color: '#9a8070' }}>Child {i + 1}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {CHILD_AGES.map(age => (
                            <button key={age} onClick={() => setChildAge(i, age)}
                              className="py-2 px-1 rounded-xl border text-xs font-medium transition-all"
                              style={{
                                borderColor: childAge === age ? 'var(--brand)' : 'var(--border-color)',
                                background: childAge === age ? 'var(--brand-light)' : 'white',
                                color: childAge === age ? 'var(--brand)' : '#5a4035',
                              }}>{age}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {children.every(c => c !== '') && (
                      <button onClick={() => setChildren(prev => [...prev, ''])}
                        className="flex items-center gap-2 text-sm font-medium py-1" style={{ color: '#c0afa0' }}>
                        <Plus className="w-4 h-4" /> Add another child
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 6: Interests ── */}
          {step === 6 && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: '#7a6055' }}>
                Select the topics that matter most to you. We&apos;ll use these to personalise your feed.
              </p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => {
                  const sel = selectedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => setSelectedInterests(prev =>
                        sel ? prev.filter(i => i !== interest) : [...prev, interest]
                      )}
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                      style={{
                        background: sel ? 'var(--brand)' : 'white',
                        color: sel ? 'white' : '#5a4035',
                        border: `1.5px solid ${sel ? 'var(--brand)' : 'var(--border-color)'}`,
                      }}
                    >
                      {sel && <span className="mr-1.5">✓</span>}{interest}
                    </button>
                  );
                })}
              </div>
              {selectedInterests.length === 0 && (
                <p className="text-xs" style={{ color: '#b8a090' }}>Pick at least one, or skip and update later from your profile.</p>
              )}
            </div>
          )}

          {/* ── Step 7: Photo ── */}
          {step === 7 && (
            <div className="space-y-5">
              {submitError && (
                <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  {submitError}
                </div>
              )}
              <div className="flex justify-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ background: 'var(--brand-light)', border: '2px dashed #e8c9b4' }}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : avatarId ? (() => {
                    const preset = PRESET_AVATARS.find(p => p.id === avatarId);
                    return preset ? (
                      <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: preset.bg }}>
                        <preset.Icon className="w-10 h-10" style={{ color: preset.color }} />
                      </div>
                    ) : null;
                  })() : (
                    <span className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>
                      {fullName ? fullName[0].toUpperCase() : '?'}
                    </span>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <button
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border font-semibold text-sm transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-light)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" /> {photoPreview ? 'Change photo' : 'Upload a photo'}
              </button>
              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: '#4a3328' }}>Or choose an icon</p>
                <div className="grid grid-cols-4 gap-3">
                  {PRESET_AVATARS.map(({ id, Icon, bg, color }) => {
                    const sel = avatarId === id && !photoPreview;
                    return (
                      <button
                        key={id}
                        onClick={() => { setAvatarId(id); setAvatarFile(null); setPhotoPreview(''); }}
                        className="aspect-square rounded-2xl flex items-center justify-center transition-all hover:scale-105"
                        style={{ background: bg, border: `2px solid ${sel ? color : 'transparent'}`, outline: sel ? `3px solid ${color}30` : 'none' }}
                      >
                        <Icon className="w-7 h-7" style={{ color }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-center text-xs" style={{ color: '#b8a090' }}>You can always add or change your photo later from your profile.</p>
            </div>
          )}

          {/* ── Step 8: Confirmation ── */}
          {step === 8 && (
            <div className="text-center space-y-5">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: 'var(--brand-light)' }}>
                <Check className="w-10 h-10" style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#2a1f18' }}>
                  Welcome{fullName ? `, ${fullName.trim().split(/\s+/)[0]}` : ''}!
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: '#7a6055' }}>
                  You&apos;re officially part of the Sprout community. Connect with parents near you and start sharing!
                </p>
              </div>
              {avatarUploadFailed && (
                <p className="text-xs p-3 rounded-xl" style={{ background: '#FFF7ED', color: '#92400E', border: '1px solid #FDE68A' }}>
                  Photo upload didn&apos;t work this time — you can add it from your profile after joining.
                </p>
              )}
              <div className="space-y-2.5 pt-1 text-left">
                {['Community Feed', 'Marketplace', 'Messages & Connections'].map(feature => (
                  <div key={feature} className="flex items-center gap-3 text-sm" style={{ color: '#5a4035' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#d6ede3' }}>
                      <Check className="w-3 h-3" style={{ color: '#2d7a52' }} />
                    </div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {step > 1 && step < 8 ? (
            <button onClick={back} className="flex items-center gap-2 text-sm font-medium" style={{ color: '#7a6055' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : step === 1 ? (
            <Link href="/" className="text-sm font-medium" style={{ color: '#7a6055' }}>Sign in instead</Link>
          ) : (
            <span />
          )}

          <button
            onClick={handleNext}
            className="btn-brand gap-2 flex items-center"
            disabled={!canAdvance || isBusy}
            style={{ opacity: canAdvance && !isBusy ? 1 : 0.45 }}
          >
            {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            {step === 8 ? 'Get started' : step === 7 ? (submitting ? 'Setting up…' : (photoPreview ? 'Finish' : 'Skip & finish')) : step === 1 ? (signingUp ? 'Creating account…' : 'Next') : 'Continue'}
            {!isBusy && step < 8 && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
