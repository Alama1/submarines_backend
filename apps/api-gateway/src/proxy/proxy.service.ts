import { Injectable, Logger } from '@nestjs/common';

export interface ProxyIncomingRequest {
  url?: string;
  raw?: { url?: string };
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  user?: { uid?: string; email?: string; type?: string; label?: string };
}

export interface ProxyOutgoingReply {
  status(code: number): this;
  header(key: string, value: string): this;
  send(payload: unknown): this;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  async forwardRequest(
    targetBaseUrl: string,
    req: ProxyIncomingRequest,
    reply: ProxyOutgoingReply,
  ): Promise<void> {
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

    // Attach verified user identity headers for downstream services
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

      const responseContentType = response.headers.get('content-type') || 'application/json';
      reply.status(response.status);
      reply.header('content-type', responseContentType);

      if (responseContentType.includes('application/json')) {
        const json = await response.json();
        reply.send(json);
      } else {
        const text = await response.text();
        reply.send(text);
      }
    } catch (err: unknown) {
      this.logger.error(`Failed to forward request to ${targetUrl}: ${(err as Error).message}`);
      reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: `Failed to connect to downstream service at ${targetBaseUrl}`,
      });
    }
  }
}
