/**
 * Bakvoetbal The Game - Birthday Edition
 * Core Game Engine - Animated Goal & 2D Goalie Physics Update
 */

// --- DOM References ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const btnShoot = document.getElementById('btn-shoot');
const btnAudio = document.getElementById('btn-audio');
const audioLabel = document.getElementById('audio-label');

// --- Game Configurations ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GOAL_LEFT = 160;
const GOAL_RIGHT = 640;
const GOAL_TOP = 140;
const GOAL_BOTTOM = 440;
const GOAL_WIDTH = GOAL_RIGHT - GOAL_LEFT;
const GOAL_HEIGHT = GOAL_BOTTOM - GOAL_TOP;

// 6 Goal Zones for penalty shots and goalie dives
const ZONES = [
    { id: 0, name: 'Top-Left', x: GOAL_LEFT + 10, y: GOAL_TOP + 10, w: GOAL_WIDTH/3 - 15, h: GOAL_HEIGHT/2 - 15 },
    { id: 1, name: 'Top-Center', x: GOAL_LEFT + GOAL_WIDTH/3 + 5, y: GOAL_TOP + 10, w: GOAL_WIDTH/3 - 10, h: GOAL_HEIGHT/2 - 15 },
    { id: 2, name: 'Top-Right', x: GOAL_LEFT + (GOAL_WIDTH/3)*2 + 5, y: GOAL_TOP + 10, w: GOAL_WIDTH/3 - 15, h: GOAL_HEIGHT/2 - 15 },
    { id: 3, name: 'Bottom-Left', x: GOAL_LEFT + 10, y: GOAL_TOP + GOAL_HEIGHT/2 + 5, w: GOAL_WIDTH/3 - 15, h: GOAL_HEIGHT/2 - 15 },
    { id: 4, name: 'Bottom-Center', x: GOAL_LEFT + GOAL_WIDTH/3 + 5, y: GOAL_TOP + GOAL_HEIGHT/2 + 5, w: GOAL_WIDTH/3 - 10, h: GOAL_HEIGHT/2 - 15 },
    { id: 5, name: 'Bottom-Right', x: GOAL_LEFT + (GOAL_WIDTH/3)*2 + 5, y: GOAL_TOP + GOAL_HEIGHT/2 + 5, w: GOAL_WIDTH/3 - 15, h: GOAL_HEIGHT/2 - 15 }
];

// --- Game States ---
const STATE_TITLE = 'TITLE';
const STATE_TEAM_SELECT = 'TEAM_SELECT'; // Now Character Select
const STATE_READY = 'READY';
const STATE_AIM_H = 'AIM_H';
const STATE_AIM_V = 'AIM_V';
const STATE_KICK = 'KICK';
const STATE_RESULT = 'RESULT';
const STATE_GAME_OVER = 'GAME_OVER';

let gameState = STATE_TITLE;

// --- Player & Score Tracker ---
let player1Name = 'TEAM STIEN';
let player2Name = 'TEAM MARGOT';
let p1Score = []; // array of results: 'goal' or 'miss'
let p2Score = []; // array of results: 'goal' or 'miss'
let currentRound = 0; // 0 to 4 (5 rounds total)
let activeKicker = 1; // 1 = Team 1 shoots (against P2 Goalie), 2 = Team 2 shoots (against P1 Goalie)
let totalAttempts = 5;

// Selected Goalies
let p1Goalie = 'stien'; // 'stien', 'margot', or 'beer'
let p2Goalie = 'margot';
let charSelectState = 'p1'; // 'p1' selecting, then 'p2' selecting
let charSelectHoverIndex = 0;

const CHARACTERS = [
    { id: 'stien', name: 'STIEN', reach: '8/10', speed: '7/10', beerPower: '9/10', color: '#00f0ff' },
    { id: 'margot', name: 'MARGOT', reach: '9/10', speed: '8/10', beerPower: '7/10', color: '#ff007f' },
    { id: 'beer', name: 'BAK BIER', reach: '6/10', speed: '6/10', beerPower: '99/10', color: '#ffdf00' }
];

// --- Spring-Physics Net Grid ---
let netNodes = [];
const NET_COLS = 13;
const NET_ROWS = 9;

// --- Screen Shake variables ---
let shakeTime = 0;
let shakeAmount = 0;

// --- Interactive Aiming & Ball variables ---
let aimX = CANVAS_WIDTH / 2;
let aimY = (GOAL_TOP + GOAL_BOTTOM) / 2;
let aimSpeedX = 8;
let aimSpeedY = 6;
let aimDirX = 1;
let aimDirY = 1;

let selectedAimX = 0;
let selectedAimY = 0;

let ballX = CANVAS_WIDTH / 2;
let ballY = 530;
let ballSize = 14;
let ballTargetX = 0;
let ballTargetY = 0;
let ballProgress = 0; // 0 to 1
let ballRotation = 0;

// Goalie Physics/Animation State
let goalieX = CANVAS_WIDTH / 2;
let goalieY = 330;
let goalieAngle = 0;
let goalieScaleX = 1;
let goalieScaleY = 1;
let goalieState = 'idle'; // idle, crouching, diving, saved, failed
let goalieDiveZone = -1;

let beerZone = -1; // random zone containing the beer crate obstacle in current round

// --- Graphics & Asset Caching ---
let imagesLoaded = 0;
const totalImages = 6;
const assets = {
    stien: document.getElementById('img-stien'),
    margot: document.getElementById('img-margot'),
    stienHead: document.getElementById('img-stien-head'),
    margotHead: document.getElementById('img-margot-head'),
    goal: document.getElementById('img-goal'),
    logo: document.getElementById('img-logo')
};

// Offscreen canvases for dynamically pixelated goalie sprites
let stienPixelCanvas = null;
let margotPixelCanvas = null;
let stienHeadPixelCanvas = null;
let margotHeadPixelCanvas = null;

// Confetti array for Game Over celebration
let confetti = [];

// --- Sound Synthesizer (Web Audio API) ---
let audioCtx = null;
let audioEnabled = false;
let musicInterval = null;
let musicBeat = 0;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'sine', volume = 0.1, delay = 0) {
    if (!audioEnabled || !audioCtx) return;
    
    setTimeout(() => {
        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
            // Linear decay
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {}
    }, delay * 1000);
}

// 8-bit Kick sound sweep
function playKickSound() {
    if (!audioEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch(e){}
}

// 8-bit Save sound
function playSaveSound() {
    if (!audioEnabled || !audioCtx) return;
    playTone(120, 0.1, 'triangle', 0.4);
    playTone(80, 0.15, 'sawtooth', 0.3, 0.05);
}

// 8-bit Goal Fanfare
function playGoalSound() {
    if (!audioEnabled || !audioCtx) return;
    const tempo = 0.12;
    const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25];
    const types = ['square', 'square', 'square', 'square', 'triangle', 'sine'];
    notes.forEach((note, idx) => {
        playTone(note, tempo * 1.5, types[idx], 0.15, idx * tempo);
    });
}

