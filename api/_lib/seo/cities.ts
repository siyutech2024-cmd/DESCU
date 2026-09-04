/**
 * Cities with a programmatic landing page (`/buy/{category}/in/{city}`).
 *
 * `patterns` are the spellings that may sit in `products.city` / `town` / `location_display_name`
 * (reverse-geocoded, so accents and metro-area municipalities vary). Accented vowels are matched
 * with the single-char wildcard `_` so "México" and "Mexico" both hit. The Mexico City page also
 * covers the metropolitan municipalities of Estado de México, which the geocoder returns as `city`.
 */

export interface SeoCity {
    slug: string;
    name: string;          // display name (Spanish, the market language)
    nameEn: string;
    nameZh: string;
    state: string;
    patterns: string[];    // lowercase fragments, `_` = any single char (accents), matched in memory
}

export const SEO_CITIES: SeoCity[] = [
    {
        slug: 'ciudad-de-mexico', name: 'Ciudad de México', nameEn: 'Mexico City', nameZh: '墨西哥城', state: 'CDMX',
        patterns: [
            'ciudad de m_xico', 'mexico city', 'cdmx', 'distrito federal',
            // metro area (Estado de México) — the geocoder returns these as the city
            'tlalnepantla', 'naucalpan', 'ecatepec', 'nezahualc_yotl', 'huixquilucan', 'cuautitl_n', 'tultitl_n',
            'coacalco', 'chimalhuac_n', 'atizap_n', 'tec_mac', 'la paz, m_xico', 'ixtapaluca', 'chalco',
            // boroughs people type as their city
            'coyoac_n', 'benito ju_rez', 'miguel hidalgo', 'cuauht_moc', 'iztapalapa', 'gustavo a. madero', 'tlalpan',
            '_lvaro obreg_n', 'azcapotzalco', 'xochimilco', 'venustiano carranza', 'iztacalco', 'polanco', 'condesa', 'roma norte',
        ],
    },
    { slug: 'guadalajara', name: 'Guadalajara', nameEn: 'Guadalajara', nameZh: '瓜达拉哈拉', state: 'Jalisco', patterns: ['guadalajara', 'zapopan', 'tlaquepaque', 'tonal_', 'tlajomulco'] },
    { slug: 'monterrey', name: 'Monterrey', nameEn: 'Monterrey', nameZh: '蒙特雷', state: 'Nuevo León', patterns: ['monterrey', 'san pedro garza', 'san nicol_s de los garza', 'guadalupe, nuevo le_n', 'apodaca', 'santa catarina', 'escobedo'] },
    { slug: 'puebla', name: 'Puebla', nameEn: 'Puebla', nameZh: '普埃布拉', state: 'Puebla', patterns: ['puebla', 'cholula'] },
    { slug: 'tijuana', name: 'Tijuana', nameEn: 'Tijuana', nameZh: '蒂华纳', state: 'Baja California', patterns: ['tijuana', 'rosarito'] },
    { slug: 'leon', name: 'León', nameEn: 'León', nameZh: '莱昂', state: 'Guanajuato', patterns: ['le_n, guanajuato', 'le_n de los aldama', 'le_n gto', 'leon, gto'] },
    { slug: 'cancun', name: 'Cancún', nameEn: 'Cancún', nameZh: '坎昆', state: 'Quintana Roo', patterns: ['canc_n', 'benito ju_rez, quintana roo', 'playa del carmen'] },
    { slug: 'merida', name: 'Mérida', nameEn: 'Mérida', nameZh: '梅里达', state: 'Yucatán', patterns: ['m_rida'] },
    { slug: 'queretaro', name: 'Querétaro', nameEn: 'Querétaro', nameZh: '克雷塔罗', state: 'Querétaro', patterns: ['quer_taro', 'el marqu_s', 'corregidora'] },
    { slug: 'toluca', name: 'Toluca', nameEn: 'Toluca', nameZh: '托卢卡', state: 'Estado de México', patterns: ['toluca', 'metepec', 'zinacantepec', 'lerma'] },
    { slug: 'aguascalientes', name: 'Aguascalientes', nameEn: 'Aguascalientes', nameZh: '阿瓜斯卡连特斯', state: 'Aguascalientes', patterns: ['aguascalientes'] },
    { slug: 'chihuahua', name: 'Chihuahua', nameEn: 'Chihuahua', nameZh: '奇瓦瓦', state: 'Chihuahua', patterns: ['chihuahua'] },
    { slug: 'morelia', name: 'Morelia', nameEn: 'Morelia', nameZh: '莫雷利亚', state: 'Michoacán', patterns: ['morelia'] },
    { slug: 'saltillo', name: 'Saltillo', nameEn: 'Saltillo', nameZh: '萨尔蒂约', state: 'Coahuila', patterns: ['saltillo', 'ramos arizpe'] },
    { slug: 'hermosillo', name: 'Hermosillo', nameEn: 'Hermosillo', nameZh: '埃莫西约', state: 'Sonora', patterns: ['hermosillo'] },
];

/** The country-wide page: `/buy/{category}/in/mexico`. */
export const ALL_MEXICO_SLUG = 'mexico';

export const findCity = (slug: string): SeoCity | undefined => {
    const s = slug.toLowerCase();
    return SEO_CITIES.find(c => c.slug === s);
};

/** Fold to lowercase ASCII (strip accents) for in-memory matching. */
export const foldText = (s: string): string =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Pattern (with `_` wildcards) → regex on folded text. */
const patternRegex = (p: string) => new RegExp(foldText(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.'));

const REGEX_CACHE = new Map<string, RegExp[]>();
const regexesFor = (city: SeoCity): RegExp[] => {
    let r = REGEX_CACHE.get(city.slug);
    if (!r) { r = city.patterns.map(patternRegex); REGEX_CACHE.set(city.slug, r); }
    return r;
};

/** Does this product (city / town / location_display_name) belong to the city page? */
export const productInCity = (
    city: SeoCity,
    p: { city?: string | null; town?: string | null; location_display_name?: string | null },
): boolean => {
    const hay = foldText([p.city, p.town, p.location_display_name].filter(Boolean).join(' | '));
    if (!hay) return false;
    return regexesFor(city).some(re => re.test(hay));
};
