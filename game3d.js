/**
 * ============================================================================
 * IL NOBILE GIOCO DELL'OCA 3D — ENGINE THREE.JS & GAME LOGIC
 * ============================================================================
 * Sviluppato ispirandosi all'estetica del tabellone in legno intagliato:
 * - Percorso a spirale classica da 1 a 63 caselle
 * - Elementi scenografici 3D procedurali: Castello medievale, Ponte, Villaggio, Pozzo, Prigione
 * - Miniature delle Oche intagliate in legno (Rosso, Giallo, Verde, Blu)
 * - Lancio dei Dadi 3D fisici sul tavolo da taverna
 * - Regole storiche integrali con rimbalzo a 63, salti dell'Oca, trappole e vittoria esatta.
 */

// --- VARIABILI GLOBALI THREE.JS ---
let scene, camera, renderer, controls;
let boardGroup, scenicsGroup, tilesGroup, pawnsGroup, diceGroup;
let isMovingPawn = false;
let isRollingDice = false;

// Tracciato delle 64 posizioni 3D (Casella 0 = Molo Partenza, 1..63)
const TILE_DATA = [];
const TILE_MESHES = [];
const PAWN_MESHES = [];

// --- STATO DEL GIOCO (GIOCATORI DINAMICI, MAX 12) ---
// Popolato dal server via Socket.io; in modalità offline/hotseat viene inizializzato con 4 giocatori default.
const PLAYERS = [];

// Palette colori per fino a 12 giocatori (coerente con lo stile esistente)
const DEFAULT_PLAYER_COLORS = [
  { name: "Oca Rossa", hex: "#d13030", color: 0xd13030, cssClass: "red" },
  { name: "Oca Gialla", hex: "#f2b705", color: 0xf2b705, cssClass: "yellow" },
  { name: "Oca Verde", hex: "#388a44", color: 0x388a44, cssClass: "green" },
  { name: "Oca Blu", hex: "#2374ab", color: 0x2374ab, cssClass: "blue" },
  { name: "Oca Viola", hex: "#8e44ad", color: 0x8e44ad, cssClass: "purple" },
  { name: "Oca Arancione", hex: "#e67e22", color: 0xe67e22, cssClass: "orange" },
  { name: "Oca Rosa", hex: "#e84393", color: 0xe84393, cssClass: "pink" },
  { name: "Oca Ciano", hex: "#00b894", color: 0x00b894, cssClass: "cyan" },
  { name: "Oca Indaco", hex: "#6c5ce7", color: 0x6c5ce7, cssClass: "indigo" },
  { name: "Oca Grigio", hex: "#b2bec3", color: 0xb2bec3, cssClass: "gray" },
  { name: "Oca Marrone", hex: "#6d4c41", color: 0x6d4c41, cssClass: "brown" },
  { name: "Oca Lime", hex: "#d4e157", color: 0xd4e157, cssClass: "lime" }
];

// Restituisce la configurazione colore per un indice giocatore (ciclica sulla palette)
function getPlayerColor(idx) {
  return DEFAULT_PLAYER_COLORS[idx % DEFAULT_PLAYER_COLORS.length];
}

let currentPlayerIdx = 0;
let soundEnabled = true;

// --- STATO MULTIPLAYER & REGIA HOST (ADMIN) ---
let socket = null;
let currentRoomId = null;
let isAdmin = false;
let adminToken = null;
let localPlayerName = localStorage.getItem('oca_player_name') || '';

// Caselle speciali dell'Oca Classica
const GOOSE_TILES = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];

// --- AUDIO SYNTHESIZER (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!soundEnabled || !audioCtx) return;
  const now = audioCtx.currentTime;

  if (type === 'dice') {
    // Clack di dadi di legno che rimbalzano
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220 + Math.random() * 260, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      }, i * 90);
    }
  } else if (type === 'hop') {
    // Schiocco sordo di pedina in legno sul piano
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + 0.12);
  } else if (type === 'fanfare') {
    // Squillo di tromba medievale per la vittoria
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }, idx * 110);
    });
  } else if (type === 'gulp') {
    // Gorgoglio / Versamento del drink
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320 - i * 40, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }, i * 110);
    }
  } else if (type === 'chicken') {
    // Verso del pollo per chi rifiuta la penitenza
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    osc.frequency.setValueAtTime(350, now + 0.2);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + 0.35);
  }
}

// ============================================================================
// CATALOGO DELLE 64 SFIDE ALCOLICHE (PARTY & DRINKING GAME EDITION)
// ============================================================================
const DRINKING_CHALLENGES = {
  0: { cat: "rule", icon: "🚀", title: "Molo di Partenza", desc: "Brindisi inaugurale! Tutti i presenti fanno 1 sorso di benvenuto per salpare verso il Castello!", sips: 1, shots: 0 },
  1: { cat: "drink", icon: "🍺", title: "Riscaldamento", desc: "Bevi 1 sorso di birra o drink per scaldare i motori della serata.", sips: 1, shots: 0 },
  2: { cat: "drink", icon: "🍻", title: "Bevi & Assegna", desc: "Bevi 1 sorso e assegna 1 sorso a un avversario a tua scelta!", sips: 1, shots: 0 },
  3: { cat: "truth", icon: "🤫", title: "Verità Imbarazzante", desc: "Qual è la figura peggiore che hai fatto con una persona che ti piaceva? Racconta o bevi 2 sorsi!", sips: 2, shots: 0 },
  4: { cat: "drink", icon: "🎯", title: "Distribuisci Sorsi", desc: "Assegna 2 sorsi da bere a chi vuoi tu al tavolo (anche divisi tra due amici)!", sips: 0, shots: 0 },
  5: { cat: "goose", icon: "🪿", title: "L'Oca Generosa", desc: "Di Oca in Oca si vola! Avanza del valore del dado e fai fare 1 sorso al compagno alla tua destra!", sips: 0, shots: 0 },
  6: { cat: "bridge", icon: "🌉", title: "Il Ponte delle Feste", desc: "Attraversi il fiume verso la Casella 12! Bevi 1 sorso per festeggiare il passaggio rapido.", sips: 1, shots: 0 },
  7: { cat: "rule", icon: "🙋‍♂️", title: "Non Ho Mai...", desc: "Dì ad alta voce un 'Non ho mai...'. Chiunque al tavolo lo abbia fatto nella vita deve bere 1 sorso!", sips: 1, shots: 0 },
  8: { cat: "shot", icon: "🥃", title: "SHOT DI FUOCO", desc: "BOOM! Bevi uno shot liscio di Vodka, Tequila o Amaro. Se rifiuti, devi bere 4 sorsi generosi!", sips: 0, shots: 1 },
  9: { cat: "goose", icon: "🪿", title: "L'Oca Volante", desc: "Di Oca in Oca si vola! Vola avanti di quanto hai tirato e fai fare un brindisi al tavolo!", sips: 0, shots: 0 },
  10: { cat: "dare", icon: "📱", title: "Controllo Galleria", desc: "Mostra l'ultima foto salvata nella tua galleria al compagno alla tua sinistra, oppure bevi 2 sorsi!", sips: 2, shots: 0 },
  11: { cat: "dare", icon: "📸", title: "Screenshot Pericoloso", desc: "Mostra al gruppo l'ultimo screenshot salvato sul tuo telefono, oppure bevi 2 sorsi!", sips: 2, shots: 0 },
  12: { cat: "rule", icon: "👑", title: "La Regola del Re", desc: "Crea una nuova legge valida fino a fine partita (es. vietato usare nomi propri, vietato toccarsi i capelli). Chi sgarra beve!", sips: 0, shots: 0 },
  13: { cat: "truth", icon: "🔥", title: "Verità Scottante", desc: "Con chi dei presenti andresti a letto o usciresti a cena? Se taci, scola 3 sorsi di fila!", sips: 3, shots: 0 },
  14: { cat: "goose", icon: "🪿", title: "L'Oca Corridrice", desc: "Di Oca in Oca si vola! Avanza del valore del dado e distribuisci 2 sorsi!", sips: 0, shots: 0 },
  15: { cat: "rule", icon: "⚡", title: "Category Rush", desc: "Scegli una categoria (es. Marchi di birra, Marchette, Scuse per non uscire). A giro veloce: chi esita o ripete beve 2 sorsi!", sips: 2, shots: 0 },
  16: { cat: "drink", icon: "🔋", title: "Batteria del Telefono", desc: "Controllate le percentuali di batteria: chi ha la più bassa beve 2 sorsi, la più alta ne assegna 2!", sips: 2, shots: 0 },
  17: { cat: "rule", icon: "🥂", title: "Gemello di Sbronza", desc: "Scegli un compagno di bevute: da adesso ogni volta che uno di voi due beve, beve anche l'altro per i prossimi 2 giri!", sips: 0, shots: 0 },
  18: { cat: "goose", icon: "🪿", title: "L'Oca Spritz", desc: "Di Oca in Oca si vola! Vola avanti di quanto hai tirato e fai bere 1 sorso a chi ha il bicchiere più pieno!", sips: 0, shots: 0 },
  19: { cat: "inn", icon: "🍻", title: "LA LOCANDA DEI SBRONZI", desc: "Ti sei fermato al bancone! Bevi mezzo bicchiere del tuo drink ORA per liberarti subito, oppure salti 2 turni da sobrio!", sips: 3, shots: 0 },
  20: { cat: "shot", icon: "🍸", title: "METÀ STRADA: SHOT TIME!", desc: "Siamo a un terzo di percorso! Tu e il giocatore alla tua destra fate uno shot insieme!", sips: 0, shots: 1 },
  21: { cat: "dare", icon: "🎵", title: "Playlist Roulette", desc: "Metti Spotify in casuale e canta a squarciagola il ritornello della prima traccia, o bevi 2 sorsi!", sips: 2, shots: 0 },
  22: { cat: "truth", icon: "🤫", title: "Gossip Segreto", desc: "Confessa l'aneddoto più borderline che non hai mai raccontato a tua madre, o bevi 3 sorsi!", sips: 3, shots: 0 },
  23: { cat: "goose", icon: "🪿", title: "L'Oca Veloce", desc: "Di Oca in Oca si vola! Avanza del valore del dado e assegna 2 sorsi a piacere!", sips: 0, shots: 0 },
  24: { cat: "waterfall", icon: "🌊", title: "CASCATA / WATERFALL!", desc: "TUTTI INIZIANO A BERE CONTEMPORANEAMENTE! Nessuno può posare il bicchiere finché non smette chi ha tirato il dado!", sips: 2, shots: 0 },
  25: { cat: "drink", icon: "🔄", title: "Scambio di Bicchiere", desc: "Fai un sorso dal bicchiere del giocatore alla tua sinistra (se rifiuta, ne beve 2 dal suo)!", sips: 1, shots: 0 },
  26: { cat: "dare", icon: "🎙️", title: "Vocale Imbarazzante", desc: "Manda un vocale di 3 secondi dicendo 'Non ritrovo la mia scimmia' a un amico, o bevi 3 sorsi!", sips: 3, shots: 0 },
  27: { cat: "goose", icon: "🪿", title: "L'Oca d'Assalto", desc: "Di Oca in Oca si vola! Vola avanti e brinda alla salute dell'Oca!", sips: 0, shots: 0 },
  28: { cat: "rule", icon: "💪", title: "Sfida Braccio di Ferro", desc: "Sfida chi vuoi a braccio di ferro (o sasso-carta-forbice al meglio dei 3). Chi perde beve 2 sorsi!", sips: 2, shots: 0 },
  29: { cat: "drink", icon: "🍺", title: "Brindisi Incrociato", desc: "Bevi un sorso a braccia incrociate con il giocatore di fronte a te!", sips: 1, shots: 0 },
  30: { cat: "shot", icon: "💀", title: "DOPPIO SHOT ASSASSINO", desc: "Casella brutale! Fatti uno shot pieno o 3 sorsi generosi senza fare smorfie!", sips: 3, shots: 1 },
  31: { cat: "well", icon: "🕳️", title: "IL POZZO DELLE 4:00 AM", desc: "Caduto nel pozzo dei ricordi! Fatti 1 SHOT per arrampicarti subito fuori, altrimenti resti bloccato finché un altro non vi cade!", sips: 0, shots: 1 },
  32: { cat: "goose", icon: "🪿", title: "L'Oca d'Oro", desc: "Di Oca in Oca si vola! Avanza e fai fare 2 sorsi al primo giocatore in classifica!", sips: 0, shots: 0 },
  33: { cat: "truth", icon: "🔍", title: "Ultime Ricerche Google", desc: "Leggi ad alta voce le ultime 3 cose cercate su Google dal tuo telefono, o bevi 3 sorsi!", sips: 3, shots: 0 },
  34: { cat: "rule", icon: "📵", title: "Telefono Bandito", desc: "Chiunque tocchi il telefono nei prossimi 10 minuti deve bere 1 sorso ogni volta che viene beccato!", sips: 0, shots: 0 },
  35: { cat: "dare", icon: "💋", title: "Sguardo di Fuoco", desc: "Fissa negli occhi chi hai di fronte per 15 secondi senza ridere. Chi ride per primo beve 2 sorsi!", sips: 2, shots: 0 },
  36: { cat: "goose", icon: "🪿", title: "L'Oca che Vola Alto", desc: "Di Oca in Oca si vola! Avanza del valore del dado e tira ancora!", sips: 0, shots: 0 },
  37: { cat: "truth", icon: "💣", title: "Interrogatorio di Gruppo", desc: "Tutto il tavolo concorda all'unanimità una singola domanda a cui DEVI rispondere sinceramente, o finisci il bicchiere!", sips: 4, shots: 0 },
  38: { cat: "drink", icon: "🎯", title: "Bevi con i Vicini", desc: "Tu, il giocatore alla tua destra e quello alla tua sinistra bevete 1 sorso ciascuno!", sips: 1, shots: 0 },
  39: { cat: "dare", icon: "🏋️", title: "Flessioni o Sorsi", desc: "Fai 8 flessioni sul pavimento della stanza o bevi 2 sorsi!", sips: 2, shots: 0 },
  40: { cat: "rule", icon: "🥂", title: "Gemello del Destino", desc: "Scegli un nuovo compagno: per i prossimi 3 giri quando beve lui bevi anche tu!", sips: 0, shots: 0 },
  41: { cat: "goose", icon: "🪿", title: "L'Oca d'Avanguardia", desc: "Di Oca in Oca si vola! Avanza e assegna 2 sorsi a piacere!", sips: 0, shots: 0 },
  42: { cat: "maze", icon: "🌀", title: "IL LABIRINTO DELLO SMARRIMENTO", desc: "Ti sei perso nei vicoli tornando a casa! Torni indietro alla Casella 30 e bevi 2 sorsi di disorientamento!", sips: 2, shots: 0 },
  43: { cat: "drink", icon: "🍺", title: "Sorseggio Tattico", desc: "Bevi 1 sorso e decidi chi al tavolo deve bere il prossimo turno.", sips: 1, shots: 0 },
  44: { cat: "truth", icon: "🤫", title: "Verità senza Pietà", desc: "Qual è la persona più insopportabile che conosci tra i tuoi conoscenti? Rispondi o bevi 2 sorsi!", sips: 2, shots: 0 },
  45: { cat: "goose", icon: "🪿", title: "L'Oca Intrepida", desc: "Di Oca in Oca si vola! Vola avanti di quanto hai fatto e ritira!", sips: 0, shots: 0 },
  46: { cat: "dare", icon: "🎭", title: "Imitazione da Bar", desc: "Fai l'imitazione di un personaggio famoso o di un amico presente. Se nessuno indovina in 20 secondi, bevi 2 sorsi!", sips: 2, shots: 0 },
  47: { cat: "rule", icon: "🙋‍♂️", title: "Non Ho Mai Piccante", desc: "Lancia un 'Non ho mai...' a tema uscite/relazioni. Chi l'ha fatto beve 2 sorsi!", sips: 2, shots: 0 },
  48: { cat: "drink", icon: "🥃", title: "Giro di Goccia", desc: "Bevi 2 sorsi o offri uno shot a chi sta perdendo.", sips: 2, shots: 0 },
  49: { cat: "drink", icon: "⚡", title: "Riflessi Pronti", desc: "Urla 'GIÙ!'. L'ultimo al tavolo a toccare il pavimento o il tavolo con la mano beve 2 sorsi!", sips: 2, shots: 0 },
  50: { cat: "goose", icon: "🪿", title: "L'Oca della Vittoria", desc: "Di Oca in Oca si vola! La spirale stringe: avanza e ritira!", sips: 0, shots: 0 },
  51: { cat: "dare", icon: "📱", title: "Storia Instagram", desc: "Fai una storia con una smorfia senza spiegazioni, oppure bevi 3 sorsi!", sips: 3, shots: 0 },
  52: { cat: "prison", icon: "🔒", title: "LA PRIGIONE DEI RETRO-PENSIERI", desc: "Sei rinchiuso in cella! Un amico può sacrificarsi bevendo 2 sorsi per farti uscire su cauzione, altrimenti salti 2 turni!", sips: 2, shots: 0 },
  53: { cat: "drink", icon: "🍻", title: "Bevi alla Salute", desc: "Fai fare un brindisi a due compagni a scelta: bevono 1 sorso ciascuno!", sips: 0, shots: 0 },
  54: { cat: "goose", icon: "🪿", title: "L'Oca Penultima", desc: "Di Oca in Oca si vola! Avanza del valore del dado e ritira!", sips: 0, shots: 0 },
  55: { cat: "shot", icon: "💀", title: "SHOT DEL GIUDIZIO", desc: "Sei a un passo dal Castello: bevi 1 SHOT o 3 sorsi prima di affrontare le caselle finali!", sips: 3, shots: 1 },
  56: { cat: "truth", icon: "🔥", title: "Gossip Finale", desc: "Confessa un segreto sul tuo conto che nessuno al tavolo conosce, o scola 3 sorsi!", sips: 3, shots: 0 },
  57: { cat: "drink", icon: "🎯", title: "Punteggio di Rigore", desc: "Bevi 2 sorsi. Se fai 6 al prossimo turno, assegni 4 sorsi a chi vuoi!", sips: 2, shots: 0 },
  58: { cat: "death", icon: "☠️", title: "LO SCHELETRO (RESACONE 6:00 AM)", desc: "IL RESACONE DELLE 6:00! Sei crollato prima dell'alba: torni strisciando alla PARTENZA (#1) e bevi 2 sorsi di disperazione!", sips: 2, shots: 0 },
  59: { cat: "goose", icon: "🪿", title: "L'ULTIMA OCA", desc: "L'ULTIMA OCA DELLA SPIRALE! Avanza ed occhio a non rimbalzare oltre il traguardo!", sips: 0, shots: 0 },
  60: { cat: "truth", icon: "💣", title: "DOMANDA SCOMODA", desc: "Il tavolo ti fa una domanda secca. Rispondi senza esitare o finisci il tuo drink!", sips: 3, shots: 0 },
  61: { cat: "drink", icon: "🍺", title: "Penultimo Sorseggio", desc: "Bevi 1 sorso per preparare la mira finale.", sips: 1, shots: 0 },
  62: { cat: "dare", icon: "🔥", title: "L'ULTIMO OSTACOLO", desc: "Fai 5 piegamenti o bevi 2 sorsi. Ti serve il numero esatto per entrare nel Castello!", sips: 2, shots: 0 },
  63: { cat: "castle", icon: "👑", title: "TRAGUARDO SOVRANO: RE DELLA SERATA", desc: "VITTORIA SUPREMA! Sei il Re Indiscusso della serata! TUTTI GLI ALTRI FINISCONO IL PROPRIO BICCHIERE ALLA TUA SALUTE!", sips: 0, shots: 0 }
};

