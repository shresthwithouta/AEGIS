import 'dart:async';

import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models/alert.dart';
import '../models/dispatch.dart';
import '../services/location_service.dart';
import '../services/voice_service.dart';
import '../theme/theme.dart';
import '../theme/tokens.dart';
import '../theme/typography.dart';
import '../widgets/route_grid.dart';
import '../widgets/ruled.dart';
import '../widgets/stamp_button.dart';

/// One order, in full: what was allocated, the route, both languages of the
/// field instruction read aloud on demand, and — for immediate traffic — the
/// stamp that signs the acknowledgement back to the control room.
class OrderScreen extends StatefulWidget {
  const OrderScreen({required this.repo, required this.orderNo, super.key, this.alert});
  final AegisRepository repo;
  final String orderNo;
  final Alert? alert;

  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends State<OrderScreen> {
  final _voice = VoiceService();
  final _location = LocationService();
  String? _speaking;
  String? _nearestZone;
  bool _locationOn = false;
  StreamSubscription<String?>? _zoneSub;

  FieldOrder? get _order => widget.repo.orderByNumber(widget.orderNo);

  @override
  void dispose() {
    _voice.dispose();
    _zoneSub?.cancel();
    _location.dispose();
    super.dispose();
  }

  Future<void> _toggleLocation() async {
    final terrain = widget.repo.terrain;
    if (terrain == null) return;
    if (_locationOn) {
      await _location.stop();
      setState(() {
        _locationOn = false;
        _nearestZone = null;
      });
      return;
    }
    final ok = await _location.start(
      terrain,
      centreLat: 26.1542,
      centreLon: 85.8918,
    );
    if (!ok) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location permission denied or GPS unavailable.')),
        );
      }
      return;
    }
    _zoneSub?.cancel();
    _zoneSub = _location.nearestZoneStream.listen((z) {
      if (mounted) setState(() => _nearestZone = z);
    });
    setState(() => _locationOn = true);
  }

  Future<void> _speak(String id, String text, String lang) async {
    if (_speaking == id) {
      await _voice.stop();
      setState(() => _speaking = null);
      return;
    }
    setState(() => _speaking = id);
    final usedRequested = await _voice.speak(id, text, lang: lang);
    if (mounted) setState(() => _speaking = null);
    if (!usedRequested && lang == 'hi' && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No Hindi voice installed on this device — read in English instead.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    final order = _order;
    final terrain = widget.repo.terrain;
    final lang = widget.repo.language;

    if (order == null) {
      return Scaffold(
        appBar: const Masthead(title: 'Order'),
        body: Center(child: Text('Order not found on this device.', style: AegisType.body(c.ink2))),
      );
    }

    final modeColor = switch (order.mode) {
      MoveMode.blocked => c.tape,
      MoveMode.boat => c.water,
      MoveMode.vehicle => c.seal,
    };

    return AnimatedBuilder(
      animation: widget.repo,
      builder: (context, _) {
        final alert = widget.repo.alerts.firstWhere(
          (a) => a.orderNo == order.orderNo,
          orElse: () => widget.alert ??
              Alert(
                id: order.orderNo,
                kind: AlertKind.order,
                precedence: Precedence.routine,
                title: order.place,
                body: '',
                at: order.issuedAt ?? DateTime.now(),
                orderNo: order.orderNo,
              ),
        );

        return Scaffold(
          appBar: Masthead(title: order.orderNo, subtitle: order.place),
          body: ListView(
            children: [
              const SheetHead(title: 'Assignment'),
              RuledRow(
                child: Row(
                  children: [
                    Expanded(child: FieldValue(label: 'Kit', value: order.allocated.summary)),
                    EdgeChip(label: order.mode.label, color: modeColor),
                  ],
                ),
              ),
              RuledRow(
                child: Row(
                  children: [
                    Expanded(child: FieldValue(label: 'From', value: order.depot)),
                    if (order.etaMinutes != null)
                      FieldValue(label: 'ETA', value: order.onSite ? 'On site' : '${order.etaMinutes} min'),
                  ],
                ),
              ),
              if (order.distanceKm != null)
                RuledRow(child: FieldValue(label: 'Distance', value: '${order.distanceKm} km')),
              if (order.mode == MoveMode.blocked)
                RuledRow(
                  child: Container(
                    padding: const EdgeInsets.all(Space.sm),
                    decoration: BoxDecoration(border: Border.all(color: c.tape, width: 1.5)),
                    child: Text(
                      'No rescue craft allocated to a zone under water — wheeled units cannot enter. Hold and report to the depot.',
                      style: AegisType.bodyDense(c.ink),
                    ),
                  ),
                ),

              if (terrain != null) ...[
                const SheetHead(title: 'Route'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
                  child: Column(
                    children: [
                      RouteGrid(
                        terrain: terrain,
                        route: order.waypoints,
                        currentZone: order.zoneId,
                        nearestZone: _nearestZone,
                      ),
                      const SizedBox(height: Space.sm),
                      const RouteGridLegend(),
                      const SizedBox(height: Space.md),
                    ],
                  ),
                ),
                RuledRow(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _locationOn
                              ? (_nearestZone == null
                                  ? 'Acquiring GPS fix…'
                                  : 'GPS nearest zone: $_nearestZone. Approximate — flat projection over a 10 km grid, not a surveyed boundary.')
                              : 'Turn on device location to see which zone you are nearest to. No live street routing exists for this incident — the grid above is the same schematic picture the command centre uses.',
                          style: AegisType.bodyDense(c.ink3),
                        ),
                      ),
                      Switch(value: _locationOn, onChanged: (_) => _toggleLocation(), activeThumbColor: c.stamp),
                    ],
                  ),
                ),
              ],

              SheetHead(
                title: 'Field instruction',
                trailing: _LangToggle(
                  lang: lang,
                  onChanged: (l) => widget.repo.setLanguage(l),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
                child: _InstructionBlock(
                  text: order.text(lang),
                  hindi: lang == 'hi',
                  speaking: _speaking == order.orderNo,
                  onSpeak: () => _speak(order.orderNo, order.text(lang), lang),
                ),
              ),
              const SizedBox(height: Space.lg),

              if (alert.needsAcknowledgement) ...[
                const SheetHead(title: 'Acknowledgement'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Press and hold to confirm this order is received and the crew is moving. '
                        'The acknowledgement is recorded on this device immediately${widget.repo.online ? ' and sent to the command centre now.' : ' and will reach the command centre once a connection is available.'}',
                        style: AegisType.bodyDense(c.ink3),
                      ),
                      const SizedBox(height: Space.md),
                      StampButton(
                        label: 'Hold to acknowledge',
                        onCommit: () => widget.repo.acknowledge(
                          alert,
                          officer: widget.repo.crewName ?? 'FIELD CREW',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: Space.xxl),
              ] else if (alert.isAcknowledged) ...[
                const SheetHead(title: 'Acknowledgement'),
                RuledRow(
                  child: FieldValue(
                    label: 'Acknowledged',
                    value: _fmt(alert.acknowledgedAt!),
                    valueColor: c.seal,
                  ),
                ),
                const SizedBox(height: Space.xxl),
              ],
            ],
          ),
        );
      },
    );
  }
}

