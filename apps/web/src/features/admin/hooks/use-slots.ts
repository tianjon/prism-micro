/**
 * 槽位配置 hooks。
 */

import { useState, useEffect, useCallback } from "react";
import type { SlotConfig, SlotConfigureRequest } from "@/api/types";
import { ApiError } from "@/api/client";
import { fetchSlots, configureSlot as configureSlotApi } from "../api/slots-api";
import { useToast } from "@/hooks/use-toast";

type LoadState = "idle" | "loading" | "success" | "error";

interface UseSlotsReturn {
  slots: SlotConfig[];
  loadState: LoadState;
  error: string | null;
  reload: () => void;
  configureSlot: (slotType: string, data: SlotConfigureRequest) => Promise<boolean>;
}

export function useSlots(): UseSlotsReturn {
  const [slots, setSlots] = useState<SlotConfig[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetchSlots();
      setSlots(response.data);
      setLoadState("success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "加载槽位配置失败";
      setError(message);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const configureSlot = useCallback(
    async (slotType: string, data: SlotConfigureRequest): Promise<boolean> => {
      try {
        await configureSlotApi(slotType, data);
        toast({
          title: "配置已保存",
          description: "下次调用即生效",
          variant: "success",
        });
        void load();
        return true;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "保存配置失败";
        toast({ title: message, variant: "error" });
        return false;
      }
    },
    [load, toast],
  );

  return {
    slots,
    loadState,
    error,
    reload: load,
    configureSlot,
  };
}
