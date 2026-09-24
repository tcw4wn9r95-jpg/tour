// Sample Lisbon content used when no ANTHROPIC_API_KEY is configured, so the
// app can be explored end to end (map, audio, restaurants) before setup.
import type { PlanOutput, StopDetailsOutput, StopGuideOutput } from "./schemas";
import type { MealRecommendation, Narration } from "./types";

export const DEMO_PLAN: PlanOutput = {
  title: "Lisbon: Explorers, Tiles & Custard Tarts",
  subtitle: "A day from the Age of Discovery to the old Moorish hills",
  city: "Lisbon",
  region: "Lisbon District",
  country: "Portugal",
  center: { lat: 38.7005, lng: -9.1760 },
  startTime: null,
  longLegMode: "transit",
  intro: {
    headline: "Bom dia, and welcome to Lisbon — the city that sent ships to the edge of the known world.",
    welcome: [
      "Today we follow Lisbon's great story: the moment a small kingdom on the Atlantic edge of Europe became the launch pad for the Age of Discovery, and how that wealth and ambition were carved into stone.",
      "We begin in Belém, where the caravels departed and where King Manuel I built monuments in a style so exuberant it carries his name. Then we ride along the river to the old heart of the city, climbing the lanes of Alfama to finish with the whole city at our feet.",
      "And because no one should see Lisbon on an empty stomach, we will taste the most famous custard tart in the world at the bakery that has guarded its recipe since 1837.",
    ],
    themes: ["Age of Discovery", "Manueline architecture", "Pastry pilgrimage", "Moorish Alfama"],
    whatToExpect: [
      "Mostly flat walking in Belém, then one tram or bus ride east along the river",
      "A gentle climb at the end — take the 28 tram if your legs protest",
      "Lunch near Belém, with top-rated spots suggested in Today's tour",
      "Queues at the monastery: the line moves faster after 1 pm",
    ],
  },
  tips: [
    "Buy a Viva Viagem card for trams, buses and the metro — tap in on every ride.",
    "Wear shoes with grip: Lisbon's limestone pavements are beautiful and slippery.",
    "Churches ask for covered shoulders; carry a light scarf.",
    "Tram 28 is a pickpocket hotspot — keep your phone in a front pocket.",
  ],
  stops: [
    {
      name: "Jerónimos Monastery",
      wikipediaTitle: "Jerónimos Monastery",
      lat: 38.6979,
      lng: -9.2065,
      category: "architecture",
      landmark: true,
      durationMin: 75,
      summary: "A UNESCO-listed masterpiece of Manueline architecture, funded by the spice trade and begun in 1501. It holds the tomb of Vasco da Gama.",
      whyForYou: "It is the purest expression of how the Age of Discovery was turned into architecture.",
      openingNote: "Open 9:30–18:00, closed Mondays; cloister ticket required, church free.",
      anchor: "none",
    },
    {
      name: "Pastéis de Belém",
      wikipediaTitle: "Pastéis de Belém",
      lat: 38.6975,
      lng: -9.2032,
      category: "food",
      landmark: false,
      durationMin: 30,
      summary: "The bakery that has made pastéis de nata from the monastery's secret recipe since 1837. Sit inside in the blue-tiled rooms to skip the takeaway queue.",
      whyForYou: "A delicious link between the monks next door and Lisbon's sweet tooth.",
      openingNote: "Open daily 8:00–23:00.",
      anchor: "none",
    },
    {
      name: "Padrão dos Descobrimentos",
      wikipediaTitle: "Padrão dos Descobrimentos",
      lat: 38.6936,
      lng: -9.2057,
      category: "history",
      landmark: true,
      durationMin: 30,
      summary: "A 52-metre monument shaped like a caravel's prow, lined with 33 figures of the Age of Discovery led by Henry the Navigator.",
      whyForYou: "It puts faces on the explorers whose voyages paid for everything you see in Belém.",
      openingNote: "Rooftop open 10:00–19:00; the monument itself is always visible.",
      anchor: "none",
    },
    {
      name: "Belém Tower",
      wikipediaTitle: "Belém Tower",
      lat: 38.6916,
      lng: -9.2160,
      category: "architecture",
      landmark: true,
      durationMin: 40,
      summary: "A fortified tower built in the 1510s to guard the mouth of the Tagus, decorated with ropes, armillary spheres and a famous stone rhinoceros.",
      whyForYou: "Lisbon's icon and the last sight of home for sailors heading out to sea.",
      openingNote: "Open 10:00–18:30, closed Mondays; the exterior is always visible.",
      anchor: "none",
    },
    {
      name: "Praça do Comércio",
      wikipediaTitle: "Praça do Comércio",
      lat: 38.7076,
      lng: -9.1365,
      category: "history",
      landmark: true,
      durationMin: 30,
      summary: "The grand riverside square where the royal palace stood until the 1755 earthquake, rebuilt as a symbol of Enlightenment Lisbon.",
      whyForYou: "It shows how Lisbon rose again after the catastrophe that ended its golden age.",
      openingNote: "Always open.",
      anchor: "none",
    },
    {
      name: "Lisbon Cathedral",
      wikipediaTitle: "Lisbon Cathedral",
      lat: 38.7099,
      lng: -9.1335,
      category: "religious",
      landmark: true,
      durationMin: 30,
      summary: "Lisbon's fortress-like Romanesque cathedral, founded in 1147 on the site of a mosque after the Christian reconquest.",
      whyForYou: "It is the oldest layer of the city's story — before any ship set sail.",
      openingNote: "Open 10:00–18:00; closed during Mass.",
      anchor: "none",
    },
    {
      name: "Miradouro de Santa Luzia",
      wikipediaTitle: "Miradouro de Santa Luzia",
      lat: 38.7118,
      lng: -9.1301,
      category: "viewpoint",
      landmark: true,
      durationMin: 30,
      summary: "A bougainvillea-covered terrace with azulejo panels and sweeping views over Alfama's rooftops to the river.",
      whyForYou: "The perfect place to end the day, looking out at the river the explorers sailed.",
      openingNote: "Always open.",
      anchor: "last",
    },
  ],
};

