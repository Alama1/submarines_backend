import { All, Controller, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyIncomingRequest, ProxyOutgoingReply, ProxyService } from './proxy.service';

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

  // ── Recipes Service (/api/materials, /api/recipes) ────────────
  @All('materials')
  @All('materials/*')
  @All('recipes')
  @All('recipes/*')
  proxyRecipes(@Req() req: ProxyIncomingRequest, @Res() reply: ProxyOutgoingReply) {
    return this.proxy.forwardRequest(this.recipesUrl, req, reply);
  }

  // ── Prices Service (/api/prices) ──────────────────────────────
  @All('prices')
  @All('prices/*')
  proxyPrices(@Req() req: ProxyIncomingRequest, @Res() reply: ProxyOutgoingReply) {
    return this.proxy.forwardRequest(this.pricesUrl, req, reply);
  }

  // ── Inventory Service (/api/inventory) ────────────────────────
  @All('inventory')
  @All('inventory/*')
  proxyInventory(@Req() req: ProxyIncomingRequest, @Res() reply: ProxyOutgoingReply) {
    return this.proxy.forwardRequest(this.inventoryUrl, req, reply);
  }

  // ── Orders Service (/api/orders, /api/discounts) ──────────────
  @All('orders')
  @All('orders/*')
  @All('discounts')
  @All('discounts/*')
  proxyOrders(@Req() req: ProxyIncomingRequest, @Res() reply: ProxyOutgoingReply) {
    return this.proxy.forwardRequest(this.ordersUrl, req, reply);
  }
}
