/** Application settings stored in the app_settings table */

export const UNIVERSALIS_WORLD_KEY = 'universalis.world';

export interface UniversalisSettings {
  /** In-game world used for Universalis market sync */
  world: string;
  /** Whether the value comes from the database or the default/env config */
  source: 'database' | 'default';
}

export interface UpdateWorldDto {
  world: string;
}
