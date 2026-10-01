import Foundation
import UIKit
import UserNotifications
import Capacitor

/// Uygulama ARKA PLANDAYKEN (ama kapanmamışken) gelen mesaj/arama bildirimleri için yerel bildirim
/// (Android'deki SauranNotify karşılığı). Uygulama tamamen kapalıyken bildirimler sunucudan APNs ile gelir.
/// Yöntemler ve olaylar Android ile aynı: requestPermission, notify({title, body, tag, url}), cancel({tag}),
/// olaylar: appState {active}, tap {url}.
@objc(SauranNotifyPlugin)
public class SauranNotifyPlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    public let identifier = "SauranNotifyPlugin"
    public let jsName = "SauranNotify"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private static let localMarker = "sauran-local"

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(becameActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(resignedActive), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(resignedActive), name: UIApplication.didEnterBackgroundNotification, object: nil)
        // Capacitor'ın bildirim yönlendiricisi: tetikleyicisi push OLMAYAN (yerel) bildirimler buraya, sunucu (APNs)
        // bildirimleri PushNotifications eklentisine gider. Yerel bildirim eklentisi kullanmadığımız için bu yuva boştur.
        bridge?.notificationRouter.localNotificationHandler = self
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func becameActive() {
        notifyListeners("appState", data: ["active": true], retainUntilConsumed: true)
    }

    @objc private func resignedActive() {
        notifyListeners("appState", data: ["active": false], retainUntilConsumed: true)
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            call.resolve(["granted": granted])
        }
    }

    @objc func notify(_ call: CAPPluginCall) {
        let tag = call.getString("tag") ?? "sauran"
        let content = UNMutableNotificationContent()
        content.title = call.getString("title") ?? "Sauran"
        content.body = call.getString("body") ?? ""
        content.sound = .default
        content.threadIdentifier = tag
        content.userInfo = [SauranNotifyPlugin.localMarker: true, "url": call.getString("url") ?? "/"]
        // Aynı sohbetten gelen yeni bildirim öncekinin yerine geçer (aynı kimlik).
        let request = UNNotificationRequest(identifier: tag, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard let tag = call.getString("tag") else { call.resolve(); return }
        let center = UNUserNotificationCenter.current()
        center.removeDeliveredNotifications(withIdentifiers: [tag])
        center.removePendingNotificationRequests(withIdentifiers: [tag])
        call.resolve()
    }

    // MARK: - NotificationHandlerProtocol (yalnızca yerel bildirimler)

    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        // Uygulama öndeyken yerel bildirim zaten gösterilmez (web tarafı karar verir); gelirse sessizce listeye eklenir.
        return [.list]
    }

    public func didReceive(response: UNNotificationResponse) {
        let url = (response.notification.request.content.userInfo["url"] as? String) ?? "/"
        notifyListeners("tap", data: ["url": url], retainUntilConsumed: true)
    }
}
