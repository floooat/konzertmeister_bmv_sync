import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { Proben, NewProben } from "./bmvSync";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

const PORTAL_BASE = "https://bmv.vbv-blasmusik.at";
const B2C_BASE = "https://oebvmitglieder.b2clogin.com";
const B2C_TENANT = "mitglieder.blasmusik.at";
const B2C_POLICY = "B2C_1_bmvonline";

export class BmvPortalSync {
  private client: AxiosInstance;
  private jar: CookieJar;
  private authenticated = false;
  private vereinId: number | null = null;
  private username: string;
  private password: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        maxRedirects: 0,
        validateStatus: (s) => s < 400 || s === 302,
        timeout: 60000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })
    );
  }

  /**
   * Authenticates via B2C portal login and establishes session cookies.
   * Returns { isVerify, verein_id } compatible with the old API.
   */
  async login(): Promise<{ isVerify: boolean; verein_id: number | null }> {
    try {
      // Step 1: GET /Account/SignUpSignIn → 302 to B2C
      let resp = await this.client.get(
        `${PORTAL_BASE}/Account/SignUpSignIn`
      );
      const b2cUrl = resp.headers.location;
      if (!b2cUrl) throw new Error("No redirect to B2C");

      // Step 2: Follow to B2C login page, extract CSRF and state
      // Parse the B2C base path from the redirect URL (handles tenant/policy variations)
      const b2cUrlObj = new URL(b2cUrl);
      const b2cOrigin = b2cUrlObj.origin;
      const b2cPathSegments = b2cUrlObj.pathname.split("/").filter(Boolean);
      // Path is /{tenant}/{policy}/... — extract tenant and policy from the URL
      const b2cTenantPath = b2cPathSegments[0] || B2C_TENANT;
      const b2cPolicyPath = b2cPathSegments[1] || B2C_POLICY;
      const b2cBasePath = `${b2cOrigin}/${b2cTenantPath}/${b2cPolicyPath}`;

      resp = await this.client.get(b2cUrl, {
        maxRedirects: 5,
        validateStatus: (s) => s < 400,
      });
      const b2cHtml = resp.data as string;

      const csrfMatch = b2cHtml.match(
        /name="csrf_token"[^>]*value="([^"]+)"/
      ) || b2cHtml.match(/csrf_token['"]\s*:\s*['"]([^'"]+)['"]/);
      const csrfToken = csrfMatch?.[1];

      const stateMatch = b2cHtml.match(
        /StateProperties=([A-Za-z0-9_-]+)/
      );
      const stateProperties = stateMatch?.[1];

      if (!stateProperties) throw new Error("Could not extract StateProperties");

      // Extract the CSRF from cookies if not in HTML
      const cookies = await this.jar.getCookies(b2cUrl);
      const csrfCookie = cookies.find((c) => c.key === "x-ms-cpim-csrf");
      const csrf = csrfToken || csrfCookie?.value;
      if (!csrf) throw new Error("Could not extract CSRF token");

      // Step 3: POST credentials to B2C SelfAsserted
      const selfAssertedUrl = `${b2cBasePath}/SelfAsserted?tx=StateProperties=${stateProperties}&p=${b2cPolicyPath}`;
      resp = await this.client.post(
        selfAssertedUrl,
        new URLSearchParams({
          request_type: "RESPONSE",
          email: this.username,
          password: this.password,
        }).toString(),
        {
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded; charset=UTF-8",
            "X-CSRF-TOKEN": csrf,
            "X-Requested-With": "XMLHttpRequest",
          },
          validateStatus: (s) => s < 400,
        }
      );

      const selfAssertedData =
        typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
      if (selfAssertedData.status !== "200") {
        console.error("B2C credential check failed:", selfAssertedData);
        return { isVerify: false, verein_id: null };
      }

      // Step 4: GET confirmed → extract state, code, id_token from HTML form
      const confirmedUrl = `${b2cBasePath}/api/CombinedSigninAndSignup/confirmed?rememberMe=false&csrf_token=${encodeURIComponent(csrf)}&tx=StateProperties=${stateProperties}&p=${b2cPolicyPath}`;
      resp = await this.client.get(confirmedUrl, {
        maxRedirects: 0,
        validateStatus: (s) => s < 400 || s === 302,
      });
      const confirmedHtml = resp.data as string;

      const stateVal = confirmedHtml.match(
        /name=['"]state['"]\s+(?:id=['"][^'"]*['"]\s+)?value=['"]([^'"]+)['"]/
      )?.[1];
      const codeVal = confirmedHtml.match(
        /name=['"]code['"]\s+(?:id=['"][^'"]*['"]\s+)?value=['"]([^'"]+)['"]/
      )?.[1];
      const idTokenVal = confirmedHtml.match(
        /name=['"]id_token['"]\s+(?:id=['"][^'"]*['"]\s+)?value=['"]([^'"]+)['"]/
      )?.[1];
      const formAction = confirmedHtml.match(
        /action=['"]([^'"]+)['"]/
      )?.[1];

      if (!stateVal || !codeVal || !idTokenVal || !formAction) {
        throw new Error("Could not extract tokens from B2C confirmed page");
      }

      // Step 5: POST tokens back to portal
      resp = await this.client.post(
        formAction,
        new URLSearchParams({
          state: stateVal,
          code: codeVal,
          id_token: idTokenVal,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          maxRedirects: 0,
          validateStatus: (s) => s < 400 || s === 302,
        }
      );

      // Step 6: Verify session by hitting homepage
      resp = await this.client.get(`${PORTAL_BASE}/`, {
        maxRedirects: 5,
        validateStatus: (s) => s < 400,
      });

      const homeHtml = resp.data as string;
      const loggedIn = homeHtml.includes("Abmelden");

      if (!loggedIn) {
        return { isVerify: false, verein_id: null };
      }

      this.authenticated = true;

      // Extract verein_id from a Read call (first activity's verein_id)
      const activities = await this.getActivities(
        dayjs().startOf("year").toDate()
      );
      if (activities.length > 0) {
        this.vereinId = activities[0].verein_id;
      } else {
        // Fallback: try previous year
        const prevYear = await this.getActivities(
          dayjs().subtract(1, "year").startOf("year").toDate()
        );
        if (prevYear.length > 0) {
          this.vereinId = prevYear[0].verein_id;
        }
      }

      return { isVerify: true, verein_id: this.vereinId };
    } catch (error: any) {
      console.error("B2C portal login error:", error.message);
      return { isVerify: false, verein_id: null };
    }
  }

  /**
   * Fetches activities from the portal for the year containing filterDate.
   */
  async getActivities(filterDate: Date | string): Promise<Proben[]> {
    if (!this.authenticated) throw new Error("Not authenticated");

    const year = dayjs(filterDate).year().toString();
    const resp = await this.client.post(
      `${PORTAL_BASE}/Ausr%C3%BCckungen/Read`,
      new URLSearchParams({
        sort: "V_DATUM-desc",
        page: "1",
        pageSize: "10000",
        group: "",
        filter: "",
        jahresfilter: year,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        validateStatus: (s) => s < 400,
        maxRedirects: 5,
      }
    );

    const data = resp.data;
    if (!data?.Data) return [];

    return data.Data.map((item: any) => ({
      ...item,
      V_DATUM: item.V_DATUM ? new Date(item.V_DATUM) : null,
      AKM_Meldedatum: item.AKM_Meldedatum
        ? new Date(item.AKM_Meldedatum)
        : null,
      Aenderung: item.Aenderung ? new Date(item.Aenderung) : null,
    }));
  }

  /**
   * Fetches activities across multiple years covering the full sync window.
   */
  async getActivitiesForWindow(
    start: Date | string,
    end: Date | string
  ): Promise<Proben[]> {
    const startYear = dayjs(start).year();
    const endYear = dayjs(end).year();
    const allActivities: Proben[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const yearActivities = await this.getActivities(
        new Date(year, 0, 1)
      );
      allActivities.push(...yearActivities);
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    return allActivities.filter((a) => {
      if (seen.has(a.ID)) return false;
      seen.add(a.ID);
      return true;
    });
  }

  /**
   * Creates activities in BMV portal via form POST.
   * Uses Create_Probe for rehearsals (Ausrueckungsart=P) and
   * Create_Veranstaltung for events (Ausrueckungsart=V).
   */
  async postActivities(activities: NewProben[]): Promise<boolean> {
    if (!this.authenticated) throw new Error("Not authenticated");

    let allSuccess = true;
    for (const activity of activities) {
      try {
        const success = await this.createActivity(activity);
        if (!success) {
          allSuccess = false;
          console.error(
            `Failed to create activity: ${activity.Bezeichnung}`
          );
        }
      } catch (error: any) {
        allSuccess = false;
        console.error(
          `Error creating activity ${activity.Bezeichnung}:`,
          error.message
        );
      }
    }
    return allSuccess;
  }

  private async createActivity(activity: NewProben): Promise<boolean> {
    const isEvent = activity.Ausrueckungsart === "V";
    const isSonstige = activity.Ausrueckungsart === "S";
    const endpoint = isSonstige
      ? "Create_Sonstige"
      : isEvent
        ? "Create_Veranstaltung"
        : "Create_Probe";

    // Format date for form submission (dd.MM.yyyy for Kendo DatePicker)
    const vDatum = activity.V_DATUM
      ? dayjs(activity.V_DATUM).format("DD.MM.YYYY")
      : "";

    // For events, Bez_Veranstalter is required by the portal
    const bezVeranstalter = activity.Bez_Veranstalter
      || (isEvent ? (activity.Bezeichnung || "Musikverein") : "");

    const formData = new URLSearchParams();
    formData.append("ID", uuidv4());
    formData.append("verein_id", String(activity.verein_id || this.vereinId || 236));
    formData.append("Ausrueckungsart", activity.Ausrueckungsart || "P");
    formData.append("V_DATUM", vDatum);
    formData.append("V_ZEIT_V", activity.V_ZEIT_V || "");
    formData.append("V_ZEIT_B", activity.V_ZEIT_B || "");
    formData.append("Bezeichnung", activity.Bezeichnung || "");
    formData.append("P_V_Art", activity.P_V_Art || "");
    formData.append("Ensemble_Gruppe", activity.Ensemble_Gruppe || "alle aktiven Musiker/innen");
    formData.append("Probengruppen_ID", activity.Probengruppen_ID || "620C0A8B-FBAF-4E3F-B622-40501D54732C");
    formData.append("AKM_PFL", activity.AKM_PFL ? "true" : "false");
    formData.append("Kopfquote", activity.Kopfquote ? "true" : "false");
    formData.append("AKM_Meldung", activity.AKM_Meldung ? "true" : "false");
    formData.append("Anmerkung", activity.Anmerkung || "");
    formData.append("Bez_Veranstalter", bezVeranstalter);
    formData.append("V_STRASSE", activity.V_STRASSE || "");
    formData.append("V_ORT", activity.V_ORT || "");
    formData.append("V_PLTZ", activity.V_PLTZ || "");
    formData.append("Bez_Veranstaltungslokal", activity.Bez_Veranstaltungslokal || "");
    formData.append("L_STRASSE", activity.L_STRASSE || "");
    formData.append("L_ORT", activity.L_ORT || "");
    formData.append("L_PLTZ", activity.L_PLTZ || "");
    formData.append("Anz_Teilnehmer", String(activity.Anz_Teilnehmer ?? 0));
    formData.append("Arbeitsstunden", String(activity.Arbeitsstunden ?? 0));

    console.log(
      `  Creating ${endpoint}: ${activity.Bezeichnung} (${vDatum})`
    );

    const resp = await this.client.post(
      `${PORTAL_BASE}/Ausr%C3%BCckungen/${endpoint}`,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 0,
        validateStatus: (s) => s >= 100,
      }
    );

    // Successful create returns 302 redirect to list page
    if (resp.status === 302) {
      return true;
    }

    // If 200, check for validation errors in HTML response
    if (resp.status === 200) {
      const html = resp.data as string;
      const errorMatch = html.match(
        /validation-summary-errors[^>]*>[\s\S]*?<\/ul>/
      );
      if (errorMatch) {
        console.error(`  Validation errors: ${errorMatch[0].replace(/<[^>]+>/g, " ").trim()}`);
        return false;
      }
      // No errors found, might still be success (some forms return 200)
      return true;
    }

    console.error(`  Unexpected status ${resp.status}`);
    return false;
  }

  /**
   * Deletes an activity by ID.
   */
  async deleteActivity(id: string): Promise<boolean> {
    if (!this.authenticated) throw new Error("Not authenticated");

    const resp = await this.client.post(
      `${PORTAL_BASE}/Ausr%C3%BCckungen/DeleteConfirmed/?id=${encodeURIComponent(id)}`,
      "",
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        maxRedirects: 0,
        validateStatus: (s) => s < 400,
      }
    );

    return resp.status >= 200 && resp.status < 300;
  }

  dispose(): void {
    // Nothing to dispose for cookie-based sessions
  }
}
