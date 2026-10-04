import React from 'react';
import { Helmet } from 'react-helmet';

/**
 * Reusable SEO + AEO head component.
 *
 * Sets per-route <title>, meta description, canonical, OG/Twitter cards and
 * any number of JSON-LD blocks (Product, FAQPage, BreadcrumbList, …).
 *
 * Why react-helmet works here even though we're a SPA:
 *   • Modern Googlebot, Bingbot and the AI crawlers (GPTBot, ClaudeBot,
 *     PerplexityBot, Google-Extended) DO execute JavaScript before reading
 *     the rendered head. Setting tags after mount is fine for them.
 *   • The static <noscript> block in index.html catches the rare crawler
 *     that doesn't execute JS by giving them brand-rich plain-text content.
 *   • New products created in the admin panel flow through this component
 *     automatically because the schema is derived from product props, not
 *     hand-written HTML.
 */
const SITE_URL = 'https://celestaglow.com';
const BRAND_NAME = 'Celesta Glow';
const DEFAULT_OG_IMAGE =
  'https://customer-assets.emergentagent.com/job_3e020a22-98fc-4fee-b377-5bacdddf46ce/artifacts/ig243hne_IMG_9115.png';

// Tight SEO keyword set — anti-aging core, plus the Kerala districts that drive
// the bulk of our orders. Kept short on purpose; Google penalises stuffing.
const DEFAULT_KEYWORDS = [
  'anti aging products kerala',
  'retinol serum kerala',
  'best skincare brand kerala',
  'celesta glow',
  'dermatologist approved skincare',
  'anti aging cream india',
  'cosmetics online kerala',
  'kochi', 'ernakulam', 'thiruvananthapuram', 'kozhikode',
  'thrissur', 'malappuram', 'kollam', 'palakkad', 'kannur',
].join(', ');

const DEFAULT_DESCRIPTION =
  "Celesta Glow — Kerala's trusted anti-aging skincare brand. Clinical retinol, peptides & vitamin-C serums made for Indian skin. Free shipping across Kochi, Thiruvananthapuram, Kozhikode, Thrissur & all Kerala districts. 7-day sealed-bottle return.";

export default function SEOHead({
  title,
  description,
  canonicalPath = '/',
  ogImage,
  noindex = false,
  jsonLd = [], // array of plain objects → emitted as <script type="application/ld+json">
  keywords,
}) {
  const fullTitle =
    title && title.toLowerCase().includes('celesta')
      ? title
      : title
      ? `${title} | ${BRAND_NAME}`
      : `${BRAND_NAME} – Kerala's Trusted Anti-Aging Skincare Brand`;
  const desc = description || DEFAULT_DESCRIPTION;
  const kw = keywords || DEFAULT_KEYWORDS;
  const canonical = `${SITE_URL}${canonicalPath.startsWith('/') ? canonicalPath : '/' + canonicalPath}`;
  const ogImg = ogImage || DEFAULT_OG_IMAGE;
  const ldArray = Array.isArray(jsonLd) ? jsonLd.filter(Boolean) : [jsonLd].filter(Boolean);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="keywords" content={kw} />
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en-in" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImg} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={BRAND_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImg} />
      {ldArray.map((ld, i) => (
        <script key={`ld-${i}`} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}

// ---------- JSON-LD builders (re-export so pages stay tiny) ----------

export const SITE = SITE_URL;
export const BRAND = BRAND_NAME;

export function productJsonLd({
  name,
  slug,
  description,
  image,
  price,
  mrp,
  inStock = true,
  rating = 4.7,
  reviewCount = 1240,
  brand = BRAND_NAME,
}) {
  const url = `${SITE_URL}/product/${slug}`;
  const offer = {
    '@type': 'Offer',
    url,
    priceCurrency: 'INR',
    price: String(price ?? 0),
    availability: inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    seller: { '@type': 'Organization', name: 'Veegal Enterprises LLP' },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 7, unitCode: 'DAY' },
      },
    },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'IN',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn',
    },
  };
  if (mrp && Number(mrp) > Number(price)) {
    offer.priceSpecification = {
      '@type': 'UnitPriceSpecification',
      price: String(mrp),
      priceCurrency: 'INR',
      valueAddedTaxIncluded: true,
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: Array.isArray(image) ? image : image ? [image] : undefined,
    sku: `CG-${(slug || '').toUpperCase()}`,
    brand: { '@type': 'Brand', name: brand },
    offers: offer,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(rating),
      reviewCount: String(reviewCount || 1),
    },
  };
}

export function breadcrumbJsonLd(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url?.startsWith('http') ? it.url : `${SITE_URL}${it.url || '/'}`,
    })),
  };
}

export function faqJsonLd(faqs = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