type Details = StopGuideOutput;

const DETAILS: Record<string, Details> = {
  "Jerónimos Monastery": {
    overview: [
      "King Manuel I began the monastery in 1501 to give thanks for Vasco da Gama's voyage to India, and paid for it with a five percent tax on the spice trade. The Hieronymite monks who lived here prayed for the souls of sailors — and, it is said, baked the first custard tarts.",
      "Look closely and you'll see the sea everywhere: stone ropes, coral, seaweed and armillary spheres, the navigation instrument Manuel adopted as his emblem.",
    ],
    features: [
      { title: "The South Portal", description: "A 32-metre stone lace of saints, angels and canopies by João de Castilho. Henry the Navigator stands on the central pillar.", lookFor: "Henry the Navigator in armour on the pillar between the two doors.", imageSearch: "Jerónimos Monastery south portal" },
      { title: "The Two-Storey Cloister", description: "One of the most beautiful cloisters in Europe, its arches encrusted with maritime motifs and royal symbols.", lookFor: "Twisted rope columns and tiny carved sea creatures on the upper gallery.", imageSearch: "Jerónimos Monastery cloister" },
      { title: "Tomb of Vasco da Gama", description: "The explorer who reached India by sea in 1498 lies just inside the church, opposite the poet Luís de Camões who immortalised him.", lookFor: "The carved caravel on the side of the tomb.", imageSearch: "Tomb of Vasco da Gama Jerónimos" },
    ],
    practical: { hours: "9:30–18:00, closed Mondays", tickets: "Church free; cloister about €18", tip: "Enter the church first — it has a separate, much shorter line." },
    funFact: "The monastery survived the 1755 earthquake almost untouched while much of Lisbon fell.",
  },
  "Pastéis de Belém": {
    overview: [
      "When the monasteries were closed in 1834, the monks sold their custard tart recipe to a sugar refiner, whose family opened this bakery in 1837. The recipe is still made in a locked room known as the secret workshop.",
      "Order at least two, warm from the oven, and dust them with cinnamon and icing sugar from the shakers on the table.",
    ],
    features: [
      { title: "The Secret Workshop", description: "Only a handful of master bakers know the recipe, and they swear an oath of secrecy.", lookFor: "The glass window where you can watch the pastry being pressed into tins.", imageSearch: "Pastéis de Belém bakery" },
      { title: "Azulejo Dining Rooms", description: "A maze of blue-and-white tiled rooms seats hundreds — most visitors never make it past the takeaway counter.", lookFor: "The tiled panels showing old Belém.", imageSearch: "Pastéis de Belém interior tiles" },
      { title: "The Perfect Tart", description: "Flaky, blistered, caramelised on top and just set in the middle — about 20,000 are sold on a busy day.", lookFor: "The dark caramel spots on top, the sign of a proper oven.", imageSearch: "Pastel de nata Belém" },
    ],
    practical: { hours: "8:00–23:00 daily", tickets: "About €1.50 per tart", tip: "Walk past the takeaway queue and sit inside — the service is quick." },
    funFact: "Only this bakery may call its tarts 'pastéis de Belém'; everywhere else they're 'pastéis de nata'.",
  },
  "Padrão dos Descobrimentos": {
    overview: [
      "Built in stone in 1960 for the 500th anniversary of Henry the Navigator's death, the monument rises like a ship's prow over the river.",
      "In front, a giant compass-rose mosaic holds a world map marking the dates of Portuguese voyages.",
    ],
    features: [
      { title: "The Figures on the Prow", description: "Thirty-three explorers, cartographers, monks and a queen follow Henry, who holds a small caravel.", lookFor: "Vasco da Gama and Ferdinand Magellan just behind Henry.", imageSearch: "Padrão dos Descobrimentos figures" },
      { title: "The Compass Rose Map", description: "A gift from South Africa, this marble wind rose maps the routes and dates of the discoveries.", lookFor: "The date 1500 next to Brazil.", imageSearch: "Padrão dos Descobrimentos compass rose" },
      { title: "Rooftop Viewpoint", description: "A lift climbs to the top for views of the monastery, the tower and the 25 de Abril bridge.", lookFor: "The Cristo Rei statue across the river.", imageSearch: "Padrão dos Descobrimentos view" },
    ],
    practical: { hours: "10:00–19:00", tickets: "Rooftop about €10", tip: "The map mosaic is free and best seen from the top." },
    funFact: "The first version was a temporary plaster monument built for a 1940 world exhibition.",
  },
  "Belém Tower": {
    overview: [
      "Built between 1514 and 1520 as part of the river's defences, the tower once stood on a small island in the Tagus; the 1755 earthquake shifted the river and it now sits by the shore.",
      "It is the most complete expression of Manueline decoration applied to military architecture.",
    ],
    features: [
      { title: "The Rhinoceros", description: "Below a watchtower is a stone rhinoceros, thought to be inspired by the animal sent to King Manuel from India in 1515.", lookFor: "The rhino's head beneath the north-west turret.", imageSearch: "Belém Tower rhinoceros" },
      { title: "Moorish Watchtowers", description: "Ribbed domes on the turrets show the influence of North African architecture.", lookFor: "The domed sentry boxes on every corner.", imageSearch: "Belém Tower watchtower" },
      { title: "The Bastion", description: "The low hexagonal bastion held 17 cannons aimed across the river.", lookFor: "The cannon openings just above the waterline.", imageSearch: "Belém Tower bastion" },
    ],
    practical: { hours: "10:00–18:30, closed Mondays", tickets: "About €10", tip: "The best photo is from the small beach to the east." },
    funFact: "The rhinoceros was later sent as a gift to the Pope but drowned when the ship sank.",
  },
  "Praça do Comércio": {
    overview: [
      "For two centuries the Ribeira Palace stood here, until the earthquake and tsunami of 1 November 1755 destroyed it along with its library.",
      "The Marquis of Pombal rebuilt the square on an open, regular plan as a symbol of a modern Lisbon.",
    ],
    features: [
      { title: "Rua Augusta Arch", description: "The triumphal arch completed in 1873 celebrates the city's rebirth, crowned by Glory rewarding Valour and Genius.", lookFor: "Vasco da Gama and Pombal among the statues.", imageSearch: "Rua Augusta Arch" },
      { title: "Statue of King José I", description: "The bronze equestrian statue of the king who reigned during the earthquake.", lookFor: "The horse trampling snakes.", imageSearch: "Statue of King José I Lisbon" },
      { title: "Cais das Colunas", description: "Marble steps between two columns once welcomed kings and ambassadors arriving by river.", lookFor: "The two columns rising from the water at high tide.", imageSearch: "Cais das Colunas" },
    ],
    practical: { hours: "Always open", tickets: "Free; arch viewpoint about €5", tip: "Climb the arch for a straight view up Rua Augusta." },
    funFact: "Lisbon locals still call it Terreiro do Paço, 'Palace Yard', for the palace that vanished in 1755.",
  },
  "Lisbon Cathedral": {
    overview: [
      "Founded in 1147 by Afonso Henriques after he took Lisbon from the Moors, the Sé looks more like a castle than a church.",
      "Earthquakes damaged it many times, so you'll find Romanesque, Gothic and Baroque layers side by side.",
    ],
    features: [
      { title: "Twin Towers and Rose Window", description: "The crenellated towers reveal the cathedral's role as a fortress.", lookFor: "The rose window between the towers.", imageSearch: "Lisbon Cathedral facade" },
      { title: "Gothic Cloister Excavations", description: "Archaeologists found Roman streets and Moorish houses beneath the cloister.", lookFor: "The Roman road running below the walkway.", imageSearch: "Lisbon Cathedral cloister excavation" },
      { title: "Baptismal Font of St Anthony", description: "Lisbon's patron saint was baptised here in 1195.", lookFor: "The tiled panel near the entrance.", imageSearch: "Lisbon Cathedral font" },
    ],
    practical: { hours: "10:00–18:00", tickets: "Church free; cloister about €5", tip: "Tram 28 rattles right past the facade — a classic photo." },
    funFact: "Legend says ravens escorted the body of St Vincent to Lisbon, and ravens were kept at the cathedral for centuries.",
  },
  "Miradouro de Santa Luzia": {
    overview: [
      "This terrace beside the little church of Santa Luzia looks over the tiled roofs of Alfama to the Tagus.",
      "Tile panels show Praça do Comércio before the earthquake and the Christian siege of Lisbon in 1147.",
    ],
    features: [
      { title: "Azulejo Panels", description: "Two blue-and-white panels on the church wall show the city's history.", lookFor: "The pre-1755 Ribeira Palace in the panel.", imageSearch: "Miradouro de Santa Luzia azulejo" },
      { title: "The Pergola", description: "A vine- and bougainvillea-covered pergola frames the view.", lookFor: "The white columns framing the river.", imageSearch: "Miradouro de Santa Luzia pergola" },
      { title: "Alfama Rooftops", description: "Alfama survived the earthquake better than most of Lisbon, keeping its Moorish tangle of lanes.", lookFor: "The white dome of the National Pantheon.", imageSearch: "Alfama rooftops Santa Luzia" },
    ],
    practical: { hours: "Always open", tickets: "Free", tip: "Arrive before sunset and stay for the golden light." },
    funFact: "Alfama's name comes from the Arabic al-hamma, meaning hot springs or baths.",
  },
};

