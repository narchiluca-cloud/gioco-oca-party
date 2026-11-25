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
let boardGroup, scenicsGroup, tilesGroup, pawnsGroup, diceGroup, tavernGroup, goblinsGroup;
let isMovingPawn = false;
let isRollingDice = false;

// --- EFFETTI VISIVI TEMPORANEI & LUCI DINAMICHE ---
// La PointLight del camino viene animata nel render loop; gli effetti
// particellari sono gestiti in un array e liberati appena terminano.
let fireplaceLight = null;
// Intensità di riposo del focolare: la modulazione avviene una sola volta per frame.
const FIREPLACE_BASE_INTENSITY = 2.0;
let fireplaceFlicker = 1; // random-walk liscio per i guizzi irregolari
let lastFrameMs = performance.now();
const TRANSIENT_EFFECTS = [];
const EMBER_SYSTEMS = []; // scintille delle torce e del focolare (un solo Points per sistema)
let sparkleTexture = null;

// Posizione del camino: il focolare è sulla parete di fondo dell'ostello.
// Una sola costante, usata sia dalla luce sia dalla costruzione scenografica.
const HEARTH_POS = { x: -48, y: 8, z: -99 };

// Tracciato delle 64 posizioni 3D (Casella 0 = Molo Partenza, 1..63)
const TILE_DATA = [];
const TILE_MESHES = [];
const PAWN_MESHES = [];
const GOBLIN_AVATARS = []; // avatar sociali nella taverna, allineati a PLAYERS

// Il tavolo è sollevato da terra: tutti gli oggetti sopra il piano si alzano
// insieme ai loro gruppi, mentre gambe e ostello restano a livello pavimento.
const TABLE_RAISE = 4.5;

// --- TAVERNA SOCIALE: costanti uguali a quelle validate dal server ---
const AVATAR_BOUNDS = { minX: -128, maxX: 128, minZ: -106, maxZ: 106 };
const AVATAR_OBSTACLES = [
  { minX: -82, maxX: 82, minZ: -62, maxZ: 62 },
  { minX: 26, maxX: 98, minZ: -100, maxZ: -84 },
  { minX: -118, maxX: -100, minZ: -78, maxZ: -62 },
  { minX: 102, maxX: 118, minZ: -76, maxZ: -60 },
  { minX: -110, maxX: -82, minZ: 34, maxZ: 44 },
  { minX: 82, maxX: 110, minZ: 34, maxZ: 44 }
];
const AVATAR_SPOTS = [
  { id: 'bar', x: 62, z: -79, radius: 9, label: 'al bancone', verb: 'Ordina un drink' },
  { id: 'chair-left', x: -96, z: 28, radius: 8, label: 'alla panchina', verb: 'Sediti e bevi' },
  { id: 'chair-right', x: 96, z: 28, radius: 8, label: 'alla panchina', verb: 'Sediti e bevi' },
  { id: 'fireplace', x: -48, z: -88, radius: 9, label: 'al camino', verb: 'Riscaldati con un drink' },
  { id: 'table', x: 0, z: 72, radius: 10, label: 'al tavolo', verb: 'Brinda con la tavolata' }
];
const DEFAULT_AVATAR_SEATS = [
  { x: -96, z: -20 }, { x: -96, z: 20 },
  { x: 96, z: -20 }, { x: 96, z: 20 },
  { x: -50, z: 72 }, { x: 50, z: 72 },
  { x: 0, z: 78 }, { x: -40, z: -70 },
  { x: 40, z: -70 }, { x: 0, z: -76 },
  { x: -100, z: 52 }, { x: 100, z: 52 }
];

const AVATAR_KEYS = { up: false, down: false, left: false, right: false };
const AVATAR_JOY = { active: false, x: 0, y: 0 };
const AVATAR_TMP_TARGET = new THREE.Vector3();
const AVATAR_TMP_DELTA = new THREE.Vector3();
const AVATAR_TMP_CAMDIR = new THREE.Vector3();
const AVATAR_TMP_FORWARD = new THREE.Vector3();
const AVATAR_TMP_RIGHT = new THREE.Vector3();
const AVATAR_TMP_MOVE = new THREE.Vector3();
const AVATAR_UP = new THREE.Vector3(0, 1, 0);
let roamMode = false;
let boardCameraSnapshot = null;
let lastAvatarSendMs = 0;
let goblinShared = null;

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
  // I browser tengono l'AudioContext sospeso finché non arriva un gesto utente:
  // il resume evita il primo effetto "muto" dopo il click sul pulsante.
  if (audioCtx.state === 'suspended') audioCtx.resume();
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
  } else if (type === 'trap') {
    // Colpo grave e discendente per le caselle trappola (Pozzo, Prigione, Scheletro).
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + 0.5);
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
  // Nebbia più leggera: le pareti dell'ostello si intravedono senza nascondere il tabellone.
  scene.fog = new THREE.FogExp2(0x130a06, 0.0065);

  // Telecamera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  // Vista isometrica alta, ricalibrata sul tavolo sollevato.
  camera.position.set(0, 52 + TABLE_RAISE * 0.4, 62);

  // Renderer con ombre soffuse e ACES Tonemapping
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Su mobile limitiamo il pixel ratio: più fluidità, meno calore sulla GPU.
  const maxPixelRatio = window.innerWidth < 860 ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // ombre morbide, niente scalettature
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  container.appendChild(renderer.domElement);

  // Riflessi PBR artigianali: environment map procedurale filtrata in PMREM.
  // Una sola generazione all'avvio: nessun costo per frame, zero asset esterni.
  scene.environment = createEnvironmentMap();

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.15; // Non scendere sotto il tavolo
  controls.minDistance = 25;
  // La camera resta dentro le pareti dell'ostello: nessun muro può coprire il tavolo.
  controls.maxDistance = 104;
  controls.target.set(0, TABLE_RAISE * 0.65, 0);

  // Luci della Taverna
  setupLighting();

  // Gruppi di Oggetti
  boardGroup = new THREE.Group();
  scenicsGroup = new THREE.Group();
  tilesGroup = new THREE.Group();
  pawnsGroup = new THREE.Group();
  diceGroup = new THREE.Group();
  tavernGroup = new THREE.Group();
  goblinsGroup = new THREE.Group();

  scene.add(tavernGroup);
  scene.add(boardGroup);
  scene.add(scenicsGroup);
  scene.add(tilesGroup);
  scene.add(pawnsGroup);
  scene.add(diceGroup);
  scene.add(goblinsGroup);

  // Costruzione Procedurale del Mondo 3D
  createRusticTableAndBoard();
  calculateSpiralCoordinates();
  createSpiralTilesMeshes();
  createScenicsCastle();
  createScenicsBridge();
  createScenicsVillage();
  createTavernSurroundings();
  createTableTorches();
  create3DGeesePawns();
  create3DDice();

  // Solleva di colpo tutto ciò che sta sopra il piano: tavolo, tessere,
  // miniature, dadi e scenografie del tabellone. Le gambe restano a terra.
  [boardGroup, scenicsGroup, tilesGroup, pawnsGroup, diceGroup].forEach(g => {
    if (g) g.position.y = TABLE_RAISE;
  });

  // Resize Handler
  window.addEventListener('resize', onWindowResize);

  // Loop Render
  animate();
}

// ============================================================================
// LUCI DELLA TAVERNA — solo fuoco: niente luce fredda dall'alto.
// ----------------------------------------------------------------------------
// La vecchia direzionale zenitale colpiva il piano di taglio e, sommata ad
// ambient+hemi+fill, portava l'illuminazione a ~2.5x l'albedo: legno e prato
// viravano al bianco slavato. Ora illuminano 4 torce ai bordi del tavolo
// (SpotLight con ombre) + il focolare: luce radente, calda, con chiaroscuro vero.
// ============================================================================
function setupLighting() {
  // Fill minimo per non lasciare nero assoluto le zone d'ombra (caldo, non azzurro).
  const ambientLight = new THREE.AmbientLight(0xffd9ad, 0.15);
  scene.add(ambientLight);
  const hemiLight = new THREE.HemisphereLight(0xd9c3a6, 0x1d0f07, 0.10);
  scene.add(hemiLight);

  // Focolare della taverna: bagliore d'angolo, animato in animate().
  // Niente shadow map: una PointLight con ombre costa 6 render pass.
  fireplaceLight = new THREE.PointLight(0xff7a2f, FIREPLACE_BASE_INTENSITY, 100, 1.5);
  fireplaceLight.position.set(HEARTH_POS.x, HEARTH_POS.y, HEARTH_POS.z);
  fireplaceLight.castShadow = false;
  scene.add(fireplaceLight);
}

// ============================================================================
// QUATTRO TORCE AI BORDI DEL TAVOLO (luce principale, tema taverna)
// ============================================================================
const TORCHES = [];

// Posizione della torcia + punto del tabellone che illumina (il suo quadrante).
const TORCH_LAYOUT = [
  { x: -46, z: -34, aimX: -17, aimZ: -11 },
  { x: 46, z: -34, aimX: 17, aimZ: -11 },
  { x: -46, z: 34, aimX: -17, aimZ: 11 },
  { x: 46, z: 34, aimX: 17, aimZ: 11 }
];

