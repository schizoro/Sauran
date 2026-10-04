/* Sohbet performansı: ekran dışındaki hareketli görseller (GIF / hareketli çıkartma-emoji) bellekten bırakılır, görünür alana yaklaşınca geri yüklenir.
   Çok sayıda hareketli görselin aynı anda çözülmesi (decode) telefonda saniyelerce takılma yapabilir. script.js'ten SONRA yüklenir. */
(function () {
    'use strict';
    const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    const SEL = 'img.chat-gif, img.stk-custom';
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            const img = en.target;
            if (en.isIntersecting) {
                if (img.dataset.pcSrc) { img.src = img.dataset.pcSrc; delete img.dataset.pcSrc; img.style.width = ''; img.style.height = ''; }
            } else if (img.complete && img.naturalWidth > 1 && !img.dataset.pcSrc) {
                const r = img.getBoundingClientRect();
                img.dataset.pcSrc = img.currentSrc || img.src;
                img.style.width = r.width + 'px'; img.style.height = r.height + 'px'; // yerleşim kaymasın
                img.src = PIXEL;
            }
        });
    }, { rootMargin: '700px 0px' }) : null;
    function watch(img) { if (io && !img.dataset.pcWatch) { img.dataset.pcWatch = '1'; io.observe(img); } }
    function scan(root) { root.querySelectorAll && root.querySelectorAll(SEL).forEach(watch); }
    ['hub-feed', 'dm-feed'].forEach((id) => {
        const feed = document.getElementById(id);
        if (!feed) return;
        scan(feed);
        new MutationObserver((muts) => {
            for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches(SEL)) watch(n); else scan(n); } });
        }).observe(feed, { childList: true, subtree: true });
    });

    // Üye listesindeki animasyonlu Premium kartlar: ekranda değilken durur (yüzlerce üyede sürekli animasyon yükünü keser)
    (function pauseOffscreenCards() {
        const list = document.getElementById('hub-member-list');
        if (!list || !('IntersectionObserver' in window)) return;
        const obs = new IntersectionObserver((entries) => entries.forEach((en) => en.target.classList.toggle('anim-off', !en.isIntersecting)), { root: null, rootMargin: '120px 0px' });
        const SEL2 = '.hub-member-card.member-prem';
        const watch2 = (el) => { if (!el.dataset.pcCard) { el.dataset.pcCard = '1'; obs.observe(el); } };
        const scan2 = (root) => root.querySelectorAll && root.querySelectorAll(SEL2).forEach(watch2);
        scan2(list);
        new MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches(SEL2)) watch2(n); else scan2(n); } }); }).observe(list, { childList: true, subtree: true });
    })();
})();
