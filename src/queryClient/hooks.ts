import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import type { Entity } from "../components/common/common.types";
import * as Api from "./endpoints";

export const QUERY_KEYS = {
  PARTS: ["parts"],
  REJECTIONS: ["rejections"],
  DATA_ENTRIES: ["dataEntries"],
  PREFERENCES: ["preferences"],
};

const hasAnyFilter = (params: Api.FilterDataEntriesParams) =>
  Object.values(params).some((value) => value !== undefined && value !== "");

export const useParts = () =>
  useQuery<Entity[]>({
    queryKey: QUERY_KEYS.PARTS,
    queryFn: Api.getPartsApi,
  });

export const useCreatePart = () =>
  useMutation({
    mutationFn: Api.createPartApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTS }),
  });

export const useEditPart = () =>
  useMutation({
    mutationFn: Api.editPartApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTS }),
  });

export const useDeletePart = () =>
  useMutation({
    mutationFn: Api.deletePartApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTS }),
  });

export const useRejections = () =>
  useQuery<Entity[]>({
    queryKey: QUERY_KEYS.REJECTIONS,
    queryFn: Api.getRejectionsApi,
  });

export const useCreateRejection = () =>
  useMutation({
    mutationFn: Api.createRejectionApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REJECTIONS }),
  });

export const useEditRejection = () =>
  useMutation({
    mutationFn: Api.editRejectionApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REJECTIONS }),
  });

export const useDeleteRejection = () =>
  useMutation({
    mutationFn: Api.deleteRejectionApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REJECTIONS }),
  });

export const useCreateDataEntry = () =>
  useMutation({
    mutationFn: Api.createDataEntryApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DATA_ENTRIES }),
  });

export const useUpdateDataEntry = () =>
  useMutation({
    mutationFn: ({ id, dataEntry }: { id: string; dataEntry: Api.DataEntryDto }) =>
      Api.updateDataEntryApi(id, dataEntry),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DATA_ENTRIES }),
  });

export const useDeleteDataEntry = () =>
  useMutation({
    mutationFn: Api.deleteDataEntryApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DATA_ENTRIES }),
  });

export const useDataEntries = () =>
  useQuery<Api.DataEntry[]>({
    queryKey: QUERY_KEYS.DATA_ENTRIES,
    queryFn: Api.getDataEntriesApi,
  });

export const useFilterDataEntries = (params: Api.FilterDataEntriesParams) =>
  useQuery<Api.DataEntry[]>({
    queryKey: [...QUERY_KEYS.DATA_ENTRIES, params],
    queryFn: () => Api.filterDataEntriesApi(params),
    enabled: hasAnyFilter(params),
  });

export const usePreferences = () =>
  useQuery<Api.Preference[]>({
    queryKey: QUERY_KEYS.PREFERENCES,
    queryFn: Api.getPreferencesApi,
  });

export const useCreatePreference = () =>
  useMutation({
    mutationFn: Api.createPreferenceApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PREFERENCES }),
  });

export const useUpdatePreference = () =>
  useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) => Api.updatePreferenceApi(name, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PREFERENCES }),
  });

export const useDeletePreference = () =>
  useMutation({
    mutationFn: Api.deletePreferenceApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PREFERENCES }),
  });
