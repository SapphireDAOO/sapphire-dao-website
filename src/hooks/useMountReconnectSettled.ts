import { useSyncExternalStore } from "react";
import {
  isMountReconnectSettled,
  subscribeMountReconnect,
} from "@/lib/mountReconnect";

/** False until the page has tried to restore the last wallet. */
export const useMountReconnectSettled = () =>
  useSyncExternalStore(
    subscribeMountReconnect,
    isMountReconnectSettled,
    () => false,
  );
