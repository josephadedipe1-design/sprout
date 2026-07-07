import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  Travel:        { bg: '#DBEAFE', color: '#1E40AF' },
  Sleep:         { bg: '#EDE9FE', color: '#6D28D9' },
  Clothing:      { bg: '#FEF3C7', color: '#92400E' },
  Toys:          { bg: '#FEE2E2', color: '#991B1B' },
  Gear:          { bg: '#DCFCE7', color: '#166534' },
  Feeding:       { bg: '#FFEDD5', color: '#9A3412' },
  Furniture:     { bg: '#F3F4F6', color: '#1F2937' },
  Education:     { bg: '#ECFDF5', color: '#065F46' },
  Miscellaneous: { bg: '#F5F0EC', color: '#7a6055' },
};

export function getCategoryStyle(category: string): { bg: string; color: string } {
  return CATEGORY_STYLES[category] ?? { bg: '#f4f3f0', color: '#9a8070' };
}
