const { contextBridge, ipcRenderer } = require('electron');

// Web uygulamasına yalnızca bu küçük, açık arayüz verilir (Node/dosya erişimi yok).
contextBridge.exposeInMainWorld('sauranDesktop', {
    isDesktop: true,
    platform: process.platform,
    // Oyun algılamayı aç/kapat (kullanıcı izniyle). Kapalıyken süreç listesi hiç okunmaz.
    setDetection: (enabled) => ipcRenderer.invoke('sauran:set-detection', Boolean(enabled)),
    // Algılanan oyun değişince callback(oyunAdı | null) çağrılır; abonelikten çıkmak için dönen fonksiyonu çağır.
    onGame: (callback) => {
        const handler = (_event, game) => callback(game);
        ipcRenderer.on('sauran:game', handler);
        return () => ipcRenderer.removeListener('sauran:game', handler);
    }
});
