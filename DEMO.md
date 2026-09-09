# AEGIS — demo script

For the SIH presentation. Five minutes of driving, plus the answers to the
questions that actually get asked.

**Before you start:** `npm run dev`, and `npm run vision` in a second terminal if you want the live segmentation moment. Open <http://localhost:3000>, and pick the
theme for the room — press **Night** if you're on a projector in a dark hall,
leave it on Day if the lights are up. Have `/operations` open in a second tab so
you never wait for a page load in front of judges.

---

## The run (about 5 minutes)

### 0:00 — Open on the situation board (`/`)

Don't explain the architecture. Point at the sheet.

> "This is a district emergency operations centre during a flood. An embankment
> on the Kamla Balan has breached. A hundred zones, one square kilometre each.
> Three are Critical."

**Drag the severity cut slider.** All hundred cells remap live.

> "The officer is looking for where the line falls."

**Click zone F-06.** The record opens with the arithmetic — three terms, each
weight, each product, and the sum.

> "This is the important part. The severity number is not a model output. It's a
> weighted sum the officer can read, and override. That matters because the
> officer signing this is legally accountable for it."

**Open Weights, drag one.** Everything rescores.

> "And they can retune it. Non-default weights get written to the audit register."

### 1:00 — Real computer vision (`/operations`, top panel)

*Only if you started `npm run vision`. If you didn't, skip to the pipeline — the
panel says "not configured" and nothing breaks.*

Have a flood photo ready on the desktop. **Drag it into the ingestion panel.**

> "That's a real image going to a Python service — segmented, then gridded into
> the same hundred zones the rest of the system reasons over. A few hundred
> milliseconds on CPU."

Point at the provenance strip:

> "And it tells you what produced each number. Flood extent is a classical water
> index right now, not a trained U-Net — we say so, because those are different
> kinds of claim. Depth comes back null, because you cannot get depth from one
> RGB frame. Damage comes back null too, not zero — we haven't trained the xBD
> model, and a number nobody measured must not look like one that was."

That paragraph is worth more to a judge than a fake accuracy figure.

### 1:45 — Run the pipeline (`/operations`)

Press **Execute pipeline**.

Let the graph light up. Don't narrate every node — let them watch it move.

> "Five stages. Imagery, zone priority, drone verification, resource decision,
> safe dispatch. That's the real compiled graph, not a diagram — the node that's
> lit is the node executing."

Point at the cycle when it loops back to `survey`:

> "It just went back for a second survey round, because zones above the severity
> threshold hadn't been drone-verified yet."

### 2:30 — The gate halts

The run stops. Point at it.

> "It's stopped. Not waiting on a spinner — the graph has genuinely halted and
> checkpointed. `interrupt()` in the executor. If I reload this page right now,
> it comes back still waiting."

Show the **trade-offs** block:

> "And it's telling the officer what this plan gives up. Not 'plan generated' —
> which zones don't get what, and what happens to them."

**Press and hold the stamp.** Let them see the fill and the impression land.

> "Approval is a deliberate act. An officer who clicks approve by reflex hasn't
> approved anything, and the register would record that they had."

### 3:15 — Routing and the second gate

> "Dijkstra over the zone graph. Impassable links are removed, not penalised —
> so the system can *guarantee* a route doesn't cross a collapsed bridge, rather
> than preferring not to."

Point at the routes sheet — the "Avoided" column, and the amphibious note:

> "Boats don't swim to the flood. They're trailered to a launch point and put in
> the water there. That's the launch zone."

If the craft-shortfall warning is showing:

> "And here — three zones are inundated but got no boats. It's naming the actual
> constraint: this is a boat shortfall, not a road problem. That's the difference
> between a dashboard and decision support."

**Stamp gate 2.**

### 3:50 — The order

> "Field-ready. Both signatures with designation and timestamp. Waypoints. And
> the instruction in Hindi as well as English, because the boat crew reading this
> is not reading English."

Switch to **हिन्दी**. Let it sit for a second.

> "Evacuation sequence is in there — medical cases and pregnant women first, then
> children, then elderly. Load below rated capacity. Livestock separately. That's
> not us inventing procedure, that's the SOP."

### 4:20 — Drones (`/drones`)

**Task top 6, press Run, set 16×.**

> "Six airframes. This isn't an animation — position is integrated from airspeed,
> wind and heading, battery drains against endurance, and the C2 link degrades
> with range from the launch depot."

Wait for a `bingo fuel` or `link-loss` event in the log:

> "There. That one hit its return-to-home reserve, turned for base, and re-queued
> its zone by itself."

Point at the sensor feed:

> "Simulated — it says so on every frame. But the flight envelope is real: 120 m
> ceiling, which is the Drone Rules 2021 green-zone limit."

### 4:50 — Before and after, fast

`/before` — point at the trigger banner:

> "Before the event. The district plan's trigger is the *forecast* crossing danger
> level, not the observed crossing. So the system fires when the forecast crosses,
> and proposes where stock moves first."

`/after` — point at the after-action findings:

> "After. Same zone records, now a graded damage register for relief claims. And
> these findings feed straight back into the vulnerability ranking on the before
> page. That's the full before-during-after loop the problem statement asks for."

### 5:20 — Close on `/system`

> "And this page is what's real and what's simulated, subsystem by subsystem,
> with what a deployment would have to replace. We'd rather tell you that than
> have you find it."

---

## Questions you will get

