# @discapedia/sdk

Typed, zero-dependency client for the [Discapedia](https://diswork.15.204.158.166.sslip.io) API.

```ts
import { DiscapediaClient } from "@discapedia/sdk";

const dp = new DiscapediaClient({ apiKey: process.env.DISCAPEDIA_API_KEY! });

// Listings (server owners)
const mine = await dp.servers.list();
const listing = await dp.servers.create({
  guildId: "700000000000000000",
  name: "Aether Lounge",
  tagline: "A 24/7 hangout that feels like home.",
  description: "Long-running social server with active voice channels around the clock.",
  inviteUrl: "https://discord.gg/aether",
  categorySlug: "social",
  tags: ["chill", "voice-chat", "active"],
});
await dp.servers.update(listing.server.id, { tagline: "Now with weekly game nights." });
const stats = await dp.servers.analytics(listing.server.id);

// Ad campaigns (advertisers)
const { campaign } = await dp.campaigns.create({
  name: "Aether — launch push",
  serverSlug: "aether-lounge",
  headline: "Find your people",
  body: "Join the most active social server on Discord.",
  budgetCents: 5000,
  bidCents: 60,
  placements: ["home", "search"],
});
await dp.campaigns.update(campaign.id, { status: "paused" });
const perf = await dp.campaigns.analytics(campaign.id);
const wallet = await dp.wallet.get();

// Public directory
const results = await dp.directory.search({ q: "anime", sort: "trending" });
```

## Auth

Create a key in your dashboard → **API keys**. Pass it as `apiKey`. Keys are scoped
(`servers:read/write`, `ads:read/write`, `reports:write`, `directory:read`, `account:read`)
and rate-limited (600 req / 5 min).

## No bump

There is intentionally **no `bump()`** method. Bumping is Discord-only with a 2-hour
cooldown to keep ranking fair — use the `/bump` slash command in your server.

## Errors

Failed calls throw `DiscapediaApiError` with `.code`, `.message`, `.status`.