function createTableTorches() {
  const TABLE_TOP_Y = -0.1 + TABLE_RAISE; // piano del tavolo sollevato
  const FLAME_Y = 14.6;     // altezza della fiamma sopra il piano
  // Su mobile shadow map più piccole: 4 torce = 4 passaggi di profondità per frame.
  const shadowSize = window.innerWidth < 860 ? 512 : 1024;

  TORCHES.length = 0;

  // Materiali e geometrie condivisi: 4 torce, una sola allocazione per tipo.
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a231f, roughness: 0.5, metalness: 0.62, envMapIntensity: 0.9 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a2a13, roughness: 0.86, metalness: 0.02 });
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x2a1206, emissive: 0xff5a12, emissiveIntensity: 0.85, roughness: 0.95 });
  const glowTexture = getSparkleTexture();

  // Proporzioni da torcia da taverna: fusto massiccio, braciere largo, fiamma alta.
  const baseGeo = new THREE.CylinderGeometry(1.15, 1.55, 0.55, 10);
  const poleGeo = new THREE.CylinderGeometry(0.44, 0.58, 11.0, 8);
  const ringGeo = new THREE.TorusGeometry(0.62, 0.1, 5, 12);
  const cupGeo = new THREE.CylinderGeometry(1.9, 0.75, 1.7, 10);
  const coalGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 10);
  const rimGeo = new THREE.TorusGeometry(1.9, 0.14, 5, 14);
  const braceGeo = new THREE.BoxGeometry(0.22, 3.4, 0.22);
  const flameGeo = new THREE.ConeGeometry(1.0, 3.4, 8);
  const coreGeo = new THREE.ConeGeometry(0.5, 2.1, 8);

  TORCH_LAYOUT.forEach((cfg, idx) => {
    const torchGroup = new THREE.Group();
    torchGroup.position.set(cfg.x, TABLE_TOP_Y, cfg.z);

    // 1. Piastra e fusto in ferro battuto
    const base = new THREE.Mesh(baseGeo, ironMat);
    base.position.y = 0.27;
    base.castShadow = true;
    base.receiveShadow = true;
    torchGroup.add(base);

    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 6.05;
    pole.castShadow = true;
    torchGroup.add(pole);

    // 2. Anelli di rinforzo
    [3.2, 8.6].forEach((ry) => {
      const ring = new THREE.Mesh(ringGeo, ironMat);
      ring.position.y = ry;
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      torchGroup.add(ring);
    });

    // 3. Braciere e braci
    const cup = new THREE.Mesh(cupGeo, ironMat);
    cup.position.y = 12.4;
    cup.castShadow = true;
    torchGroup.add(cup);

    const coals = new THREE.Mesh(coalGeo, coalMat);
    coals.position.y = 12.75;
    torchGroup.add(coals);

    // Bordo del braciere e tiranti diagonali: la torcia sembra costruita,
    // non un semplice cono che fluttua sopra un bastone.
    const rim = new THREE.Mesh(rimGeo, ironMat);
    rim.position.y = 13.25;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    torchGroup.add(rim);
    [-1, 1].forEach(side => {
      const brace = new THREE.Mesh(braceGeo, ironMat);
      brace.position.set(side * 0.95, 11.1, 0);
      brace.rotation.z = side * 0.5;
      torchGroup.add(brace);
    });

    // 4. Fiamma: cono incandescente + nucleo chiaro. Materiali additivi:
    //    la luce vera è la SpotLight qui sotto, questi sono solo apparenza.
    const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({
      color: 0xff8a2a, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    flame.position.y = 15.1;
    torchGroup.add(flame);

    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    core.position.y = 14.75;
    torchGroup.add(core);

    // 5. Alone caldo: sprite additivo (1 draw call), non una luce.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xffa64d, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.position.y = FLAME_Y;
    glow.scale.set(18, 18, 1);
    torchGroup.add(glow);

    scenicsGroup.add(torchGroup);

    // 6. La luce: SpotLight dal braciere verso il quadrante del tabellone.
    //    Cono ampio + penombra morbida = pozza calda, non un riflettore duro.
    // Intensità bassa + caduta marcata (decay 2): con 4 coni sovrapposti la somma
    // al centro resta ~1x l'albedo, mentre ai bordi ogni torcia crea la sua pozza.
    const light = new THREE.SpotLight(0xffa14d, 0.95, 160, 1.05, 0.6, 1.9);
    light.position.set(cfg.x, TABLE_TOP_Y + FLAME_Y, cfg.z);
    light.target.position.set(cfg.aimX, 1.6 + TABLE_RAISE, cfg.aimZ);
    light.castShadow = true;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.camera.near = 4;
    light.shadow.camera.far = 150;
    light.shadow.bias = -0.0009;
    light.shadow.normalBias = 0.04;
    scene.add(light);
    scene.add(light.target);

    TORCHES.push({
      light,
      flame,
      core,
      glow,
      baseIntensity: light.intensity,
      baseX: light.position.x,
      baseZ: light.position.z,
      phase: idx * 1.9 + 0.4,
      flicker: 1
    });
  });

  // Scintille che salgono dai quattro braceri: un solo Points per tutte.
  createEmberSystem(
    TORCH_LAYOUT.map(cfg => ({ x: cfg.x, y: 14.5, z: cfg.z })),
    10, 0xffb257, 0.55
  );
}

/**
 * Animazione delle torce: intensità, posizione della luce e fiamma.
 * Sinusoidi + random-walk smorzato per ogni torcia: guizzi irregolari ma
 * nessuna allocazione per frame (importante per il garbage collector).
 */
function updateTorches(time) {
  for (let i = 0; i < TORCHES.length; i++) {
    const t = TORCHES[i];
    t.flicker += (Math.random() - 0.5) * 0.07;
    t.flicker = THREE.MathUtils.lerp(t.flicker, 1, 0.09);

    const wave = 1
      + Math.sin(time * 9.1 + t.phase) * 0.09
      + Math.sin(time * 21.7 + t.phase * 2.3) * 0.045;
    const energy = Math.max(0.62, wave * t.flicker);

    t.light.intensity = t.baseIntensity * energy;
    // Micro-spostamento della sorgente: le ombre respirano con la fiamma.
    t.light.position.x = t.baseX + Math.sin(time * 4.7 + t.phase) * 0.3;
    t.light.position.z = t.baseZ + Math.cos(time * 3.9 + t.phase * 1.3) * 0.3;

    const stretch = 0.92 + energy * 0.2;
    const width = 0.95 + (energy - 1) * 0.25;
    t.flame.scale.set(width, stretch, width);
    t.flame.rotation.y = Math.sin(time * 2.8 + t.phase) * 0.35;
    // Il colore della fiamma segue l'energia: più caldo nei guizzi, più rosso
    // quando la fiamma si abbassa. setHSL non alloca oggetti.
    t.flame.material.color.setHSL(0.055 + (energy - 1) * 0.008, 1, 0.54 + Math.min(0.1, (energy - 1) * 0.16));
    t.core.scale.setScalar(0.9 + energy * 0.12);

    t.glow.material.opacity = 0.28 + Math.max(0, energy - 0.75) * 0.34;
    const glowSize = 17 + energy * 3.2;
    t.glow.scale.set(glowSize, glowSize, 1);
  }
}

/**
 * Costruisce una environment map equirettangolare procedurale (travi scure,
 * pareti calde, finestra fredda e bagliore del focolare) e la filtra in PMREM.
 * Serve a dare riflessi credibili ai materiali PBR — legno laccato delle pedine,
 * dadi in avorio, noce lucidato del tabellone — senza HDRI esterni.
 */
function createEnvironmentMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const walls = ctx.createLinearGradient(0, 0, 0, 128);
  walls.addColorStop(0, '#2a1709');   // travi del soffitto
  walls.addColorStop(0.42, '#7b5533');
  walls.addColorStop(0.6, '#c2986a'); // pareti scaldate dalle candele
  walls.addColorStop(1, '#1d1008');   // pavimento in ombra
  ctx.fillStyle = walls;
  ctx.fillRect(0, 0, 256, 128);

  // Sorgente fredda (finestra): crea i riflessi lunghi sul legno lucido.
  const windowGlow = ctx.createRadialGradient(202, 44, 2, 202, 44, 48);
  windowGlow.addColorStop(0, 'rgba(206,232,255,0.9)');
  windowGlow.addColorStop(1, 'rgba(206,232,255,0)');
  ctx.fillStyle = windowGlow;
  ctx.fillRect(0, 0, 256, 128);

  // Sorgente calda (focolare).
  const hearthGlow = ctx.createRadialGradient(54, 80, 2, 54, 80, 58);
  hearthGlow.addColorStop(0, 'rgba(255,168,80,0.85)');
  hearthGlow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = hearthGlow;
  ctx.fillRect(0, 0, 256, 128);

  const equirect = new THREE.CanvasTexture(canvas);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.encoding = THREE.sRGBEncoding;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const renderTarget = pmrem.fromEquirectangular(equirect);
  pmrem.dispose();
  equirect.dispose();
  return renderTarget.texture;
}

// ============================================================================
// OSTELLO: PAVIMENTO, PARETI, TRAVI, FINESTRE, CAMINO E BANCONE
// ----------------------------------------------------------------------------
// Tutto è procedurale (zero asset esterni) e raggruppato in tavernGroup.
// Le pareti stanno fuori dal raggio massimo della camera, quindi non coprono
// mai il tabellone: la camera resta sempre dentro la sala.
// ============================================================================

/** Texture in pietra per le pareti: mattoni irregolari, generata una sola volta. */
function createStoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1009'; // malta scura
  ctx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * 48;
    for (let col = -1; col < 7; col++) {
      const x = col * 96 + offset + 3;
      const y = row * 64 + 3;
      const shade = 52 + ((row * 11 + col * 7 + 120) % 5) * 9;
      ctx.fillStyle = `rgb(${shade + 16}, ${shade + 7}, ${shade})`;
      ctx.fillRect(x, y, 90, 58);
      ctx.fillStyle = 'rgba(255, 220, 180, 0.06)';
      ctx.fillRect(x, y, 90, 6);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 90, 58);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

/** Pavimento in assi di rovere: tavole con venature e giunti scuri. */
function createFloorPlankTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  for (let plank = 0; plank < 8; plank++) {
    const y = plank * 64;
    const shade = 44 + ((plank * 13) % 4) * 8;
    ctx.fillStyle = `rgb(${shade + 26}, ${shade + 10}, ${shade})`;
    ctx.fillRect(0, y, 512, 62);

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#1a0d06';
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const gy = y + 8 + k * 11;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, gy + Math.sin(x * 0.035 + plank + k) * 2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#150b05';
    ctx.fillRect(0, y + 62, 512, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 5);
  texture.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return texture;
}

/** Insegna lignea con testo dorato, appesa alle travi dell'ostello. */
function createTavernSign(text, x, y, z, width, height, rotY = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, '#3a2010');
  bg.addColorStop(1, '#1b0d05');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#c6953e';
  ctx.lineWidth = 7;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#ffd15c';
  ctx.font = 'bold 44px "Cinzel", "Cinzel Decorative", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  const signMat = new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.62, metalness: 0.12, side: THREE.DoubleSide
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), signMat);
  sign.position.set(x, y, z);
  sign.rotation.y = rotY;
  tavernGroup.add(sign);

  // Due catene corte verso la trave sovrastante.
  const ropeGeo = new THREE.CylinderGeometry(0.13, 0.13, 9, 5);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.5, metalness: 0.6 });
  [-1, 1].forEach(side => {
    const dx = side * width * 0.36;
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(x + Math.cos(rotY) * dx, y + height / 2 + 4.5, z - Math.sin(rotY) * dx);
    tavernGroup.add(rope);
  });
}

/** Costruisce l'ostello attorno al tavolo. Nessun oggetto tocca le regole. */
function createTavernSurroundings() {
  const stoneMat = new THREE.MeshStandardMaterial({
    map: createStoneTexture(), color: 0x9a846c, roughness: 0.95, metalness: 0.02
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: createFloorPlankTexture(), color: 0x9c7a58, roughness: 0.78, metalness: 0.04
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2c180d, roughness: 0.82, metalness: 0.03 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x241b16, roughness: 0.5, metalness: 0.65 });

  // Geometrie condivise: poche allocazioni, uno stesso materiale per più mesh.
  const boxCache = {};
  const getBox = (w, h, d) => {
    const key = `${w}|${h}|${d}`;
    if (!boxCache[key]) boxCache[key] = new THREE.BoxGeometry(w, h, d);
    return boxCache[key];
  };
  const addBox = (w, h, d, x, y, z, material) => {
    const mesh = new THREE.Mesh(getBox(w, h, d), material);
    mesh.position.set(x, y, z);
    tavernGroup.add(mesh);
    return mesh;
  };

  // --- Pavimento: riceve le ombre del tavolo, nessun costo di shadow pass extra.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(280, 250), woodMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.25;
  floor.receiveShadow = true;
  tavernGroup.add(floor);

  // --- Pareti in pietra: fronte e retro bassi per non tagliare la vista.
  addBox(280, 46, 3, 0, 18, -112, stoneMat);
  addBox(280, 34, 3, 0, 11, 112, stoneMat);
  addBox(3, 46, 228, -133, 18, 0, stoneMat);
  addBox(3, 46, 228, 133, 18, 0, stoneMat);

  // --- Zoccolatura in legno e travi a vista.
  addBox(280, 9, 3.6, 0, 1, -109.5, woodMat);
  addBox(280, 9, 3.6, 0, 1, 109.5, woodMat);
  addBox(3.6, 9, 228, -130, 1, 0, woodMat);
  addBox(3.6, 9, 228, 130, 1, 0, woodMat);
  [-118, -86, -14, 18, 42, 76, 110].forEach(x => addBox(3, 46, 4, x, 18, -109, darkWoodMat));
  [-80, 0, 80].forEach(z => {
    addBox(5, 46, 3, -130, 18, z, darkWoodMat);
    addBox(5, 46, 3, 130, 18, z, darkWoodMat);
  });
  addBox(280, 3.5, 5, 0, 36, -109, darkWoodMat);
  addBox(5, 3.5, 228, -130, 36, 0, darkWoodMat);
  addBox(5, 3.5, 228, 130, 36, 0, darkWoodMat);

  // --- Finestre: vetro freddo +intelaiatura, contrappunto al fuoco caldo.
  const paneMat = new THREE.MeshBasicMaterial({
    color: 0x8fb6d4, transparent: true, opacity: 0.42,
    side: THREE.DoubleSide, depthWrite: false
  });
  function addWindow(x, y, z, rotY) {
    const frame = new THREE.Group();
    frame.position.set(x, y, z);
    frame.rotation.y = rotY;
    frame.add(new THREE.Mesh(new THREE.PlaneGeometry(16, 18), paneMat));
    const top = new THREE.Mesh(getBox(18, 1.2, 1.2), darkWoodMat);
    top.position.y = 9;
    frame.add(top);
    const bottom = top.clone();
    bottom.position.y = -9;
    frame.add(bottom);
    const left = new THREE.Mesh(getBox(1.2, 18, 1.2), darkWoodMat);
    left.position.x = -8;
    frame.add(left);
    const right = left.clone();
    right.position.x = 8;
    frame.add(right);
    const crossV = new THREE.Mesh(getBox(0.8, 18, 0.8), darkWoodMat);
    frame.add(crossV);
    const crossH = new THREE.Mesh(getBox(16, 0.8, 0.8), darkWoodMat);
    frame.add(crossH);
    tavernGroup.add(frame);
  }
  addWindow(46, 18, -110.2, 0);
  addWindow(96, 18, -110.2, 0);
  addWindow(-131.2, 18, -30, Math.PI / 2);
  addWindow(131.2, 18, -30, -Math.PI / 2);

  // --- Camino in pietra sulla parete di fondo: focolare, ciocchi e fiamme.
  const hx = HEARTH_POS.x;
  const hz = HEARTH_POS.z;
  addBox(34, 2, 18, hx, -3.2, hz - 3, stoneMat);
  addBox(5, 26, 12, hx - 14, 11, hz - 5, stoneMat);
  addBox(5, 26, 12, hx + 14, 11, hz - 5, stoneMat);
  addBox(36, 5, 13, hx, 25, hz - 5, stoneMat);
  const hearthMouth = new THREE.Mesh(
    new THREE.PlaneGeometry(23, 22),
    new THREE.MeshBasicMaterial({ color: 0x070301 })
  );
  hearthMouth.position.set(hx, 11, hz + 1.2);
  tavernGroup.add(hearthMouth);

  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a1f0e, roughness: 0.95 });
  const logGeo = new THREE.CylinderGeometry(1.1, 1.1, 13, 7);
  [-2, 1, 4].forEach((y, i) => {
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i * 0.25;
    log.position.set(hx, -1 + i * 1.4, hz + 2.4 + i * 0.5);
    tavernGroup.add(log);
  });
  const hearthFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff7a26, transparent: true, opacity: 0.72,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  [0, 1, 2].forEach(i => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(2.2 - i * 0.4, 8 - i * 1.4, 7), hearthFlameMat);
    flame.position.set(hx + (i - 1) * 3.2, 3 + i * 0.6, hz + 2.8);
    tavernGroup.add(flame);
  });
  const hearthGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getSparkleTexture(), color: 0xff9a40, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  hearthGlow.position.set(hx, 6, hz + 3);
  hearthGlow.scale.set(34, 34, 1);
  tavernGroup.add(hearthGlow);

  // --- Bancone del bar con bottiglie e boccali.
  addBox(70, 9, 12, 62, 0, -92, woodMat);
  addBox(74, 2, 15, 62, 5, -92, darkWoodMat);
  addBox(70, 6, 1.2, 62, 0, -85.6, darkWoodMat);
  const bottleGeo = new THREE.CylinderGeometry(0.85, 0.85, 3.2, 8);
  const neckGeo = new THREE.CylinderGeometry(0.34, 0.34, 1.4, 6);
  const greenGlass = new THREE.MeshStandardMaterial({
    color: 0x2f6b3a, roughness: 0.18, metalness: 0.1,
    transparent: true, opacity: 0.88, envMapIntensity: 1.1
  });
  const brownGlass = new THREE.MeshStandardMaterial({
    color: 0x6b3a1b, roughness: 0.2, metalness: 0.08,
    transparent: true, opacity: 0.88, envMapIntensity: 1.1
  });
  for (let i = 0; i < 8; i++) {
    const mat = i % 2 ? greenGlass : brownGlass;
    const bx = 36 + i * 7.4;
    const bz = -94 + (i % 2) * 2.2;
    const bottle = new THREE.Mesh(bottleGeo, mat);
    bottle.position.set(bx, 7.6, bz);
    tavernGroup.add(bottle);
    const neck = new THREE.Mesh(neckGeo, mat);
    neck.position.set(bx, 9.9, bz);
    tavernGroup.add(neck);
  }
  const pewterMat = new THREE.MeshStandardMaterial({ color: 0x9a968d, roughness: 0.34, metalness: 0.72 });
  const mugGeo = new THREE.CylinderGeometry(1.2, 1.1, 2.6, 10);
  [28, 34, 90].forEach((mx, i) => {
    const mug = new THREE.Mesh(mugGeo, pewterMat);
    mug.position.set(mx, 7.3, -90 + (i % 2) * 2);
    tavernGroup.add(mug);
  });

  // --- Botti e panche agli angoli: riempiono la sala senza ingombrare il tavolo.
  function addBarrel(x, z) {
    const barrel = new THREE.Group();
    barrel.position.set(x, -4.2, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 11, 12), woodMat);
    body.position.y = 5.5;
    barrel.add(body);
    [1.5, 5.5, 9.5].forEach(y => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(5.05, 0.22, 5, 14), ironMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      barrel.add(band);
    });
    tavernGroup.add(barrel);
  }
  addBarrel(-108, -70);
  addBarrel(110, -68);
  addBarrel(-112, 48);
  [-96, 96].forEach(x => {
    addBox(26, 2, 6, x, -2.5, 38, darkWoodMat);
    addBox(2, 4, 6, x - 10, -4.5, 38, darkWoodMat);
    addBox(2, 4, 6, x + 10, -4.5, 38, darkWoodMat);
  });

  // Insegne e luci d'ambiente: due point light senza ombre illuminano le pareti.
  createTavernSign("LOCANDA DELL'OCA", 62, 23, -109.2, 34, 8);
  createTavernSign('VINO & BIRRA', -92, 23, -109.2, 26, 6);
  [-105, 105].forEach(x => {
    const wallLight = new THREE.PointLight(0xffa860, 0.6, 95, 1.7);
    wallLight.position.set(x, 15, -66);
    tavernGroup.add(wallLight);
  });

  // Braci che salgono dal camino: stesso sistema delle torce, colori più rossi.
  createEmberSystem([{ x: hx, y: 2, z: hz + 3 }], 18, 0xff8a34, 0.7);
}

