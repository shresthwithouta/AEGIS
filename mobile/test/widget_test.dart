// Smoke tests for the shared widget grammar (widgets/ruled.dart,
// widgets/stamp_button.dart), rendered against the real theme.
//
// This file exists specifically so `flutter create --platforms=android .`
// in CI (see ../../.github/workflows/build-apk.yml) never generates its own
// default `test/widget_test.dart` template in its place — that template
// references a `MyApp` class this app doesn't have (ours is
// `AegisFieldApp` in lib/main.dart) and fails the build every time the
// Android runner is freshly scaffolded. Flutter never overwrites a file
// that already exists at this path, so keep this file present and real.
//
// Deliberately does not pump the full AegisFieldApp: that boots
// AegisRepository, which opens Hive and touches notifications/geolocator
// platform channels that aren't available in the plain `flutter test` host
// environment. lib/data and lib/services are exercised by the models in
// test/models_test.dart instead; this file covers what a widget test can
// safely cover — rendering.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aegis_field/theme/theme.dart';
import 'package:aegis_field/theme/tokens.dart';
import 'package:aegis_field/widgets/ruled.dart';
import 'package:aegis_field/widgets/stamp_button.dart';

Widget _harness(Widget child) => AegisPalette(
      colors: AegisColors.day,
      child: MaterialApp(
        theme: AegisTheme.build(AegisColors.day, Brightness.light),
        home: Scaffold(body: child),
      ),
    );

void main() {
  testWidgets('Masthead renders the wordmark, title and subtitle', (tester) async {
    await tester.pumpWidget(_harness(const Masthead(title: 'Inbox', subtitle: 'OFFLINE · QUEUED LOCALLY')));
    expect(find.text('AEGIS FIELD'), findsOneWidget);
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('OFFLINE · QUEUED LOCALLY'), findsOneWidget);
  });

  testWidgets('RuledRow renders its child and margin serial', (tester) async {
    await tester.pumpWidget(_harness(const RuledRow(serial: '0001', child: Text('Row content'))));
    expect(find.text('Row content'), findsOneWidget);
    expect(find.text('0001'), findsOneWidget);
  });

  testWidgets('FieldValue renders an uppercase label above its figure', (tester) async {
    await tester.pumpWidget(_harness(const FieldValue(label: 'Kit', value: '2 boat, 1 team')));
    expect(find.text('KIT'), findsOneWidget);
    expect(find.text('2 boat, 1 team'), findsOneWidget);
  });

  testWidgets('BandChip renders the band as an uppercase edge label', (tester) async {
    await tester.pumpWidget(_harness(const BandChip(band: 'critical')));
    expect(find.text('CRITICAL'), findsOneWidget);
  });

  testWidgets('StampButton renders its label before it is pressed', (tester) async {
    await tester.pumpWidget(_harness(StampButton(
      label: 'Hold to acknowledge',
      onCommit: () async {},
    )));
    expect(find.text('HOLD TO ACKNOWLEDGE'), findsOneWidget);
    expect(find.text('ACKNOWLEDGED'), findsNothing);
  });

  testWidgets('StampButton commits on a sustained long press', (tester) async {
    var committed = false;
    await tester.pumpWidget(_harness(StampButton(
      label: 'Hold to acknowledge',
      holdMs: 50,
      onCommit: () async => committed = true,
    )));

    // A real long press needs Flutter's own recognizer delay
    // (kLongPressTimeout, 500ms) to elapse before onLongPressStart even
    // fires, then the button's own holdMs animation runs to completion.
    final gesture = await tester.startGesture(tester.getCenter(find.byType(StampButton)));
    await tester.pump(const Duration(milliseconds: 500)); // recognizer threshold
    await tester.pump(const Duration(milliseconds: 100)); // the 50ms hold animation, with margin
    await gesture.up();
    await tester.pump();
    await tester.pump();

    expect(committed, isTrue);
    expect(find.text('ACKNOWLEDGED'), findsOneWidget);
  });
}
