import { CANONICAL_CATEGORIES, normalizeCategory, type CanonicalCategory } from '../domain/categories.js';
import { PLATFORM_FEE_RATE, SHIPPING_FEE_MXN } from '../domain/orders.js';

/**
 * Site-wide SEO / GEO facts shared by the prerender, the sitemap and the LLM manifests.
 * Everything a search or answer engine may quote about DESCU lives here once, so the
 * numbers (fee, shipping, payment methods) cannot drift between pages.
 */

export type SeoLang = 'es' | 'en' | 'zh';
export const SEO_LANGS: SeoLang[] = ['es', 'en', 'zh'];

export const BASE_URL = 'https://descu.ai';
export const OG_IMAGE = `${BASE_URL}/og-image.png`;
export const HOW_IT_WORKS_PATH = '/como-funciona';

export const htmlLangFor = (lang: SeoLang) => (lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'es-MX');
export const ogLocaleFor = (lang: SeoLang) => (lang === 'zh' ? 'zh_CN' : lang === 'en' ? 'en_US' : 'es_MX');

export const parseSeoLang = (raw: unknown): SeoLang =>
    raw === 'en' || raw === 'zh' || raw === 'es' ? raw : 'es';

/** Human facts (also rendered into llms.txt by hand — keep in sync). */
export const SITE_FACTS = {
    platformFeePercent: Math.round(PLATFORM_FEE_RATE * 100),   // 5 — added on top of the price, buyer pays it, online (Stripe) payments only
    shippingFeeMxn: SHIPPING_FEE_MXN,                          // 50 — flat, paid by the buyer
    paymentWindowHours: 24,                                    // unpaid online orders expire
    paymentMethods: ['card', 'OXXO', 'SPEI', 'cash on meetup'],
    languages: ['es', 'en', 'zh'],
    country: 'MX',
};

/** Canonical category → slug used in `/buy/{slug}/in/{city}`. */
export const categorySlug = (category: CanonicalCategory): string => category.toLowerCase();

/** Slug (or any stored spelling) → canonical category; `null` for unknown slugs. */
export const categoryFromSlug = (slug: string): CanonicalCategory | null => {
    const s = slug.toLowerCase();
    if (s === 'all') return null;
    const canonical = normalizeCategory(s);
    // normalizeCategory maps unknown → Other; only accept 'Other' when the slug really says so
    if (canonical === 'Other' && !['other', 'otros', 'others', 'misc'].includes(s)) return null;
    return canonical;
};

const CATEGORY_LABELS: Record<CanonicalCategory, Record<SeoLang, string>> = {
    Electronics: { es: 'Electrónica', en: 'Electronics', zh: '电子产品' },
    Furniture: { es: 'Hogar y Muebles', en: 'Home & Furniture', zh: '家居家具' },
    Clothing: { es: 'Moda y Ropa', en: 'Clothing & Fashion', zh: '服饰' },
    Books: { es: 'Libros', en: 'Books', zh: '图书' },
    Sports: { es: 'Deportes', en: 'Sports', zh: '运动户外' },
    Vehicles: { es: 'Autos y Vehículos', en: 'Cars & Vehicles', zh: '汽车' },
    RealEstate: { es: 'Inmuebles', en: 'Real Estate', zh: '房产' },
    Services: { es: 'Servicios', en: 'Services', zh: '服务' },
    Other: { es: 'Otros artículos', en: 'Other items', zh: '其他' },
};

export const categoryLabel = (category: unknown, lang: SeoLang): string =>
    CATEGORY_LABELS[normalizeCategory(category)][lang];

export const ALL_CATEGORY_SLUGS = CANONICAL_CATEGORIES.map(categorySlug);

export const landingPath = (category: CanonicalCategory, citySlug: string) =>
    `/buy/${categorySlug(category)}/in/${citySlug}`;

