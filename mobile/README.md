# AEGIS Field

The offline-first responder app for boat, ambulance and ground rescue crews —
the Flutter half of AEGIS named in [`PRODUCT.md`](../PRODUCT.md)'s roadmap and
argued for at length in the project dossier's *Frontend Decision: Next.js vs.
Flutter* section.

This app does **not** re-implement the five-stage AI pipeline. That stays on
the command-centre web console (`../src`), where a desk-bound duty officer
reasons over the 100-zone grid, drone survey and resource decision, and signs
both approval gates. This app is what a crew in the field is actually handed:
**alerts, an order, a route, and a way to say "received."**

## What it does

- **Receives movement orders and alerts** from the command centre — new
  orders, amendments, recalls, hazard notices, stand-downs — and wakes the
  phone for anything marked immediate, natively, with no PWA background-sync
  gamble.
- **Works fully offline.** Every order and alert lands in an on-device store
  (Hive) the instant it arrives. Reading one, playing its audio, and
  acknowledging it all work with the radio off. An acknowledgement is recorded
  locally the moment the crew presses the stamp and queued for the command
  centre; it sends the moment a connection reappears.
- **Reads every order aloud, in English or Hindi**, on-device — no gTTS
  server round-trip, so it works exactly where the dossier says the network
  won't: mid-current, in a moving boat, one-handed.
- **Shows the route as a schematic zone grid** — the same honest picture the
  command centre itself draws (`ZoneGrid.js` on the web side, not a Leaflet or
  Mapbox map that would imply street-level precision this synthetic incident
  doesn't have). Severity bands at the cell edge, roads as the abstract paths
  they are, bridges marked by status, the assigned route traced zone to zone.
  Live GPS overlays as "which zone am I nearest to," clearly labelled as an
  approximation, not turn-by-turn navigation.
- **Signs an acknowledgement, not a tap.** The stamp is a press-and-hold, the
  same load-bearing-UI argument the console makes for its own approval gates.

## What it deliberately does not do

- No vision analysis, zone prioritisation, drone simulation, resource
  reasoning, or routing computation. All of that already happened on the
  console before an order ever reaches this app; this app is a receiver, not
  a second brain.
- No live SMS/WhatsApp transmission — same as the console, dispatch delivery
  is simulated and says so on screen.
- No real street-level navigation. There is no real road geometry behind this
  synthetic incident to route on; see the Route Grid section above.

## Where the demo data comes from

`assets/data/terrain.json` and `assets/data/demo_dispatch.json` are not
hand-written fixtures. They are the literal output of the console's own
engines (`src/lib/aegis/incident.js`, `severity.js`, `resources.js`,
`routing.js`), run once and captured — the same 100-zone Darbhanga district
picture and the same dispatch order a duty officer would see after clearing
both approval gates on `/operations`. Regenerate them from the console source
whenever those engines change; do not edit the JSON by hand.

## Running it

Needs the Flutter SDK (this repo's dev machine does not have one installed —
install it, then run the below). Android or iOS device/emulator, or Chrome
for a quick look at layout (native TTS/notifications/GPS won't function on
web).

```bash
cd mobile
flutter create --platforms=android,ios .   # first time only — adds the native
                                            # android/ ios/ runners this repo
                                            # doesn't commit (see .gitignore);
                                            # safe to run against an existing
                                            # lib/ and pubspec.yaml
flutter pub get
flutter run
```

```bash
flutter test      # model + parsing tests against the bundled demo data
flutter analyze
```

On first launch, with no server configured, the app seeds itself from the
bundled demo order so the inbox isn't empty — a real deployment ships with
that seed already marked consumed.

## Connecting to a live command centre

Settings → Command centre link. Point it at a running AEGIS console
(`npm run dev` in the repo root, or a deployed URL). The app polls
`GET /api/zones` for terrain and `GET /api/pipeline` for a named run's
dispatch order — both already exist and, in `/api/zones`'s own source comment,
were built with this app in mind. Acknowledgements POST to
`/api/field/ack`, a narrow endpoint a field deployment adds beside the
console's existing (deliberately read-only) `/api/register` — this app never
requires that endpoint to exist: every unreachable call just requeues.

## Architecture

```
lib/
  theme/       tokens.dart, typography.dart, theme.dart
               The console's palette and Archivo/Archivo Narrow/Azeret Mono
               ramp, carried over token for token, scaled up for arm's-length
               reading. Two grounds, exactly as on the console.
  models/      dispatch.dart, alert.dart, terrain.dart
               Mirror the console's own JSON shapes field for field.
  data/        local_store.dart (Hive), repository.dart (the app's one
               ChangeNotifier — every screen reads and writes through it)
  services/    aegis_api.dart      the (optional) command-centre link
               sync_service.dart  drains the ack outbox whenever reachable
               voice_service.dart on-device bilingual TTS
               notification_service.dart  native alert delivery
               location_service.dart      GPS -> nearest zone
  screens/     home_screen.dart (inbox), order_screen.dart (the order),
               settings_screen.dart
  widgets/     ruled.dart (the ruled-row grammar, ported from the console's
               card-free layout), stamp_button.dart (press-and-hold ack),
               route_grid.dart (the schematic zone map)
```

## Design

Same creative north star as the console — "The Signed Order" — read at arm's
length instead of desk distance. See [`../DESIGN.md`](../DESIGN.md) for the
full system; this app's `lib/theme/` is a direct, documented port of it.
