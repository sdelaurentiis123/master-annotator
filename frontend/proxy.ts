import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Renamed from `middleware` to `proxy` per Next.js 16 file-convention update.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