export function demoDetails(name: string): StopDetailsOutput {
  const d = DETAILS[name] ?? DETAILS["Jerónimos Monastery"];
  return {
    ...d,
    narration: {
      title: `The story of ${name}`,
      mood: name.includes("Past") ? "lively" : "majestic",
      script: `Welcome to ${name}. ${d.overview.join(" ")} Take a moment to look around. ${d.funFact} Enjoy it.`,
    },
    features: d.features.map((f) => ({
      ...f,
      narration: { title: f.title, mood: "warm", script: `${f.title}. ${f.description} Look for this: ${f.lookFor}` },
    })),
  };
}

export function demoTodayIntro(stopNames: string[]): Narration {
  return {
    title: "Your day in Lisbon",
    mood: "warm",
    script:
      `Good morning, and welcome to your day in Lisbon. Today is all about the Age of Discovery, and the city it built. ` +
      `We'll start at ${stopNames[0]}, and from there we'll wander through ${stopNames.slice(1, -1).join(", ")}. ` +
      `Along the way you'll taste the world's most famous custard tart, stand where the caravels set sail, and ride along the river to the old town. ` +
      `We'll stop for lunch when you're hungry, and we'll finish at ${stopNames[stopNames.length - 1]} with the whole city at your feet. ` +
      `Comfortable shoes on? Then let's go.`,
  };
}

