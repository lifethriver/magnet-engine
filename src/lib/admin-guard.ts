import { adminAttemptsLeft, recordAdminFailure } from "./limits";
import { adminConfigured, clientIp, hashIdentity, isAdminRequest, MIN_PASSWORD_LENGTH } from "./secrets";

/** Returns a Response to send back when the caller isn't the owner, or null when they are. */
export async function adminGuard(request: Request): Promise<Response | null> {
  if (!adminConfigured()) {
    return Response.json(
      { error: `ADMIN_PASSWORD isn't set (or is shorter than ${MIN_PASSWORD_LENGTH} characters). Set it in Netlify > Site configuration > Environment variables, then redeploy.` },
      { status: 503 },
    );
  }
  const ipHash = await hashIdentity(clientIp(request));
  if (!(await adminAttemptsLeft(ipHash))) {
    return Response.json({ error: "Too many wrong passwords. Wait 15 minutes and try again." }, { status: 429 });
  }
  if (!isAdminRequest(request)) {
    await recordAdminFailure(ipHash);
    return Response.json({ error: "That password isn't right." }, { status: 401 });
  }
  return null;
}
