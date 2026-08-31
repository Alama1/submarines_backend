import { All, Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyReply } from 'fastify';
import { ProxyIncomingRequest, ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  private readonly recipesUrl: string;
  private readonly pricesUrl: string;
  private readonly inventoryUrl: string;
  private readonly ordersUrl: string;

  constructor(
    private readonly proxy: ProxyService,
    config: ConfigService,
  ) {
    this.recipesUrl = config.get<string>('RECIPES_SERVICE_URL', 'http://recipes-service:3004');
    this.pricesUrl = config.get<string>('PRICES_SERVICE_URL', 'http://prices-service:3001');
    this.inventoryUrl = config.get<string>('INVENTORY_SERVICE_URL', 'http://inventory-service:3002');
    this.ordersUrl = config.get<string>('ORDERS_SERVICE_URL', 'http://orders-service:3003');
  }

  private async forward(targetBaseUrl: string, req: ProxyIncomingRequest, reply: FastifyReply) {
    const result = await this.proxy.forwardRequest(targetBaseUrl, req);
    reply.status(result.status);
    reply.header('content-type', result.contentType);
    return result.body;
  }

  // ── Swagger docs for downstream services (/api/docs/<service>) ────────
  // The services serve their docs at /docs (no /api prefix). This section
  // rewrites /api/docs/<svc>... so each service's full OpenAPI docs are
  // reachable through the public gateway URL.
  //
  //   /api/docs/<svc>-json      -> <svc>/docs-json
  //   /api/docs/<svc>/          -> <svc>/docs          (trailing slash required
  //   /api/docs/<svc>/docs/*    -> <svc>/docs/*         so relative assets work)
  private resolveDocsService(service: string): string | null {
    switch (service) {
      case 'orders': return this.ordersUrl;
      case 'inventory': return this.inventoryUrl;
      case 'prices': return this.pricesUrl;
      case 'recipes': return this.recipesUrl;
      default: return null;
    }
  }

  private forwardDocs(req: ProxyIncomingRequest, reply: FastifyReply, segment: string, targetPath: string) {
    const isJson = segment.endsWith('-json');
    const service = isJson ? segment.slice(0, -'-json'.length) : segment;
    const target = this.resolveDocsService(service);
    if (!target) {
      reply.status(404);
      return { statusCode: 404, message: `No Swagger docs for "${service}"` };
    }
    if (req.raw) req.raw.url = targetPath;
    return this.forward(target, req, reply);
  }

  /** /api/docs/<svc> or /api/docs/<svc>-json */
  @All('docs/:segment')
  proxyDocsIndex(
    @Req() req: ProxyIncomingRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param('segment') segment: string,
  ) {
    if (segment.endsWith('-json')) {
      return this.forwardDocs(req, reply, segment, '/docs-json');
    }
    // Swagger UI page: redirect to the trailing-slash form so the page's
    // relative asset paths (./docs/...) resolve under the service subtree
    if (req.method === 'GET' || req.method === 'HEAD') {
      reply.status(301);
      reply.header('location', `/api/docs/${segment}/`);
      return;
    }
    reply.status(404);
    return { statusCode: 404, message: 'Not found' };
  }

  /** /api/docs/<svc>/ — the Swagger UI page itself */
  @All('docs/:segment/')
  proxyDocsPage(
    @Req() req: ProxyIncomingRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param('segment') segment: string,
  ) {
    return this.forwardDocs(req, reply, segment, '/docs');
  }

  /** /api/docs/<svc>/docs/* — swagger static assets + init script */
  @All('docs/:segment/docs/*')
  proxyDocsAssets(
    @Req() req: ProxyIncomingRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param('segment') segment: string,
  ) {
    const raw = req.raw?.url || req.url || '';
    const suffix = raw.slice(`/api/docs/${segment}`.length); // e.g. "/docs/swagger-ui.css"
    return this.forwardDocs(req, reply, segment, suffix || '/docs');
  }

  // ── Recipes Service (/api/materials, /api/recipes) ────────────
  @All('materials')
  proxyMaterialsRoot(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.recipesUrl, req, reply);
  }

  @All('materials/*')
  proxyMaterialsWildcard(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.recipesUrl, req, reply);
  }

  @All('recipes')
  proxyRecipesRoot(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.recipesUrl, req, reply);
  }

  @All('recipes/*')
  proxyRecipesWildcard(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.recipesUrl, req, reply);
  }

  @All('xivapi')
  proxyXivApiRoot(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.recipesUrl, req, reply);
  }

  @All('xivapi/*')
  proxyXivApiWildcard(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.recipesUrl, req, reply);
  }

  // ── Prices Service (/api/prices) ──────────────────────────────
  @All('prices')
  proxyPricesRoot(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.pricesUrl, req, reply);
  }

  @All('prices/*')
  proxyPricesWildcard(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.pricesUrl, req, reply);
  }

  // ── Inventory Service (/api/inventory) ────────────────────────
  @All('inventory')
  proxyInventoryRoot(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.inventoryUrl, req, reply);
  }

  @All('inventory/*')
  proxyInventoryWildcard(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.inventoryUrl, req, reply);
  }

  // ── Orders Service (/api/orders, /api/discounts) ──────────────
  @All('orders')
  proxyOrdersRoot(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.ordersUrl, req, reply);
  }

  @All('orders/*')
  proxyOrdersWildcard(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.ordersUrl, req, reply);
  }

  @All('discounts')
  proxyDiscountsRoot(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.ordersUrl, req, reply);
  }

  @All('discounts/*')
  proxyDiscountsWildcard(@Req() req: ProxyIncomingRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.forward(this.ordersUrl, req, reply);
  }
}
