/**
 * Netlify background function: builds one report with up to 15 minutes to
 * work. The "-background" filename makes Netlify answer the caller with 202
 * right away. Only accepts jobs signed by this site (see src/lib/secrets.ts).
 * Never throws: a thrown error would make Netlify retry and spend credits again.
 */
import { runReport } from "../../src/lib/reports";
import { verifyJobSignature } from "../../src/lib/secrets";

const buildReport = async (request: Request): Promise<void> => {
  if (request.method !== "POST") return;
  let id = "";
  let sig = "";
  try {
    const body = (await request.json()) as { id?: unknown; sig?: unknown };
    id = typeof body.id === "string" ? body.id : "";
    sig = typeof body.sig === "string" ? body.sig : "";
  } catch {
    return;
  }
  if (!/^[a-z0-9]{12,24}$/.test(id) || !(await verifyJobSignature(id, sig))) return;
  try {
    await runReport(id);
  } catch {
    console.error(`background job ${id} crashed`);
  }
};

export default buildReport;