// ============================================================================
// POOL DI DOMANDE SCOMODE (VERITÀ PICCANTI & GOSSIP SENZA FILTRI)
// ============================================================================
const DOMANDE_SCOMODE = [
  "Qual è la persona presente con cui andresti a letto se fossi costretto a scegliere?",
  "Hai mai fatto pensieri intimi su qualcuno in questa stanza che non è il tuo partner?",
  "Qual è la figura di m***a più atroce e imbarazzante che hai fatto con una persona che ti piaceva?",
  "Hai mai baciato l'ex di un tuo amico o provato attrazione per qualcuno di proibito?",
  "Qual è la cosa peggiore che hai fatto durante una sbronza e che non hai mai avuto il coraggio di confessare a nessuno?",
  "Qual è la bugia più clamorosa che hai raccontato a uno dei presenti stasera?",
  "Se per 50.000€ dovessi cancellare per sempre un contatto dei presenti dalla tua vita, chi elimineresti?",
  "Hai mai guardato di nascosto il telefono, le chat o i messaggi di qualcuno senza permesso?",
  "Chi tra i presenti ha i gusti nello stile o nel vestirsi più discutibili secondo te?",
  "Qual è la ricerca più compromettente o imbarazzante presente nella tua cronologia recente di Google?",
  "Chi dei presenti ritieni sia il più tirchio quando si tratta di dividere il conto al ristorante o al bar?",
  "Hai mai finto un orgasmo, un complimento o un interesse solo per toglierti dall'imbarazzo?",
  "Qual è la cosa più illegale, pericolosa o borderline che hai fatto nella tua vita?",
  "Chi tra i presenti pensi finirà per sposarsi per primo e chi invece rimarrà single a vita?",
  "Qual è il voto sincero e oggettivo da 1 a 10 sull'aspetto fisico dell'amico seduto alla tua sinistra?",
  "Hai mai parlato male alle spalle di uno dei presenti in questa stanza? Se sì, di chi?",
  "Qual è il messaggio più disperato o patetico che hai mandato a un'ex o a una crush alle 4 del mattino?",
  "Qual è la cosa più schifosa o ripugnante che hai fatto in segreto nella tua stanza?",
  "Se fossi invisibile per 24 ore, quale segreto dei presenti andresti a spiare?",
  "Qual è la persona con cui ti sei pentito/a amaramente di aver limonato o fatto qualcosa?",
  "Se dovessi scambiare la tua vita con quella di un amico presente stasera, chi sceglieresti e perché?",
  "Hai mai inventato una scusa assurda per non uscire con il gruppo solo per startene sul divano?",
  "Qual è il tuo feticismo o la tua fantasia più segreta che non hai mai detto a nessuno?",
  "Chi tra i presenti ritieni sia il più vanitoso o dipendente dai social media?",
  "C'è mai stato un momento in cui hai provato gelosia o invidia cattiva verso il successo di un tuo amico?"
];

function getRandomDomandaScomoda() {
  const idx = Math.floor(Math.random() * DOMANDE_SCOMODE.length);
  return DOMANDE_SCOMODE[idx];
}

// ============================================================================
// INIZIALIZZAZIONE SCENA THREE.JS
// ============================================================================
function initThreeScene() {
  const container = document.getElementById('webgl-canvas-container');

  // Scena
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x130a06); // Atmosfera buia da taverna con focolare
  scene.fog = new THREE.FogExp2(0x130a06, 0.012);

  // Telecamera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 52, 62); // Vista isometrica alta sul tabellone

  // Renderer con ombre soffuse e ACES Tonemapping
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.15; // Non scendere sotto il tavolo
  controls.minDistance = 25;
  controls.maxDistance = 120;
  controls.target.set(0, 0, 0);

  // Luci della Taverna
  setupLighting();

  // Gruppi di Oggetti
  boardGroup = new THREE.Group();
  scenicsGroup = new THREE.Group();
  tilesGroup = new THREE.Group();
  pawnsGroup = new THREE.Group();
  diceGroup = new THREE.Group();

  scene.add(boardGroup);
  scene.add(scenicsGroup);
  scene.add(tilesGroup);
  scene.add(pawnsGroup);
  scene.add(diceGroup);

  // Costruzione Procedurale del Mondo 3D
  createRusticTableAndBoard();
  calculateSpiralCoordinates();
  createSpiralTilesMeshes();
  createScenicsCastle();
  createScenicsBridge();
  createScenicsVillage();
  create3DGeesePawns();
  create3DDice();

  // Resize Handler
  window.addEventListener('resize', onWindowResize);

  // Loop Render
  animate();
}

// LUCI D'AMBIENTE & FOCOLARE
function setupLighting() {
  // Luce ambiente calda
  const ambientLight = new THREE.AmbientLight(0xffe6cb, 0.65);
  scene.add(ambientLight);

  // Lampadario centrale / Candele superiori
  const mainDirLight = new THREE.DirectionalLight(0xfff5e0, 1.1);
  mainDirLight.position.set(20, 60, 30);
  mainDirLight.castShadow = true;
  mainDirLight.shadow.mapSize.width = 2048;
  mainDirLight.shadow.mapSize.height = 2048;
  mainDirLight.shadow.camera.near = 10;
  mainDirLight.shadow.camera.far = 140;
  const d = 45;
  mainDirLight.shadow.camera.left = -d;
  mainDirLight.shadow.camera.right = d;
  mainDirLight.shadow.camera.top = d;
  mainDirLight.shadow.camera.bottom = -d;
  mainDirLight.shadow.bias = -0.0005;
  scene.add(mainDirLight);

  // Luce calda proveniente dal camino sullo sfondo (come nell'immagine)
  const fireplaceLight = new THREE.PointLight(0xff7722, 2.0, 120);
  fireplaceLight.position.set(-45, 18, -40);
  fireplaceLight.castShadow = true;
  scene.add(fireplaceLight);

  // Riflesso freddo dal lato finestra
  const windowFillLight = new THREE.DirectionalLight(0x7ea8c9, 0.35);
  windowFillLight.position.set(-30, 25, 40);
  scene.add(windowFillLight);
}

