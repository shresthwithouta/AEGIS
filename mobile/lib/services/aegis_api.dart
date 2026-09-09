import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/dispatch.dart';

/// The command-centre link.
///
/// This talks to the same Next.js console the DEOC runs
/// (`src/app/api/*`) — specifically the read endpoints that were built
/// with this app in mind: `GET /api/zones` names the Flutter field client
/// directly in its own doctring, and `GET /api/register` is the append-only
/// audit trail an acknowledgement is written back into.
///
/// Every call here is wrapped so a failure returns null/false rather than
/// throwing into a screen. A field crew's phone has no business crashing
/// because the control room's wifi dropped — that is precisely the condition
/// this whole app exists to survive.
class AegisApi {
  AegisApi({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  /// e.g. https://aegis-deoc.example.org — set from Settings. Empty/null
  /// means "no server configured", which is a fully supported, fully offline
  /// mode, not a degraded one.
  final String? baseUrl;
  final http.Client _client;

  bool get configured => baseUrl != null && baseUrl!.trim().isNotEmpty;

  Uri? _uri(String path, [Map<String, String>? query]) {
    if (!configured) return null;
    final base = baseUrl!.trim().replaceAll(RegExp(r'/+$'), '');
    try {
      return Uri.parse('$base$path').replace(queryParameters: query);
    } catch (_) {
      return null;
    }
  }

  static const _timeout = Duration(seconds: 8);

  /// Whether the console is currently reachable at all. Used to decide
  /// whether to show "checking for orders" or just quietly stay offline.
  Future<bool> ping() async {
    final uri = _uri('/api/status');
    if (uri == null) return false;
    try {
      final res = await _client.get(uri).timeout(_timeout);
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// The 100-zone summary — severity distribution, top zones, requirement.
  /// Used only to refresh the offline terrain picture when a signal is
  /// available; the bundled snapshot is always there as the floor.
  Future<Map<String, dynamic>?> fetchZoneSummary({bool full = false}) async {
    final uri = _uri('/api/zones', full ? {'detail': 'full'} : null);
    if (uri == null) return null;
    try {
      final res = await _client.get(uri).timeout(_timeout);
      if (res.statusCode != 200) return null;
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  /// Poll for the current state of a pipeline run this crew is named in.
  /// Present because the console exposes it (`GET /api/pipeline`); most
  /// deployments instead push a dispatch order to the crew via a bespoke
  /// field-orders endpoint the district stands up, which is why every call
  /// here degrades to "nothing new" rather than an error state.
  Future<DispatchOrder?> fetchRunDispatch(String threadId) async {
    final uri = _uri('/api/pipeline', {'threadId': threadId});
    if (uri == null) return null;
    try {
      final res = await _client.get(uri).timeout(_timeout);
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final order = (body['state'] as Map?)?['dispatchOrder'];
      if (order is! Map) return null;
      return DispatchOrder.fromJson(order.cast<String, dynamic>());
    } catch (_) {
      return null;
    }
  }

  /// Writes the crew's acknowledgement to the district's audit register so an
  /// "order received" fact exists somewhere other than this phone.
  ///
  /// The console's own `/api/register` is read-only by design (see its own
  /// comment: "there is deliberately no delete or update route") — a field
  /// deployment adds a narrow, additive `POST /api/field/ack` endpoint beside
  /// it rather than opening that one up, which is why this call tolerates a
  /// 404 exactly like every other failure: silently, by queuing for later.
  Future<bool> sendAcknowledgement(Map<String, dynamic> entry) async {
    final uri = _uri('/api/field/ack');
    if (uri == null) return false;
    try {
      final res = await _client
          .post(uri, headers: const {'Content-Type': 'application/json'}, body: jsonEncode(entry))
          .timeout(_timeout);
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  void close() => _client.close();
}
