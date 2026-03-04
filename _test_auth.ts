import "dotenv/config";
import { BmvPortalSync } from "./bmvPortalSync";

async function run() {
  const bmv = new BmvPortalSync(
    process.env.BMV_USERNAME as string,
    process.env.BMV_PASSWORD as string,
  );
  await bmv.login();

  // Find and delete test activities (those without existing KM_IDs that we just created)
  const acts = await bmv.getActivities(new Date(2025, 0, 1));
  const testActs = acts.filter(a =>
    a.Bezeichnung === "Christbaumfeier" ||
    a.Bezeichnung === "Registerservice Hohes Blech" ||
    a.Bezeichnung === "Vollprobe" ||
    a.Bezeichnung === "TEST_DELETE_ME_V"
  );

  // Only delete the duplicates (ones without pre-existing KM_IDs from the 39 original)
  const originalKmIds = new Set([
    2618098, 2237520, 2200536, 2200388, 2200378, 2200527, 2309489, 2200486,
    2556865, 2556864, 2556863, 2556862, 2556861, 2200519, 2556860, 2556859,
    2556858, 2200522, 2603650, 2556857, 2556856, 2556855, 2200167, 2556854,
    2556853, 2200164, 2581877, 2556852, 2581872, 2556851, 2556849, 2556848,
    2581871, 2556847, 2556846, 2556845, 2585776, 2556844, 2200516,
  ]);

  for (const a of testActs) {
    const kmIdMatch = a.Anmerkung?.match(/KM_ID=(\d+)/);
    const kmId = kmIdMatch ? parseInt(kmIdMatch[1]) : null;
    if (kmId && !originalKmIds.has(kmId)) {
      console.log(`Deleting test activity: ${a.Bezeichnung} (KM_ID=${kmId})`);
      await bmv.deleteActivity(a.ID);
    }
  }

  const remaining = await bmv.getActivities(new Date(2025, 0, 1));
  console.log(`Remaining 2025 activities: ${remaining.length}`);
}
run().catch(console.error);
