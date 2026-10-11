# 0026 — Misure per il tocco e orientamento libero della PWA

**Quando leggerlo**: prima di cambiare dimensioni di campi e pulsanti su telefono e tablet, o l'orientamento della PWA.

**Stato**: attiva. Integra [0009](0009-rifinitura-mobile-fase-8.md) e [0013](0013-pwa-manifest-only.md).

## Contesto

L'[audit UI/UX di ottobre 2026](../audit/2026-10-ux-e-usabilita/PCOACH_UX_AUDIT.md) ha misurato a 320-768 px:
- **U-15**: tutti i campi a 14px. Sotto i 16px Safari su iOS ingrandisce la pagina al tocco di un campo. È un comportamento noto della piattaforma, non verificato su un iPhone.
- **U-22**: la maggior parte dei controlli era alta 32-36px, sopra il minimo WCAG 2.2 AA di 24px ma sotto i 44px consigliati per il tocco; alcuni chip e link-pulsante erano sotto i 24px.
- **U-23**: su mobile la barra del Piano impilava tre pulsanti a tutta larghezza prima della settimana.
- **U-20**: la PWA installata era bloccata in verticale (`orientation: 'portrait'`).

## Decisione

1. Con un puntatore impreciso (`@media (pointer: coarse)`):
   - i campi hanno il testo a 16px;
   - pulsanti, campi, tab, chip, voci dell'elenco atleti, pulsanti-icona, caselle con etichetta e «Aggiungi…» sono alti almeno 44px.

   Con mouse e trackpad le misure restano compatte.
2. Sotto i 480px «Prosegui il piano» e «Ripianifica da…» stanno affiancati, e «Sincronizza settimana» va sulla riga sotto.
3. Il manifest non dichiara più un orientamento: l'app ruota (decisione del coach D-UX-6). Il layout orizzontale è stato verificato a 740×360.

## Motivo

- Le misure da tocco servono dove si tocca: legarle alla larghezza dello schermo penalizzerebbe una finestra stretta su desktop e lascerebbe piccoli i controlli di un tablet.
- 16px è la soglia oltre la quale iOS non ingrandisce: si evita lo zoom senza disattivarlo per chi ne ha bisogno (nessun `maximum-scale`).

## Alternative scartate

- **Disattivare lo zoom** con `maximum-scale=1`: impedirebbe anche lo zoom voluto dall'utente, contro le WCAG.
- **Misure da 44px ovunque**: raddoppierebbe la densità verticale su desktop senza beneficio.