**"Is this actually working or is it a mockup?"**
> Working. The severity scoring, the routing, both approval gates, the audit
> register, retrieval, the drone flight model and the LangGraph orchestration are
> real code paths — and if you hand us an image right now, a Python service will
> segment it. What's simulated is the drone hardware and the SMS transmission,
> and the interface says so wherever their output appears. There's a page listing
> exactly which is which, and a script that verifies all of it in one command.

**"You say multi-agent — what are the agents?"**
> Two, in a propose-then-challenge loop. An allocation agent investigates zones
> and routes through read-only tools and proposes a plan. A safety agent then
> reviews it adversarially — can this depot actually reach this zone with what it
> was given, is an inundated zone getting people but no boats — and can send it
> back before a human ever sees it. You saw it fire: it returned the plan, the
> allocator retried, and it escalated to the officer with the objection attached
> because the shortfall was in the stock, not in the plan.

**"What if the AI is wrong?"**
> Two independent mitigations. Nothing dispatches without a human signature at
> both gates, so a bad recommendation is caught before it becomes an action. And
> the drone stage exists to re-verify the top zones at higher resolution before
> resources are committed — that's what catches a satellite-level false positive.

**"Why should a language model be anywhere near this?"**
> It doesn't decide. It investigates structured state through read-only tools —
> it can open a zone, test whether a depot can actually reach it, look up what
> doctrine says — and then proposes an allocation with the trade-offs named. A
> human approves or overrides. And the deterministic rule engine is always
> underneath it: with no API key the whole product still works, labelled
> RULE ENGINE.

**"What happens when the network goes down?"**
> It runs. Retrieval is BM25 in-process, no vector service. The resource engine
> is deterministic. Scoring and routing are local arithmetic. That's a
> requirement, not a fallback — a control room during a flood is exactly where a
> network dependency fails.

**"Why Dijkstra and not A*?"**
> Because we need a guarantee, not a preference. We must be able to state that a
> route *cannot* cross a collapsed bridge. Removing impassable edges and running
> Dijkstra gives that, deterministically and auditably. A* only helps with a good
> admissible heuristic, and at district scale the gain doesn't justify the
> complexity in a life-safety path.

**"Why U-Net and YOLO, why not one model?"**
> Different problems. U-Net's encoder-decoder does dense pixel-wise segmentation
> — flood extent as a mask. YOLO does fast bounding-box detection — damaged
> structures, people, vehicles. One model doing both means compromising one, and
> that output feeds a resource allocation.

**"What accuracy do you get?"**
> This is the question to be scrupulous on, and being scrupulous is the answer
> that wins it. Say: *"We haven't trained the U-Net — we have no NVIDIA GPU. The
> architecture and the FloodNet training script are in the repo. What's running
> is a classical water index, which is a real published method with a lower
> ceiling, and we label every figure it produces as such. Object detection is
> real on pretrained COCO weights. We'd rather show you a labelled baseline than
> quote someone else's mean-IoU as ours."*
>
> Then name the failure modes yourself, before they ask: shadow reads as water,
> wet tarmac reads as water, and silt-laden floodwater — which is exactly what
> Kosi-basin water looks like — is under-detected. FloodNet's own authors flag
> the hard cases too.
>
> If they push on why it isn't trained: *"Two hours on a free Colab T4. We chose
> to spend the time we had on the parts a judge can't verify by looking — the
> approval gates, the audit trail, and the routing guarantees."*

**"Does this replace NDMA/SDMA systems?"**
> No. It's a decision-support layer alongside the district plan and the Incident
> Response System. Authority stays with the officer who signs, under powers the
> DDMA already holds under Section 30 of the DM Act.

**"Who's accountable if a resource is misallocated?"**
> The officer at the gate. The system is built so accountability stays with the
> human who approves, and the register records the AI's recommendation and the
> human's decision as two separate entries with two separate actors — so an
> inquiry can see which of them chose.

**"How does victim data get handled?"**
> This prototype holds no personal data — detections are counts, not identities.
> The only name in the record is the approving officer's, which is required for
> accountability. A deployment handling victim-level data needs role-based access,
> retention under the state records policy, and a documented lawful basis, and we
> don't claim to have implemented those.

**"Does it only do floods?"**
> The pipeline is hazard-agnostic — grid, score, verify, allocate, route. Swapping
> the training data generalises it: xBD covers earthquakes, wildfires and
> hurricanes as well as floods. What's flood-specific is the severity formula's
> inputs and the routing cost model, and both are small, readable modules.

**"What was the hardest decision?"**
> Good honest answer: choosing a transparent severity formula over a learned
> classifier. A learned score would probably rank slightly better. But an officer
> can't sanity-check it, can't defend it at an inquiry, and can't tell when it's
> wrong. We took the accuracy hit for something a human can argue with.

**"What would you do differently?"**
> Validate the severity formula against real district SOPs earlier. We built it,
> then found while testing that it was ranking *water* rather than *risk to
> people* — an empty river channel under three metres was outranking a settlement
> of fifteen hundred. We fixed it, but we found it late, and we'd have found it on
> day one by walking it past someone who has actually run a control room.

---

## If something breaks

- **The pipeline stalls** — press Restart. The run is a fresh thread; nothing is
  lost.
- **Drones look frozen** — check the rate isn't 1×, and that Run is pressed.
- **RAG returns passages verbatim instead of prose** — that's fallback mode with
  no API key. It's correct behaviour, and it's a *good* thing to point out:
  *"no reasoning credentials here, so it returns the source passages rather than
  paraphrasing them — it won't compose an answer it can't ground."*
- **Everything is labelled RULE ENGINE** — same thing. Don't apologise for it;
  it's the graceful-degradation story.
