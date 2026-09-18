// Sauran service worker — yalnızca Web Push bildirimleri için (önbellekleme yok).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {

    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        data = { body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'Sauran';

    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            tag: data.tag || undefined,
            renotify: Boolean(data.tag),
            data: { url: data.url || '/' }
        })
    );

});

self.addEventListener('notificationclick', (event) => {

    event.notification.close();

    const url = new URL(event.notification.data?.url || '/', self.location.origin);
    const dmUserId = Number(url.searchParams.get('open_dm')) || null;
    const dmName = url.searchParams.get('name') || '';
    const hubId = Number(url.searchParams.get('open_hub')) || null;

    event.waitUntil((async () => {

        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

        // Açık bir Sauran penceresi varsa ona odaklan ve sohbeti açmasını iste.
        if (windows.length > 0) {
            const client = windows[0];
            await client.focus();
            if (dmUserId) client.postMessage({ type: 'open-dm', userId: dmUserId, username: dmName });
            if (hubId) client.postMessage({ type: 'open-hub', hubId });
            return;
        }

        await self.clients.openWindow(url.pathname + url.search);

    })());

});
