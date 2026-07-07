'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Leaf, ArrowLeft, ArrowRight, Check, MapPin, Baby, Heart,
  Users, Calendar, Plus, Eye, EyeOff, Star, Sun, Smile, Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AGE_LABEL_TO_MONTHS } from '@/lib/profiles';

const STEPS = [
  { id: 1, title: 'Create your account', sub: 'Join thousands of parents nearby' },
  { id: 2, title: 'About your family', sub: 'Help us personalise your experience' },
  { id: 3, title: 'Your location', sub: 'Connect with parents near you' },
  { id: 4, title: 'Profile photo', sub: 'Put a face to your name' },
  { id: 5, title: 'Your interests', sub: 'What topics matter most to you?' },
  { id: 6, title: 'Almost there!', sub: 'Take a look at your details before we set you up.' },
  { id: 7, title: "You're all set!", sub: 'Welcome to the Sprout community' },
];

const PARENT_STAGES = [
  { id: 'expecting', title: 'Expecting', desc: "I'm pregnant and due soon", Icon: Baby },
  { id: 'parent', title: 'Already a parent', desc: 'I have a child or children aged 0–5', Icon: Heart },
  { id: 'both', title: 'Both', desc: "I have a child or children and I'm expecting again", Icon: Users },
];

const CHILD_AGES = ['Under 1 year', '1 year', '2 years', '3 years', '4 years', '5 years'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PRESET_AVATARS = [
  { id: 'leaf',  Icon: Leaf,  label: 'Leaf',  bg: '#d6ede3', color: '#2d7a52' },
  { id: 'star',  Icon: Star,  label: 'Star',  bg: '#fdf0cc', color: '#b07d10' },
  { id: 'sun',   Icon: Sun,   label: 'Sun',   bg: '#fde8d8', color: '#c05a20' },
  { id: 'smile', Icon: Smile, label: 'Smile', bg: '#dce8fb', color: '#2c5faa' },
];

const INTERESTS = [
  'Getting out',
  'Feeding',
  'Sleep',
  'Health',
  'Development',
  'Education & learning',
  'Wellbeing & mental health',
  'Pregnancy & birth',
  'Practical life',
  'Just for fun',
];

export default function SignupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [dueYear, setDueYear] = useState(() => String(new Date().getFullYear()));
  const [dueMonth, setDueMonth] = useState('');
  const [children, setChildren] = useState<string[]>(['']);
  const [uploadedPhoto, setUploadedPhoto] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    parentStage: '',
    postcode: '',
    avatarId: '',
  });

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;
  const showDue = form.parentStage === 'expecting' || form.parentStage === 'both';
  const showChildren = form.parentStage === 'parent' || form.parentStage === 'both';
  const passwordValid =
    form.password.length >= 8 &&
    /[a-zA-Z]/.test(form.password) &&
    /[0-9]/.test(form.password) &&
    /[^a-zA-Z0-9]/.test(form.password);
  const step1Complete = form.name.trim() !== '' && form.email.trim() !== '' && passwordValid;

  function setChildAge(index: number, age: string) {
    setChildren(prev => { const n = [...prev]; n[index] = age; return n; });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = ev => setUploadedPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
    setForm(f => ({ ...f, avatarId: '' }));
  }

  function handleUseLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`
          );
          const data = await res.json();
          if (data.postcode) setForm(f => ({ ...f, postcode: data.postcode }));
        } catch { /* fallback: user types manually */ }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  }

  async function handleNext() {
    if (step === STEPS.length - 1) {
      // Going from step 5 → 6: create account
      setSubmitting(true);
      setError('');
      try {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });
        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('Sign up failed. Please try again.');

        // Confirm a valid session exists before any authenticated DB write.
        // supabase.auth.getUser() validates the JWT with the server — this is
        // the only reliable way to confirm auth.uid() will be set when the
        // profiles INSERT runs. signUp returns session: null when email
        // confirmation is enabled, which would leave auth.uid() as null and
        // violate the RLS policy (WITH CHECK (auth.uid() = id)).
        const { data: { user }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError || !user) {
          // No confirmed session (email confirmation likely required).
          // Do not attempt the INSERT — advance to the final step instead.
          setStep(s => s + 1);
          return;
        }

        // Use the server-confirmed user ID so it always matches auth.uid().
        const userId = user.id;

        const dueDate = showDue && dueMonth
          ? `${dueYear}-${String(MONTHS.indexOf(dueMonth) + 1).padStart(2, '0')}-01`
          : null;

        // Upload avatar if user selected one
        let avatarUrl = '';
        if (avatarFile) {
          try {
            const ext = avatarFile.name.split('.').pop() ?? 'jpg';
            const path = `${userId}/avatar.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(path, avatarFile, { upsert: true });
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
              avatarUrl = publicUrl;
            }
          } catch { /* non-fatal — profile gets no avatar, user can add later */ }
        }

        // Geocode postcode via postcodes.io (free, no key needed)
        let lat: number | null = null;
        let lng: number | null = null;
        let neighborhood = form.postcode ? form.postcode.trim().split(/\s/)[0].toUpperCase() + ' Area' : '';
        let city = '';
        if (form.postcode) {
          try {
            const geoRes = await fetch(
              `https://api.postcodes.io/postcodes/${encodeURIComponent(form.postcode.trim())}`
            );
            const geoData = await geoRes.json();
            if (geoData.status === 200 && geoData.result) {
              lat = geoData.result.latitude;
              lng = geoData.result.longitude;
              neighborhood = geoData.result.admin_ward || geoData.result.parliamentary_constituency || neighborhood;
              city = geoData.result.admin_district || geoData.result.region || '';
            }
          } catch { /* non-fatal — fall back to postcode district */ }
        }

        const nameParts = (form.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Parent';
        const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0].toUpperCase() : '';

        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          first_name: firstName,
          last_initial: lastInitial,
          name: form.name || 'New Parent',
          bio: '',
          neighborhood,
          city,
          avatar_url: avatarUrl,
          parent_stage: form.parentStage || 'parent',
          interests: selectedInterests,
          postcode: form.postcode,
          due_date: dueDate,
          lat,
          lng,
        });
        if (profileError) throw profileError;

        // Insert each child as a separate row in the children table
        const childrenToInsert = children
          .filter(Boolean)
          .map(label => ({
            user_id: userId,
            age_months: AGE_LABEL_TO_MONTHS[label] ?? 0,
          }));
        if (childrenToInsert.length > 0) {
          await supabase.from('children').insert(childrenToInsert);
        }

      setStep(s => s + 1);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        if (msg.toLowerCase().includes('weak') || msg.toLowerCase().includes('pwned') || msg.toLowerCase().includes('easy to guess')) {
          setStep(1);
          setError('That password is too common — please choose something more unique.');
        } else {
          setError(msg);
        }
      } finally {
        setSubmitting(false);
      }
    } else if (step < STEPS.length) {
      setStep(s => s + 1);
    } else {
      router.push('/app?welcome=1');
    }
  }

  function back() { if (step > 1) setStep(s => s - 1); }

  const current = STEPS[step - 1];

  const familyLines = (): string[] => {
    const lines: string[] = [];
    if (showChildren) children.filter(Boolean).forEach((c, i) => lines.push(`Child ${i + 1}: ${c}`));
    if (showDue && dueMonth) lines.push(`Expecting — due ${dueMonth} ${dueYear}`);
    return lines;
  };

  const postcodeArea = form.postcode ? form.postcode.trim().split(/\s/)[0].toUpperCase() : '—';
  const ActiveAvatar = form.avatarId ? PRESET_AVATARS.find(a => a.id === form.avatarId) : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold" style={{ color: 'var(--brand)' }}>Sprout</span>
          </Link>
          <span className="text-sm" style={{ color: '#9a8070' }}>Step {step} of {STEPS.length}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full mb-8" style={{ background: '#e8e4de' }}>
          <div className="h-1.5 rounded-full transition-all duration-500" style={{ background: 'var(--brand)', width: `${progress}%` }} />
        </div>

        <div className="card-sprout p-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: '#2a1f18' }}>{current.title}</h2>
          <p className="mb-7 text-sm" style={{ color: '#7a6055' }}>{current.sub}</p>

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <div className="space-y-5">
              {error && (
                <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Full name</label>
                <input className="input-sprout" placeholder="Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Email</label>
                <input className="input-sprout" type="email" placeholder="jane@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Password</label>
                <div className="relative">
                  <input
                    className="input-sprout pr-11"
                    type={showPw ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9a7060' }} onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: '#9a8070' }}>Use a mix of letters, numbers and symbols.</p>
                {form.password.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {[
                      { label: 'At least 8 characters', met: form.password.length >= 8 },
                      { label: 'Contains a letter', met: /[a-zA-Z]/.test(form.password) },
                      { label: 'Contains a number', met: /[0-9]/.test(form.password) },
                      { label: 'Contains a symbol (!@#$…)', met: /[^a-zA-Z0-9]/.test(form.password) },
                    ].map(({ label, met }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: met ? '#d6ede3' : '#f0ece5' }}>
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

          {/* ── Step 2: Family ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: '#4a3328' }}>What describes you best?</p>
                <div className="space-y-2.5">
                  {PARENT_STAGES.map(({ id, title, desc, Icon }) => {
                    const sel = form.parentStage === id;
                    return (
                      <button
                        key={id}
                        onClick={() => { setForm(f => ({ ...f, parentStage: id })); setDueMonth(''); setChildren(['']); }}
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
              </div>

              {showDue && (
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: '#4a3328' }}>When are you due?</p>
                  {dueMonth ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--brand-light)', border: '1px solid #e8c9b4' }}>
                      <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                      <span className="font-semibold text-sm" style={{ color: 'var(--brand)' }}>Due {dueMonth} {dueYear}</span>
                      <button className="ml-auto text-xs underline" style={{ color: '#9a7060' }} onClick={() => setDueMonth('')}>Change</button>
                    </div>
                  ) : (
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                      {(() => {
                        const now = new Date();
                        const startMonth = now.getMonth(); // 0-indexed
                        const startYear = now.getFullYear();
                        const validMonths: { month: string; year: number }[] = [];
                        for (let i = 0; i < 10; i++) {
                          const d = new Date(startYear, startMonth + i, 1);
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

          {/* ── Step 3: Location ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: '#4a3328' }}>Where are you based?</label>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#9a8070' }}>
                  We only ever show your area — never your exact address or full postcode.
                </p>
                <input
                  className="input-sprout"
                  placeholder="Enter your postcode (e.g. SW1A 1AA)"
                  value={form.postcode}
                  onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))}
                />
              </div>
              <div
                onClick={handleUseLocation}
                className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'var(--brand-light)', border: '1px dashed #e8c9b4', opacity: locating ? 0.7 : 1 }}
              >
                <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                  {locating ? 'Getting location…' : 'Use my current location'}
                </p>
              </div>
            </div>
          )}

          {/* ── Step 4: Photo / Avatar ── */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ background: 'var(--brand-light)', border: '2px dashed #e8c9b4' }}
                >
                  {uploadedPhoto ? (
                    <img src={uploadedPhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : ActiveAvatar ? (
                    <ActiveAvatar.Icon className="w-10 h-10" style={{ color: ActiveAvatar.color }} />
                  ) : (
                    <span className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>
                      {form.name ? form.name[0].toUpperCase() : '?'}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <button
                  className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border font-semibold text-sm transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-light)' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" /> Upload a photo
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: '#4a3328' }}>Or choose an avatar</p>
                <div className="grid grid-cols-4 gap-3">
                  {PRESET_AVATARS.map(({ id, Icon, label, bg, color }) => {
                    const sel = form.avatarId === id && !uploadedPhoto;
                    return (
                      <button
                        key={id}
                        onClick={() => { setForm(f => ({ ...f, avatarId: id })); setUploadedPhoto(''); }}
                        className="aspect-square rounded-2xl flex items-center justify-center transition-all"
                        style={{ background: sel ? bg : bg + '99', border: `2px solid ${sel ? color : 'transparent'}` }}
                        title={label}
                      >
                        <Icon className="w-7 h-7" style={{ color }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="w-full text-sm font-medium py-1 text-center" style={{ color: '#b8a090' }} onClick={handleNext}>
                Skip for now
              </button>
            </div>
          )}

          {/* ── Step 5: Interests ── */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: '#7a6055' }}>
                Select the topics that matter most to you. We&apos;ll use these to personalise your feed and connect you with parents who share your interests.
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

          {/* ── Step 6: Review ── */}
          {step === 6 && (
            <div className="space-y-3">
              {error && (
                <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  {error}
                </div>
              )}
              <div className="p-4 rounded-xl" style={{ background: '#f9f7f4', border: '1px solid var(--border-color)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#b8a090' }}>Name</p>
                <p className="font-semibold text-sm" style={{ color: '#2a1f18' }}>{form.name || '—'}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: '#f9f7f4', border: '1px solid var(--border-color)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#b8a090' }}>Child(ren)</p>
                {familyLines().length > 0 ? familyLines().map((line, i) => (
                  <p key={i} className="font-semibold text-sm" style={{ color: '#2a1f18' }}>{line}</p>
                )) : <p className="font-semibold text-sm" style={{ color: '#2a1f18' }}>—</p>}
              </div>
              <div className="p-4 rounded-xl" style={{ background: '#f9f7f4', border: '1px solid var(--border-color)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#b8a090' }}>Postcode area</p>
                <p className="font-semibold text-sm" style={{ color: '#2a1f18' }}>{postcodeArea}</p>
                {form.postcode && <p className="text-xs mt-0.5" style={{ color: '#b8a090' }}>Area only — full postcode never shown</p>}
              </div>
              {selectedInterests.length > 0 && (
                <div className="p-4 rounded-xl" style={{ background: '#f9f7f4', border: '1px solid var(--border-color)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#b8a090' }}>Interests</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedInterests.map(i => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid #e8c9b4' }}>{i}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 7: All set ── */}
          {step === 7 && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: 'var(--brand-light)' }}>
                <Check className="w-10 h-10" style={{ color: 'var(--brand)' }} />
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#7a6055' }}>
                You&apos;re officially part of the Sprout community. Connect with parents near you and start sharing!
              </p>
              <div className="pt-2 space-y-3">
                {['Feed', 'Market', 'Messages'].map(feature => (
                  <div key={feature} className="flex items-center gap-3 text-sm" style={{ color: '#5a4035' }}>
                    <Check className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    <span>Access to <strong>{feature}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-6">
          {step > 1 ? (
            <button onClick={back} className="flex items-center gap-2 text-sm font-medium" style={{ color: '#7a6055' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <Link href="/" className="text-sm font-medium" style={{ color: '#7a6055' }}>Sign in instead</Link>
          )}
          <button
            onClick={handleNext}
            className="btn-brand gap-2"
            disabled={submitting || (step === 1 && !step1Complete)}
            style={{ opacity: submitting || (step === 1 && !step1Complete) ? 0.45 : 1 }}
          >
            {submitting ? 'Creating account…' : step === STEPS.length ? 'Get started' : 'Continue'}
            {!submitting && step < STEPS.length && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
