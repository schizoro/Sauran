// Sauran service worker — yalnızca Web Push bildirimleri için (önbellekleme yok).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Web Push yükü (sunucudan) yalnızca genel bir başlık, sabit bir metin ve genel `type` taşır: kullanıcıya/sohbete özgü hiçbir bilgi yoktur.
// Yükteki url/name gibi alanlar bilerek KULLANILMAZ.
const GENERIC_TYPES = ['dm_message', 'hub_message', 'incoming_call', 'friend_request', 'friend_request_accepted', 'hub_invite', 'platform_role_notice', 'platform_role_revoked', 'generic'];

// Bildirim metni yükten DEĞİL, türe göre bu sabit tablodan gelir (sunucu sanitizasyonuna ek ikinci güvence; sunucu FCM ile aynı metinleri gönderir).
const GENERIC_BODY = {
    dm_message: 'Yeni mesajınız var',
    hub_message: 'Lobide yeni mesaj var',
    incoming_call: 'Gelen arama',
    friend_request: 'Yeni bir arkadaşlık isteğin var',
    friend_request_accepted: 'Bir arkadaşlık isteğin kabul edildi',
    hub_invite: 'Yeni bir lobi davetin var',
    platform_role_notice: 'Sauran Yönetim: Yeni bir görev bildirimin var.',
    platform_role_revoked: 'Sauran Yönetim: Yönetim görevin hakkında bir bilgilendirme var.',
    generic: 'Yeni bir bildirimin var'
};

self.addEventListener('push', (event) => {

    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        data = {};
    }

    const type = GENERIC_TYPES.includes(data.type) ? data.type : 'generic';

    const rich = data.rich === true && (type === 'dm_message' || type === 'hub_message' || type === 'incoming_call')
        && typeof data.title === 'string' && typeof data.body === 'string';

    event.waitUntil(
        self.registration.showNotification(rich ? data.title.slice(0, 60) : 'Sauran', {
            body: rich ? data.body.slice(0, 140) : GENERIC_BODY[type],
            ...(rich ? {} : { tag: type }),
            renotify: !rich,
            data: { type }
        })
    );

});

self.addEventListener('notificationclick', (event) => {

    event.notification.close();

    const info = event.notification.data || {};

    // Yalnızca uygulamanın KENDİ sayfa içi (yerel) bildirimleri url taşır (üçüncü tarafa gitmez); push bildirimleri yalnızca `type` taşır.
    const url = (!info.type && info.url) ? new URL(info.url, self.location.origin) : null;
    const dmUserId = url ? (Number(url.searchParams.get('open_dm')) || null) : null;
    const dmName = url ? (url.searchParams.get('name') || '') : '';
    const hubId = url ? (Number(url.searchParams.get('open_hub')) || null) : null;
    const notificationType = GENERIC_TYPES.includes(info.type) ? info.type : 'generic';

    event.waitUntil((async () => {

        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

        // Açık bir Sauran penceresi varsa ona odaklan; yerel bildirimse sohbeti, push bildirimiyse tür bazlı genel ekranı açmasını iste.
        if (windows.length > 0) {
            const client = windows[0];
            await client.focus();
            if (dmUserId) client.postMessage({ type: 'open-dm', userId: dmUserId, username: dmName });
            else if (hubId) client.postMessage({ type: 'open-hub', hubId });
            else if (!url) client.postMessage({ type: 'open-general', notificationType });
            return;
        }

        await self.clients.openWindow(url ? url.pathname + url.search : '/?notif_type=' + encodeURIComponent(notificationType));

    })());

});