export function demoRestaurants(slots: { slotId: string; kind: MealRecommendation["kind"] }[]): MealRecommendation[] {
  return slots.map((s) => ({
    slotId: s.slotId,
    kind: s.kind,
    source: "claude",
    note: "Sample picks shown in demo mode.",
    restaurants: [
      { name: "Nunes Real Marisqueira", cuisine: "Seafood", rating: 4.5, reviewCount: 6000, ratingSource: "Google", priceLevel: "$$$", address: "Rua Bartolomeu Dias 172E, Belém", lat: 38.6964, lng: -9.2071, distanceM: 200, why: "Superb grilled fish and the famous prawn toast.", mapsUrl: "https://maps.apple.com/?q=Nunes+Real+Marisqueira+Lisbon" },
      { name: "Darwin's Café", cuisine: "Portuguese / Mediterranean", rating: 4.4, reviewCount: 3000, ratingSource: "Google", priceLevel: "$$", address: "Av. Brasília, Champalimaud Centre", lat: 38.6934, lng: -9.2211, distanceM: 600, why: "River views from the terrace and lovely risottos.", mapsUrl: "https://maps.apple.com/?q=Darwin%27s+Cafe+Lisbon" },
      { name: "Enoteca de Belém", cuisine: "Wine bar / Portuguese", rating: 4.6, reviewCount: 1500, ratingSource: "Tripadvisor", priceLevel: "$$", address: "Travessa do Marta Pinto 10, Belém", lat: 38.6972, lng: -9.2007, distanceM: 300, why: "Portuguese wines by the glass with slow-cooked pork cheeks.", mapsUrl: "https://maps.apple.com/?q=Enoteca+de+Belem" },
    ],
  }));
}
