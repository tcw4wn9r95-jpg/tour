# City Tour

A web app for iPhone (add it to your Home Screen) that plans a personal city tour with Claude, then guides you through the day with a live map and podcast-style audio.

- **Tours grouped by city.** Every tour you create is saved as its own package on the home screen, grouped by city/region, so you can reopen any of them later.
- **Planning by chat.** The guide asks for the city (suggested from your location), your focus (food, architecture, history, or a bit of everything), how much time you have (it already knows the current time and weekday), how you get around, and any constraints or special requests. Claude then builds the plan.
- **Overview tab.** Your guide's opening speech, the day's themes, and a map with your live location. Buttons switch between the whole route and a street-level view of the way to your next stop; the map refits when you go full screen. The route goes in the most efficient order: legs under 1 km are walked along real streets (dotted blue), and longer legs use public transport (dashed purple) or car/taxi (orange), whichever you chose.
- **Today's tour tab.** Starts with a one-minute audio welcome that walks you through the day and picks up what you told the guide. Then a timeline of every stop with photos, start times, and walking or transit directions (opens Apple Maps). Meal breaks sit where they fall in the day, each with top-rated restaurants near that point on the route.
- **Off the tourist script.** After planning, Claude searches travel forums and communities (Reddit, Tripadvisor forums, Atlas Obscura, local blogs) for quirky, overlooked things along your route: hidden details, legends, local habits, street art, secret viewpoints. They appear between stops in Today's tour ("On the way to…"), on stop pages and as ✨ pins on the map. Each one links to the forum post it came from, and anything citing a page the search didn't actually return is dropped.
- **Stop pages.** A photo gallery, a one-minute audio story, and each highlight with its own photo, "look for" tip, and audio clip. Also today's hours, tickets, and a fun fact. Audio is recorded for **major landmarks only**; food stops (restaurants, cafés, bakeries, markets) get a written guide with what to try.
- **Audio.** Narration is read in clear English over generated background music (a music intro, the voice with the music turned down underneath, and a short outro). It plays like a podcast, including lock-screen controls.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your keys (see below)
npm run dev                  # http://localhost:3000
```

Without an `ANTHROPIC_API_KEY` the app runs in **demo mode** with a sample Lisbon tour, so you can try every screen first.

### Keys

On a server these are environment variables. In the GitHub Pages version you paste the same keys into the app's Settings screen instead.

| Variable | Needed? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Claude plans the tour, writes each stop's guide and narration, and researches restaurants with web search. |
| `ELEVENLABS_API_KEY` *or* `OPENAI_API_KEY` | Recommended | Natural "podcast host" voice. Without either, the app uses the iPhone's built-in English voice, still over background music. ElevenLabs is kept within its free tier by default (see below). |
| `GOOGLE_PLACES_API_KEY` | Optional | Real Google ratings, review counts, photos and opening hours for restaurant picks (enable *Places API (New)*). |
| `APP_PASSCODE` | Recommended when deployed | Only people with the passcode can use your deployment, so no one else can spend your API credits. |
| `TOUR_CLAUDE_MODEL` / `TOUR_CLAUDE_EFFORT` | Optional | Defaults: `claude-opus-5` / `medium`. |
| `NEXT_PUBLIC_TILE_URL` | Optional | Map tiles; defaults to OpenStreetMap. |

### Staying within the ElevenLabs free tier

The free ElevenLabs plan gives 10,000 credits a month. That's less than one tour with every highlight recorded, so by default the app:

- uses the **Flash v2.5** voice, which costs half a credit per character (about 20 minutes of narration a month);
- checks your live usage before each recording and caps it at 10,000 credits, even if your account allows more;
- records audio only for major landmarks, never for food stops;
- keeps the last 2,500 credits for the main one-minute stories (today's welcome and each landmark), so short highlight clips switch to the iPhone voice first;
- switches to the iPhone voice, still with background music, once the month's credits are used up, and tells you when they reset;
- saves every recording on the phone, so replays and offline listening cost nothing. **Download audio for offline** fills the budget with main stories first.

Settings shows the credits used this month. To use your whole plan with the richer Multilingual v2 voice, turn off **Stay within the free tier** in Settings (GitHub Pages) or set `ELEVENLABS_FREE_TIER=false` (server). Usage tracking needs an ElevenLabs key with the **User → Read** permission; unrestricted keys have it. Free-plan narration is for personal use and credits ElevenLabs, which the player shows.

## Put it on your iPhone

There are two ways to host it. Either way it needs HTTPS, because the iPhone only shares your location with secure sites.

### Option A: GitHub Pages (free, no server)

1. In this repo on GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Merge this branch into `main` (or run the **Deploy to GitHub Pages** workflow from the Actions tab). The workflow builds a static copy of the app and publishes it at `https://<your-user>.github.io/<repo>/`.
3. Open that address in **Safari** → **Share** → **Add to Home Screen**, then launch it from the Home Screen.
4. Tap the ⚙️ button and paste your keys (Anthropic is required, the others are optional). The app checks the Anthropic key before saving it.

GitHub Pages only serves static files, so in this version the app calls Anthropic, ElevenLabs/OpenAI and Google directly from your phone. Your keys are stored only in that phone's browser storage and are never added to the repo or the website. Anyone who uses that phone's browser can use them, so set a monthly spending limit in each provider's console. For Google, restrict the key to your `github.io` address.

### Option B: a Node.js host (e.g. Vercel)

1. Import this repo at [vercel.com/new](https://vercel.com/new) and add the environment variables from the table above.
2. Open the URL in **Safari** → **Share** → **Add to Home Screen**.

Here the keys live on the server and never reach the phone. Set `APP_PASSCODE` so only you can use the deployment.

Tip: in either version, choose **Download audio for offline** from a tour's **•••** menu before heading out if you expect weak signal.

## How it works

- `src/lib/guide/*`: the guide itself. Claude prompts with schema-validated JSON output, restaurant research, and the voice services. On a server, the API routes in `src/app/api/*` run it with the server's keys. The GitHub Pages build (`NEXT_PUBLIC_STATIC_EXPORT=1`) has no server, so it runs the same code in the browser with the keys saved in Settings.
- `src/lib/client/enrich.ts`: runs on the phone. It checks each stop's coordinates and finds photos on Wikipedia and Wikimedia Commons, orders the stops, gets real walking and driving routes from OpenStreetMap (OSRM), then fills in stop guides, the welcome audio and restaurant picks in the background.
- `src/lib/route.ts`: finds the shortest visiting order (exact for up to 9 stops, heuristic above that), applies the 1 km walking rule, and builds the schedule, placing breakfast, lunch, coffee and dinner by time of day.
- `src/lib/audio/*`: generated background music (Web Audio), mixed with the narration into one track that plays in a normal audio player.
- Tours and audio are stored on the phone (IndexedDB). Nothing is stored on the server.

## Development

```bash
npm test          # route/schedule unit tests
npm run typecheck
npm run build:pages   # static GitHub Pages build into out/ (set NEXT_PUBLIC_BASE_PATH=/<repo> to test a sub-path)
npm run mock      # fake Claude API on :4010, then:
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev
```
