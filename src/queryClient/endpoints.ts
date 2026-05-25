import { invoke } from "@tauri-apps/api/core";
import type { Entity, EntityDto } from "../components/common/common.types";

export type RejectionItemDto = {
  reason: string;
  numberOfRejections: number;
};

export type DataEntryDto = {
  date: string;
  shift: string;
  inspectorName: string;
  part: string;
  numberOfParts: number;
  rejections: RejectionItemDto[];
  lotNumber: string;
};

export type FilterDataEntriesParams = {
  partName?: string;
  startDate?: string;
  endDate?: string;
  loadNumberStart?: string;
  loadNumberEnd?: string;
  inspectorName?: string;
  rejectionPercentageMin?: string;
  rejectionPercentageMax?: string;
  allParts?: string;
};

export type PreferenceDto = {
  name: string;
  value: string;
};

export type Preference = PreferenceDto & {
  id: string;
};

export type DataEntry = {
  id: string;
  date: string;
  shift: string;
  inspectorName: string;
  part: Entity;
  numberOfParts: number;
  rejections: Array<{
    id?: string;
    reason: Entity;
    numberOfRejections: number;
  }>;
  totalRejections: number;
  lotNumber: string;
  createdAt?: string;
  updatedAt?: string;
};

export const getPartsApi = () => invoke<Entity[]>("list_parts");
export const createPartApi = (input: EntityDto) => invoke<Entity>("create_part", { input });
export const editPartApi = (part: Entity) => invoke<Entity>("update_part", { id: part.id, input: { name: part.name } });
export const deletePartApi = (id: string) => invoke<string>("delete_part", { id });

export const getRejectionsApi = () => invoke<Entity[]>("list_rejections");
export const createRejectionApi = (input: EntityDto) => invoke<Entity>("create_rejection", { input });
export const editRejectionApi = (rejection: Entity) => invoke<Entity>("update_rejection", { id: rejection.id, input: { name: rejection.name } });
export const deleteRejectionApi = (id: string) => invoke<string>("delete_rejection", { id });

export const createDataEntryApi = (input: DataEntryDto) => invoke<DataEntry>("create_data_entry", { input });
export const getDataEntriesApi = () => invoke<DataEntry[]>("list_data_entries");
export const filterDataEntriesApi = (filter: FilterDataEntriesParams) => invoke<DataEntry[]>("filter_data_entries", { filter });
export const updateDataEntryApi = (id: string, input: DataEntryDto) => invoke<DataEntry>("update_data_entry", { id, input });
export const deleteDataEntryApi = (id: string) => invoke<string>("delete_data_entry", { id });

export const getPreferencesApi = () => invoke<Preference[]>("list_preferences");
export const getPreferenceApi = (name: string) => invoke<Preference>("get_preference", { name });
export const createPreferenceApi = (input: PreferenceDto) => invoke<Preference>("create_preference", { input });
export const updatePreferenceApi = (name: string, value: string) => invoke<Preference>("update_preference", { name, value });
export const deletePreferenceApi = (name: string) => invoke<string>("delete_preference", { name });
