# AEGIS

**Automated Emergency Guidance & Intelligence Support**

Decision support for district disaster management. AEGIS reads imagery of a
flood-hit area, splits it into a 100-zone grid, scores each zone's severity,
flies drones to verify the worst, recommends a resource allocation, and plans a
safe route — halting twice for a named officer to sign before anything moves.

Smart India Hackathon 2026 · Problem Statement **26206** (AICTE / MIC — Student
Innovation, Disaster Management) · **Team Sinchan**

---

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. It works immediately with no configuration and no
API key — every recommendation comes from the deterministic rule engines and is
labelled `RULE ENGINE` on screen.

**Optional — enable the reasoning layer:**

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Stage 4 then produces a reasoned recommendation, investigating zones and routes
through read-only tools before proposing an allocation, and every figure it
produced is labelled `REASONED`.

**Optional — enable real computer vision:**

```bash
npm run vision          # starts the Python service and prints what it can do
```

Then in `.env.local`:

```bash
VISION_SERVICE_URL=http://127.0.0.1:8000
```

Stage 1 on `/operations` gains an ingestion panel: drop a satellite or UAV frame
and it is segmented, gridded into the same 100 zones, and returned with a
provenance block naming the model behind each field. See
[`services/vision/`](services/vision/README.md).

**Check everything still works:**

```bash
npm run verify          # 47 checks against a running dev server
```

It exercises every route, both LangGraph graphs end to end through both approval
gates, the RAG refusal path, the vision service, and the audit register — and
reports what actually happened rather than that it ran. It has caught real bugs
that manual testing missed.

---

## What it does, phase by phase

Problem statement 26206 asks for risk mitigation, planning and management
*before, during or after* a disaster. AEGIS covers all three off one spine — the
same per-zone record, read at three points in the cycle.

### Before — [`/before`](src/app/before/page.js)

Historical inundation frequency, access isolation and shelter deficit rank all
100 zones for pre-monsoon planning. When a CWC forecast crosses danger level
inside the horizon, the district plan's trigger has fired and the system proposes
where stock should move first — because the trigger is the *forecast* crossing,
not the observed one.

A doctrine assistant ([`/before/assistant`](src/app/before/assistant/page.js))
answers questions against Indian disaster-management doctrine with citations. It
is self-correcting RAG: it grades what it retrieved, broadens the query when
evidence is thin, and verifies after generating that every citation resolves. If
the corpus does not answer the question it says so rather than filling the gap.

### During — [`/operations`](src/app/operations/page.js) and [`/drones`](src/app/drones/page.js)

The five-stage pipeline, executed as a state graph:

| Stage | Node | What it does |
|---|---|---|
| 1 | `ingest` → `vision` | Selects the finest usable imagery pass, segments flood extent, detects damage |
| 2 | `prioritise` | 10×10 grid; transparent weighted severity per zone; ranked |
| 3 | `survey` ⇄ `fuse` | Flies drones to unverified high-severity zones; folds counts back in |
| 4 | `decide` → `review` → **`gate_resources`** | An allocation agent proposes; a safety agent adversarially challenges it and can send it back; then **APPROVAL GATE 1** |
| 5 | `routing` → **`gate_dispatch`** → `dispatch` | Flood-aware routing · **APPROVAL GATE 2** · bilingual field orders |

### After — [`/after`](src/app/after/page.js)

Graded house damage for relief claims, a rebuild priority that leads with
connectivity rather than severity, and after-action findings that feed back into
the *before* layer — closing the loop the problem statement asks for.

Everything is recorded in an append-only [audit register](src/app/register/page.js).

---

## The two things that make it defensible

### 1. The approval gates are in the executor, not the UI

`gate_resources` and `gate_dispatch` are `interrupt()` calls in the graph
runtime. Reaching one checkpoints the thread and **ends the run**. Only a resume
carrying a named officer's decision continues it. Reload the page mid-incident
and the thread recovers from its checkpoint, still waiting.

This is the whole safety argument, so it lives in the runtime where it cannot be
bypassed — not in a confirm dialog that a `disabled={false}` would defeat.

### 2. It works with the network down

A district emergency operations centre during a flood is exactly where a network
dependency fails. So:

