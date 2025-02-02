import axios, { AxiosInstance } from "axios";

/**
 * Request payload for the Konzertmeister login.
 */
export interface KonzertmeisterLoginRequest {
  mail: string;
  password: string;
  locale: string;
  timezoneId: string;
}

/**
 * Request payload for fetching appointments.
 * Example from your sample:
 * {
 *   "dateMode":"UPCOMING",
 *   "filterStart":null,
 *   "filterEnd":null,
 *   "parentOrgIds":null,
 *   "groupOrgIds":null,
 *   "settings":[]
 * }
 */
export interface GetAppointmentsPayload {
  dateMode: "UPCOMING" | "PAST" | "ALL"; // or other possible values
  filterStart: string | null;
  filterEnd: string | null;
  parentOrgIds: number[] | null;
  groupOrgIds: number[] | null;
  settings: any[];
}

/**
 * Main appointment structure, based on your sample JSON.
 */
export interface Appointment {
  id: number;
  name: string;
  creatorName: string;
  creatorImageURL?: string;
  creatorKmUserId?: number;
  description?: string | null;
  leaderOnlyDescription?: string | null;
  start?: string; // ISO datetime
  end?: string; // ISO datetime
  org?: AppointmentOrg;
  typId?: number;
  active?: boolean;
  statusDeadline?: string;
  remindDeadline?: string;
  createdAt?: string;
  timeUndefined?: boolean;
  informCreatorOnAttendanceUpdate?: boolean | null;
  liEditAllowed?: boolean;
  liSecretaryAllowed?: boolean;
  liSharingAllowed?: boolean;
  liWritePinnwallAllowed?: boolean;
  liSendReminderAllowed?: boolean;
  liSendMessageAllowed?: boolean;
  liSendPollAllowed?: boolean;
  liOpenFromMatrixAllowed?: boolean | null;
  liOpenUpdateFeedAllowed?: boolean;
  liAttendance?: AppointmentAttendance;
  statistics?: AppointmentStatistics;
  allowOptionMaybe?: boolean;
  forceDescriptionOnNegativeReply?: boolean;
  location?: AppointmentLocation;
  meetingPoint?: string | null;
  attendanceVisibility?: string;
  descriptionVisibility?: string;
  group?: any;
  parentImageUrl?: string | null;
  imageUrl?: string;
  qrCodeAttendRealUrl?: string | null;
  attendanceLimit?: number | null;
  positiveReplies?: any | null;
  numPinnwall?: number;
  numFiles?: number;
  numFeedFiles?: number;
  tags?: string[];
  cancelDescription?: string | null;
  publicSharingUrl?: string | null;
  checkinQrCodeImageUrl?: string | null;
  attachFilesRoleId?: number;
  privateLinkURL?: string;
  publicsite?: boolean;
  distance?: number | null;
  attendanceUpdateConfig?: any;
  playlist?: any;
  timezoneId?: string;
  pinnwallLocked?: boolean;
  umbrellaOrgId?: number | null;
  externalAppointmentLink?: string | null;
  invitedParentOrgIds?: number[] | null;
  published?: boolean;
  publishAt?: string | null;
  manuallyPublishedAt?: string | null;
  manuallyPublishedBy?: string | null;
  includeInactive?: boolean;
  room?: AppointmentRoom;
}

/**
 * Sub-object: organization info for the appointment.
 */
export interface AppointmentOrg {
  id: number;
  name: string;
  parentName?: string | null;
  parentId?: number | null;
  typId?: number | null;
  liRoleId?: number | null;
  liPendingRequest?: any | null;
  numApprovedMembers?: number | null;
  leaderNames?: string | null;
  secretaryNames?: string | null;
  coLeaderNames?: string | null;
  secretaryCount?: number | null;
  leaderCount?: number | null;
  coLeaderCount?: number | null;
  token?: string | null;
  attendanceVisibleOnlyLeaders?: boolean;
  sort?: any | null;
  imageUrl?: string;
  adminKmUserId?: number;
  adminKmUserName?: string | null;
  address?: any | null;
  paymentPlan?: PaymentPlan;
  attendanceVisibility?: string;
  descriptionVisibility?: string;
  tags?: any[] | null;
  select?: any | null;
  showAllAppointmentsToMembers?: boolean | null;
  allowMemberSendMessage?: boolean | null;
  rootFolderId?: number | null;
  referralCode?: string;
  privateLinkURL?: string;
  publicSiteId?: number | null;
  attInvitedActive?: any | null;
  grouporg?: any | null;
  imageGenerated?: boolean;
  timezoneId?: string;
  umbrellaOrgId?: number | null;
  associationDistrict?: any | null;
}

