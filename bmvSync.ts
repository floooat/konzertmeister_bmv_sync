import axios, { AxiosInstance, AxiosResponse } from "axios";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

// =============================================================================
// API ENDPOINTS CONFIGURATION
// =============================================================================

/** Regional API endpoints configuration */
export const API_ENDPOINTS = {
  Burgenland: {
    liveServiceUri: "https://datenservice.blasmusik-burgenland.at/api/",
    devServiceUri: null,
  },
  Oberösterreich: {
    liveServiceUri: "https://datenservice.ooe-bv.at/api/",
    devServiceUri: "https://devdatenservice-oo.azurewebsites.net/api/",
  },
  Salzburg: {
    liveServiceUri: "https://datenservice.blasmusik-salzburg.at/api/",
    devServiceUri: null,
  },
  Steiermark: {
    liveServiceUri: "https://datenservice.blasmusik-verband.at/api/",
    devServiceUri: "https://devdatenservice.blasmusik-verband.at/api/",
  },
  Vorarlberg: {
    liveServiceUri: "https://api.vbv-blasmusik.at/api/",
    devServiceUri: "https://devapi.vbv-blasmusik.at/api/",
  },
} as const;

export type RegionName = keyof typeof API_ENDPOINTS;

// =============================================================================
// ENTITY INTERFACES
// =============================================================================

/** Activities/Rehearsals (Proben) entity */
export interface Proben {
  ID: string; // GUID in string form
  V_DATUM?: Date | null;
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
  AKM_Meldedatum?: Date | null;
  Kopfquote?: boolean | null;
  verein_id: number;
  Aenderung?: Date | null;
}

export type NewProben = Omit<Proben, "ID">;

/** Person master data (Personenstammdaten) entity */
export interface Personenstammdaten {
  M_NR?: string | null;
  TITEL?: string | null;
  ZUNAME?: string | null;
  VORNAME?: string | null;
  TITELN?: string | null;
  PLTZ?: string | null;
  ORT?: string | null;
  STRASSE?: string | null;
  TEL_NR?: string | null;
  TEL_NR1?: string | null;
  TEL_NR2?: string | null;
  FAX?: string | null;
  Email1?: string | null;
  Email2?: string | null;
  GESCHL?: string | null;
  GEB_DAT?: string | null;
  BERUF?: string | null;
  Firma?: string | null;
  Tel_Firma?: string | null;
  Kategorien?: string | null;
  Foto?: string | null; // Base64 encoded
  Änderung?: string | null;
  Personen_FKT?: Personen_FKT[];
  Personen_INST?: Personen_INST[];
  Personen_MITART?: Personen_MITART[];
}

/** Person function (Personen_FKT) entity */
export interface Personen_FKT {
  ID?: string;
  M_NR?: string;
  FUNKTION?: string;
  verein_id?: number;
}

/** Person instrument (Personen_INST) entity */
export interface Personen_INST {
  ID?: string;
  M_NR?: string;
  INSTRUM?: string;
  Stimme?: string;
  verein_id?: number;
}

/** Person membership type (Personen_MITART) entity */
export interface Personen_MITART {
  ID?: string;
  M_NR?: string;
  MITART?: string;
  verein_id?: number;
}

/** Person photo (Personenfoto) entity */
export interface Personenfoto {
  ID?: string;
  Foto?: string; // Base64 encoded
}

/** Organization mobile view (KapellenMobileView) entity */
export interface KapellenMobileView {
  ID: number;
  Verein_ID?: string | null;
  Vereinsname?: string | null;
  Email?: string | null;
  Homepage?: string | null;
  Änderung?: string | null;
}

/** Organization logo mobile view (KapellenLogoMobilView) entity */
export interface KapellenLogoMobilView {
  Vereinslogo?: string; // Base64 encoded
}

/** Organization photo mobile view (KapellenFotoMobilView) entity */
export interface KapellenFotoMobilView {
  Kapellenfoto?: string; // Base64 encoded
}

