import type { Metadata } from "next";
import { SearchRideForm } from "@/components/forum/search-ride-form";
import { Z } from "@/lib/forum/space-strings";

export const metadata: Metadata = { title: Z.searchPageTitle };

export default function SearchRidePage() {
  return (
    <div className="container pb-28 pt-9 sm:pt-10">
      <SearchRideForm />
    </div>
  );
}
