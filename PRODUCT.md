# PRODUCT.md — AEGIS

> Product truth for the AEGIS command centre. Visual decisions live in DESIGN.md.

## What it is

**AEGIS** — *Automated Emergency Guidance & Intelligence Support*.

A disaster-response decision-support system for Indian district and state
disaster-management authorities. It reads satellite or drone imagery of a
disaster-hit area, splits it into a 100-zone grid, scores each zone's flood and
damage severity, flies drones to verify the worst zones, recommends the right
mix of boats / ambulances / rescue teams, and plans the safest route to get
them there — with a human authority approving both the resource plan and the
route before anything is dispatched.

Built for **Smart India Hackathon 2026**, Problem Statement **26206**
(AICTE / MIC — Student Innovation, Disaster Management), by **Team Sinchan**.

## The unique mechanism, in one sentence

AEGIS turns a raw disaster image into a signed, auditable dispatch order in
five stages, and refuses to act on any of them without a named human pressing
approve.

## Who uses it, and where

**Primary — District Emergency Operations Centre (DEOC) duty officer.**
Sits at a desk in a control room during an active incident, often for a 12-hour
shift, on a shared low-spec office machine with a large screen. Fluorescent
overhead light by day; the room dims at night and screens are projected onto a
wall for the incident commander's briefing. They are not a data scientist. They
are legally accountable for every resource they commit. They are being asked
questions out loud while they work.

**Secondary — Incident Commander / District Magistrate.** Walks up mid-incident,
needs the situation in ten seconds, signs off on the plan, walks away.

**Tertiary — Field responder** (boat, ambulance, ground team). Receives the
output, not the interface. Reached by SMS / WhatsApp / audio, because flood
zones have patchy 2G. A native field app is deliberately future work, not part
of this build.

## The job, phase by phase

PS 26206 covers *before, during and after* a disaster. AEGIS covers all three
off one zone-severity spine:

- **BEFORE — Preparedness.** Historical zone severity plus rainfall and
  river-level forecasts build a vulnerability index per zone, so districts can
  pre-position resources before a flood peaks. A retrieval-grounded assistant
  answers policy and SOP questions against NDMA/SDMA doctrine with citations.
- **DURING — Response.** The five-stage pipeline: vision analysis → zone
  prioritisation → drone intelligence → AI resource decision → safe routing and
  dispatch. Two human approval gates.
- **AFTER — Recovery.** The same severity data becomes damage documentation for
  relief and insurance claims, a rebuild-priority list, and an after-action
  report on which routes failed and which resources were mis-allocated — which
  feeds back into the *before* layer.

## The five stages

| # | Stage | What it does |
|---|---|---|
| 1 | Vision Analysis | Flood segmentation + structural damage detection over the imagery |
| 2 | Zone Prioritisation | 10×10 grid; flood score, damage score, combined severity per zone; ranked |
| 3 | Drone Intelligence | Targeted drone passes to top-priority zones; counts people, animals, vehicles |
| 4 | AI Resource Decision | Reasons over severity + victim counts → recommended boats / ambulances / teams · **APPROVAL GATE 1** |
| 5 | Safe Routing & Dispatch | Flood-aware shortest path avoiding blocked roads → multilingual field instructions · **APPROVAL GATE 2** |

## Non-negotiables

1. **The human decides.** AEGIS recommends. A named officer approves. Nothing
   reaches a field team without a signature. Both gates are load-bearing UI, not
   a confirm dialog.
2. **Every score is inspectable.** Severity is a transparent weighted formula,
   never a black-box number. The officer can open any zone and see the arithmetic
   that ranked it.
3. **Everything is logged.** Every AI recommendation, every human approval,
   every override, with actor and timestamp. Post-incident review is a legal
   requirement, not a feature.
4. **Graceful degradation.** No drones → satellite-only still works. No network →
   the pipeline still runs on cached/local reasoning and says so. No LLM key →
   a deterministic rule engine produces the same shape of answer, clearly
   labelled. The demo must never depend on the venue wifi.
5. **Decision-support, not replacement.** AEGIS sits alongside NDMA/SDMA
   workflows. It never claims authority it does not have.
6. **Honest build status.** Working parts and simulated parts are labelled in
   the interface itself. Drone flight is a simulation and says so on screen.

## Constraints

- Next.js 16 App Router, React 19, Tailwind v4, JavaScript (no TypeScript).
- Runs entirely in one deployable app — no separate Python service required for
  the demo. Deployable to Vercel for a live judge URL.
- No native dependencies (no better-sqlite3): persistence is a file/in-memory
  store.
- Must be legible on a projector in a bright room *and* on a dimmed control-room
  screen at 03:00. Both are real scenes; the interface must serve both.
- Judges will use this for ~5 minutes. A cold visitor must reach a dispatched
  order without being taught.

## Demonstration data

All incident data is **synthetic**, modelled on the 2024–25 Bhote Koshi flash
floods (Nepal) and Indian district geography. Every screen that shows synthetic
data says so. Dataset lineage that a real deployment would train on: xBD,
FloodNet, RescueNet, Sen1Floods11, Bhuvan (ISRO/NRSC), Copernicus EMS.

## Claims we do not make

- No accuracy figure is presented as measured unless it is measured.
- No live drone hardware. No live Twilio SMS. No live satellite feed.
- No claim of NDMA/SDMA endorsement, integration, or deployment.

## Brand commitments

- Product name: **AEGIS**. Never "Aegis Platform", never a tagline in the tab title.
- Team: **Team Sinchan**. (The dossier PDF's "Team Diamonds" is outdated.)
- Problem statement **26206** and the SIH 2026 context are surfaced, not hidden —
  judges look for them first.