/** Guest (Gast) entity */
export interface Gast {
  ID?: string;
  Proben_ID?: string;
  M_NR?: string;
  TITEL?: string;
  ZUNAME?: string;
  VORNAME?: string;
  INSTRUM?: string;
  Stimme?: string;
  FUNKTION?: string;
  GebDat?: Date | null;
  TITELN?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

/** Activity group (Probengruppe) entity */
export interface Probengruppe {
  ID?: string;
  Bezeichnung?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

/** Activity group member (Probengruppenmitglied) entity */
export interface Probengruppenmitglied {
  ID?: string;
  Probengruppen_ID?: string;
  M_NR?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

/** Activity participant (Probenteilnehmer) entity */
export interface Probenteilnehmer {
  ID?: string;
  Proben_ID?: string;
  M_NR?: string;
  TITEL?: string;
  ZUNAME?: string;
  VORNAME?: string;
  INSTRUM?: string;
  Stimme?: string;
  FUNKTION?: string;
  Gast?: boolean | null;
  GebDat?: Date | null;
  status?: string;
  TITELN?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

/** Music notes/pieces (Noten) entity */
export interface Noten {
  ID?: string;
  Titel?: string;
  Komponist?: string;
  Bearbeiter?: string;
  Verlag?: string;
  Schwierigkeitsgrad?: string;
  Spieldauer?: string;
  Besetzung?: string;
  Genre?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

/** Activity piece (Probenstueck) entity */
export interface Probenstueck {
  ID?: string;
  Proben_ID?: string;
  Noten_ID?: string;
  Titel?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

/** Rehearsal type (Probenart) entity */
export interface Probenart {
  ID?: string;
  Bezeichnung?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

/** Event type (Veranstaltungsart) entity */
export interface Veranstaltungsart {
  ID?: string;
  Bezeichnung?: string;
  verein_id?: number;
  Aenderung?: Date | null;
}

export interface CheckBmvBenutzerOoResponse {
  isVerify: boolean;
  verein_id: number | null;
}

// =============================================================================
// AUTO-RETRY HTTP CLIENT
// =============================================================================

/** Auto-retry HTTP client with exponential backoff */
class AutoRetryHttpClient {
  private client: AxiosInstance;
  private maxRetries: number;

  constructor(client: AxiosInstance, maxRetries: number = 5) {
    this.client = client;
    this.maxRetries = maxRetries;
  }

  async get<T = any>(
    url: string,
    retryCount: number = this.maxRetries
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.get<T>(url);
    } catch (error: any) {
      if (this.shouldRetry(error) && retryCount > 0) {
        console.warn(
          `GET ${url} failed, retrying... (${
            this.maxRetries - retryCount + 1
          }/${this.maxRetries})`
        );
        await this.delay(1000 * (this.maxRetries - retryCount + 1));
        return this.get<T>(url, retryCount - 1);
      }
      throw error;
    }
  }

