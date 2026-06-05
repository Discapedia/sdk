/**
 * Discapedia SDK — typed, zero-dependency client for the Discapedia REST API.
 *
 *   import { DiscapediaClient } from "@discapedia/sdk";
 *   const dp = new DiscapediaClient({ apiKey: process.env.DISCAPEDIA_API_KEY! });
 *   const servers = await dp.servers.list();
 *   const bots = await dp.bots.list();
 *
 * NOTE: there is intentionally no `bump()` and no `vote()` — bumping and voting
 * are deliberately web/Discord-only (cooldowns + anti-abuse), never via the API.
 */

export interface DiscapediaClientOptions {
  apiKey: string;
  /** Defaults to the hosted API. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class DiscapediaApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "DiscapediaApiError";
    this.code = code;
    this.status = status;
  }
}

export interface ListingInput {
  guildId: string;
  name: string;
  tagline: string;
  description: string;
  inviteUrl: string;
  categorySlug: string;
  tags: string[];
  language?: string;
  region?: string;
  nsfw?: boolean;
  bumpChannelId?: string;
}

export interface BotCommand {
  name: string;
  description: string;
}

export interface BotInput {
  /** Discord application (client) ID — used to build the OAuth2 invite. */
  clientId: string;
  name: string;
  tagline: string;
  description: string;
  prefix?: string;
  library?: string;
  /** Discord permissions integer, as a string. */
  permissions?: string;
  categorySlug: string;
  tags: string[];
  commands?: BotCommand[];
  supportUrl?: string;
  websiteUrl?: string;
  githubUrl?: string;
  serverCount?: number;
  nsfw?: boolean;
}

export interface CampaignInput {
  name: string;
  serverSlug?: string;
  objective?: "impressions" | "clicks" | "joins" | "growth";
  headline: string;
  body: string;
  cta?: string;
  destination?: string;
  budgetCents: number;
  bidCents: number;
  placements?: string[];
  categories?: string[];
  nsfw?: boolean;
}

export interface SearchParams {
  q?: string;
  category?: string;
  tag?: string;
  language?: string;
  minMembers?: number;
  minRating?: number;
  sort?: "bumped" | "newest" | "members" | "rating" | "trending" | "joined";
  nsfw?: "hide" | "show" | "only";
  page?: number;
  perPage?: number;
}

export interface BotSearchParams {
  q?: string;
  category?: string;
  tag?: string;
  library?: string;
  minRating?: number;
  sort?: "bumped" | "votes" | "trending" | "newest" | "servers" | "rating";
  nsfw?: "hide" | "show" | "only";
  limit?: number;
  offset?: number;
}

const DEFAULT_BASE = "https://discapedia.net";

export class DiscapediaClient {
  private apiKey: string;
  private baseUrl: string;
  private _fetch: typeof fetch;

  constructor(opts: DiscapediaClientOptions) {
    if (!opts.apiKey) throw new Error("DiscapediaClient: apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this._fetch = opts.fetch ?? fetch;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = json?.error ?? { code: "http_error", message: `HTTP ${res.status}` };
      throw new DiscapediaApiError(e.code, e.message, res.status);
    }
    return (json.meta ? { ...json.data, _meta: json.meta } : json.data) as T;
  }

  /** Current account + key scopes. */
  me = () => this.req<{ id: string; username: string | null; role: string; scopes: string[] }>("GET", "/me");

  servers = {
    list: () => this.req<unknown[]>("GET", "/servers"),
    get: (id: string) => this.req<unknown>("GET", `/servers/${id}`),
    create: (input: ListingInput) => this.req<unknown>("POST", "/servers", input),
    update: (id: string, patch: Partial<ListingInput>) => this.req<unknown>("PATCH", `/servers/${id}`, patch),
    analytics: (id: string) => this.req<unknown>("GET", `/servers/${id}/analytics`),
    reviews: (id: string) => this.req<unknown[]>("GET", `/servers/${id}/reviews`),
    respondToReview: (reviewId: string, response: string) => this.req<unknown>("POST", `/reviews/${reviewId}/respond`, { response }),
  };

  /** Discord bot listings (scopes: bots:read / bots:write). */
  bots = {
    list: () => this.req<unknown[]>("GET", "/bots"),
    get: (id: string) => this.req<unknown>("GET", `/bots/${id}`),
    create: (input: BotInput) => this.req<unknown>("POST", "/bots", input),
    update: (id: string, patch: Partial<BotInput>) => this.req<unknown>("PATCH", `/bots/${id}`, patch),
    /** top.gg-style stats push — update your bot's live server/shard count. */
    stats: (id: string, stats: { serverCount: number; shardCount?: number }) => this.req<unknown>("POST", `/bots/${id}/stats`, stats),
  };

  campaigns = {
    list: () => this.req<unknown[]>("GET", "/campaigns"),
    get: (id: string) => this.req<unknown>("GET", `/campaigns/${id}`),
    create: (input: CampaignInput) => this.req<unknown>("POST", "/campaigns", input),
    update: (id: string, patch: { status?: "active" | "paused"; budgetCents?: number; bidCents?: number }) => this.req<unknown>("PATCH", `/campaigns/${id}`, patch),
    analytics: (id: string) => this.req<unknown>("GET", `/campaigns/${id}/analytics`),
  };

  wallet = {
    get: () => this.req<{ balanceCents: number; transactions: unknown[] }>("GET", "/wallet"),
    topUp: (amountCents: number) => this.req<unknown>("POST", "/wallet/topup", { amountCents }),
  };

  reports = {
    create: (input: { objectType: string; objectId: string; reason: string; details?: string }) => this.req<unknown>("POST", "/reports", input),
  };

  directory = {
    search: (params: SearchParams = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
      return this.req<unknown[]>("GET", `/directory/search?${qs.toString()}`);
    },
    getServer: (slug: string) => this.req<unknown>("GET", `/directory/servers/${slug}`),
    searchBots: (params: BotSearchParams = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
      return this.req<unknown[]>("GET", `/directory/bots?${qs.toString()}`);
    },
    getBot: (slug: string) => this.req<unknown>("GET", `/directory/bots/${slug}`),
    meta: () => this.req<{ categories: unknown[]; tags: unknown[]; languages: string[] }>("GET", "/meta"),
  };
}

export default DiscapediaClient;
