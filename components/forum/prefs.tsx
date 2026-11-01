import type { ComponentType } from "react";
import { LuggageIcon, MusicIcon, NoSmokeIcon, SnowflakeIcon, UsersIcon } from "./icons";

export type PrefId = "no_smoking" | "light_luggage" | "music" | "ac" | "students_only";

/** Conditions à bord proposées au conducteur (enregistrées dans covoiturage.preferences). */
export const PREFS: { id: PrefId; icon: ComponentType<{ className?: string }> }[] = [
  { id: "no_smoking", icon: NoSmokeIcon },
  { id: "light_luggage", icon: LuggageIcon },
  { id: "music", icon: MusicIcon },
  { id: "ac", icon: SnowflakeIcon },
  { id: "students_only", icon: UsersIcon },
];
