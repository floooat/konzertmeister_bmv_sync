import {
  Konzertmeister,
  GetAppointmentsPayload,
  Appointment,
} from "./konzertmeister";
import { BmvSync, NewProben } from "./bmvSync";
import dayjs from "dayjs";
import {
  identifyP_V_ArtFromOpenAI,
  PROBE_CATEGORIES,
  EVENT_CATEGORIES,
} from "./openaiHelper";
import "dotenv/config";

// Add debug mode constant at the top
const DEBUG_MODE = false;
const DEBUG_LIMIT = 2;

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
function splitDateTime(isoString?: string): { date?: string; time?: string } {
  if (!isoString) return {};
  const d = dayjs(isoString);
  if (!d.isValid()) return {};

  return {
    date: d.toISOString(), // keep as full ISO date/time
    time: d.format("HH:mm"), // extract just HH:mm
  };
}

/**
 * Converts a KM appointment to BMV "Proben" format, storing KM_ID in Anmerkung.
 */
async function convertKmToBmvFormat(
  appointment: Appointment
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
  const pVArt = await identifyP_V_ArtFromOpenAI(combinedText, categories);

  return {
    // Full date/time is stored in V_DATUM; times in V_ZEIT_V/B
    V_DATUM: startDate,
    V_ZEIT_V: startTime,
    V_ZEIT_B: endTime,

    Ensemble_Gruppe: ensemble,
    Ausrueckungsart: ausrueckungsart,
    P_V_Art: pVArt,
    Bezeichnung: appointment.name,
    AKM_PFL: akmPfl,
    Anmerkung: anmerkungParts.join("\n") || undefined,
    AKM_Meldung: false,
    AKM_Meldedatum: null,
    Kopfquote: false,
    verein_id: 236, // Your verein_id

    // Optional: location info
    V_ORT: appointment.location?.formattedAddress,
    Bez_Veranstaltungslokal: appointment.meetingPoint || undefined,

    // If you have a default Probengruppe ID:
    Probengruppen_ID: "620C0A8B-FBAF-4E3F-B622-40501D54732C",
  };
}

/**
 * Main function to sync from KM → BMV, avoiding duplicates by checking KM_ID in BMV's Anmerkung.
 */
export async function syncKmToBmvAvoidDuplicates() {
  try {
    // Initialize BMV
    const bmvSync = new BmvSync({
      baseUrl: "https://api.vbv-blasmusik.at/api/",
      username: process.env.BMV_USERNAME!,
      password: process.env.BMV_PASSWORD!,
    });
    const bmvOk = await bmvSync.checkUser();
    if (!bmvOk) {
      console.error("Failed BMV login check");
      return;
    }

    // 1) Fetch existing BMV appointments from a wide date range
    const now = dayjs();
    const oneYearAgo = now.subtract(1, "year").toDate();
    const bmvActivities = await bmvSync.getActivities(oneYearAgo);
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

    // 5) Fetch all upcoming appointments from KM
    const appointmentsPayload: GetAppointmentsPayload = {
      dateMode: "UPCOMING",
      filterStart: null,
      filterEnd: null,
      parentOrgIds: null,
      groupOrgIds: null,
      settings: [],
    };

    const kmAppointments = await km.getAllAppointments(appointmentsPayload);
    console.log(`Fetched ${kmAppointments.length} appointments from KM`);

    // 6) Filter out duplicates (KM ID already in BMV)
    const newAppointments = kmAppointments.filter((apt) => {
      return !knownKmIds.has(apt.id);
    });

    let appointmentsToProcess = newAppointments;
    if (DEBUG_MODE) {
      console.log("DEBUG MODE: Limiting to", DEBUG_LIMIT, "appointments");
      appointmentsToProcess = newAppointments.slice(0, DEBUG_LIMIT);
    }

    console.log(
      `${appointmentsToProcess.length} new appointments (not in BMV) out of ${kmAppointments.length} total.`
    );

    // Convert appointments in parallel using Promise.all
    const bmvProben = await Promise.all(
      appointmentsToProcess.map((apt) => convertKmToBmvFormat(apt))
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
    } else {
      console.error("Failed to sync appointments to BMV.");
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
}

// Run the sync
syncKmToBmvAvoidDuplicates();
