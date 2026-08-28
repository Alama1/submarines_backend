import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

export interface ProxyIncomingRequest {
  url?: string;
  raw?: { url?: string };
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  user?: { uid?: string; email?: string; type?: string; label?: string };
}

export interface ProxiedResponse {
  status: number;
  contentType: string;
  body: unknown;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  async forwardRequest(
    targetBaseUrl: string,
    req: ProxyIncomingRequest,
  ): Promise<ProxiedResponse> {
    const rawUrl = req.raw?.url || req.url || '';
    const targetUrl = `${targetBaseUrl.replace(/\/$/, '')}${rawUrl}`;
    const method = req.method;

    const headers: Record<string, string> = {};
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    }
    if (req.headers['accept']) {
      headers['accept'] = req.headers['accept'] as string;
    }

    const user = req.user;
    if (user?.uid) {
      headers['x-user-id'] = user.uid;
    }
    if (user?.email) {
      headers['x-user-email'] = user.email;
    }
    if (user?.type === 'api_key' && user.label) {
      headers['x-api-key-label'] = user.label;
    }

    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD' && req.body !== undefined) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    try {
      this.logger.debug(`Proxying ${method} ${rawUrl} -> ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method,
        headers,
        body,
      });

      const contentType = response.headers.get('content-type') || 'application/json';
      const text = await response.text();
      let payload: unknown = text;

      if (contentType.includes('application/json')) {
        if (!text) {
          payload = null;
        } else {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = text;
          }
        }
      }

      return {
        status: response.status,
        contentType,
        body: payload,
      };
    } catch (err: unknown) {
      this.logger.error(`Failed to forward request to ${targetUrl}: ${(err as Error).message}`);
      throw new BadGatewayException(
        `Failed to connect to downstream service at ${targetBaseUrl}`,
      );
    }
  }
}
