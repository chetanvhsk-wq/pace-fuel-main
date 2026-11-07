import { FoodLogEntry } from '../types';

export type MealType = FoodLogEntry['mealType'];

export const MEAL_TYPE_OPTIONS: Array<{
  value: MealType;
  label: string;
  shortLabel: string;
  accentClass: string;
}> = [
  { value: 'breakfast', label: 'Breakfast', shortLabel: 'AM', accentClass: 'from-amber-500/15 to-orange-500/5 text-amber-700' },
  { value: 'lunch', label: 'Lunch', shortLabel: 'Midday', accentClass: 'from-primary/15 to-emerald-500/5 text-primary' },
  { value: 'dinner', label: 'Dinner', shortLabel: 'PM', accentClass: 'from-indigo-500/15 to-violet-500/5 text-indigo-700' },
  { value: 'snack', label: 'Snacks', shortLabel: 'Anytime', accentClass: 'from-rose-500/15 to-pink-500/5 text-rose-700' },
];

export function isMealType(value: string | null | undefined): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack';
}

export function normalizeMealType(value: string | null | undefined): MealType {
  return isMealType(value) ? value : 'snack';
}

export function getMealTypeLabel(mealType: MealType): string {
  return MEAL_TYPE_OPTIONS.find((option) => option.value === mealType)?.label ?? 'Snacks';
}