// ============================================================================
// COSTRUZIONE TAVOLO E CORNICE IN LEGNO SCOLPITO
// ============================================================================
function createRusticTableAndBoard() {
  // Piano del tavolo in massello di quercia
  const tableGeo = new THREE.BoxGeometry(160, 4, 120);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x22130a,
    roughness: 0.85,
    metalness: 0.05
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.y = -2.1;
  tableMesh.receiveShadow = true;
  boardGroup.add(tableMesh);

  // Il Tabellone del Gioco dell'Oca (Cornice lignea con bordo rialzato)
  const boardBaseGeo = new THREE.BoxGeometry(78, 2.5, 56);
  const boardBaseMat = new THREE.MeshStandardMaterial({
    color: 0x422614, // Noce intagliato
    roughness: 0.75,
    metalness: 0.1
  });
  const boardBase = new THREE.Mesh(boardBaseGeo, boardBaseMat);
  boardBase.position.y = 0.2;
  boardBase.receiveShadow = true;
  boardBase.castShadow = true;
  boardGroup.add(boardBase);

  // Superficie interna del prato / terreno
  const terrainGeo = new THREE.BoxGeometry(74, 0.4, 52);
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x5b7a3e, // Verde prato valligiano
    roughness: 0.9,
    metalness: 0.0
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.position.y = 1.4;
  terrain.receiveShadow = true;
  boardGroup.add(terrain);

  // Placche lignee decorative intagliate sui bordi
  createBorderBanner("GIOCO DELL'OCA", 0, 1.7, -26.5, 0, 32, 3);
  createBorderBanner("TRADIZIONALE", -37.5, 1.7, 0, Math.PI / 2, 28, 2.8);
  createBorderBanner("PER TUTTI", 37.5, 1.7, 0, -Math.PI / 2, 28, 2.8);
}

// Placca intagliata con testo dorato sui bordi della scatola
function createBorderBanner(text, x, y, z, rotY, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  // Sfondo legno scurito
  ctx.fillStyle = '#2b1509';
  ctx.fillRect(0, 0, 512, 80);
  ctx.strokeStyle = '#c6953e';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 72);

  // Testo intagliato dorato
  ctx.fillStyle = '#ffd15c';
  ctx.font = 'bold 36px "Cinzel", "Cinzel Decorative", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 256, 42);

  const texture = new THREE.CanvasTexture(canvas);
  const bannerGeo = new THREE.BoxGeometry(w, h, 0.4);
  const bannerMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.2
  });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(x, y, z);
  banner.rotation.y = rotY;
  banner.castShadow = true;
  boardGroup.add(banner);
}

// ============================================================================
// CALCOLO COORDINATE SPIRALE DELLE 63 CASELLE
// ============================================================================
function calculateSpiralCoordinates() {
  TILE_DATA.length = 0;

  // Casella 0: Molo di Partenza (Fuori dal percorso in basso a sinistra)
  TILE_DATA.push({
    id: 0,
    title: "MOLO PARTENZA",
    type: "dock",
    x: -32,
    y: 1.5,
    z: 22,
    rotY: 0
  });

  // Generazione del tracciato spirale a 3 anelli concentrici rettangolari/ellittici
  // Anello 1 (Esterno): Caselle 1..28 (28 tessere)
  generateSpiralRing(1, 28, 33, 21.5, 0);

  // Anello 2 (Medio): Caselle 29..48 (20 tessere)
  generateSpiralRing(29, 48, 23.5, 14.5, 0.08);

  // Anello 3 (Interno verso il Castello): Caselle 49..62 (14 tessere)
  generateSpiralRing(49, 62, 14.5, 8.5, 0.16);

  // Casella 63: TRAGUARDO FINALE / CASTELLO (in alto a destra)
  TILE_DATA.push({
    id: 63,
    title: "TRAGUARDO CASTELLO",
    type: "castle",
    x: 24,
    y: 1.7,
    z: -14,
    rotY: -0.4
  });
}

function generateSpiralRing(startId, endId, rx, rz, yOffset) {
  const count = endId - startId + 1;
  for (let i = 0; i < count; i++) {
    const tileId = startId + i;
    // Angolo distribuito orario lungo l'ellisse rettangolare
    const t = i / count;
    const angle = Math.PI * 0.95 + t * (Math.PI * 2);

    // Parametrizzazione morbida sui bordi squadrati
    const cosVal = Math.cos(angle);
    const sinVal = Math.sin(angle);
    const px = rx * Math.sign(cosVal) * Math.pow(Math.abs(cosVal), 0.85);
    const pz = rz * Math.sign(sinVal) * Math.pow(Math.abs(sinVal), 0.85);

    // Tipo di casella
    let type = "regular";
    let title = `Casella #${tileId}`;

    if (tileId === 1) { type = "start"; title = "PARTENZA"; }
    else if (GOOSE_TILES.includes(tileId)) { type = "goose"; title = "OCA"; }
    else if (tileId === 6) { type = "bridge"; title = "IL PONTE"; }
    else if (tileId === 19) { type = "inn"; title = "LA LOCANDA"; }
    else if (tileId === 31) { type = "well"; title = "IL POZZO"; }
    else if (tileId === 42) { type = "maze"; title = "IL LABIRINTO"; }
    else if (tileId === 52) { type = "prison"; title = "LA PRIGIONE"; }
    else if (tileId === 58) { type = "death"; title = "LO SCHELETRO"; }

    TILE_DATA.push({
      id: tileId,
      title: title,
      type: type,
      x: Math.round(px * 10) / 10,
      y: 1.55 + yOffset,
      z: Math.round(pz * 10) / 10,
      rotY: -angle + Math.PI / 2
    });
  }
}

// ============================================================================
// GENERAZIONE MESH E TEXTURE DELLE TESSERE SPIRALI
// ============================================================================
function createSpiralTilesMeshes() {
  TILE_DATA.forEach((tile) => {
    // Dimensione casella
    const isCastle = tile.id === 63;
    const w = isCastle ? 6.5 : 3.4;
    const d = isCastle ? 5.5 : 2.5;
    const h = 0.35;

    const canvas = createTileTextureCanvas(tile);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;

    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x6e492d, roughness: 0.8 }), // DX
      new THREE.MeshStandardMaterial({ color: 0x6e492d, roughness: 0.8 }), // SX
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.05 }), // TOP
      new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 }), // BOT
      new THREE.MeshStandardMaterial({ color: 0x6e492d, roughness: 0.8 }), // FRONTE
      new THREE.MeshStandardMaterial({ color: 0x6e492d, roughness: 0.8 })  // RETRO
    ];

    const tileGeo = new THREE.BoxGeometry(w, h, d);
    const tileMesh = new THREE.Mesh(tileGeo, materials);
    tileMesh.position.set(tile.x, tile.y, tile.z);
    tileMesh.rotation.y = tile.rotY;
    tileMesh.receiveShadow = true;
    tileMesh.castShadow = true;
    tileMesh.userData = { tileId: tile.id, tileInfo: tile };

    tilesGroup.add(tileMesh);
    TILE_MESHES[tile.id] = tileMesh;
  });
}

// Disegna proceduralmente le texture di ogni casella su un Canvas 2D
function createTileTextureCanvas(tile) {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');

  // Palette di colori vibranti in stile board game vintage dall'immagine
  let bgGradientStart = '#fbf5e8';
  let bgGradientEnd = '#e8d8be';
  let borderColor = '#91714b';
  let badgeText = '';

  if (tile.type === 'goose') {
    bgGradientStart = '#e0f3cf';
    bgGradientEnd = '#9ec87b'; // Verde Oca
    borderColor = '#48752c';
    badgeText = '🪿';
  } else if (tile.type === 'bridge') {
    bgGradientStart = '#d9ecf8';
    bgGradientEnd = '#85b9e2'; // Azzurro Fiume Ponte
    borderColor = '#296395';
    badgeText = '🌉';
  } else if (tile.type === 'inn') {
    bgGradientStart = '#ffebcf';
    bgGradientEnd = '#e5a557'; // Giallo Ocra Locanda
    borderColor = '#8a4c14';
    badgeText = '🍻';
  } else if (tile.type === 'well') {
    bgGradientStart = '#e0d9cf';
    bgGradientEnd = '#a49887'; // Pietra Pozzo
    borderColor = '#4a4034';
    badgeText = '🕳️';
  } else if (tile.type === 'maze') {
    bgGradientStart = '#d4edd8';
    bgGradientEnd = '#6cb47d'; // Labirinto siepe
    borderColor = '#205c30';
    badgeText = '🌀';
  } else if (tile.type === 'prison') {
    bgGradientStart = '#eed8d8';
    bgGradientEnd = '#af6f6f'; // Gabbia Prigione
    borderColor = '#5f2b2b';
    badgeText = '🔒';
  } else if (tile.type === 'death') {
    bgGradientStart = '#f0c8c8';
    bgGradientEnd = '#8b2b2b'; // Teschio / Scheletro
    borderColor = '#380a0a';
    badgeText = '☠️';
  } else if (tile.type === 'castle') {
    bgGradientStart = '#ffd885';
    bgGradientEnd = '#e69f20'; // Oro Castello Reale
    borderColor = '#794806';
    badgeText = '👑';
  } else {
    // Alternanza ritmica di colori tradizionali (Rosso mattone, Giallo miele, Crema)
    const cycle = tile.id % 4;
    if (cycle === 0) { bgGradientStart = '#fcf8ec'; bgGradientEnd = '#ecd9b5'; }
    else if (cycle === 1) { bgGradientStart = '#fff2cf'; bgGradientEnd = '#e8c76b'; }
    else if (cycle === 2) { bgGradientStart = '#dff0d8'; bgGradientEnd = '#a9d49c'; }
    else { bgGradientStart = '#fce4db'; bgGradientEnd = '#e8a995'; }
  }

  // Sfondo a gradiente intagliato
  const grad = ctx.createLinearGradient(0, 0, 160, 120);
  grad.addColorStop(0, bgGradientStart);
  grad.addColorStop(1, bgGradientEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 160, 120);

  // Bordo tondo invecchiato
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 154, 114);

  // Numero Casella
  ctx.fillStyle = '#22150a';
  ctx.font = 'bold 38px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tile.id === 63 ? '63' : String(tile.id), 80, tile.type === 'regular' ? 55 : 44);

  // Icona speciale / Sotto-titolo
  if (badgeText) {
    ctx.font = '28px sans-serif';
    ctx.fillText(badgeText, 80, 84);
  }

  if (tile.type !== 'regular') {
    ctx.font = 'bold 13px "Cinzel", sans-serif';
    ctx.fillStyle = borderColor;
    ctx.fillText(tile.title, 80, 105);
  }

  return canvas;
}

// ============================================================================
// ELEMENTI SCENOGRAFICI 3D PROCEDURALI (Castello, Ponte, Villaggio, Pozzo)
// ============================================================================

// 1. IL CASTELLO FANTASY (Casella 63 - Torri in pietra e tetti conici viola come nell'immagine)
function createScenicsCastle() {
  const castleGroup = new THREE.Group();
  castleGroup.position.set(24, 1.8, -14);
  castleGroup.rotation.y = -0.35;

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdfd4c0, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x763882, roughness: 0.45, metalness: 0.1 }); // Viola fiaba
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.7 });

  // Corpo centrale (Mastio)
  const keepGeo = new THREE.BoxGeometry(6.5, 7.5, 5.5);
  const keep = new THREE.Mesh(keepGeo, stoneMat);
  keep.position.y = 3.75;
  keep.castShadow = true;
  keep.receiveShadow = true;
  castleGroup.add(keep);

  // 4 Torri rotonde ai lati
  const towerPositions = [
    [-3.2, -2.7], [3.2, -2.7],
    [-3.2, 2.7], [3.2, 2.7]
  ];

  towerPositions.forEach(([tx, tz]) => {
    // Cilindro della torre
    const towerGeo = new THREE.CylinderGeometry(1.2, 1.3, 9.5, 12);
    const tower = new THREE.Mesh(towerGeo, stoneMat);
    tower.position.set(tx, 4.75, tz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    castleGroup.add(tower);

    // Tetto conico viola
    const coneGeo = new THREE.ConeGeometry(1.6, 4.5, 12);
    const cone = new THREE.Mesh(coneGeo, roofMat);
    cone.position.set(tx, 9.5 + 2.25, tz);
    cone.castShadow = true;
    castleGroup.add(cone);

    // Bandierina dorata in cima
    const flagGeo = new THREE.BoxGeometry(0.8, 0.4, 0.05);
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(tx + 0.4, 9.5 + 4.5, tz);
    castleGroup.add(flag);
  });

  // Arco del portale d'ingresso (dove entra la pedina vittoriosa)
  const archGeo = new THREE.BoxGeometry(2.4, 3.2, 0.8);
  const archMat = new THREE.MeshStandardMaterial({ color: 0x1f140d, roughness: 0.9 });
  const arch = new THREE.Mesh(archGeo, archMat);
  arch.position.set(0, 1.6, 2.8);
  castleGroup.add(arch);

  // Ponte levatoio abbassato in legno
  const drawBridgeGeo = new THREE.BoxGeometry(2.6, 0.25, 3.2);
  const drawBridge = new THREE.Mesh(drawBridgeGeo, woodMat);
  drawBridge.position.set(0, 0.15, 4.2);
  drawBridge.receiveShadow = true;
  castleGroup.add(drawBridge);

  scenicsGroup.add(castleGroup);
}

