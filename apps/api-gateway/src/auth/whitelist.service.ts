import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowedEmail } from '@ff14/entities';
import { AddWhitelistEntryDto, WhitelistEntry, WhitelistResponse } from '@ff14/types';

@Injectable()
export class WhitelistService {
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly logger = new Logger(WhitelistService.name);
  private cache: { emails: Set<string>; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(AllowedEmail)
    private readonly repo: Repository<AllowedEmail>,
    private readonly config: ConfigService,
  ) {}

  /** Emails from the ALLOWED_EMAILS env var (legacy/static source). */
  private envEmails(): string[] {
    return (this.config.get<string>('ALLOWED_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  /**
   * All currently whitelisted emails (DB + env), cached briefly so the
   * auth guard does not hit the database on every request.
   */
  async getCachedEmails(): Promise<Set<string>> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.emails;
    }
    const rows = await this.repo.find({ select: { email: true } });
    const emails = new Set<string>([
      ...this.envEmails(),
      ...rows.map((r) => r.email.toLowerCase()),
    ]);
    this.cache = {
      emails,
      expiresAt: Date.now() + WhitelistService.CACHE_TTL_MS,
    };
    return emails;
  }

  invalidate(): void {
    this.cache = null;
  }

  async list(): Promise<WhitelistResponse> {
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } });
    const env = this.envEmails();
    const dbEmails = new Set(rows.map((r) => r.email.toLowerCase()));
    const envOnly = env.filter((e) => !dbEmails.has(e));

    const items: WhitelistEntry[] = [
      ...rows.map((r) => ({
        id: r.id,
        email: r.email,
        label: r.label,
        source: 'db' as const,
        createdAt: r.createdAt.toISOString(),
      })),
      ...envOnly.map((e) => ({
        id: `env:${e}`,
        email: e,
        label: null,
        source: 'env' as const,
        createdAt: '',
      })),
    ];

    return { items, total: items.length, envCount: envOnly.length };
  }

  async add(dto: AddWhitelistEntryDto): Promise<WhitelistEntry> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.repo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`"${email}" is already whitelisted`);
    }

    const row = await this.repo.save(
      this.repo.create({ email, label: dto.label?.trim() || null }),
    );
    this.invalidate();
    this.logger.log(`Whitelisted email "${email}"`);
    return {
      id: row.id,
      email: row.email,
      label: row.label,
      source: 'db',
      createdAt: row.createdAt.toISOString(),
    };
  }

  async remove(id: string): Promise<void> {
    if (id.startsWith('env:')) {
      throw new BadRequestException(
        'Entries from the ALLOWED_EMAILS configuration can only be removed by changing the environment',
      );
    }
    const res = await this.repo.delete(id);
    if (!res.affected) {
      throw new NotFoundException(`Whitelist entry "${id}" not found`);
    }
    this.invalidate();
    this.logger.log(`Removed whitelist entry "${id}"`);
  }
}
