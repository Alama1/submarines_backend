/**
 * Single source of truth for the unauthenticated (client/plugin) routes.
 * The gateway serves everything under the global `api` prefix, but health
 * checks and legacy plugin callers may hit the bare paths too, so `/api`
 * is stripped before matching — the table only lists bare paths once.
 */

const API_PREFIX = /^\/api(?=\/|$)/;

interface PublicRouteRule {
  methods: string[]; // empty = any method
  pattern: RegExp;   // tested against the path (query string removed, /api stripped)
}

const RULES: PublicRouteRule[] = [
  { methods: ['GET', 'HEAD'], pattern: /^\/health$/ },
  { methods: ['POST'], pattern: /^\/orders$/ },
  { methods: ['POST'], pattern: /^\/promo-codes\/validate$/ },
  { methods: ['GET'], pattern: /^\/orders\/lookup\// },
  { methods: ['GET'], pattern: /^\/orders\/in-progress$/ },
  { methods: ['GET'], pattern: /^\/inventory\/missing$/ },
  { methods: ['POST'], pattern: /^\/inventory\/claims$/ },
  { methods: ['GET'], pattern: /^\/inventory\/claims\/lookup\// },
  { methods: ['POST'], pattern: /^\/inventory\/claims\/[^/]+\/(cancel|complete)$/ },
  { methods: ['GET'], pattern: /^\/about(\/|$)/ },
  { methods: ['GET'], pattern: /^\/docs(\/|$)/ },
  // Public read-only catalog endpoints (plugin pricing / craft helpers).
  { methods: ['GET'], pattern: /^\/(recipes|materials|prices|discounts|crafter-discounts)(\/|$)/ },
];

export function isPublicRoute(method: string, url: string): boolean {
  const path = (url || '').split('?')[0].replace(API_PREFIX, '');
  return RULES.some(
    (r) => (r.methods.length === 0 || r.methods.includes(method)) && r.pattern.test(path),
  );
}
