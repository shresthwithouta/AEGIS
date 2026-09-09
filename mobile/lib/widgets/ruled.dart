import 'package:flutter/material.dart';

import '../theme/theme.dart';
import '../theme/tokens.dart';
import '../theme/typography.dart';

/// A hairline rule. Structure in this app comes from rules and ruled rows,
/// never from cards or shadows — the same grammar as the console.
class Rule extends StatelessWidget {
  const Rule({super.key, this.strong = false, this.soft = false});
  final bool strong;
  final bool soft;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    final color = strong ? c.ruleStrong : soft ? c.ruleSoft : c.rule;
    return Container(height: Space.hair, color: color);
  }
}

/// A row closed by a hairline, with an optional numbered margin — the serial
/// that is the audit trail on every register in this world.
class RuledRow extends StatelessWidget {
  const RuledRow({
    required this.child,
    this.serial,
    this.onTap,
    this.padding = const EdgeInsets.symmetric(vertical: Space.md, horizontal: Space.gutter),
    this.soft = false,
    this.trailing,
    super.key,
  });

  final Widget child;
  final Widget? trailing;
  final String? serial;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final bool soft;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    final row = Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (serial != null)
            SizedBox(
              width: Space.rail,
              child: Text(serial!, style: AegisType.rail(c.ink3)),
            ),
          Expanded(child: child),
          if (trailing != null) trailing!,
        ],
      ),
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        onTap == null
            ? row
            : InkWell(onTap: onTap, splashColor: c.stampSoft, highlightColor: c.stampSoft, child: row),
        Rule(soft: soft),
      ],
    );
  }
}

/// The caption sitting on the rule above a field block — "Title" voice.
class SheetHead extends StatelessWidget {
  const SheetHead({required this.title, this.trailing, super.key});
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, Space.lg, Space.gutter, Space.sm),
      child: Row(
        children: [
          Expanded(child: Text(title.toUpperCase(), style: AegisType.title(c.ink2))),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// A severity or precedence chip. Colour lives in the border only — the
/// Edge-Not-Fill Rule — never behind the text and never in the text itself.
class EdgeChip extends StatelessWidget {
  const EdgeChip({required this.label, required this.color, super.key, this.dense = false});
  final String label;
  final Color color;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 6 : 8, vertical: dense ? 2 : 4),
      decoration: BoxDecoration(border: Border.all(color: color, width: 1.5)),
      child: Text(label.toUpperCase(), style: AegisType.microLabel(c.ink)),
    );
  }
}

/// A severity band chip, coloured from the shared severity ramp.
class BandChip extends StatelessWidget {
  const BandChip({required this.band, super.key});
  final String band;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return EdgeChip(label: band, color: c.band(band));
  }
}

/// A labelled field value — the recurring "LABEL / figure" unit used across
/// every screen.
class FieldValue extends StatelessWidget {
  const FieldValue({required this.label, required this.value, super.key, this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label.toUpperCase(), style: AegisType.label(c.ink3)),
        const SizedBox(height: 2),
        Text(value, style: AegisType.figure(valueColor ?? c.ink)),
      ],
    );
  }
}

/// The masthead — sticky, closed by a strong rule, exactly as on the console.
class Masthead extends StatelessWidget implements PreferredSizeWidget {
  const Masthead({required this.title, super.key, this.subtitle, this.actions});
  final String title;
  final String? subtitle;
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 2);

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return Material(
      color: c.jacket.withValues(alpha: 0.97),
      child: SafeArea(
        bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: Space.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('AEGIS FIELD', style: AegisType.masthead(c.stamp)),
                        Text(title, style: AegisType.sectionHead(c.ink)),
                        if (subtitle != null)
                          Text(subtitle!, style: AegisType.rail(c.ink3)),
                      ],
                    ),
                  ),
                  ...?actions,
                ],
              ),
            ),
            Rule(strong: true),
          ],
        ),
      ),
    );
  }
}
