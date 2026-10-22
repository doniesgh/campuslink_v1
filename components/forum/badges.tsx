import type { ComponentType } from "react";
import { S } from "@/lib/forum/strings";
import type { PostStatus, PostType } from "@/lib/forum/types";
import { BoxIcon, BulbIcon, CarIcon, CheckCircleIcon, DotIcon, LockIcon, StarIcon } from "./icons";

type Icon = ComponentType<{ className?: string }>;

export const TYPE_ICONS: Record<PostType, Icon> = { covoiturage: CarIcon, objet_perdu: BoxIcon, experience: StarIcon, idee: BulbIcon };
export const STATUS_ICONS: Record<PostStatus, Icon> = { active: DotIcon, closed: LockIcon, resolved: CheckCircleIcon };

export function TypeBadge({ type }: { type: PostType }) {
  const Icon = TYPE_ICONS[type];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-accent-foreground">
      <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground [&>svg]:size-3">
        <Icon />
      </span>
      {S.type[type]}
    </span>
  );
}

const style: Record<PostStatus, string> = {
  active: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  resolved: "bg-primary/10 text-primary",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3.5 ${style[status]}`}>
      <Icon />
      {S.status[status]}
    </span>
  );
}
