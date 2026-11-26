# Social Studio

Web app per gestire Instagram, Facebook e TikTok della propria attività, con Claude integrato per creare i contenuti.

## Cosa fa (prima versione)

- **Panoramica**: contenuti dei prossimi 7 giorni, numero di bozze e post programmati, idee di contenuti consigliati dall'AI.
- **Calendario**: vista mensile dei contenuti; clicca un giorno per aggiungerne uno, un contenuto per modificarlo.
- **Crea con AI**: da un'idea, Claude scrive il testo per ogni social, gli hashtag, l'idea per la foto e, per reel e TikTok, il copione del video. Suggerisce anche quando pubblicare.
- **Piano del mese**: Claude prepara il calendario editoriale del mese (stagione, ricorrenze, obiettivi); scegli cosa tenere e lo aggiungi al calendario. Dal contenuto puoi poi far scrivere i testi con "Scrivi con AI".
- **Orari migliori**: giorni e fasce orarie consigliate per ogni social.
- **Foto e video**: in ogni contenuto puoi caricare le tue foto e i tuoi video, oppure creare un'immagine con l'AI partendo dall'idea suggerita da Claude (formati quadrato, verticale e storia 9:16).
- **La mia attività**: profilo, prodotti, clienti e tono di voce che l'AI usa in ogni richiesta.

## Avvio in locale

Serve Node.js 22.13 o successivo.

```bash
npm install
cp .env.example .env.local   # poi inserisci la tua ANTHROPIC_API_KEY
npm run dev
```

Apri http://localhost:3000.

I dati sono salvati in un database SQLite in `data/app.db`, foto e video in `data/media/` (non inclusi nel repository).

Per creare immagini con l'AI serve anche una chiave di OpenAI **oppure** di Google Gemini (vedi `.env.example`): Claude scrive i testi e descrive l'immagine, il servizio di immagini la disegna.

## Struttura

- `src/app/` pagine e API (`src/app/api/...`)
- `src/lib/ai.ts` tutte le chiamate a Claude (modello `claude-opus-5-5`, output strutturato)
- `src/lib/images.ts` generazione immagini (OpenAI o Google Gemini)
- `src/lib/media.ts` archivio di foto e video
- `src/lib/db.ts` database
- `src/components/` componenti condivisi (editor dei contenuti, interfaccia)

## Prossime fasi

1. Collegamento account Instagram e Facebook (Meta Graph API) e TikTok (Content Posting API) con pubblicazione automatica.
2. Report su visualizzazioni, follower e analisi della nicchia dai dati reali; orari migliori calcolati sui propri post.
3. Editing video (tagli, sottotitoli, formati verticali).
4. Database online (es. Supabase/Postgres) e accesso con password per usare l'app da qualsiasi dispositivo.
