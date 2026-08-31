import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from '@ff14/entities';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { FirebaseService } from '../firebase.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly firebaseService: FirebaseService,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const headers = req.headers || {};
    const rawUrl = (req.raw?.url || req.url || '').split('?')[0];
    const method = req.method;

    // 1. Check for X-API-Key header (used by admin panel & browser extension / plugin)
    const apiKey = headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      const trimmedKey = apiKey.trim();

      // Check against configured master Admin Key (or default dev key)
      const masterKey = this.config.get<string>('ADMIN_API_KEY', 'ff14-submarines-dev-key');
      if (masterKey && trimmedKey === masterKey) {
        req.user = { type: 'api_key', label: 'Master Admin' };
        return true;
      }

      const keyHash = crypto.createHash('sha256').update(trimmedKey).digest('hex');
      const keyEntity = await this.apiKeyRepo.findOne({
        where: { keyHash, isActive: true },
      });

      if (keyEntity) {
        // Update last used timestamp asynchronously
        keyEntity.lastUsedAt = new Date();
        this.apiKeyRepo.save(keyEntity).catch(() => {});
        req.user = { type: 'api_key', label: keyEntity.label };
        return true;
      }

      throw new UnauthorizedException('Invalid or inactive API key');
    }

    // 2. Check for Authorization: Bearer <FirebaseIdToken>
    const authHeader = headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const user = await this.firebaseService.verifyIdToken(token);

        // Check allowed emails if configured
        const allowedEmailsConfig = this.config.get<string>('ALLOWED_EMAILS');
        if (allowedEmailsConfig) {
          const allowedList = allowedEmailsConfig
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);

          if (user.email && !allowedList.includes(user.email.toLowerCase())) {
            this.logger.warn(`User ${user.email} not in ALLOWED_EMAILS list`);
            throw new ForbiddenException('User is not authorized to access this backend');
          }
        }

        req.user = { type: 'firebase', uid: user.uid, email: user.email };
        return true;
      } catch (err: unknown) {
        if (err instanceof ForbiddenException) throw err;
        this.logger.warn(`Token verification failed: ${(err as Error).message}`);
        throw new UnauthorizedException('Invalid authentication token');
      }
    }

    // 3. Public Customer Routes (Allow public order submission & lookup, catalogue viewing)
    const isPublicClientRoute =
      rawUrl === '/api/health' ||
      rawUrl === '/health' ||
      // Public customer creating an order request
      (method === 'POST' && (rawUrl === '/api/orders' || rawUrl === '/orders')) ||
      // Public customer looking up their order by confirmation code
      (method === 'GET' && (rawUrl.startsWith('/api/orders/lookup/') || rawUrl.startsWith('/orders/lookup/'))) ||
      // Public in-progress orders feed (for real-time progress page on customer site)
      (method === 'GET' && (rawUrl === '/api/orders/in-progress' || rawUrl === '/orders/in-progress')) ||
      // Public missing-materials feed with claims (for the "what we need" page on customer site)
      (method === 'GET' && (rawUrl === '/api/inventory/missing' || rawUrl === '/inventory/missing')) ||
      // Public browsing of parts, materials, prices, discounts
      (method === 'GET' &&
        (rawUrl.startsWith('/api/recipes') ||
          rawUrl.startsWith('/recipes') ||
          rawUrl.startsWith('/api/materials') ||
          rawUrl.startsWith('/materials') ||
          rawUrl.startsWith('/api/prices') ||
          rawUrl.startsWith('/prices') ||
          rawUrl.startsWith('/api/discounts') ||
          rawUrl.startsWith('/discounts')));

    if (isPublicClientRoute) {
      return true;
    }

    throw new UnauthorizedException('Authentication credentials required for admin actions (Bearer token or X-API-Key)');
  }
}