// 8-bit Beer Crash sound
function playBeerSound() {
    if (!audioEnabled || !audioCtx) return;
    playTone(880, 0.05, 'sine', 0.2);
    playTone(1200, 0.08, 'sine', 0.15, 0.02);
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle';
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(100, audioCtx.currentTime + 0.05);
        osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        osc.start(audioCtx.currentTime + 0.05);
        osc.stop(audioCtx.currentTime + 0.3);
    } catch(e){}
}

// Looping retro menu music
function startMenuMusic() {
    if (musicInterval) clearInterval(musicInterval);
    
    const melody = [
        329.63, 392.00, 523.25, 0, 440.00, 0, 392.00, 0,
        349.23, 0, 329.63, 349.23, 392.00, 0, 293.66, 0,
        329.63, 392.00, 523.25, 0, 440.00, 0, 587.33, 0,
        523.25, 493.88, 440.00, 392.00, 523.25, 0, 0, 0
    ];
    
    const bass = [
        130.81, 130.81, 130.81, 130.81, 174.61, 174.61, 130.81, 130.81,
        146.83, 146.83, 146.83, 146.83, 196.00, 196.00, 196.00, 196.00,
        130.81, 130.81, 130.81, 130.81, 174.61, 174.61, 146.83, 146.83,
        196.00, 196.00, 196.00, 196.00, 130.81, 196.00, 130.81, 0
    ];

    musicInterval = setInterval(() => {
        if (!audioEnabled) return;
        
        const note = melody[musicBeat % melody.length];
        const bassNote = bass[musicBeat % bass.length];
        
        if (note > 0) {
            playTone(note, 0.15, 'square', 0.05);
        }
        if (bassNote > 0) {
            playTone(bassNote, 0.2, 'triangle', 0.08);
        }
        
        musicBeat++;
    }, 150);
}

function stopMenuMusic() {
    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}

function toggleAudio() {
    initAudio();
    audioEnabled = !audioEnabled;
    
    if (audioEnabled) {
        audioLabel.textContent = "SOUND OFF";
        btnAudio.classList.remove('blue-btn');
        btnAudio.classList.add('red-btn');
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        startMenuMusic();
    } else {
        audioLabel.textContent = "SOUND ON";
        btnAudio.classList.remove('red-btn');
        btnAudio.classList.add('blue-btn');
        stopMenuMusic();
    }
}

btnAudio.addEventListener('click', toggleAudio);

// --- Net Mass-Spring Physics Initialization ---
function initNet() {
    netNodes = [];
    const cellW = (GOAL_RIGHT - GOAL_LEFT) / (NET_COLS - 1);
    const cellH = (GOAL_BOTTOM - GOAL_TOP) / (NET_ROWS - 1);
    
    for (let r = 0; r < NET_ROWS; r++) {
        const row = [];
        for (let c = 0; c < NET_COLS; c++) {
            const ox = GOAL_LEFT + c * cellW;
            const oy = GOAL_TOP + r * cellH;
            
            // Anchor top row and side edges so net stays attached to post frame
            const isAnchored = (r === 0) || (c === 0) || (c === NET_COLS - 1) || (r === NET_ROWS - 1);
            
            row.push({
                x: ox,
                y: oy,
                ox: ox,
                oy: oy,
                vx: 0,
                vy: 0,
                isAnchored: isAnchored
            });
        }
        netNodes.push(row);
    }
}

function updateNetPhysics() {
    const spring = 0.05;
    const damping = 0.88;
    const wind = 0.2;
    const time = Date.now() * 0.003;
    
    for (let r = 0; r < netNodes.length; r++) {
        for (let c = 0; c < netNodes[r].length; c++) {
            const n = netNodes[r][c];
            if (n.isAnchored) continue;
            
            // 1. Pull back to original grid anchors
            n.vx += (n.ox - n.x) * 0.04;
            n.vy += (n.oy - n.y) * 0.04;
            
            // 2. Subtle wind sway
            n.vx += Math.sin(time + n.oy * 0.05) * wind * 0.1;
            
            // 3. Connect springs to immediate neighbors
            if (r > 0) { // Top
                n.vy += (netNodes[r-1][c].y - n.y) * spring;
                n.vx += (netNodes[r-1][c].x - n.x) * spring;
            }
            if (r < netNodes.length - 1) { // Bottom
                n.vy += (netNodes[r+1][c].y - n.y) * spring;
                n.vx += (netNodes[r+1][c].x - n.x) * spring;
            }
            if (c > 0) { // Left
                n.vx += (netNodes[r][c-1].x - n.x) * spring;
                n.vy += (netNodes[r][c-1].y - n.y) * spring;
            }
            if (c < netNodes[r].length - 1) { // Right
                n.vx += (netNodes[r][c+1].x - n.x) * spring;
                n.vy += (netNodes[r][c+1].y - n.y) * spring;
            }
            
            // Apply velocities
            n.x += n.vx;
            n.y += n.vy;
            n.vx *= damping;
            n.vy *= damping;
        }
    }
}

function triggerNetImpact(impactX, impactY, force) {
    for (let r = 0; r < netNodes.length; r++) {
        for (let c = 0; c < netNodes[r].length; c++) {
            const n = netNodes[r][c];
            if (n.isAnchored) continue;
            
            const dx = n.x - impactX;
            const dy = n.y - impactY;
            const dist = Math.hypot(dx, dy);
            if (dist < 140) {
                const strength = (1 - dist / 140) * force;
                const angle = Math.atan2(dy, dx);
                // Push nodes back and outwards
                n.vx += Math.cos(angle) * strength;
                n.vy += Math.sin(angle) * strength - strength * 0.3; // blow upwards slightly
            }
        }
    }
}

function triggerScreenShake(time, amount) {
    shakeTime = time;
    shakeAmount = amount;
}

// --- Dynamic Pixelation Engine ---
function pixelateImageToCanvas(sourceImg, scaleFactor) {
    if (!sourceImg.complete || sourceImg.naturalWidth === 0) return null;
    const w = Math.round(sourceImg.naturalWidth * scaleFactor);
    const h = Math.round(sourceImg.naturalHeight * scaleFactor);
    
    const pCanvas = document.createElement('canvas');
    pCanvas.width = w;
    pCanvas.height = h;
    const pCtx = pCanvas.getContext('2d');
    pCtx.drawImage(sourceImg, 0, 0, w, h);
    return pCanvas;
}

function prePixelateImages() {
    const bodyScale = 0.07;
    const headScale = 0.08;
    
    stienPixelCanvas = pixelateImageToCanvas(assets.stien, bodyScale);
    margotPixelCanvas = pixelateImageToCanvas(assets.margot, bodyScale);
    stienHeadPixelCanvas = pixelateImageToCanvas(assets.stienHead, headScale);
    margotHeadPixelCanvas = pixelateImageToCanvas(assets.margotHead, headScale);
}

const loadedImages = new Set();
function checkImageLoaded(id) {
    loadedImages.add(id);
    if (loadedImages.size === totalImages) {
        prePixelateImages();
        initNet();
    }
}

assets.stien.onload = () => checkImageLoaded('stien');
assets.margot.onload = () => checkImageLoaded('margot');
assets.stienHead.onload = () => checkImageLoaded('stienHead');
assets.margotHead.onload = () => checkImageLoaded('margotHead');
assets.goal.onload = () => checkImageLoaded('goal');
assets.logo.onload = () => checkImageLoaded('logo');

