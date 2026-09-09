import 'package:flutter/widgets.dart';

/// The AEGIS palette, carried over from the command centre's `globals.css`
/// token for token.
///
/// Two grounds ship and both are real scenes, exactly as on the console: the
/// bright noting-sheet ground for a boat deck in the sun, and the ink ground
/// for 03:00 on the same boat. Nothing is derived from the other — every token
/// is specified in both, which is the Two-Grounds Rule.
@immutable
class AegisColors {
  const AegisColors({
    required this.jacket,
    required this.jacketEdge,
    required this.sheet,
    required this.sheetRaised,
    required this.sheetSunk,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.ink4,
    required this.rule,
    required this.ruleSoft,
    required this.ruleStrong,
    required this.stamp,
    required this.stampSoft,
    required this.tape,
    required this.seal,
    required this.pencil,
    required this.sevClear,
    required this.sevMonitor,
    required this.sevElevated,
    required this.sevSevere,
    required this.sevCritical,
    required this.water,
    required this.live,
    required this.sim,
    required this.warn,
    required this.halt,
    required this.controlEdge,
    required this.focus,
  });

  // The file board the app sits on.
  final Color jacket;
  final Color jacketEdge;

  // The three paper planes.
  final Color sheet;
  final Color sheetRaised;
  final Color sheetSunk;

  // The text ramp. `ink4` is marks only and never carries text.
  final Color ink;
  final Color ink2;
  final Color ink3;
  final Color ink4;

  // The ledger skeleton.
  final Color rule;
  final Color ruleSoft;
  final Color ruleStrong;

  // The four materials.
  final Color stamp; // authority — the act of committing
  final Color stampSoft;
  final Color tape; // halt, rejection
  final Color seal; // verified, approved, live
  final Color pencil; // provisional marks

  // The severity ramp. Edges only — never behind a figure, never in text.
  final Color sevClear;
  final Color sevMonitor;
  final Color sevElevated;
  final Color sevSevere;
  final Color sevCritical;

  final Color water; // flood extent, deliberately outside the severity ramp

  final Color live;
  final Color sim; // the honesty label
  final Color warn; // degraded but running
  final Color halt;

  final Color controlEdge;
  final Color focus;

  /// The noting-sheet ground — a district boat deck in daylight.
  static const AegisColors day = AegisColors(
    jacket: Color(0xFFD9DDD2),
    jacketEdge: Color(0xFFCBD0C2),
    sheet: Color(0xFFF3F5EF),
    sheetRaised: Color(0xFFFAFBF7),
    sheetSunk: Color(0xFFE9ECE3),
    ink: Color(0xFF16211C),
    ink2: Color(0xFF3F4B45),
    ink3: Color(0xFF53605A),
    ink4: Color(0xFF616E68),
    rule: Color(0xFFC2CABB),
    ruleSoft: Color(0xFFD6DCCF),
    ruleStrong: Color(0xFF97A292),
    stamp: Color(0xFF5B2D8E),
    stampSoft: Color(0x265B2D8E),
    tape: Color(0xFFB4232A),
    seal: Color(0xFF0F5C4A),
    pencil: Color(0xFF3A5A7C),
    sevClear: Color(0xFF84958F),
    sevMonitor: Color(0xFFD9AE3C),
    sevElevated: Color(0xFFCE8617),
    sevSevere: Color(0xFFBE5010),
    sevCritical: Color(0xFF96161D),
    water: Color(0xFF1D6088),
    live: Color(0xFF0F5C4A),
    sim: Color(0xFFA3206B),
    warn: Color(0xFF785710),
    halt: Color(0xFFB8202C),
    controlEdge: Color(0xFF6B786D),
    focus: Color(0xFF5B2D8E),
  );

  /// The ink ground — the same deck with the lights down.
  static const AegisColors night = AegisColors(
    jacket: Color(0xFF0D1116),
    jacketEdge: Color(0xFF070A0D),
    sheet: Color(0xFF141A20),
    sheetRaised: Color(0xFF1A222A),
    sheetSunk: Color(0xFF0F151A),
    ink: Color(0xFFE3E9E4),
    ink2: Color(0xFFB3BDB7),
    ink3: Color(0xFF7F8C86),
    ink4: Color(0xFF7C8983),
    rule: Color(0xFF2A343C),
    ruleSoft: Color(0xFF202930),
    ruleStrong: Color(0xFF3D4A53),
    stamp: Color(0xFFA97CE8),
    stampSoft: Color(0x26A97CE8),
    tape: Color(0xFFEA666B),
    seal: Color(0xFF3FBF9B),
    pencil: Color(0xFF7AA8D0),
    sevClear: Color(0xFF697872),
    sevMonitor: Color(0xFF87801F),
    sevElevated: Color(0xFFD6AE24),
    sevSevere: Color(0xFFE5613A),
    sevCritical: Color(0xFFFF97A4),
    water: Color(0xFF4D94C4),
    live: Color(0xFF3FBF9B),
    sim: Color(0xFFF28AC6),
    warn: Color(0xFFD8A63A),
    halt: Color(0xFFFF5A63),
    controlEdge: Color(0xFF647178),
    focus: Color(0xFFA97CE8),
  );

  /// The severity ramp in band order, so a band id maps to one edge colour.
  Color band(String bandId) => switch (bandId) {
        'critical' => sevCritical,
        'severe' => sevSevere,
        'elevated' => sevElevated,
        'monitor' => sevMonitor,
        _ => sevClear,
      };
}

/// Spacing, in logical pixels.
///
/// Deliberately looser than the console's. The console is read at desk
/// distance by a seated officer; this is read at arm's length, one-handed, in
/// rain, by someone standing in a moving boat. The grammar is identical —
/// hairlines and ruled rows, never cards — but the rhythm is opened up and
/// every target clears 48dp.
abstract final class Space {
  static const double hair = 1;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// The margin rail that carries the serial on every record.
  static const double rail = 46;

  /// Minimum interactive height. Gloves, rain, motion.
  static const double target = 52;

  /// The screen's horizontal padding.
  static const double gutter = 16;
}

/// Zero, everywhere. There is no border radius in this world.
const BorderRadius kSquare = BorderRadius.zero;