String _fmt(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')} · '
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';

class _LangToggle extends StatelessWidget {
  const _LangToggle({required this.lang, required this.onChanged});
  final String lang;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    Widget seg(String code, String label) {
      final active = lang == code;
      return InkWell(
        onTap: () => onChanged(code),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: 4),
          decoration: BoxDecoration(border: Border.all(color: active ? c.stamp : c.controlEdge)),
          child: Text(label, style: AegisType.microLabel(active ? c.stamp : c.ink3)),
        ),
      );
    }

    return Row(mainAxisSize: MainAxisSize.min, children: [seg('en', 'EN'), const SizedBox(width: 6), seg('hi', 'हि')]);
  }
}

class _InstructionBlock extends StatelessWidget {
  const _InstructionBlock({
    required this.text,
    required this.hindi,
    required this.speaking,
    required this.onSpeak,
  });
  final String text;
  final bool hindi;
  final bool speaking;
  final VoidCallback onSpeak;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Space.md),
      decoration: BoxDecoration(border: Border.all(color: c.rule)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            text,
            style: hindi ? AegisType.devanagari(c.ink) : AegisType.bodyDense(c.ink),
          ),
          const SizedBox(height: Space.md),
          Rule(soft: true),
          const SizedBox(height: Space.sm),
          InkWell(
            onTap: onSpeak,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(speaking ? Icons.stop_circle_outlined : Icons.volume_up_outlined, color: c.stamp, size: 20),
                const SizedBox(width: Space.sm),
                Text(speaking ? 'STOP READING' : 'READ ALOUD', style: AegisType.label(c.stamp)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
