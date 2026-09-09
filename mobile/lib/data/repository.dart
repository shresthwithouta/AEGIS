import 'dart:async' show unawaited;
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../models/alert.dart';
import '../models/dispatch.dart';
import '../models/terrain.dart';
import '../services/aegis_api.dart';
import '../services/notification_service.dart';
import '../services/sync_service.dart';
import 'local_store.dart';

/// The single source of truth the whole UI listens to.
///
/// Everything a screen needs — orders, alerts, the terrain picture, whether
/// the control room is currently reachable — comes from here, and every write
/// goes through here so it lands on the device before anything else happens.
/// A crew's phone works exactly the same with the radio off as with it on;
/// this class is what makes that true rather than aspirational.
class AegisRepository extends ChangeNotifier {
  AegisRepository({LocalStore? store}) : _store = store ?? LocalStore.instance;

  final LocalStore _store;
  final NotificationService notifications = NotificationService();
  late SyncService sync;

  Terrain? _terrain;
  Terrain? get terrain => _terrain;

  bool _ready = false;
  bool get ready => _ready;

  bool get online => sync.online;

  List<DispatchOrder> get orders => _store.allOrders();
  List<Alert> get alerts => _store.allAlerts();

  int get unreadCount => alerts.where((a) => !a.isRead).length;
  int get pendingAckCount => alerts.where((a) => a.needsAcknowledgement).length;

  String get language => _store.language;
  String get ground => _store.ground;
  String? get crewName => _store.crewName;
  String? get serverUrl => _store.serverUrl;

  AegisApi buildApi() => AegisApi(baseUrl: _store.serverUrl);

  Future<void> init() async {
    if (_ready) return;
    await _store.open();
    await notifications.init();
    await _loadTerrain();
    if (!_store.seeded) await _seedDemoData();

    sync = SyncService(store: _store, apiFactory: buildApi);
    sync.onlineStream.listen((_) => notifyListeners());
    sync.start();

    _ready = true;
    notifyListeners();
  }

  Future<void> _loadTerrain() async {
    try {
      final raw = await rootBundle.loadString('assets/data/terrain.json');
      _terrain = Terrain.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (e) {
      debugPrint('AEGIS: terrain snapshot failed to load — $e');
    }
  }

  /// First-run only: seeds the bundled demo dispatch order and a matching
  /// alert, produced by the console's own pipeline
  /// (see mobile/README.md — "Where the demo data comes from"), so the app
  /// is not an empty inbox on first launch. A live deployment ships with
  /// `seeded` already true and nothing here fires.
  Future<void> _seedDemoData() async {
    try {
      final raw = await rootBundle.loadString('assets/data/demo_dispatch.json');
      final order = DispatchOrder.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      await _store.saveOrder(order);

      final wave1 = order.orders.where((o) => o.wave == 1).toList();
      for (final o in wave1) {
        await _store.saveAlert(Alert(
          id: o.orderNo,
          kind: AlertKind.order,
          precedence: Precedence.immediate,
          title: o.place,
          body: 'New movement order: ${o.allocated.summary} to ${o.place}. '
              '${o.onSite ? 'Already staged — deploy now.' : 'ETA ${o.etaMinutes ?? '—'} min.'}',
          at: order.issuedAt,
          orderNo: o.orderNo,
        ));
      }
      for (final o in order.orders.where((o) => o.wave != 1)) {
        await _store.saveAlert(Alert(
          id: o.orderNo,
          kind: AlertKind.order,
          precedence: Precedence.priority,
          title: o.place,
          body: 'Movement order held for the next operational period: ${o.allocated.summary} to ${o.place}.',
          at: order.issuedAt,
          orderNo: o.orderNo,
        ));
      }
      await _store.setSeeded(true);
    } catch (e) {
      debugPrint('AEGIS: demo seed failed — $e');
    }
  }

  // ---- Mutations ------------------------------------------------------

  Future<void> markRead(Alert alert) async {
    if (alert.isRead) return;
    await _store.saveAlert(alert.copyWith(readAt: DateTime.now()));
    notifyListeners();
  }

  /// The signed act. Recorded on-device immediately and queued for the
  /// control room's audit register whether or not a network exists right now
  /// — see LocalStore's outbox note. This is the field-side half of the
  /// console's non-negotiable: "every AI recommendation, every human
  /// approval... with actor and timestamp."
  Future<void> acknowledge(Alert alert, {required String officer}) async {
    final now = DateTime.now();
    await _store.saveAlert(alert.copyWith(readAt: alert.readAt ?? now, acknowledgedAt: now));
    await _store.enqueue({
      'id': alert.id,
      'kind': 'acknowledgement',
      'orderNo': alert.orderNo,
      'officer': officer,
      'at': now.toIso8601String(),
    });
    unawaited(notifications.clear(alert.id));
    unawaited(sync.tick());
    notifyListeners();
  }

  Future<void> receiveOrder(DispatchOrder order, {bool notify = true}) async {
    await _store.saveOrder(order);
    for (final o in order.orders) {
      final alert = Alert(
        id: o.orderNo,
        kind: AlertKind.order,
        precedence: Precedence.immediate,
        title: o.place,
        body: 'New movement order: ${o.allocated.summary} to ${o.place}.',
        at: DateTime.now(),
        orderNo: o.orderNo,
      );
      await _store.saveAlert(alert);
      if (notify) unawaited(notifications.showAlert(alert));
    }
    notifyListeners();
  }

  Future<void> setLanguage(String lang) async {
    await _store.setLanguage(lang);
    notifyListeners();
  }

  Future<void> setGround(String g) async {
    await _store.setGround(g);
    notifyListeners();
  }

  Future<void> setCrewName(String name) async {
    await _store.setCrewName(name);
    notifyListeners();
  }

  Future<void> setServerUrl(String? url) async {
    await _store.setServerUrl(url);
    notifyListeners();
    unawaited(sync.tick());
  }

  FieldOrder? orderByNumber(String orderNo) {
    for (final d in orders) {
      final o = d.byNo(orderNo);
      if (o != null) return o;
    }
    return null;
  }

  @override
  void dispose() {
    sync.dispose();
    super.dispose();
  }
}
