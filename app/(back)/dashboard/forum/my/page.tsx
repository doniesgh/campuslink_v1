import type { Metadata } from "next";
import { MySpace } from "@/components/forum/my-space";
import { Z } from "@/lib/forum/space-strings";

export const metadata: Metadata = { title: Z.title };

export default function MySpacePage() {
  return (
    <div className="container pb-28 pt-9 sm:pt-10">
      <MySpace />
    </div>
  );
}