// ============================================================================
// TEXTURE PROCEDURALI IN LEGNO (zero asset esterni, una sola generazione)
// ============================================================================
function createProceduralWoodTexture(options = {}) {
  const {
    base = '#4b2c19',
    dark = '#24130b',
    light = '#8d5b32',
    repeatX = 1,
    repeatY = 1
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Base calda con leggera variazione diagonale.
  const bg = ctx.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, base);
  bg.addColorStop(0.48, dark);
  bg.addColorStop(1, base);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Venature: curve deterministiche, niente rumore pesante ad ogni frame.
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = light;
  ctx.lineWidth = 1;
  for (let i = 0; i < 68; i++) {
    const y = (i / 68) * 256 + Math.sin(i * 2.17) * 5;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const wave = Math.sin(x * 0.018 + i * 0.63) * 4 + Math.sin(x * 0.061 + i) * 1.3;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  // Nodi del legno: ellissi concentriche sui lati.
  for (let k = 0; k < 3; k++) {
    const cx = 90 + k * 165;
    const cy = 78 + k * 52;
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.34;
    for (let n = 0; n < 4; n++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 12 + n * 7, 5 + n * 3, k * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding; // il canvas è in sRGB
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return texture;
}

// ============================================================================
// COSTRUZIONE TAVOLO E CORNICE IN LEGNO SCOLPITO
// ============================================================================
function createRusticTableAndBoard() {
  // Piano del tavolo in massello di quercia con venature procedurali.
  const tableGeo = new THREE.BoxGeometry(160, 4, 120);
  const tableTexture = createProceduralWoodTexture({
    base: '#392216',
    dark: '#1b0e07',
    light: '#6e4527',
    repeatX: 5,
    repeatY: 4
  });
  // Massello consumato: roughness alta e bump più marcato = legno "vissuto".
  const tableMat = new THREE.MeshStandardMaterial({
    map: tableTexture,
    bumpMap: tableTexture,
    bumpScale: 0.05,
    color: 0xc09a72,
    roughness: 0.8,
    metalness: 0.02,
    envMapIntensity: 0.35
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.y = -2.1;
  tableMesh.receiveShadow = true;
  boardGroup.add(tableMesh);

  // --- GAMBE DEL TAVOLO (restano a terra, NON vengono sollevate) ---
  // Il piano sale di TABLE_RAISE, quindi le gambe vanno dal pavimento (-4.25)
  // al nuovo bordo inferiore (~0.4). Quattro montanti + traverse di rinforzo.
  const legGeo = new THREE.BoxGeometry(4.6, 5.0, 4.6);
  const footGeo = new THREE.BoxGeometry(5.2, 0.5, 5.2);
  const stretchGeo = new THREE.BoxGeometry(138, 1.2, 1.8);
  const stretchSideGeo = new THREE.BoxGeometry(1.8, 1.2, 98);
  const legMat = new THREE.MeshStandardMaterial({
    map: tableTexture, bumpMap: tableTexture, bumpScale: 0.04,
    color: 0xa88361, roughness: 0.78, metalness: 0.03
  });
  const ironFootMat = new THREE.MeshStandardMaterial({ color: 0x241b16, roughness: 0.5, metalness: 0.7 });
  [-68, 68].forEach(x => {
    [-50, 50].forEach(z => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, -1.75, z);
      leg.castShadow = true;
      tavernGroup.add(leg);

      const foot = new THREE.Mesh(footGeo, ironFootMat);
      foot.position.set(x, -4.0, z);
      tavernGroup.add(foot);
    });
  });
  [-50, 50].forEach(z => {
    const stretch = new THREE.Mesh(stretchGeo, legMat);
    stretch.position.set(0, -3.2, z);
    tavernGroup.add(stretch);
  });
  [-68, 68].forEach(x => {
    const stretch = new THREE.Mesh(stretchSideGeo, legMat);
    stretch.position.set(x, -3.2, 0);
    tavernGroup.add(stretch);
  });

  // Il Tabellone del Gioco dell'Oca (Cornice lignea con bordo rialzato)
  const boardBaseGeo = new THREE.BoxGeometry(78, 2.5, 56);
  const boardTexture = createProceduralWoodTexture({
    base: '#4d2b18',
    dark: '#29140b',
    light: '#8a5831',
    repeatX: 2,
    repeatY: 2
  });
  // Noce lucidato a mano: clearcoat appena accennato (0.05). Con un clearcoat più
  // alto la faccia piatta rifletteva un velo bianco verso la camera.
  const boardBaseMat = new THREE.MeshPhysicalMaterial({
    map: boardTexture,
    bumpMap: boardTexture,
    bumpScale: 0.03,
    color: 0xd9b48d, // Noce intagliato, schiarito dal map
    roughness: 0.7,
    metalness: 0.03,
    clearcoat: 0.05,
    clearcoatRoughness: 0.6,
    envMapIntensity: 0.45
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
    roughness: 0.92,
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
  // Materiali laterali condivisi: 64 tessere non devono creare 384 materiali.
  const tileSideMat = new THREE.MeshStandardMaterial({ color: 0x6e492d, roughness: 0.68, metalness: 0.08, envMapIntensity: 0.3 });
  const tileBottomMat = new THREE.MeshStandardMaterial({ color: 0x2c180c, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.1 });

  TILE_DATA.forEach((tile) => {
    // Dimensione casella
    const isCastle = tile.id === 63;
    const w = isCastle ? 6.5 : 3.4;
    const d = isCastle ? 5.5 : 2.5;
    const h = 0.35;

    const canvas = createTileTextureCanvas(tile);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;

    const materials = [
      tileSideMat, // DX
      tileSideMat, // SX
      new THREE.MeshStandardMaterial({
        map: texture,
        // Superficie della tessera poco riflettente: i numeri restano leggibili
        // e non si crea il velo chiaro che appiattiva il tabellone.
        roughness: 0.58,
        metalness: 0.02,
        envMapIntensity: 0.35,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
      }), // TOP
      tileBottomMat, // BOT
      tileSideMat, // FRONTE
      tileSideMat  // RETRO
    ];

    const tileGeo = new THREE.BoxGeometry(w, h, d);
    const tileMesh = new THREE.Mesh(tileGeo, materials);
    tileMesh.position.set(tile.x, tile.y, tile.z);
    tileMesh.rotation.y = tile.rotY;
    tileMesh.receiveShadow = true;
    // Le tessere NON proiettano ombre: sono piatte e, avendo 6 materiali ciascuna,
    // costerebbero 384 draw call per ognuno dei 4 passaggi d'ombra delle torce.
    tileMesh.castShadow = false;
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

// ============================================================================
// AVATAR GOBLIN NELLA TAVERNA (livello SOCIALE, non tocca le regole)
// Geometrie e materiali condivisi: nessuna dipendenza esterna, 12 avatar max.
// ============================================================================

const AVATAR_FLOOR_Y = -4.2;

function getGoblinShared() {
  if (goblinShared) return goblinShared;

  // Rampa toon a 4 step: ombreggiature nette ma calibrate sul legno/taverna.
  const gradient = new THREE.DataTexture(
    new Uint8Array([
      72, 72, 72, 255,
      142, 142, 142, 255,
      214, 214, 214, 255,
      255, 255, 255, 255
    ]), 4, 1, THREE.RGBAFormat
  );
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;

  const toon = (color, extra = {}) => new THREE.MeshToonMaterial(
    Object.assign({ color, gradientMap: gradient }, extra)
  );

  goblinShared = {
    gradientMap: gradient,
    geo: {
      // Comuni
      head: new THREE.SphereGeometry(0.62, 10, 8),
      eye: new THREE.SphereGeometry(0.09, 6, 5),
      limb: new THREE.CylinderGeometry(0.15, 0.15, 1.05, 6),
      hand: new THREE.SphereGeometry(0.19, 7, 6),
      shadow: new THREE.CircleGeometry(1.25, 12),
      nose: new THREE.ConeGeometry(0.17, 0.42, 5),
      // Goblin
      robe: new THREE.ConeGeometry(1.15, 2.7, 8),
      belt: new THREE.TorusGeometry(1.02, 0.12, 5, 10),
      ear: new THREE.ConeGeometry(0.24, 0.85, 5),
      hood: new THREE.ConeGeometry(0.82, 1.05, 8),
      brim: new THREE.TorusGeometry(0.82, 0.1, 5, 10),
      dagger: new THREE.BoxGeometry(0.1, 0.7, 0.1),
      // Cavaliere
      breastplate: new THREE.CylinderGeometry(0.86, 0.78, 1.5, 8),
      pauldron: new THREE.SphereGeometry(0.42, 8, 6),
      visor: new THREE.BoxGeometry(1.05, 0.28, 0.18),
      plume: new THREE.ConeGeometry(0.22, 1.15, 6),
      shield: new THREE.CylinderGeometry(0.78, 0.78, 0.16, 8),
      sword: new THREE.BoxGeometry(0.13, 1.75, 0.09),
      crossguard: new THREE.BoxGeometry(0.65, 0.11, 0.11),
      cape: new THREE.ConeGeometry(1.25, 2.6, 8, 1, true, 0, Math.PI),
      // Principessa
      skirt: new THREE.ConeGeometry(1.42, 2.25, 10),
      bodice: new THREE.CylinderGeometry(0.66, 0.52, 1.15, 8),
      sash: new THREE.TorusGeometry(0.62, 0.09, 5, 10),
      hair: new THREE.SphereGeometry(0.7, 10, 8),
      tiara: new THREE.TorusGeometry(0.58, 0.09, 5, 10),
      jewel: new THREE.SphereGeometry(0.13, 7, 6),
      crownSpike: new THREE.ConeGeometry(0.13, 0.5, 5)
    },
    // Materiali toon condivisi: una sola istanza per tipo, mai per avatar.
    skinMat: toon(0x86b36a),
    fairSkinMat: toon(0xf0c9a4),
    darkMat: toon(0x2b1a10),
    hatMat: toon(0x3a2148),
    metalMat: toon(0xb9c2c9),
    darkMetalMat: toon(0x5d6670),
    goldMat: toon(0xe5b342),
    hairMat: toon(0x8b5a2b),
    gemMat: toon(0x6fb7ff, { emissive: 0x1b4a7a, emissiveIntensity: 0.45 }),
    eyeMat: new THREE.MeshBasicMaterial({ color: 0x120c08 }),
    shadowMat: new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false
    }),
    // Contorno "inchiostro": backward-face leggermente ingrandito.
    outlineMat: new THREE.MeshBasicMaterial({ color: 0x160c06, side: THREE.BackSide }),
    gobletGeo: new THREE.CylinderGeometry(0.19, 0.14, 0.42, 8),
    robeMats: new Map(),
    capeMats: new Map()
  };
  return goblinShared;
}

function getCapeMaterial(colorHex) {
  const shared = getGoblinShared();
  const key = String(colorHex);
  if (!shared.capeMats.has(key)) {
    shared.capeMats.set(key, new THREE.MeshToonMaterial({
      color: colorHex, gradientMap: shared.gradientMap, side: THREE.DoubleSide
    }));
  }
  return shared.capeMats.get(key);
}

/** Tipo sociale in base all'indice: 1/3 goblin, 1/3 cavalieri, 1/3 principesse. */
function getAvatarType(index) {
  const t = index % 3;
  return t === 0 ? 'goblin' : (t === 1 ? 'knight' : 'princess');
}

function getAvatarTypeIcon(type) {
  return type === 'knight' ? '🛡️' : (type === 'princess' ? '👑' : '👺');
}

function getRobeMaterial(colorHex) {
  const shared = getGoblinShared();
  const key = String(colorHex);
  if (!shared.robeMats.has(key)) {
    shared.robeMats.set(key, new THREE.MeshToonMaterial({
      color: colorHex, gradientMap: shared.gradientMap
    }));
  }
  return shared.robeMats.get(key);
}

/** Etichetta con nome e icona del ruolo, sempre rivolta alla camera (Sprite). */
function createAvatarNameTag(name, type) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20, 10, 5, 0.82)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(4, 4, 248, 56, 16) : ctx.rect(4, 4, 248, 56);
  ctx.fill();
  ctx.strokeStyle = '#e5b342';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffd966';
  ctx.font = 'bold 30px "Cinzel", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const icon = getAvatarTypeIcon(type);
  const safeName = `${icon} ${String(name || 'Giocatore').slice(0, 14)}`;
  ctx.fillText(safeName, 128, 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false
  }));
  sprite.scale.set(3.8, 0.95, 1);
  sprite.position.y = 4.7;
  sprite.userData.isNameTag = true;
  return sprite;
}

/**
 * Crea un avatar sociales procedurale: 1/3 goblin, 1/3 cavalieri, 1/3 principesse.
 * Tutti condividono lo stesso rig di animazione (braccia/gambe) usato da
 * updateGoblinAvatars, quindi il movimento resta identico per ogni tipo.
 */
function createGoblinAvatar(player, index) {
  const shared = getGoblinShared();
  const type = getAvatarType(index);
  const colorMat = getRobeMaterial(player.color);
  const root = new THREE.Group();
  root.scale.setScalar(3.0); // personaggi giganti accanto al tavolo rialzato

  const add = (mesh) => { root.add(mesh); return mesh; };
  const swayParts = [];

  // Contorno a inchiostro: solo le sagome principali, non ogni dettaglio.
  const outline = (mesh, scale = 1.055) => {
    const edge = new THREE.Mesh(mesh.geometry, shared.outlineMat);
    edge.scale.setScalar(scale);
    mesh.add(edge);
    return mesh;
  };

  // --- Rig con pivot articolati: niente compenetrazioni alle spalle/anche ---
  const armMat = type === 'princess' ? shared.fairSkinMat : colorMat;
  const legMat = type === 'goblin' ? shared.darkMat : shared.darkMetalMat;
  const handMat = type === 'knight' ? shared.metalMat : armMat;

  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.0, 2.35, 0);
    root.add(pivot);
    pivot.rotation.z = side * -0.12; // braccia leggermente aperte

    const upper = new THREE.Mesh(shared.geo.limb, armMat);
    upper.position.y = -0.52;
    pivot.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -1.0;
    pivot.add(elbow);

    const fore = new THREE.Mesh(shared.geo.limb, armMat);
    fore.position.y = -0.46;
    fore.scale.y = 0.88;
    elbow.add(fore);

    const hand = new THREE.Mesh(shared.geo.hand, handMat);
    hand.position.y = -0.94;
    elbow.add(hand);
    return { pivot, elbow, hand };
  }

  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.36, 0.92, 0);
    root.add(pivot);
    const leg = new THREE.Mesh(shared.geo.limb, legMat);
    leg.position.y = -0.45;
    pivot.add(leg);
    const foot = new THREE.Mesh(shared.geo.hand, shared.darkMat);
    foot.scale.set(1.1, 0.55, 1.5);
    foot.position.set(0, -0.96, 0.14);
    pivot.add(foot);
    return pivot;
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Bicchiere "della casa": nascosto finché non si ordina al bancone.
  const goblet = new THREE.Mesh(shared.gobletGeo, shared.goldMat);
  goblet.position.set(0, -1.28, 0.18);
  goblet.visible = false;
  rightArm.elbow.add(goblet);

  // Alone dorato di prossimità: si accende vicino a un punto di interazione.
  const highlight = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getSparkleTexture(), color: 0xffd966, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  highlight.scale.set(7, 7, 1);
  highlight.position.y = 3.6;
  root.add(highlight);

  let robe = null;
  let head = null;

  if (type === 'goblin') {
    // --- GOBLIN: robe intagliata, orecchie a punta, cappuccio e pugnale ---
    robe = add(new THREE.Mesh(shared.geo.robe, colorMat));
    robe.position.y = 1.45;
    outline(robe);

    const belt = add(new THREE.Mesh(shared.geo.belt, shared.darkMat));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 1.05;

    head = add(new THREE.Mesh(shared.geo.head, shared.skinMat));
    head.position.y = 3.05;
    outline(head);

    const nose = add(new THREE.Mesh(shared.geo.nose, shared.skinMat));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 2.98, 0.62);

    [-1, 1].forEach(side => {
      const ear = add(new THREE.Mesh(shared.geo.ear, shared.skinMat));
      ear.position.set(side * 0.62, 3.12, 0);
      ear.rotation.z = side * 1.05;
      const eye = add(new THREE.Mesh(shared.geo.eye, shared.eyeMat));
      eye.position.set(side * 0.22, 3.08, 0.55);
      const brow = add(new THREE.Mesh(shared.geo.dagger, shared.darkMat));
      brow.scale.set(1.5, 0.25, 1);
      brow.position.set(side * 0.23, 3.28, 0.53);
      brow.rotation.z = side * 0.2;
    });

    const hood = add(new THREE.Mesh(shared.geo.hood, shared.hatMat));
    hood.position.y = 4.05;
    outline(hood);
    const brim = add(new THREE.Mesh(shared.geo.brim, shared.hatMat));
    brim.rotation.x = Math.PI / 2;
    brim.position.y = 3.62;

    const dagger = add(new THREE.Mesh(shared.geo.dagger, shared.metalMat));
    dagger.position.set(1.06, 1.18, 0.24);
    dagger.rotation.z = -0.15;
  } else if (type === 'knight') {
    // --- CAVALIERE: corazza, spalliere, elmo con visiera, scudo e spada ---
    robe = add(new THREE.Mesh(shared.geo.breastplate, shared.metalMat));
    robe.position.y = 2.0;
    outline(robe);

    const belt = add(new THREE.Mesh(shared.geo.belt, shared.goldMat));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 1.18;

    head = add(new THREE.Mesh(shared.geo.head, shared.metalMat));
    head.position.y = 3.05;
    outline(head);
    const visor = add(new THREE.Mesh(shared.geo.visor, shared.darkMetalMat));
    visor.position.set(0, 2.98, 0.56);

    const plume = add(new THREE.Mesh(shared.geo.plume, colorMat));
    plume.position.set(0, 3.85, -0.05);
    plume.rotation.z = 0.22;
    plume.userData.baseRotZ = plume.rotation.z;
    swayParts.push(plume);

    [-1, 1].forEach(side => {
      const pauldron = add(new THREE.Mesh(shared.geo.pauldron, shared.metalMat));
      pauldron.position.set(side * 0.95, 2.55, 0);
      pauldron.scale.set(1.0, 0.68, 0.92);
    });

    const shield = add(new THREE.Mesh(shared.geo.shield, colorMat));
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-1.42, 1.95, 0.38);
    outline(shield, 1.06);
    const shieldRim = add(new THREE.Mesh(shared.geo.belt, shared.goldMat));
    shieldRim.position.set(-1.42, 1.95, 0.47);

    const sword = add(new THREE.Mesh(shared.geo.sword, shared.metalMat));
    sword.position.set(1.32, 2.35, 0.22);
    const guard = add(new THREE.Mesh(shared.geo.crossguard, shared.goldMat));
    guard.position.set(1.32, 1.5, 0.22);

    const cape = add(new THREE.Mesh(shared.geo.cape, getCapeMaterial(player.color)));
    cape.position.set(0, 2.0, -0.42);
    cape.rotation.y = Math.PI * 0.15;
    cape.userData.baseRotZ = cape.rotation.z;
    swayParts.push(cape);
  } else {
    // --- PRINCIPESSA: gonna a campana, corpetto, tiara e tre punte d'oro ---
    robe = add(new THREE.Mesh(shared.geo.skirt, colorMat));
    robe.position.y = 1.35;
    outline(robe);

    const bodice = add(new THREE.Mesh(shared.geo.bodice, colorMat));
    bodice.position.y = 2.45;
    const sash = add(new THREE.Mesh(shared.geo.sash, shared.goldMat));
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 2.0;

    head = add(new THREE.Mesh(shared.geo.head, shared.fairSkinMat));
    head.position.y = 3.25;
    outline(head);

    const hair = add(new THREE.Mesh(shared.geo.hair, shared.hairMat));
    hair.position.set(0, 3.38, -0.28);
    hair.scale.set(1.08, 1.05, 1.02);
    outline(hair, 1.05);
    [-1, 1].forEach(side => {
      const lock = add(new THREE.Mesh(shared.geo.limb, shared.hairMat));
      lock.position.set(side * 0.54, 2.92, -0.05);
      lock.scale.set(1.5, 1.9, 1.4);
      const eye = add(new THREE.Mesh(shared.geo.eye, shared.eyeMat));
      eye.position.set(side * 0.22, 3.27, 0.55);
    });

    const tiara = add(new THREE.Mesh(shared.geo.tiara, shared.goldMat));
    tiara.rotation.x = Math.PI / 2;
    tiara.position.y = 3.72;
    [-0.38, 0, 0.38].forEach((x, i) => {
      const spike = add(new THREE.Mesh(shared.geo.crownSpike, shared.goldMat));
      spike.position.set(x, 3.95 + (i === 1 ? 0.12 : 0), 0);
    });
    const jewel = add(new THREE.Mesh(shared.geo.jewel, shared.gemMat));
    jewel.position.set(0, 3.7, 0.58);
  }

  // Ombra a terra e nome.
  const shadow = add(new THREE.Mesh(shared.geo.shadow, shared.shadowMat));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;

  const nameTag = add(createAvatarNameTag(player.name, type));

  goblinsGroup.add(root);
  return {
    root, type, robe, head,
    leftArm: leftArm.pivot, rightArm: rightArm.pivot,
    leftElbow: leftArm.elbow, rightElbow: rightArm.elbow,
    leftHand: leftArm.hand, rightHand: rightArm.hand,
    leftLeg, rightLeg, goblet, highlight,
    swayParts, nameTag, phase: index * 1.7, lastName: player.name,
    // Stato animazione con blending: sempre inizializzato, mai undefined.
    animState: 'idle',
    interactTimer: 0,
    gesture: 0,
    blend: { idle: 1, walk: 0, interact: 0 }
  };
}