// Safe fallbacks
if (assets.stien.complete) checkImageLoaded('stien');
if (assets.margot.complete) checkImageLoaded('margot');
if (assets.stienHead.complete) checkImageLoaded('stienHead');
if (assets.margotHead.complete) checkImageLoaded('margotHead');
if (assets.goal.complete) checkImageLoaded('goal');
if (assets.logo.complete) checkImageLoaded('logo');

// --- Goalie 2D Sprite Body Renderers ---
function drawBeerCrateGoalieBody(ctx, bodyY, headY, handLX, handRX, handLY, handRY, goalieState) {
    ctx.save();
    
    // 1. Torso (Red Beer Crate)
    ctx.fillStyle = '#cc0000'; // red box
    ctx.fillRect(-26, bodyY - 30, 52, 38);
    
    // Shadow space inside
    ctx.fillStyle = '#880000';
    ctx.fillRect(-22, bodyY - 24, 44, 26);
    
    // Golden rims
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-26, bodyY - 30, 52, 3);
    ctx.fillRect(-26, bodyY + 5, 52, 3);
    ctx.fillRect(-26, bodyY - 30, 3, 38);
    ctx.fillRect(23, bodyY - 30, 3, 38);
    
    // "BIER" lettering
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText("BIER", 0, bodyY - 11);
    
    // 2. Limbs
    ctx.fillStyle = '#1c1c24'; // Black/grey legs
    ctx.fillRect(-14, bodyY + 8, 8, 30);
    ctx.fillRect(6, bodyY + 8, 8, 30);
    // Green soccer cleats
    ctx.fillStyle = '#39ff14';
    ctx.fillRect(-17, bodyY + 36, 12, 6);
    ctx.fillRect(5, bodyY + 36, 12, 6);
    
    // Arms
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(handLX + 3, bodyY - 18, 9, 25);
    ctx.fillRect(handRX - 12, bodyY - 18, 9, 25);
    
    // Giant brown/orange goalkeeper gloves!
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(handLX - 2, handLY + 18, 19, 15);
    ctx.fillRect(handRX - 17, handRY + 18, 19, 15);
    
    // 3. Head: Green Glass Beer Bottle neck
    ctx.fillStyle = '#2d5a27'; // green
    ctx.fillRect(-6, headY + 12, 12, 28); // neck
    // Gold cap
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-7, headY + 8, 14, 4);
    
    // Funny googly eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, headY + 17, 4, 4);
    ctx.fillRect(1, headY + 17, 4, 4);
    ctx.fillStyle = '#000000';
    ctx.fillRect(-4, headY + 18, 2, 2);
    ctx.fillRect(2, headY + 18, 2, 2);
    
    // Pink party hat!
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.moveTo(-6, headY + 8);
    ctx.lineTo(0, headY - 10);
    ctx.lineTo(6, headY + 8);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

function draw2DGoalie(type, goalieState, scaleX, scaleY) {
    ctx.save();
    ctx.translate(goalieX, goalieY);
    ctx.rotate(goalieAngle * Math.PI / 180);
    ctx.scale(goalieScaleX * scaleX, goalieScaleY * scaleY);
    
    const bounce = Math.sin(Date.now() / 150) * 3;
    const handBounce = Math.cos(Date.now() / 150) * 4;
    
    let bodyY = 0;
    let headY = -75;
    let handLY = -40;
    let handRY = -40;
    let handLX = -35;
    let handRX = 35;
    let legLY = 40;
    let legRY = 40;
    
    let jerseyColor = '#0055ff'; // Blue for Stien
    let skinColor = '#ffddaa';
    let gloveColor = '#ffcc00';
    let shortsColor = '#111111';
    
    if (type === 'margot') {
        jerseyColor = '#ff007f'; // Pink for Margot
        shortsColor = '#220022';
        gloveColor = '#39ff14'; // Neon Green
    }
    
    // Animation adjustments based on state
    if (goalieState === 'idle') {
        bodyY = bounce;
        headY += bounce * 0.8;
        handLY += handBounce;
        handRY -= handBounce;
    } else if (goalieState === 'crouching') {
        bodyY = 15;
        headY = -55;
        handLY = -20;
        handRY = -20;
        handLX = -45;
        handRX = 45;
    } else if (goalieState === 'diving') {
        bodyY = 0;
        headY = -75;
        // Hands extended
        handLX = -55;
        handRX = 55;
        handLY = -62;
        handRY = -62;
    } else if (goalieState === 'saved') {
        bodyY = Math.sin(Date.now() / 100) * 8 - 5;
        headY = -75 + bodyY;
        handLY = -90 + Math.sin(Date.now() / 100) * 6;
        handRY = -90 - Math.sin(Date.now() / 100) * 6;
        handLX = -20;
        handRX = 20;
    } else if (goalieState === 'failed') {
        bodyY = 25;
        headY = -25;
        handLY = 20;
        handRY = 20;
        handLX = -40;
        handRX = 40;
    }
    
    if (type === 'beer') {
        drawBeerCrateGoalieBody(ctx, bodyY, headY, handLX, handRX, handLY, handRY, goalieState);
    } else {
        // Draw Legs
        ctx.fillStyle = '#000000'; // Cleats
        ctx.fillRect(-22, legLY, 12, 10);
        ctx.fillRect(10, legRY, 12, 10);
        
        ctx.fillStyle = '#ffffff'; // Socks
        ctx.fillRect(-20, legLY - 15, 8, 15);
        ctx.fillRect(12, legRY - 15, 8, 15);
        
        // Shorts
        ctx.fillStyle = shortsColor;
        ctx.fillRect(-18, bodyY + 12, 36, 18);
        
        // Jersey torso
        ctx.fillStyle = jerseyColor;
        ctx.fillRect(-20, bodyY - 35, 40, 48);
        
        ctx.fillStyle = '#ffffff'; // Striped shirt design
        ctx.fillRect(-4, bodyY - 35, 8, 48);
        
        // Sleeves & arms
        ctx.fillStyle = jerseyColor;
        ctx.fillRect(handLX, bodyY - 30, 15, 18);
        ctx.fillRect(handRX - 15, bodyY - 30, 15, 18);
        
        ctx.fillStyle = skinColor;
        ctx.fillRect(handLX + 3, handLY, 10, 20);
        ctx.fillRect(handRX - 13, handRY, 10, 20);
        
        // Goalkeeper Gloves
        ctx.fillStyle = gloveColor;
        ctx.fillRect(handLX - 2, handLY + 18, 20, 16);
        ctx.fillRect(handRX - 18, handRY + 18, 20, 16);
        
        // Dynamic pixelated face
        const headImg = (type === 'margot') ? assets.margotHead : assets.stienHead;
        const pixelCanvas = (type === 'margot') ? margotHeadPixelCanvas : stienHeadPixelCanvas;
        
        if (pixelCanvas) {
            ctx.drawImage(pixelCanvas, -25, headY, 50, 55);
        } else if (headImg && headImg.complete) {
            ctx.drawImage(headImg, -25, headY, 50, 55);
        } else {
            ctx.fillStyle = skinColor;
            ctx.fillRect(-20, headY, 40, 42);
        }
        
        // Yellow Birthday Party Hat!
        ctx.fillStyle = '#ffdf00';
        ctx.beginPath();
        ctx.moveTo(-12, headY + 5);
        ctx.lineTo(0, headY - 25);
        ctx.lineTo(12, headY + 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(0, headY - 27, 4, 0, Math.PI*2);
        ctx.fill();
    }
    
    ctx.restore();
}

// --- Confetti Engine ---
function spawnConfetti() {
    confetti = [];
    const colors = ['#00f0ff', '#ff007f', '#ffdf00', '#39ff14', '#ffffff'];
    for (let i = 0; i < 120; i++) {
        confetti.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * -CANVAS_HEIGHT,
            size: Math.random() * 6 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5
        });
    }
}

