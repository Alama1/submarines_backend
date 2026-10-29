import { IsIn } from 'class-validator';
import { CRAFT_CLAIM_STATUSES, CraftClaimStatus } from '@ff14/types';

export class UpdateClaimStatusDto {
  @IsIn(CRAFT_CLAIM_STATUSES)
  status: CraftClaimStatus;
}
