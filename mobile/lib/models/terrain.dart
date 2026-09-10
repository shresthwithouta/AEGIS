/// The district picture — zones, roads, bridges and depots — bundled with the
/// app as `assets/data/terrain.json`.
///
/// That file is not sample data invented for this app: it is the literal
/// output of the command centre's own incident model
/// (`src/lib/aegis/incident.js` + `severity.js`), run once and captured. So
/// the crew's offline map of Darbhanga district — which zone floods how deep,
/// which bridge is out — is the same district the officer who signed their
/// order was looking at. It never changes at runtime; a live deployment
/// replaces the bundled file with a fresh capture per incident, not with a
/// network call the field app depends on.
library;

class TerrainZone {
  const TerrainZone({
    required this.id,
    required this.col,
    required this.row,
    required this.flood,
    required this.depthM,
    required this.severity,
    required this.band,
    required this.population,
    required this.terrain,
    this.settlement,
  });

  final String id;
  final int col;
  final int row;
  final double flood;
  final double depthM;
  final int severity;
  final String band;
  final String? settlement;
  final int population;
  final String terrain;

  factory TerrainZone.fromCompact(List<dynamic> v) => TerrainZone(
        id: '${v[0]}',
        col: v[1] as int,
        row: v[2] as int,
        flood: (v[3] as num).toDouble(),
        depthM: (v[4] as num).toDouble(),
        severity: v[5] as int,
        band: '${v[6]}',
        settlement: (v[7] as String).isEmpty ? null : v[7] as String,
        population: v[8] as int,
        terrain: '${v[9]}',
      );
}

class TerrainRoad {
  const TerrainRoad({required this.id, required this.name, required this.roadClass, required this.path});
  final String id;
  final String name;
  final String roadClass;
  final List<String> path;

  factory TerrainRoad.fromJson(Map<String, dynamic> j) => TerrainRoad(
        id: '${j['id']}',
        name: '${j['name']}',
        roadClass: '${j['class']}',
        path: (j['path'] as List<dynamic>).map((e) => '$e').toList(),
      );
}

class TerrainBridge {
  const TerrainBridge({
    required this.id,
    required this.name,
    required this.zone,
    required this.status,
    this.note,
  });
  final String id;
  final String name;
  final String zone;
  final String status; // open | restricted | collapsed | submerged
  final String? note;

  bool get isOpen => status == 'open' || status == 'restricted';

  factory TerrainBridge.fromJson(Map<String, dynamic> j) => TerrainBridge(
        id: '${j['id']}',
        name: '${j['name']}',
        zone: '${j['zone']}',
        status: '${j['status']}',
        note: j['note'] as String?,
      );
}

class TerrainDepot {
  const TerrainDepot({required this.id, required this.name, required this.zone, required this.kind});
  final String id;
  final String name;
  final String zone;
  final String kind;

  factory TerrainDepot.fromJson(Map<String, dynamic> j) => TerrainDepot(
        id: '${j['id']}',
        name: '${j['name']}',
        zone: '${j['zone']}',
        kind: '${j['kind']}',
      );
}

class TerrainBand {
  const TerrainBand({required this.id, required this.label, required this.atLeast});
  final String id;
  final String label;
  final int atLeast;

  factory TerrainBand.fromJson(Map<String, dynamic> j) => TerrainBand(
        id: '${j['id']}',
        label: '${j['label']}',
        atLeast: j['atLeast'] as int,
      );
}

class Terrain {
  // Not const: _byId and _bridgeByZone below are late final fields computed
  // from zones/bridges at construction time, which a const constructor
  // cannot allow.
  Terrain({
    required this.fileNo,
    required this.incidentName,
    required this.district,
    required this.grid,
    required this.zones,
    required this.roads,
    required this.bridges,
    required this.depots,
    required this.bands,
  });

  final String fileNo;
  final String incidentName;
  final String district;
  final int grid;
  final List<TerrainZone> zones;
  final List<TerrainRoad> roads;
  final List<TerrainBridge> bridges;
  final List<TerrainDepot> depots;
  final List<TerrainBand> bands;

  late final Map<String, TerrainZone> _byId = {for (final z in zones) z.id: z};
  late final Map<String, TerrainBridge> _bridgeByZone = {for (final b in bridges) b.zone: b};

  TerrainZone? zone(String id) => _byId[id];
  TerrainBridge? bridgeAt(String zoneId) => _bridgeByZone[zoneId];

  /// The band label for a raw zone id, falling back gracefully — a route can
  /// reference a zone this snapshot predates.
  String bandOf(String zoneId) => _byId[zoneId]?.band ?? 'clear';

  factory Terrain.fromJson(Map<String, dynamic> j) => Terrain(
        fileNo: '${(j['incident'] as Map)['fileNo']}',
        incidentName: '${(j['incident'] as Map)['name']}',
        district: '${(j['incident'] as Map)['district']}',
        grid: j['grid'] as int,
        zones: (j['zones'] as List<dynamic>)
            .map((e) => TerrainZone.fromCompact(e as List<dynamic>))
            .toList(),
        roads: (j['roads'] as List<dynamic>)
            .map((e) => TerrainRoad.fromJson(e as Map<String, dynamic>))
            .toList(),
        bridges: (j['bridges'] as List<dynamic>)
            .map((e) => TerrainBridge.fromJson(e as Map<String, dynamic>))
            .toList(),
        depots: (j['depots'] as List<dynamic>)
            .map((e) => TerrainDepot.fromJson(e as Map<String, dynamic>))
            .toList(),
        bands: (j['bands'] as List<dynamic>)
            .map((e) => TerrainBand.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
