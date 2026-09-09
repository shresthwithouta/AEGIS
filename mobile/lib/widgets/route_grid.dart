import 'package:flutter/material.dart';

import '../models/terrain.dart';
import '../theme/theme.dart';
import '../theme/tokens.dart';
import '../theme/typography.dart';

/// The schematic zone-grid route view.
///
/// Deliberately not a street map. There is no real road geometry behind this
/// incident — the console itself draws the same abstract 10×10 grid
/// (`ZoneGrid.js`) rather than pretending to Leaflet/Mapbox precision it does
/// not have. This widget is that same honest picture, vector-drawn entirely
/// from the bundled `terrain.json`, so it costs nothing to render offline: a
/// severity edge per cell, roads as the paths they actually are, a bridge
/// mark where one is out, and the crew's assigned route traced zone to zone.
class RouteGrid extends StatelessWidget {
  const RouteGrid({
    required this.terrain,
    super.key,
    this.route = const [],
    this.currentZone,
    this.nearestZone,
    this.highlightZones = const {},
  });

  final Terrain terrain;

  /// The assigned route, as a run of zone ids — straight from `FieldOrder.waypoints`.
  final List<String> route;

  /// The destination / depot zone to ring distinctly.
  final String? currentZone;

  /// The zone GPS says the device is nearest to right now, if location is on.
  final String? nearestZone;

  final Set<String> highlightZones;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return AspectRatio(
      aspectRatio: 1,
      child: LayoutBuilder(
        builder: (context, box) {
          final cell = box.maxWidth / terrain.grid;
          return CustomPaint(
            painter: _GridPainter(
              terrain: terrain,
              route: route,
              currentZone: currentZone,
              nearestZone: nearestZone,
              highlight: highlightZones,
              colors: c,
              cell: cell,
            ),
            size: Size(box.maxWidth, box.maxWidth),
          );
        },
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  _GridPainter({
    required this.terrain,
    required this.route,
    required this.currentZone,
    required this.nearestZone,
    required this.highlight,
    required this.colors,
    required this.cell,
  });

  final Terrain terrain;
  final List<String> route;
  final String? currentZone;
  final String? nearestZone;
  final Set<String> highlight;
  final AegisColors colors;
  final double cell;

  Offset _centre(String zoneId) {
    final z = terrain.zone(zoneId);
    if (z == null) return Offset.zero;
    return Offset((z.col + 0.5) * cell, (z.row + 0.5) * cell);
  }

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Zone fills — severity at low opacity, the Edge-Not-Fill Rule relaxed
    //    only this far because a filled grid cell is the whole legibility of
    //    a map; the rule still holds for every chip and numeral drawn on top.
    for (final z in terrain.zones) {
      final rect = Rect.fromLTWH(z.col * cell, z.row * cell, cell, cell);
      final band = colors.band(z.band);
      canvas.drawRect(rect, Paint()..color = band.withValues(alpha: 0.16));
      canvas.drawRect(
        rect,
        Paint()
          ..color = colors.ruleSoft
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5,
      );
    }

    // 2. Roads.
    final roadPaint = Paint()
      ..color = colors.ink3
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (final r in terrain.roads) {
      final path = Path();
      for (var i = 0; i < r.path.length; i++) {
        final p = _centre(r.path[i]);
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      canvas.drawPath(path, roadPaint);
    }

    // 3. Bridges — a mark at the zone, coloured by status.
    for (final b in terrain.bridges) {
      final p = _centre(b.zone);
      final bridgeColor = b.isOpen ? colors.seal : colors.tape;
      canvas.drawCircle(p, cell * 0.14, Paint()..color = colors.sheet);
      canvas.drawCircle(
        p,
        cell * 0.14,
        Paint()
          ..color = bridgeColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }

    // 4. Highlighted zones (e.g. other live orders).
    for (final id in highlight) {
      final z = terrain.zone(id);
      if (z == null) continue;
      final rect = Rect.fromLTWH(z.col * cell, z.row * cell, cell, cell);
      canvas.drawRect(
        rect,
        Paint()
          ..color = colors.pencil
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }

    // 5. The assigned route — the stamp-violet authority line.
    if (route.length > 1) {
      final path = Path();
      for (var i = 0; i < route.length; i++) {
        final p = _centre(route[i]);
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = colors.stamp
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.5
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      for (final id in route) {
        canvas.drawCircle(_centre(id), 2.5, Paint()..color = colors.stamp);
      }
    }

    // 6. The GPS-nearest zone — a soft pencil ring, provisional by nature.
    if (nearestZone != null) {
      canvas.drawCircle(
        _centre(nearestZone!),
        cell * 0.38,
        Paint()
          ..color = colors.pencil
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }

    // 7. The destination zone — a hard stamp-coloured ring on top of everything.
    if (currentZone != null) {
      canvas.drawCircle(
        _centre(currentZone!),
        cell * 0.30,
        Paint()
          ..color = colors.stamp
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _GridPainter old) =>
      old.route != route ||
      old.currentZone != currentZone ||
      old.nearestZone != nearestZone ||
      old.highlight != highlight ||
      old.colors != colors;
}

/// A small legend row for the grid — what each mark means, since the grid
/// itself carries no text.
class RouteGridLegend extends StatelessWidget {
  const RouteGridLegend({super.key});

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    Widget item(Color color, String label, {bool ring = false}) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ring ? Colors.transparent : color,
                border: ring ? Border.all(color: color, width: 2) : null,
              ),
            ),
            const SizedBox(width: 6),
            Text(label, style: AegisType.microLabel(c.ink3)),
          ],
        );

    return Wrap(
      spacing: Space.lg,
      runSpacing: Space.xs,
      children: [
        item(c.stamp, 'ROUTE'),
        item(c.stamp, 'DESTINATION', ring: true),
        item(c.pencil, 'GPS NEAREST', ring: true),
        item(c.tape, 'BRIDGE OUT', ring: true),
      ],
    );
  }
}