/** Tagline / boilerplate per language. */
export const SITE_TEXT: Record<SeoLang, { name: string; tagline: string; shortDesc: string; homeTitle: string; homeDesc: string }> = {
    es: {
        name: 'DESCU',
        tagline: 'Marketplace de segunda mano con IA en México',
        shortDesc: 'Compra y vende artículos de segunda mano cerca de ti. Publica con una foto: la IA identifica el artículo, escribe la descripción y sugiere el precio. Pago seguro con custodia (Stripe) o entrega en persona.',
        homeTitle: 'DESCU - Compra y Vende Segunda Mano con IA | México',
        homeDesc: 'Marketplace de segunda mano con inteligencia artificial en México. Electrónica, autos, muebles, ropa y más cerca de ti. Publica con una foto y vende con pago seguro.',
    },
    en: {
        name: 'DESCU',
        tagline: 'AI-powered secondhand marketplace in Mexico',
        shortDesc: 'Buy and sell pre-owned items near you in Mexico. List with one photo: the AI identifies the item, writes the description and suggests a price. Secure escrow payment (Stripe) or in-person handoff.',
        homeTitle: 'DESCU - Buy & Sell Secondhand with AI | Mexico',
        homeDesc: "Mexico's AI-powered secondhand marketplace. Electronics, cars, furniture, clothing and more near you. List with a photo and sell with secure payments.",
    },
    zh: {
        name: 'DESCU',
        tagline: '墨西哥 AI 二手交易平台',
        shortDesc: '在墨西哥就近买卖二手物品。拍一张照片即可发布：AI 自动识别物品、撰写描述并建议价格。支持 Stripe 担保支付或当面交易。',
        homeTitle: 'DESCU - AI 二手交易平台 | 墨西哥',
        homeDesc: '墨西哥的 AI 二手交易平台。电子产品、汽车、家具、服饰等，就在你身边。拍照发布，安全收款。',
    },
};

export interface QA { q: string; a: string }
export interface Step { name: string; text: string }

/**
 * "How it works" content — the /como-funciona page, its FAQPage + HowTo JSON-LD and the
 * homepage summary all read from here. Facts are interpolated from SITE_FACTS.
 */
