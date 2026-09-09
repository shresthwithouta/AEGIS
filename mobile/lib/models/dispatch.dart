/// The dispatch order, as the command centre issues it.
///
/// These classes mirror `dispatchOrder` from the console's pipeline
/// (`src/lib/aegis/pipeline.js`, `dispatchNode`) field for field. The field app
/// never recomputes an order and never invents one — it receives, holds, reads
/// out and acknowledges. Anything it derives locally is derived for display
/// only and is labelled as such on screen.
library;

int _int(Object? v, [int fallback = 0]) => switch (v) {
      final int i => i,
      final double d => d.round(),
      final String s => int.tryParse(s) ?? fallback,
      _ => fallback,
    };

double? _double(Object? v) => switch (v) {
      final double d => d,
      final int i => i.toDouble(),
      final String s => double.tryParse(s),
      _ => null,
    };

String? _str(Object? v) => v is String && v.isNotEmpty ? v : null;

/// What a zone was given. The four resource classes the console allocates.
class Allocation {
  const Allocation({this.boats = 0, this.ambulances = 0, this.teams = 0, this.divers = 0});

  final int boats;
  final int ambulances;
  final int teams;
  final int divers;

  int get total => boats + ambulances + teams + divers;

  /// The kit line as the order text renders it: "2 boat, 1 team".
  String get summary {
    final parts = <String>[
      if (boats > 0) '$boats boat',
      if (teams > 0) '$teams team',
      if (ambulances > 0) '$ambulances ambulance',
      if (divers > 0) '$divers dive pair',
    ];
    return parts.isEmpty ? 'No units allocated' : parts.join(', ');
  }

  factory Allocation.fromJson(Map<dynamic, dynamic>? j) => Allocation(
        boats: _int(j?['boats']),
        ambulances: _int(j?['ambulances']),
        teams: _int(j?['teams']),
        divers: _int(j?['divers']),
      );

  Map<String, dynamic> toJson() => {
        'boats': boats,
        'ambulances': ambulances,
        'teams': teams,
        'divers': divers,
      };
}

/// A named officer's decision at one of the two approval gates.
///
/// The app carries this because a crew is entitled to see who committed them —
/// an unsigned order is not an order, and the app says so rather than hiding
/// the absence.
class Approval {
  const Approval({required this.gate, this.officer, this.designation, this.at, this.remark});

  final int gate;
  final String? officer;
  final String? designation;
  final DateTime? at;
  final String? remark;

  bool get isSigned => officer != null && officer!.trim().isNotEmpty;

  factory Approval.fromJson(int gate, Map<dynamic, dynamic>? j) => Approval(
        gate: gate,
        officer: _str(j?['officer']),
        designation: _str(j?['designation']),
        at: DateTime.tryParse(_str(j?['at']) ?? ''),
        remark: _str(j?['remark']),
      );

  Map<String, dynamic> toJson() => {
        'gate': gate,
        'officer': officer,
        'designation': designation,
        'at': at?.toIso8601String(),
        'remark': remark,
      };
}

/// How the crew moves. `blocked` is not a failure of the app — it is the
/// console reporting that what this zone was given cannot reach it, and the
/// crew needs to see that before they set out, not after.
enum MoveMode {
  vehicle,
  boat,
  blocked;

  static MoveMode parse(Object? v) => switch (v) {
        'boat' => MoveMode.boat,
        'blocked' => MoveMode.blocked,
        _ => MoveMode.vehicle,
      };

  String get label => switch (this) {
        MoveMode.vehicle => 'By road',
        MoveMode.boat => 'Amphibious',
        MoveMode.blocked => 'Blocked',
      };
}

/// One movement order — one crew, one zone.
class FieldOrder {
  const FieldOrder({
    required this.orderNo,
    required this.zoneId,
    required this.wave,
    required this.depot,
    required this.mode,
    required this.onSite,
    required this.reachable,
    required this.allocated,
    required this.waypoints,
    required this.channels,
    required this.textEn,
    required this.textHi,
    this.settlement,
    this.etaMinutes,
    this.distanceKm,
    this.issuedAt,
  });

  final String orderNo;
  final String zoneId;
  final String? settlement;
  final int wave;
  final String depot;
  final MoveMode mode;
  final bool onSite;
  final bool reachable;
  final int? etaMinutes;
  final double? distanceKm;
  final Allocation allocated;

  /// The route, as a run of zone ids. This is the whole navigation payload and
  /// it is a few hundred bytes — which is why the app can hold every order it
  /// has ever been given without a tile cache or a map download.
  final List<String> waypoints;

  final List<String> channels;
  final String textEn;
  final String textHi;
  final DateTime? issuedAt;

