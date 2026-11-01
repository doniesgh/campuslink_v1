import type { ComponentType } from "react";
import { S } from "@/lib/forum/strings";
import type { PostStatus, PostType } from "@/lib/forum/types";
import { BoxIcon, BulbIcon, CarIcon, CheckCircleIcon, DotIcon, LockIcon, StarIcon } from "./icons";

type Icon = ComponentType<{ className?: string }>;

export const TYPE_ICONS: Record<PostType, Icon> = { covoiturage: CarIcon, objet_perdu: BoxIcon, experience: StarIcon, idee: BulbIcon };
export const STATUS_ICONS: Record<PostStatus, Icon> = { active: DotIcon, closed: LockIcon, resolved: CheckCircleIcon };

/** Couleurs par catégorie (maquette) : covoiturage bleu, objets perdus ambre, expérience émeraude, idée violet. */
export const TYPE_STYLE: Record<PostType, { chip: string }> = {
  covoiturage: { chip: "border-blue-200 bg-blue-50 text-blue-600" },
  objet_perdu: { chip: "border-amber-200 bg-amber-50 text-amber-600" },
  experience: { chip: "border-emerald-200 bg-emerald-50 text-emerald-600" },
  idee: { chip: "border-violet-200 bg-violet-50 text-violet-600" },
};

export function TypeBadge({ type }: { type: PostType }) {
  const Icon = TYPE_ICONS[type];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold [&>svg]:size-3.5 ${TYPE_STYLE[type].chip}`}>
      <Icon />
      {S.type[type]}
    </span>
  );
}

const style: Record<PostStatus, string> = {
  active: "bg-emerald-50 text-emerald-600",
  closed: "bg-slate-100 text-slate-500",
  resolved: "bg-blue-50 text-blue-600",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold [&>svg]:size-3.5 ${style[status]}`}>
      <Icon />
      {S.status[status]}
    </span>
  );
}
