import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
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
import { WhitelistService } from '../whitelist.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly firebaseService: FirebaseService,
    private readonly whitelistService: WhitelistService,
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

    const apiKey = headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      const trimmedKey = apiKey.trim();

      const masterKey = this.config.get<string>('ADMIN_API_KEY');
      if (!masterKey) {
        this.logger.error('ADMIN_API_KEY is not configured — refusing all API key authentication');
        throw new ServiceUnavailableException('Server is missing ADMIN_API_KEY configuration');
      }
      if (safeEqual(trimmedKey, masterKey)) {
        req.user = { type: 'api_key', label: 'Master Admin' };
        return true;
      }

      const keyHash = crypto.createHash('sha256').update(trimmedKey).digest('hex');
      const keyEntity = await this.apiKeyRepo.findOne({
        where: { keyHash, isActive: true },
      });

      if (keyEntity) {
        keyEntity.lastUsedAt = new Date();
        this.apiKeyRepo.save(keyEntity).catch(() => {});
        req.user = { type: 'api_key', label: keyEntity.label };
        return true;
      }

      throw new UnauthorizedException('Invalid or inactive API key');
    }

    const authHeader = headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const user = await this.firebaseService.verifyIdToken(token);

        // Whitelist = managed DB entries (admin panel) + legacy ALLOWED_EMAILS env var
        const envList = (this.config.get<string>('ALLOWED_EMAILS') ?? '')
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const dbList = await this.whitelistService.getCachedEmails();
        const allowedList = new Set<string>([...envList, ...dbList]);

        if (!allowedList.size) {
          this.logger.error('No whitelist configured (DB empty and ALLOWED_EMAILS unset) — denying Firebase authentication');
          throw new ForbiddenException('Firebase access is not configured on this server');
        }
        if (!user.email) {
          throw new ForbiddenException('Token has no email claim');
        }
        if (!user.emailVerified) {
          throw new ForbiddenException('Token email is not verified');
        }
        if (!allowedList.has(user.email.toLowerCase())) {
          this.logger.warn(`User ${user.email} is not whitelisted`);
          throw new ForbiddenException('User is not authorized to access this backend');
        }

        req.user = { type: 'firebase', uid: user.uid, email: user.email };
        return true;
      } catch (err: unknown) {
        if (err instanceof ForbiddenException) throw err;
        this.logger.warn(`Token verification failed: ${(err as Error).message}`);
        throw new UnauthorizedException('Invalid authentication token');
      }
    }

    const isPublicClientRoute =
      rawUrl === '/api/health' ||
      rawUrl === '/health' ||
      (method === 'POST' && (rawUrl === '/api/orders' || rawUrl === '/orders')) ||
      (method === 'GET' && (rawUrl.startsWith('/api/orders/lookup/') || rawUrl.startsWith('/orders/lookup/'))) ||
      (method === 'GET' && (rawUrl === '/api/orders/in-progress' || rawUrl === '/orders/in-progress')) ||
      (method === 'GET' && (rawUrl === '/api/inventory/missing' || rawUrl === '/inventory/missing')) ||
      (method === 'GET' && (rawUrl.startsWith('/api/docs') || rawUrl.startsWith('/docs'))) ||
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

function safeEqual(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