function updateConfetti() {
    confetti.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;
        if (p.y > CANVAS_HEIGHT) {
            p.y = -10;
            p.x = Math.random() * CANVAS_WIDTH;
        }
    });
}

function drawConfetti() {
    confetti.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
    });
}

// --- Text Drawer ---
function drawRetroText(text, x, y, size = 10, color = '#fff', align = 'center') {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + 2, y + 2);
    
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

// --- Soccer Ball & Beer Crate Drawer ---
function drawSoccerBall(x, y, size, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(-size/3, -size/3, (size*2)/3, (size*2)/3);
    
    ctx.fillRect(-size, -size/4, size/3, size/2);
    ctx.fillRect(size - size/3, -size/4, size/3, size/2);
    ctx.fillRect(-size/4, -size, size/2, size/3);
    ctx.fillRect(-size/4, size - size/3, size/2, size/3);
    
    ctx.restore();
}

function drawBeerCrate(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(x, y, w, h);
    
    ctx.fillStyle = '#880000';
    ctx.fillRect(x + 4, y + 6, w - 8, h - 10);
    
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillRect(x + w - 3, y, 3, h);
    
    const cols = 4;
    const colWidth = (w - 8) / cols;
    ctx.fillStyle = '#5c3a21'; // Brown glass
    for (let c = 0; c < cols; c++) {
        const bx = x + 4 + (c * colWidth) + colWidth / 2 - 2;
        ctx.fillRect(bx, y - 5, 4, 11);
        ctx.fillStyle = '#ffd700'; // caps
        ctx.fillRect(bx - 1, y - 7, 6, 2);
        ctx.fillStyle = '#5c3a21';
    }
    
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText("BIER", x + w/2, y + h/2 + 2);
    
    ctx.restore();
}

// --- Main Layout Renderer ---
function drawPitchAndGoal() {
    ctx.fillStyle = '#227722';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Green grass fields stripes
    ctx.fillStyle = '#1e6b1e';
    for (let i = 0; i < CANVAS_HEIGHT; i += 30) {
        if (i > 420) {
            ctx.fillRect(0, i, CANVAS_WIDTH, 15);
        }
    }
    
    // Draw Background goal image (net & posts silhouette)
    if (assets.goal.complete) {
        ctx.drawImage(assets.goal, 0, 40, CANVAS_WIDTH, 420);
    } else {
        ctx.fillStyle = '#444455';
        ctx.fillRect(GOAL_LEFT, GOAL_TOP, GOAL_WIDTH, GOAL_HEIGHT);
    }
    
    // Draw animated rippling net grid over background
    updateNetPhysics();
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    // Draw horizontal net meshes
    for (let r = 0; r < NET_ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(netNodes[r][0].x, netNodes[r][0].y);
        for (let c = 1; c < NET_COLS; c++) {
            ctx.lineTo(netNodes[r][c].x, netNodes[r][c].y);
        }
        ctx.stroke();
    }
    // Draw vertical net meshes
    for (let c = 0; c < NET_COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(netNodes[0][c].x, netNodes[0][c].y);
        for (let r = 1; r < NET_ROWS; r++) {
            ctx.lineTo(netNodes[r][c].x, netNodes[r][c].y);
        }
        ctx.stroke();
    }
    ctx.restore();
    
    // White lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(80, 580);
    ctx.lineTo(720, 580);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(400, 580, 100, Math.PI, 0);
    ctx.stroke();
    
    // Penalty Spot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH/2, 530, 8, 0, Math.PI*2);
    ctx.fill();
    
    // Beer crate block
    if (gameState !== STATE_TITLE && gameState !== STATE_TEAM_SELECT && beerZone !== -1) {
        const zone = ZONES[beerZone];
        drawBeerCrate(zone.x + zone.w/2 - 30, zone.y + zone.h/2 - 15, 60, 40);
    }
}

// Draw white goal posts on top of net and goalies
function drawGoalFrame() {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    // Left post
    ctx.fillRect(GOAL_LEFT - 12, GOAL_TOP - 12, 16, GOAL_BOTTOM - GOAL_TOP + 12);
    ctx.strokeRect(GOAL_LEFT - 12, GOAL_TOP - 12, 16, GOAL_BOTTOM - GOAL_TOP + 12);
    
    // Right post
    ctx.fillRect(GOAL_RIGHT - 4, GOAL_TOP - 12, 16, GOAL_BOTTOM - GOAL_TOP + 12);
    ctx.strokeRect(GOAL_RIGHT - 4, GOAL_TOP - 12, 16, GOAL_BOTTOM - GOAL_TOP + 12);
    
    // Crossbar
    ctx.fillRect(GOAL_LEFT - 12, GOAL_TOP - 12, GOAL_RIGHT - GOAL_LEFT + 24, 16);
    ctx.strokeRect(GOAL_LEFT - 12, GOAL_TOP - 12, GOAL_RIGHT - GOAL_LEFT + 24, 16);
    
    ctx.restore();
}

function drawScoreboard() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.lineTo(CANVAS_WIDTH, 50);
    ctx.stroke();
    
    const goalie1 = CHARACTERS.find(c => c.id === p1Goalie).name;
    const goalie2 = CHARACTERS.find(c => c.id === p2Goalie).name;
    
    drawRetroText(`${player1Name} (${goalie1})`, 10, 25, 8, activeKicker === 1 ? '#ffdf00' : '#ffffff', 'left');
    drawRetroText(`(${goalie2}) ${player2Name}`, 790, 25, 8, activeKicker === 2 ? '#ffdf00' : '#ffffff', 'right');
    
    const maxSpacing = 20;
    const spacing = Math.min(maxSpacing, Math.floor(190 / totalAttempts));
    const p1Start = 345 - (totalAttempts * spacing);
    const p2Start = 455;
    
    for (let i = 0; i < totalAttempts; i++) {
        drawScoreIcon(p1Start + (i * spacing), 25, p1Score[i]);
        drawScoreIcon(p2Start + (i * spacing), 25, p2Score[i]);
    }
    
    const tryText = totalAttempts > 5 ? `SUDDEN DEATH TRY ${currentRound + 1}` : `TRY ${currentRound + 1}/${totalAttempts}`;
    drawRetroText(tryText, CANVAS_WIDTH/2, 25, totalAttempts > 5 ? 7 : 8, '#ff9900', 'center');
}