// 2. IL PONTE IN LEGNO E PIETRA (Casella 6 - Spanning a stream)
function createScenicsBridge() {
  const bridgeTile = TILE_DATA[6];
  if (!bridgeTile) return;

  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(bridgeTile.x, bridgeTile.y + 0.1, bridgeTile.z);
  bridgeGroup.rotation.y = bridgeTile.rotY;

  // Ruscello d'acqua azzurra intagliato sotto
  const streamGeo = new THREE.PlaneGeometry(6, 3.2);
  const streamMat = new THREE.MeshStandardMaterial({
    color: 0x2e86ab,
    roughness: 0.2,
    metalness: 0.3
  });
  const stream = new THREE.Mesh(streamGeo, streamMat);
  stream.rotation.x = -Math.PI / 2;
  stream.position.y = -0.15;
  bridgeGroup.add(stream);

  // Arco del ponticello in legno
  const archGeo = new THREE.CylinderGeometry(2.8, 2.8, 2.6, 12, 1, false, 0, Math.PI);
  const archMat = new THREE.MeshStandardMaterial({ color: 0x8a5329, roughness: 0.7 });
  const bridgeArch = new THREE.Mesh(archGeo, archMat);
  bridgeArch.rotation.z = Math.PI / 2;
  bridgeArch.position.y = -1.8;
  bridgeArch.castShadow = true;
  bridgeGroup.add(bridgeArch);

  // Parapetti in legno laterali
  const railGeo = new THREE.BoxGeometry(0.2, 0.8, 3.2);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x5a3418 });
  const railL = new THREE.Mesh(railGeo, railMat);
  railL.position.set(-1.4, 0.6, 0);
  const railR = new THREE.Mesh(railGeo, railMat);
  railR.position.set(1.4, 0.6, 0);
  bridgeGroup.add(railL);
  bridgeGroup.add(railR);

  scenicsGroup.add(bridgeGroup);
}

// 3. IL VILLAGGIO MEDIEVALE CENTRALE (Casette a graticcio, abeti, piazzetta)
function createScenicsVillage() {
  const villageGroup = new THREE.Group();
  villageGroup.position.set(-2, 1.6, 2);

  // Case con tetti a capanna in terracotta/paglia
  const housePositions = [
    { x: -5, z: -3, w: 4.2, h: 3.5, d: 3.2, rot: 0.3, roofCol: 0xb5482e },
    { x: 3, z: -4, w: 3.8, h: 4.2, d: 3.0, rot: -0.2, roofCol: 0x933a22 },
    { x: -4, z: 4, w: 4.0, h: 3.0, d: 3.4, rot: 0.8, roofCol: 0x5a3418 },
    { x: 4, z: 3, w: 4.5, h: 3.8, d: 3.2, rot: -0.6, roofCol: 0xb5482e }
  ];

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });

  housePositions.forEach((h) => {
    const house = new THREE.Group();
    house.position.set(h.x, 0, h.z);
    house.rotation.y = h.rot;

    // Pareti intonacate
    const wallsGeo = new THREE.BoxGeometry(h.w, h.h, h.d);
    const walls = new THREE.Mesh(wallsGeo, wallMat);
    walls.position.y = h.h / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    // Tetto a punta triangolare
    const roofGeo = new THREE.ConeGeometry(h.w * 0.78, 2.2, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: h.roofCol, roughness: 0.65 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = h.h + 1.1;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);

    // Camino in pietra
    const chimneyGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x736960 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(h.w * 0.25, h.h + 1.0, 0);
    chimney.castShadow = true;
    house.add(chimney);

    villageGroup.add(house);
  });

  // Alberi ed abeti sparsi (coni verdi sovrapposti)
  const treePositions = [
    [-9, 0], [9, -1], [-1, -8], [0, 8], [8, 7], [-8, -6]
  ];

  treePositions.forEach(([tx, tz]) => {
    const tree = createPineTree();
    tree.position.set(tx, 0, tz);
    villageGroup.add(tree);
  });

  // Pozzo in pietra al centro (Tile 31 o piazzetta)
  const well = createStoneWell();
  well.position.set(0, 0, 0);
  villageGroup.add(well);

  scenicsGroup.add(villageGroup);
}

function createPineTree() {
  const tree = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.4, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c16 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.7;
  tree.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2b542e, roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const coneGeo = new THREE.ConeGeometry(1.6 - i * 0.35, 1.8, 8);
    const foliage = new THREE.Mesh(coneGeo, foliageMat);
    foliage.position.y = 1.6 + i * 1.1;
    foliage.castShadow = true;
    tree.add(foliage);
  }
  return tree;
}

function createStoneWell() {
  const wellGroup = new THREE.Group();
  // Cilindro pozzo
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.85 });
  const wellGeo = new THREE.CylinderGeometry(1.2, 1.2, 1.1, 12, 1, true);
  const well = new THREE.Mesh(wellGeo, stoneMat);
  well.position.y = 0.55;
  wellGroup.add(well);

  // Tettoietta
  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3418 });
  const post1 = new THREE.Mesh(postGeo, woodMat);
  post1.position.set(-0.9, 1.1, 0);
  const post2 = new THREE.Mesh(postGeo, woodMat);
  post2.position.set(0.9, 1.1, 0);
  wellGroup.add(post1);
  wellGroup.add(post2);

  const roofGeo = new THREE.ConeGeometry(1.5, 0.9, 4);
  const roof = new THREE.Mesh(roofGeo, woodMat);
  roof.position.y = 2.4;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  wellGroup.add(roof);

  return wellGroup;
}

// ============================================================================
// MODELLAZIONE DELLE 4 MINIATURE DELL'OCA IN LEGNO (Rosso, Giallo, Verde, Blu)
// ============================================================================
function create3DGeesePawns() {
  PLAYERS.forEach((p, idx) => {
    const gooseMesh = buildSculptedGooseModel(p.color);
    gooseMesh.userData = { playerId: idx };
    pawnsGroup.add(gooseMesh);
    PAWN_MESHES.push(gooseMesh);

    // Posizionamento iniziale sul Molo di Partenza (#0)
    placePawnOnTile(idx, 0, false);
  });
}

function buildSculptedGooseModel(colorHex) {
  const goose = new THREE.Group();

  // Materiale laccato lucido per il corpo in legno colorato (come giocattolo artigianale)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.35,
    metalness: 0.08
  });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xff9900, roughness: 0.4 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.6 });

  // 1. Basamento rotondo intagliato
  const baseGeo = new THREE.CylinderGeometry(1.1, 1.25, 0.35, 16);
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = 0.17;
  baseMesh.receiveShadow = true;
  goose.add(baseMesh);

  // 2. Corpo paffuto dell'Oca
  const bodyGeo = new THREE.SphereGeometry(1.2, 16, 12);
  bodyGeo.scale(1.0, 0.9, 1.4);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 1.2, -0.2);
  body.castShadow = true;
  goose.add(body);

  // Codina arricciata posteriore
  const tailGeo = new THREE.ConeGeometry(0.45, 0.9, 8);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.position.set(0, 1.5, -1.35);
  tail.rotation.x = -Math.PI / 3;
  goose.add(tail);

  // 3. Collo aggraziato curvato in avanti
  const neckGeo = new THREE.CylinderGeometry(0.42, 0.55, 1.8, 12);
  const neck = new THREE.Mesh(neckGeo, bodyMat);
  neck.position.set(0, 2.2, 0.6);
  neck.rotation.x = Math.PI / 10;
  neck.castShadow = true;
  goose.add(neck);

  // 4. Testolina rotonda
  const headGeo = new THREE.SphereGeometry(0.65, 14, 10);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 3.2, 0.85);
  head.castShadow = true;
  goose.add(head);

  // Becco arancione
  const beakGeo = new THREE.ConeGeometry(0.28, 0.8, 8);
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0, 3.15, 1.55);
  beak.rotation.x = Math.PI / 2;
  goose.add(beak);

  // Occhietti intagliati
  const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.4, 3.32, 1.05);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(-0.4, 3.32, 1.05);
  goose.add(eyeL);
  goose.add(eyeR);

  // Scala complessiva per le proporzioni perfette sulla tessera
  goose.scale.set(0.85, 0.85, 0.85);

  return goose;
}

// Colloca visivamente la pedina sulla tessera target con piccolo offset se più pedine condividono la casella
function placePawnOnTile(pawnIdx, tileId, animateHop = false, onDone = null) {
  const pawn = PAWN_MESHES[pawnIdx];
  const tile = TILE_DATA[tileId] || TILE_DATA[0];

  // Offset pedine multiple sulla stessa casella (supporta fino a 12 giocatori)
  const offsets = [
    [-0.6, -0.4], [0.6, -0.4],
    [-0.6, 0.4], [0.6, 0.4],
    [-1.2, -0.4], [1.2, -0.4],
    [-1.2, 0.4], [1.2, 0.4],
    [-0.6, -1.0], [0.6, -1.0],
    [-0.6, 1.0], [0.6, 1.0]
  ];
  const [ox, oz] = offsets[pawnIdx % offsets.length];

  const targetX = tile.x + ox * 0.7;
  const targetY = tile.y + 0.18;
  const targetZ = tile.z + oz * 0.7;

  if (!animateHop) {
    pawn.position.set(targetX, targetY, targetZ);
    pawn.rotation.y = tile.rotY;
    if (onDone) onDone();
    return;
  }

  // Animazione Balzo Parabolico (Hop)
  const startX = pawn.position.x;
  const startY = pawn.position.y;
  const startZ = pawn.position.z;
  const duration = 220;
  const startTime = performance.now();

  playSound('hop');

  function hopStep(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);

    // Parabola di salto
    const arcHeight = 2.2;
    const currentY = THREE.MathUtils.lerp(startY, targetY, t) + Math.sin(t * Math.PI) * arcHeight;

    pawn.position.x = THREE.MathUtils.lerp(startX, targetX, t);
    pawn.position.y = currentY;
    pawn.position.z = THREE.MathUtils.lerp(startZ, targetZ, t);

    // Rotazione verso il senso di marcia
    pawn.rotation.y = THREE.MathUtils.lerp(pawn.rotation.y, tile.rotY, t);

    if (t < 1) {
      requestAnimationFrame(hopStep);
    } else {
      pawn.position.set(targetX, targetY, targetZ);
      if (onDone) onDone();
    }
  }

  requestAnimationFrame(hopStep);
}

// ============================================================================
// DADI FISICI 3D SUL TAVOLO
// ============================================================================
let diceMesh1, diceMesh2;

function create3DDice() {
  const diceGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  const diceMat = createDiceMaterials();

  diceMesh1 = new THREE.Mesh(diceGeo, diceMat);
  diceMesh1.position.set(-28, 1.4, 14);
  diceMesh1.castShadow = true;
  diceGroup.add(diceMesh1);

  diceMesh2 = new THREE.Mesh(diceGeo, diceMat);
  diceMesh2.position.set(-24.5, 1.4, 15);
  diceMesh2.castShadow = true;
  diceGroup.add(diceMesh2);
}

function createDiceMaterials() {
  const pips = [1, 6, 2, 5, 3, 4]; // Ordine standard facce cubiche
  return pips.map(num => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Sfondo avorio / legno levigato
    ctx.fillStyle = '#fcf8ec';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#7c4d29';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 120);

    // Punti intagliati neri
    ctx.fillStyle = '#1c1007';
    const drawDot = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
    };

    const c = 64, l = 32, r = 96;
    if (num % 2 === 1) drawDot(c, c); // Centro
    if (num > 1) { drawDot(l, l); drawDot(r, r); }
    if (num > 3) { drawDot(r, l); drawDot(l, r); }
    if (num === 6) { drawDot(l, c); drawDot(r, c); }

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45 });
  });
}