  async post<T = any>(
    url: string,
    data: any,
    retryCount: number = this.maxRetries
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.post<T>(url, data);
    } catch (error: any) {
      if (this.shouldRetry(error) && retryCount > 0) {
        console.warn(
          `POST ${url} failed, retrying... (${
            this.maxRetries - retryCount + 1
          }/${this.maxRetries})`
        );
        await this.delay(1000 * (this.maxRetries - retryCount + 1));
        return this.post<T>(url, data, retryCount - 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    return (
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ENOTFOUND" ||
      error.message?.includes("timed out") ||
      (error.response && error.response.status >= 500)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  dispose(): void {
    // Axios doesn't need explicit disposal
  }
}

// =============================================================================
// CONFIGURATION INTERFACE
// =============================================================================

/** Configuration for initializing BmvSync */
export interface BmvSyncOptions {
  /** Regional endpoint to use */
  region: RegionName;

  /** Whether to use development service (if available) */
  useDevService?: boolean;

  /** Basic Auth username */
  username: string;

  /** Basic Auth password */
  password: string;

  /** Request timeout in milliseconds (default: 300000) */
  timeout?: number;

  /** Maximum retry attempts (default: 5) */
  maxRetries?: number;
}

// =============================================================================
// MAIN BMV SYNC CLASS
// =============================================================================

/**
 * Comprehensive BMV synchronization client supporting all BMV API endpoints.
 * Based on the C# BMV.Sync implementation with TypeScript adaptations.
 */
export class BmvSync {
  private client: AutoRetryHttpClient;
  private options: BmvSyncOptions;

  /**
   * Initializes a new BmvSync instance with the given options.
   * @param options Configuration object
   */
  constructor(options: BmvSyncOptions) {
    this.options = { timeout: 300000, maxRetries: 5, ...options };

    const { region, useDevService, username, password, timeout } = this.options;

    if (!region || !username || !password) {
      throw new Error(
        "Missing required parameters: region, username, or password."
      );
    }

    const endpoints = API_ENDPOINTS[region];
    if (!endpoints) {
      throw new Error(
        `Invalid region: ${region}. Valid regions: ${Object.keys(
          API_ENDPOINTS
        ).join(", ")}`
      );
    }

    const baseURL =
      useDevService && endpoints.devServiceUri
        ? endpoints.devServiceUri
        : endpoints.liveServiceUri;

    if (!baseURL) {
      throw new Error(
        `No ${
          useDevService ? "development" : "live"
        } service available for region: ${region}`
      );
    }

    // Create Axios instance with Basic Auth
    const axiosClient = axios.create({
      baseURL,
      timeout,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      auth: {
        username,
        password,
      },
    });

    // Wrap with auto-retry functionality
    this.client = new AutoRetryHttpClient(axiosClient, this.options.maxRetries);
  }

  // =============================================================================
  // USER AUTHENTICATION
  // =============================================================================

  /**
   * Checks user credentials by calling the CheckBMVBenutzer endpoint.
   * @returns Promise<boolean> True if valid user, false otherwise
   */
  async checkUser(): Promise<boolean> {
    try {
      const response = await this.client.get<any>("CheckBMVBenutzer");
      if (response.status !== 200) {
        return false;
      }

      // API returns JSON boolean (`true`/`false`) and Axios may parse it as boolean.
      if (typeof response.data === "boolean") {
        return response.data;
      }

      const asString = String(response.data ?? "").trim().toLowerCase();
      return asString === "true";
    } catch (error: any) {
      console.error("checkUser error:", error.message);
      return false;
    }
  }

  async getUserVerification(): Promise<CheckBmvBenutzerOoResponse | null> {
    try {
      const response = await this.client.get<any>("CheckBMVBenutzerOO");
      if (response.status !== 200 || !response.data) {
        return null;
      }

      const data = response.data as Partial<CheckBmvBenutzerOoResponse>;
      if (typeof data.isVerify !== "boolean") {
        return null;
      }
      if (
        data.verein_id !== null &&
        typeof data.verein_id !== "number"
      ) {
        return null;
      }
      return {
        isVerify: data.isVerify,
        verein_id: (data.verein_id ?? null) as number | null,
      };
    } catch (error: any) {
      console.error("getUserVerification error:", error.message);
      return null;
    }
  }

  // =============================================================================
  // ACTIVITIES (PROBEN)
  // =============================================================================

  /**
   * Fetches activities (Proben) filtered by the given date.
   * @param filterDate Date to filter by
   * @returns Promise<Proben[]> Array of activities
   */
  async getActivities(filterDate: Date | string): Promise<Proben[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString();
      const response = await this.client.get<Proben[]>(
        `Ausrueckungen/?datum=${encodeURIComponent(isoDate)}&anz=10000`
      );
      return this.processDateFields(response.data, [
        "V_DATUM",
        "AKM_Meldedatum",
        "Aenderung",
      ]);
    } catch (error: any) {
      console.error("getActivities error:", error.message);
      throw error;
    }
  }

  /**
   * Creates or updates activities via POST.
   * @param activities Array of activity objects
   * @returns Promise<boolean> True if successful
   */
  async postActivities(activities: NewProben[]): Promise<boolean> {
    if (!Array.isArray(activities)) {
      throw new Error("postActivities expects an array of Proben objects.");
    }

    const withIds: Proben[] = activities.map((activity) => ({
      ID: (activity as Proben).ID || uuidv4(),
      ...activity,
    }));

    try {
      console.log(
        "Sending activities to BMV:",
        JSON.stringify(withIds, null, 2)
      );
      const response = await this.client.post("Ausrueckungen/", withIds);
      console.log("BMV API response status:", response.status);
      console.log("BMV API response data:", response.data);

      // Check if BMV returned any error messages
      if (response.status === 204 && !response.data) {
        console.log(
          "BMV returned 204 No Content - this might indicate validation errors"
        );
      }

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error("postActivities error:", error.message);
      if (error.response) {
        console.error("Error response status:", error.response.status);
        console.error("Error response data:", error.response.data);
      }
      return false;
    }
  }

  // =============================================================================
  // PEOPLE (PERSONENSTAMMDATEN)
  // =============================================================================

  /**
   * Fetches people data filtered by the given date.
   * @param filterDate Date to filter by
   * @returns Promise<Personenstammdaten[]> Array of people
   */
  async getPeople(filterDate: Date | string): Promise<Personenstammdaten[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString();
      const response = await this.client.get<Personenstammdaten[]>(
        `PersonenstammdatenExt/?image=false&geloescht=false&datum=${encodeURIComponent(
          isoDate
        )}`
      );
      return response.data || [];
    } catch (error: any) {
      console.error("getPeople error:", error.message);
      throw error;
    }
  }

  /**
   * Fetches a person's image by ID.
   * @param id Person ID
   * @returns Promise<string | null> Base64 encoded image or null
   */
  async getPersonImage(id: string): Promise<string | null> {
    try {
      const response = await this.client.get<Personenfoto>(
        `personenfoto?ID=${id}`
      );
      return response.data?.Foto || null;
    } catch (error: any) {
      console.error("getPersonImage error:", error.message);
      return null;
    }
  }

  // =============================================================================
  // ORGANIZATION INFO
  // =============================================================================

  /**
   * Fetches organization common information.
   * @returns Promise<KapellenMobileView | null> Organization info or null
   */
  async getOrganizationInfo(): Promise<KapellenMobileView | null> {
    try {
      const response = await this.client.get<KapellenMobileView[]>(
        "Kapellenstammdaten"
      );
      return response.data?.[0] || null;
    } catch (error: any) {
      console.error("getOrganizationInfo error:", error.message);
      throw error;
    }
  }

  /**
   * Fetches organization logo by ID.
   * @param id Organization ID
   * @returns Promise<string | null> Base64 encoded logo or null
   */
  async getOrganizationLogo(id: number): Promise<string | null> {
    try {
      const response = await this.client.get<KapellenLogoMobilView>(
        `Kapellenlogo?id=${id}`
      );
      return response.data?.Vereinslogo || null;
    } catch (error: any) {
      console.error("getOrganizationLogo error:", error.message);
      return null;
    }
  }

  /**
   * Fetches organization picture by ID.
   * @param id Organization ID
   * @returns Promise<string | null> Base64 encoded picture or null
   */
  async getOrganizationPicture(id: number): Promise<string | null> {
    try {
      const response = await this.client.get<KapellenFotoMobilView>(
        `Kapellenfoto?id=${id}`
      );
      return response.data?.Kapellenfoto || null;
    } catch (error: any) {
      console.error("getOrganizationPicture error:", error.message);
      return null;
    }
  }

  // =============================================================================
  // GUESTS
  // =============================================================================

  /**
   * Fetches guests filtered by the given date.
   * @param filterDate Date to filter by
   * @returns Promise<Gast[]> Array of guests
   */
  async getGuests(filterDate: Date | string): Promise<Gast[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString();
      const response = await this.client.get<Gast[]>(
        `ausrueckungengaeste?anz=10000&datum=${encodeURIComponent(isoDate)}`
      );
      return this.processDateFields(response.data, ["GebDat", "Aenderung"]);
    } catch (error: any) {
      console.error("getGuests error:", error.message);
      throw error;
    }
  }

  // =============================================================================
  // ACTIVITY GROUPS
  // =============================================================================

  /**
   * Fetches activity groups filtered by the given date.
   * @param filterDate Date to filter by
   * @returns Promise<Probengruppe[]> Array of activity groups
   */
  async getActivityGroups(filterDate: Date | string): Promise<Probengruppe[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString();
      const response = await this.client.get<Probengruppe[]>(
        `Probengruppen/?datum=${encodeURIComponent(isoDate)}`
      );
      return this.processDateFields(response.data, ["Aenderung"]);
    } catch (error: any) {
      console.error("getActivityGroups error:", error.message);
      throw error;
    }
  }

