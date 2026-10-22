"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { useOnlineStatus } from "@/lib/offline/status";

export default function AppLink({ prefetch, ...props }: ComponentProps<typeof Link>) {
  const online = useOnlineStatus();
  return <Link {...props} prefetch={online ? prefetch : false} />;
}
