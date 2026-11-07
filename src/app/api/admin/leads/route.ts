import { adminGuard } from "@/lib/admin-guard";
import { listLeads } from "@/lib/leads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  return Response.json({ leads: await listLeads() });
}
