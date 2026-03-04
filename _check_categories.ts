import "dotenv/config";
import { BmvPortalSync } from "./bmvPortalSync";

async function check() {
  const bmv = new BmvPortalSync(
    process.env.BMV_USERNAME as string,
    process.env.BMV_PASSWORD as string,
  );
  const v = await bmv.login();
  if (!v.isVerify) { console.error("Login failed"); return; }

  const acts2025 = await bmv.getActivities(new Date(2025, 0, 1));
  const acts2026 = await bmv.getActivities(new Date(2026, 0, 1));
  const all = [...acts2025, ...acts2026];

  for (const a of all) {
    const type = a.Ausrueckungsart === "V" ? "EVENT" : "PROBE";
    console.log(`${type.padEnd(6)} | ${(a.P_V_Art || "").padEnd(42)} | ${a.Bezeichnung}`);
  }
  console.log(`\nTotal: ${all.length}`);
}
check().catch(console.error);
