import type { NextRequest } from "next/server";
import { handleBff } from "@/lib/bff";

// BFF relay to the backend API: see lib/bff.ts. Never cached (private data), never prerendered.
export const dynamic = "force-dynamic";
// As long as the relay waits for the API (UPSTREAM_TIMEOUT_MS): a part of a users import takes ~15 s on a small server.
export const maxDuration = 60;

type Context = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, { params }: Context): Promise<Response> {
  const { path } = await params;
  return handleBff(request, path);
}

export { handler as GET, handler as HEAD, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