// Rotolamento scenografico dei dadi 3D
function roll3DDiceAnimation(val1, val2, callback) {
  isRollingDice = true;
  playSound('dice');

  const startT = performance.now();
  const duration = 750;

  function tumbleStep(now) {
    const t = Math.min(1, (now - startT) / duration);

    // Rotazione casuale frenetica che si placa
    const rotSpeed = (1 - t) * 0.45;
    diceMesh1.rotation.x += rotSpeed * 3;
    diceMesh1.rotation.y += rotSpeed * 2.5;
    diceMesh1.rotation.z += rotSpeed * 1.8;

    diceMesh2.rotation.x += rotSpeed * 2.8;
    diceMesh2.rotation.y += rotSpeed * 3.2;
    diceMesh2.rotation.z += rotSpeed * 2.1;

    // Piccolo balzo in alto
    const jump = Math.sin(t * Math.PI) * 2.5;
    diceMesh1.position.y = 1.4 + jump;
    diceMesh2.position.y = 1.4 + jump;

    if (t < 1) {
      requestAnimationFrame(tumbleStep);
    } else {
      diceMesh1.position.y = 1.4;
      diceMesh2.position.y = 1.4;
      isRollingDice = false;
      if (callback) callback();
    }
  }

  requestAnimationFrame(tumbleStep);
}

// ============================================================================
// LOGICA DI GIOCO STORICA INTEGRALE (REGOLE CLASSICHE DEL GIOCO DELL'OCA)
// ============================================================================
function triggerRollTurn() {
  if (isMovingPawn || isRollingDice) return;

  const player = PLAYERS[currentPlayerIdx];
  if (!player) {
    logEvent("Attendi che almeno un giocatore entri nella stanza prima di lanciare i dadi.");
    return;
  }

  const btnRoll = document.getElementById('btn-roll-dice');
  btnRoll.disabled = true;

  // 1. Controllo se il giocatore deve saltare il turno (Locanda / Prigione)
  if (player.skipTurns > 0) {
    player.skipTurns--;
    logEvent(`${player.name} è bloccato e salta questo turno! (Turni rimasti: ${player.skipTurns})`, 'special');
    advanceToNextPlayer();
    return;
  }

  // 2. Controllo se il giocatore è intrappolato nel Pozzo
  if (player.trapped) {
    logEvent(`${player.name} è ancora intrappolato nel Pozzo! Serve un compagno per liberarlo.`, 'special');
    advanceToNextPlayer();
    return;
  }

  // 3. Lancio dei 2 dadi (1..6)
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const totalRoll = d1 + d2;

  // Aggiornamento visivo interfaccia dadi
  const diceBoxes = document.querySelectorAll('.wood-dice-box');
  diceBoxes.forEach(b => b.classList.add('rolling'));

  roll3DDiceAnimation(d1, d2, () => {
    diceBoxes.forEach(b => b.classList.remove('rolling'));
    diceBoxes[0].textContent = d1;
    diceBoxes[1].textContent = d2;

    logEvent(`${player.name} ha lanciato i dadi: [${d1}] + [${d2}] = ${totalRoll}!`);

    // Regola classica del primo tiro: 6 e 3 -> casella 26; 5 e 4 -> casella 53
    if (player.isFirstTurn) {
      player.isFirstTurn = false;
      if ((d1 === 6 && d2 === 3) || (d1 === 3 && d2 === 6)) {
        logEvent(`🎲 TIRO SPECIALE D'APERTURA (6 e 3)! ${player.name} vola direttamente alla Casella 26!`, 'special');
        movePawnSequence(player, 26, () => advanceToNextPlayer());
        return;
      } else if ((d1 === 5 && d2 === 4) || (d1 === 4 && d2 === 5)) {
        logEvent(`🎲 TIRO SPECIALE D'APERTURA (5 e 4)! ${player.name} vola gloriosamente alla Casella 53!`, 'special');
        movePawnSequence(player, 53, () => advanceToNextPlayer());
        return;
      }
    }

    // Calcolo destinazione con rimbalzo se supera 63
    let targetPos = player.position + totalRoll;
    let bounced = false;

    if (targetPos > 63) {
      const overshoot = targetPos - 63;
      targetPos = 63 - overshoot;
      bounced = true;
      logEvent(`⚠️ RIMBALZO AL TRAGUARDO! ${player.name} supera 63 e rimbalza indietro alla Casella ${targetPos}!`, 'special');
    }

    // Movimento passo dopo passo
    movePawnStepByStep(player, targetPos, totalRoll, bounced);
  });
}

// Avanzamento passo dopo passo (1 casella alla volta con animazione hop)
function movePawnStepByStep(player, finalTarget, rollAmount, hasBounced) {
  isMovingPawn = true;
  let currentPos = player.position;

  function step() {
    if (currentPos < finalTarget) currentPos++;
    else if (currentPos > finalTarget) currentPos--;

    player.position = currentPos;
    updatePawnHUDPositions();

    placePawnOnTile(player.id, currentPos, true, () => {
      if (currentPos !== finalTarget) {
        step();
      } else {
        // Atterrato sulla casella finale: Valuta le regole speciali!
        evaluateLandedTile(player, rollAmount);
      }
    });
  }

  step();
}

// Spostamento diretto con sequenza rapida
function movePawnSequence(player, targetPos, onDone) {
  isMovingPawn = true;
  player.position = targetPos;
  updatePawnHUDPositions();
  placePawnOnTile(player.id, targetPos, true, () => {
    isMovingPawn = false;
    if (onDone) onDone();
  });
}

// VARIABILE CALLBACK MODALE ALCOLICA ATTIVA
let currentChallengeCallback = null;
let currentActingPlayer = null;
let currentTileChallenge = null;

function openDrinkingModal(player, challenge, onDone) {
  currentChallengeCallback = onDone;
  currentActingPlayer = player;
  currentTileChallenge = challenge;

  const modal = document.getElementById('modal-drinking-challenge');
  const catBadge = document.getElementById('challenge-cat-badge');
  const iconDisp = document.getElementById('challenge-icon-display');
  const titleDisp = document.getElementById('challenge-tile-title');
  const playerDisp = document.getElementById('challenge-player-acting');
  const descDisp = document.getElementById('challenge-instruction-box');
  const btnRerollTruth = document.getElementById('btn-reroll-truth');

  // Assegnazione classe badge
  catBadge.className = `challenge-cat-badge badge-${challenge.cat || 'drink'}`;
  catBadge.textContent = (challenge.cat || 'BEVUTA').toUpperCase();

  iconDisp.textContent = challenge.icon || '🍺';
  titleDisp.textContent = challenge.title;
  playerDisp.innerHTML = `Tocca a <strong style="color:${player.hex}; font-size:1.05rem;">${player.name}</strong>`;

  // Se è una casella verità, pesca una domanda piccante dalla lista delle domande scomode
  let displayDesc = challenge.desc;
  if (challenge.cat === 'truth') {
    const q = getRandomDomandaScomoda();
    displayDesc = `🤫 DOMANDA SCOMODA:\n"${q}"\n\nRispondi sinceramente davanti a tutti o bevi ${challenge.sips || 2} sorsi!`;
    if (btnRerollTruth) btnRerollTruth.style.display = 'inline-flex';
  } else {
    if (btnRerollTruth) btnRerollTruth.style.display = 'none';
  }

  descDisp.textContent = displayDesc;

  playSound('gulp');
  modal.classList.add('visible');
}

// VALUTAZIONE DELLE CASELLE SPECIALI & PENITENZE ALCOLICHE
function evaluateLandedTile(player, lastRoll) {
  const pos = player.position;

  // 1. VITTORIA AL CASTELLO (Casella 63 ESATTA)
  if (pos === 63) {
    showVictoryModal(player);
    isMovingPawn = false;
    return;
  }

  const challenge = DRINKING_CHALLENGES[pos] || {
    cat: "drink",
    icon: "🍺",
    title: `Casella #${pos}`,
    desc: `Sei atterrato sulla casella ${pos}! Bevi 1 sorso per festeggiare il passaggio.`,
    sips: 1,
    shots: 0
  };

  // Apertura popup sfida alcolica
  openDrinkingModal(player, challenge, () => {
    // Risoluzione dell'effetto sul tabellone dopo il brindisi:

    // 2. CASELLA OCA (5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59)
    if (GOOSE_TILES.includes(pos)) {
      playSound('fanfare');
      logEvent(`🪿 "DI OCA IN OCA SI VOLA!" ${player.name} è su un'Oca (#${pos}) e vola avanti di altri ${lastRoll} passi!`, 'special');
      let nextTarget = pos + lastRoll;
      if (nextTarget > 63) nextTarget = 63 - (nextTarget - 63);

      setTimeout(() => {
        movePawnStepByStep(player, nextTarget, lastRoll, false);
      }, 450);
      return;
    }

    // 3. CASELLA 6: IL PONTE (Salta a 12)
    if (pos === 6) {
      playSound('fanfare');
      logEvent(`🌉 IL PONTE! ${player.name} attraversa il fiume e passa direttamente alla Casella 12!`, 'special');
      setTimeout(() => {
        movePawnSequence(player, 12, () => advanceToNextPlayer());
      }, 500);
      return;
    }

    // 4. CASELLA 19: LA LOCANDA (Resta fermo per 2 turni)
    if (pos === 19) {
      playSound('trap');
      player.skipTurns = 2;
      logEvent(`🍻 LA LOCANDA! ${player.name} si ferma al bancone: salterà 2 turni!`, 'special');
      advanceToNextPlayer();
      return;
    }

    // 5. CASELLA 31: IL POZZO (Bloccato finché un altro giocatore non cade nel pozzo)
    if (pos === 31) {
      playSound('trap');
      PLAYERS.forEach(p => {
        if (p.id !== player.id && p.trapped) {
          p.trapped = false;
          logEvent(`🎉 ${p.name} è stato liberato dal Pozzo grazie all'arrivo di ${player.name}!`);
        }
      });
      player.trapped = true;
      logEvent(`🕳️ IL POZZO DELLE 4:00 AM! ${player.name} è caduto nel pozzo ed è bloccato finché un compagno non lo libera!`, 'special');
      advanceToNextPlayer();
      return;
    }

    // 6. CASELLA 42: IL LABIRINTO (Si perde e torna a 30)
    if (pos === 42) {
      playSound('trap');
      logEvent(`🌀 IL LABIRINTO! ${player.name} si perde nei vicoli e torna indietro alla Casella 30!`, 'special');
      setTimeout(() => {
        movePawnSequence(player, 30, () => advanceToNextPlayer());
      }, 500);
      return;
    }

    // 7. CASELLA 52: LA PRIGIONE (Bloccato 3 turni)
    if (pos === 52) {
      playSound('trap');
      player.skipTurns = 3;
      logEvent(`🔒 LA PRIGIONE! ${player.name} viene rinchiuso nelle carceri: salta 3 turni!`, 'special');
      advanceToNextPlayer();
      return;
    }

    // 8. CASELLA 58: LO SCHELETRO / LA MORTE (Torna alla partenza Casella 1!)
    if (pos === 58) {
      playSound('trap');
      logEvent(`☠️ IL RESACONE DELLE 6:00! ${player.name} ricomincia daccapo dalla Casella 1!`, 'special');
      setTimeout(() => {
        movePawnSequence(player, 1, () => advanceToNextPlayer());
      }, 600);
      return;
    }

    // Casella ordinaria
    advanceToNextPlayer();
  });
}

function advanceToNextPlayer() {
  isMovingPawn = false;
  currentPlayerIdx = (currentPlayerIdx + 1) % PLAYERS.length;
  updateTurnHUD();

  const btnRoll = document.getElementById('btn-roll-dice');
  btnRoll.disabled = false;
}

// ============================================================================
// AGGIORNAMENTO HUD & CRONACHE
// ============================================================================
function updateTurnHUD() {
  const turnAnnouncer = document.getElementById('turn-announcer-text');
  if (!turnAnnouncer) return;

  const curr = PLAYERS[currentPlayerIdx];
  if (!curr) {
    // In multiplayer la stanza può essere ancora vuota durante la schermata iniziale.
    turnAnnouncer.textContent = 'IN ATTESA DI GIOCATORI...';
    document.querySelectorAll('.player-token-pill').forEach(pill => pill.classList.remove('active'));
    return;
  }

  // textContent + nodi DOM: nessuna interpretazione di HTML nel nome del giocatore.
  turnAnnouncer.textContent = 'TURNO DI ';
  const nameSpan = document.createElement('span');
  nameSpan.style.color = curr.hex;
  nameSpan.style.fontWeight = '900';
  nameSpan.textContent = curr.name.toUpperCase();
  turnAnnouncer.appendChild(nameSpan);

  // Aggiorna classe attiva sui pill dei giocatori
  document.querySelectorAll('.player-token-pill').forEach((pill, idx) => {
    if (idx === currentPlayerIdx) pill.classList.add('active');
    else pill.classList.remove('active');
  });
}

function updatePawnHUDPositions() {
  PLAYERS.forEach((p, idx) => {
    const posBadge = document.getElementById(`pawn-pos-badge-${idx}`);
    if (posBadge) posBadge.textContent = `#${p.position}`;

    const drinkBadge = document.getElementById(`pawn-drink-badge-${idx}`);
    if (drinkBadge) drinkBadge.textContent = `🍺${p.sips} 🥃${p.shots}`;
  });
}

