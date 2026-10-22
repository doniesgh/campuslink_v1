// Public API of the offline data layer (Client Components only). See README.md ("Data layer").
export { BffError, bffFetch, bffUrl, type BffMethod, type BffRequest } from "@/lib/bff-client";
export {
  invalidateQueries,
  serializeKey,
  useOfflineQuery,
  useQueryClient,
  type OfflineQueryOptions,
  type OfflineQueryResult,
  type QueryKey,
} from "@/lib/offline/query";
export {
  OUTBOX_REPLAYED_EVENT,
  listOutbox,
  notifyOutboxChanged,
  outboxId,
  queueMutation,
  refreshPendingCount,
  removeOutboxRecord,
  replayOutbox,
  retryOutboxRecord,
  subscribeOutbox,
  updateOutboxRecord,
  useOutbox,
  type MutationRequest,
  type MutationResult,
  type OutboxRecord,
  type OutboxRejection,
} from "@/lib/offline/outbox";
export { isOnline, useConnectivity, useOnlineStatus, usePendingCount } from "@/lib/offline/status";
