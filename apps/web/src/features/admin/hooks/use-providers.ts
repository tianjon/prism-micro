/**
 * Provider 管理 hooks。
 */

import { useState, useEffect, useCallback } from "react";
import type { Provider, ProviderCreate, ProviderTestResponse } from "@/api/types";
import { ApiError } from "@/api/client";
import {
  fetchProviders,
  createProvider as createProviderApi,
  deleteProvider as deleteProviderApi,
  testProvider as testProviderApi,
  updateProvider as updateProviderApi,
} from "../api/providers-api";
import type { ProviderUpdate } from "@/api/types";
import { useToast } from "@/hooks/use-toast";

type LoadState = "idle" | "loading" | "success" | "error";

interface UseProvidersReturn {
  providers: Provider[];
  loadState: LoadState;
  error: string | null;
  reload: () => void;
  createProvider: (data: ProviderCreate) => Promise<boolean>;
  updateProvider: (id: string, data: ProviderUpdate) => Promise<boolean>;
  removeProvider: (id: string) => Promise<boolean>;
  testProvider: (id: string) => Promise<ProviderTestResponse | null>;
}

export function useProviders(): UseProvidersReturn {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetchProviders();
      setProviders(response.data);
      setLoadState("success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载 Provider 列表失败";
      setError(message);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createProvider = useCallback(
    async (data: ProviderCreate): Promise<boolean> => {
      try {
        await createProviderApi(data);
        toast({ title: "Provider 创建成功", variant: "success" });
        void load();
        return true;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "创建 Provider 失败";
        toast({ title: message, variant: "error" });
        return false;
      }
    },
    [load, toast],
  );

  const doUpdateProvider = useCallback(
    async (id: string, data: ProviderUpdate): Promise<boolean> => {
      try {
        await updateProviderApi(id, data);
        toast({ title: "Provider 更新成功", variant: "success" });
        void load();
        return true;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "更新 Provider 失败";
        toast({ title: message, variant: "error" });
        return false;
      }
    },
    [load, toast],
  );

  const removeProvider = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteProviderApi(id);
        toast({ title: "Provider 已删除", variant: "success" });
        void load();
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast({
            title: "无法删除",
            description: "该 Provider 正被槽位使用",
            variant: "error",
          });
        } else {
          const message =
            err instanceof ApiError ? err.message : "删除 Provider 失败";
          toast({ title: message, variant: "error" });
        }
        return false;
      }
    },
    [load, toast],
  );

  const doTestProvider = useCallback(
    async (id: string): Promise<ProviderTestResponse | null> => {
      try {
        const response = await testProviderApi(id);
        return response.data;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "测试连通性失败";
        toast({ title: message, variant: "error" });
        return null;
      }
    },
    [toast],
  );

  return {
    providers,
    loadState,
    error,
    reload: load,
    createProvider,
    updateProvider: doUpdateProvider,
    removeProvider,
    testProvider: doTestProvider,
  };
}
