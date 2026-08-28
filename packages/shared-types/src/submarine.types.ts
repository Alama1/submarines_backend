import { BaseMaterial } from './material.types';

export type PartType = 'hull' | 'stern' | 'bow' | 'bridge';

export interface PartMaterialInfo {
  id: number;
  quantity: number;
  material: BaseMaterial;
}

export interface SubmarinePart {
  id: string;
  name: string;
  partType: PartType;
  className: string;
  classKey: string;
  isModified: boolean;
  price: number;
  stock: number;
  updatedAt: string;
  materials?: PartMaterialInfo[];
}

export interface CreateSubmarinePartDto {
  id: string;
  name: string;
  partType: PartType;
  className: string;
  classKey: string;
  isModified?: boolean;
  price: number;
  stock?: number;
  materials?: Array<{
    materialId: string;
    quantity: number;
  }>;
}

export interface SubmarinePartsApiResponse {
  parts: SubmarinePart[];
  total: number;
}

