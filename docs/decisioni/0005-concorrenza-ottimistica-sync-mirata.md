# 0005 — Concorrenza ottimistica e sincronizzazione mirata

**Quando leggerlo**: per capire perché il salvataggio della scheda è condizionato a `updated_at`, e perché la sincronizzazione Intervals.icu non segue le stesse regole di "modifiche non salvate" del resto del form.

**Stato**: attiva.

## Contesto

Fase 3 (2026-10-03): con un unico blob `jsonb` per scheda atleta, un salvataggio concorrente (due schermi aperti sulla stessa scheda, o sync in background mentre il coach sta modificando) rischiava di sovrascrivere silenziosamente dati validi.

## Decisione

- Ogni update a `athletes` è condizionato al valore di `updated_at` noto al momento dell'apertura/ultimo salvataggio (controllo di concorrenza ottimistico): se la condizione non trova righe, l'update non scrive nulla e il coach viene avvisato.
- `syncLoadMetrics` (scrittura mirata del solo `load_metrics_log`, usata dalla sincronizzazione Intervals.icu) è esclusa dal tracciamento delle "modifiche non salvate" del form: aggiorna `athletes` e lo stato in memoria senza marcare la scheda come sporca, perché non è una modifica dell'utente.
- Il rilevamento di "la scheda è stata aggiornata altrove" riusa il meccanismo di polling già esistente, invece di introdurre un canale realtime dedicato.

## Motivo

Un update condizionato su `updated_at` è il modo più semplice per evitare sovrascritture silenziose senza introdurre locking pessimistico. Escludere `syncLoadMetrics` dal "dirty state" evita falsi positivi ("hai modifiche non salvate") per un'operazione che il coach non ha avviato esplicitamente nel form.

## Alternativa scartata

Realtime (Supabase Realtime) per notificare immediatamente le altre sessioni di un cambiamento: scartata come eccessiva per un'app mono-coach dove le aperture concorrenti della stessa scheda sono rare; il polling esistente è stato giudicato sufficiente.
