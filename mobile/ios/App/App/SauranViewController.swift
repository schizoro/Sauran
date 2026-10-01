import UIKit
import Capacitor

/// Capacitor köprüsü yüklenince Sauran'ın yerel eklentilerini kaydeder (Android'deki MainActivity.registerPlugin karşılığı).
/// Web uygulaması bunlara window.Capacitor.registerPlugin('SauranVoice' | 'SauranNotify') ile ulaşır.
class SauranViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SauranVoicePlugin())
        bridge?.registerPluginInstance(SauranNotifyPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Sayfa yüklenene kadar beyaz parlama olmasın: uygulamanın koyu arka planı.
        let background = UIColor(red: 0x0d / 255.0, green: 0x0f / 255.0, blue: 0x14 / 255.0, alpha: 1)
        view.backgroundColor = background
        webView?.isOpaque = false
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
    }
}
