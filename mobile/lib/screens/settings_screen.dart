import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../theme/theme.dart';
import '../theme/tokens.dart';
import '../theme/typography.dart';
import '../widgets/ruled.dart';

/// Crew identity, the command-centre link, language and ground. Nothing here
/// is required to use the app — every field has a working default, because a
/// crew handed a phone five minutes before a launch should not have to
/// configure anything to receive and act on an order.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({required this.repo, super.key});
  final AegisRepository repo;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final _nameCtrl = TextEditingController(text: widget.repo.crewName ?? '');
  late final _urlCtrl = TextEditingController(text: widget.repo.serverUrl ?? '');

  @override
  void dispose() {
    _nameCtrl.dispose();
    _urlCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return AnimatedBuilder(
      animation: widget.repo,
      builder: (context, _) => Scaffold(
        appBar: const Masthead(title: 'Settings'),
        body: ListView(
          children: [
            const SheetHead(title: 'Crew'),
            RuledRow(
              child: TextField(
                controller: _nameCtrl,
                style: AegisType.figure(c.ink),
                decoration: InputDecoration(
                  labelText: 'CREW / OFFICER NAME',
                  labelStyle: AegisType.label(c.ink3),
                  border: InputBorder.none,
                ),
                onSubmitted: (v) => widget.repo.setCrewName(v.trim()),
                onEditingComplete: () => widget.repo.setCrewName(_nameCtrl.text.trim()),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
              child: Text(
                'Named on every acknowledgement this device sends — the crew-side half of the audit trail.',
                style: AegisType.rail(c.ink3),
              ),
            ),

            const SheetHead(title: 'Command centre link'),
            RuledRow(
              child: TextField(
                controller: _urlCtrl,
                style: AegisType.figure(c.ink),
                keyboardType: TextInputType.url,
                decoration: InputDecoration(
                  labelText: 'SERVER URL',
                  hintText: 'https://aegis-deoc.example.org',
                  labelStyle: AegisType.label(c.ink3),
                  hintStyle: AegisType.rail(c.ink4),
                  border: InputBorder.none,
                ),
                onSubmitted: (v) => widget.repo.setServerUrl(v.trim().isEmpty ? null : v.trim()),
              ),
            ),
            RuledRow(
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(top: 4, right: Space.sm),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: widget.repo.online ? c.live : c.ink4,
                    ),
                  ),
                  Text(
                    widget.repo.online ? 'REACHABLE' : 'NOT REACHABLE — WORKING OFFLINE',
                    style: AegisType.label(widget.repo.online ? c.live : c.ink3),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
              child: Text(
                'Optional. This app is fully usable with no server configured — orders arrive by whatever channel the district uses to hand off a phone, and acknowledgements queue on-device until a link exists.',
                style: AegisType.rail(c.ink3),
              ),
            ),

            const SheetHead(title: 'Language'),
            RuledRow(
              child: Row(
                children: [
                  _Choice(
                    label: 'ENGLISH',
                    active: widget.repo.language == 'en',
                    onTap: () => widget.repo.setLanguage('en'),
                  ),
                  const SizedBox(width: Space.sm),
                  _Choice(
                    label: 'हिन्दी',
                    active: widget.repo.language == 'hi',
                    onTap: () => widget.repo.setLanguage('hi'),
                  ),
                ],
              ),
            ),

            const SheetHead(title: 'Display'),
            RuledRow(
              child: Wrap(
                spacing: Space.sm,
                children: [
                  _Choice(label: 'SYSTEM', active: widget.repo.ground == 'system', onTap: () => widget.repo.setGround('system')),
                  _Choice(label: 'DAY', active: widget.repo.ground == 'day', onTap: () => widget.repo.setGround('day')),
                  _Choice(label: 'NIGHT', active: widget.repo.ground == 'night', onTap: () => widget.repo.setGround('night')),
                ],
              ),
            ),

            const SizedBox(height: Space.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
              child: Text(
                'AEGIS FIELD · SIH 2026 · PS 26206 · Team Sinchan\n'
                'Synthetic demonstration data, modelled on the Kamla Balan embankment breach scenario. '
                'This device is a field client of the AEGIS command centre and holds no incident data of its own beyond what it is issued.',
                style: AegisType.rail(c.ink4),
              ),
            ),
            const SizedBox(height: Space.xxl),
          ],
        ),
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.sm),
        decoration: BoxDecoration(border: Border.all(color: active ? c.stamp : c.controlEdge, width: active ? 1.5 : 1)),
        child: Text(label, style: AegisType.label(active ? c.stamp : c.ink3)),
      ),
    );
  }
}
