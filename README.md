# City Tour

A web app for iPhone (add it to your Home Screen) that plans a personal city tour with Claude, then guides you through the day with a live map and podcast-style audio.

- **Tours grouped by city.** Every tour you create is saved as its own package on the home screen, grouped by city/region, so you can reopen any of them later.
- **Planning by chat.** The guide asks for the city (suggested from your location), your focus (food, architecture, history, or a bit of everything), how much time you have (it already knows the current time and weekday), how you get around, and any constraints or special requests. Claude then builds the plan.
- **Overview tab.** Your guide's opening speech, the day's themes, and a map with your live location. The route goes in the most efficient order: legs under 1 km are walked along real streets (dotted blue), and longer legs use public transport (dashed purple) or car/taxi (orange), whichever you chose.
- **Today's tour tab.** Starts with a one-minute audio welcome that walks you through the day and picks up what you told the guide. Then a timeline of every stop with photos, start times, and walking or transit directions (opens Apple Maps). Meal breaks sit where they fall in the day, each with top-rated restaurants near that point on the route.
- **Stop pages.** A photo gallery, a one-minute audio story, and each highlight with its own photo, "look for" tip, and audio clip. Also today's hours, tickets, and a fun fact.
- **Audio.** Narration is read in clear English over generated background music (a music intro, the voice with the music turned down underneath, and a short outro). It plays like a podcast, including lock-screen controls.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your keys (see below)
npm run dev                  # http://localhost:3000
```

Without an `ANTHROPIC_API_KEY` the app runs in **demo mode** with a sample Lisbon tour, so you can try every screen first.

### Keys

| Variable | Needed? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Claude plans the tour, writes each stop's guide and narration, and researches restaurants with web search. |
| `ELEVENLABS_API_KEY` *or* `OPENAI_API_KEY` | Recommended | Natural "podcast host" voice. Without either, the app uses the iPhone's built-in English voice, still over background music. |
| `GOOGLE_PLACES_API_KEY` | Optional | Real Google ratings, review counts, photos and opening hours for restaurant picks (enable *Places API (New)*). |
| `APP_PASSCODE` | Recommended when deployed | Only people with the passcode can use your deployment, so no one else can spend your API credits. |
| `TOUR_CLAUDE_MODEL` / `TOUR_CLAUDE_EFFORT` | Optional | Defaults: `claude-opus-5` / `medium`. |
| `NEXT_PUBLIC_TILE_URL` | Optional | Map tiles; defaults to OpenStreetMap. |

## Put it on your iPhone

1. Deploy it anywhere that runs Next.js over HTTPS (the iPhone only shares your location with HTTPS sites). The easiest option is [Vercel](https://vercel.com/new): import this repo and add the environment variables above.
2. Open the URL in **Safari** → **Share** → **Add to Home Screen**.
3. Launch it from the Home Screen and allow location access.

Tip: in a tour's **•••** menu, choose **Download audio for offline** before heading out if you expect weak signal.

## How it works

- `src/app/api/*`: server routes. They keep your API keys off the phone, call Claude with schema-validated JSON output, and stream progress while the plan is written.
- `src/lib/client/enrich.ts`: runs on the phone. It checks each stop's coordinates and finds photos on Wikipedia and Wikimedia Commons, orders the stops, gets real walking and driving routes from OpenStreetMap (OSRM), then fills in stop guides, the welcome audio and restaurant picks in the background.
- `src/lib/route.ts`: finds the shortest visiting order (exact for up to 9 stops, heuristic above that), applies the 1 km walking rule, and builds the schedule, placing breakfast, lunch, coffee and dinner by time of day.
- `src/lib/audio/*`: generated background music (Web Audio), mixed with the narration into one track that plays in a normal audio player.
- Tours and audio are stored on the phone (IndexedDB). Nothing is stored on the server.

## Development

```bash
npm test          # route/schedule unit tests
npm run typecheck
npm run mock      # fake Claude API on :4010, then:
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev
```
