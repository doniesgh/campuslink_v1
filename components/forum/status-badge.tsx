import { R } from "@/lib/forum/reservation-strings";
import type { ReservationStatus } from "@/lib/forum/types";

const STYLE: Record<ReservationStatus, string> = {
  pending: "bg-accent text-accent-foreground",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export const StatusBadge = ({ status }: { status: ReservationStatus }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>{R.status[status]}</span>
);
