
export const UNIVERSALIS_WORLD_KEY = 'universalis.world';

export interface UniversalisSettings {
  world: string;
  source: 'database' | 'default';
}

export interface UpdateWorldDto {
  world: string;
}
