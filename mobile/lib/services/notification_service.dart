import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../models/alert.dart';

/// Native push, on-device.
///
/// The dossier's whole argument for a Flutter app over a web dashboard turns
/// on this: a PWA cannot reliably wake a phone in a flood zone; native
/// background delivery can. This service is the local half of that promise —
/// it raises the notification the instant an alert lands in the app,
/// whether that alert arrived over a live connection or was queued from a
/// previous session and is only now being surfaced.
///
/// A true silent-remote-push integration (FCM) needs a project-specific
/// server key and is deployment configuration, not app logic — this service
/// is written so wiring FCM in later is additive: FCM's background handler
/// calls the same `showAlert` this local path calls.
class NotificationService {
  NotificationService() : _plugin = FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  bool _ready = false;

  static const _channelImmediate = AndroidNotificationChannel(
    'aegis_immediate',
    'Immediate orders',
    description: 'Movement orders, recalls and hazards requiring acknowledgement.',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  static const _channelRoutine = AndroidNotificationChannel(
    'aegis_routine',
    'Routine traffic',
    description: 'Status updates and non-urgent messages from the command centre.',
    importance: Importance.defaultImportance,
  );

  Future<void> init() async {
    if (_ready) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _plugin.initialize(const InitializationSettings(android: android, iOS: ios));

    final androidImpl = _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(_channelImmediate);
    await androidImpl?.createNotificationChannel(_channelRoutine);
    await androidImpl?.requestNotificationsPermission();

    final iosImpl = _plugin
        .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
    await iosImpl?.requestPermissions(alert: true, badge: true, sound: true);

    _ready = true;
  }

  Future<void> showAlert(Alert alert) async {
    await init();
    final immediate = alert.precedence == Precedence.immediate;
    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        immediate ? _channelImmediate.id : _channelRoutine.id,
        immediate ? _channelImmediate.name : _channelRoutine.name,
        channelDescription: immediate ? _channelImmediate.description : _channelRoutine.description,
        importance: immediate ? Importance.max : Importance.defaultImportance,
        priority: immediate ? Priority.max : Priority.defaultPriority,
        ongoing: immediate && !alert.isAcknowledged,
        autoCancel: !immediate,
        category: immediate ? AndroidNotificationCategory.alarm : AndroidNotificationCategory.message,
        styleInformation: BigTextStyleInformation(alert.body),
      ),
      iOS: DarwinNotificationDetails(
        interruptionLevel: immediate ? InterruptionLevel.critical : InterruptionLevel.active,
        presentSound: true,
      ),
    );
    await _plugin.show(
      alert.id.hashCode,
      '${alert.kind.label} · ${alert.title}',
      alert.body,
      details,
      payload: alert.id,
    );
  }

  Future<void> clear(String alertId) => _plugin.cancel(alertId.hashCode);
}