/**
 * Blending: imposta lo stato desiderato; le transizioni reali sono gestite
 * da updateAvatarBlending con un easing esponenziale (same-frame safe).
 */
function setAvatarAnimState(avatar, state) {
  if (!avatar || avatar.animState === state) return;
  avatar.animState = state;
  if (state === 'interact') {
    avatar.interactTimer = 1.25;
    avatar.gesture = Math.random() < 0.5 ? 0 : 1;
  }
}

/** Interpola i pesi idle/walk/interact verso lo stato corrente. */
function updateAvatarBlending(avatar, dt) {
  const b = avatar.blend;
  const k = 1 - Math.exp(-7 * dt);
  const targetIdle = avatar.animState === 'idle' ? 1 : 0;
  const targetWalk = avatar.animState === 'walk' ? 1 : 0;
  const targetInteract = avatar.animState === 'interact' ? 1 : 0;
  b.idle += (targetIdle - b.idle) * k;
  b.walk += (targetWalk - b.walk) * k;
  b.interact += (targetInteract - b.interact) * k;
  return b;
}

/**
 * IK analitico a due segmenti nel piano YZ. Il braccio pende lungo -Y:
 * phi è l'angolo del bersaglio rispetto alla spalla, beta la flessione del gomito.
 * Nessuna allocazione: adatto al render loop.
 */
