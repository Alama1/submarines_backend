import { BaseMaterial } from './material.types';

export type PartType = 'hull' | 'stern' | 'bow' | 'bridge';

export interface PartMaterialInfo {
  id: number;
  quantity: number;
  material: BaseMaterial;
}

export interface ExpandedMaterialRequirement {
  materialId: string;
  name: string;
  quantity: number;
}

export interface SubmarinePart {
  id: string;
  name: string;
  itemId?: number | null;
  partType: PartType;
  className: string;
  classKey: string;
  isModified: boolean;
  price: number;
  stock: number;
  desiredStock: number;
  updatedAt: string;
  materials?: PartMaterialInfo[];
  /** Fully expanded raw material requirements (nested parts resolved) */
  expandedMaterials?: ExpandedMaterialRequirement[];
}

export interface CreateSubmarinePartDto {
  id: string;
  name: string;
  itemId?: number;
  partType: PartType;
  className: string;
  classKey: string;
  isModified?: boolean;
  price: number;
  stock?: number;
  desiredStock?: number;
  materials?: Array<{
    materialId: string;
    quantity: number;
  }>;
}

export interface UpdateSubmarinePartDto extends Partial<CreateSubmarinePartDto> {}

export interface SubmarinePartsApiResponse {
  parts: SubmarinePart[];
  total: number;
}
