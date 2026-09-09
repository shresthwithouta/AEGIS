/// Alerts — what actually wakes the phone.
///
/// The app is an alerting client first and a document reader second. Everything
/// the control room needs a crew to *know* arrives here: a new movement order,
/// an amendment to one already held, a recall, a hazard warning on the route,
/// a stand-down. The order document itself is what the crew opens afterwards.
library;

/// Message precedence, in the sense a signals log means it. It drives whether
/// the phone makes noise, how the row is ruled, and the sort order — not the
/// colour of any text.
enum Precedence {
  /// Act now. Breaks through silent, repeats, and cannot be swiped away
  /// unread.
  immediate,

  /// Act this shift.
  priority,

  /// Read when you can.
  routine;

  static Precedence parse(Object? v) => switch (v) {
        'immediate' => Precedence.immediate,
        'routine' => Precedence.routine,
        _ => Precedence.priority,
      };

  String get label => switch (this) {
        Precedence.immediate => 'IMMEDIATE',
        Precedence.priority => 'PRIORITY',
        Precedence.routine => 'ROUTINE',
      };

  /// Immediate sorts above priority sorts above routine.
  int get rank => switch (this) {
        Precedence.immediate => 0,
        Precedence.priority => 1,
        Precedence.routine => 2,
      };
}

enum AlertKind {
  /// A new movement order has been issued to this crew.
  order,

  /// An order the crew already holds has changed.
  amendment,

  /// An order is withdrawn. The crew must stop and confirm they have stopped.
  recall,

  /// A hazard on or near the crew's route — a bridge gone, a gauge crossing.
  hazard,

  /// The crew is released.
  standDown,

  /// Free text from the control room.
  message;

  static AlertKind parse(Object? v) => switch (v) {
        'amendment' => AlertKind.amendment,
        'recall' => AlertKind.recall,
        'hazard' => AlertKind.hazard,
        'standDown' || 'stand_down' => AlertKind.standDown,
        'message' => AlertKind.message,
        _ => AlertKind.order,
      };

  String get label => switch (this) {
        AlertKind.order => 'MOVEMENT ORDER',
        AlertKind.amendment => 'AMENDMENT',
        AlertKind.recall => 'RECALL',
        AlertKind.hazard => 'HAZARD',
        AlertKind.standDown => 'STAND DOWN',
        AlertKind.message => 'MESSAGE',
      };
}

class Alert {
  const Alert({
    required this.id,
    required this.kind,
    required this.precedence,
    required this.title,
    required this.body,
    required this.at,
    this.orderNo,
    this.bodyHi,
    this.acknowledgedAt,
    this.readAt,
    this.source = 'Command centre',
  });

  final String id;
  final AlertKind kind;
  final Precedence precedence;
  final String title;
  final String body;

  /// The Hindi rendering, when the control room sent one. Absent is normal —
  /// a hazard note typed by a duty officer at 03:00 will not be translated,
  /// and the app must not pretend otherwise by echoing the English.
  final String? bodyHi;

  final DateTime at;
  final String? orderNo;

  /// When the crew opened it.
  final DateTime? readAt;

  /// When the crew pressed the stamp. Distinct from reading it: an
  /// acknowledgement is a signed act that goes back to the control room, and
  /// opening a screen is not.
  final DateTime? acknowledgedAt;

  final String source;

  bool get isRead => readAt != null;
  bool get isAcknowledged => acknowledgedAt != null;

  /// Immediate traffic must be signed for, not merely opened.
  bool get needsAcknowledgement => !isAcknowledged && precedence == Precedence.immediate;

  String bodyFor(String lang) => lang == 'hi' ? (bodyHi ?? body) : body;

  /// True when the Hindi shown is really the English, so the screen can say so
  /// instead of quietly presenting untranslated text as a translation.
  bool untranslated(String lang) => lang == 'hi' && bodyHi == null;

  Alert copyWith({DateTime? readAt, DateTime? acknowledgedAt}) => Alert(
        id: id,
        kind: kind,
        precedence: precedence,
        title: title,
        body: body,
        bodyHi: bodyHi,
        at: at,
        orderNo: orderNo,
        readAt: readAt ?? this.readAt,
        acknowledgedAt: acknowledgedAt ?? this.acknowledgedAt,
        source: source,
      );

  factory Alert.fromJson(Map<dynamic, dynamic> j) => Alert(
        id: '${j['id'] ?? DateTime.now().microsecondsSinceEpoch}',
        kind: AlertKind.parse(j['kind']),
        precedence: Precedence.parse(j['precedence']),
        title: '${j['title'] ?? 'Untitled'}',
        body: '${j['body'] ?? ''}',
        bodyHi: j['bodyHi'] is String && (j['bodyHi'] as String).isNotEmpty ? j['bodyHi'] as String : null,
        at: DateTime.tryParse('${j['at']}') ?? DateTime.now(),
        orderNo: j['orderNo'] is String ? j['orderNo'] as String : null,
        readAt: DateTime.tryParse('${j['readAt']}'),
        acknowledgedAt: DateTime.tryParse('${j['acknowledgedAt']}'),
        source: '${j['source'] ?? 'Command centre'}',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind.name,
        'precedence': precedence.name,
        'title': title,
        'body': body,
        'bodyHi': bodyHi,
        'at': at.toIso8601String(),
        'orderNo': orderNo,
        'readAt': readAt?.toIso8601String(),
        'acknowledgedAt': acknowledgedAt?.toIso8601String(),
        'source': source,
      };
}
