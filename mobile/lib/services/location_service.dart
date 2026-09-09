import 'dart:async';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';

import '../models/terrain.dart';

/// GPS, folded down to "which zone is the device nearest to".
///
/// There is no real street geometry in this incident (see route_grid.dart),
/// so there is no honest turn-by-turn to offer. What GPS *can* do reliably —
/// confirm which of the 100 zones a crew is actually standing in versus the
/// zone their order names — is worth having, and is exactly what this
/// service provides. Denied permission, no GPS fix, and airplane mode are all
/// the same case here: the stream simply emits nothing, and the UI already
/// treats "no nearest zone" as a normal state, not an error.
class LocationService {
  StreamSubscription<Position>? _sub;
  final _zoneController = StreamController<String?>.broadcast();

  Stream<String?> get nearestZoneStream => _zoneController.stream;
  String? _lastZone;
  String? get lastZone => _lastZone;

  Future<bool> _ensurePermission() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
        return false;
      }
      return await Geolocator.isLocationServiceEnabled();
    } catch (_) {
      return false;
    }
  }

  /// [terrain] provides the grid's real-world anchor: one lat/lon for the
  /// area-of-interest centre, at [zoneKm] per zone. That is the only
  /// geo-reference this incident actually has, so the nearest-zone
  /// calculation is a flat local projection around it — adequate at 10km
  /// scale, and honestly labelled as an approximation, never as surveyed
  /// zone boundaries.
  Future<bool> start(
    Terrain terrain, {
    required double centreLat,
    required double centreLon,
    double zoneKm = 1,
  }) async {
    if (!await _ensurePermission()) return false;

    await _sub?.cancel();
    const metresPerDegreeLat = 111320.0;
    final metresPerDegreeLon = 111320.0 * _cos(centreLat);
    final gridSpan = terrain.grid * zoneKm * 1000;

    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 15),
    ).listen((pos) {
      final dyM = (pos.latitude - centreLat) * metresPerDegreeLat;
      final dxM = (pos.longitude - centreLon) * metresPerDegreeLon;
      // Grid origin (col 0, row 0) sits at the AOI's north-west corner; the
      // centre lat/lon is the AOI's centre, so offset by half the span.
      final x = (dxM + gridSpan / 2) / (zoneKm * 1000);
      final y = (dyM + gridSpan / 2) / (zoneKm * 1000);
      final col = x.floor().clamp(0, terrain.grid - 1);
      final row = y.floor().clamp(0, terrain.grid - 1);

      String? nearest;
      var best = double.infinity;
      for (final z in terrain.zones) {
        if (z.col == col && z.row == row) {
          nearest = z.id;
          break;
        }
        final d = (z.col - col).abs() + (z.row - row).abs();
        if (d < best) {
          best = d.toDouble();
          nearest = z.id;
        }
      }
      _lastZone = nearest;
      _zoneController.add(nearest);
    }, onError: (_) => _zoneController.add(null));

    return true;
  }

  double _cos(double degrees) {
    // Avoids pulling dart:math just for one call site's worth of use;
    // inlined Taylor-adequate approximation is unnecessary at these
    // latitudes, so use the real thing.
    return math.cos(degrees * math.pi / 180);
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
  }

  void dispose() {
    _sub?.cancel();
    _zoneController.close();
  }
}