- Retrieval is **BM25, in-process** — no vector service, no embedding call.
- The resource engine is **deterministic**, from published planning norms.
- Severity and routing are **local arithmetic**.
- With no reasoning credentials the entire product still works, and says so.

The reasoning layer improves the output. It is never load-bearing.

---

## Architecture

```
src/
  lib/agent/
    llm.js            Reasoning layer with a deterministic fallback
    tools.js          Read-only investigation tools the model may call
  lib/aegis/
    incident.js       The synthetic incident — 100 zones, roads, bridges, depots
    severity.js       Transparent weighted scoring
    drones.js         Flight simulation: wind, battery, C2 link, detection
    routing.js        Dijkstra + amphibious (trailer-then-launch) routing
    resources.js      Throughput-based requirement engine
    pipeline.js       The five-stage LangGraph StateGraph + the two agents
    rag.js            Self-correcting retrieval StateGraph
    corpus.js         Doctrine corpus
    phases.js         Before (vulnerability) and after (damage, rebuild)
    store.js          Append-only audit register
services/vision/      FastAPI + PyTorch: U-Net + YOLOv8  (see its own README)
```

**Orchestration is LangGraph** — `@langchain/langgraph`, the official JavaScript
runtime. Same library and same semantics as the Python one: typed `Annotation`
channels with reducers, conditional edges, `interrupt()`, `MemorySaver`
checkpointing, `Command({ resume })`. Running it in-process means the whole
system deploys as one artifact with a live URL for judging, and the graph
streams straight into the interface — which is why you can watch it execute, and
why the diagram on `/operations` is read from the compiled graph via
`getGraphAsync()` rather than hand-drawn.

**Two agents, not one.** Stage 4 is a propose-then-challenge loop. An
**allocation agent** investigates zones and routes through read-only tools and
proposes a plan. A **safety agent** then reviews it adversarially — can this
depot actually reach this zone with what it was given; is an inundated zone
getting people but no boats — and can send the plan back once before a human
ever sees it. Both have a deterministic counterpart that runs the same checks as
arithmetic when there is no reasoning layer, so a plan is challenged even
offline.

---

## Honest build status

Marked on screen throughout, and inventoried at [`/system`](src/app/system/page.js).

**Real:** severity scoring, zone prioritisation, Dijkstra routing with hard edge
removal, the amphibious launch-point planner, the requirement engine, both
approval gates, the audit register, retrieval and citation verification, the
drone flight model (envelope, wind, battery, link degradation, detection
convergence), the LangGraph runtime, and — with the vision service running —
genuine flood segmentation over an uploaded image.

**Partly real:** stage 1. Flood extent is segmented by a real classical water
index (NDWI-analogue + Otsu) today; a trained U-Net is a `train_unet.py` run
away. Object detection is real the moment `ultralytics` is installed, on
pretrained COCO weights, no training required. Damage classification needs xBD
training and is **reported as `null`, never as `0`** — an unmodelled quantity
must not travel downstream looking like a measurement.

**Simulated:** the drone hardware and its video, and dispatch transmission — no
SMS, WhatsApp or audio is sent.

**Synthetic:** all incident data, modelled on the Kosi–Bagmati basin in Darbhanga
district, Bihar, and on the 2024–25 Bhote Koshi flash floods.

**Not claimed:** no accuracy figure is presented as measured unless it was
measured; no NDMA/SDMA endorsement, integration or deployment; no personal data
is held — detections are counts, not identities.

---

## Design

The interface is the Indian government file, translated into an operations
console: ruled columns instead of cards, a serial in the margin of every record,
and both approval gates as a stamp you press and hold. See [DESIGN.md](DESIGN.md).

---

## Roadmap

- **Near term** — Flutter field app for rescue teams: offline route caching and
  native push, which a web app cannot do reliably on 2G in a flood zone. Live
  drone video in place of static frames. Two-way SMS confirmation so the control
  room knows an order was received.
- **Mid term** — Risk prediction from historical zone severity plus IMD/CWC
  forecasts. Integration with the NDMA national database. Crowd-sourced citizen
  reports alongside drone data.
- **Long term** — Other hazards (earthquake, cyclone, wildfire) using xBD's
  multi-hazard labels. Multiple district centres into one state dashboard.
  On-drone edge inference.
