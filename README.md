# 🦆🍻 Il Nobile Gioco dell'Oca 3D — Drinking Tavern & Admin Edition

Un'esperienza web 3D interattiva creata con **Three.js**, grafica in stile **legno intagliato da taverna medievale** (ispirata alla reference grafica del tabellone artigianale con castello fantasy, ponte in pietra e villaggio centrale), integrata con **meccaniche drinking game**, **domande scomode** e una **Regia Host segreta (Admin God Mode)**.

---

## 🌟 Caratteristiche Principali

### 1. 🎲 Tabellone 3D & Grafica Artigianale da Taverna
- **Percorso a Spirale 1..63**: Fedele alla tradizione con rimbalzo esatto alla casella 63.
- **Scenografia 3D Procedurale**:
  - 🏰 **Castello Fantasy Finale** (casella 63) con torri in pietra e tetti conici viola.
  - 🌉 **Ponte in Pietra** (casella 6) con avanzamento immediato alla 12.
  - 🏡 **Villaggio Medievale Centrale** con case coniche e pini intagliati.
  - 🪣 **Pozzo delle 4:00 AM** (casella 31) con trappola finché un altro giocatore non subentra.
  - ⛓️ **Prigione della Ronda** (casella 52) con cauzione di shot.
  - 💀 **Scheletro del Resacone** (casella 58) che rispedisce alla casella 1.
- **4 Oche Intagliate**: Miniature 3D colorate (Rosso ciliegia, Giallo miele, Verde bosco, Blu oltremare) con rotazione e animazione a balzi su curve paraboliche.

### 2. 🍻 Modalità "Ubriaconi" & Domande Scomode
- **Contatori Live in HUD**: Tracciamento in tempo reale di birre (`🍺 sorsi`) e cicchetti (`🥃 shot`) consumati da ogni oca.
- **25+ Domande Scomode & Verità a Bruciapelo**:
  - Domande imbarazzanti e taglienti ("Chi tra i presenti ha la cronologia più censurabile?", "Qual è la bugia più grande che hai detto a qualcuno qui dentro?").
  - Tasto **"Altra Domanda"** per ri-estrarre o pagare la penitenza bevendo.
- **Pulsanti Caos Rapido**:
  - 🌊 **Cascata Generale**: Tutti bevono insieme a catena.
  - 🥃 **Round di Shot**: Brindisi obbligatorio per tutta la taverna.
  - 💣 **Domanda Flash**: Spara una domanda a tradimento al giocatore di turno.

### 3. 👑 Meccanica Admin & Regia Host (God Mode)
Progettata per garantire la massima semplicità durante le feste:
- **Flusso Giocatore a 2 Step**:
  1. L'amico inserisce solo il proprio nome ("Marco", "Giulia") e preme *Salva Nome*.
  2. Rimane in attesa del codice stanza a sole **4 cifre numeriche** (es. `4821`), facilissimo da digitare da smartphone anche da brilli.
- **Accesso Segreto Host**:
  - In fondo alla lobby, cliccando su *"👑 Sei l'Host della Serata? Accedi come Admin con Password"*.
  - Master Password predefinita: `oca123` (configurabile da variabile d'ambiente).
  - Crea la stanza e genera automaticamente un **QR Code ad alta risoluzione** a tema pergamena/legno scuro con il PIN a 4 cifre in grande.
  - Gli amici inquadrano il QR con la fotocamera ed entrano all'istante senza digitare nulla.
- **Barra Regia Fluttuante (God Mode Bar)**:
  - Posizionata in basso, rifinita in legno noce, ottone brunito e sigillo dorato.
  - **🌊 Cascata**: Fa scattare la cascata generale su tutti i telefoni connessi.
  - **🥃 Round Shot**: Forza uno shot collettivo.
  - **💣 Domanda**: Lancia una domanda scomoda a bruciapelo.
  - **♟️ Sposta Oca**: Apre il selettore di teletrasporto per fiondare qualsiasi amico sulle caselle peggiori (Scheletro, Pozzo, Prigione, o vittoria).
  - **🔄 Reset**: Azzera la partita e rispedisce tutti alla partenza.
  - **📱 QR Stanza**: Mostra il codice a chi si unisce in ritardo.

---

## 🚀 Come Giocare Subito

### Modalità A: Locale / Hotseat (Nessuna installazione richiesta)
1. Fai doppio clic sul file [index.html](file:///c:/Users/lucad/Desktop/Gioc%20oc/index.html) con qualsiasi browser (Chrome, Safari, Edge, Firefox).
2. Tutto funziona immediatamente a schermo intero: dadi 3D, pedine, audio, sfide e pannello Admin (password locale: `oca123`).

### Modalità B: Server Multiplayer Online (Render / VPS / Node.js)
1. Avvia il server:
   ```bash
   npm install
   npm start
   ```
2. Apri `http://localhost:3000` o l'URL fornito da Render.
3. L'Host crea la stanza con la password Admin e mostra il QR Code.
4. Tutti gli amici si connettono dal proprio smartphone!
