import 'package:flutter_tts/flutter_tts.dart';

/// One-tap audio playback of an order, in English or Hindi.
///
/// This is the mechanism the dossier names directly as the reason a native
/// app exists over a mobile web page: a boat crew mid-current cannot read a
/// screen, and gTTS-style server audio is a network dependency exactly where
/// the network is not there. `flutter_tts` speaks on-device with the OS
/// engine, so it works with the phone in a dry bag and zero signal bars.
class VoiceService {
  VoiceService() : _tts = FlutterTts();

  final FlutterTts _tts;
  bool _ready = false;
  String? _spokenId;

  Future<void> _ensureReady() async {
    if (_ready) return;
    await _tts.awaitSpeakCompletion(true);
    await _tts.setVolume(1.0);
    await _tts.setSpeechRate(0.46); // slower than the platform default — clarity over a boat engine
    await _tts.setPitch(1.0);
    _ready = true;
  }

  /// BCP-47 locale for the language toggle. Hindi falls back to English
  /// speech (not silence) when the device has no Hindi voice installed —
  /// common on an older field handset — and that fallback is reported back so
  /// the UI can say so rather than claim a read-aloud that did not happen.
  Future<bool> _setLanguage(String lang) async {
    final locale = lang == 'hi' ? 'hi-IN' : 'en-IN';
    try {
      final ok = await _tts.isLanguageAvailable(locale);
      if (ok == true || ok == 1) {
        await _tts.setLanguage(locale);
        return true;
      }
    } catch (_) {
      /* isLanguageAvailable is unsupported on some platforms — fall through */
    }
    await _tts.setLanguage('en-IN');
    return false;
  }

  /// Speaks [text], tagged with [id] so the UI can show which order is
  /// currently reading. Returns whether the requested language was actually
  /// used.
  Future<bool> speak(String id, String text, {required String lang}) async {
    await _ensureReady();
    await _tts.stop();
    final usedRequested = await _setLanguage(lang);
    _spokenId = id;
    await _tts.speak(text);
    return usedRequested;
  }

  Future<void> stop() async {
    _spokenId = null;
    await _tts.stop();
  }

  String? get speakingId => _spokenId;

  void dispose() {
    _tts.stop();
  }
}
