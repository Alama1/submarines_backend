import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BaseMaterial, SubmarinePart } from '@ff14/entities';
import { XivApiClient } from '../xivapi/xivapi.client';

/** Pause between XIVAPI requests to stay well within rate limits */
const REQUEST_DELAY_MS = 120;

export interface IdResolutionSummary {
  /** Entries that had no itemId and were processed */
  scanned: number;
  /** Entries that received an itemId */
  updated: number;
  /** Names for which XIVAPI returned no match */
  notFound: string[];
}

export interface MissingIdsReport {
  materials: IdResolutionSummary;
  parts: IdResolutionSummary;
}

@Injectable()
export class ItemIdsService {
  private readonly logger = new Logger(ItemIdsService.name);

  constructor(
    private readonly xivapi: XivApiClient,
    @InjectRepository(BaseMaterial)
    private readonly matRepo: Repository<BaseMaterial>,
    @InjectRepository(SubmarinePart)
    private readonly partRepo: Repository<SubmarinePart>,
  ) {}

  /**
   * Finds every material and submarine part without an itemId and resolves
   * it from XIVAPI (same behavior as the legacy "fetchAndSetIds" sheet macro:
   * only rows with a name and no ID are touched, existing IDs are never
   * overwritten).
   */
  async resolveMissingIds(): Promise<MissingIdsReport> {
    const materials = await this.resolveMaterials();
    const parts = await this.resolveParts();

    this.logger.log(
      `Item ID resolution complete — materials: ${materials.updated}/${materials.scanned} filled ` +
        `(${materials.notFound.length} not found), parts: ${parts.updated}/${parts.scanned} filled ` +
        `(${parts.notFound.length} not found)`,
    );

    return { materials, parts };
  }

  private async resolveMaterials(): Promise<IdResolutionSummary> {
    const pending = await this.matRepo.find({ where: { itemId: IsNull() } });
    const summary: IdResolutionSummary = {
      scanned: pending.length,
      updated: 0,
      notFound: [],
    };

    for (const mat of pending) {
      const itemId = await this.xivapi.searchItemId(mat.name);
      if (itemId != null) {
        await this.matRepo.update(mat.id, { itemId });
        summary.updated++;
        this.logger.debug(`Material "${mat.name}" -> itemId ${itemId}`);
      } else {
        summary.notFound.push(mat.name);
      }
      await this.delay(REQUEST_DELAY_MS);
    }

    return summary;
  }

  private async resolveParts(): Promise<IdResolutionSummary> {
    const pending = await this.partRepo.find({ where: { itemId: IsNull() } });
    const summary: IdResolutionSummary = {
      scanned: pending.length,
      updated: 0,
      notFound: [],
    };

    for (const part of pending) {
      const itemId = await this.xivapi.searchItemId(part.name);
      if (itemId != null) {
        await this.partRepo.update(part.id, { itemId });
        summary.updated++;
        this.logger.debug(`Part "${part.name}" -> itemId ${itemId}`);
      } else {
        summary.notFound.push(part.name);
      }
      await this.delay(REQUEST_DELAY_MS);
    }

    return summary;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
