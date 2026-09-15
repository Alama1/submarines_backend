import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { INTERNAL_TOKEN_HEADER, safeTokenCompare } from './token';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  private readonly expected = process.env.INTERNAL_TOKEN;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const url: string = (req.raw?.url ?? req.url ?? '').split('?')[0];
    if (req.method === 'GET' && (url === '/api/health' || url === '/health')) {
      return true;
    }
    if (!this.expected) {
      throw new ServiceUnavailableException('Server is missing INTERNAL_TOKEN configuration');
    }
    const provided = req.headers?.[INTERNAL_TOKEN_HEADER];
    if (typeof provided !== 'string' || !safeTokenCompare(provided, this.expected)) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
