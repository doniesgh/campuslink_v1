import type { Metadata } from "next";
import { NearbyRides } from "@/components/forum/nearby-rides";
import { N } from "@/lib/forum/nearby-strings";

export const metadata: Metadata = { title: N.nearbyTitle };

export default function NearbyPage() {
  return (
    <div className="container pb-28 pt-9 sm:pt-10">
      <NearbyRides />
    </div>
  );
}