function solveTwoBoneIK(pivot, elbow, dy, dz, upper, lower) {
  let dist = Math.hypot(dy, dz);
  const maxReach = upper + lower - 0.02;
  const minReach = Math.abs(upper - lower) + 0.02;
  dist = Math.min(maxReach, Math.max(minReach, dist));
  const phi = Math.atan2(dz, -dy);
  const cosBeta = (dist * dist - upper * upper - lower * lower) / (2 * upper * lower);
  const beta = Math.acos(Math.min(1, Math.max(-1, cosBeta)));
  pivot.rotation.x = phi - Math.atan2(lower * Math.sin(beta), upper + lower * Math.cos(beta));
  elbow.rotation.x = beta;
}

/** Gamba singola: punta il piede verso un punto locale (dy, dz). */
function solveLegAim(pivot, dy, dz) {
  pivot.rotation.x = Math.atan2(dz, -dy);
}

/** Dove deve arrivare la mano in base al punto di interazione. */
function getAvatarTarget(spotId) {
  if (spotId === 'bar') return { armDy: -0.35, armDz: 1.0, legDy: -0.9, legDz: 0.05, sit: false };
  if (spotId === 'chair-left' || spotId === 'chair-right') {
    return { armDy: -0.55, armDz: 0.35, legDy: -0.25, legDz: 0.85, sit: true };
  }
  return { armDy: -0.5, armDz: 0.55, legDy: -0.9, legDz: 0.05, sit: false };
}

/** Aggiunge i campi avatar ai player che non li hanno (retrocompatibilità). */
function ensureAvatarData(player, index) {
  if (!player.avatar) {
    const seat = DEFAULT_AVATAR_SEATS[index % DEFAULT_AVATAR_SEATS.length];
    player.avatar = {
      mode: 'seat', x: seat.x, z: seat.z, yaw: 0,
      spot: null, drinks: 0,
      targetX: seat.x, targetZ: seat.z, targetYaw: 0
    };
  }
  const a = player.avatar;
  if (a.targetX === undefined) a.targetX = a.x;
  if (a.targetZ === undefined) a.targetZ = a.z;
  if (a.targetYaw === undefined) a.targetYaw = a.yaw || 0;
  if (a.drinks === undefined) a.drinks = 0;
  return a;
}

/** Allinea numero di goblin e dati avatar con l'elenco PLAYERS. */
function syncGoblinAvatars() {
  while (GOBLIN_AVATARS.length > PLAYERS.length) {
    const old = GOBLIN_AVATARS.pop();
    if (old && old.root) goblinsGroup.remove(old.root);
  }
  PLAYERS.forEach((p, idx) => {
    const data = ensureAvatarData(p, idx);
    const expectedType = getAvatarType(idx);
    const current = GOBLIN_AVATARS[idx];

    // Se cambia il tipo (es. kick che sposta gli indici), ricreo il modello.
    if (!current || current.type !== expectedType) {
      if (current && current.root) goblinsGroup.remove(current.root);
      GOBLIN_AVATARS[idx] = createGoblinAvatar(p, idx);
    } else if (current.lastName !== p.name) {
      // Solo il nome è cambiato: sostituisco l'etichetta.
      current.root.remove(current.nameTag);
      const tag = createAvatarNameTag(p.name, expectedType);
      current.root.add(tag);
      current.nameTag = tag;
      current.lastName = p.name;
    }
    GOBLIN_AVATARS[idx].root.position.set(data.x, AVATAR_FLOOR_Y, data.z);
    GOBLIN_AVATARS[idx].root.rotation.y = data.yaw || 0;
  });
}

/** Applica uno stato avatar ricevuto dal server senza toccare le regole. */
function applyRemoteAvatarState(playerId, incoming) {
  if (!incoming) return;
  const idx = PLAYERS.findIndex(p => p.id === playerId);
  if (idx === -1) return;

  const local = idx === getLocalPlayerIndex();
  const data = ensureAvatarData(PLAYERS[idx], idx);
  const dist = Math.hypot(data.x - incoming.x, data.z - incoming.z);

  if (local && roamMode) {
    // Solo correzione hardware: il movimento locale resta fluido.
    if (dist > 4) {
      data.x = incoming.x;
      data.z = incoming.z;
    }
  } else {
    data.targetX = incoming.x;
    data.targetZ = incoming.z;
  }
  data.targetYaw = incoming.yaw || 0;
  data.mode = incoming.mode || data.mode;
  data.spot = incoming.spot || null;
  data.drinks = incoming.drinks || 0;
  syncGoblinAvatars();
}

/** Indice del giocatore controllato da questo browser (0 in modalità offline). */
function getLocalPlayerIndex() {
  if (typeof socket === 'undefined' || !socket || !socket.connected) return 0;
  const saved = sessionStorage.getItem('oca_session_token');
  let idx = saved ? PLAYERS.findIndex(p => p.sessionToken === saved) : -1;
  if (idx < 0) idx = PLAYERS.findIndex(p => p.id === socket.id);
  return idx < 0 ? 0 : idx;
}

function isAvatarBlocked(x, z) {
  if (x < AVATAR_BOUNDS.minX || x > AVATAR_BOUNDS.maxX ||
      z < AVATAR_BOUNDS.minZ || z > AVATAR_BOUNDS.maxZ) return true;
  return AVATAR_OBSTACLES.some(o =>
    x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ
  );
}

function buildSculptedGooseModel(colorHex) {
  const goose = new THREE.Group();

  // Materiale laccato lucido per il corpo in legno colorato (come giocattolo artigianale).
  // Il clearcoat aggiunge il riflesso "lacca" senza cambiare geometria o logica.
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.28,
    metalness: 0.06,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.15 // riflesso "lacca" ben visibile sulla miniatura
  });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xff9900, roughness: 0.3, metalness: 0.04 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.48, metalness: 0.04 });

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
  goose.userData.baseScale = 0.85;
  goose.scale.set(0.85, 0.85, 0.85);

  return goose;
}

// Colloca visivamente la pedina sulla tessera target con piccolo offset se più pedine condividono la casella
function placePawnOnTile(pawnRef, tileId, animateHop = false, onDone = null) {
  // Accetta sia l'indice della pedina sia l'id del giocatore (stringa Socket.io /
  // sessione locale): prima la ricerca sull'array restituiva sempre undefined.
  const pawnIdx = typeof pawnRef === 'number' ? pawnRef : PLAYERS.findIndex(p => p.id === pawnRef);
  const pawn = PAWN_MESHES[pawnIdx];
  const tile = TILE_DATA[tileId] || TILE_DATA[0];

  // Pedina non ancora istanziata (stanza in caricamento): chiude la catena senza errori.
  if (!pawn) {
    if (onDone) onDone();
    return;
  }

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

  // Animazione Balzo Parabolico (Hop) con easing, inclinazione e squash di atterraggio.
  const startX = pawn.position.x;
  const startY = pawn.position.y;
  const startZ = pawn.position.z;
  const startRotY = pawn.rotation.y;
  const baseScale = pawn.userData.baseScale || 0.85;
  const dx = targetX - startX;
  const dz = targetZ - startZ;
  const distance = Math.hypot(dx, dz);
  const travelYaw = distance > 0.001 ? Math.atan2(dx, dz) : tile.rotY;
  let yawDelta = travelYaw - startRotY;
  yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta)); // percorso angolare più breve
  // Il balzo dura 240ms: ~78% volo, il resto assestamento elastico a terra.
  const duration = 240;
  const travelPhase = 0.78;
  const startTime = performance.now();

  playSound('hop');

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Si "siede" nella curva: inclinazione laterale proporzionale alla virata.
  const lean = THREE.MathUtils.clamp(yawDelta / Math.PI, -1, 1) * 0.16;

  function hopStep(now) {
    const rawT = Math.min(1, (now - startTime) / duration);
    const flyT = Math.min(1, rawT / travelPhase);
    const settleT = rawT > travelPhase ? (rawT - travelPhase) / (1 - travelPhase) : 0;
    const moveT = easeInOutCubic(flyT);

    // Traiettoria parabolica: l'arco usa l'easing, quindi parte e plana morbido.
    const arcHeight = 1.85 + Math.min(1.15, distance * 0.075);
    const arc = Math.sin(moveT * Math.PI) * arcHeight;

    // Atterraggio: due rimbalzini smorzati che non scendono mai sotto la casella.
    const landingBounce = settleT > 0
      ? Math.abs(Math.sin(settleT * Math.PI * 2.2)) * 0.32 * (1 - settleT)
      : 0;

    pawn.position.x = THREE.MathUtils.lerp(startX, targetX, moveT);
    pawn.position.y = THREE.MathUtils.lerp(startY, targetY, moveT) + arc + landingBounce;
    pawn.position.z = THREE.MathUtils.lerp(startZ, targetZ, moveT);

    // La miniatura guarda dove vola, alza il becco e si inclina in curva.
    pawn.rotation.y = startRotY + yawDelta * moveT;
    pawn.rotation.x = -Math.sin(moveT * Math.PI) * 0.15;
    pawn.rotation.z = lean * Math.sin(moveT * Math.PI);

    // Squash & stretch: leggero allungamento in volo, compressione all'impatto.
    const impact = settleT > 0 ? Math.sin(settleT * Math.PI * 1.6) * (1 - settleT) : 0;
    const squashY = 1 - Math.max(0, impact) * 0.11;
    const bulgeXZ = 1 + Math.max(0, impact) * 0.07;
    pawn.scale.set(baseScale * bulgeXZ, baseScale * squashY, baseScale * bulgeXZ);

    if (rawT < 1) {
      requestAnimationFrame(hopStep);
    } else {
      pawn.position.set(targetX, targetY, targetZ);
      pawn.rotation.x = 0;
      pawn.rotation.z = 0;
      pawn.rotation.y = travelYaw;
      pawn.scale.set(baseScale, baseScale, baseScale);
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
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.34, metalness: 0.035, envMapIntensity: 0.6 });
  });
}

/**
 * Restituisce l'orientamento che porta sulla faccia superiore il valore indicato.
 * La mappatura segue l'ordine materiali di BoxGeometry:
 * +X=1, -X=6, +Y=2, -Y=5, +Z=3, -Z=4.
 */
function getDiceRestRotation(value) {
  switch (value) {
    case 1: return { x: 0, z: Math.PI / 2 };      // +X in alto
    case 2: return { x: 0, z: 0 };                // +Y in alto
    case 3: return { x: -Math.PI / 2, z: 0 };     // +Z in alto
    case 4: return { x: Math.PI / 2, z: 0 };      // -Z in alto
    case 5: return { x: Math.PI, z: 0 };          // -Y in alto
    case 6: return { x: 0, z: -Math.PI / 2 };     // -X in alto
    default: return { x: 0, z: 0 };
  }
}

/**
 * Costruisce il quaternione finale del dado: orienta la faccia corretta verso
 * l'alto e applica uno yaw casuale attorno all'asse mondiale Y.
 */
function buildDiceRestQuaternion(value, yaw) {
  const rest = getDiceRestRotation(value);
  const restQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rest.x, 0, rest.z, 'XYZ'));
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return restQuat.premultiply(yawQuat);
}