export const howItWorksContent = (lang: SeoLang) => {
    const fee = SITE_FACTS.platformFeePercent;
    const ship = SITE_FACTS.shippingFeeMxn;
    const hours = SITE_FACTS.paymentWindowHours;

    const content: Record<SeoLang, { title: string; metaTitle: string; metaDesc: string; intro: string; sellSteps: Step[]; buySteps: Step[]; faq: QA[]; sellHeading: string; buyHeading: string; faqHeading: string }> = {
        es: {
            title: 'Cómo funciona DESCU',
            metaTitle: 'Cómo funciona DESCU: vender y comprar segunda mano con IA | DESCU',
            metaDesc: `Guía de DESCU: publica con una foto, la IA redacta y valúa; compra con pago en custodia (tarjeta, OXXO, SPEI) o en efectivo al entregar. Publicar es gratis; el comprador paga una comisión del ${fee}% solo en pagos en línea. Envío fijo de $${ship} MXN.`,
            intro: `DESCU es un marketplace de segunda mano en México. Publicar es gratis: tomas una foto, la inteligencia artificial identifica el artículo, escribe título y descripción en español, inglés y chino, y sugiere un precio de mercado. Los compradores ven primero lo que está cerca de ellos, chatean con el vendedor y pagan con custodia (escrow) a través de Stripe o en efectivo al recoger el artículo.`,
            sellHeading: 'Cómo vender',
            buyHeading: 'Cómo comprar',
            faqHeading: 'Preguntas frecuentes',
            sellSteps: [
                { name: 'Toma una foto', text: 'Abre DESCU, toca "Vender" y toma una o varias fotos del artículo.' },
                { name: 'La IA redacta el anuncio', text: 'Google Gemini identifica el producto, elige la categoría, escribe el título y la descripción y sugiere un precio. Puedes editar todo antes de publicar.' },
                { name: 'Publica y chatea', text: 'Publica gratis. Los compradores cercanos te escriben por el chat de DESCU; puedes recibir ofertas y aceptar, rechazar o contraofertar.' },
                { name: 'Entrega y cobra', text: `Entrega en persona o envía el artículo. En pagos en línea el dinero queda en custodia hasta que el comprador confirma la recepción; después se transfiere el precio completo a tu cuenta por SPEI. La comisión del ${fee}% la paga el comprador, no tú.` },
            ],
            buySteps: [
                { name: 'Explora cerca de ti', text: 'La portada muestra artículos ordenados por distancia. Filtra por categoría o busca por palabra clave.' },
                { name: 'Chatea y negocia', text: 'Pregunta al vendedor, pide más fotos o envía una oferta desde el chat.' },
                { name: 'Elige cómo pagar', text: `Pago en línea con tarjeta, OXXO o SPEI (el dinero queda en custodia) o en efectivo al momento de la entrega. El envío a domicilio cuesta $${ship} MXN fijos y solo está disponible con pago en línea.` },
                { name: 'Confirma la recepción', text: 'Cuando recibes el artículo confirmas en la app y el pago se libera al vendedor. Si algo sale mal, abres una disputa y el equipo de DESCU interviene.' },
            ],
            faq: [
                { q: '¿Cuánto cuesta publicar en DESCU?', a: 'Publicar es gratis y sin límite de anuncios. El vendedor no paga comisión: en las ventas pagadas en línea el comprador cubre una comisión de servicio sobre el precio.' },
                { q: `¿Cuál es la comisión de DESCU?`, a: `Una comisión de servicio del ${fee}% del precio del artículo que paga el comprador al pagar en línea (tarjeta, OXXO o SPEI); el vendedor recibe el precio completo. Las ventas en efectivo acordadas en persona no tienen comisión.` },
                { q: '¿Qué métodos de pago acepta DESCU?', a: 'Tarjeta de crédito o débito, OXXO y transferencia SPEI a través de Stripe, además de efectivo al entregar en persona.' },
                { q: '¿Cómo funciona el pago en custodia (escrow)?', a: 'Cuando pagas en línea, Stripe retiene el dinero. El vendedor solo lo recibe cuando confirmas que recibiste el artículo. Si hay un problema puedes abrir una disputa antes de confirmar.' },
                { q: '¿Cuánto cuesta el envío?', a: `El envío a domicilio tiene un costo fijo de $${ship} MXN que paga el comprador. También puedes acordar una entrega en persona sin costo.` },
                { q: '¿Puedo cancelar un pedido?', a: `Sí. El comprador puede cancelar un pedido en línea mientras no esté pagado, y cualquiera de las dos partes puede cancelar un pedido en efectivo que aún no se haya completado. Los pedidos en línea sin pagar expiran automáticamente a las ${hours} horas.` },
                { q: '¿En qué ciudades funciona DESCU?', a: 'En todo México. Los artículos se muestran según tu ubicación; la mayor actividad está en Ciudad de México y su zona metropolitana, Guadalajara y Monterrey.' },
                { q: '¿En qué idiomas está DESCU?', a: 'Español, inglés y chino. Los anuncios se traducen automáticamente a los tres idiomas.' },
                { q: '¿DESCU tiene app?', a: 'Sí, DESCU está disponible en la web (descu.ai) y en Google Play como app para Android.' },
            ],
        },
        en: {
            title: 'How DESCU works',
            metaTitle: 'How DESCU works: sell and buy secondhand with AI | DESCU',
            metaDesc: `DESCU guide: list with one photo and let AI write and price it; buy with escrow (card, OXXO, SPEI) or cash on handoff. Listing is free; buyers pay a ${fee}% service fee only on online payments. Flat MX$${ship} shipping.`,
            intro: `DESCU is a secondhand marketplace in Mexico. Listing is free: take a photo, the AI identifies the item, writes a title and description in Spanish, English and Chinese, and suggests a market price. Buyers see what is near them first, chat with the seller, and pay through Stripe escrow or in cash when they pick the item up.`,
            sellHeading: 'How to sell',
            buyHeading: 'How to buy',
            faqHeading: 'Frequently asked questions',
            sellSteps: [
                { name: 'Take a photo', text: 'Open DESCU, tap "Sell" and take one or more photos of the item.' },
                { name: 'AI writes the listing', text: 'Google Gemini identifies the product, picks the category, writes the title and description and suggests a price. Edit anything before publishing.' },
                { name: 'Publish and chat', text: 'Publishing is free. Nearby buyers message you in the DESCU chat; you can receive offers and accept, reject or counter them.' },
                { name: 'Hand over and get paid', text: `Meet in person or ship the item. For online payments the money stays in escrow until the buyer confirms receipt, then the full price is transferred to your bank account by SPEI. The ${fee}% service fee is paid by the buyer, not by you.` },
            ],
            buySteps: [
                { name: 'Browse nearby', text: 'The home feed is sorted by distance. Filter by category or search by keyword.' },
                { name: 'Chat and negotiate', text: 'Ask the seller questions, request more photos or send an offer from the chat.' },
                { name: 'Choose how to pay', text: `Pay online by card, OXXO or SPEI (funds are held in escrow) or in cash at handoff. Home delivery costs a flat MX$${ship} and is only available with online payment.` },
                { name: 'Confirm receipt', text: 'Once you have the item you confirm in the app and the payment is released to the seller. If something is wrong you open a dispute and the DESCU team steps in.' },
            ],
            faq: [
                { q: 'How much does it cost to list on DESCU?', a: 'Listing is free with no limit on the number of listings. Sellers pay no commission: on sales paid online the buyer covers a service fee on top of the price.' },
                { q: 'What is the DESCU fee?', a: `A ${fee}% service fee on the item price, paid by the buyer when paying online (card, OXXO or SPEI); the seller receives the full price. Cash sales arranged in person carry no fee.` },
                { q: 'Which payment methods does DESCU accept?', a: 'Credit or debit card, OXXO and SPEI bank transfer through Stripe, plus cash when meeting in person.' },
                { q: 'How does escrow work?', a: 'When you pay online, Stripe holds the money. The seller only receives it once you confirm you got the item. If there is a problem you can open a dispute before confirming.' },
                { q: 'How much is shipping?', a: `Home delivery is a flat MX$${ship}, paid by the buyer. You can also arrange a free in-person handoff.` },
                { q: 'Can I cancel an order?', a: `Yes. A buyer can cancel an online order while it is unpaid, and either party can cancel a cash order that has not been completed. Unpaid online orders expire automatically after ${hours} hours.` },
                { q: 'Which cities does DESCU cover?', a: 'All of Mexico. Listings are shown by your location; most activity is in Mexico City and its metro area, Guadalajara and Monterrey.' },
                { q: 'Which languages does DESCU support?', a: 'Spanish, English and Chinese. Listings are translated automatically into all three.' },
                { q: 'Is there a DESCU app?', a: 'Yes, DESCU is available on the web (descu.ai) and on Google Play as an Android app.' },
            ],
        },
        zh: {
            title: 'DESCU 是如何运作的',
            metaTitle: 'DESCU 使用指南：用 AI 买卖二手 | DESCU',
            metaDesc: `DESCU 指南：拍照发布，AI 自动撰写描述并定价；支持担保支付（银行卡、OXXO、SPEI）或当面付现。发布免费；仅在线支付时由买家承担 ${fee}% 服务费，配送固定 ${ship} 比索。`,
            intro: `DESCU 是墨西哥的二手交易平台。发布完全免费：拍一张照片，AI 会识别物品、用西班牙语、英语和中文撰写标题与描述，并给出市场参考价。买家优先看到附近的商品，通过聊天联系卖家，可选择 Stripe 担保支付或当面付现。`,
            sellHeading: '如何出售',
            buyHeading: '如何购买',
            faqHeading: '常见问题',
            sellSteps: [
                { name: '拍照', text: '打开 DESCU，点击"出售"，为物品拍一张或多张照片。' },
                { name: 'AI 撰写商品信息', text: 'Google Gemini 识别商品、选择分类、撰写标题和描述并建议价格。发布前可随意修改。' },
                { name: '发布并聊天', text: '免费发布。附近的买家会通过 DESCU 聊天联系你；你可以接受、拒绝或反向出价。' },
                { name: '交付并收款', text: `当面交付或寄送商品。在线支付的款项在买家确认收货前由平台担保，之后全额价款通过 SPEI 转入你的银行账户。${fee}% 服务费由买家承担，卖家不扣费。` },
            ],
            buySteps: [
                { name: '浏览附近商品', text: '首页按距离排序。可按分类筛选或关键词搜索。' },
                { name: '聊天议价', text: '在聊天中向卖家提问、索取更多照片或直接出价。' },
                { name: '选择支付方式', text: `在线支付支持银行卡、OXXO 和 SPEI（资金由平台担保），或当面付现。送货上门固定收费 ${ship} 比索，仅限在线支付。` },
                { name: '确认收货', text: '收到商品后在应用内确认，款项随即释放给卖家。如有问题，可在确认前发起争议，由 DESCU 团队介入处理。' },
            ],
            faq: [
                { q: '在 DESCU 发布商品要收费吗？', a: '发布免费且不限数量。卖家不付佣金：在线支付成交时，由买家在价格之上支付一笔服务费。' },
                { q: 'DESCU 的手续费是多少？', a: `买家在线支付（银行卡、OXXO、SPEI）时按商品价格支付 ${fee}% 的服务费，卖家收到全额价款。当面现金交易不收费。` },
                { q: 'DESCU 支持哪些支付方式？', a: '通过 Stripe 支持信用卡/借记卡、OXXO 便利店付款和 SPEI 银行转账，也支持当面付现。' },
                { q: '担保支付（escrow）如何运作？', a: '在线支付时，款项由 Stripe 托管。只有在你确认收货后卖家才能收到钱。如有问题，可在确认前发起争议。' },
                { q: '配送费多少？', a: `送货上门固定 ${ship} 比索，由买家承担。也可以约定免费当面交易。` },
                { q: '可以取消订单吗？', a: `可以。买家可在未付款前取消在线订单；现金订单在完成前双方均可取消。未付款的在线订单在 ${hours} 小时后自动过期。` },
                { q: 'DESCU 覆盖哪些城市？', a: '全墨西哥。商品按你的位置展示，目前最活跃的是墨西哥城及都会区、瓜达拉哈拉和蒙特雷。' },
                { q: 'DESCU 支持哪些语言？', a: '西班牙语、英语和中文，商品信息会自动翻译成三种语言。' },
                { q: 'DESCU 有 App 吗？', a: '有。DESCU 提供网页版（descu.ai）以及 Google Play 上的 Android 应用。' },
            ],
        },
    };
    return content[lang];
};
