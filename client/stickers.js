// Sauran Plus hareketli çıkartmalar: her biri SVG karakter — yüzü (göz kırpma, ağız), gövdesi, kolları ve
// kulak/kuyruk gibi parçaları ayrı ayrı hareket eder (animasyonlar theme.css'te, sınıf adları stk-*).
// script.js'ten ÖNCE yüklenir. Sunucu yalnızca kimlikleri (plus-*) bilir; görünüm tamamen istemcide.
(function () {
    'use strict';

    const INK = '#2b2b3a';

    // ── Yüz parçaları ──────────────────────────────────────────────
    const eyes = {
        dot: (y) => `<g class="stk-eyes"><ellipse cx="47" cy="${y}" rx="4.4" ry="5.6" fill="${INK}"/><ellipse cx="73" cy="${y}" rx="4.4" ry="5.6" fill="${INK}"/><circle cx="48.7" cy="${y - 2}" r="1.7" fill="#fff"/><circle cx="74.7" cy="${y - 2}" r="1.7" fill="#fff"/></g>`,
        happy: (y) => `<g class="stk-eyes-soft"><path d="M41 ${y + 3} Q47 ${y - 6} 53 ${y + 3}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M67 ${y + 3} Q73 ${y - 6} 79 ${y + 3}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`,
        wink: (y) => `<g><g class="stk-eyes"><ellipse cx="47" cy="${y}" rx="4.4" ry="5.6" fill="${INK}"/><circle cx="48.7" cy="${y - 2}" r="1.7" fill="#fff"/></g><path class="stk-eyes-soft" d="M67 ${y + 3} Q73 ${y - 6} 79 ${y + 3}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`,
        sleepy: (y) => `<g class="stk-eyes-soft"><path d="M41 ${y - 1} Q47 ${y + 6} 53 ${y - 1}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M67 ${y - 1} Q73 ${y + 6} 79 ${y - 1}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`,
        heart: (y) => `<g class="stk-pulse"><path d="M47 ${y + 6} C39 ${y} 41 ${y - 8} 47 ${y - 3} C53 ${y - 8} 55 ${y} 47 ${y + 6}Z" fill="#ff4d7a"/><path d="M73 ${y + 6} C65 ${y} 67 ${y - 8} 73 ${y - 3} C79 ${y - 8} 81 ${y} 73 ${y + 6}Z" fill="#ff4d7a"/></g>`,
        star: (y) => `<g class="stk-twinkle"><path d="M47 ${y - 7} L49.4 ${y - 1.5} L55 ${y - 1.2} L50.6 ${y + 2.6} L52 ${y + 8} L47 ${y + 5} L42 ${y + 8} L43.4 ${y + 2.6} L39 ${y - 1.2} L44.6 ${y - 1.5}Z" fill="#ffe14d" stroke="#e0a800" stroke-width="1"/><path d="M73 ${y - 7} L75.4 ${y - 1.5} L81 ${y - 1.2} L76.6 ${y + 2.6} L78 ${y + 8} L73 ${y + 5} L68 ${y + 8} L69.4 ${y + 2.6} L65 ${y - 1.2} L70.6 ${y - 1.5}Z" fill="#ffe14d" stroke="#e0a800" stroke-width="1"/></g>`
    };

    const mouths = {
        smile: (y) => `<path d="M53 ${y} Q60 ${y + 7} 67 ${y}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
        open: (y) => `<g class="stk-mouth"><path d="M52 ${y - 1} Q60 ${y + 12} 68 ${y - 1}Z" fill="#7a2233" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="60" cy="${y + 5}" rx="4" ry="2.4" fill="#ff8fa3"/></g>`,
        cat: (y) => `<path d="M53 ${y} Q56.5 ${y + 6} 60 ${y} Q63.5 ${y + 6} 67 ${y}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
        tongue: (y) => `<path d="M53 ${y} Q60 ${y + 7} 67 ${y}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><g class="stk-tongue"><path d="M57 ${y + 4} L57 ${y + 9} Q60 ${y + 12} 63 ${y + 9} L63 ${y + 4}Z" fill="#ff7f9a" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/></g>`,
        o: (y) => `<g class="stk-mouth"><ellipse cx="60" cy="${y + 2}" rx="3.6" ry="4.4" fill="#7a2233" stroke="${INK}" stroke-width="1.8"/></g>`,
        none: () => ''
    };

    const cheeks = (y, color) => `<ellipse cx="37" cy="${y}" rx="6" ry="3.6" fill="${color || '#ff8fa8'}" opacity=".55"/><ellipse cx="83" cy="${y}" rx="6" ry="3.6" fill="${color || '#ff8fa8'}" opacity=".55"/>`;

    const tri = (pts, fill, cls, extra) => `<path class="${cls || ''}" d="${pts}" fill="${fill}" stroke-linejoin="round" ${extra || ''}/>`;

    // ── Karakter tanımları ─────────────────────────────────────────
    // c: ana renk, k: koyu ton. back/under/front: SVG parçaları. eyes/mouth: yüz tipi. fy: yüz kaydırma.
    // wave: 'l' | 'r' | 'both' (el sallayan kol). body: gövde animasyonu (bob/sway/hop/float/pulse/roll).
    const D = {
        'plus-cat': {
            c: '#ffb45c', k: '#e58a2e', eyes: 'dot', mouth: 'cat', wave: 'r', body: 'bob',
            back: `<g class="stk-ear stk-ear-l">${tri('M30 40 L33 10 L54 28Z', '#ffb45c')}${tri('M35 33 L36 19 L47 28Z', '#ff9db4')}</g><g class="stk-ear stk-ear-r">${tri('M90 40 L87 10 L66 28Z', '#ffb45c')}${tri('M85 33 L84 19 L73 28Z', '#ff9db4')}</g><path class="stk-tail" d="M80 100 Q104 96 100 76" fill="none" stroke="#e58a2e" stroke-width="7" stroke-linecap="round"/>`,
            under: `<path d="M56 30 L60 40 L64 30" fill="none" stroke="#e58a2e" stroke-width="3" stroke-linecap="round"/>`,
            nose: `<path d="M57 58 L63 58 L60 62Z" fill="#ff7f9a"/><path d="M30 56 L42 58 M30 64 L42 62 M90 56 L78 58 M90 64 L78 62" stroke="#c98a4a" stroke-width="1.4" stroke-linecap="round"/>`
        },
        'plus-dog': {
            c: '#d9a066', k: '#b07a3e', eyes: 'dot', mouth: 'tongue', wave: 'l', body: 'hop',
            back: `<g class="stk-ear stk-ear-l"><ellipse cx="30" cy="48" rx="10" ry="20" transform="rotate(14 30 48)" fill="#8b5a2b"/></g><g class="stk-ear stk-ear-r"><ellipse cx="90" cy="48" rx="10" ry="20" transform="rotate(-14 90 48)" fill="#8b5a2b"/></g><path class="stk-tail" d="M82 98 Q100 92 102 76" fill="none" stroke="#b07a3e" stroke-width="8" stroke-linecap="round"/>`,
            under: `<ellipse cx="60" cy="63" rx="16" ry="12" fill="#f6e2c2"/><ellipse cx="72" cy="42" rx="9" ry="8" fill="#8b5a2b" opacity=".85"/>`,
            nose: `<ellipse cx="60" cy="58" rx="5.5" ry="4" fill="${INK}"/>`, fy: 0
        },
        'plus-bunny': {
            c: '#f6f4fb', k: '#cfc9e0', eyes: 'dot', mouth: 'smile', wave: 'r', body: 'hop',
            back: `<g class="stk-ear stk-ear-l"><ellipse cx="46" cy="16" rx="8" ry="22" fill="#f6f4fb" stroke="#cfc9e0" stroke-width="2"/><ellipse cx="46" cy="18" rx="4" ry="15" fill="#ffb3c8"/></g><g class="stk-ear stk-ear-r"><ellipse cx="74" cy="16" rx="8" ry="22" fill="#f6f4fb" stroke="#cfc9e0" stroke-width="2"/><ellipse cx="74" cy="18" rx="4" ry="15" fill="#ffb3c8"/></g><circle class="stk-tail" cx="86" cy="100" r="7" fill="#fff" stroke="#cfc9e0" stroke-width="2"/>`,
            nose: `<path d="M57 57 L63 57 L60 61Z" fill="#ff8fa8"/><path d="M60 61 L60 64" stroke="${INK}" stroke-width="1.6"/><rect x="57.5" y="66" width="5" height="6" rx="1.4" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`
        },
        'plus-bear': {
            c: '#b9834f', k: '#8f6234', eyes: 'dot', mouth: 'smile', wave: 'both', body: 'sway',
            back: `<g class="stk-ear stk-ear-l"><circle cx="35" cy="26" r="11" fill="#b9834f"/><circle cx="35" cy="26" r="6" fill="#e6b98a"/></g><g class="stk-ear stk-ear-r"><circle cx="85" cy="26" r="11" fill="#b9834f"/><circle cx="85" cy="26" r="6" fill="#e6b98a"/></g>`,
            under: `<ellipse cx="60" cy="64" rx="14" ry="10" fill="#ecd0a8"/>`, nose: `<ellipse cx="60" cy="59" rx="5" ry="3.6" fill="${INK}"/>`
        },
        'plus-panda': {
            c: '#fbfbfb', k: '#d2d2d2', arm: '#33333d', foot: '#33333d', eyes: 'dot', mouth: 'open', wave: 'r', body: 'roll',
            back: `<g class="stk-ear stk-ear-l"><circle cx="35" cy="26" r="11" fill="#33333d"/></g><g class="stk-ear stk-ear-r"><circle cx="85" cy="26" r="11" fill="#33333d"/></g>`,
            under: `<ellipse cx="46" cy="52" rx="9" ry="12" transform="rotate(20 46 52)" fill="#33333d"/><ellipse cx="74" cy="52" rx="9" ry="12" transform="rotate(-20 74 52)" fill="#33333d"/>`,
            eyesOnDark: true, nose: `<ellipse cx="60" cy="59" rx="4.4" ry="3.2" fill="${INK}"/>`
        },
        'plus-fox': {
            c: '#ff8a3d', k: '#e0651a', eyes: 'happy', mouth: 'smile', wave: 'l', body: 'bob',
            back: `<g class="stk-ear stk-ear-l">${tri('M30 42 L32 10 L54 30Z', '#ff8a3d')}${tri('M32 22 L33 12 L41 19Z', '#3a2a2a')}</g><g class="stk-ear stk-ear-r">${tri('M90 42 L88 10 L66 30Z', '#ff8a3d')}${tri('M88 22 L87 12 L79 19Z', '#3a2a2a')}</g><g class="stk-tail"><path d="M84 100 Q112 96 108 70 Q100 88 84 90Z" fill="#ff8a3d"/><path d="M108 70 Q106 80 102 84 Q108 84 110 76Z" fill="#fff"/></g>`,
            under: `<path d="M26 60 Q44 56 60 74 Q76 56 94 60 Q90 84 60 86 Q30 84 26 60Z" fill="#fff5ea"/>`, nose: `<ellipse cx="60" cy="59" rx="4.4" ry="3.2" fill="${INK}"/>`
        },
        'plus-chick': {
            c: '#ffd84d', k: '#e6b400', foot: '#ff9a3d', eyes: 'dot', mouth: 'none', wave: 'both', body: 'hop',
            front: `<path class="stk-tuft" d="M54 20 Q52 8 58 12 M60 19 Q60 6 64 12 M66 20 Q70 9 72 14" fill="none" stroke="#e6b400" stroke-width="3" stroke-linecap="round"/><g class="stk-mouth"><path d="M53 59 L67 59 L60 69Z" fill="#ff9a3d" stroke="#e57f1a" stroke-width="1.6" stroke-linejoin="round"/></g>`
        },
        'plus-penguin': {
            c: '#38486a', k: '#27334d', arm: '#38486a', foot: '#ffa53d', eyes: 'dot', mouth: 'none', wave: 'both', body: 'sway',
            belly: '#fff', under: `<ellipse cx="60" cy="60" rx="25" ry="22" fill="#fff"/>`,
            front: `<g class="stk-mouth"><path d="M53 60 L67 60 L60 69Z" fill="#ffa53d" stroke="#e5851a" stroke-width="1.6" stroke-linejoin="round"/></g>`
        },
        'plus-frog': {
            c: '#7ed957', k: '#54b23a', eyes: 'none', mouth: 'open', wave: 'r', body: 'hop',
            
            front: `<g class="stk-eyes"><circle cx="42" cy="26" r="13" fill="#7ed957"/><circle cx="78" cy="26" r="13" fill="#7ed957"/><circle cx="42" cy="26" r="9.5" fill="#fff"/><circle cx="78" cy="26" r="9.5" fill="#fff"/><circle cx="43" cy="27" r="5" fill="${INK}"/><circle cx="77" cy="27" r="5" fill="${INK}"/><circle cx="44.6" cy="24.6" r="1.7" fill="#fff"/><circle cx="78.6" cy="24.6" r="1.7" fill="#fff"/></g>`,
            under: `<path d="M38 62 Q60 82 82 62" fill="none" stroke="#54b23a" stroke-width="2.4" stroke-linecap="round"/>`, fy: 4
        },
        'plus-unicorn': {
            c: '#fff2f8', k: '#e7b6d2', eyes: 'star', mouth: 'smile', wave: 'r', body: 'float',
            back: `<g class="stk-mane"><circle cx="30" cy="34" r="11" fill="#ff9ecb"/><circle cx="24" cy="52" r="11" fill="#b99cff"/><circle cx="28" cy="70" r="10" fill="#8fd3ff"/></g><g class="stk-ear stk-ear-r">${tri('M84 34 L88 12 L98 30Z', '#fff2f8', '', 'stroke="#e7b6d2" stroke-width="1.6"')}</g>`,
            front: `<path class="stk-horn" d="M60 4 L52 28 L68 28Z" fill="#ffd84d" stroke="#e0a800" stroke-width="1.6" stroke-linejoin="round"/><path d="M55 22 L65 20 M56 15 L64 13" stroke="#e0a800" stroke-width="1.4"/>`
        },
        'plus-octopus': {
            c: '#b58cf5', k: '#8a5fd6', eyes: 'dot', mouth: 'o', noBody: true, noFeet: true, noArms: true, body: 'sway',
            back: `<g><ellipse class="stk-tent stk-tent-a" cx="34" cy="98" rx="7" ry="15" fill="#b58cf5"/><ellipse class="stk-tent stk-tent-b" cx="48" cy="102" rx="7" ry="15" fill="#b58cf5"/><ellipse class="stk-tent stk-tent-a" cx="72" cy="102" rx="7" ry="15" fill="#b58cf5"/><ellipse class="stk-tent stk-tent-b" cx="86" cy="98" rx="7" ry="15" fill="#b58cf5"/></g>`,
            under: `<circle cx="42" cy="30" r="3.4" fill="#d9c2ff"/><circle cx="76" cy="26" r="2.6" fill="#d9c2ff"/><circle cx="66" cy="34" r="2" fill="#d9c2ff"/>`
        },
        'plus-whale': {
            c: '#6ec6ff', k: '#3f9be0', eyes: 'happy', mouth: 'smile', noBody: true, noFeet: true, wave: 'both', body: 'float',
            head: `<ellipse cx="58" cy="62" rx="40" ry="32" fill="#6ec6ff"/><path d="M28 74 Q58 100 88 74 Q80 90 58 92 Q36 90 28 74Z" fill="#d9f1ff"/>`,
            back: `<g class="stk-tail"><path d="M92 66 Q112 52 108 38 Q100 50 88 54Z" fill="#6ec6ff"/><path d="M98 60 Q116 60 118 48 Q108 54 98 52Z" fill="#6ec6ff"/></g>`,
            front: `<g class="stk-spout"><path d="M58 30 Q52 20 46 22 M58 30 Q64 20 70 22 M58 30 L58 14" fill="none" stroke="#a7e0ff" stroke-width="3.4" stroke-linecap="round"/><circle cx="58" cy="10" r="3" fill="#a7e0ff"/></g>`, fy: 6
        },
        'plus-donut': {
            c: '#f2b46b', k: '#c98a3f', eyes: 'happy', mouth: 'open', noBody: true, wave: 'both', body: 'roll', fy: 8,
            head: `<path fill-rule="evenodd" d="M60 16 A38 38 0 1 1 59.9 16Z M60 26 A9 9 0 1 0 60.1 26Z" fill="#f2b46b"/><path fill-rule="evenodd" d="M60 21 A33 33 0 1 1 59.9 21Z M60 27 A8 8 0 1 0 60.1 27Z" fill="#ff8fb5"/><g stroke-linecap="round" stroke-width="3.2"><path d="M34 44 l5 -3" stroke="#fff"/><path d="M82 40 l5 3" stroke="#ffe14d"/><path d="M26 66 l5 2" stroke="#7fe0ff"/><path d="M92 64 l-5 3" stroke="#fff"/><path d="M48 90 l5 1" stroke="#ffe14d"/><path d="M76 92 l-5 -2" stroke="#7fe0ff"/></g>`
        },
        'plus-strawberry': {
            c: '#ff5a6e', k: '#d93a50', eyes: 'dot', mouth: 'open', noBody: true, wave: 'l', body: 'bob', fy: 8,
            head: `<path d="M60 108 C20 86 14 44 38 34 C50 29 56 36 60 40 C64 36 70 29 82 34 C106 44 100 86 60 108Z" fill="#ff5a6e"/><g fill="#ffe9a8"><ellipse cx="42" cy="48" rx="1.8" ry="2.8"/><ellipse cx="78" cy="48" rx="1.8" ry="2.8"/><ellipse cx="34" cy="66" rx="1.8" ry="2.8"/><ellipse cx="86" cy="66" rx="1.8" ry="2.8"/><ellipse cx="50" cy="90" rx="1.8" ry="2.8"/><ellipse cx="70" cy="90" rx="1.8" ry="2.8"/><ellipse cx="60" cy="98" rx="1.8" ry="2.8"/></g>`,
            front: `<g class="stk-leaf"><path d="M60 40 Q46 30 36 36 Q48 44 60 40Z M60 40 Q74 30 84 36 Q72 44 60 40Z M60 40 Q54 22 60 14 Q66 22 60 40Z" fill="#5ed06a" stroke="#3aa34a" stroke-width="1.4" stroke-linejoin="round"/></g>`
        },
        'plus-teddy': {
            c: '#d9a86b', k: '#b58248', eyes: 'happy', mouth: 'smile', wave: 'both', body: 'sway',
            back: `<g class="stk-ear stk-ear-l"><circle cx="35" cy="26" r="11" fill="#d9a86b"/><circle cx="35" cy="26" r="6" fill="#f3cf9e"/></g><g class="stk-ear stk-ear-r"><circle cx="85" cy="26" r="11" fill="#d9a86b"/><circle cx="85" cy="26" r="6" fill="#f3cf9e"/></g>`,
            under: `<ellipse cx="60" cy="64" rx="14" ry="10" fill="#f3cf9e"/><path d="M50 30 l6 4 M52 34 l6 -4" stroke="#b58248" stroke-width="2" stroke-linecap="round"/>`,
            nose: `<ellipse cx="60" cy="59" rx="5" ry="3.6" fill="#6b4520"/>`,
            front: `<g class="stk-bow"><path d="M60 88 L46 80 L46 96Z M60 88 L74 80 L74 96Z" fill="#ff5a6e" stroke="#d93a50" stroke-width="1.6" stroke-linejoin="round"/><circle cx="60" cy="88" r="4" fill="#d93a50"/></g>`
        },
        'plus-star': {
            c: '#ffd84d', k: '#e6b400', eyes: 'happy', mouth: 'open', noBody: true, wave: 'both', body: 'twinkle', fy: 4,
            head: `<path d="M60 12 L72 40 L102 42 L79 61 L87 90 L60 74 L33 90 L41 61 L18 42 L48 40Z" fill="#ffd84d" stroke="#ffd84d" stroke-width="10" stroke-linejoin="round"/>`,
            front: `<g class="stk-twinkle"><path d="M104 18 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z" fill="#fff6c2"/><path d="M14 30 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6Z" fill="#fff6c2"/></g>`
        },
        'plus-rainbow': {
            c: '#ffffff', k: '#dfe9f5', eyes: 'happy', mouth: 'smile', noBody: true, noFeet: true, noArms: true, body: 'float', fy: 14,
            back: `<g class="stk-rainbow" fill="none" stroke-width="7" stroke-linecap="round"><path d="M14 80 A46 46 0 0 1 106 80" stroke="#ff6b6b"/><path d="M22 80 A38 38 0 0 1 98 80" stroke="#ffb14d"/><path d="M30 80 A30 30 0 0 1 90 80" stroke="#ffe14d"/><path d="M38 80 A22 22 0 0 1 82 80" stroke="#6fdc7a"/><path d="M46 80 A14 14 0 0 1 74 80" stroke="#6ab7ff"/></g>`,
            head: `<g fill="#fff" stroke="#dfe9f5" stroke-width="2"><circle cx="38" cy="86" r="18"/><circle cx="82" cy="86" r="18"/><circle cx="60" cy="76" r="22"/><rect x="38" y="80" width="44" height="24" rx="12" stroke="none"/></g><g fill="#fff"><circle cx="38" cy="86" r="16.6"/><circle cx="82" cy="86" r="16.6"/><circle cx="60" cy="76" r="20.6"/><rect x="38" y="82" width="44" height="21" rx="10"/></g>`
        },
        'plus-clover': {
            c: '#58c46a', k: '#2f9a45', eyes: 'happy', mouth: 'smile', noBody: true, noArms: true, body: 'roll', fy: 8,
            back: `<path class="stk-stem" d="M60 84 Q62 104 52 116" fill="none" stroke="#2f9a45" stroke-width="6" stroke-linecap="round"/>`,
            head: `<g fill="#58c46a" stroke="#3aa64e" stroke-width="2"><circle cx="42" cy="42" r="21"/><circle cx="78" cy="42" r="21"/><circle cx="42" cy="78" r="21"/><circle cx="78" cy="78" r="21"/></g><rect x="34" y="34" width="52" height="52" rx="14" fill="#58c46a"/>`,
            front: `<path d="M60 20 L60 32 M60 88 L60 100 M22 60 L34 60 M86 60 L98 60" stroke="#3aa64e" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>`
        },
        'plus-sparkle-heart': {
            c: '#ff6fa5', k: '#e03c80', eyes: 'star', mouth: 'open', noBody: true, wave: 'both', body: 'pulse', fy: 4,
            head: `<path d="M60 106 C8 74 12 26 42 24 C52 23 58 28 60 34 C62 28 68 23 78 24 C108 26 112 74 60 106Z" fill="#ff6fa5"/><path d="M34 40 Q40 32 48 34" fill="none" stroke="#ffb3d1" stroke-width="4" stroke-linecap="round"/>`,
            front: `<g class="stk-twinkle"><path d="M104 22 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z" fill="#fff6c2"/><path d="M14 20 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6Z" fill="#fff6c2"/></g>`
        },
        'plus-coffee': {
            c: '#f7ead2', k: '#c99a5b', eyes: 'happy', mouth: 'smile', noBody: true, noFeet: true, noArms: true, fy: 26,
            back: `<g class="stk-steam"><path d="M46 36 Q40 28 46 20 Q52 12 46 6" fill="none" stroke="#dfe6f0" stroke-width="4" stroke-linecap="round"/><path d="M62 36 Q56 28 62 20 Q68 12 62 6" fill="none" stroke="#dfe6f0" stroke-width="4" stroke-linecap="round"/><path d="M78 36 Q72 28 78 20 Q84 12 78 6" fill="none" stroke="#dfe6f0" stroke-width="4" stroke-linecap="round"/></g><ellipse cx="60" cy="108" rx="40" ry="8" fill="#e4d2b0" stroke="#c99a5b" stroke-width="1.6"/>`,
            head: `<path d="M86 60 Q108 58 106 76 Q104 90 84 90" fill="none" stroke="#c99a5b" stroke-width="7" stroke-linecap="round"/><path d="M22 46 L98 46 L92 96 Q90 106 80 106 L40 106 Q30 106 28 96Z" fill="#f7ead2" stroke="#c99a5b" stroke-width="2" stroke-linejoin="round"/><ellipse cx="60" cy="46" rx="38" ry="8" fill="#7a4a2a" stroke="#c99a5b" stroke-width="2"/>`
        },
        'plus-pizza': {
            c: '#ffcf5c', k: '#e39a2d', eyes: 'dot', mouth: 'open', noBody: true, noFeet: true, noArms: true, fy: 8,
            head: `<path d="M60 112 L16 36 Q60 14 104 36Z" fill="#ffcf5c" stroke="#e39a2d" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 36 Q60 14 104 36" fill="none" stroke="#e8a33d" stroke-width="10" stroke-linecap="round"/><g fill="#e8504a" stroke="#c23a35" stroke-width="1.4"><circle cx="38" cy="50" r="6"/><circle cx="82" cy="48" r="6"/><circle cx="60" cy="88" r="5.4"/></g><g fill="#5cc45a"><circle cx="70" cy="70" r="2.4"/><circle cx="48" cy="76" r="2.2"/><circle cx="78" cy="88" r="2"/></g>`
        },
        'plus-cake': {
            c: '#ffd6e8', k: '#e58fb5', eyes: 'happy', mouth: 'smile', noBody: true, noFeet: true, noArms: true, fy: 20,
            head: `<rect x="24" y="52" width="72" height="54" rx="12" fill="#ffd6e8" stroke="#e58fb5" stroke-width="2"/><path d="M24 64 Q24 52 36 52 L84 52 Q96 52 96 64 Q90 76 84 66 Q78 78 70 66 Q62 76 56 66 Q48 78 42 66 Q34 76 24 64Z" fill="#fff" stroke="#e58fb5" stroke-width="1.6" stroke-linejoin="round"/><circle cx="60" cy="46" r="8" fill="#ff5a6e" stroke="#d93a50" stroke-width="1.6"/><rect x="58" y="24" width="4" height="14" rx="1.6" fill="#7fd0ff"/>`,
            front: `<g class="stk-flame"><path d="M60 8 Q54 18 60 24 Q66 18 60 8Z" fill="#ffb02e" stroke="#ff7a1a" stroke-width="1.2"/></g>`
        },
        'plus-gamepad': {
            c: '#6a6ae0', k: '#4646b8', eyes: 'dot', mouth: 'open', noBody: true, noFeet: true, noArms: true, fy: 6,
            head: `<path d="M28 44 Q60 30 92 44 Q112 52 108 86 Q104 104 92 96 Q84 90 76 84 L44 84 Q36 90 28 96 Q16 104 12 86 Q8 52 28 44Z" fill="#6a6ae0" stroke="#4646b8" stroke-width="2" stroke-linejoin="round"/><g fill="#2f2f7a"><rect x="13" y="58" width="16" height="6" rx="2"/><rect x="18" y="53" width="6" height="16" rx="2"/></g><circle cx="97" cy="54" r="4" fill="#ffd84d"/><circle cx="106" cy="62" r="4" fill="#ff6b6b"/><circle cx="88" cy="62" r="4" fill="#6fdc7a"/><circle cx="97" cy="70" r="4" fill="#6ab7ff"/>`
        },
        'plus-bulb': {
            c: '#ffe066', k: '#e6b800', eyes: 'dot', mouth: 'smile', noBody: true, noFeet: true, noArms: true, fy: -2,
            back: `<g class="stk-glow"><g stroke="#ffe066" stroke-width="4" stroke-linecap="round"><path d="M60 4 L60 12"/><path d="M22 22 L28 28"/><path d="M98 22 L92 28"/><path d="M8 54 L16 54"/><path d="M112 54 L104 54"/></g></g>`,
            head: `<path d="M60 16 A32 32 0 0 1 78 74 L78 84 L42 84 L42 74 A32 32 0 0 1 60 16Z" fill="#ffe066" stroke="#e6b800" stroke-width="2.2" stroke-linejoin="round"/><rect x="42" y="84" width="36" height="8" rx="3" fill="#b8c0cc" stroke="#8b94a3" stroke-width="1.6"/><rect x="46" y="92" width="28" height="8" rx="3" fill="#b8c0cc" stroke="#8b94a3" stroke-width="1.6"/><path d="M50 100 L70 100 L66 108 L54 108Z" fill="#8b94a3"/>`
        },
        'plus-ghost': {
            c: '#f5f5ff', k: '#c9caee', eyes: 'dot', mouth: 'o', noBody: true, noFeet: true, fy: 4,
            head: `<path d="M26 104 L26 52 A34 34 0 0 1 94 52 L94 104 L82 94 L71 104 L60 94 L49 104 L38 94Z" fill="#f5f5ff" stroke="#c9caee" stroke-width="2" stroke-linejoin="round"/>`
        },
        'plus-balloon': {
            c: '#ff5a5a', k: '#d93a3a', eyes: 'dot', mouth: 'smile', noBody: true, noFeet: true, noArms: true, body: 'float', fy: -4,
            back: `<path class="stk-string" d="M60 92 Q52 102 60 110 Q68 118 58 122" fill="none" stroke="#9aa3b5" stroke-width="2.4" stroke-linecap="round"/>`,
            head: `<ellipse cx="60" cy="50" rx="32" ry="38" fill="#ff5a5a"/><path d="M60 88 L53 98 L67 98Z" fill="#d93a3a" stroke="#d93a3a" stroke-width="2" stroke-linejoin="round"/><path d="M40 30 Q44 20 52 18" fill="none" stroke="#ff9a9a" stroke-width="4.4" stroke-linecap="round"/>`
        }
    };

    // Her karakterin hareketi farklı: kimi el sallar, kimi yalnızca yüz ifadesi değiştirir, kimi gövdesiyle oynar.
    // alt/mouth2: yüz ifadesi periyodik olarak bu ikinciye geçer.
    const TUNE = {
        'plus-cat': { wave: 'r', body: 'bob', alt: 'happy', mouth2: 'open' },
        'plus-dog': { body: 'hop', alt: 'happy' },
        'plus-bunny': { body: 'hop', alt: 'sleepy' },
        'plus-bear': { wave: 'both', alt: 'happy' },
        'plus-panda': { body: 'roll', alt: 'sleepy', mouth2: 'smile' },
        'plus-fox': { alt: 'dot', mouth2: 'open' },
        'plus-chick': { wave: 'both', alt: 'happy' },
        'plus-penguin': { body: 'sway', alt: 'wink' },
        'plus-frog': { body: 'hop' },
        'plus-unicorn': { body: 'float', alt: 'happy' },
        'plus-octopus': { body: 'sway', alt: 'happy' },
        'plus-whale': { body: 'float', alt: 'dot' },
        'plus-donut': { body: 'roll', alt: 'heart' },
        'plus-strawberry': { alt: 'happy', mouth2: 'smile' },
        'plus-teddy': { alt: 'dot' },
        'plus-star': { body: 'twinkle', alt: 'dot', mouth2: 'smile' },
        'plus-rainbow': { body: 'float', alt: 'sleepy' },
        'plus-clover': { body: 'roll', alt: 'wink' },
        'plus-sparkle-heart': { body: 'pulse', alt: 'heart' },
        'plus-balloon': { body: 'float', alt: 'happy' },
        'plus-coffee': { alt: 'sleepy' },
        'plus-pizza': { body: 'sway', alt: 'happy' },
        'plus-cake': { alt: 'heart', mouth2: 'open' },
        'plus-gamepad': { body: 'bob', alt: 'happy' },
        'plus-bulb': { alt: 'star', mouth2: 'open' },
        'plus-ghost': { body: 'float', wave: 'both', alt: 'star' }
    };

    // ── Plus: Yeni hayvan dostlar (domuz, koala, maymun, ördek, kaplan) ──
    Object.assign(D, {
        'plus-pig': {
            c: '#ffb3c7', k: '#e07a99', eyes: 'dot', mouth: 'none', wave: 'r', body: 'bob',
            back: `<g class="stk-ear stk-ear-l">${tri('M32 36 L30 10 L52 26Z', '#ffb3c7')}</g><g class="stk-ear stk-ear-r">${tri('M88 36 L90 10 L68 26Z', '#ffb3c7')}</g>`,
            nose: `<ellipse cx="60" cy="61" rx="10" ry="7.5" fill="#ff8fae" stroke="#e07a99" stroke-width="1.4"/><circle cx="56" cy="61" r="1.8" fill="#b84a6b"/><circle cx="64" cy="61" r="1.8" fill="#b84a6b"/>`
        },
        'plus-koala': {
            c: '#b9bfcc', k: '#8a91a1', eyes: 'dot', mouth: 'smile', wave: 'both', body: 'sway',
            back: `<g class="stk-ear stk-ear-l"><circle cx="28" cy="28" r="14" fill="#b9bfcc" stroke="#8a91a1" stroke-width="1.6"/><circle cx="28" cy="28" r="8" fill="#e6e9f0"/></g><g class="stk-ear stk-ear-r"><circle cx="92" cy="28" r="14" fill="#b9bfcc" stroke="#8a91a1" stroke-width="1.6"/><circle cx="92" cy="28" r="8" fill="#e6e9f0"/></g>`,
            nose: `<ellipse cx="60" cy="57" rx="6" ry="8" fill="#3b3f4d"/>`
        },
        'plus-monkey': {
            c: '#b57c4a', k: '#835325', eyes: 'dot', mouth: 'smile', wave: 'both', body: 'hop',
            back: `<g class="stk-ear stk-ear-l"><circle cx="24" cy="52" r="11" fill="#b57c4a" stroke="#835325" stroke-width="1.6"/><circle cx="24" cy="52" r="6" fill="#f2c7a0"/></g><g class="stk-ear stk-ear-r"><circle cx="96" cy="52" r="11" fill="#b57c4a" stroke="#835325" stroke-width="1.6"/><circle cx="96" cy="52" r="6" fill="#f2c7a0"/></g>`,
            under: `<path d="M60 36 Q74 30 82 44 Q90 62 76 76 Q60 84 44 76 Q30 62 38 44 Q46 30 60 36Z" fill="#f2c7a0"/>`,
            nose: `<circle cx="56" cy="60" r="1.6" fill="#835325"/><circle cx="64" cy="60" r="1.6" fill="#835325"/>`
        },
        'plus-duck': {
            c: '#ffe14d', k: '#e0b81c', eyes: 'dot', mouth: 'none', wave: 'both', body: 'bob',
            nose: `<ellipse cx="60" cy="62" rx="14" ry="7" fill="#ff9d2e" stroke="#d97a0a" stroke-width="1.4"/><path d="M48 62 Q60 66 72 62" fill="none" stroke="#d97a0a" stroke-width="1.2"/>`,
            front: `<path class="stk-ear" d="M56 20 Q54 8 60 6 Q58 14 64 12 Q64 18 62 20Z" fill="#ffe14d" stroke="#e0b81c" stroke-width="1.2" stroke-linejoin="round"/>`
        },
        'plus-tiger': {
            c: '#ffa83d', k: '#d6761a', eyes: 'dot', mouth: 'cat', wave: 'r', body: 'bob',
            back: `<g class="stk-ear stk-ear-l">${tri('M30 40 L33 10 L54 28Z', '#ffa83d')}${tri('M35 33 L36 19 L47 28Z', '#fff2d9')}</g><g class="stk-ear stk-ear-r">${tri('M90 40 L87 10 L66 28Z', '#ffa83d')}${tri('M85 33 L84 19 L73 28Z', '#fff2d9')}</g>`,
            under: `<path d="M60 20 L60 33 M44 24 L48 35 M76 24 L72 35 M28 50 L40 52 M92 50 L80 52" stroke="#8a3f0a" stroke-width="3.2" stroke-linecap="round" fill="none"/><ellipse cx="60" cy="66" rx="16" ry="11" fill="#fff2d9"/>`,
            nose: `<path d="M57 57 L63 57 L60 61Z" fill="#ff7f9a"/>`
        }
    });
    Object.keys(D).forEach((k) => {
        const t = TUNE[k] || {};
        D[k].wave = t.wave;
        D[k].body = t.body;
        D[k].alt = t.alt;
        D[k].mouth2 = t.mouth2;
    });


    // ── Sauran Premium çıkartma seti (prem-*): Plus setinden farklı, daha büyük karakterler; hepsinde altın pırıltı işareti ──
    const PSTAR = `<path class="stk-twinkle" d="M101 12 L103.4 18 L109.6 18.4 L104.8 22.4 L106.4 28.6 L101 25.2 L95.6 28.6 L97.2 22.4 L92.4 18.4 L98.6 18Z" fill="#ffd84d" stroke="#e0a526" stroke-width="1"/>`;
    const PD = {
        'prem-dragon': {
            c: '#5fd38d', k: '#2f9b62', eyes: 'dot', mouth: 'open', wave: 'r', body: 'bob',
            back: `<path class="stk-ear stk-ear-l" d="M32 62 L4 34 L9 66 L3 80 L30 78Z" fill="#8fe8b4" stroke="#2f9b62" stroke-width="1.6" stroke-linejoin="round"/><path class="stk-ear stk-ear-r" d="M88 62 L116 34 L111 66 L117 80 L90 78Z" fill="#8fe8b4" stroke="#2f9b62" stroke-width="1.6" stroke-linejoin="round"/><path class="stk-tail" d="M80 102 Q108 102 108 80 Q98 94 80 92Z" fill="#5fd38d" stroke="#2f9b62" stroke-width="1.6" stroke-linejoin="round"/>`,
            under: `<ellipse cx="60" cy="66" rx="17" ry="11" fill="#c9f5da"/>`,
            nose: `<circle cx="54" cy="60" r="1.8" fill="#2b2b3a"/><circle cx="66" cy="60" r="1.8" fill="#2b2b3a"/>`,
            front: `<g class="stk-horn">${tri('M40 26 L35 6 L51 20Z', '#ffd84d', '', 'stroke="#e0a526" stroke-width="1.4"')}${tri('M80 26 L85 6 L69 20Z', '#ffd84d', '', 'stroke="#e0a526" stroke-width="1.4"')}</g>${PSTAR}`
        },
        'prem-phoenix': {
            c: '#ff7a3d', k: '#d4471a', eyes: 'star', mouth: 'none', wave: 'both', body: 'float',
            back: `<path class="stk-ear stk-ear-l" d="M30 58 Q2 40 8 14 Q14 40 36 46Z" fill="#ffb02e" stroke="#d4471a" stroke-width="1.6" stroke-linejoin="round"/><path class="stk-ear stk-ear-r" d="M90 58 Q118 40 112 14 Q106 40 84 46Z" fill="#ffb02e" stroke="#d4471a" stroke-width="1.6" stroke-linejoin="round"/><g class="stk-flame"><path d="M44 100 Q60 124 76 100 Q66 108 60 96 Q54 108 44 100Z" fill="#ff5a1f"/></g>`,
            under: `<ellipse cx="60" cy="66" rx="15" ry="10" fill="#ffd9a8"/>`,
            nose: `<path d="M55 57 L65 57 L60 67Z" fill="#ffd84d" stroke="#e0a526" stroke-width="1.4" stroke-linejoin="round"/>`,
            front: `<g class="stk-flame"><path d="M60 -2 Q50 12 58 20 Q60 12 66 18 Q72 8 60 -2Z" fill="#ffb02e" stroke="#ff7a1a" stroke-width="1.2"/><path d="M48 10 Q40 20 46 26 Q50 18 54 22Z" fill="#ff7a3d"/><path d="M72 10 Q80 20 74 26 Q70 18 66 22Z" fill="#ff7a3d"/></g>${PSTAR}`
        },
        'prem-wolf': {
            c: '#9aa3b5', k: '#6b7488', eyes: 'dot', mouth: 'smile', wave: 'r', body: 'sway',
            back: `<g class="stk-ear stk-ear-l">${tri('M30 46 L26 6 L56 28Z', '#9aa3b5', '', 'stroke="#6b7488" stroke-width="1.6"')}${tri('M33 36 L31 16 L47 28Z', '#5d667b')}</g><g class="stk-ear stk-ear-r">${tri('M90 46 L94 6 L64 28Z', '#9aa3b5', '', 'stroke="#6b7488" stroke-width="1.6"')}${tri('M87 36 L89 16 L73 28Z', '#5d667b')}</g><path class="stk-tail" d="M82 100 Q108 98 106 72 Q100 90 82 92Z" fill="#9aa3b5" stroke="#6b7488" stroke-width="1.6"/>`,
            under: `<ellipse cx="60" cy="65" rx="19" ry="13" fill="#e9edf5"/><path d="M26 54 Q36 62 40 74 M94 54 Q84 62 80 74" fill="none" stroke="#e9edf5" stroke-width="5" stroke-linecap="round"/>`,
            nose: `<ellipse cx="60" cy="58" rx="5.4" ry="3.8" fill="#2b2b3a"/>`, front: PSTAR
        },
        'prem-lion': {
            c: '#f2b94a', k: '#c78a1c', eyes: 'dot', mouth: 'smile', wave: 'both', body: 'bob',
            back: `<g class="stk-mane">${[[60, 19], [88, 27], [99, 52], [90, 79], [60, 89], [30, 79], [21, 52], [32, 27]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="#c7761c" stroke="#9e5a10" stroke-width="1.4"/>`).join('')}</g>`,
            under: `<circle cx="38" cy="26" r="8" fill="#f2b94a" stroke="#c78a1c" stroke-width="1.4"/><circle cx="82" cy="26" r="8" fill="#f2b94a" stroke="#c78a1c" stroke-width="1.4"/><ellipse cx="60" cy="65" rx="16" ry="11" fill="#fff0c9"/>`,
            nose: `<path d="M55 57 L65 57 L60 63Z" fill="#8a4b2a" stroke-linejoin="round"/>`, front: PSTAR
        },
        'prem-owl': {
            c: '#9a7550', k: '#6e5035', eyes: 'dot', mouth: 'none', wave: 'both', body: 'bob',
            back: `<g class="stk-ear stk-ear-l">${tri('M32 38 L30 8 L52 24Z', '#9a7550', '', 'stroke="#6e5035" stroke-width="1.6"')}</g><g class="stk-ear stk-ear-r">${tri('M88 38 L90 8 L68 24Z', '#9a7550', '', 'stroke="#6e5035" stroke-width="1.6"')}</g>`,
            under: `<circle cx="47" cy="52" r="14" fill="#f6e9d3" stroke="#6e5035" stroke-width="1.6"/><circle cx="73" cy="52" r="14" fill="#f6e9d3" stroke="#6e5035" stroke-width="1.6"/><path d="M40 20 Q60 30 80 20" fill="none" stroke="#6e5035" stroke-width="2" opacity=".5"/>`,
            nose: `<path d="M55 60 L65 60 L60 71Z" fill="#ffb02e" stroke="#d98a00" stroke-width="1.4" stroke-linejoin="round"/>`,
            belly: '#e9d5b3', front: PSTAR
        },
        'prem-turtle': {
            c: '#6dcf7f', k: '#3a9a50', eyes: 'happy', mouth: 'smile', wave: 'r', body: 'sway',
            back: `<ellipse cx="60" cy="86" rx="36" ry="28" fill="#3f8f55" stroke="#2c6a3d" stroke-width="2"/><path d="M60 62 L60 108 M30 76 L90 76 M32 98 L88 98" stroke="#2c6a3d" stroke-width="2" fill="none" opacity=".7"/><path class="stk-tail" d="M92 100 L108 106 L94 108Z" fill="#6dcf7f" stroke="#3a9a50" stroke-width="1.4"/>`,
            under: `<ellipse cx="60" cy="66" rx="14" ry="9" fill="#d3f5db"/>`, front: PSTAR
        },
        'prem-robot': {
            c: '#b8c4d9', k: '#7f8ca6', eyes: 'star', mouth: 'none', wave: 'r', body: 'bob',
            head: `<rect x="26" y="20" width="68" height="62" rx="16" fill="#b8c4d9" stroke="#7f8ca6" stroke-width="2"/>`,
            under: `<rect x="34" y="30" width="52" height="34" rx="10" fill="#27324d"/>`,
            nose: `<rect x="46" y="68" width="28" height="7" rx="3.5" fill="#2b2b3a"/><path d="M52 68 L52 75 M60 68 L60 75 M68 68 L68 75" stroke="#b8c4d9" stroke-width="1.4"/>`,
            front: `<g class="stk-ear stk-ear-r"><path d="M60 20 L60 8" stroke="#7f8ca6" stroke-width="3" stroke-linecap="round"/><circle class="stk-pulse" cx="60" cy="6" r="5" fill="#ff4d7a" stroke="#d6335f" stroke-width="1.2"/></g>${PSTAR}`
        },
        'prem-alien': {
            c: '#9be15d', k: '#6aa832', eyes: 'none', mouth: 'o', wave: 'both', body: 'float',
            back: `<g class="stk-ear stk-ear-l"><path d="M44 24 Q36 10 28 6" stroke="#6aa832" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="27" cy="5" r="5" fill="#d9ff9e" stroke="#6aa832" stroke-width="1.4"/></g><g class="stk-ear stk-ear-r"><path d="M76 24 Q84 10 92 6" stroke="#6aa832" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="93" cy="5" r="5" fill="#d9ff9e" stroke="#6aa832" stroke-width="1.4"/></g>`,
            front: `<ellipse cx="44" cy="52" rx="10" ry="13" transform="rotate(-16 44 52)" fill="#1b1b2a"/><ellipse cx="76" cy="52" rx="10" ry="13" transform="rotate(16 76 52)" fill="#1b1b2a"/><circle cx="41" cy="46" r="3.2" fill="#fff"/><circle cx="73" cy="46" r="3.2" fill="#fff"/>${PSTAR}`
        },
        'prem-astronaut': {
            c: '#f4f6fb', k: '#aab3c8', eyes: 'star', mouth: 'smile', wave: 'both', body: 'float',
            under: `<ellipse cx="60" cy="52" rx="27" ry="23" fill="#27324d" stroke="#aab3c8" stroke-width="2"/><ellipse cx="50" cy="42" rx="9" ry="4" fill="#fff" opacity=".32" transform="rotate(-22 50 42)"/>`,
            back: `<rect x="40" y="62" width="40" height="36" rx="12" fill="#cfd6e6" stroke="#aab3c8" stroke-width="1.6"/>`,
            front: `<circle cx="34" cy="86" r="4" fill="#ff7a3d"/><circle cx="46" cy="86" r="4" fill="#4f9cff"/>${PSTAR}`
        },
        'prem-king': {
            c: '#ffd36b', k: '#e0a526', eyes: 'happy', mouth: 'smile', wave: 'r', body: 'bob',
            back: `<path d="M30 70 Q16 100 24 116 L96 116 Q104 100 90 70Z" fill="#d6334f" stroke="#a9203a" stroke-width="1.6" stroke-linejoin="round"/>`,
            front: `<g class="stk-bow"><path d="M36 26 L40 6 L51 18 L60 2 L69 18 L80 6 L84 26Z" fill="#ffd84d" stroke="#d99a00" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="10" r="3" fill="#ff4d7a"/><circle cx="42" cy="12" r="2.4" fill="#4f9cff"/><circle cx="78" cy="12" r="2.4" fill="#4f9cff"/></g>${PSTAR}`
        },
        'prem-snowman': {
            c: '#f1f6ff', k: '#b9c8e0', arm: '#7a5230', foot: '#7a5230', eyes: 'dot', mouth: 'smile', wave: 'both', body: 'sway',
            nose: `<path d="M57 55 L82 61 L57 65Z" fill="#ff8a3d" stroke="#e0651a" stroke-width="1.2" stroke-linejoin="round"/>`,
            front: `<path d="M38 80 Q60 92 82 80 L80 90 Q60 102 40 90Z" fill="#e0405a" stroke="#b92c44" stroke-width="1.2"/><rect x="36" y="14" width="48" height="7" rx="3" fill="#2b2b3a"/><rect x="44" y="-2" width="32" height="18" rx="4" fill="#2b2b3a"/><rect x="44" y="9" width="32" height="4" fill="#e0405a"/>${PSTAR}`
        },
        'prem-flame': {
            c: '#ff8a3d', k: '#e0501a', eyes: 'dot', mouth: 'open', noBody: true, noFeet: true, noArms: true, body: 'float', fy: 8,
            head: `<path class="stk-flame" d="M60 6 Q94 36 90 64 Q86 92 60 92 Q34 92 30 64 Q26 36 60 6Z" fill="#ff8a3d" stroke="#e0501a" stroke-width="2" stroke-linejoin="round"/>`,
            under: `<path d="M60 36 Q78 54 76 70 Q74 86 60 86 Q46 86 44 70 Q42 54 60 36Z" fill="#ffd24d"/>`, front: PSTAR
        }
    };
    Object.assign(D, PD);
    window.PREMIUM_STICKER_IDS = Object.keys(PD);

    // Hangi hayvanlar karanlık yüz üzerinde (panda göz çevresi) — gözler beyaz noktalı kalır, ek işlem gerekmez.

    function arm(side, fill, cls, y, stroke) {
        const x = side === 'l' ? 35 : 85;
        const rot = side === 'l' ? 18 : -18;
        return `<g class="stk-arm ${cls}"><ellipse cx="${x}" cy="${y}" rx="6.6" ry="12" transform="rotate(${rot} ${x} ${y})" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/></g>`;
    }

    function plusStickerSvg(id) {
        const d = D[id];
        if (!d) return '';
        const fy = d.fy || 0;
        const parts = [];
        parts.push(d.back || '');
        if (!d.noFeet) {
            const f = d.foot || d.k;
            parts.push(`<g class="stk-foot stk-foot-l"><ellipse cx="46" cy="109" rx="10.5" ry="6" fill="${f}" stroke="${d.k}" stroke-width="1.4"/></g><g class="stk-foot stk-foot-r"><ellipse cx="74" cy="109" rx="10.5" ry="6" fill="${f}" stroke="${d.k}" stroke-width="1.4"/></g>`);
        }
        if (!d.noBody) {
            parts.push(`<ellipse cx="60" cy="90" rx="21" ry="18" fill="${d.c}" stroke="${d.k}" stroke-width="1.6"/>`);
            if (d.belly) parts.push(`<ellipse cx="60" cy="92" rx="14" ry="13" fill="${d.belly}"/>`);
        }
        if (!d.noArms) {
            const f = d.arm || (d.noBody ? d.k : d.c);
            const ay = d.noBody ? 74 : 88;
            const lc = d.wave === 'l' || d.wave === 'both' ? 'stk-wave-l' : '';
            const rc = d.wave === 'r' || d.wave === 'both' ? 'stk-wave-r' : '';
            parts.push(arm('l', f, lc, ay, d.k) + arm('r', f, rc, ay, d.k));
        }
        parts.push(d.head || `<circle cx="60" cy="52" r="34" fill="${d.c}" stroke="${d.k}" stroke-width="1.8"/>`);
        parts.push(d.under || '');
        const y = 52;
        const face = [
            cheeks(y + 12),
            d.eyes === 'none' ? '' : (d.alt ? `<g class="stk-ex-a">${eyes[d.eyes](y)}</g><g class="stk-ex-b">${eyes[d.alt](y)}</g>` : eyes[d.eyes](y)),
            d.nose || '',
            d.mouth2 ? `<g class="stk-ex-a">${(mouths[d.mouth] || mouths.none)(y + 12)}</g><g class="stk-ex-b">${mouths[d.mouth2](y + 12)}</g>` : (mouths[d.mouth] || mouths.none)(y + 12)
        ].join('');
        parts.push(`<g transform="translate(0 ${fy})">${face}</g>`);
        parts.push(d.front || '');
        return `<svg class="stk-svg stk-body-${d.body || 'none'}" viewBox="0 0 120 124" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g class="stk-root">${parts.join('')}</g></svg>`;
    }

    window.plusStickerSvg = plusStickerSvg;
    window.PLUS_STICKER_IDS = Object.keys(D);
})();
