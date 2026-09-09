import 'dart:async';

import '../data/local_store.dart';
import 'aegis_api.dart';

/// Drains the outbox and polls for new traffic whenever a connection exists.
/// Never blocks the UI thread on a network call, never throws into a screen —
/// every failure just means "try again next tick", which is the correct
/// behaviour for a boat that is about to lose signal again in ninety seconds.
class SyncService {
  SyncService({required LocalStore store, required AegisApi Function() apiFactory})
      : _store = store,
        _apiFactory = apiFactory;

  final LocalStore _store;
  final AegisApi Function() _apiFactory;
  Timer? _timer;
  bool _syncing = false;

  bool _online = false;
  bool get online => _online;

  final _onlineController = StreamController<bool>.broadcast();
  Stream<bool> get onlineStream => _onlineController.stream;

  void start({Duration every = const Duration(seconds: 45)}) {
    _timer?.cancel();
    unawaited(tick());
    _timer = Timer.periodic(every, (_) => tick());
  }

  void stop() => _timer?.cancel();

  Future<void> tick() async {
    if (_syncing) return;
    _syncing = true;
    try {
      final api = _apiFactory();
      final reachable = api.configured && await api.ping();
      if (reachable != _online) {
        _online = reachable;
        _onlineController.add(_online);
      }
      if (!reachable) return;

      final entries = _store.outboxEntries();
      if (entries.isEmpty) return;

      final sent = <String>[];
      for (final e in entries.entries) {
        final ok = await api.sendAcknowledgement(e.value);
        if (ok) sent.add(e.key);
      }
      if (sent.isNotEmpty) await _store.removeFromOutbox(sent);
    } catch (_) {
      // A sync tick failing silently is correct: the next tick tries again.
    } finally {
      _syncing = false;
    }
  }

  void dispose() {
    _timer?.cancel();
    _onlineController.close();
  }
}
