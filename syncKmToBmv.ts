import {
  Konzertmeister,
  GetAppointmentsPayload,
  Appointment,
} from "./konzertmeister";
import { NewProben, Proben } from "./bmvSync";
import { BmvPortalSync } from "./bmvPortalSync";
import dayjs from "dayjs";
import {
  identifyP_V_ArtFromOpenAI,
  PROBE_CATEGORIES,
  EVENT_CATEGORIES,
} from "./openaiHelper";
import "dotenv/config";

const DEBUG_MODE = process.env.DEBUG_MODE === "true";
const DEBUG_LIMIT = Number(process.env.DEBUG_LIMIT ?? "2");

function resolveSyncWindow(now: dayjs.Dayjs) {
  const defaultStart = now.subtract(1, "year").startOf("year");
  const defaultEnd = now.add(1, "year").endOf("year");

  const start = process.env.KM_SYNC_START_DATE
    ? dayjs(process.env.KM_SYNC_START_DATE)
    : defaultStart;
  const end = process.env.KM_SYNC_END_DATE
    ? dayjs(process.env.KM_SYNC_END_DATE)
    : defaultEnd;

  if (!start.isValid()) {
    throw new Error(`Invalid KM_SYNC_START_DATE: ${process.env.KM_SYNC_START_DATE}`);
  }
  if (!end.isValid()) {
    throw new Error(`Invalid KM_SYNC_END_DATE: ${process.env.KM_SYNC_END_DATE}`);
  }
  if (end.isBefore(start)) {
    throw new Error(
      `Invalid sync window: end (${end.toISOString()}) is before start (${start.toISOString()})`
    );
  }

  return { start, end };
}

async function fetchKmAppointmentsForWindow(
  km: Konzertmeister,
  windowStart: dayjs.Dayjs,
  windowEnd: dayjs.Dayjs
): Promise<Appointment[]> {
  // KM /api/v3/app/getpaged/* rejects PAST/ALL for some accounts; FROM_DATE is known-good.
  // We fetch from the start date and locally filter to the requested windowEnd.
  const fromDatePayload: GetAppointmentsPayload = {
    dateMode: "FROM_DATE",
    filterStart: windowStart.toISOString(),
    filterEnd: null,
    parentOrgIds: null,
    groupOrgIds: null,
    settings: [],
  };

  try {
    return await km.getAllAppointments(fromDatePayload);
  } catch (error: any) {
    console.warn(
      `KM dateMode=FROM_DATE failed, falling back to UPCOMING: ${
        error?.response?.data?.detail || error?.message || "unknown error"
      }`
    );
    return km.getAllAppointments({
      dateMode: "UPCOMING",
      filterStart: null,
      filterEnd: null,
      parentOrgIds: null,
      groupOrgIds: null,
      settings: [],
    });
  }
}

/**
 * Parse "KM_ID=xxx" from BMV's Anmerkung (if present).
 */
