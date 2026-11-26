# Social Studio

Web app per gestire Instagram, Facebook e TikTok della propria attività, con Claude integrato per creare i contenuti.

## Cosa fa (prima versione)

- **Panoramica**: contenuti dei prossimi 7 giorni, numero di bozze e post programmati, idee di contenuti consigliati dall'AI.
- **Calendario**: vista mensile dei contenuti; clicca un giorno per aggiungerne uno, un contenuto per modificarlo.
- **Crea con AI**: da un'idea, Claude scrive il testo per ogni social, gli hashtag, l'idea per la foto e, per reel e TikTok, il copione del video. Suggerisce anche quando pubblicare.
- **Piano del mese**: Claude prepara il calendario editoriale del mese (stagione, ricorrenze, obiettivi); scegli cosa tenere e lo aggiungi al calendario. Dal contenuto puoi poi far scrivere i testi con "Scrivi con AI".
- **Orari migliori**: giorni e fasce orarie consigliate per ogni social.
- **Foto e video**: in ogni contenuto puoi caricare le tue foto e i tuoi video, oppure creare un'immagine con l'AI partendo dall'idea suggerita da Claude (formati quadrato, verticale e storia 9:16).
- **Video**: unisci più clip, tagliale, scegli il formato (9:16 per Reel e TikTok, 4:5, 1:1, 16:9) con sfondo sfocato o riempimento, togli l'audio e aggiungi un testo in sovrimpressione, anche suggerito dall'AI. Il video finito si scarica o diventa un contenuto del calendario. Usa ffmpeg, installato con le dipendenze.
- **La mia attività**: profilo, prodotti, clienti e tono di voce che l'AI usa in ogni richiesta.

## Avvio in locale

Serve Node.js 22 o successivo.

```bash
npm install
cp .env.example .env.local   # poi inserisci la tua ANTHROPIC_API_KEY
npm run dev
```

Apri http://localhost:3000.

In locale i dati sono salvati in un database Postgres integrato in `data/pglite`, foto e video in `data/media/` (non inclusi nel repository). Online si usano Supabase per database e file (vedi sotto).

Per creare immagini con l'AI serve anche una chiave di OpenAI **oppure** di Google Gemini (vedi `.env.example`): Claude scrive i testi e descrive l'immagine, il servizio di immagini la disegna.

## Pubblicare l'app online gratis (Render + Supabase)

- **Supabase** (gratuito) conserva database, foto e video.
- **Render** (gratuito) fa girare l'app. Sul piano gratuito l'app si sospende dopo 15 minuti senza visite e la prima apertura successiva richiede circa un minuto.

1. **Supabase**: crea un progetto su [supabase.com](https://supabase.com) (regione Europa) e annota la password del database. Poi:
   - in **Connect › Session pooler** copia l'indirizzo che inizia con `postgresql://` e sostituisci `[YOUR-PASSWORD]` con la password: è `DATABASE_URL`;
   - in **Project Settings › API** copia il **Project URL** (`SUPABASE_URL`) e la chiave **secret** o **service_role** (`SUPABASE_SERVICE_ROLE_KEY`).
2. **Render**: su [render.com](https://render.com) accedi con GitHub, scegli **New › Blueprint** e questo repository. Render legge `render.yaml` e chiede i valori:
   `ANTHROPIC_API_KEY`, `APP_PASSWORD` (la password per entrare nell'app), `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e, se vuoi le immagini AI, `OPENAI_API_KEY` o `GEMINI_API_KEY` (gli altri si possono lasciare vuoti).
3. Al termine Render mostra il link dell'app (`https://social-studio-….onrender.com`).

Ogni modifica unita al ramo `main` viene pubblicata in automatico. Sul piano gratuito di Supabase ogni file può pesare al massimo 50 MB.

## Collegare Facebook, Instagram e TikTok

L'app pubblica da sola i contenuti con stato **Programmato** all'ora indicata, oppure subito con **Pubblica ora** nell'editor. Gli account si collegano dalla pagina **Account social**.

1. **Meta (Facebook e Instagram)**: su [developers.facebook.com](https://developers.facebook.com) crea un'app di tipo **Business**, aggiungi il prodotto **Facebook Login for Business** e come URL di reindirizzamento valido `https://<indirizzo-app>/api/auth/meta/callback`. Servono una Pagina Facebook e un account Instagram professionale collegato alla Pagina. Copia **App ID** e **App secret** in `META_APP_ID` e `META_APP_SECRET`. Finché l'app è in modalità sviluppo funziona per gli amministratori dell'app, cioè per te.
2. **TikTok**: su [developers.tiktok.com](https://developers.tiktok.com) crea un'app, aggiungi **Login Kit** e **Content Posting API** (con Direct Post), redirect URI `https://<indirizzo-app>/api/auth/tiktok/callback`. Copia **Client key** e **Client secret** in `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET`. Finché TikTok non approva l'app, i video vengono pubblicati come privati.
3. **Pubblicazione programmata su Render gratuito**: l'app si sospende quando nessuno la usa, quindi serve un servizio che la svegli. Imposta `CRON_SECRET` (una parola a caso) e su [cron-job.org](https://cron-job.org) crea un job gratuito ogni 5 minuti verso `https://<indirizzo-app>/api/cron?secret=<CRON_SECRET>`.

## Struttura

- `src/app/` pagine e API (`src/app/api/...`)
- `src/lib/ai.ts` tutte le chiamate a Claude (modello `claude-opus-5-5`, output strutturato)
- `src/lib/images.ts` generazione immagini (OpenAI o Google Gemini)
- `src/lib/video.ts` montaggio video con ffmpeg
- `src/lib/media.ts` archivio di foto e video
- `src/lib/social/` collegamento account e pubblicazione su Facebook, Instagram e TikTok
- `src/lib/db.ts` e `src/lib/sql.ts` database (Postgres: Supabase online, PGlite in locale)
- `src/components/` componenti condivisi (editor dei contenuti, interfaccia)

## Prossime fasi

1. Report su visualizzazioni, follower e analisi della nicchia dai dati reali; orari migliori calcolati sui propri post.
2. Sottotitoli automatici dei video (serve un servizio di trascrizione).