function logEvent(msg, type = 'normal') {
  const feed = document.getElementById('event-feed-list');
  const entry = document.createElement('div');
  entry.className = `event-entry ${type}`;
  entry.textContent = msg;
  feed.appendChild(entry);
  feed.scrollTop = feed.scrollHeight;
}

function showVictoryModal(winner) {
  playSound('fanfare');
  confetti({
    particleCount: 250,
    spread: 120,
    origin: { y: 0.6 }
  });

  const modal = document.getElementById('modal-victory');
  const heading = document.getElementById('winner-title');
  const desc = document.getElementById('winner-desc');

  heading.textContent = `GLORIA A ${winner.name.toUpperCase()}!`;
  heading.style.color = winner.hex;
  desc.innerHTML = `👑 Ha raggiunto per primo il Castello alla Casella 63!<br><br><strong>REGOLA SUPREMA FINALE:</strong><br>Tutti gli altri giocatori devono finire e scolarsi il proprio bicchiere alla salute del campione! 🍻🍾`;

  modal.classList.add('visible');
}

function restartGame() {
  document.getElementById('modal-victory').classList.remove('visible');
  PLAYERS.forEach((p, idx) => {
    p.position = 0;
    p.skipTurns = 0;
    p.trapped = false;
    p.isFirstTurn = true;
    p.sips = 0;
    p.shots = 0;
    p.partnerId = null;
    placePawnOnTile(idx, 0, false);
  });
  currentPlayerIdx = 0;
  updateTurnHUD();
  updatePawnHUDPositions();
  logEvent(`🔥 Nuova partita iniziata! Tutti i giocatori sono al Molo di Partenza.`);
  document.getElementById('btn-roll-dice').disabled = false;
}

// CONTROLLO TELECAMERA PRESET
function setCameraView(preset) {
  document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));

  if (preset === 'top') {
    // Vista Zenitale dall'alto
    animateCameraPosition(0, 85, 4, 0, 0, 0);
    document.getElementById('cam-btn-top').classList.add('active');
  } else if (preset === 'iso') {
    // Prospettiva isometrica classica
    animateCameraPosition(0, 52, 62, 0, 0, 0);
    document.getElementById('cam-btn-iso').classList.add('active');
  } else if (preset === 'pawn') {
    // Zoom ravvicinato sulla pedina di turno
    const curr = PLAYERS[currentPlayerIdx];
    const tile = TILE_DATA[curr.position] || TILE_DATA[0];
    animateCameraPosition(tile.x, tile.y + 16, tile.z + 18, tile.x, tile.y, tile.z);
    document.getElementById('cam-btn-pawn').classList.add('active');
  }
}

