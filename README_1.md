# Feral Panel (Vercel only)

Everything runs on Vercel - no other server. (Vercel can't hold WebSocket connections, so the hub and the website
talk to the API with short HTTPS requests every few seconds instead.)

- `public/index.html`  dashboard (enter your key, see stats / inventory / status, flip toggles)
- `api/`, `lib/`       the backend (Vercel serverless functions)
- `hub/FeralHub.lua`   the hub with the Remote Panel built in

## Setup
1. Push this folder to GitHub, then on Vercel: **Add New > Project > import the repo > Deploy**.
2. In the Vercel project: **Storage > Create Database > Upstash Redis** (free plan), connect it to the project, then **Redeploy** once.
3. In `hub/FeralHub.lua` set `PANEL_URL` (top of the REMOTE PANEL block) to `https://your-project.vercel.app`.

## How it works
- No keys are generated. A user makes up their own key (10+ characters, no spaces), types it in the hub
  (Config/Ui > Remote Panel > Connect) and then enters the same key on the website.
- The hub never saves the key; it has to be typed every time.
- A key can only be used by one account at a time. If someone else types a key that is already connected, the hub shows
  "rejected: this key is already in use by another account". A key frees up ~45s after its hub stops syncing.
- Keys act as passwords for the dashboard, so tell users to pick long random ones.
- The hub syncs every 15s, or every 3s while that key's dashboard is open.
- Vercel Hobby allows about 1M function calls a month, roughly 4-5 accounts online around the clock.