// Rotolamento scenografico dei dadi 3D con rimbalzo smorzato e atterraggio sul valore reale.
function roll3DDiceAnimation(val1, val2, callback) {
  isRollingDice = true;
  playSound('dice');

  const startT = performance.now();
  const duration = 980;
  const start1 = diceMesh1.position.clone();
  const start2 = diceMesh2.position.clone();
  const end1 = new THREE.Vector3(-28.8, 1.4, 13.6);
  const end2 = new THREE.Vector3(-23.7, 1.4, 15.4);

  const targetQuat1 = buildDiceRestQuaternion(val1, Math.random() * Math.PI * 2);
  const targetQuat2 = buildDiceRestQuaternion(val2, Math.random() * Math.PI * 2);
  const settleQuat = new THREE.Quaternion();

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const smoothStep = (t) => t * t * (3 - 2 * t);

  function tumbleStep(now) {
    const t = Math.min(1, (now - startT) / duration);
    const damp = 1 - t;

    // Rotazione frenetica che rallenta.
    diceMesh1.rotation.x += 0.42 * damp;
    diceMesh1.rotation.y += 0.33 * damp;
    diceMesh1.rotation.z += 0.26 * damp;
    diceMesh2.rotation.x += 0.38 * damp;
    diceMesh2.rotation.y += 0.45 * damp;
    diceMesh2.rotation.z += 0.31 * damp;

    // Rimbalzi multipli smorzati, non una singola parabola.
    const bounce1 = Math.abs(Math.sin(t * Math.PI * 3.4)) * Math.pow(1 - t, 1.55) * 3.5;
    const bounce2 = Math.abs(Math.sin(t * Math.PI * 3.05 + 0.7)) * Math.pow(1 - t, 1.55) * 3.1;

    diceMesh1.position.x = THREE.MathUtils.lerp(start1.x, end1.x, easeOutCubic(t)) + Math.sin(t * Math.PI * 1.7) * 0.22 * damp;
    diceMesh1.position.y = 1.4 + bounce1;
    diceMesh1.position.z = THREE.MathUtils.lerp(start1.z, end1.z, easeOutCubic(t));
    diceMesh2.position.x = THREE.MathUtils.lerp(start2.x, end2.x, easeOutCubic(t)) + Math.sin(t * Math.PI * 1.4 + 1.2) * 0.2 * damp;
    diceMesh2.position.y = 1.4 + bounce2;
    diceMesh2.position.z = THREE.MathUtils.lerp(start2.z, end2.z, easeOutCubic(t));

    // Negli ultimi 38% del lancio allinea dolcemente la faccia estratta verso l'alto.
    if (t > 0.62) {
      const blend = smoothStep((t - 0.62) / 0.38);
      settleQuat.setFromEuler(diceMesh1.rotation);
      settleQuat.slerp(targetQuat1, blend);
      diceMesh1.quaternion.copy(settleQuat);

      settleQuat.setFromEuler(diceMesh2.rotation);
      settleQuat.slerp(targetQuat2, blend);
      diceMesh2.quaternion.copy(settleQuat);
    }

    if (t < 1) {
      requestAnimationFrame(tumbleStep);
    } else {
      diceMesh1.position.copy(end1);
      diceMesh2.position.copy(end2);
      diceMesh1.quaternion.copy(targetQuat1);
      diceMesh2.quaternion.copy(targetQuat2);
      // Ultimo "clack" di legno sul tavolo quando i dadi si fermano sul valore.
      playSound('hop');
      isRollingDice = false;
      if (callback) callback();
    }
  }

  requestAnimationFrame(tumbleStep);
}

// ============================================================================
// EFFETTI VISIVI: SCINTILLE 3D, ANELLI DI LUCE, CONFETTI
// ============================================================================
const TILE_FX_COLORS = {
  goose: 0xffd966,
  bridge: 0x8fd8ff,
  inn: 0xffb347,
  well: 0x63e6d2,
  maze: 0xc08bff,
  prison: 0xff8a5c,
  death: 0xff5b5b,
  castle: 0xffe066
};

function getSparkleTexture() {
  if (sparkleTexture) return sparkleTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,242,190,0.95)');
  gradient.addColorStop(0.52, 'rgba(255,196,80,0.38)');
  gradient.addColorStop(1, 'rgba(255,196,80,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  sparkleTexture = new THREE.CanvasTexture(canvas);
  sparkleTexture.encoding = THREE.sRGBEncoding;
  return sparkleTexture;
}

/**
 * Sistema di scintille fluttuanti (torce + camino).
 * Un solo THREE.Points per sistema, array tipizzati preallocati: nessuna
 * allocazione nel loop e nessun garbage collector in movimento.
 */
