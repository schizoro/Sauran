import Foundation
import AVFoundation
import MediaPlayer
import Capacitor

/// Sesli oda / özel arama sırasında ses oturumu (Android'deki SauranVoice + VoiceCallService karşılığı).
///
/// - start: AVAudioSession'ı görüşme moduna (.playAndRecord / .voiceChat) alır; Info.plist'teki UIBackgroundModes=audio ile
///   ekran kilitlenince ya da başka uygulamaya geçilince ses sürer. Kilit ekranında "Sesli görüşme" bilgisi ve
///   oynat/duraklat tuşu (mikrofonu aç/kapat) gösterilir.
/// - stop: oturumu bırakır (müzik vb. uygulamalar kaldığı yerden devam eder).
/// - getAudioRoutes / setAudioRoute: hoparlör, ahize, kablolu kulaklık, Bluetooth arasında seçim.
/// Web tarafı yöntem adları ve olay biçimleri Android ile AYNIDIR (client/script.js değişmeden çalışır).
@objc(SauranVoicePlugin)
public class SauranVoicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SauranVoicePlugin"
    public let jsName = "SauranVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMuted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAudioRoutes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAudioRoute", returnType: CAPPluginReturnPromise)
    ]

    private var active = false
    private var muted = false
    private var title = "Sesli görüşme"
    private var forcedSpeaker = true
    private var commandsWired = false

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(routeChanged(_:)),
                                               name: AVAudioSession.routeChangeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted(_:)),
                                               name: AVAudioSession.interruptionNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Görüşme oturumu

    @objc func start(_ call: CAPPluginCall) {
        title = call.getString("title") ?? "Sesli görüşme"
        muted = call.getBool("muted") ?? false
        do {
            try configureSession()
            active = true
            DispatchQueue.main.async {
                self.wireRemoteCommands()
                self.updateNowPlaying()
            }
            call.resolve()
        } catch {
            call.reject("Ses oturumu açılamadı: \(error.localizedDescription)")
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        active = false
        DispatchQueue.main.async {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        }
        // WebRTC sesi kapansın diye kısa bir gecikmeyle bırakılır; diğer uygulamalara "devam edebilirsin" denir.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            guard !self.active else { return }
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
        call.resolve()
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        muted = call.getBool("muted") ?? false
        DispatchQueue.main.async { self.updateNowPlaying() }
        call.resolve()
    }

    private func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        var options: AVAudioSession.CategoryOptions = [.allowBluetooth, .allowBluetoothA2DP, .allowAirPlay]
        if forcedSpeaker { options.insert(.defaultToSpeaker) }
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: options)
        try session.setActive(true)
        if forcedSpeaker && !hasExternalOutput() {
            try? session.overrideOutputAudioPort(.speaker)
        }
    }

    // Kilit ekranı: başlık + oynat/duraklat → mikrofonu aç/kapat (Android bildirimindeki "Sustur" karşılığı).
    private func wireRemoteCommands() {
        guard !commandsWired else { return }
        commandsWired = true
        let center = MPRemoteCommandCenter.shared()
        let toggle: (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus = { [weak self] _ in
            guard let self = self, self.active else { return .commandFailed }
            self.notifyListeners("action", data: ["type": "toggle_mic"], retainUntilConsumed: true)
            return .success
        }
        center.togglePlayPauseCommand.isEnabled = true
        center.togglePlayPauseCommand.addTarget(handler: toggle)
        center.playCommand.isEnabled = true
        center.playCommand.addTarget(handler: toggle)
        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget(handler: toggle)
    }

    private func updateNowPlaying() {
        guard active else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: muted ? "Sauran · Mikrofon kapalı" : "Sauran · Mikrofon açık",
            MPNowPlayingInfoPropertyPlaybackRate: muted ? 0.0 : 1.0,
            MPNowPlayingInfoPropertyIsLiveStream: true
        ]
    }

    @objc private func interrupted(_ note: Notification) {
        // Telefon araması vb. bittiğinde ses oturumu yeniden açılır.
        guard active,
              let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: raw) == .ended else { return }
        try? configureSession()
    }

    // MARK: - Ses rotaları

    private func hasExternalOutput() -> Bool {
        AVAudioSession.sharedInstance().currentRoute.outputs.contains { output in
            [.headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE, .usbAudio, .carAudio, .airPlay].contains(output.portType)
        }
    }

    private func routeType(_ port: AVAudioSession.Port) -> String? {
        switch port {
        case .builtInSpeaker: return "speaker"
        case .builtInReceiver, .builtInMic: return "earpiece"
        case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE: return "bluetooth"
        case .headphones, .headsetMic: return "wired"
        case .usbAudio: return "usb"
        case .carAudio: return "car"
        default: return nil
        }
    }

    @objc func getAudioRoutes(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        var routes: [[String: String]] = [
            ["id": "speaker", "type": "speaker", "name": "Hoparlör"],
            ["id": "earpiece", "type": "earpiece", "name": "Ahize"]
        ]
        for input in session.availableInputs ?? [] {
            guard let type = routeType(input.portType), type != "earpiece" else { continue }
            routes.append(["id": input.uid, "type": type, "name": input.portName])
        }
        let outputs = session.currentRoute.outputs
        var activeId = "speaker"
        if let out = outputs.first {
            switch out.portType {
            case .builtInSpeaker: activeId = "speaker"
            case .builtInReceiver: activeId = "earpiece"
            default:
                if let input = session.currentRoute.inputs.first, routes.contains(where: { $0["id"] == input.uid }) {
                    activeId = input.uid
                } else if let match = routes.first(where: { $0["name"] == out.portName }) {
                    activeId = match["id"] ?? "speaker"
                }
            }
        }
        call.resolve(["routes": routes, "active": activeId])
    }

    @objc func setAudioRoute(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Rota yok"); return }
        let session = AVAudioSession.sharedInstance()
        do {
            switch id {
            case "speaker":
                forcedSpeaker = true
                try session.setPreferredInput(nil)
                try session.overrideOutputAudioPort(.speaker)
            case "earpiece":
                forcedSpeaker = false
                let builtIn = session.availableInputs?.first { $0.portType == .builtInMic }
                try session.setPreferredInput(builtIn)
                try session.overrideOutputAudioPort(.none)
            default:
                guard let input = session.availableInputs?.first(where: { $0.uid == id }) else { call.reject("Rota bulunamadı"); return }
                forcedSpeaker = false
                try session.overrideOutputAudioPort(.none)
                try session.setPreferredInput(input)
            }
            call.resolve(["active": id])
        } catch {
            call.reject("Ses çıkışı değiştirilemedi: \(error.localizedDescription)")
        }
    }

    @objc private func routeChanged(_ note: Notification) {
        notifyListeners("audioRoutesChanged", data: [:])
    }
}
