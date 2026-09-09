import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// The two-voice type system, carried over from the console.
///
/// Prose is Archivo. Every label, head and control is Archivo Narrow in
/// letterspaced caps. Every number is Azeret Mono with tabular lining figures.
/// A number set in the sans faces, or a paragraph set in the narrow cut, is out
/// of the world.
///
/// Sizes are one step up from the console's. The console's 0.625–0.8125rem
/// working range assumes a seated officer at desk distance; this is read
/// standing, at arm's length, in rain. The ramp and its ratios are unchanged —
/// only the base moves.
abstract final class AegisType {
  /// Every figure in the system is compared against the figure in the row
  /// above it, so tabular lining numerals are not optional anywhere.
  static const List<FontFeature> _tabular = [
    FontFeature.tabularFigures(),
    FontFeature.liningFigures(),
  ];

  /// google_fonts fetches on first use and caches. On a device that has never
  /// had a network — a real possibility for this app — the fetch fails and we
  /// fall back to the platform faces rather than throwing. Bundling the TTFs
  /// (see pubspec.yaml) removes the fetch entirely.
  static TextStyle _face(
    TextStyle Function(TextStyle) builder,
    List<String> fallback,
    TextStyle base,
  ) {
    try {
      return builder(base);
    } catch (_) {
      return base.copyWith(fontFamilyFallback: fallback);
    }
  }

  static TextStyle _archivo(TextStyle base) => _face(
        (b) => GoogleFonts.archivo(textStyle: b),
        const ['Archivo', 'Roboto'],
        base,
      );

  static TextStyle _narrow(TextStyle base) => _face(
        (b) => GoogleFonts.archivoNarrow(textStyle: b),
        const ['Archivo Narrow', 'Archivo', 'Roboto Condensed'],
        base,
      );

  static TextStyle _mono(TextStyle base) => _face(
        (b) => GoogleFonts.azeretMono(textStyle: b),
        const ['Azeret Mono', 'RobotoMono', 'monospace'],
        base,
      );

  /// Devanagari for the Hindi half of every field instruction. Kept separate
  /// because Archivo has no Devanagari coverage and the fallback chain must be
  /// explicit rather than accidental.
  static TextStyle devanagari(Color color, {double size = 16}) => _face(
        (b) => GoogleFonts.notoSansDevanagari(textStyle: b),
        const ['Noto Sans Devanagari', 'Devanagari Sangam MN'],
        TextStyle(fontSize: size, height: 1.7, color: color),
      );

  // ---- The ramp -----------------------------------------------------------

  /// The AEGIS wordmark on the masthead only.
  static TextStyle masthead(Color c) => _narrow(
        TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: 3.4, color: c),
      );

  /// The page title. One per screen, never with an eyebrow above it.
  static TextStyle display(Color c) => _narrow(
        TextStyle(fontSize: 30, fontWeight: FontWeight.w700, height: 1.05, letterSpacing: -0.3, color: c),
      );

  /// The head of a self-contained block within a screen.
  static TextStyle sectionHead(Color c) => _narrow(
        TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 1.4, color: c),
      );

  /// A record title inside a register row.
  static TextStyle headline(Color c) => _narrow(
        TextStyle(fontSize: 17, fontWeight: FontWeight.w600, height: 1.25, color: c),
      );

  /// The caption sitting on the rule above a field block.
  static TextStyle title(Color c) => _narrow(
        TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, letterSpacing: 1.75, color: c),
      );

  /// Standfirsts and explanatory prose. Capped at 70–72ch by the layout.
  static TextStyle body(Color c) => _archivo(
        TextStyle(fontSize: 15, height: 1.55, color: c),
      );

  /// Register cells, marginal notes, empty-state copy.
  static TextStyle bodyDense(Color c) => _archivo(
        TextStyle(fontSize: 13.5, height: 1.5, color: c),
      );

  /// Every value in a field row.
  static TextStyle figure(Color c) => _mono(
        TextStyle(fontSize: 15, fontFeatures: _tabular, color: c),
      );

  /// A figure read at a glance from standing distance.
  static TextStyle reading(Color c) => _mono(
        TextStyle(fontSize: 20, fontWeight: FontWeight.w600, fontFeatures: _tabular, color: c),
      );

  /// The single dominant figure on a record. One per record, never more.
  static TextStyle numeral(Color c) => _mono(
        TextStyle(fontSize: 34, fontWeight: FontWeight.w600, height: 1, fontFeatures: _tabular, color: c),
      );

  /// Column heads and field labels.
  static TextStyle label(Color c) => _narrow(
        TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, letterSpacing: 1.2, color: c),
      );

  /// Band chips, provenance marks, status-dot labels.
  static TextStyle microLabel(Color c) => _narrow(
        TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, letterSpacing: 1.1, color: c),
      );

  /// Margin serials, file numbers, hint lines.
  static TextStyle rail(Color c) => _mono(
        TextStyle(fontSize: 11, letterSpacing: 0.2, fontFeatures: _tabular, color: c),
      );

  /// The smallest voice. A qualifier hanging under something already labelled.
  /// Never used alone, never used for a value.
  static TextStyle subLabel(Color c) => _narrow(
        TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, letterSpacing: 1.3, color: c),
      );
}