function animateCameraPosition(tx, ty, tz, lookX, lookY, lookZ) {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const destPos = new THREE.Vector3(tx, ty, tz);
  const destTarget = new THREE.Vector3(lookX, lookY, lookZ);

  const startT = performance.now();
  const duration = 650;

  function camStep(now) {
    const elapsed = now - startT;
    const t = Math.min(1, elapsed / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Easing quadratico

    camera.position.lerpVectors(startPos, destPos, ease);
    controls.target.lerpVectors(startTarget, destTarget, ease);
    controls.update();

    if (t < 1) requestAnimationFrame(camStep);
  }
  requestAnimationFrame(camStep);
}

// GESTIONE RESIZE & ANIMAZIONE THREE.JS
function isMobilePortrait() {
  return window.innerWidth < 860 && window.innerWidth < window.innerHeight;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;

  // Adattamento FOV per mobile portrait: campo visivo più ampio per inquadrare la spirale
  if (isMobilePortrait()) {
    camera.fov = 62;
    camera.position.set(0, 68, 48);
    controls.target.set(0, 0, 0);
    // Ammorbidisce OrbitControls su touch per evitare conflitti coi tap
    controls.enableRotate = true;
    controls.rotateSpeed = 0.35;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.5;
    controls.enablePan = false;
  } else {
    camera.fov = 45;
    controls.rotateSpeed = 1;
    controls.zoomSpeed = 1;
    controls.enablePan = true;
  }

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/**
 * Modalità offline / hotseat: popola PLAYERS con 4 giocatori default,
 * crea le pedine 3D e l'HUD. Usato quando non c'è un server Socket.io.
 */
function initDefaultPlayersOffline() {
  const defaultNames = ["Oca Rossa", "Oca Gialla", "Oca Verde", "Oca Blu"];
  for (let i = 0; i < 4; i++) {
    const c = getPlayerColor(i);
    PLAYERS.push({
      id: `local_${i}`,
      name: defaultNames[i],
      position: 0,
      skipTurns: 0,
      trapped: false,
      isFirstTurn: true,
      sips: 0,
      shots: 0,
      partnerId: null,
      hex: c.hex,
      color: c.color,
      cssClass: c.cssClass
    });
  }
  create3DGeesePawns();
  renderPlayersHUD();
  updateTurnHUD();
  updatePawnHUDPositions();
}

// INIZIALIZZAZIONE ALL'AVVIO
window.addEventListener('DOMContentLoaded', () => {
  initThreeScene();
  updateTurnHUD();
  updatePawnHUDPositions();
  logEvent("Benvenuti al Nobile Gioco dell'Oca 3D! Cliccate 'LANCIA I DADI' per iniziare.");

  // Listeners Interfaccia
  document.getElementById('btn-roll-dice').onclick = triggerRollTurn;
  document.getElementById('btn-restart-game').onclick = restartGame;

  // Risoluzione Sfida Alcolica (FATTO / BEVUTO)
  document.getElementById('btn-challenge-done').onclick = () => {
    const modal = document.getElementById('modal-drinking-challenge');
    modal.classList.remove('visible');
    playSound('gulp');

    if (currentActingPlayer && currentTileChallenge) {
      currentActingPlayer.sips += (currentTileChallenge.sips || 0);
      currentActingPlayer.shots += (currentTileChallenge.shots || 0);
      logEvent(`🍻 ${currentActingPlayer.name} ha completato la prova: bevuto come un re! (Totale: ${currentActingPlayer.sips} sorsi, ${currentActingPlayer.shots} shot)`);
      updatePawnHUDPositions();
    }

    if (currentChallengeCallback) {
      const cb = currentChallengeCallback;
      currentChallengeCallback = null;
      cb();
    }
  };

  // Risoluzione Sfida Alcolica (POLLO / RIFIUTO)
  document.getElementById('btn-challenge-chicken').onclick = () => {
    const modal = document.getElementById('modal-drinking-challenge');
    modal.classList.remove('visible');
    playSound('chicken');

    if (currentActingPlayer) {
      currentActingPlayer.sips += 2;
      logEvent(`🐔 ${currentActingPlayer.name} HA FATTO IL POLLO! Rifiuta la sfida e si becca 2 sorsi di penitenza!`, 'special');
      updatePawnHUDPositions();
    }

    if (currentChallengeCallback) {
      const cb = currentChallengeCallback;
      currentChallengeCallback = null;
      cb();
    }
  };

  // Pulsante Caos: CASCATA GENERALE (Tutti bevono!)
  document.getElementById('btn-trigger-waterfall').onclick = () => {
    playSound('fanfare');
    PLAYERS.forEach(p => p.sips += 2);
    updatePawnHUDPositions();
    logEvent("🌊 CASCATA GENERALE SCATENATA! Tutti i giocatori bevono contemporaneamente senza sosta!", 'special');
    alert("🌊 CASCATA ALCOLICA!\nTutti i giocatori bevono adesso finché chi ha attivato la cascata non posa il bicchiere! 🍻");
  };

  // Pulsante Caos: SHOT DI GRUPPO
  document.getElementById('btn-trigger-shot').onclick = () => {
    playSound('gulp');
    PLAYERS.forEach(p => p.shots += 1);
    updatePawnHUDPositions();
    logEvent("🥃 ROUND DI SHOT A SORPRESA! Tutti alzano il bicchierino e buttano giù liscio!", 'special');
    alert("🥃 BRINDISI DI SHOT!\nUno shot per tutti i presenti alla salute della taverna! 🍸");
  };

  // Pulsante Caos: DOMANDA SCOMODA FLASH A BRUCIAPELO
  document.getElementById('btn-trigger-truth').onclick = () => {
    const curr = PLAYERS[currentPlayerIdx];
    const q = getRandomDomandaScomoda();
    openDrinkingModal(curr, {
      cat: "truth",
      icon: "💣",
      title: "DOMANDA SCOMODA A TRADIMENTO!",
      desc: `🔥 Domanda a bruciapelo per ${curr.name}:\n\n"${q}"\n\nRispondi sinceramente davanti a tutti o bevi 3 sorsi generosi!`,
      sips: 3,
      shots: 0
    }, () => {
      logEvent(`💣 ${curr.name} è stato messo sotto torchio dalla domanda scomoda a tradimento!`, 'special');
    });
  };

  // Tasto Re-Roll Domanda Scomoda (nel modal)
  const btnRerollTruth = document.getElementById('btn-reroll-truth');
  if (btnRerollTruth) {
    btnRerollTruth.onclick = () => {
      const q = getRandomDomandaScomoda();
      playSound('hop');
      document.getElementById('challenge-instruction-box').textContent = `🤫 DOMANDA SCOMODA:\n"${q}"\n\nRispondi sinceramente davanti a tutti o bevi 2 sorsi!`;
    };
  }

  // ============================================================================
  // GESTIONE GATEWAY INIZIALE TAVERNA (WELCOME SCREEN) & REGIA ADMIN
  // ============================================================================
  function dismissWelcomeScreen(onDone) {
    const ws = document.getElementById('welcome-screen');
    if (!ws) {
      if (onDone) onDone();
      return;
    }
    ws.classList.add('hidden');
    setTimeout(() => {
      ws.style.display = 'none';
      if (onDone) onDone();
    }, 520);
  }

  initSocketMultiplayer();

  // Modalità offline / hotseat: nessun server Socket.io disponibile
  if (!socket) {
    initDefaultPlayersOffline();
  }

  // Controllo automatico parametro URL per PIN rapido (?pin=4821)
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    const welcomePinInput = document.getElementById('welcome-input-pin');
    if (welcomePinInput) welcomePinInput.value = pinFromUrl;
    const qrBadge = document.getElementById('welcome-qr-badge');
    if (qrBadge) qrBadge.style.display = 'block';

    const pinInput = document.getElementById('input-lobby-room-pin');
    if (pinInput) pinInput.value = pinFromUrl;
  }

  // Pre-caricamento nome salvato in localStorage
  const savedName = localStorage.getItem('oca_player_name');
  if (savedName) {
    localPlayerName = savedName;
    const welcomeName = document.getElementById('welcome-input-name');
    if (welcomeName) welcomeName.value = savedName;

    const lobbyName = document.getElementById('input-lobby-player-name');
    if (lobbyName) lobbyName.value = savedName;
    const lobbySaved = document.getElementById('lobby-saved-name');
    if (lobbySaved) lobbySaved.textContent = savedName;
    const lobbyStep1 = document.getElementById('lobby-step1-name');
    if (lobbyStep1) lobbyStep1.style.display = 'none';
    const lobbyStep2 = document.getElementById('lobby-step2-waiting');
    if (lobbyStep2) lobbyStep2.style.display = 'block';
  }

  // --- AZIONI DEL GATEWAY INIZIALE (WELCOME SCREEN) ---

  // 1. Giocatore entra con Nome + PIN
  const welcomeBtnJoin = document.getElementById('welcome-btn-join');
  if (welcomeBtnJoin) {
    welcomeBtnJoin.onclick = () => {
      const name = (document.getElementById('welcome-input-name').value || '').trim();
      const pin = (document.getElementById('welcome-input-pin').value || '').trim();

      if (!name) return alert("Inserisci il tuo nome per partecipare!");
      if (!pin) return alert("Inserisci il PIN a 4 cifre della stanza!");

      localStorage.setItem('oca_player_name', name);
      localPlayerName = name;
      // In multiplayer i giocatori arrivano con room_state_updated:
      // non assumere che PLAYERS[0] esista già.
      if (PLAYERS[0]) {
        PLAYERS[0].name = name;
        renderPlayersHUD();
      }
      updateTurnHUD();
      updatePawnHUDPositions();

      if (socket && socket.connected) {
        socket.emit('player_join_room', { roomId: pin, playerName: name }, (res) => {
          if (res && res.success) {
            currentRoomId = pin;
            dismissWelcomeScreen(() => {
              logEvent(`🎉 Benvenuto ${name}! Ti sei unito alla stanza #${pin}`, 'special');
            });
          } else {
            alert(res ? res.message : "Codice stanza non trovato o non valido!");
          }
        });
      } else {
        // Ingresso in modalità fallback
        currentRoomId = pin;
        dismissWelcomeScreen(() => {
          logEvent(`🍻 ${name} è entrato al tavolo (Stanza #${pin})!`, 'special');
        });
      }
    };
  }

  // 2. Click sul design "Sei un Admin? Crea stanza"
  const welcomeBtnShowAdmin = document.getElementById('welcome-btn-show-admin');
  if (welcomeBtnShowAdmin) {
    welcomeBtnShowAdmin.onclick = () => {
      document.getElementById('welcome-view-player').style.display = 'none';
      document.getElementById('welcome-view-admin').style.display = 'block';
      const passField = document.getElementById('welcome-admin-pass');
      if (passField) passField.focus();
    };
  }

  // 3. Torna indietro da Admin a Giocatore nella schermata iniziale
  const welcomeBtnBackPlayer = document.getElementById('welcome-btn-back-to-player');
  if (welcomeBtnBackPlayer) {
    welcomeBtnBackPlayer.onclick = () => {
      document.getElementById('welcome-view-admin').style.display = 'none';
      document.getElementById('welcome-view-player').style.display = 'block';
    };
  }

  // 4. Admin crea la stanza dalla schermata iniziale
  const welcomeBtnCreateRoom = document.getElementById('welcome-btn-create-room');
  if (welcomeBtnCreateRoom) {
    welcomeBtnCreateRoom.onclick = () => {
      const password = (document.getElementById('welcome-admin-pass').value || '').trim();
      const roomName = (document.getElementById('welcome-admin-room-name').value || '').trim() || "Taverna Goliardica";

      if (!password) return alert("Inserisci la Master Password dell'Admin!");

      if (socket && socket.connected) {
        socket.emit('admin_create_room', { password, roomName }, (res) => {
          if (res && res.success) {
            unlockAdminGodMode(res.adminToken, res.roomId);
            dismissWelcomeScreen(() => {
              showRoomQRCode(res.roomId);
            });
          } else {
            alert(res ? res.message : "Password Admin errata!");
          }
        });
      } else {
        // Fallback locale: password predefinita "oca123"
        if (password === "oca123" || password.length >= 3) {
          const localPin = Math.floor(1000 + Math.random() * 9000).toString();
          unlockAdminGodMode("local_token", localPin);
          dismissWelcomeScreen(() => {
            showRoomQRCode(localPin);
          });
        } else {
          alert("Master Password errata! (Default di prova: oca123)");
        }
      }
    };
  }

  // 5. Modalità Offline / Hotseat sullo stesso dispositivo
  const welcomeBtnOffline = document.getElementById('welcome-btn-offline');
  if (welcomeBtnOffline) {
    welcomeBtnOffline.onclick = () => {
      const name = (document.getElementById('welcome-input-name').value || '').trim() || "Giocatore 1";
      localStorage.setItem('oca_player_name', name);
      localPlayerName = name;
      if (PLAYERS.length === 0) {
        initDefaultPlayersOffline();
      }
      PLAYERS[0].name = name;
      renderPlayersHUD();
      updateTurnHUD();
      updatePawnHUDPositions();
      dismissWelcomeScreen(() => {
        logEvent(`🎲 Tavolo pronto! Modalità locale attiva. Tocca a ${name}.`);
      });
    };
  }

  // --- AZIONI MODAL LOBBY DALL'INTERNO DELLA PARTITA ---

  // Tasto Salva Nome
  document.getElementById('btn-lobby-save-name').onclick = () => {
    const name = document.getElementById('input-lobby-player-name').value.trim();
    if (!name) return alert("Inserisci il tuo nome per partecipare!");
    localStorage.setItem('oca_player_name', name);
    localPlayerName = name;
    document.getElementById('lobby-saved-name').textContent = name;
    document.getElementById('lobby-step1-name').style.display = 'none';
    document.getElementById('lobby-step2-waiting').style.display = 'block';
  };

  // Tasto Cambia Nome
  document.getElementById('btn-lobby-change-name').onclick = () => {
    document.getElementById('lobby-step2-waiting').style.display = 'none';
    document.getElementById('lobby-step1-name').style.display = 'block';
    document.getElementById('input-lobby-player-name').focus();
  };

  // Apertura / Chiusura Modal Lobby
  document.getElementById('btn-open-lobby').onclick = () => {
    document.getElementById('modal-lobby').classList.add('visible');
  };
  document.getElementById('btn-close-lobby').onclick = () => {
    document.getElementById('modal-lobby').classList.remove('visible');
  };

  // Switch tra vista Giocatore e vista Admin Password
  document.getElementById('btn-lobby-switch-admin').onclick = () => {
    document.getElementById('lobby-step1-name').style.display = 'none';
    document.getElementById('lobby-step2-waiting').style.display = 'none';
    document.getElementById('lobby-admin-link-box').style.display = 'none';
    document.getElementById('lobby-view-admin').style.display = 'block';
    document.getElementById('lobby-title').textContent = "Regia Host della Serata";
    document.getElementById('lobby-subtitle').textContent = "Inserisci la Master Password per creare la stanza e sbloccare i poteri di regia!";
  };

  document.getElementById('btn-admin-cancel').onclick = () => {
    document.getElementById('lobby-view-admin').style.display = 'none';
    document.getElementById('lobby-admin-link-box').style.display = 'block';
    document.getElementById('lobby-title').textContent = "Unisciti alla Partita";
    document.getElementById('lobby-subtitle').textContent = "Inserisci il tuo nome per partecipare dal tuo smartphone!";
    if (localPlayerName) {
      document.getElementById('lobby-step2-waiting').style.display = 'block';
    } else {
      document.getElementById('lobby-step1-name').style.display = 'block';
    }
  };

  // Creazione Stanza Admin con Master Password
  document.getElementById('btn-admin-submit-create').onclick = () => {
    const password = document.getElementById('input-admin-password').value.trim();
    const roomName = document.getElementById('input-admin-room-name').value.trim() || "Taverna Goliardica";

    if (!password) return alert("Inserisci la Master Password dell'Admin!");

    if (socket && socket.connected) {
      socket.emit('admin_create_room', { password, roomName }, (res) => {
        if (res.success) {
          unlockAdminGodMode(res.adminToken, res.roomId);
          document.getElementById('modal-lobby').classList.remove('visible');
          showRoomQRCode(res.roomId);
        } else {
          alert(res.message || "Password Admin errata!");
        }
      });
    } else {
      // Fallback locale: password predefinita "oca123"
      if (password === "oca123" || password.length >= 3) {
        const localPin = Math.floor(1000 + Math.random() * 9000).toString();
        unlockAdminGodMode("local_token", localPin);
        document.getElementById('modal-lobby').classList.remove('visible');
        showRoomQRCode(localPin);
        alert(`👑 Modalità Admin Sbloccata in Locale!\nPIN Stanza generato: ${localPin}`);
      } else {
        alert("Master Password errata! (Default di test: oca123)");
      }
    }
  };

  // Ingresso Giocatore con PIN
  document.getElementById('btn-lobby-join-room').onclick = () => {
    const pin = document.getElementById('input-lobby-room-pin').value.trim();
    const name = localPlayerName || document.getElementById('input-lobby-player-name').value.trim();

    if (!name) return alert("Inserisci prima il tuo nome!");
    if (!pin) return alert("Inserisci il PIN a 4 cifre della stanza!");

    if (socket && socket.connected) {
      socket.emit('player_join_room', { roomId: pin, playerName: name }, (res) => {
        if (res.success) {
          currentRoomId = pin;
          document.getElementById('modal-lobby').classList.remove('visible');
          logEvent(`🎉 Benvenuto ${name}! Ti sei unito alla stanza #${pin}`, 'special');
        } else {
          alert(res.message || "Codice stanza non valido!");
        }
      });
    } else {
      // Ingresso locale
      document.getElementById('modal-lobby').classList.remove('visible');
      logEvent(`🍻 ${name} è entrato al tavolo! Pronti al lancio dei dadi.`);
    }
  };

  // Bottoni della Barra Regia Admin (God Mode)
  document.getElementById('btn-admin-waterfall').onclick = () => {
    if (socket && socket.connected && currentRoomId) {
      socket.emit('admin_god_action', { roomId: currentRoomId, adminToken, action: 'FORCE_CASCADE' });
    }
    document.getElementById('btn-trigger-waterfall').click();
  };

  document.getElementById('btn-admin-shot').onclick = () => {
    document.getElementById('btn-trigger-shot').click();
  };

  document.getElementById('btn-admin-truth').onclick = () => {
    document.getElementById('btn-trigger-truth').click();
  };

  document.getElementById('btn-admin-reset').onclick = () => {
    if (confirm("👑 ADMIN: Vuoi davvero azzerare tutte le posizioni dei partecipanti alla partenza?")) {
      if (socket && socket.connected && currentRoomId) {
        socket.emit('admin_god_action', { roomId: currentRoomId, adminToken, action: 'RESET_GAME' });
      }
      restartGame();
    }
  };

  document.getElementById('btn-admin-qr-open').onclick = () => {
    if (currentRoomId) showRoomQRCode(currentRoomId);
    else showRoomQRCode("4821");
  };

  // Teletrasporto Admin
  document.getElementById('btn-admin-teleport-open').onclick = () => {
    const selectPlayer = document.getElementById('select-teleport-player');
    if (selectPlayer) {
      selectPlayer.innerHTML = PLAYERS.map((p, idx) => 
        `<option value="${idx}">🦆 ${p.name} - Casella #${p.position} (🍺${p.sips} 🥃${p.shots})</option>`
      ).join('');
    }
    document.getElementById('modal-teleport').classList.add('visible');
  };
  document.getElementById('btn-close-teleport').onclick = () => {
    document.getElementById('modal-teleport').classList.remove('visible');
  };
  document.getElementById('btn-close-qr').onclick = () => {
    document.getElementById('modal-qr').classList.remove('visible');
  };

  document.getElementById('btn-execute-teleport').onclick = () => {
    const targetPawnIdx = parseInt(document.getElementById('select-teleport-player').value);
    const destTileId = parseInt(document.getElementById('select-teleport-destination').value);
    const targetPlayer = PLAYERS[targetPawnIdx];

    document.getElementById('modal-teleport').classList.remove('visible');

    if (socket && socket.connected && currentRoomId) {
      socket.emit('admin_god_action', {
        roomId: currentRoomId,
        adminToken,
        action: 'TELEPORT',
        targetPlayerIndex: targetPawnIdx,
        newPosition: destTileId
      });
    }

    logEvent(`⚡ [ADMIN] Teletrasporto forzato: ${targetPlayer.name} è stato fiondato sulla Casella #${destTileId}!`, 'special');
    playSound('fanfare');
    movePawnSequence(targetPlayer, destTileId, () => {
      evaluateLandedTile(targetPlayer, 0);
    });
  };

  document.getElementById('cam-btn-iso').onclick = () => setCameraView('iso');
  document.getElementById('cam-btn-top').onclick = () => setCameraView('top');
  document.getElementById('cam-btn-pawn').onclick = () => setCameraView('pawn');

  document.getElementById('btn-sound-toggle').onclick = () => {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-toggle-icon').textContent = soundEnabled ? '🔊 Suono: ON' : '🔇 Suono: OFF';
  };

  document.getElementById('btn-rules-modal').onclick = () => {
    document.getElementById('modal-rules').classList.add('visible');
  };
  document.getElementById('btn-close-rules').onclick = () => {
    document.getElementById('modal-rules').classList.remove('visible');
  };

  // Barra Spaziatrice per tirare i dadi
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isMovingPawn && !isRollingDice) {
      e.preventDefault();
      triggerRollTurn();
    }
  });

  // ============================================================================
  // MOBILE UI: FAB ADMIN, BOTTOM SHEET, DRAWER GIOCATORI, TICKER EVENTI
  // ============================================================================
  initMobileUI();
});

/**
 * ============================================================================
 * MOBILE UI: Gestione FAB Admin, Bottom Sheet, Drawer Giocatori, Event Ticker
 * Attivo solo su schermi < 860px. Su desktop non ha effetto.
 * ============================================================================
 */