/**
 * Sub-object: payment plan details for the org.
 */
export interface PaymentPlan {
  id: number;
  orgId: number;
  type: string;
  status: string;
  payEveryIntervalType?: string | null;
  balance?: number | null;
  vatId?: string | null;
  invoiceFirstName?: string | null;
  invoiceLastName?: string | null;
  invoiceAdditionalOrgName?: string | null;
  invoiceAdditionalReceiverMail?: string | null;
  invoiceAddress?: string | null;
  numCurrentMembers?: number | null;
  numIncludedMembers?: number;
  numIncludedSubstitutes?: number;
  addingMembersAvailable?: boolean;
  proFeaturesAvailable?: boolean;
  createAppointmentAvailable?: boolean;
  createFileItemAvailable?: boolean;
  trialAvailable?: boolean | null;
  masterId?: number | null;
  masterOrg?: any | null;
  slaveOrgs?: any[] | null;
  storagePlanType?: string | null;
  rootFolder?: any | null;
  billingGroupStorageKilos?: any | null;
  hasSlaveOrgs?: boolean | null;
  currentInterval?: PaymentPlanInterval | null;
}

/**
 * Sub-object: payment plan interval (e.g., yearly subscription).
 */
export interface PaymentPlanInterval {
  id: number;
  paymentPlanId: number;
  status: string;
  type: string;
  storagePlanType?: string | null;
  payEveryIntervalType?: string | null;
  start?: string;
  end?: string;
  invoice?: PaymentPlanInvoice | null;
  cancellationInvoice?: any | null;
  createdDate?: string;
  trial?: boolean;
  autoExtended?: boolean;
  cancelled?: boolean;
  cancelType?: any | null;
  cancelDate?: any | null;
  remainingValue?: number;
  remainingDaysInInterval?: number;
  responsibleName?: string | null;
  responsibleMail?: string | null;
  paymentReceivedDate?: string | null;
}

/**
 * Sub-object: invoice details inside a payment plan interval.
 */
export interface PaymentPlanInvoice {
  id: number;
  invoiceDate?: string;
  intervalStart?: string;
  intervalEnd?: string;
  invoiceNumber?: string;
  amount?: number;
  storageAmount?: number;
  amountBalanceUsed?: number | null;
  sum?: number;
  receiverKmUserId?: number;
  receiverAddressId?: number;
  invoiceFile?: string;
  vatId?: string;
  receiverFirstName?: string;
  receiverLastName?: string;
  cancellation?: boolean;
  cancelledInvoiceId?: number | null;
  cancelledInvoiceNumber?: string | null;
  cancelledByInvoiceId?: number | null;
  cancelledByInvoiceNumber?: string | null;
  paymentMethod?: string;
  stripePaymentMethod?: string | null;
  code?: string;
}

/**
 * Sub-object: attendance for the logged-in user (liAttendance).
 */
export interface AppointmentAttendance {
  id: number;
  kmUserId: number;
  appointmentId: number;
  attending: boolean;
  description?: string | null;
  marked?: boolean;
  external?: boolean;
  updatedAt?: string | null;
  lastEditedBy?: string | null;
  negative?: boolean;
  positive?: boolean;
  maybe?: boolean;
  unanswered?: boolean;
}

/**
 * Sub-object: statistics on how many invited, answered, etc.
 */
export interface AppointmentStatistics {
  numInvited: number;
  numUnanswered: number;
  numPositive: number;
  numNegative: number;
  numMaybe: number;
  numRead: number;
}

/**
 * Sub-object: location details for the appointment.
 */
