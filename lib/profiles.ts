import { supabase } from '@/lib/supabase';
import type { DbProfile, EnrichedDbProfile, EnrichedProfile } from '@/lib/types';
export interface Profile {
  id: number;
  name: string;
  age: number;
  neighborhood: string;
  postcode_district?: string;
  childrenAges: string[];
  bio: string;
  interests: string[];
  avatar: string;
  avatarPosX?: number;
  avatarPosY?: number;
  mutual: number;
  distanceMiles: number;
  expecting: boolean;
  parent_type?: string;
  userId?: string;
  lat?: number | null;
  lng?: number | null;
}

const AGE_MONTHS_TO_LABEL: [number, string][] = [
  [108, '9 - 11 years'],
  [60, '5 - 8 years'],
  [24, '2 - 4 years'],
  [0, 'Under 1 year'],
];

export function ageMonthsToLabel(months: number): string {
  for (const [threshold, label] of AGE_MONTHS_TO_LABEL) {
    if (months >= threshold) return label;
  }
  return 'Under 1 year';
}

export const AGE_LABEL_TO_MONTHS: Record<string, number> = {
  'Under 1 year': 0,
  '2 - 4 years': 24,
  '5 - 8 years': 60,
  '9 - 11 years': 108,
};

/** Fetches children rows and user_interests for the given profile IDs and returns enriched profiles. */
export async function enrichProfilesWithChildren(profiles: DbProfile[]): Promise<EnrichedProfile[]>{
  if (profiles.length === 0) return [];
  const ids = profiles.map(p => p.id);

  const [childrenRes, interestsRes] = await Promise.all([
    supabase.from('children').select('user_id, age_months').in('user_id', ids),
    supabase.from('user_interests').select('user_id, interest').in('user_id', ids),
  ]);

  const childMap: Record<string, string[]> = {};
  for (const row of (childrenRes.data ?? [])) {
    if (!childMap[row.user_id]) childMap[row.user_id] = [];
    childMap[row.user_id].push(ageMonthsToLabel(row.age_months));
  }

  const interestMap: Record<string, string[]> = {};
  for (const row of (interestsRes.data ?? [])) {
    if (!interestMap[row.user_id]) interestMap[row.user_id] = [];
    interestMap[row.user_id].push(row.interest);
  }

  return profiles.map(p => ({
    ...p,
    children_ages: childMap[p.id] ?? [],
    interests: interestMap[p.id] ?? [],
    lat: (p as any).lat ?? null,
    lng: (p as any).lng ?? null,
  }));
}

/** Fetches interests for a single user from the user_interests table. */
export async function fetchUserInterests(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_interests')
    .select('interest')
    .eq('user_id', userId);
  return (data ?? []).map(r => r.interest);
}