  /**
   * Fetches activity group members by group ID.
   * @param id Group ID
   * @returns Promise<Probengruppenmitglied[]> Array of group members
   */
  async getActivityGroupMembers(id: string): Promise<Probengruppenmitglied[]> {
    try {
      const response = await this.client.get<Probengruppenmitglied[]>(
        `Probengruppenmitglieder?id=${id}`
      );
      return this.processDateFields(response.data, ["Aenderung"]);
    } catch (error: any) {
      console.error("getActivityGroupMembers error:", error.message);
      throw error;
    }
  }

  // =============================================================================
  // ACTIVITY ATTENDANCES
  // =============================================================================

  /**
   * Fetches activity attendances by activity ID.
   * @param id Activity ID
   * @returns Promise<Probenteilnehmer[]> Array of attendances
   */
  async getActivityAttendances(id: string): Promise<Probenteilnehmer[]> {
    try {
      const response = await this.client.get<Probenteilnehmer[]>(
        `Probenteilnehmer?probenid=${id}`
      );
      return this.processDateFields(response.data, ["GebDat", "Aenderung"]);
    } catch (error: any) {
      console.error("getActivityAttendances error:", error.message);
      throw error;
    }
  }

  /**
   * Posts activity attendances for a specific activity.
   * @param id Activity ID
   * @param attendances Array of attendance objects
   * @returns Promise<boolean> True if successful
   */
  async postActivityAttendances(
    id: string,
    attendances: Probenteilnehmer[]
  ): Promise<boolean> {
    try {
      const response = await this.client.post(
        `Probenteilnehmer?probenid=${id}`,
        attendances
      );
      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error("postActivityAttendances error:", error.message);
      return false;
    }
  }

