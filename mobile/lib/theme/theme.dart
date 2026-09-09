import 'package:flutter/material.dart';

import 'tokens.dart';
import 'typography.dart';

/// Carries the active ground down the tree.
///
/// The two grounds are use scenes, not a preference: daylight on a boat deck,
/// and the same deck at 03:00. `AegisPalette.of(context)` is how every widget
/// in the app gets its colours — nothing reads a constant directly, so a screen
/// cannot accidentally ship in one ground only.
class AegisPalette extends InheritedWidget {
  const AegisPalette({required this.colors, required super.child, super.key});

  final AegisColors colors;

  static AegisColors of(BuildContext context) {
    final w = context.dependOnInheritedWidgetOfExactType<AegisPalette>();
    assert(w != null, 'No AegisPalette in the tree — wrap the app in AegisApp.');
    return w!.colors;
  }

  @override
  bool updateShouldNotify(AegisPalette old) => old.colors != colors;
}

/// Which ground the app is on. `system` follows the device; the other two are
/// a deliberate override, because a responder who knows they are about to go
/// out at night should be able to pin the ink ground before they lose signal.
enum Ground { system, day, night }

abstract final class AegisTheme {
  static ThemeData build(AegisColors c, Brightness brightness) {
    final base = brightness == Brightness.dark ? ThemeData.dark() : ThemeData.light();

    return base.copyWith(
      scaffoldBackgroundColor: c.jacket,
      canvasColor: c.sheet,
      splashColor: c.stampSoft,
      highlightColor: c.stampSoft,
      dividerColor: c.rule,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: c.stamp,
        onPrimary: brightness == Brightness.dark ? c.jacket : c.sheetRaised,
        secondary: c.seal,
        onSecondary: c.sheetRaised,
        error: c.halt,
        onError: c.sheetRaised,
        surface: c.sheet,
        onSurface: c.ink,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: c.stamp,
        selectionColor: c.stampSoft,
        selectionHandleColor: c.stamp,
      ),
      // Zero radius everywhere, including the platform widgets we do use.
      dialogTheme: DialogThemeData(
        backgroundColor: c.sheetRaised,
        shape: const RoundedRectangleBorder(borderRadius: kSquare),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.ink,
        contentTextStyle: AegisType.bodyDense(c.sheet),
        shape: const RoundedRectangleBorder(borderRadius: kSquare),
        behavior: SnackBarBehavior.fixed,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: c.stamp,
        linearTrackColor: c.sheetSunk,
      ),
      textTheme: base.textTheme.apply(
        bodyColor: c.ink,
        displayColor: c.ink,
      ),
    );
  }
}
