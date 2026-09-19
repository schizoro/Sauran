package online.sauran.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Sesli oda ön plan servisi köprüsü (web uygulaması: window.Capacitor.Plugins.SauranVoice).
        registerPlugin(SauranVoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