function drawScoreIcon(x, y, status) {
    ctx.save();
    if (status === 'goal') {
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 3, y - 1, 2, 4);
        ctx.fillRect(x - 1, y + 1, 2, 2);
        ctx.fillRect(x + 1, y - 3, 2, 6);
    } else if (status === 'miss') {
        ctx.fillStyle = '#ff073a';
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 3, y - 3, 2, 2);
        ctx.fillRect(x + 1, y - 3, 2, 2);
        ctx.fillRect(x - 1, y - 1, 2, 2);
        ctx.fillRect(x - 3, y + 1, 2, 2);
        ctx.fillRect(x + 1, y + 1, 2, 2);
    } else {
        ctx.fillStyle = '#555555';
        ctx.fillRect(x - 4, y - 4, 8, 8);
    }
    ctx.restore();
}

function drawAimCursor() {
    ctx.save();
    const pulseColor = Math.floor(Date.now() / 150) % 2 === 0 ? '#ff007f' : '#00f0ff';
    ctx.strokeStyle = pulseColor;
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.arc(aimX, aimY, 20, 0, Math.PI*2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(aimX - 30, aimY);
    ctx.lineTo(aimX + 30, aimY);
    ctx.moveTo(aimX, aimY - 30);
    ctx.lineTo(aimX, aimY + 30);
    ctx.stroke();
    ctx.restore();
}

// --- State Handlers ---

function handleTitleScreen() {
    ctx.fillStyle = '#227722';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#1b5e1b';
    for (let x = 0; x < CANVAS_WIDTH; x += 100) {
        ctx.fillRect(x + (Date.now() / 50) % 100 - 100, 0, 50, CANVAS_HEIGHT);
    }
    
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (assets.logo.complete) {
        ctx.drawImage(assets.logo, CANVAS_WIDTH/2 - 120, 60, 240, 230);
    } else {
        drawRetroText("BAKVOETBAL", CANVAS_WIDTH/2, 120, 30, '#ff007f');
        drawRetroText("THE GAME", CANVAS_WIDTH/2, 180, 24, '#00f0ff');
    }
    
    const color = Math.floor(Date.now() / 400) % 2 === 0 ? '#ffdf00' : '#ffffff';
    drawRetroText("HAPPY BIRTHDAY STIEN & MARGOT!", CANVAS_WIDTH/2, 340, 10, color);
    
    if (Math.floor(Date.now() / 600) % 2 === 0) {
        drawRetroText("PRESS SPACE TO PLAY", CANVAS_WIDTH/2, 420, 12, '#39ff14');
    }
    
    drawRetroText("2-PLAYER BIRTHDAY SHOWDOWN", CANVAS_WIDTH/2, 490, 8, '#aaa');
    drawRetroText("USE [SPACE] OR VIRTUAL BUTTONS TO SHOOT", CANVAS_WIDTH/2, 520, 8, '#888');
    drawRetroText("ACTIVE WORKSPACE: ANIMATED GOAL NET & BODIES", CANVAS_WIDTH/2, 550, 7, '#666');
}

function handleTeamSelectScreen() {
    ctx.fillStyle = '#15151c';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    const titleText = charSelectState === 'p1' ? "PLAYER 1: SELECT GOALIE" : "PLAYER 2: SELECT GOALIE";
    const titleColor = charSelectState === 'p1' ? '#00f0ff' : '#ff007f';
    drawRetroText(titleText, CANVAS_WIDTH/2, 80, 14, titleColor);
    
    // Draw 3 selectable goalie cards
    for (let i = 0; i < CHARACTERS.length; i++) {
        const char = CHARACTERS[i];
        const x = 70 + (i * 230);
        const y = 140;
        const w = 200;
        const h = 320;
        
        ctx.fillStyle = '#222230';
        ctx.fillRect(x, y, w, h);
        
        // Highlights border
        const isHovered = (charSelectHoverIndex === i);
        if (isHovered) {
            ctx.strokeStyle = titleColor;
            ctx.lineWidth = 4;
            // Flashing glow
            if (Math.floor(Date.now() / 150) % 2 === 0) {
                ctx.strokeStyle = '#ffffff';
            }
        } else {
            ctx.strokeStyle = '#44445c';
            ctx.lineWidth = 2;
        }
        ctx.strokeRect(x, y, w, h);
        
        // Check if already selected by other player
        if (charSelectState === 'p2' && p1Goalie === char.id) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x, y, w, h);
            drawRetroText("P1 SELECTED", x + w/2, y + h/2, 8, '#ff9900');
        }
        
        // Character Info
        drawRetroText(char.name, x + w/2, y + 30, 10, char.color);
        
        // Goalie body preview in card
        ctx.save();
        ctx.translate(x + w/2, y + 150);
        // Draw 2D Goalie Body preview
        ctx.scale(0.8, 0.8);
        
        // Bouncing animation preview
        const bounce = Math.sin(Date.now() / 150 + i) * 3;
        let pBodyY = bounce;
        let pHeadY = -75 + bounce * 0.8;
        let pHandLX = -35;
        let pHandRX = 35;
        
        if (char.id === 'beer') {
            drawBeerCrateGoalieBody(ctx, pBodyY, pHeadY, pHandLX, pHandRX, -40, -40, 'idle');
        } else {
            ctx.fillStyle = '#ffffff'; // socks
            ctx.fillRect(-20, 25, 8, 15);
            ctx.fillRect(12, 25, 8, 15);
            ctx.fillStyle = char.id === 'stien' ? '#0055ff' : '#ff007f';
            ctx.fillRect(-20, pBodyY - 35, 40, 48); // torso
            ctx.fillRect(pHandLX, pBodyY - 30, 15, 18); // sleeve L
            ctx.fillRect(pHandRX - 15, pBodyY - 30, 15, 18); // sleeve R
            ctx.fillStyle = '#ffddaa';
            ctx.fillRect(pHandLX + 3, -40, 10, 20);
            ctx.fillRect(pHandRX - 13, -40, 10, 20);
            ctx.fillStyle = '#ffcc00'; // gloves
            ctx.fillRect(pHandLX - 2, -22, 20, 16);
            ctx.fillRect(pHandRX - 18, -22, 20, 16);
            
            // Head preview
            const pHeadImg = char.id === 'stien' ? assets.stienHead : assets.margotHead;
            const pPixel = char.id === 'stien' ? stienHeadPixelCanvas : margotHeadPixelCanvas;
            if (pPixel) {
                ctx.drawImage(pPixel, -25, pHeadY, 50, 55);
            } else if (pHeadImg && pHeadImg.complete) {
                ctx.drawImage(pHeadImg, -25, pHeadY, 50, 55);
            }
        }
        ctx.restore();
        
        // Stats
        drawRetroText(`REACH: ${char.reach}`, x + w/2, y + 250, 7, '#aaa');
        drawRetroText(`SPEED: ${char.speed}`, x + w/2, y + 270, 7, '#aaa');
        drawRetroText(`BEER: ${char.beerPower}`, x + w/2, y + 290, 7, '#ffcc00');
    }
    
    // Help
    drawRetroText("CLICK TO SELECT OR PRESS SPACE TO LOCK", CANVAS_WIDTH/2, 500, 8, '#ffffff');
    drawRetroText("USE JOYSTICK OR LEFT/RIGHT ARROWS TO MOVE CURSOR", CANVAS_WIDTH/2, 530, 7, '#666');
}

