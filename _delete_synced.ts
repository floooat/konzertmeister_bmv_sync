import "dotenv/config";
import { BmvPortalSync } from "./bmvPortalSync";

async function run() {
  const bmv = new BmvPortalSync(
    process.env.BMV_USERNAME as string,
    process.env.BMV_PASSWORD as string,
  );
  const v = await bmv.login();
  if (!v.isVerify) { console.error("Login failed"); return; }
  console.log("Login OK, verein_id:", v.verein_id);

  const acts2025 = await bmv.getActivities(new Date(2025, 0, 1));
  const acts2026 = await bmv.getActivities(new Date(2026, 0, 1));
  const all = [...acts2025, ...acts2026];
  console.log(`Total activities: ${all.length}`);

  // Find all activities with KM_ID in Anmerkung (these were synced by us)
  const synced = all.filter(a => a.Anmerkung?.includes("KM_ID="));
  console.log(`Activities with KM_ID (to delete): ${synced.length}`);

  let deleted = 0;
  let failed = 0;
  for (const a of synced) {
    const kmIdMatch = a.Anmerkung?.match(/KM_ID=(\d+)/);
    const kmId = kmIdMatch ? kmIdMatch[1] : "?";
    process.stdout.write(`  Deleting: ${a.Bezeichnung} (KM_ID=${kmId})...`);
    const ok = await bmv.deleteActivity(a.ID);
    if (ok) {
      deleted++;
      console.log(" OK");
    } else {
      failed++;
      console.log(" FAILED");
    }
  }

  console.log(`\nDone: ${deleted} deleted, ${failed} failed`);

  // Verify
  const remaining2025 = await bmv.getActivities(new Date(2025, 0, 1));
  const remaining2026 = await bmv.getActivities(new Date(2026, 0, 1));
  console.log(`Remaining: ${remaining2025.length} (2025) + ${remaining2026.length} (2026) = ${remaining2025.length + remaining2026.length}`);
}
run().catch(console.error);
