
export const UNIVERSALIS_WORLD_KEY = 'universalis.world';

export interface UniversalisSettings {
  world: string;
  source: 'database' | 'default';
}

export interface UpdateWorldDto {
  world: string;
}

export interface WhitelistEntry {
  id: string;
  email: string;
  label: string | null;
  /** 'db' = managed via API (removable), 'env' = from ALLOWED_EMAILS (read-only) */
  source: 'db' | 'env';
  createdAt: string;
}

export interface WhitelistResponse {
  items: WhitelistEntry[];
  total: number;
  envCount: number;
}

export interface AddWhitelistEntryDto {
  email: string;
  label?: string;
}