function handleReadyScreen() {
    drawPitchAndGoal();
    drawScoreboard();
    
    // Reset Goalie variables
    goalieX = CANVAS_WIDTH / 2;
    goalieY = 330;
    goalieAngle = 0;
    goalieScaleX = 1;
    goalieScaleY = 1;
    goalieState = 'idle';
    
    const defendingGoalie = activeKicker === 1 ? p2Goalie : p1Goalie;
    draw2DGoalie(defendingGoalie, goalieState, 1, 1);
    drawGoalFrame();
    
    drawSoccerBall(ballX, ballY, ballSize, 0);
    
    // Announcement Banner
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 200, CANVAS_WIDTH, 200);
    ctx.strokeStyle = '#ffdf00';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 200, CANVAS_WIDTH, 200);
    
    const shooter = activeKicker === 1 ? player1Name : player2Name;
    const goalieCharName = CHARACTERS.find(c => c.id === defendingGoalie).name;
    const color = activeKicker === 1 ? '#00f0ff' : '#ff007f';
    
    drawRetroText("GET READY!", CANVAS_WIDTH/2, 240, 16, '#ffdf00');
    drawRetroText(`${shooter} KICKS!`, CANVAS_WIDTH/2, 290, 12, color);
    drawRetroText(`GOALIE: ${goalieCharName}`, CANVAS_WIDTH/2, 330, 10, '#ffffff');
    
    if (Math.floor(Date.now() / 400) % 2 === 0) {
        drawRetroText("PRESS SPACE TO AIM", CANVAS_WIDTH/2, 370, 8, '#39ff14');
    }
}

function handleAimH() {
    drawPitchAndGoal();
    drawScoreboard();
    const defendingGoalie = activeKicker === 1 ? p2Goalie : p1Goalie;
    
    // Crouch goalie in anticipation
    goalieState = 'crouching';
    draw2DGoalie(defendingGoalie, goalieState, 1, 1);
    drawGoalFrame();
    
    drawSoccerBall(ballX, ballY, ballSize, 0);
    
    // Move aim cursor X
    aimX += aimSpeedX * aimDirX;
    if (aimX > GOAL_RIGHT - 20) {
        aimX = GOAL_RIGHT - 20;
        aimDirX = -1;
    }
    if (aimX < GOAL_LEFT + 20) {
        aimX = GOAL_LEFT + 20;
        aimDirX = 1;
    }
    
    drawAimCursor();
    drawRetroText("LOCK HORIZONTAL TARGET", CANVAS_WIDTH/2, 80, 8, '#00f0ff');
}

function handleAimV() {
    drawPitchAndGoal();
    drawScoreboard();
    const defendingGoalie = activeKicker === 1 ? p2Goalie : p1Goalie;
    
    goalieState = 'crouching';
    draw2DGoalie(defendingGoalie, goalieState, 1, 1);
    drawGoalFrame();
    
    drawSoccerBall(ballX, ballY, ballSize, 0);
    
    aimY += aimSpeedY * aimDirY;
    if (aimY > GOAL_BOTTOM - 20) {
        aimY = GOAL_BOTTOM - 20;
        aimDirY = -1;
    }
    if (aimY < GOAL_TOP + 20) {
        aimY = GOAL_TOP + 20;
        aimDirY = 1;
    }
    
    drawAimCursor();
    drawRetroText("LOCK VERTICAL TARGET", CANVAS_WIDTH/2, 80, 8, '#ff007f');
}

function handleKickState() {
    drawPitchAndGoal();
    drawScoreboard();
    const defendingGoalie = activeKicker === 1 ? p2Goalie : p1Goalie;
    
    ballProgress += 0.04; // travel speed
    if (ballProgress > 1) ballProgress = 1;
    
    const currentBallSize = ballSize * (1 - ballProgress * 0.45);
    const currentBallX = ballX + (ballTargetX - ballX) * ballProgress;
    const arcHeight = 70 * Math.sin(ballProgress * Math.PI);
    const currentBallY = ballY + (ballTargetY - ballY) * ballProgress - arcHeight;
    ballRotation += 0.15;
    
    // Goalie diving physics
    let currentGoalieX = goalieX;
    let currentGoalieY = goalieY;
    
    if (goalieDiveZone !== -1) {
        const zone = ZONES[goalieDiveZone];
        const targetGoalieX = zone.x + zone.w / 2;
        const targetGoalieY = zone.y + zone.h / 2;
        
        currentGoalieX = CANVAS_WIDTH/2 + (targetGoalieX - CANVAS_WIDTH/2) * Math.min(ballProgress * 1.35, 1);
        currentGoalieY = 320 + (targetGoalieY - 320) * Math.min(ballProgress * 1.35, 1);
        
        // Goalie diving rotation
        if (goalieDiveZone === 0 || goalieDiveZone === 3) {
            goalieAngle = -80 * Math.min(ballProgress * 1.35, 1); // dive left
        } else if (goalieDiveZone === 2 || goalieDiveZone === 5) {
            goalieAngle = 80 * Math.min(ballProgress * 1.35, 1);  // dive right
        } else if (goalieDiveZone === 1) {
            goalieAngle = 0; // jump center-up
        } else if (goalieDiveZone === 4) {
            goalieAngle = 0; // crouch center-down
        }
    }
    
    goalieX = currentGoalieX;
    goalieY = currentGoalieY;
    
    draw2DGoalie(defendingGoalie, goalieState, 1, 1);
    drawGoalFrame();
    
    drawSoccerBall(currentBallX, currentBallY, currentBallSize, ballRotation);
    
    if (ballProgress >= 1) {
        evaluateShotResult();
    }
}

let resultBannerText = "";
let resultBannerColor = "";
let resultStatus = "";

