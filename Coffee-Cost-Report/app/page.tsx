import { loadLatestUpload, loadStdMaster, loadUnitWeightMaster } from "@/lib/store";
import ReportView from "@/components/ReportView";

/**
 * Read fresh from disk on every request.
 *
 * Without this Next.js prerenders the page at build time (it sees no dynamic
 * API — an fs read is not one) and bakes in whatever data/*.json held during
 * the build, i.e. nothing. Uploading a new MB51 would then have no visible
 * effect until the next rebuild.
 *
 * It also stops the CDN in front of the app (CloudFront) from caching the
 * page: a prerendered route ships Cache-Control: s-maxage=31536000, which
 * would pin one snapshot of the report for a year.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const [batch, stdMaster, unitWeightMaster] = await Promise.all([
    loadLatestUpload(),
    loadStdMaster(),
    loadUnitWeightMaster(),
  ]);

  return <ReportView initialBatch={batch} initialStdMaster={stdMaster} initialUnitWeightMaster={unitWeightMaster} />;
}