function createEmberSystem(sources, countPerSource, color, size) {
  const count = sources.length * countPerSource;
  if (!count) return;

  const positions = new Float32Array(count * 3);
  const origins = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const ages = new Float32Array(count);
  const lives = new Float32Array(count);
  const seeds = new Float32Array(count);

  let n = 0;
  for (let s = 0; s < sources.length; s++) {
    for (let j = 0; j < countPerSource; j++, n++) {
      const o = n * 3;
      origins[o] = sources[s].x;
      origins[o + 1] = sources[s].y;
      origins[o + 2] = sources[s].z;
      lives[n] = 0.9 + Math.random() * 1.5;
      ages[n] = Math.random() * lives[n];
      velocities[o] = (Math.random() - 0.5) * 0.9;
      velocities[o + 1] = 2.1 + Math.random() * 3.1;
      velocities[o + 2] = (Math.random() - 0.5) * 0.9;
      seeds[n] = Math.random() * Math.PI * 2;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    map: getSparkleTexture(),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  EMBER_SYSTEMS.push({ positions, origins, velocities, ages, lives, seeds, geometry, count });
  // Inizializza subito le posizioni: il primo frame non mostra scintille ferme a (0,0,0).
  updateEmbers(0, 0);
}

/** Avanza tutte le scintille. Chiamata una volta per frame da animate(). */
function updateEmbers(delta, time) {
  for (let s = 0; s < EMBER_SYSTEMS.length; s++) {
    const sys = EMBER_SYSTEMS[s];
    const p = sys.positions;
    const v = sys.velocities;
    const o0 = sys.origins;

    for (let i = 0; i < sys.count; i++) {
      const o = i * 3;
      let age = sys.ages[i] + delta;

      if (age >= sys.lives[i] || delta === 0) {
        age = 0;
        sys.lives[i] = 0.9 + Math.random() * 1.5;
        p[o] = o0[o] + (Math.random() - 0.5) * 1.3;
        p[o + 1] = o0[o + 1];
        p[o + 2] = o0[o + 2] + (Math.random() - 0.5) * 1.3;
        v[o] = (Math.random() - 0.5) * 0.9;
        v[o + 1] = 2.1 + Math.random() * 3.1;
        v[o + 2] = (Math.random() - 0.5) * 0.9;
      }
      sys.ages[i] = age;

      // Deriva laterale sinusoidale: la scintilla tremola sale senza ruotare.
      p[o] += (v[o] + Math.sin(time * 3.1 + sys.seeds[i]) * 0.32) * delta;
      p[o + 1] += v[o + 1] * delta;
      p[o + 2] += (v[o + 2] + Math.cos(time * 2.7 + sys.seeds[i]) * 0.28) * delta;
    }
    sys.geometry.attributes.position.needsUpdate = true;
  }
}

function spawnConfettiBurst(preset = 'tile') {
  if (typeof confetti !== 'function') return;
  const presets = {
    tile: {
      particleCount: 45,
      spread: 70,
      startVelocity: 28,
      gravity: 0.9,
      scalar: 0.75,
      ticks: 120,
      colors: ['#ffd966', '#f7ecd5', '#e5b342']
    },
    waterfall: {
      particleCount: 130,
      spread: 110,
      startVelocity: 42,
      gravity: 0.95,
      scalar: 0.95,
      ticks: 170,
      origin: { y: 0.62 },
      colors: ['#8fd8ff', '#5bb3e8', '#f7ecd5', '#ffd966']
    },
    goose: {
      particleCount: 26,
      spread: 62,
      startVelocity: 24,
      gravity: 0.85,
      scalar: 0.7,
      ticks: 105,
      colors: ['#ffd966', '#fff6d5', '#e5b342']
    },
    victory: {
      particleCount: 260,
      spread: 125,
      startVelocity: 46,
      gravity: 0.9,
      scalar: 1.05,
      ticks: 210,
      origin: { y: 0.58 },
      colors: ['#ffd966', '#ffb347', '#f7ecd5', '#e5b342', '#d13030']
    }
  };
  const options = presets[preset] || presets.tile;
  try {
    confetti(options);
  } catch (err) {
    console.warn('Confetti non disponibile:', err);
  }
}

function spawnTileBurst(tile, type) {
  const color = TILE_FX_COLORS[type] || 0xffd966;
  const isCastle = type === 'castle';

  // Coriandoli dorati leggeri sul volo dell'Oca: le scintille 3D restano l'effetto
  // principale, il confetti aggiunge solo un tocco di carta velina.
  if (type === 'goose') spawnConfettiBurst('goose');
  const count = isCastle ? 34 : 20;
  const positions = new Float32Array(count * 3);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    // Parte da un piccolo disco attorno al centro della tessera.
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.45;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.random() * 0.25;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    const speed = 1.1 + Math.random() * (isCastle ? 3.4 : 2.2);
    velocities.push({
      x: Math.cos(angle) * speed,
      y: 2.1 + Math.random() * (isCastle ? 3.8 : 2.8),
      z: Math.sin(angle) * speed
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: isCastle ? 1.0 : 0.74,
    map: getSparkleTexture(),
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  points.position.set(tile.x, tile.y + TABLE_RAISE + 0.32, tile.z);
  points.frustumCulled = false;
  scene.add(points);
  TRANSIENT_EFFECTS.push({
    kind: 'sparkles',
    object: points,
    velocities,
    age: 0,
    duration: isCastle ? 1.35 : 0.95,
    baseSize: material.size
  });

  // Anello di luce a terra.
  const ringGeo = new THREE.RingGeometry(0.82, 1.08, 36);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(tile.x, tile.y + TABLE_RAISE + 0.27, tile.z);
  scene.add(ring);
  TRANSIENT_EFFECTS.push({ kind: 'ring', object: ring, age: 0, duration: 0.72 });

  // Pulse emissivo sulla faccia superiore della tessera.
  const tileMesh = TILE_MESHES[tile.id];
  const topMaterial = tileMesh && Array.isArray(tileMesh.material) ? tileMesh.material[2] : null;
  if (topMaterial) {
    topMaterial.emissive.setHex(color);
    topMaterial.emissiveIntensity = 0.8;
    TRANSIENT_EFFECTS.push({ kind: 'tileGlow', material: topMaterial, age: 0, duration: 0.62 });
  }
}

function playLandingVisualFX(pos) {
  const tile = TILE_DATA[pos];
  if (!tile) return;
  if (tile.type === 'goose' || tile.type === 'bridge' || tile.type === 'inn' ||
      tile.type === 'well' || tile.type === 'maze' || tile.type === 'prison' ||
      tile.type === 'death' || tile.type === 'castle') {
    spawnTileBurst(tile, tile.type);
  }
}

function updateTransientEffects(delta) {
  const dt = Math.min(delta, 0.05);
  for (let i = TRANSIENT_EFFECTS.length - 1; i >= 0; i--) {
    const fx = TRANSIENT_EFFECTS[i];
    fx.age += dt;
    const progress = Math.min(1, fx.age / fx.duration);

    if (fx.kind === 'sparkles') {
      const array = fx.object.geometry.attributes.position.array;
      for (let j = 0; j < fx.velocities.length; j++) {
        const v = fx.velocities[j];
        v.y -= 7.5 * dt;
        const drag = Math.pow(0.985, dt * 60);
        v.x *= drag;
        v.z *= drag;
        array[j * 3] += v.x * dt;
        array[j * 3 + 1] += v.y * dt;
        array[j * 3 + 2] += v.z * dt;
      }
      fx.object.geometry.attributes.position.needsUpdate = true;
      fx.object.material.opacity = 1 - progress;
      fx.object.material.size = fx.baseSize * (1 - progress * 0.3);
    } else if (fx.kind === 'ring') {
      const scale = 1 + progress * 2.4;
      fx.object.scale.set(scale, scale, scale);
      fx.object.material.opacity = (1 - progress) * 0.85;
    } else if (fx.kind === 'tileGlow') {
      fx.material.emissiveIntensity = (1 - progress) * 0.8;
    }

    if (progress >= 1) {
      if (fx.kind === 'sparkles') {
        scene.remove(fx.object);
        fx.object.geometry.dispose();
        fx.object.material.dispose();
      } else if (fx.kind === 'ring') {
        scene.remove(fx.object);
        fx.object.geometry.dispose();
        fx.object.material.dispose();
      } else if (fx.kind === 'tileGlow') {
        fx.material.emissiveIntensity = 0;
        fx.material.emissive.setHex(0x000000);
      }
      TRANSIENT_EFFECTS.splice(i, 1);
    }
  }
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

  // Effetto visivo sulla casella (non modifica in alcun modo le regole).
  playLandingVisualFX(pos);

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
  if (!feed) return;

  const entry = document.createElement('div');
  entry.className = `event-entry ${type}`;
  entry.textContent = msg;
  feed.appendChild(entry);

  // Le cronache non crescono all'infinito: al massimo 40 voci restano nel DOM.
  while (feed.childElementCount > 40) feed.removeChild(feed.firstElementChild);

  feed.scrollTop = feed.scrollHeight;

  // Ticker mobile sempre allineato all'ultimo evento della tavola.
  updateMobileEventTicker(msg);
}

function showVictoryModal(winner) {
  playSound('fanfare');
  spawnConfettiBurst('victory');
  setTimeout(() => spawnConfettiBurst('tile'), 320);

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
    const seat = DEFAULT_AVATAR_SEATS[idx % DEFAULT_AVATAR_SEATS.length];
    const a = ensureAvatarData(p, idx);
    a.mode = 'seat';
    a.x = a.targetX = seat.x;
    a.z = a.targetZ = seat.z;
    a.yaw = a.targetYaw = 0;
    a.spot = null;
    a.drinks = 0;
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
  if (roamMode) toggleRoamMode(false);
  document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));

  if (preset === 'top') {
    // Vista Zenitale dall'alto
    animateCameraPosition(0, 85 + TABLE_RAISE, 4, 0, TABLE_RAISE, 0);
    document.getElementById('cam-btn-top').classList.add('active');
  } else if (preset === 'iso') {
    // Prospettiva isometrica classica
    animateCameraPosition(0, 52 + TABLE_RAISE * 0.4, 62, 0, TABLE_RAISE * 0.65, 0);
    document.getElementById('cam-btn-iso').classList.add('active');
  } else if (preset === 'pawn') {
    // Zoom ravvicinato sulla pedina di turno
    const curr = PLAYERS[currentPlayerIdx];
    const tile = TILE_DATA[curr.position] || TILE_DATA[0];
    const ty = tile.y + TABLE_RAISE;
    animateCameraPosition(tile.x, ty + 16, tile.z + 18, tile.x, ty, tile.z);
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

  // Il FAB della regia deve comparire/scomparire anche ruotando il telefono.
  syncMobileAdminFab();
}

// ============================================================================
// CONTROLLO AVATAR: MOVIMENTO, CAMERA, INTERAZIONI SOCIALI
// Tutto questo livello è cosmetico: non modifica posizione/turno/dadi del gioco.
// ============================================================================

let tavernToastTimer = null;

function showTavernToast(message) {
  const el = document.getElementById('tavern-toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(tavernToastTimer);
  tavernToastTimer = setTimeout(() => el.classList.remove('visible'), 2400);
}

function updateRoamUI() {
  document.body.classList.toggle('roam-active', roamMode);
  const hint = document.getElementById('roam-hint');
  if (hint) hint.style.display = roamMode ? 'flex' : 'none';
  const btn = document.getElementById('btn-toggle-roam');
  if (btn) {
    btn.classList.toggle('active', roamMode);
    const label = btn.querySelector('span');
    if (label) label.textContent = roamMode ? 'Tavola' : 'Esplora';
  }
  if (!roamMode) {
    const prompt = document.getElementById('roam-prompt');
    if (prompt) prompt.classList.remove('visible');
  }
}

/** Entra/esce dalla modalità esplorazione della taverna. */
function toggleRoamMode(force) {
  const next = (typeof force === 'boolean') ? force : !roamMode;
  if (next === roamMode) return;
  syncGoblinAvatars();
  const idx = getLocalPlayerIndex();
  const player = PLAYERS[idx];
  if (!player) return;
  const data = ensureAvatarData(player, idx);

  if (next) {
    boardCameraSnapshot = {
      position: camera.position.clone(),
      target: controls.target.clone()
    };
    roamMode = true;
    data.mode = 'roam';
    data.targetX = data.x;
    data.targetZ = data.z;
    camera.position.set(data.x, 40, data.z + 50);
    controls.target.set(data.x, 8, data.z);
    controls.minDistance = 8;
    controls.maxDistance = 48;
    logEvent("🚶 MODALITÀ TAVERNA: muoviti con WASD (o joystick), premi E per interagire, M per tornare al tavolo.", 'special');
    showTavernToast('Esplora la taverna 🍻');
  } else {
    roamMode = false;
    data.mode = 'seat';
    if (boardCameraSnapshot) {
      camera.position.copy(boardCameraSnapshot.position);
      controls.target.copy(boardCameraSnapshot.target);
    }
    controls.minDistance = 25;
    controls.maxDistance = 104;
    logEvent('🪿 Sei tornato al tavolo. La partita continua senza cambiamenti.');
    showTavernToast('Torno al tavolo 🪿');
  }

  updateRoamUI();
  if (typeof socket !== 'undefined' && socket && socket.connected && currentRoomId) {
    socket.emit('avatar_update', {
      x: data.x, z: data.z, yaw: data.yaw, mode: data.mode
    });
  }
}

/** Interazione con il punto più vicino (bancone, sedie, camino, tavolo). */
function tryAvatarInteract() {
  if (!roamMode) return;
  const idx = getLocalPlayerIndex();
  const player = PLAYERS[idx];
  if (!player) return;
  const data = ensureAvatarData(player, idx);

  let nearest = null;
  let best = Infinity;
  for (let i = 0; i < AVATAR_SPOTS.length; i++) {
    const s = AVATAR_SPOTS[i];
    const d = Math.hypot(data.x - s.x, data.z - s.z);
    if (d < s.radius && d < best) {
      best = d;
      nearest = s;
    }
  }

  if (!nearest) {
    showTavernToast('Avvicinati al bancone, al camino o a una panchina.');
    return;
  }

  data.spot = nearest.id;

  // Azione dedicata: il personaggio porge la mano e "stringe" il bicchiere.
  const avatar = GOBLIN_AVATARS[idx];
  if (avatar) {
    setAvatarAnimState(avatar, 'interact');
    avatar.goblet.visible = true;
    avatar.interactSpot = nearest.id;
  }

  playSound('gulp');
  spawnConfettiBurst('tile');
  logEvent(`🍺 ${player.name} si è preso un drink ${nearest.label}! (Drink sociali: ${(data.drinks || 0) + 1})`);
  showTavernToast(`${nearest.verb} 🍺`);

  if (typeof socket !== 'undefined' && socket && socket.connected && currentRoomId) {
    socket.emit('avatar_action', { action: 'drink', spotId: nearest.id });
  } else {
    data.drinks = (data.drinks || 0) + 1; // offline: solo locale
  }
}

/** Aggiorna avatar, collisioni, animazione walk e telemetria verso il server. */
function updateGoblinAvatars(delta, time) {
  if (!GOBLIN_AVATARS.length) return;
  const dt = Math.min(delta, 0.05);
  const localIdx = getLocalPlayerIndex();

  for (let i = 0; i < PLAYERS.length; i++) {
    const player = PLAYERS[i];
    const avatar = GOBLIN_AVATARS[i];
    if (!player || !avatar) continue;
    const data = ensureAvatarData(player, i);
    let speed = 0;

    if (i === localIdx && roamMode) {
      // Input in coordinate schermo: W = avanti rispetto a dove guarda la camera.
      let inputForward = (AVATAR_KEYS.up ? 1 : 0) - (AVATAR_KEYS.down ? 1 : 0);
      let inputRight = (AVATAR_KEYS.right ? 1 : 0) - (AVATAR_KEYS.left ? 1 : 0);
      if (AVATAR_JOY.active) {
        inputForward += -AVATAR_JOY.y;
        inputRight += AVATAR_JOY.x;
      }

      // Proiezione orizzontale della direzione della camera + suo vettore destro.
      camera.getWorldDirection(AVATAR_TMP_CAMDIR);
      AVATAR_TMP_FORWARD.set(AVATAR_TMP_CAMDIR.x, 0, AVATAR_TMP_CAMDIR.z);
      if (AVATAR_TMP_FORWARD.lengthSq() < 0.0001) AVATAR_TMP_FORWARD.set(0, 0, -1);
      AVATAR_TMP_FORWARD.normalize();
      AVATAR_TMP_RIGHT.crossVectors(AVATAR_TMP_FORWARD, AVATAR_UP).normalize();

      AVATAR_TMP_MOVE.set(0, 0, 0)
        .addScaledVector(AVATAR_TMP_FORWARD, inputForward)
        .addScaledVector(AVATAR_TMP_RIGHT, inputRight);
      const len = AVATAR_TMP_MOVE.length();
      if (len > 1) AVATAR_TMP_MOVE.divideScalar(len);
      speed = len > 0.05 ? 14 : 0;

      if (speed > 0) {
        // Collisioni asse per asse: scivola lungo gli ostacoli.
        const stepX = AVATAR_TMP_MOVE.x * speed * dt;
        const stepZ = AVATAR_TMP_MOVE.z * speed * dt;
        if (!isAvatarBlocked(data.x + stepX, data.z)) data.x += stepX;
        if (!isAvatarBlocked(data.x, data.z + stepZ)) data.z += stepZ;
        data.targetX = data.x;
        data.targetZ = data.z;
        data.targetYaw = Math.atan2(AVATAR_TMP_MOVE.x, AVATAR_TMP_MOVE.z);
      }
    } else {
      // Avatar remoti (o locale fuori dalla modalità): interpolazione morbida.
      const k = 1 - Math.exp(-7 * dt);
      const dx = data.targetX - data.x;
      const dz = data.targetZ - data.z;
      speed = Math.hypot(dx, dz) * k / Math.max(dt, 0.001);
      data.x += dx * k;
      data.z += dz * k;
    }

    // Yaw con percorso angolare più breve.
    let yawDelta = (data.targetYaw || 0) - (data.yaw || 0);
    yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
    data.yaw = (data.yaw || 0) + yawDelta * (1 - Math.exp(-10 * dt));

    const root = avatar.root;
    root.position.x = data.x;
    root.position.z = data.z;

    // --- Animation blending: priorità all'interazione, poi walk/idle ---
    if (avatar.interactTimer > 0) {
      avatar.interactTimer -= dt;
      if (avatar.interactTimer <= 0) {
        avatar.goblet.visible = false;
        avatar.interactSpot = null;
        setAvatarAnimState(avatar, speed > 0.25 ? 'walk' : 'idle');
      }
    } else {
      setAvatarAnimState(avatar, speed > 0.25 ? 'walk' : 'idle');
    }
    const blend = updateAvatarBlending(avatar, dt);

    avatar.phase += dt * (0.9 * blend.idle + (6 + Math.min(6, speed * 0.5)) * blend.walk);
    const swing = Math.sin(avatar.phase);
    const walkAmp = 0.5 * blend.walk;
    const idleAmp = 0.05 * blend.idle;

    avatar.leftLeg.rotation.x = swing * walkAmp;
    avatar.rightLeg.rotation.x = -swing * walkAmp;
    avatar.leftArm.rotation.x = -swing * walkAmp * 0.75 + Math.sin(time * 1.6 + avatar.phase) * idleAmp;
    avatar.rightArm.rotation.x = swing * walkAmp * 0.75 - Math.sin(time * 1.6 + avatar.phase) * idleAmp;
    avatar.leftElbow.rotation.x = 0.12 * blend.idle + 0.18 * blend.walk;
    avatar.rightElbow.rotation.x = 0.12 * blend.idle + 0.18 * blend.walk;

    if (blend.interact > 0.01) {
      // IK: mani sul banco/sgabello, piedi orientati al punto di contatto.
      const target = getAvatarTarget(avatar.interactSpot || 'bar');
      const progress = 1 - Math.max(0, avatar.interactTimer) / 1.25;
      const reach = 0.45 + 0.55 * Math.sin(progress * Math.PI);
      solveTwoBoneIK(avatar.leftArm, avatar.leftElbow, target.armDy, target.armDz * reach, 1.0, 0.9);
      solveTwoBoneIK(avatar.rightArm, avatar.rightElbow, target.armDy, target.armDz * reach, 1.0, 0.9);
      solveLegAim(avatar.leftLeg, target.legDy, target.legDz);
      solveLegAim(avatar.rightLeg, target.legDy, target.legDz);
      root.position.y = AVATAR_FLOOR_Y - (target.sit ? 1.0 * blend.interact : 0);
    } else {
      root.position.y = AVATAR_FLOOR_Y
        + Math.abs(swing) * 0.12 * blend.walk
        + Math.sin(time * 1.7 + avatar.phase) * 0.04 * blend.idle;
    }

    // Alone di prossimità: si accende solo per il giocatore locale in esplorazione.
    let nearestDist = Infinity;
    for (let s = 0; s < AVATAR_SPOTS.length; s++) {
      const spot = AVATAR_SPOTS[s];
      const d = Math.hypot(data.x - spot.x, data.z - spot.z);
      if (d < nearestDist) nearestDist = d;
    }
    const glowTarget = (i === localIdx && roamMode) ? Math.max(0, 1 - nearestDist / 14) * 0.55 : 0;
    avatar.highlight.material.opacity += (glowTarget - avatar.highlight.material.opacity) * (1 - Math.exp(-6 * dt));

    // Mantello e piuma d'elmo oscillano con il passo (piccolo dettaglio "vivo").
    if (avatar.swayParts && avatar.swayParts.length) {
      for (let s = 0; s < avatar.swayParts.length; s++) {
        const part = avatar.swayParts[s];
        const base = part.userData.baseRotZ || 0;
        part.rotation.z = base + Math.sin(time * 2.6 + avatar.phase + s) * 0.07;
      }
    }
    root.rotation.y = data.yaw;
  }

  // La camera segue il goblin locale durante l'esplorazione.
  if (roamMode) {
    const data = ensureAvatarData(PLAYERS[localIdx] || {}, localIdx);
    AVATAR_TMP_TARGET.set(data.x, 8, data.z);
    AVATAR_TMP_DELTA.copy(AVATAR_TMP_TARGET).sub(controls.target);
    const k = 1 - Math.exp(-6 * dt);
    controls.target.addScaledVector(AVATAR_TMP_DELTA, k);
    camera.position.addScaledVector(AVATAR_TMP_DELTA, k);

    // Prompt contestuale del punto più vicino.
    const prompt = document.getElementById('roam-prompt');
    if (prompt) {
      let nearest = null;
      let best = Infinity;
      for (let i = 0; i < AVATAR_SPOTS.length; i++) {
        const s = AVATAR_SPOTS[i];
        const d = Math.hypot(data.x - s.x, data.z - s.z);
        if (d < s.radius && d < best) { best = d; nearest = s; }
      }
      if (nearest) {
        prompt.textContent = `E — ${nearest.verb} ${nearest.label}`;
        prompt.classList.add('visible', 'near');
      } else {
        prompt.classList.remove('visible', 'near');
      }
    }

    const now = performance.now();
    if (now - lastAvatarSendMs >= 100) {
      lastAvatarSendMs = now;
      if (typeof socket !== 'undefined' && socket && socket.connected && currentRoomId) {
        socket.emit('avatar_update', {
          x: Math.round(data.x * 10) / 10,
          z: Math.round(data.z * 10) / 10,
          yaw: Math.round(data.yaw * 100) / 100,
          mode: 'roam'
        });
      }
    }
  }
}

/** Registra tastiera, joystick touch e pulsanti della modalità taverna. */
function setupAvatarControls() {
  const isTyping = (e) => {
    const tag = e.target && e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const key = e.key.toLowerCase();
    if (key === 'm') { toggleRoamMode(); return; }
    if (key === 'e') { tryAvatarInteract(); return; }
    if (key === 'w' || key === 'arrowup') AVATAR_KEYS.up = true;
    if (key === 's' || key === 'arrowdown') AVATAR_KEYS.down = true;
    if (key === 'a' || key === 'arrowleft') AVATAR_KEYS.left = true;
    if (key === 'd' || key === 'arrowright') AVATAR_KEYS.right = true;
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') AVATAR_KEYS.up = false;
    if (key === 's' || key === 'arrowdown') AVATAR_KEYS.down = false;
    if (key === 'a' || key === 'arrowleft') AVATAR_KEYS.left = false;
    if (key === 'd' || key === 'arrowright') AVATAR_KEYS.right = false;
  });
  window.addEventListener('blur', () => {
    AVATAR_KEYS.up = AVATAR_KEYS.down = AVATAR_KEYS.left = AVATAR_KEYS.right = false;
  });

  const toggleBtn = document.getElementById('btn-toggle-roam');
  if (toggleBtn) toggleBtn.onclick = () => toggleRoamMode();
  const characterFab = document.getElementById('character-fab');
  if (characterFab) characterFab.onclick = () => toggleRoamMode();
  const exitBtn = document.getElementById('roam-exit-btn');
  if (exitBtn) exitBtn.onclick = () => toggleRoamMode(false);
  const actionBtn = document.getElementById('roam-action-btn');
  if (actionBtn) actionBtn.onclick = () => tryAvatarInteract();

  // Joystick touch: normalization in [-1, 1] sul piano XZ.
  const base = document.getElementById('roam-joystick');
  const knob = document.getElementById('roam-joystick-knob');
  if (base && knob) {
    const update = (e) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = rect.width * 0.42;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      AVATAR_JOY.x = dx / max;
      AVATAR_JOY.y = dy / max;
    };
    base.addEventListener('pointerdown', (e) => {
      AVATAR_JOY.active = true;
      base.setPointerCapture(e.pointerId);
      update(e);
    });
    base.addEventListener('pointermove', (e) => { if (AVATAR_JOY.active) update(e); });
    const end = () => {
      AVATAR_JOY.active = false;
      AVATAR_JOY.x = 0;
      AVATAR_JOY.y = 0;
      knob.style.transform = 'translate(0, 0)';
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }
  updateRoamUI();
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min(0.05, (now - lastFrameMs) / 1000);
  lastFrameMs = now;

  const time = now * 0.001;

  // Le quattro torce sono la luce principale della scena.
  updateTorches(time);
  // Scintille di torce e camino: un solo aggiornamento dei buffer per frame.
  updateEmbers(delta, time);

  // Focolare vivo: due sinusoidi + micro-rumore deterministico, senza allocazioni.
  if (fireplaceLight) {
    const flicker = 1
      + Math.sin(time * 8.7) * 0.11
      + Math.sin(time * 21.3 + 1.7) * 0.045
      + (Math.sin(time * 47.1) + Math.sin(time * 89.7 + 2.4)) * 0.018;

    // Random-walk smorzato: guizzi irregolari (legna che scoppietta) senza allocazioni.
    fireplaceFlicker += (Math.random() - 0.5) * 0.06;
    fireplaceFlicker = THREE.MathUtils.lerp(fireplaceFlicker, 1, 0.08);

    fireplaceLight.intensity = FIREPLACE_BASE_INTENSITY * Math.max(0.7, flicker + (fireplaceFlicker - 1) * 0.35);
    fireplaceLight.color.setHSL(0.055 + Math.sin(time * 2.4) * 0.006, 0.96, 0.51 + Math.sin(time * 13.7) * 0.018);
    fireplaceLight.position.x = HEARTH_POS.x + Math.sin(time * 4.3) * 0.35 + (fireplaceFlicker - 1) * 0.6;
    fireplaceLight.position.y = HEARTH_POS.y + Math.sin(time * 6.7) * 0.18;
  }

  updateTransientEffects(delta);
  updateGoblinAvatars(delta, time);
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
  syncGoblinAvatars();
  renderPlayersHUD();
  updateTurnHUD();
  updatePawnHUDPositions();
}

// INIZIALIZZAZIONE ALL'AVVIO
window.addEventListener('DOMContentLoaded', () => {
  initThreeScene();
  setupAvatarControls();
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
    spawnConfettiBurst('waterfall');
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
        // Fallback locale (nessun server): la regia si apre in hotseat.
        // Non esiste una password master hardcoded: in locale serve solo un PIN di conferma.
        if (password.length >= 3) {
          const localPin = Math.floor(1000 + Math.random() * 9000).toString();
          unlockAdminGodMode("local_token", localPin);
          dismissWelcomeScreen(() => {
            showRoomQRCode(localPin);
          });
        } else {
          alert("In modalità locale la Master Password deve avere almeno 3 caratteri.");
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
      // Fallback locale (nessun server): regia hotseat, nessuna password hardcoded.
      if (password.length >= 3) {
        const localPin = Math.floor(1000 + Math.random() * 9000).toString();
        unlockAdminGodMode("local_token", localPin);
        document.getElementById('modal-lobby').classList.remove('visible');
        showRoomQRCode(localPin);
        alert(`👑 Modalità Admin Sbloccata in Locale!\nPIN Stanza generato: ${localPin}`);
      } else {
        alert("In modalità locale la Master Password deve avere almeno 3 caratteri.");
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

  // --- EVENT TICKER MOBILE (tap = espandi/chiudi le cronache) ---
  const ticker = document.getElementById('mobile-event-ticker');
  if (ticker) {
    ticker.onclick = () => {
      if (ticker.classList.contains('expanded')) {
        // Torna alla riga singola con l'ultimo evento.
        ticker.classList.remove('expanded');
        const feedEl = document.getElementById('event-feed-list');
        const lastEvent = feedEl ? feedEl.lastElementChild : null;
        ticker.textContent = lastEvent ? lastEvent.textContent : 'Benvenuti al Gioco dell\'Oca 3D!';
      } else {
        // Popola con tutti gli eventi dal feed (clonati, il feed resta intatto).
        const feedEl = document.getElementById('event-feed-list');
        ticker.innerHTML = feedEl ? feedEl.innerHTML : '<em>Nessun evento ancora.</em>';
        ticker.scrollTop = ticker.scrollHeight;
        ticker.classList.add('expanded');
      }
    };
  }

  syncMobileAdminFab();
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
function syncMobileAdminFab() {
  const fab = document.getElementById('admin-fab-mobile');
  if (!fab) return;
  // Visibile solo per un Host autenticato su schermo mobile.
  const nextDisplay = (adminToken && window.innerWidth <= 860) ? 'flex' : 'none';
  if (fab.style.display !== nextDisplay) fab.style.display = nextDisplay;
}

function showMobileAdminFab() {
  syncMobileAdminFab();
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
    // Il footer si alza di qualche pixel per lasciare spazio alla barra regia.
    document.body.classList.add('admin-active');
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

  // Su mobile la barra regia desktop è nascosta: mostriamo il FAB.
  syncMobileAdminFab();
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
  // Con più di 6 giocatori la barra diventa scorrevole: nessun pill viene tagliato.
  rack.classList.toggle('is-crowded', PLAYERS.length > 6);
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
              cssClass: colorCfg.cssClass,
              avatar: rp.avatar ? { ...rp.avatar } : undefined
            });
          } else {
            const existing = PLAYERS[idx];
            if (existing) {
              existing.name = rp.name;
              existing.position = rp.position;
              existing.skipTurns = rp.missTurns || 0;
              if (rp.avatar) {
                const a = ensureAvatarData(existing, idx);
                a.mode = rp.avatar.mode || a.mode;
                a.x = typeof rp.avatar.x === 'number' ? rp.avatar.x : a.x;
                a.z = typeof rp.avatar.z === 'number' ? rp.avatar.z : a.z;
                a.yaw = typeof rp.avatar.yaw === 'number' ? rp.avatar.yaw : a.yaw;
                a.spot = rp.avatar.spot || null;
                a.drinks = rp.avatar.drinks || 0;
                if (!roamMode || idx !== getLocalPlayerIndex()) {
                  a.targetX = a.x;
                  a.targetZ = a.z;
                  a.targetYaw = a.yaw;
                }
              }
            }
          }
        });

        // Ricrea pedine 3D e HUD solo al primo caricamento dello stato stanza
        if (isFirstLoad) {
          create3DGeesePawns();
          syncGoblinAvatars();
          renderPlayersHUD();
        } else {
          // Aggiorna pedine 3D già esistenti (riconnesione / sincronizzazione posizione)
          room.players.forEach((rp, idx) => {
            if (PLAYERS[idx] && !isMovingPawn && Math.abs(PLAYERS[idx].position - rp.position) > 0) {
              updatePawn3DPosition(PLAYERS[idx]);
            }
          });
          updatePawnHUDPositions();
          syncGoblinAvatars();
        }

        // Tieni l'indice di turno coerente con il numero di giocatori attuali
        if (currentPlayerIdx >= PLAYERS.length) {
          currentPlayerIdx = Math.max(0, PLAYERS.length - 1);
        }
        updateTurnHUD();
      }
    });

    // Stato sociale degli avatar: evento leggero, separato dalla partita.
    socket.on('avatar_state_updated', (data) => {
      if (data && data.playerId) applyRemoteAvatarState(data.playerId, data.avatar);
    });

    socket.on('admin_broadcast_alert', (msg) => {
      logEvent(`👑 [HOST]: ${msg}`, 'special');
      alert(`👑 NOTIFICA DELL'HOST:\n\n${msg}`);
    });

    socket.on('admin_cascade_drink', (data) => {
      playSound('gulp');
      spawnConfettiBurst('waterfall');
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
      // Stessa celebrazione della vittoria locale: modale, fanfara e coriandoli.
      const winnerName = data.winner ? data.winner.name : "Campione";
      const winnerPlayer = PLAYERS.find(p => p.name === winnerName) || {
        name: winnerName,
        hex: '#ffd966'
      };
      showVictoryModal(winnerPlayer);
    });

  } catch (err) {
    console.warn("Impossibile connettersi al server Socket:", err);
  }
}