function evaluateShotResult() {
    let ballZone = -1;
    for (let i = 0; i < ZONES.length; i++) {
        const z = ZONES[i];
        if (ballTargetX >= z.x && ballTargetX <= z.x + z.w &&
            ballTargetY >= z.y && ballTargetY <= z.y + z.h) {
            ballZone = i;
            break;
        }
    }
    
    // Check post/crossbar collisions
    const hitLeftPost = Math.abs(ballTargetX - GOAL_LEFT) < 14 && ballTargetY >= GOAL_TOP - 10 && ballTargetY <= GOAL_BOTTOM;
    const hitRightPost = Math.abs(ballTargetX - GOAL_RIGHT) < 14 && ballTargetY >= GOAL_TOP - 10 && ballTargetY <= GOAL_BOTTOM;
    const hitCrossbar = Math.abs(ballTargetY - GOAL_TOP) < 14 && ballTargetX >= GOAL_LEFT - 10 && ballTargetX <= GOAL_RIGHT + 10;
    
    // 1. BEER CRATE COLLISION
    if (ballZone === beerZone) {
        playBeerSound();
        triggerScreenShake(20, 10);
        resultBannerText = "BEER BLOCKED!";
        resultBannerColor = '#ffdf00';
        resultStatus = 'miss';
        goalieState = 'saved';
        
        // Ripple net slightly from rebound
        triggerNetImpact(ballTargetX, ballTargetY, 8);
    }
    // 2. GOALPOST HIT
    else if (hitLeftPost || hitRightPost || hitCrossbar) {
        playSaveSound();
        triggerScreenShake(25, 12); // Shake screen
        resultBannerText = hitCrossbar ? "CROSSBAR CLANG!" : "POST CLANK!";
        resultBannerColor = '#ff5500';
        resultStatus = 'miss';
        goalieState = 'saved';
        
        // Shake net nodes on edges
        triggerNetImpact(ballTargetX, ballTargetY, 12);
    }
    // 3. GOALIE SAVE
    else if (ballZone === goalieDiveZone) {
        playSaveSound();
        resultBannerText = "SAVED!";
        resultBannerColor = '#00f0ff';
        resultStatus = 'miss';
        goalieState = 'saved';
    }
    // 4. SHOT WIDE
    else if (ballTargetX < GOAL_LEFT || ballTargetX > GOAL_RIGHT ||
             ballTargetY < GOAL_TOP || ballTargetY > GOAL_BOTTOM) {
        playSaveSound();
        resultBannerText = "OUT OF GOAL!";
        resultBannerColor = '#ff073a';
        resultStatus = 'miss';
        goalieState = 'saved';
    }
    // 5. GOAL SCORED!
    else {
        playGoalSound();
        resultBannerText = "GOAL!!!";
        resultBannerColor = '#39ff14';
        resultStatus = 'goal';
        goalieState = 'failed';
        
        // Ripple goal net using mass-spring grid push
        triggerNetImpact(ballTargetX, ballTargetY, 18);
        
        canvas.classList.add('flash-screen');
        setTimeout(() => canvas.classList.remove('flash-screen'), 300);
    }
    
    if (activeKicker === 1) {
        p1Score.push(resultStatus);
    } else {
        p2Score.push(resultStatus);
    }
    
    gameState = STATE_RESULT;
    
    setTimeout(() => {
        advanceRound();
    }, 2500);
}

function handleResultScreen() {
    drawPitchAndGoal();
    drawScoreboard();
    
    const defendingGoalie = activeKicker === 1 ? p2Goalie : p1Goalie;
    draw2DGoalie(defendingGoalie, goalieState, 1, 1);
    drawGoalFrame();
    
    if (resultStatus === 'goal') {
        drawSoccerBall(ballTargetX, ballTargetY, ballSize * 0.55, ballRotation);
    } else {
        if (resultBannerText === "BEER BLOCKED!" || resultBannerText.includes("CLANK") || resultBannerText.includes("CLANG")) {
            // Ball bounce away from obstacles/post
            drawSoccerBall(ballTargetX + 25, ballTargetY + 45, ballSize * 0.7, ballRotation);
        } else {
            // Caught by goalie
            drawSoccerBall(goalieX, goalieY + 20, ballSize * 0.6, 0);
        }
    }
    
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 220, CANVAS_WIDTH, 140);
    ctx.strokeStyle = resultBannerColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(-5, 220, CANVAS_WIDTH + 10, 140);
    
    drawRetroText(resultBannerText, CANVAS_WIDTH/2, 290, 22, resultBannerColor);
}

function advanceRound() {
    if (activeKicker === 2) {
        currentRound++;
    }
    
    activeKicker = activeKicker === 1 ? 2 : 1;
    
    const p1Shots = p1Score.length;
    const p2Shots = p2Score.length;
    const p1Goals = p1Score.filter(s => s === 'goal').length;
    const p2Goals = p2Score.filter(s => s === 'goal').length;
    
    const p1Remaining = totalAttempts - p1Shots;
    const p2Remaining = totalAttempts - p2Shots;
    
    let isGameOver = (p1Shots >= totalAttempts && p2Shots >= totalAttempts) ||
                       (p1Goals > p2Goals + p2Remaining) || 
                       (p2Goals > p1Goals + p1Remaining);
                       
    // Sudden Death Rule: If attempts are complete but scores are tied, continue shooting
    if (isGameOver && p1Goals === p2Goals) {
        totalAttempts++;
        isGameOver = false; // Override game over to continue in Sudden Death
    }
                       
    if (isGameOver) {
        gameState = STATE_GAME_OVER;
        stopMenuMusic();
        spawnConfetti();
        if (audioEnabled) {
            playGoalSound();
            setTimeout(() => playGoalSound(), 800);
        }
    } else {
        ballX = CANVAS_WIDTH / 2;
        ballY = 530;
        ballProgress = 0;
        beerZone = Math.floor(Math.random() * ZONES.length);
        initNet(); // Reset net
        gameState = STATE_READY;
    }
}

function handleGameOverScreen() {
    updateConfetti();
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawConfetti();
    
    drawRetroText("MATCH OVER!", CANVAS_WIDTH/2, 60, 20, '#ffdf00');
    
    ctx.fillStyle = '#1b1b26';
    ctx.fillRect(150, 110, 500, 150);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(150, 110, 500, 150);
    
    const p1Goals = p1Score.filter(s => s === 'goal').length;
    const p2Goals = p2Score.filter(s => s === 'goal').length;
    
    drawRetroText(player1Name, 260, 140, 10, '#00f0ff');
    drawRetroText(player2Name, 540, 140, 10, '#ff007f');
    drawRetroText(`${p1Goals}`, 260, 195, 28, '#00f0ff');
    drawRetroText("-", CANVAS_WIDTH/2, 195, 24, '#ffffff');
    drawRetroText(`${p2Goals}`, 540, 195, 28, '#ff007f');
    
    let winnerText = "";
    let winnerColor = "";
    if (p1Goals > p2Goals) {
        winnerText = `${player1Name} WINS!`;
        winnerColor = '#00f0ff';
    } else if (p2Goals > p1Goals) {
        winnerText = `${player2Name} WINS!`;
        winnerColor = '#ff007f';
    } else {
        winnerText = "IT'S A DRAW!";
        winnerColor = '#ffdf00';
    }
    drawRetroText(winnerText, CANVAS_WIDTH/2, 300, 16, winnerColor);
    
    ctx.fillStyle = '#222230';
    ctx.fillRect(100, 340, 600, 140);
    ctx.strokeStyle = '#ffdf00';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 340, 600, 140);
    
    drawRetroText("★ BIRTHDAY CARD ★", CANVAS_WIDTH/2, 370, 9, '#ffdf00');
    drawRetroText("Fijne verjaardag Stien en Margot!", CANVAS_WIDTH/2, 405, 8, '#ffffff');
    drawRetroText("Keep scoring and drinking crates of beer!", CANVAS_WIDTH/2, 435, 7, '#39ff14');
    drawRetroText("Enjoy your awesome birthday soccer showdown!", CANVAS_WIDTH/2, 455, 7, '#00f0ff');
    
    if (Math.floor(Date.now() / 500) % 2 === 0) {
        drawRetroText("PRESS SPACE TO REMATCH", CANVAS_WIDTH/2, 530, 10, '#ffffff');
    }
    
    drawRetroText("BAKVOETBAL THE GAME • 2026", CANVAS_WIDTH/2, 570, 7, '#666');
}

// --- Input & Character Selection Logic ---

