import { isPublicRoute } from './public-routes';

describe('isPublicRoute', () => {
  it.each([
    ['GET', '/health'],
    ['GET', '/api/health'],
    ['POST', '/api/orders'],
    ['POST', '/orders'],
    ['POST', '/api/promo-codes/validate'],
    ['GET', '/api/orders/lookup/SUB-ABC'],
    ['GET', '/orders/lookup/SUB-ABC'],
    ['GET', '/api/orders/in-progress'],
    ['GET', '/api/inventory/missing'],
    ['POST', '/api/inventory/claims'],
    ['GET', '/api/inventory/claims/lookup/CLM-ABC'],
    ['POST', '/api/inventory/claims/CLM-ABC/cancel'],
    ['POST', '/inventory/claims/CLM-ABC/complete'],
    ['GET', '/api/about'],
    ['GET', '/api/about/prices'],
    ['GET', '/api/docs'],
    ['GET', '/api/docs/orders/index.html'],
    ['GET', '/api/recipes'],
    ['GET', '/materials'],
    ['GET', '/api/prices'],
    ['GET', '/api/prices/123'],
    ['GET', '/api/discounts'],
    ['GET', '/api/crafter-discounts'],
  ])('allows %s %s', (method, url) => {
    expect(isPublicRoute(method, url)).toBe(true);
  });

  it.each([
    ['GET', '/api/orders'],
    ['PUT', '/api/orders/1'],
    ['PATCH', '/api/orders/1/status'],
    ['POST', '/api/orders/1/deliver'],
    ['DELETE', '/api/orders/1'],
    ['GET', '/api/orders/admin/in-progress'],
    ['GET', '/api/orders/admin/lookup/SUB-ABC'],
    ['GET', '/api/inventory'],
    ['PUT', '/api/inventory/stock/1'],
    ['GET', '/api/inventory/claims'],
    ['PATCH', '/api/inventory/claims/1/status'],
    ['POST', '/api/promo-codes'],
    ['POST', '/api/prices'],
    ['PUT', '/api/prices/1'],
    ['GET', '/api/auth/whitelist'],
    ['POST', '/api/inventory/claims/CLM-1/confirm'],
    ['DELETE', '/api/inventory/cache/characters/1'],
    ['POST', '/health'],
  ])('denies %s %s', (method, url) => {
    expect(isPublicRoute(method, url)).toBe(false);
  });

  it('ignores query strings', () => {
    expect(isPublicRoute('GET', '/api/inventory/missing?limit=5')).toBe(true);
  });

  it('does not treat /apifoo as prefixed', () => {
    expect(isPublicRoute('POST', '/apifoo/orders')).toBe(false);
  });
});