export interface AppointmentLocation {
  id: number;
  name: string;
  geo: boolean;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

/**
 * Sub-object: a "room" for the appointment (e.g., "Probelokal").
 */
export interface AppointmentRoom {
  id: number;
  name: string;
  description?: string | null;
  capacity?: number | null;
  address?: Address | null;
  ownerParentOrg?: AppointmentOrg;
  publicsite?: boolean;
  liMode?: any | null;
  notificationsEnabled?: boolean;
}

/**
 * Sub-object: an address (used by the room).
 */
export interface Address {
  id: number;
  countryIso3?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  streetline1?: string;
  streetline2?: string | null;
}

/**
 * Konzertmeister class providing:
 * 1) login()   - to authenticate and store the 'Authorization' cookie.
 * 2) getAppointments() - to fetch appointments (v3).
 */
export class Konzertmeister {
  private client: AxiosInstance;
  private cookie?: string; // Will store the 'Authorization' cookie after login

  constructor() {
    this.client = axios.create({
      baseURL: "https://rest.konzertmeister.app/",
      timeout: 60_000,
      // By default, Axios won't automatically apply cookies.
      // We'll manually set them below once we receive them from login.
    });
  }

  /**
   * Logs in to Konzertmeister (POST /api/v2/login).
   * The response includes an Authorization cookie, which we store and use
   * for subsequent calls (e.g., getAppointments).
   */
  public async login(payload: KonzertmeisterLoginRequest): Promise<boolean> {
    try {
      const response = await this.client.post("api/v2/login", payload, {
        validateStatus: () => true, // We'll handle errors ourselves
      });

      if (response.status !== 200) {
        console.error("Login failed:", response.data);
        return false;
      }

      // The server sets "Set-Cookie" in the response headers, e.g.:
      // Set-Cookie: Authorization=eyJhbGciOiJIUzUxMiJ9...; Path=/; HttpOnly
      const setCookieHeader = response.headers["set-cookie"];

      if (!setCookieHeader || !Array.isArray(setCookieHeader)) {
        console.error('No "Set-Cookie" header found in login response.');
        return false;
      }

      // Extract just the cookie key/value pairs (without path/httponly, etc.)
      // If multiple cookies returned, join them with '; '
      // Typically we only need the "Authorization" cookie.
      const cookieStr = setCookieHeader
        .map((cookieLine) => cookieLine.split(";")[0])
        .join("; ");

      this.cookie = cookieStr;
      // Include the cookie in subsequent requests
      this.client.defaults.headers.common["Cookie"] = this.cookie;

      return true;
    } catch (error: any) {
      console.error("Login error:", error.message);
      return false;
    }
  }

  /**
   * Fetches appointments with a POST to /api/v3/app/getpaged/<pageNumber>
   * Must be logged in first, so the Authorization cookie is set.
   * @param page The page number to fetch (0-based)
   * @param payload e.g. { dateMode: 'UPCOMING', filterStart: null, filterEnd: null, ...}
   * @returns An array of Appointment objects
   */
  public async getAppointments(
    page: number,
    payload: GetAppointmentsPayload
  ): Promise<Appointment[]> {
    if (!this.cookie) {
      throw new Error(
        "Not logged in. Please call login() before getAppointments()."
      );
    }

    try {
      const response = await this.client.post<Appointment[]>(
        `api/v3/app/getpaged/${page}`,
        payload
      );
      return response.data;
    } catch (error: any) {
      console.error("getAppointments error:", error.message);
      throw error;
    }
  }

  /**
   * Convenience method to fetch **all** appointments across all pages.
   * Continues calling getpaged/<page> until an empty array is returned.
   */
  public async getAllAppointments(
    payload: GetAppointmentsPayload
  ): Promise<Appointment[]> {
    if (!this.cookie) {
      throw new Error("Not logged in. Please call login() first.");
    }

    let allAppointments: Appointment[] = [];
    let page = 0;

    while (true) {
      const batch = await this.getAppointments(page, payload);
      if (batch.length === 0) {
        break; // no more data
      }
      allAppointments.push(...batch);
      page++;
    }

    return allAppointments;
  }
}