function initMobileUI() {
  // --- Trigger camera iniziale per mobile ---
  onWindowResize();

  // --- FAB ADMIN MOBILE ---
  const adminFab = document.getElementById('admin-fab-mobile');
  const adminSheet = document.getElementById('admin-sheet-mobile');
  const adminSheetBackdrop = document.getElementById('admin-sheet-backdrop');

  if (adminFab) {
    adminFab.onclick = () => {
      if (adminSheet) adminSheet.classList.add('open');
    };
  }

  if (adminSheetBackdrop) {
    adminSheetBackdrop.onclick = () => {
      if (adminSheet) adminSheet.classList.remove('open');
    };
  }

  // Mobile Admin Sheet buttons: wire to desktop equivalents
  const mobileAdminMap = {
    'mob-admin-waterfall': 'btn-admin-waterfall',
    'mob-admin-shot': 'btn-admin-shot',
    'mob-admin-truth': 'btn-admin-truth',
    'mob-admin-teleport': 'btn-admin-teleport-open',
    'mob-admin-reset': 'btn-admin-reset',
    'mob-admin-qr': 'btn-admin-qr-open'
  };

  Object.entries(mobileAdminMap).forEach(([mobId, desktopId]) => {
    const mobBtn = document.getElementById(mobId);
    const deskBtn = document.getElementById(desktopId);
    if (mobBtn && deskBtn) {
      mobBtn.onclick = () => {
        if (adminSheet) adminSheet.classList.remove('open');
        setTimeout(() => deskBtn.click(), 150);
      };
    }
  });

  // --- DRAWER GIOCATORI MOBILE ---
  const playersDrawer = document.getElementById('mobile-players-drawer');
  const drawerBackdrop = document.getElementById('mobile-drawer-backdrop');

  if (drawerBackdrop) {
    drawerBackdrop.onclick = () => {
      if (playersDrawer) playersDrawer.classList.remove('open');
    };
  }

  // Add tap-to-open on mobile top banner brand section
  const brandSection = document.querySelector('.brand-section');
  if (brandSection) {
    brandSection.style.cursor = 'pointer';
    brandSection.onclick = () => {
      if (window.innerWidth <= 860) {
        updateMobilePlayersDrawer();
        if (playersDrawer) playersDrawer.classList.add('open');
      }
    };
  }

  // --- EVENT TICKER MOBILE ---
  const ticker = document.getElementById('mobile-event-ticker');
  if (ticker) {
    ticker.onclick = () => {
      ticker.classList.toggle('expanded');
      if (ticker.classList.contains('expanded')) {
        // Popola con tutti gli eventi dal feed
        const feedEl = document.getElementById('event-feed-list');
        if (feedEl) {
          ticker.innerHTML = feedEl.innerHTML || '<em>Nessun evento ancora.</em>';
        }
      } else {
        // Torna al ticker riga singola
        const tickerText = document.getElementById('mobile-ticker-text');
        if (!tickerText) {
          const feedEl = document.getElementById('event-feed-list');
          const lastEvent = feedEl ? feedEl.lastElementChild : null;
          ticker.textContent = lastEvent ? lastEvent.textContent : 'Benvenuti al Gioco dell\'Oca 3D!';
        }
      }
    };
  }
}

/**
 * Aggiorna il drawer mobile con lo stato attuale dei giocatori
 */
function updateMobilePlayersDrawer() {
  const listEl = document.getElementById('mobile-drawer-players-list');
  if (!listEl) return;

  const pawnColors = ['var(--pawn-red)', 'var(--pawn-yellow)', 'var(--pawn-green)', 'var(--pawn-blue)'];

  listEl.innerHTML = PLAYERS.map((p, idx) => {
    const isTurn = idx === currentPlayerIdx;
    return `
      <div class="mobile-drawer-player-row ${isTurn ? 'is-turn' : ''}">
        <div class="mobile-drawer-pawn-dot" style="background: ${pawnColors[idx]};"></div>
        <div class="mobile-drawer-player-name">
          ${isTurn ? '🎲 ' : ''}${p.name}
        </div>
        <div class="mobile-drawer-player-info">
          #${p.position} • 🍺${p.sips} 🥃${p.shots}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Aggiorna il ticker mobile con l'ultimo evento
 */
function updateMobileEventTicker(text) {
  const ticker = document.getElementById('mobile-event-ticker');
  if (!ticker || ticker.classList.contains('expanded')) return;
  ticker.textContent = text;
}

/**
 * Mostra il FAB Admin Mobile quando l'admin si autentica
 */
function showMobileAdminFab() {
  if (window.innerWidth <= 860) {
    const fab = document.getElementById('admin-fab-mobile');
    if (fab) fab.style.display = 'flex';
  }
}

/**
 * ============================================================================
 * MODALITA' HOST & REGIA ADMIN (GOD MODE)
 * ============================================================================
 */
function unlockAdminGodMode(token, roomId) {
  adminToken = token;
  currentRoomId = roomId;

  const godBar = document.getElementById('admin-god-bar');
  if (godBar) {
    godBar.style.display = 'flex';
  }

  // Aggiorna elenco giocatori per il teletrasporto
  const selectPlayer = document.getElementById('select-teleport-player');
  if (selectPlayer) {
    selectPlayer.innerHTML = PLAYERS.map((p, idx) => 
      `<option value="${idx}">🦆 ${p.name} - Casella #${p.position} (🍺${p.sips} 🥃${p.shots})</option>`
    ).join('');
  }

  logEvent(`👑 POTERI DELL'ADMIN ATTIVATI! Stanza PIN: ${roomId}. Regia dell'Host sbloccata in basso!`, 'special');
  playSound('fanfare');
}

/**
 * MOSTRA IL MODAL QR CODE CON IL PIN STANZA
 */
function showRoomQRCode(pin) {
  const modalQr = document.getElementById('modal-qr');
  const qrPinText = document.getElementById('qr-pin-text');
  const canvas = document.getElementById('qr-canvas-element');

  if (qrPinText) qrPinText.textContent = pin;

  // Mostra anche il pulsante rapido PIN nell'HUD superiore
  const btnShowRoomQr = document.getElementById('btn-show-room-qr');
  const currentRoomPin = document.getElementById('current-room-pin');
  if (btnShowRoomQr && currentRoomPin) {
    currentRoomPin.textContent = pin;
    btnShowRoomQr.style.display = 'inline-flex';
    btnShowRoomQr.onclick = () => showRoomQRCode(pin);
  }

  // Costruzione URL con parametro PIN
  let joinUrl = window.location.href.split('?')[0];
  if (joinUrl.startsWith('file:')) {
    joinUrl = `http://localhost:3000/?pin=${encodeURIComponent(pin)}`;
  } else {
    joinUrl = `${window.location.origin}${window.location.pathname}?pin=${encodeURIComponent(pin)}`;
  }

  if (typeof QRCode !== 'undefined' && canvas) {
    QRCode.toCanvas(canvas, joinUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#2c1809',
        light: '#fbf5e8'
      }
    }, function (error) {
      if (error) console.error("Errore generazione QR Code:", error);
    });
  }

  if (modalQr) {
    modalQr.classList.add('visible');
  }
}

/**
 * Renderizza la faccia di un dado su un elemento del DOM usando caratteri Unicode standard.
 * Valori accettati: 1..6.
 */
function renderDiceDots(element, value) {
  if (!element) return;
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const idx = Math.max(1, Math.min(6, parseInt(value, 10) || 1)) - 1;
  element.textContent = faces[idx];
}

/**
 * Sposta la pedina 3D di un giocatore sulla casella indicata (senza animazione).
 * Usato per sincronizzare le posizioni ricevute dal server.
 */
function updatePawn3DPosition(player) {
  const idx = PLAYERS.findIndex(p => p.id === player.id);
  if (idx === -1) return;
  const tile = TILE_DATA[player.position] || TILE_DATA[0];
  placePawnOnTile(idx, player.position, false);
}

/**
 * Costruisce dinamicamente le pill dei giocatori nell'HUD superiore in base a PLAYERS.
 * Supporta qualsiasi numero di giocatori (fino al limite del server, es. 12).
 */
function renderPlayersHUD() {
  const rack = document.getElementById('players-hud-rack');
  if (!rack) return;
  rack.innerHTML = '';
  PLAYERS.forEach((p, idx) => {
    const isCurrent = (idx === currentPlayerIdx);
    const pill = document.createElement('div');
    pill.className = `player-token-pill ${isCurrent ? 'active' : ''}`;
    pill.id = `player-pill-${idx}`;
    pill.innerHTML = `
      <span class="pawn-dot ${p.cssClass}"></span>
      <span>${p.name}</span>
      <span class="tile-badge" id="pawn-pos-badge-${idx}">#${p.position}</span>
      <span class="drink-tally-badge" id="pawn-drink-badge-${idx}" title="Sorsi e Shot bevuti">🍺${p.sips} 🥃${p.shots}</span>
    `;
    rack.appendChild(pill);
  });
}

/**
 * INIZIALIZZAZIONE SOCKET.IO MULTIPLAYER REAL-TIME
 */
function initSocketMultiplayer() {
  if (typeof io === 'undefined') {
    console.log("Socket.io client non caricato: modalità Hotseat locale attiva.");
    return;
  }

  if (window.location.protocol === 'file:') {
    console.log("File aperto in locale: modalità Hotseat attiva.");
    return;
  }

  try {
    socket = io();

    socket.on('connect', () => {
      console.log("Connesso al server Socket.io con ID:", socket.id);
      const savedRoomId = sessionStorage.getItem('oca_room_id');
      const savedToken = sessionStorage.getItem('oca_session_token');
      if (savedRoomId && savedToken) {
        socket.emit('player_reconnect', { roomId: savedRoomId, sessionToken: savedToken }, (res) => {
          if (res && res.success) {
            currentRoomId = savedRoomId;
            logEvent(`🔄 Bentornato al tavolo! Sessione ripristinata (Stanza #${savedRoomId}).`);
          }
        });
      }
    });

    socket.on('disconnect', () => {
      console.log("Disconnesso dal server.");
    });

    socket.on('room_state_updated', (room) => {
      if (!room) return;
      currentRoomId = room.id;

      if (room.players && room.players.length > 0) {
        const isFirstLoad = PLAYERS.length === 0;

        room.players.forEach((rp, idx) => {
          const colorCfg = getPlayerColor(idx);
          if (isFirstLoad) {
            PLAYERS.push({
              id: rp.id,
              sessionToken: rp.sessionToken,
              name: rp.name,
              position: rp.position,
              skipTurns: rp.missTurns || 0,
              trapped: false,
              isFirstTurn: true,
              sips: 0,
              shots: 0,
              partnerId: null,
              hex: colorCfg.hex,
              color: colorCfg.color,
              cssClass: colorCfg.cssClass
            });
          } else {
            const existing = PLAYERS[idx];
            if (existing) {
              existing.name = rp.name;
              existing.position = rp.position;
              existing.skipTurns = rp.missTurns || 0;
            }
          }
        });

        // Ricrea pedine 3D e HUD solo al primo caricamento dello stato stanza
        if (isFirstLoad) {
          create3DGeesePawns();
          renderPlayersHUD();
        } else {
          // Aggiorna pedine 3D già esistenti (riconnesione / sincronizzazione posizione)
          room.players.forEach((rp, idx) => {
            if (PLAYERS[idx] && !isMovingPawn && Math.abs(PLAYERS[idx].position - rp.position) > 0) {
              updatePawn3DPosition(PLAYERS[idx]);
            }
          });
          updatePawnHUDPositions();
        }

        // Tieni l'indice di turno coerente con il numero di giocatori attuali
        if (currentPlayerIdx >= PLAYERS.length) {
          currentPlayerIdx = Math.max(0, PLAYERS.length - 1);
        }
        updateTurnHUD();
      }
    });

    socket.on('admin_broadcast_alert', (msg) => {
      logEvent(`👑 [HOST]: ${msg}`, 'special');
      alert(`👑 NOTIFICA DELL'HOST:\n\n${msg}`);
    });

    socket.on('admin_cascade_drink', (data) => {
      playSound('gulp');
      openDrinkingModal(PLAYERS[currentPlayerIdx], {
        cat: "waterfall",
        icon: "🌊",
        title: "CASCATA SCATENATA DALL'ADMIN!",
        desc: data.message || "TUTTI BEVONO INSIEME! L'ultimo che abbassa il bicchiere prende uno shot extra!",
        sips: 3,
        shots: 0
      });
      logEvent("🌊 L'Admin ha scatenato la Cascata Generale! Tutti i presenti bevono!", "special");
    });

    socket.on('admin_custom_challenge_drop', (data) => {
      playSound('fanfare');
      openDrinkingModal(PLAYERS[currentPlayerIdx], {
        cat: "dare",
        icon: "📜",
        title: "DECRETO DELL'HOST DELLA SERATA",
        desc: data.message || "Nuovo ordine dell'Host!",
        sips: 2,
        shots: 0
      });
    });

    socket.on('dice_rolled', (data) => {
      if (data.playerId !== socket.id) {
        logEvent(`🎲 ${data.playerName} ha tirato ${data.rollValue}!`, 'roll');
        const p = PLAYERS.find(pl => pl.name === data.playerName) || PLAYERS[currentPlayerIdx];
        if (p) {
          p.currentRoll = data.rollValue;
          renderDiceDots(document.getElementById('dice-face-1'), Math.ceil(data.rollValue / 2));
          renderDiceDots(document.getElementById('dice-face-2'), Math.floor(data.rollValue / 2) || 1);
          movePawnSequence(p, data.newPosition, () => {
            evaluateLandedTile(p, data.rollValue);
          });
        }
      }
    });

    socket.on('player_won', (data) => {
      playSound('fanfare');
      triggerCelebration();
      const winnerName = data.winner ? data.winner.name : "Campione";
      alert(`🏆 GLORIA ETERNA!\n${winnerName} ha conquistato il Castello ed è il Sovrano Indiscusso della serata! 👑🍻`);
    });

  } catch (err) {
    console.warn("Impossibile connettersi al server Socket:", err);
  }
}