function parseKonzertmeisterId(
  anmerkung: string | null | undefined
): number | null {
  if (!anmerkung) return null;
  // Looks for something like "KM_ID=12345" anywhere in the text
  const match = anmerkung.match(/KM_ID\s*=\s*(\d+)/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * If we see "register" or "registerprobe" in the name, extract the remainder for ensemble.
 */
function getEnsembleFromRegister(name: string): string {
  let result = name.replace(/registerprobe\s*/i, "");
  result = result.replace(/register\s*/i, "");
  return result.trim() || "alle aktiven Musiker/innen";
}

/**
 * Split ISO string into separate date/time for BMV.
 */
function splitDateTime(isoString?: string): { date?: Date; time?: string } {
  if (!isoString) return {};
  const d = dayjs(isoString);
  if (!d.isValid()) return {};

  return {
    date: d.toDate(), // Convert to Date object, not ISO string
    time: d.format("HH:mm"), // extract just HH:mm
  };
}

/**
 * Converts a KM appointment to BMV "Proben" format, storing KM_ID in Anmerkung.
 */
async function convertKmToBmvFormat(
  appointment: Appointment,
  oldAppointments: Proben[],
  vereinId: number
): Promise<NewProben> {
  const isAuftritt = appointment.typId === 2;
  const isProbe = appointment.typId === 1;

  let ausrueckungsart = "P"; // default: Probe
  let akmPfl = false;

  if (isAuftritt) {
    ausrueckungsart = "V"; // Veranstaltung/Auftritt
    akmPfl = true; // Auftritt => AKM_PFL = true
  }

  // Prepare an Ensemble_Gruppe fallback
  let ensemble = "alle aktiven Musiker/innen";

  // If there's a group name from KM
  if (appointment.group?.name) {
    ensemble = appointment.group.name;
  }
  // 3) Else if it's a probe & has "register"
  else if (isProbe && appointment.name.toLowerCase().includes("register")) {
    ensemble = getEnsembleFromRegister(appointment.name);
  }

  // Extract start/end date/time
  const { date: startDate, time: startTime } = splitDateTime(appointment.start);
  const { time: endTime } = splitDateTime(appointment.end);

  // Build anmerkung, embedding KM_ID
  const kmIdTag = `KM_ID=${appointment.id}`;
  const baseDescription = appointment.description?.trim() || "";
  const anmerkungParts = [baseDescription, kmIdTag].filter(Boolean);

  // Combine text for OpenAI classification
  const groupName = appointment.group?.name
    ? ` (group: ${appointment.group.name})`
    : "";
  const combinedText = `${appointment.name} - ${groupName}`;

  // Get P_V_Art from OpenAI
  const categories = isProbe ? PROBE_CATEGORIES : EVENT_CATEGORIES;
  const pVArt = await identifyP_V_ArtFromOpenAI(
    combinedText,
    categories,
    oldAppointments,
    isProbe
  );

  // Create the activity object, filtering out undefined values
  const activity: any = {
    // Use proper Date object instead of ISO string
    V_DATUM: startDate,
    V_ZEIT_V: startTime,
    V_ZEIT_B: endTime,

    Ensemble_Gruppe: ensemble,
    Ausrueckungsart: ausrueckungsart,
    P_V_Art: pVArt,
    Bezeichnung: appointment.name,
    AKM_PFL: akmPfl,
    AKM_Meldung: false,
    AKM_Meldedatum: null,
    Kopfquote: false,
    verein_id: vereinId,

    // Use Probengruppe ID only if we have a valid one, otherwise let BMV assign
    Probengruppen_ID: "620C0A8B-FBAF-4E3F-B622-40501D54732C",
  };

  // Only add optional fields if they have values
  if (anmerkungParts.length > 0) {
    activity.Anmerkung = anmerkungParts.join("\n");
  }

  if (appointment.location?.formattedAddress) {
    activity.V_ORT = appointment.location.formattedAddress;
  }

  return activity;
}

/**
 * Main function to sync from KM → BMV, avoiding duplicates by checking KM_ID in BMV's Anmerkung.
 */
export async function syncKmToBmvAvoidDuplicates() {
  try {
    // Initialize BMV via portal login
    const bmvSync = new BmvPortalSync(
      process.env.BMV_USERNAME!,
      process.env.BMV_PASSWORD!,
    );
    const verification = await bmvSync.login();
    if (!verification || !verification.isVerify) {
      console.error(
        "Failed BMV login check",
        verification ? verification : "(no verification details)"
      );
      return;
    }
    const vereinId = verification.verein_id;
    console.log(`BMV auth OK — verein_id: ${vereinId}`);

    const now = dayjs();
    const { start: syncStart, end: syncEnd } = resolveSyncWindow(now);
    console.log(
      `Sync window: ${syncStart.toISOString()} -> ${syncEnd.toISOString()}`
    );

    // Fetch existing BMV appointments across the full sync window.
    const bmvActivities = await bmvSync.getActivitiesForWindow(
      syncStart.toDate(),
      syncEnd.toDate()
    );
    if (!bmvActivities) {
      console.error("Could not fetch existing BMV activities");
      return;
    }

    // 3) Build set of known KM IDs from BMV
    const knownKmIds = new Set<number>();
    for (const act of bmvActivities) {
      const kmId = parseKonzertmeisterId(act.Anmerkung);
      if (kmId) {
        knownKmIds.add(kmId);
      }
    }

    console.log("Existing KM IDs in BMV:", Array.from(knownKmIds));

    // 4) Initialize & login Konzertmeister
    const km = new Konzertmeister();
    const kmLoggedIn = await km.login({
      mail: process.env.KM_USERNAME!,
      password: process.env.KM_PASSWORD!,
      locale: "de_US",
      timezoneId: "Europe/Vienna",
    });
    if (!kmLoggedIn) {
      console.error("Failed to login to Konzertmeister");
      return;
    }

    // Fetch appointments from KM for a bounded window (past + future coverage).
    const rawKmAppointments = await fetchKmAppointmentsForWindow(
      km,
      syncStart,
      syncEnd
    );
    const kmAppointments = rawKmAppointments
      .filter((appointment) => {
        if (!appointment.start) {
          return true;
        }
        const startDate = dayjs(appointment.start);
        if (!startDate.isValid()) {
          return true;
        }
        return (
          !startDate.isBefore(syncStart) && !startDate.isAfter(syncEnd)
        );
      })
      .sort((a, b) => {
        const aTs = dayjs(a.start).valueOf();
        const bTs = dayjs(b.start).valueOf();
        return aTs - bTs;
      });

    console.log(
      `Fetched ${kmAppointments.length} appointments from KM within sync window.`
    );

    // 6) Filter out duplicates (KM ID already in BMV)
    const newAppointments = kmAppointments.filter((apt) => {
      return !knownKmIds.has(apt.id);
    });

    let appointmentsToProcess = newAppointments;
    if (DEBUG_MODE && DEBUG_LIMIT > 0) {
      console.log("DEBUG MODE: Limiting to", DEBUG_LIMIT, "appointments");
      appointmentsToProcess = newAppointments.slice(0, DEBUG_LIMIT);
    }

    console.log(
      `${appointmentsToProcess.length} new appointments (not in BMV) out of ${kmAppointments.length} total.`
    );

    // Convert appointments in parallel using Promise.all, passing oldAppointments
    const bmvProben = await Promise.all(
      appointmentsToProcess.map((apt) =>
        convertKmToBmvFormat(apt, bmvActivities, vereinId!)
      )
    );

    if (bmvProben.length === 0) {
      console.log("No new appointments to sync.");
      return;
    }

    // 8) Post to BMV
    const success = await bmvSync.postActivities(bmvProben);
    if (success) {
      console.log(
        `Successfully synced ${bmvProben.length} appointments to BMV.`
      );

      // Verify that newly posted KM IDs are now visible from BMV readback.
      const postedKmIds = new Set(appointmentsToProcess.map((apt) => apt.id));
      const refreshedActivities = await bmvSync.getActivitiesForWindow(
        syncStart.toDate(),
        syncEnd.toDate()
      );
      const verifiedCount = refreshedActivities.reduce((count: number, activity: Proben) => {
        const kmId = parseKonzertmeisterId(activity.Anmerkung);
        if (kmId && postedKmIds.has(kmId)) {
          return count + 1;
        }
        return count;
      }, 0);
      console.log(
        `Post verification: ${verifiedCount}/${postedKmIds.size} KM_IDs are visible in BMV readback.`
      );
      if (verifiedCount < postedKmIds.size) {
        console.warn(
          `BMV post verification: ${verifiedCount}/${postedKmIds.size} KM_IDs visible (${postedKmIds.size - verifiedCount} may still be propagating).`
        );
      }
    } else {
      console.error("Failed to sync appointments to BMV.");
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
}

if (require.main === module) {
  syncKmToBmvAvoidDuplicates();
}