  // =============================================================================
  // MUSIC PIECES
  // =============================================================================

  /**
   * Fetches music pieces archive filtered by the given date.
   * @param filterDate Date to filter by
   * @returns Promise<Noten[]> Array of music pieces
   */
  async getMusicPiecesArchive(filterDate: Date | string): Promise<Noten[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString();
      const response = await this.client.get<Noten[]>(
        `Noten?anz=100000&datum=${encodeURIComponent(isoDate)}`
      );
      return this.processDateFields(response.data, ["Aenderung"]);
    } catch (error: any) {
      console.error("getMusicPiecesArchive error:", error.message);
      throw error;
    }
  }

  /**
   * Fetches activity pieces by activity ID.
   * @param id Activity ID
   * @returns Promise<Probenstueck[]> Array of activity pieces
   */
  async getActivityPieces(id: string): Promise<Probenstueck[]> {
    try {
      const response = await this.client.get<Probenstueck[]>(
        `Probenstuecke?probenid=${id}`
      );
      return this.processDateFields(response.data, ["Aenderung"]);
    } catch (error: any) {
      console.error("getActivityPieces error:", error.message);
      throw error;
    }
  }

  /**
   * Posts activity pieces for a specific activity.
   * @param id Activity ID
   * @param pieces Array of piece objects
   * @returns Promise<boolean> True if successful
   */
  async postActivityPieces(
    id: string,
    pieces: Probenstueck[]
  ): Promise<boolean> {
    try {
      const response = await this.client.post(
        `Probenstuecke?probenid=${id}`,
        pieces
      );
      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error("postActivityPieces error:", error.message);
      return false;
    }
  }

  // =============================================================================
  // REFERENCE DATA
  // =============================================================================

  /**
   * Fetches rehearsal types filtered by the given date.
   * @param filterDate Date to filter by
   * @returns Promise<Probenart[]> Array of rehearsal types
   */
  async getRehearsalTypes(filterDate: Date | string): Promise<Probenart[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString();
      const response = await this.client.get<Probenart[]>(
        `Probenarten?datum=${encodeURIComponent(isoDate)}`
      );
      return this.processDateFields(response.data, ["Aenderung"]);
    } catch (error: any) {
      console.error("getRehearsalTypes error:", error.message);
      throw error;
    }
  }

  /**
   * Fetches event types filtered by the given date.
   * @param filterDate Date to filter by
   * @returns Promise<Veranstaltungsart[]> Array of event types
   */
  async getEventTypes(filterDate: Date | string): Promise<Veranstaltungsart[]> {
    try {
      const isoDate = dayjs(filterDate).toISOString();
      const response = await this.client.get<Veranstaltungsart[]>(
        `Veranstaltungsart?datum=${encodeURIComponent(isoDate)}`
      );
      return this.processDateFields(response.data, ["Aenderung"]);
    } catch (error: any) {
      console.error("getEventTypes error:", error.message);
      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Processes date fields in response data, converting ISO strings to Date objects.
   * @param data Array of objects to process
   * @param dateFields Array of field names that contain dates
   * @returns Processed data with converted dates
   */
  private processDateFields<T>(data: T[], dateFields: string[]): T[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item) => {
      const processed = { ...item };
      dateFields.forEach((field) => {
        const value = (processed as any)[field];
        if (value && typeof value === "string") {
          try {
            (processed as any)[field] = new Date(value);
          } catch {
            // Keep original value if date parsing fails
          }
        }
      });
      return processed;
    });
  }

  /**
   * Disposes of the HTTP client resources.
   */
  dispose(): void {
    this.client.dispose();
  }
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/** @deprecated Use BmvSyncOptions instead */
export type BmvSyncConfig = BmvSyncOptions;

/**
 * Creates a BmvSync instance using environment variables for backward compatibility.
 * @deprecated Use the new BmvSync constructor with explicit options instead
 */
export function createLegacyBmvSync(): BmvSync {
  return new BmvSync({
    region: (process.env.BMV_REGION as RegionName) || "Vorarlberg",
    useDevService: process.env.BMV_USE_DEV === "true",
    username: process.env.BMV_USERNAME!,
    password: process.env.BMV_PASSWORD!,
  });
}
