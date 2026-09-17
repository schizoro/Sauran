// Bağımsız yasal sayfa dil değiştirici. Ana uygulamanın (script.js) I18N
// sistemiyle AYNI mimariyi (data-i18n attribute + sözlük) kullanır ama ona
// bağımlı değildir — yasal sayfalar oturum/socket gerektirmeden, tek başına
// statik dosyalar olarak erişilebilir kalmalı.
(function () {
  'use strict';

  function applyLegalLanguage(lang) {
    document.querySelectorAll('[data-tr]').forEach((el) => {
      const text = lang === 'en' ? el.dataset.en : el.dataset.tr;
      if (text !== undefined) el.innerHTML = text;
    });
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.langBtn === lang);
    });
  }

  function initLegalLanguageSwitcher() {
    // Ana uygulamada seçilmiş dil varsa (localStorage), yasal sayfa da
    // aynı dille açılsın — tutarlılık için.
    const saved = localStorage.getItem('sauran_lang') || 'tr';
    applyLegalLanguage(saved);

    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.langBtn;
        localStorage.setItem('sauran_lang', lang);
        applyLegalLanguage(lang);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLegalLanguageSwitcher);
  } else {
    initLegalLanguageSwitcher();
  }
})();
