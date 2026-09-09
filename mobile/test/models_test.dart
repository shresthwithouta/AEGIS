import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:aegis_field/models/alert.dart';
import 'package:aegis_field/models/dispatch.dart';
import 'package:aegis_field/models/terrain.dart';

void main() {
  group('DispatchOrder', () {
    late Map<String, dynamic> demo;

    setUpAll(() {
      final raw = File('assets/data/demo_dispatch.json').readAsStringSync();
      demo = jsonDecode(raw) as Map<String, dynamic>;
    });

    test('parses the bundled demo order end to end', () {
      final order = DispatchOrder.fromJson(demo);
      expect(order.fileNo, isNotEmpty);
      expect(order.orders, isNotEmpty);
      expect(order.isSigned, isTrue);
    });

    test('round-trips through toJson without losing an order', () {
      final order = DispatchOrder.fromJson(demo);
      final again = DispatchOrder.fromJson(order.toJson());
      expect(again.orders.length, order.orders.length);
      expect(again.orders.first.orderNo, order.orders.first.orderNo);
    });

    test('every order carries both languages of field instruction', () {
      final order = DispatchOrder.fromJson(demo);
      for (final o in order.orders) {
        expect(o.textEn, isNotEmpty);
        expect(o.textHi, isNotEmpty);
      }
    });

    test('byNo finds an order by its order number', () {
      final order = DispatchOrder.fromJson(demo);
      final first = order.orders.first;
      expect(order.byNo(first.orderNo)?.zoneId, first.zoneId);
      expect(order.byNo('does-not-exist'), isNull);
    });

    test('an unsigned order reports isSigned false', () {
      final unsigned = DispatchOrder.fromJson({...demo, 'approvedBy': {'gate1': null, 'gate2': null}});
      expect(unsigned.isSigned, isFalse);
    });
  });

  group('Terrain', () {
    test('parses the bundled 100-zone snapshot', () {
      final raw = File('assets/data/terrain.json').readAsStringSync();
      final terrain = Terrain.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      expect(terrain.zones.length, 100);
      expect(terrain.grid, 10);
      expect(terrain.roads, isNotEmpty);
      expect(terrain.depots, isNotEmpty);
    });

    test('zone() resolves a known id and null for an unknown one', () {
      final raw = File('assets/data/terrain.json').readAsStringSync();
      final terrain = Terrain.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      final knownId = terrain.zones.first.id;
      expect(terrain.zone(knownId), isNotNull);
      expect(terrain.zone('Z-99'), isNull);
    });
  });

  group('Alert', () {
    test('immediate + unacknowledged needs acknowledgement', () {
      final a = Alert(
        id: '1',
        kind: AlertKind.order,
        precedence: Precedence.immediate,
        title: 'T',
        body: 'B',
        at: DateTime.now(),
      );
      expect(a.needsAcknowledgement, isTrue);
      final acked = a.copyWith(acknowledgedAt: DateTime.now());
      expect(acked.needsAcknowledgement, isFalse);
    });

    test('routine traffic never needs acknowledgement', () {
      final a = Alert(
        id: '2',
        kind: AlertKind.message,
        precedence: Precedence.routine,
        title: 'T',
        body: 'B',
        at: DateTime.now(),
      );
      expect(a.needsAcknowledgement, isFalse);
    });

    test('untranslated() is true only when Hindi was requested but absent', () {
      final a = Alert(
        id: '3',
        kind: AlertKind.message,
        precedence: Precedence.routine,
        title: 'T',
        body: 'English only',
        at: DateTime.now(),
      );
      expect(a.untranslated('hi'), isTrue);
      expect(a.untranslated('en'), isFalse);
    });
  });
}