function handleShootAction() {
    initAudio();
    
    if (gameState === STATE_TITLE) {
        playTone(523.25, 0.15, 'square', 0.15);
        charSelectState = 'p1';
        charSelectHoverIndex = 0;
        gameState = STATE_TEAM_SELECT;
    } 
    else if (gameState === STATE_TEAM_SELECT) {
        playTone(659.25, 0.12, 'square', 0.15);
        if (charSelectState === 'p1') {
            p1Goalie = CHARACTERS[charSelectHoverIndex].id;
            charSelectState = 'p2';
            // Default select next option to avoid double lock
            charSelectHoverIndex = (charSelectHoverIndex + 1) % CHARACTERS.length;
        } else {
            p2Goalie = CHARACTERS[charSelectHoverIndex].id;
            
            // Start game scores
            p1Score = [];
            p2Score = [];
            currentRound = 0;
            activeKicker = 1;
            totalAttempts = 5; // Reset total attempts back to standard
            beerZone = Math.floor(Math.random() * ZONES.length);
            
            stopMenuMusic();
            initNet();
            gameState = STATE_READY;
        }
    }
    else if (gameState === STATE_READY) {
        playTone(440.00, 0.1, 'sine', 0.15);
        aimX = CANVAS_WIDTH / 2;
        aimY = (GOAL_TOP + GOAL_BOTTOM) / 2;
        gameState = STATE_AIM_H;
    }
    else if (gameState === STATE_AIM_H) {
        playTone(523.25, 0.08, 'sine', 0.15);
        selectedAimX = aimX;
        gameState = STATE_AIM_V;
    }
    else if (gameState === STATE_AIM_V) {
        selectedAimY = aimY;
        
        ballTargetX = selectedAimX;
        ballTargetY = selectedAimY;
        ballProgress = 0;
        
        // Goalie AI Dive Decider
        // Find player target zone
        let playerTargetZone = -1;
        for (let i = 0; i < ZONES.length; i++) {
            const z = ZONES[i];
            if (ballTargetX >= z.x && ballTargetX <= z.x + z.w &&
                ballTargetY >= z.y && ballTargetY <= z.y + z.h) {
                playerTargetZone = i;
                break;
            }
        }
        
        // Semi-predictive AI: Guess rate depends on Goalie character reach stats
        // Margot (Reach 9): 32% guess rate -> ~47% score rate
        // Stien (Reach 8): 28% guess rate -> ~50% score rate
        // Beer Goalie (Reach 6): 20% guess rate -> ~55% score rate
        // Average guess rate (~28%) yields an overall 1-in-2 (50%) scoring chance
        const activeGoalieChar = (activeKicker === 1) ? p2Goalie : p1Goalie;
        let guessRate = 0.28;
        if (activeGoalieChar === 'margot') {
            guessRate = 0.32;
        } else if (activeGoalieChar === 'beer') {
            guessRate = 0.20;
        }
        
        if (playerTargetZone !== -1 && Math.random() < guessRate) {
            goalieDiveZone = playerTargetZone;
        } else {
            goalieDiveZone = Math.floor(Math.random() * ZONES.length);
        }
        goalieState = 'diving';
        
        playKickSound();
        gameState = STATE_KICK;
    }
    else if (gameState === STATE_GAME_OVER) {
        playTone(523.25, 0.15, 'square', 0.15);
        charSelectState = 'p1';
        charSelectHoverIndex = 0;
        gameState = STATE_TEAM_SELECT;
    }
}

// Arrow keys for character selection
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        handleShootAction();
    }
    
    if (gameState === STATE_TEAM_SELECT) {
        if (e.code === 'ArrowLeft') {
            playTone(220, 0.05, 'sine', 0.1);
            charSelectHoverIndex = (charSelectHoverIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
        }
        if (e.code === 'ArrowRight') {
            playTone(220, 0.05, 'sine', 0.1);
            charSelectHoverIndex = (charSelectHoverIndex + 1) % CHARACTERS.length;
        }
    }
});

// Touch listeners for instant mobile response
btnShoot.addEventListener('touchstart', (e) => {
    e.preventDefault();
    btnShoot.classList.add('active');
    setTimeout(() => btnShoot.classList.remove('active'), 150);
    handleShootAction();
}, { passive: false });

btnAudio.addEventListener('touchstart', (e) => {
    e.preventDefault();
    toggleAudio();
}, { passive: false });

// Virtual button shoot click
btnShoot.addEventListener('click', () => {
    btnShoot.classList.add('active');
    setTimeout(() => btnShoot.classList.remove('active'), 150);
    handleShootAction();
});

// Touch selection listener for mobile Canvas
canvas.addEventListener('touchstart', (e) => {
    if (gameState !== STATE_TEAM_SELECT) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    for (let i = 0; i < CHARACTERS.length; i++) {
        const cardX = 70 + (i * 230);
        const cardY = 140;
        const cardW = 200;
        const cardH = 320;
        
        if (canvasX >= cardX && canvasX <= cardX + cardW &&
            canvasY >= cardY && canvasY <= cardY + cardH) {
            
            if (charSelectState === 'p2' && p1Goalie === CHARACTERS[i].id) {
                playTone(150, 0.2, 'sawtooth', 0.2);
                return;
            }
            
            playTone(440, 0.08, 'sine', 0.15);
            charSelectHoverIndex = i;
            handleShootAction();
            break;
        }
    }
}, { passive: false });

// Click selection listener directly on Canvas
canvas.addEventListener('click', (e) => {
    if (gameState !== STATE_TEAM_SELECT) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale coordinates back to canvas dimensions (800x600)
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Check if clicked inside any card
    for (let i = 0; i < CHARACTERS.length; i++) {
        const cardX = 70 + (i * 230);
        const cardY = 140;
        const cardW = 200;
        const cardH = 320;
        
        if (canvasX >= cardX && canvasX <= cardX + cardW &&
            canvasY >= cardY && canvasY <= cardY + cardH) {
            
            // Can't choose same character already selected by P1
            if (charSelectState === 'p2' && p1Goalie === CHARACTERS[i].id) {
                playTone(150, 0.2, 'sawtooth', 0.2); // Denied buzzer sound
                return;
            }
            
            playTone(440, 0.08, 'sine', 0.15);
            charSelectHoverIndex = i;
            handleShootAction(); // lock in selection
            break;
        }
    }
});

// --- Main Engine Loop ---
function gameLoop() {
    ctx.save();
    
    // Apply retro screen shake
    if (shakeTime > 0) {
        const dx = (Math.random() - 0.5) * shakeAmount;
        const dy = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(dx, dy);
        shakeTime--;
    }
    
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.imageSmoothingEnabled = false;
    
    switch (gameState) {
        case STATE_TITLE:
            handleTitleScreen();
            break;
        case STATE_TEAM_SELECT:
            handleTeamSelectScreen();
            break;
        case STATE_READY:
            handleReadyScreen();
            break;
        case STATE_AIM_H:
            handleAimH();
            break;
        case STATE_AIM_V:
            handleAimV();
            break;
        case STATE_KICK:
            handleKickState();
            break;
        case STATE_RESULT:
            handleResultScreen();
            break;
        case STATE_GAME_OVER:
            handleGameOverScreen();
            break;
    }
    
    ctx.restore();
    requestAnimationFrame(gameLoop);
}

// Launch loop
requestAnimationFrame(gameLoop);
