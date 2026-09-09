import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/theme.dart';
import '../theme/tokens.dart';
import '../theme/typography.dart';

/// The press-and-hold acknowledgement.
///
/// Mirrors the console's own approval gate: "both gates are load-bearing UI,
/// not a confirm dialog... a stamp you press and hold." A single tap can be a
/// slip of a thumb in a moving boat; a sustained press across ~900ms cannot.
/// The commitment is the hold, not the release — exactly the console's
/// argument for why the mechanism lives where it cannot be bypassed.
class StampButton extends StatefulWidget {
  const StampButton({
    required this.label,
    required this.onCommit,
    super.key,
    this.holdMs = 900,
    this.tone = StampTone.commit,
  });

  final String label;
  final Future<void> Function() onCommit;
  final int holdMs;
  final StampTone tone;

  @override
  State<StampButton> createState() => _StampButtonState();
}

enum StampTone { commit, halt }

class _StampButtonState extends State<StampButton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: widget.holdMs),
  );
  bool _committing = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && !_done) {
        _commit();
      }
    });
  }

  Future<void> _commit() async {
    if (_done) return;
    setState(() => _committing = true);
    await widget.onCommit();
    if (!mounted) return;
    setState(() {
      _done = true;
      _committing = false;
    });
  }

  void _start() {
    if (_done) return;
    _controller.forward(from: 0);
  }

  void _cancel() {
    if (_done || _committing) return;
    _controller.reverse();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    final tone = widget.tone == StampTone.halt ? c.tape : c.stamp;

    if (_done) {
      return Container(
        height: Space.target + 16,
        alignment: Alignment.center,
        decoration: BoxDecoration(border: Border.all(color: c.seal, width: 1.5)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check, color: c.seal, size: 18),
            const SizedBox(width: Space.sm),
            Text('ACKNOWLEDGED', style: AegisType.label(c.seal)),
          ],
        ),
      );
    }

    return GestureDetector(
      onLongPressStart: (_) => _start(),
      onLongPressEnd: (_) => _cancel(),
      onLongPressCancel: _cancel,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final t = _controller.value;
          return Container(
            height: Space.target + 16,
            decoration: BoxDecoration(border: Border.all(color: tone, width: 1.5)),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Positioned.fill(
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: t.clamp(0.0, 1.0),
                    child: Container(color: tone.withValues(alpha: 0.22)),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_committing ? Icons.hourglass_top : Icons.touch_app, color: tone, size: 18),
                    const SizedBox(width: Space.sm),
                    Text(
                      t > 0.02 && t < 1 ? 'HOLD…' : widget.label.toUpperCase(),
                      style: AegisType.label(c.ink),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
