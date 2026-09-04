import { Category } from '@/types';

/**
 * Canonical category ids (the `Category` enum values stored on products) in display order.
 * Mirrors the order of the category strip on the home page.
 */
export const CATEGORIES: readonly Category[] = [
  Category.Vehicles,
  Category.RealEstate,
  Category.Electronics,
  Category.Services,
  Category.Furniture,
  Category.Clothing,
  Category.Sports,
  Category.Books,
  Category.Other,
];

/** Pseudo-category id used by filters to mean "no category filter". */
export const ALL_CATEGORIES = 'all' as const;

/**
 * Category id → i18n label key. Enum values like `RealEstate` do not match locale keys
 * like `cat.real_estate`, so never build these keys with `toLowerCase()`.
 */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  [ALL_CATEGORIES]: 'cat.all',
  [Category.Electronics]: 'cat.electronics',
  [Category.Furniture]: 'cat.furniture',
  [Category.Clothing]: 'cat.clothing',
  [Category.Books]: 'cat.books',
  [Category.Sports]: 'cat.sports',
  [Category.Vehicles]: 'cat.vehicles',
  [Category.RealEstate]: 'cat.real_estate',
  [Category.Services]: 'cat.services',
  [Category.Other]: 'cat.other',
};

/**
 * Resolve the i18n key for a category id. Accepts enum values (`RealEstate`), the `all`
 * pseudo-id and legacy lowercase / snake_case forms (`realestate`, `real_estate`).
 * Unknown ids fall back to `cat.other`.
 */
export const categoryLabelKey = (id: string | null | undefined): string => {
  if (!id) return CATEGORY_LABEL_KEYS[Category.Other];
  const direct = CATEGORY_LABEL_KEYS[id];
  if (direct) return direct;

  const normalized = id.toLowerCase().replace(/[\s_-]/g, '');
  const match = Object.keys(CATEGORY_LABEL_KEYS).find(k => k.toLowerCase() === normalized);
  return match ? CATEGORY_LABEL_KEYS[match] : CATEGORY_LABEL_KEYS[Category.Other];
};

/** Legacy / foreign spellings → canonical enum value (mirrors api/_lib/domain/categories.ts). */
const CATEGORY_ALIASES: Record<string, Category> = {
  electronics: Category.Electronics, electronica: Category.Electronics, electrónica: Category.Electronics,
  furniture: Category.Furniture, home: Category.Furniture, hogar: Category.Furniture, homegarden: Category.Furniture,
  clothing: Category.Clothing, fashion: Category.Clothing, moda: Category.Clothing, healthbeauty: Category.Clothing,
  books: Category.Books, libros: Category.Books,
  sports: Category.Sports, deportes: Category.Sports,
  vehicles: Category.Vehicles, autos: Category.Vehicles, cars: Category.Vehicles,
  realestate: Category.RealEstate, inmuebles: Category.RealEstate,
  services: Category.Services, servicios: Category.Services,
  other: Category.Other, otros: Category.Other,
};

/** Canonical category for whatever spelling the row carries (`electronics`, `real_estate`, "Health & Beauty > …"). */
export const normalizeCategory = (raw: string | null | undefined): Category => {
  if (!raw) return Category.Other;
  const top = raw.split('>')[0].trim();
  if ((CATEGORIES as readonly string[]).includes(top)) return top as Category;
  return CATEGORY_ALIASES[top.toLowerCase().replace(/[\s_\-&]/g, '')] ?? Category.Other;
};
