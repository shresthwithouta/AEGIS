/**
 * Doctrine corpus for the BEFORE phase.
 *
 * IMPORTANT — these are paraphrased working summaries written for a prototype,
 * not authoritative text. Each entry names the document it summarises so an
 * officer can go to the source. A deployment replaces this file with the
 * indexed full text of the district's own SOPs and the authoritative
 * publications listed in `sourceRef`.
 *
 * Retrieval is lexical (BM25) rather than embedding-based, so the assistant
 * answers with no network dependency and no vector service — a hard
 * requirement for a control room on a degraded link.
 */

export const CORPUS_NOTE =
  'Paraphrased summaries prepared for prototype use. Not authoritative text. Verify against the cited source before acting.';

export const DOCUMENTS = [
  {
    id: 'dm-act-2005-institutions',
    title: 'Disaster Management Act, 2005 — institutional structure',
    authority: 'Government of India',
    year: 2005,
    sourceRef: 'The Disaster Management Act, 2005 (No. 53 of 2005), Chapters II–IV',
    tags: ['governance', 'authority', 'before', 'during', 'after'],
    text: `The Act creates a three-tier structure. The National Disaster Management Authority (NDMA) is chaired by the Prime Minister and lays down policies and guidelines. Each State Disaster Management Authority (SDMA) is chaired by the Chief Minister. At district level the District Disaster Management Authority (DDMA) is chaired by the District Magistrate or Collector, with the elected head of the district council as co-chair. The DDMA prepares the District Disaster Management Plan, coordinates its implementation, and is the authority that actually orders response action on the ground. Section 30 lists the DDMA's powers and functions, including the power to give directions to any department of the government at district level.`,
  },
  {
    id: 'dm-act-2005-ndrf',
    title: 'Disaster Management Act, 2005 — National Disaster Response Force',
    authority: 'Government of India',
    year: 2005,
    sourceRef: 'The Disaster Management Act, 2005, Section 44–45',
    tags: ['response', 'during', 'resources'],
    text: `Section 44 constitutes the National Disaster Response Force (NDRF) as a specialist force for the purpose of specialist response to a threatening disaster situation or disaster. It is deployed on requisition and works under the general superintendence of the NDMA, with its Director General exercising command and supervision. States raise their own State Disaster Response Force (SDRF) battalions on a comparable pattern for first response, which reach an incident before NDRF companies in most district-level events. Note the naming collision: the State Disaster Response Fund is a financing instrument and is a different thing entirely from the State Disaster Response Force.`,
  },
  {
    id: 'ndma-floods-embankment',
    title: 'NDMA flood guidelines — embankments and breach response',
    authority: 'National Disaster Management Authority',
    year: 2008,
    sourceRef: 'NDMA Guidelines: Management of Floods (2008), chapters on structural measures and flood response',
    tags: ['flood', 'embankment', 'before', 'during'],
    text: `Embankments reduce flood frequency but concentrate risk: when one breaches, the water arrives faster and deeper than an unembanked flood would, and the population behind it has usually built on the assumption of protection. The guidelines therefore require pre-monsoon inspection of embankments, identification and marking of vulnerable reaches, pre-positioning of breach-closure material (boulders, sandbags, bamboo) at identified vulnerable points, and round-the-clock patrolling during high-stage periods. For response, the priority sequence after a breach is: warn and evacuate the population in the immediate shadow of the breach, then contain the breach, then restore drainage. Evacuation is never held back pending breach closure.`,
  },
  {
    id: 'ndma-floods-warning',
    title: 'NDMA flood guidelines — warning dissemination and last mile',
    authority: 'National Disaster Management Authority',
    year: 2008,
    sourceRef: 'NDMA Guidelines: Management of Floods (2008), chapter on flood forecasting and warning',
    tags: ['warning', 'before', 'communication'],
    text: `A forecast has no value until it reaches the household that must move. The guidelines require dissemination through multiple redundant channels because no single channel survives a flood: radio and television, SMS and cell broadcast, public address from vehicles and places of worship, and traditional signalling in villages without power. Warnings must be issued in the local language and in a form a non-literate recipient can act on — what will happen, when, what to do, and where to go. Bandwidth-independent channels matter most: in an inundated area, voice and SMS survive when data does not.`,
  },
  {
    id: 'ndma-irs-structure',
    title: 'Incident Response System — command structure',
    authority: 'National Disaster Management Authority',
    year: 2010,
    sourceRef: 'NDMA Guidelines: Incident Response System (2010)',
    tags: ['governance', 'during', 'command'],
    text: `The Incident Response System (IRS) gives India a standard command structure adapted from incident command practice. A Responsible Officer (RO) — normally the District Magistrate at district level — has overall responsibility and appoints an Incident Commander (IC). Under the IC sit four sections: Operations, which does the response work; Planning, which builds the incident action plan and tracks resources; Logistics, which supplies and moves; and Finance/Administration. The structure is designed to scale up and down without changing who reports to whom, and to make handover between shifts unambiguous. Every incident runs on a written Incident Action Plan for a defined operational period.`,
  },
  {
    id: 'ndmp-response-phases',
    title: 'National Disaster Management Plan — response and the golden window',
    authority: 'National Disaster Management Authority',
    year: 2019,
    sourceRef: 'National Disaster Management Plan (2019 edition), response chapter',
    tags: ['during', 'response', 'planning'],
    text: `The plan organises response around early warning, evacuation, search and rescue, medical care, and relief, and assigns each function to a lead agency with named supporting agencies. It emphasises that the first hours after impact carry a disproportionate share of preventable deaths, so search and rescue capability must be deployable before a full damage assessment exists. Assessment and response run in parallel, not in sequence. Response is expected to proceed on the best available information rather than waiting for confirmed figures, with the understanding that early estimates will be revised.`,
  },
  {
    id: 'ndmp-recovery',
    title: 'National Disaster Management Plan — recovery and reconstruction',
    authority: 'National Disaster Management Authority',
    year: 2019,
    sourceRef: 'National Disaster Management Plan (2019 edition), recovery chapter',
    tags: ['after', 'recovery', 'reconstruction'],
    text: `Recovery is treated in three horizons: early recovery restoring basic services, medium-term recovery restoring livelihoods and repairable infrastructure, and long-term reconstruction. The plan directs that reconstruction incorporate build-back-better principles rather than restoring the pre-disaster level of vulnerability, and that damage and loss assessment be documented systematically because it drives both compensation and the next planning cycle. Post-disaster documentation is explicitly a planning input, not only an accounting exercise.`,
  },
  {
    id: 'imd-rainfall-categories',
    title: 'IMD rainfall categories and colour-coded warnings',
    authority: 'India Meteorological Department',
    year: 2024,
    sourceRef: 'IMD operational definitions for 24-hour rainfall categories and impact-based colour warnings',
    tags: ['forecast', 'before', 'warning'],
    text: `IMD classifies 24-hour rainfall as heavy (64.5–115.5 mm), very heavy (115.6–204.4 mm) and extremely heavy (204.5 mm and above). Separately, IMD issues impact-based colour-coded warnings: green means no advisory, yellow means watch and stay updated, orange means be prepared for disruption, and red means take action. The colour reflects expected impact rather than rainfall depth alone, so a red warning can be issued at a lower rainfall figure where the catchment is already saturated or a river is already above warning level.`,
  },
  {
    id: 'cwc-gauge-levels',
    title: 'CWC river-gauge levels — warning, danger and HFL',
    authority: 'Central Water Commission',
    year: 2024,
    sourceRef: 'CWC flood forecasting network, gauge level definitions',
    tags: ['forecast', 'before', 'during', 'flood'],
    text: `The Central Water Commission operates the national flood forecasting network. Each forecasting station carries three reference levels. The warning level is the stage at which the district administration is alerted and preparatory action begins. The danger level is the stage at which flooding of the adjacent area is expected and evacuation of the floodplain should be under way. The highest flood level (HFL) is the maximum stage recorded at that station. CWC issues level forecasts (expected stage at a future hour) and inflow forecasts. A forecast crossing the danger level within the forecast horizon is the trigger a district plan should be keyed to, not the actual crossing.`,
  },
  {
    id: 'sdrf-fund-norms',
    title: 'State Disaster Response Fund — items and norms of assistance',
    authority: 'Ministry of Home Affairs',
    year: 2022,
    sourceRef: 'MHA norms of assistance from SDRF/NDRF for the 2021–26 award period',
    tags: ['after', 'relief', 'finance'],
    text: `Relief expenditure from the State Disaster Response Fund is governed by a published list of items and norms. It covers gratuitous relief for affected families, ex-gratia for loss of life and for disability, assistance for damaged houses graded by extent of damage, input subsidy for crop loss above a threshold percentage, assistance for livestock loss by animal category, and the cost of clearance, search and rescue and relief camp operation. Claims require documented damage assessment tied to identified beneficiaries. Because the norms are item-based and evidence-based, the quality of the post-disaster damage record directly determines what a district can actually disburse.`,
  },
  {
    id: 'relief-camp-standards',
    title: 'Relief camp minimum standards',
    authority: 'Sphere Association (referenced in Indian relief planning)',
    year: 2018,
    sourceRef: 'The Sphere Handbook (2018), WASH and Shelter minimum standards',
    tags: ['after', 'relief', 'camp'],
    text: `Widely used minimum planning figures for displaced populations: at least 15 litres of water per person per day for drinking, cooking and hygiene; a maximum of 20 people per toilet, with separate facilities for women and men; and at least 3.5 square metres of covered living space per person, excluding cooking and sanitation areas. Water points should be within 500 metres of dwellings. These are minimums for survival with dignity, not targets — Indian district relief plans generally reference them when sizing camps and provisioning.`,
  },
  {
    id: 'drone-rules-2021',
    title: 'Drone Rules 2021 — operating limits relevant to disaster survey',
    authority: 'Ministry of Civil Aviation / DGCA',
    year: 2021,
    sourceRef: 'The Drone Rules, 2021 and subsequent amendments; Digital Sky airspace map',
    tags: ['drone', 'during', 'legal'],
    text: `Indian airspace is mapped into green, yellow and red zones on the Digital Sky platform. In a green zone, operation up to 400 feet (approximately 120 metres) above ground level requires no prior flight permission. Yellow zones are controlled airspace requiring air-traffic clearance; red zones require central government permission. Unmanned aircraft are categorised by all-up weight: nano up to 250 g, micro above 250 g to 2 kg, small above 2 kg to 25 kg, medium above 25 kg to 150 kg, and large above 150 kg. A remote pilot certificate is required except for nano craft and for micro craft flown non-commercially. Registration on Digital Sky with a unique identification number is required. Emergency operations by or on behalf of a government agency still operate within this framework, so the ceiling and zone constraints are real planning inputs for a disaster survey mission, not formalities.`,
  },
  {
    id: 'evacuation-sop-riverine',
    title: 'Riverine flood evacuation — sequencing',
    authority: 'District disaster management practice',
    year: 2023,
    sourceRef: 'Composite of state flood SOPs (Bihar, Assam, Uttar Pradesh) — verify against the district plan in force',
    tags: ['during', 'evacuation', 'flood'],
    text: `Evacuation is sequenced by vulnerability rather than by proximity. The order generally runs: persons requiring medical support and pregnant women; children and unaccompanied minors; elderly and persons with disabilities; then general population; then livestock, which is moved to identified raised ground rather than transported. Boats are loaded below rated capacity, never at it, because occupants in flood conditions are wet, panicked and carrying possessions. Livestock is never carried in the same trip as people. Once a settlement is cleared it is marked so that a subsequent boat crew does not re-search it, and the mark and the count are recorded.`,
  },
  {
    id: 'vulnerability-index-practice',
    title: 'Pre-monsoon vulnerability mapping',
    authority: 'District disaster management practice',
    year: 2023,
    sourceRef: 'District Disaster Management Plan template, hazard–vulnerability–capacity analysis section',
    tags: ['before', 'planning', 'mitigation'],
    text: `A district plan is expected to carry a hazard, vulnerability and capacity analysis identifying which revenue villages flood, how often, and how quickly they become unreachable. Practice is to rank settlements by a composite of historical inundation frequency, population, presence of vulnerable groups, distance to the nearest all-weather road, and availability of raised shelter. That ranking drives pre-monsoon action: siting of relief material, identification of shelter buildings, and boat allotment by block. The value of the ranking depends on it being revised after every event with what actually happened, which is the step most often skipped.`,
  },
  {
    id: 'damage-assessment-practice',
    title: 'Post-flood damage assessment and documentation',
    authority: 'District disaster management practice',
    year: 2023,
    sourceRef: 'State relief manual damage assessment procedure — verify against the manual in force',
    tags: ['after', 'assessment', 'relief'],
    text: `Damage assessment proceeds in two passes. A rapid assessment within the first days establishes scale for resource mobilisation and is expected to be approximate. A detailed assessment then enumerates damage by household and by asset for compensation, conducted jointly by revenue, agriculture and engineering staff and countersigned. Houses are graded — fully damaged, severely damaged, partially damaged — because the norms of assistance differ by grade. Photographic evidence with location and date, and a georeferenced record of what was assessed, materially reduce later disputes and speed disbursement.`,
  },
  {
    id: 'human-in-loop-decision-support',
    title: 'Decision-support systems in emergency operations',
    authority: 'Operational practice note',
    year: 2024,
    sourceRef: 'General practice in emergency management; see also NDMA IRS guidance on the Incident Action Plan',
    tags: ['governance', 'ai', 'during'],
    text: `A decision-support system in an emergency operations centre supplies analysis; it does not hold authority. Accountability for committing a resource remains with the officer who authorises it under the district plan and the Incident Response System. For that accountability to be real, three things must hold: the officer must be able to see the basis of a recommendation and not only its output, the officer must be able to override it without leaving the system, and the recommendation, the decision and the identity of the decision-maker must be recorded with a timestamp for post-incident review. A system that automates the recommendation but not the record has moved the work without moving the accountability.`,
  },
];

/** Split documents into retrievable passages. Short docs stay whole. */
export function buildChunks(documents = DOCUMENTS) {
  const chunks = [];
  for (const doc of documents) {
    const sentences = doc.text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [doc.text];
    let buf = [];
    let count = 0;
    let part = 1;
    const flush = () => {
      if (!buf.length) return;
      chunks.push({
        id: `${doc.id}#${part}`,
        docId: doc.id,
        title: doc.title,
        authority: doc.authority,
        year: doc.year,
        sourceRef: doc.sourceRef,
        tags: doc.tags,
        part,
        text: buf.join('').trim(),
      });
      part += 1;
      buf = [];
      count = 0;
    };
    for (const s of sentences) {
      buf.push(s);
      count += s.split(/\s+/).length;
      if (count > 85) flush();
    }
    flush();
  }
  return chunks;
}

export const CHUNKS = buildChunks();
