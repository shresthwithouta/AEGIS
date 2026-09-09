import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models/alert.dart';
import '../theme/theme.dart';
import '../theme/tokens.dart';
import '../theme/typography.dart';
import '../widgets/ruled.dart';
import 'order_screen.dart';
import 'settings_screen.dart';

/// The alerts inbox — what a crew sees on opening the app. Precedence-sorted:
/// immediate traffic first, always, regardless of when it arrived, because a
/// recall that landed a minute ago outranks a routine note from an hour ago.
class HomeScreen extends StatelessWidget {
  const HomeScreen({required this.repo, super.key});
  final AegisRepository repo;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return AnimatedBuilder(
      animation: repo,
      builder: (context, _) {
        final alerts = repo.alerts;
        return Scaffold(
          appBar: Masthead(
            title: repo.crewName == null ? 'Not signed in' : repo.crewName!,
            subtitle: repo.online ? 'CONNECTED · SYNCING' : 'OFFLINE · QUEUED LOCALLY',
            actions: [
              _OnlineDot(online: repo.online),
              IconButton(
                icon: const Icon(Icons.settings_outlined),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => SettingsScreen(repo: repo)),
                ),
              ),
            ],
          ),
          body: alerts.isEmpty
              ? _EmptyInbox(color: c)
              : ListView.builder(
                  itemCount: alerts.length,
                  itemBuilder: (context, i) {
                    final a = alerts[i];
                    return _AlertRow(
                      alert: a,
                      serial: (i + 1).toString().padLeft(4, '0'),
                      onTap: () async {
                        await repo.markRead(a);
                        if (a.orderNo != null && context.mounted) {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => OrderScreen(repo: repo, orderNo: a.orderNo!, alert: a),
                            ),
                          );
                        }
                      },
                    );
                  },
                ),
        );
      },
    );
  }
}

extension on String {
  String padStart(int width) => padLeft(width, '0');
}

class _OnlineDot extends StatelessWidget {
  const _OnlineDot({required this.online});
  final bool online;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(right: Space.sm),
      child: Container(
        width: 8,
        height: 8,
        margin: const EdgeInsets.only(top: 6),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: online ? c.live : c.ink4,
        ),
      ),
    );
  }
}

class _EmptyInbox extends StatelessWidget {
  const _EmptyInbox({required this.color});
  final AegisColors color;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Space.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_outlined, color: color.ink3, size: 40),
            const SizedBox(height: Space.md),
            Text('NO TRAFFIC', style: AegisType.sectionHead(color.ink2)),
            const SizedBox(height: Space.sm),
            Text(
              'Orders and alerts from the command centre will appear here the moment they are issued — including while this device is offline.',
              textAlign: TextAlign.center,
              style: AegisType.bodyDense(color.ink3),
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({required this.alert, required this.serial, required this.onTap});
  final Alert alert;
  final String serial;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AegisPalette.of(context);
    final precedenceColor = switch (alert.precedence) {
      Precedence.immediate => c.tape,
      Precedence.priority => c.warn,
      Precedence.routine => c.ink3,
    };

    return RuledRow(
      serial: serial,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              EdgeChip(label: alert.precedence.label, color: precedenceColor, dense: true),
              const SizedBox(width: Space.sm),
              Text(alert.kind.label, style: AegisType.microLabel(c.ink3)),
              const Spacer(),
              if (!alert.isRead)
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: c.stamp),
                ),
            ],
          ),
          const SizedBox(height: Space.xs),
          Text(alert.title, style: AegisType.headline(c.ink)),
          const SizedBox(height: 2),
          Text(
            alert.body,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AegisType.bodyDense(c.ink2),
          ),
          const SizedBox(height: Space.xs),
          Row(
            children: [
              Text(_relativeTime(alert.at), style: AegisType.rail(c.ink3)),
              if (alert.needsAcknowledgement) ...[
                const SizedBox(width: Space.sm),
                Text('· ACKNOWLEDGEMENT REQUIRED', style: AegisType.rail(c.tape)),
              ] else if (alert.isAcknowledged) ...[
                const SizedBox(width: Space.sm),
                Text('· ACKNOWLEDGED', style: AegisType.rail(c.seal)),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

String _relativeTime(DateTime at) {
  final diff = DateTime.now().difference(at);
  if (diff.inMinutes < 1) return 'JUST NOW';
  if (diff.inMinutes < 60) return '${diff.inMinutes} MIN AGO';
  if (diff.inHours < 24) return '${diff.inHours} HR AGO';
  return '${diff.inDays} D AGO';
}
