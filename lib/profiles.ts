import { supabase } from '@/lib/supabase';
import type { DbProfile } from '@/lib/types';

export interface Profile {
  id: number;
  name: string;
  age: number;
  neighborhood: string;
  childrenAges: string[];
  bio: string;
  interests: string[];
  avatar: string;
  mutual: number;
  distanceMiles: number;
  expecting: boolean;
  userId?: string;
}

const AGE_MONTHS_TO_LABEL: [number, string][] = [
  [60, '5 years'],
  [48, '4 years'],
  [36, '3 years'],
  [24, '2 years'],
  [12, '1 year'],
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
  '1 year': 12,
  '2 years': 24,
  '3 years': 36,
  '4 years': 48,
  '5 years': 60,
};

/** Fetches children rows for the given profile IDs and merges age labels into profile.children_ages */
export async function enrichProfilesWithChildren(profiles: DbProfile[]): Promise<DbProfile[]> {
  if (profiles.length === 0) return profiles;
  const ids = profiles.map(p => p.id);
  const { data } = await supabase.from('children').select('user_id, age_months').in('user_id', ids);
  if (!data || data.length === 0) return profiles;

  const childMap: Record<string, string[]> = {};
  for (const row of data) {
    if (!childMap[row.user_id]) childMap[row.user_id] = [];
    childMap[row.user_id].push(ageMonthsToLabel(row.age_months));
  }

  return profiles.map(p => ({
    ...p,
    children_ages: childMap[p.id]?.length ? childMap[p.id] : p.children_ages,
  }));
}

