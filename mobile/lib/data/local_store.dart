import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

import '../models/alert.dart';
import '../models/dispatch.dart';

/// The device store. Every box here is a plain `Map<String, dynamic>` box —
/// no generated Hive adapters — because a `TypeAdapter` mismatch after a model
/// change is exactly the kind of thing that breaks silently on a device
/// nobody is watching. JSON in, JSON out, the same `fromJson`/`toJson` pair the
/// network path uses, so there is one decode path in the whole app, not two.
///
/// Everything here is written before it is read back, which is the whole
/// offline argument: a crew that loses signal one minute after receiving an
/// order still has the order, its route and its own acknowledgement, because
/// all three were on the device before the signal went.
class LocalStore {
  LocalStore._();
  static final LocalStore instance = LocalStore._();

  static const _ordersBox = 'aegis_orders';
  static const _alertsBox = 'aegis_alerts';
  static const _outboxBox = 'aegis_outbox';
  static const _prefsBox = 'aegis_prefs';

  late Box<String> _orders;
  late Box<String> _alerts;
  late Box<Map> _outbox;
  late Box _prefs;

  bool _ready = false;
  bool get isReady => _ready;

  Future<void> open() async {
    if (_ready) return;
    await Hive.initFlutter();
    _orders = await Hive.openBox<String>(_ordersBox);
    _alerts = await Hive.openBox<String>(_alertsBox);
    _outbox = await Hive.openBox<Map>(_outboxBox);
    _prefs = await Hive.openBox(_prefsBox);
    _ready = true;
  }

  // ---- Dispatch orders ------------------------------------------------

  /// Every order ever held, most recently issued first. A crew's order
  /// history is itself a safety record — "what were we told, and when" is a
  /// question that gets asked after every incident.
  List<DispatchOrder> allOrders() {
    final out = <DispatchOrder>[];
    for (final raw in _orders.values) {
      try {
        out.add(DispatchOrder.fromJson(jsonDecode(raw) as Map<String, dynamic>));
      } catch (_) {
        // A corrupted single record must not take the whole inbox down.
      }
    }
    out.sort((a, b) => b.issuedAt.compareTo(a.issuedAt));
    return out;
  }

  DispatchOrder? order(String fileNo) {
    final raw = _orders.get(fileNo);
    if (raw == null) return null;
    return DispatchOrder.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> saveOrder(DispatchOrder order) =>
      _orders.put(order.fileNo, jsonEncode(order.toJson()));

  // ---- Alerts -----------------------------------------------------------

  List<Alert> allAlerts() {
    final out = <Alert>[];
    for (final raw in _alerts.values) {
      try {
        out.add(Alert.fromJson(jsonDecode(raw) as Map<String, dynamic>));
      } catch (_) {
        /* skip a corrupted record */
      }
    }
    out.sort((a, b) {
      final p = a.precedence.rank.compareTo(b.precedence.rank);
      if (p != 0) return p;
      return b.at.compareTo(a.at);
    });
    return out;
  }

  Future<void> saveAlert(Alert alert) => _alerts.put(alert.id, jsonEncode(alert.toJson()));

  Future<void> saveAlerts(Iterable<Alert> alerts) async {
    final entries = {for (final a in alerts) a.id: jsonEncode(a.toJson())};
    await _alerts.putAll(entries);
  }

  // ---- Outbox -------------------------------------------------------------
  //
  // Acknowledgements queue here the instant a crew presses the stamp, whether
  // or not a network exists at that moment. `SyncService` drains this
  // whenever a connection appears. A signed act must never depend on a signal
  // bar to be recorded — the record is the press, the transmission is just
  // delivery.

  List<Map<String, dynamic>> outbox() =>
      _outbox.values.map((m) => Map<String, dynamic>.from(m)).toList();

  Future<void> enqueue(Map<String, dynamic> entry) async {
    final id = '${entry['id']}-${DateTime.now().microsecondsSinceEpoch}';
    await _outbox.put(id, entry);
  }

  Future<void> removeFromOutbox(Iterable<String> keys) async {
    await _outbox.deleteAll(keys);
  }

  /// Keys paired with entries, so a caller can remove exactly what it sent.
  Map<String, Map<String, dynamic>> outboxEntries() => {
        for (final k in _outbox.keys) '$k': Map<String, dynamic>.from(_outbox.get(k)!),
      };

  // ---- Preferences --------------------------------------------------------

  String? get serverUrl => _prefs.get('serverUrl') as String?;
  Future<void> setServerUrl(String? v) => _prefs.put('serverUrl', v);

  String? get crewId => _prefs.get('crewId') as String?;
  Future<void> setCrewId(String v) => _prefs.put('crewId', v);

  String? get crewName => _prefs.get('crewName') as String?;
  Future<void> setCrewName(String v) => _prefs.put('crewName', v);

  String get language => (_prefs.get('language') as String?) ?? 'en';
  Future<void> setLanguage(String v) => _prefs.put('language', v);

  String get ground => (_prefs.get('ground') as String?) ?? 'system';
  Future<void> setGround(String v) => _prefs.put('ground', v);

  bool get seeded => (_prefs.get('seeded') as bool?) ?? false;
  Future<void> setSeeded(bool v) => _prefs.put('seeded', v);
}
