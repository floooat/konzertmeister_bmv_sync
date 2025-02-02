import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";
/**
 * All possible fields in the Proben (Activity) model.
 * Some fields may be null/optional; ID and verein_id are typically required.
 */
export interface Proben {
  ID: string; // GUID in string form (required)
  V_DATUM?: string | null;
  V_ZEIT_V?: string | null;
  V_ZEIT_B?: string | null;
  Ensemble_Gruppe?: string | null;
  Probengruppen_ID?: string | null;
  Ausrueckungsart?: string | null;
  P_V_Art?: string | null;
  Bezeichnung?: string | null;
  Bez_Veranstalter?: string | null;
  V_STRASSE?: string | null;
  V_ORT?: string | null;
  V_PLTZ?: string | null;
  Bez_Veranstaltungslokal?: string | null;
  L_STRASSE?: string | null;
  L_ORT?: string | null;
  L_PLTZ?: string | null;
  AKM_PFL?: boolean | null;
  Anz_Teilnehmer?: number | null;
  Anmerkung?: string | null;
  Arbeitsstunden?: number | null;
  AKM_Meldung?: boolean | null;
  AKM_Meldedatum?: string | null;
  Kopfquote?: boolean | null;
  verein_id: number; // Must be provided
  Aenderung?: string | null;
}

export type NewProben = Omit<Proben, "ID">;

/** Configuration for initializing BmvSync. */
export interface BmvSyncOptions {
  /** Base URL of your data service, e.g. "https://api.vbv-blasmusik.at/api/" */
  baseUrl: string;

  /** Basic Auth username. */
  username: string;

  /** Basic Auth password. */
  password: string;
}

/**
 * A small library to sync activities ("Proben") with the BMV data service.
 */
export class BmvSync {
  private client: AxiosInstance;

  /**
   * Initializes a new BmvSync instance with the given options.
   * @param options Configuration object with baseUrl/username/password
   */
  constructor(options: BmvSyncOptions) {
    const { baseUrl, username, password } = options;

    if (!baseUrl || !username || !password) {
      throw new Error(
        "Missing required parameters: baseUrl, username, or password."
      );
    }

    // Create a customized Axios instance with Basic Auth
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 60_000, // e.g. 60 seconds, adjust as needed
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      auth: {
        username: process.env.BMV_USERNAME!,
        password: process.env.BMV_PASSWORD!,
      },
    });
  }

  /**
   * Checks user credentials by calling the `CheckBMVBenutzer` endpoint.
   * Returns `true` if valid user, `false` otherwise.
   */
  public async checkUser(): Promise<boolean> {
    try {
      const response = await this.client.get("CheckBMVBenutzer");
      // The server returns a boolean-ish value, e.g. "true" or "false".
      return response.status === 200 && Boolean(response.data);
    } catch (error: any) {
      console.error("checkUser error:", error.message);
      return false;
    }
  }

  /**
   * Fetches activities (Proben) filtered by the given date.
   * The server endpoint is: GET `Ausrueckungen/?datum={ISODate}&anz=10000`.
   * @param filterDate Date or string representing the filter date
   * @returns A promise of an array of Proben (activities).
   */
  public async getActivities(filterDate: Date | string): Promise<Proben[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString(); // convert to ISO 8601
      const response = await this.client.get<Proben[]>(
        `Ausrueckungen/?datum=${encodeURIComponent(isoDate)}&anz=10000`
      );
      return response.data;
    } catch (error: any) {
      console.error("getActivities error:", error.message);
      throw error;
    }
  }

  /**
   * Creates or updates an array of Proben (activities) via POST.
   * This calls POST `Ausrueckungen/` with a JSON body (array of Proben).
   * @param activities Array of Proben objects
   * @returns `true` if POST success (status 2xx), else `false`.
   */
  public async postActivities(activities: NewProben[]): Promise<boolean> {
    if (!Array.isArray(activities)) {
      throw new Error("postActivities expects an array of Proben objects.");
    }

    // Generate random ID only for activities without an ID
    const withIds: Proben[] = activities.map((activity) => ({
      ID: (activity as Proben).ID || uuidv4(), // use existing ID or generate new one
      ...activity,
    }));

    console.log("withIds", withIds);

    try {
      const response = await this.client.post("Ausrueckungen/", withIds);
      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error("postActivities error:", error.message);
      return false;
    }
  }
}