  String get place => settlement == null ? zoneId : '$settlement ($zoneId)';

  /// The order text in one of the two languages the console issues.
  String text(String lang) => lang == 'hi' ? textHi : textEn;

  factory FieldOrder.fromJson(Map<dynamic, dynamic> j) {
    final t = j['text'];
    return FieldOrder(
      orderNo: _str(j['orderNo']) ?? 'UNNUMBERED',
      zoneId: _str(j['zoneId']) ?? '--',
      settlement: _str(j['settlement']),
      wave: _int(j['wave'], 1),
      depot: _str(j['depot']) ?? 'Unnamed depot',
      mode: MoveMode.parse(j['mode']),
      onSite: j['onSite'] == true,
      reachable: j['reachable'] != false,
      etaMinutes: j['etaMinutes'] == null ? null : _int(j['etaMinutes']),
      distanceKm: _double(j['distanceKm']),
      allocated: Allocation.fromJson(j['allocated'] as Map<dynamic, dynamic>?),
      waypoints: (j['waypoints'] as List<dynamic>? ?? const []).map((e) => '$e').toList(),
      channels: (j['channels'] as List<dynamic>? ?? const []).map((e) => '$e').toList(),
      textEn: _str(t is Map ? t['en'] : null) ?? '',
      textHi: _str(t is Map ? t['hi'] : null) ?? '',
      issuedAt: DateTime.tryParse(_str(j['issuedAt']) ?? ''),
    );
  }

  Map<String, dynamic> toJson() => {
        'orderNo': orderNo,
        'zoneId': zoneId,
        'settlement': settlement,
        'wave': wave,
        'depot': depot,
        'mode': mode.name,
        'onSite': onSite,
        'reachable': reachable,
        'etaMinutes': etaMinutes,
        'distanceKm': distanceKm,
        'allocated': allocated.toJson(),
        'waypoints': waypoints,
        'channels': channels,
        'text': {'en': textEn, 'hi': textHi},
        'issuedAt': issuedAt?.toIso8601String(),
      };
}

/// The whole signed order, as one document.
class DispatchOrder {
  const DispatchOrder({
    required this.fileNo,
    required this.issuedAt,
    required this.incident,
    required this.district,
    required this.orders,
    required this.waves,
    required this.delivery,
    this.gate1,
    this.gate2,
    this.synthetic = true,
  });

  final String fileNo;
  final DateTime issuedAt;
  final String incident;
  final String district;
  final Approval? gate1;
  final Approval? gate2;
  final List<FieldOrder> orders;
  final List<int> waves;

  /// The console's own honesty line about how these reach a crew.
  final String delivery;

  final bool synthetic;

  /// An order nobody signed is not an order. The app refuses to present one as
  /// actionable, and this is the check every screen asks.
  bool get isSigned => (gate1?.isSigned ?? false) && (gate2?.isSigned ?? false);

  FieldOrder? byNo(String orderNo) {
    for (final o in orders) {
      if (o.orderNo == orderNo) return o;
    }
    return null;
  }

  factory DispatchOrder.fromJson(Map<dynamic, dynamic> j) {
    final approvals = j['approvedBy'] as Map<dynamic, dynamic>?;
    final issued = DateTime.tryParse(_str(j['issuedAt']) ?? '') ?? DateTime.now();
    return DispatchOrder(
      fileNo: _str(j['fileNo']) ?? 'AEG/26206/2026-DM',
      issuedAt: issued,
      incident: _str(j['incident']) ?? 'Unnamed incident',
      district: _str(j['district']) ?? '--',
      gate1: approvals?['gate1'] == null
          ? null
          : Approval.fromJson(1, approvals!['gate1'] as Map<dynamic, dynamic>?),
      gate2: approvals?['gate2'] == null
          ? null
          : Approval.fromJson(2, approvals!['gate2'] as Map<dynamic, dynamic>?),
      orders: (j['orders'] as List<dynamic>? ?? const [])
          .whereType<Map<dynamic, dynamic>>()
          .map((e) => FieldOrder.fromJson({...e, 'issuedAt': issued.toIso8601String()}))
          .toList(),
      waves: (j['waves'] as List<dynamic>? ?? const []).map((e) => _int(e, 1)).toList(),
      delivery: _str(j['delivery']) ?? '',
      synthetic: j['synthetic'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
        'fileNo': fileNo,
        'issuedAt': issuedAt.toIso8601String(),
        'incident': incident,
        'district': district,
        'approvedBy': {'gate1': gate1?.toJson(), 'gate2': gate2?.toJson()},
        'orders': orders.map((o) => o.toJson()).toList(),
        'waves': waves,
        'delivery': delivery,
        'synthetic': synthetic,
      };
}
