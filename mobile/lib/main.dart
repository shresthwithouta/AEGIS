import 'package:flutter/material.dart';

import 'data/repository.dart';
import 'screens/home_screen.dart';
import 'theme/theme.dart';
import 'theme/tokens.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AegisFieldApp());
}

/// AEGIS Field — the offline-first responder app.
///
/// Boots straight to the alerts inbox after opening the local store, so a
/// crew handed a phone mid-incident sees traffic in under a second, not a
/// splash screen waiting on a network call that may never resolve.
class AegisFieldApp extends StatefulWidget {
  const AegisFieldApp({super.key});

  @override
  State<AegisFieldApp> createState() => _AegisFieldAppState();
}

class _AegisFieldAppState extends State<AegisFieldApp> {
  final _repo = AegisRepository();
  late Future<void> _initFuture;

  @override
  void initState() {
    super.initState();
    _initFuture = _repo.init();
  }

  @override
  void dispose() {
    _repo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _initFuture,
      builder: (context, snap) {
        final platformDark = MediaQuery.platformBrightnessOf(context) == Brightness.dark;
        final ground = snap.connectionState == ConnectionState.done ? _repo.ground : 'system';
        final dark = ground == 'night' || (ground == 'system' && platformDark);
        final colors = dark ? AegisColors.night : AegisColors.day;

        return AegisPalette(
          colors: colors,
          child: MaterialApp(
            title: 'AEGIS Field',
            debugShowCheckedModeBanner: false,
            theme: AegisTheme.build(colors, dark ? Brightness.dark : Brightness.light),
            home: snap.connectionState != ConnectionState.done
                ? _Boot(colors: colors)
                : AnimatedBuilder(animation: _repo, builder: (_, __) => HomeScreen(repo: _repo)),
          ),
        );
      },
    );
  }
}

class _Boot extends StatelessWidget {
  const _Boot({required this.colors});
  final AegisColors colors;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: colors.jacket,
      body: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2, color: colors.stamp),
        ),
      ),
    );
  }
}
