const ZONE_SETTINGS = {
  top: { color: [255, 220, 80] },    // yellow
  bottom: { color: [90, 160, 255] }, // blue
  left: { color: [255, 90, 90] },    // red
  right: { color: [90, 255, 150] },  // green
};

const ZONE_KEYS = ["top", "bottom", "left", "right"];

const GAME_CONFIG = {
  // timing: main interaction timing
  timing: {
    joinWindowMs: 350,
    chargeDurationMs: 800,
    activeDurationMs: 1500,
    connectionFinishedFadeMs: 700,
    resetAfterMs: 20000,
  },
  // spawn: controls how many balls appear and how often
  spawn: {
    baseSpawnIntervalMs: 1450,
    minSpawnIntervalMs: 1450,
    maxSpawnIntervalMs: 2100,
    spawnIntervalPerDifficulty: 95,
    maxBalls: 14,
    initialBallCount: 5,
    spawnJitterMinMs: -160,
    spawnJitterMaxMs: 220,
  },
  // ballSpeed: controls ball movement
  ballSpeed: {
    large: { min: 0.8, max: 1.3 },
    medium: { min: 1.35, max: 2.05 },
    small: { min: 2.15, max: 3.15 },
    tail: { min: 1.7, max: 2.5 },
    baseMultiplier: 1.15,
    difficultySpeedStep: 0.08,
    maxSpeedMultiplier: 1.8,
    smallEvolutionMultiplier: 1.35,
  },
  // scoring: points and penalties
  scoring: {
    largeBase: 2,
    largeStageOne: 3,
    largeStageTwo: 4,
    medium: 3,
    small: 4,
    tail: 8,
    qteFailPenalty: 4,
    connectionFailPenalty: 2,
  },
  // progression: unlock/evolution thresholds
  progression: {
    largeStageOneDestroyedCount: 5,
    largeStageTwoDestroyedCount: 15,
    mediumIndestructibleAfter: 10,
    mediumIndestructibleChance: 0.25,
    smallSpeedBoostAfter: 15,
    smallSpeedBoostMultiplier: 1.35,
    difficultyScoreStep: 10,
    tailVulnerableDurationMs: 3000,
  },
  // qte: controls Quick Time Event pacing and filtering
  qte: {
    nextEventDelayMs: 15000,
    activeDurationMs: 10000,
    feedbackDurationMs: 2400,
    playerMemoryWindowMs: 25000,
    playerCapacityStableMs: {
      threePlayers: 6000,
      fourPlayers: 10000,
    },
  },
  // zones: controls player touch area geometry
  zones: {
    lengthRatio: 0.58,
    depthRatio: 0.12,
    bevelRatio: 0.075,
    cornerRadiusRatio: 0.018,
    strokeWeight: 2,
  },
  // visuals: tweakable presentation values (no gameplay effect)
  visuals: {
    centralScore: {
      opacity: 64,
      baseSizeRatio: 0.24,
      perDigitReduceRatio: 0.028,
      minSizeRatio: 0.18,
      maxSizeRatio: 0.28,
    },
    soloTouch: {
      pulseBase: 1.075,
      pulseAmplitude: 0.075,
      pulseSpeed: 0.08,
      coreRadius: 8,
      coreAlpha: 172,
      ringCount: 4,
      ringSpacing: 8,
      ringStartRadius: 14,
      ringStrokeWeight: 1.35,
      ringAlphaBase: 108,
      ringAlphaFalloff: 18,
    },
  },
  // audio: background music settings
  audio: {
    musicVolume: 0.4,
    musicPath: "MUSIC/music.mp3",
  },
};

const CONNECTION_JOIN_WINDOW_MS = GAME_CONFIG.timing.joinWindowMs;
const CONNECTION_CHARGE_MS = GAME_CONFIG.timing.chargeDurationMs;
const CONNECTION_ACTIVE_MS = GAME_CONFIG.timing.activeDurationMs;
const CONNECTION_FINISHED_FADE_MS = GAME_CONFIG.timing.connectionFinishedFadeMs;
const INACTIVITY_RESET_MS = GAME_CONFIG.timing.resetAfterMs;

const BALL_SPAWN_MS = GAME_CONFIG.spawn.baseSpawnIntervalMs;
const MAX_BALLS = GAME_CONFIG.spawn.maxBalls;
const START_BALLS = GAME_CONFIG.spawn.initialBallCount;
const SMALL_EVOLUTION_SPEED_MULTIPLIER = GAME_CONFIG.progression.smallSpeedBoostMultiplier;
const SPEED_MULTIPLIER_PER_DIFFICULTY = GAME_CONFIG.ballSpeed.difficultySpeedStep;
const MAX_GLOBAL_SPEED_MULTIPLIER = GAME_CONFIG.ballSpeed.maxSpeedMultiplier;
const SPAWN_INTERVAL_PER_DIFFICULTY = GAME_CONFIG.spawn.spawnIntervalPerDifficulty;
const MAX_SPAWN_INTERVAL_MS = GAME_CONFIG.spawn.maxSpawnIntervalMs;
const BASE_BALL_SPEED_MULTIPLIER = GAME_CONFIG.ballSpeed.baseMultiplier;
const QTE_INTERVAL_MS = GAME_CONFIG.qte.nextEventDelayMs;
const QTE_FAIL_PENALTY = GAME_CONFIG.scoring.qteFailPenalty;
const ACTIVE_ZONE_MEMORY_MS = GAME_CONFIG.qte.playerMemoryWindowMs;
const PLAYER3_STABLE_MS = GAME_CONFIG.qte.playerCapacityStableMs.threePlayers;
const PLAYER4_STABLE_MS = GAME_CONFIG.qte.playerCapacityStableMs.fourPlayers;
const ZONE_MAIN_LENGTH_RATIO = GAME_CONFIG.zones.lengthRatio;
const ZONE_DEPTH_RATIO = GAME_CONFIG.zones.depthRatio;
const ZONE_CORNER_RADIUS = GAME_CONFIG.zones.cornerRadiusRatio; // relative to base=min(width,height)
const ZONE_STROKE_WEIGHT = GAME_CONFIG.zones.strokeWeight;

let gameCanvas;
let zonePolygons = {};
let zoneMetrics = { topBottomHeight: 0, sideZoneInsetY: 0 };
let zoneOccupants = { top: null, bottom: null, left: null, right: null };

let activePointers = new Map(); // pointerId -> { x, y, zone }
let connections = [];
let successfulTrails = [];
let balls = [];
let burstParticles = [];
let ambientStars = [];
let ambientLinks = [];
let ambientNodes = [];
let ambientClusters = [];

let score = 0;
let nextConnectionId = 1;
let nextBallSpawnAt = 0;
let lastTouchActivityAt = 0;
let destroyedLargeCount = 0;
let destroyedMediumCount = 0;
let destroyedSmallCount = 0;
let difficultyLevel = 0;
let qteState = {
  current: null,
  nextAt: 0,
  lastType: null,
  feedback: null,
  feedbackUntil: 0,
};
let zoneLastActiveAt = { top: 0, bottom: 0, left: 0, right: 0 };
let playerCapacityState = {
  recentZones: [],
  recentCount: 0,
  currentPlayerCapacity: 2,
  atLeast3Since: null,
  atLeast4Since: null,
};
let backgroundMusic = null;
let musicStarted = false;

const QTE_POOL = [
  // Type streak (strict)
  { id: "destroy_5_large_row", label: "Destroy 5 large", reward: 5, target: 5, kind: "destroy_type_streak", ballType: "large", weight: 0.65 },
  { id: "destroy_4_medium_row", label: "Destroy 4 medium", reward: 6, target: 4, kind: "destroy_type_streak", ballType: "medium", weight: 0.85 },
  { id: "destroy_3_small_row", label: "Destroy 3 small", reward: 7, target: 3, kind: "destroy_type_streak", ballType: "small", weight: 0.9 },

  // Exact-player successful connection
  { id: "connect_exact_2", label: "Connect 2 players", reward: 2, target: 2, kind: "connection_count", weight: 1.25 },
  { id: "connect_exact_3", label: "Connect 3 players", reward: 2, target: 3, kind: "connection_count", weight: 1.05 },
  { id: "connect_exact_4", label: "Connect 4 players", reward: 2, target: 4, kind: "connection_count", weight: 0.75 },

  // Destroy 2 at once with exact player count
  { id: "destroy2_once_p2", label: "Destroy 2 at once", reward: 4, kind: "destroy_at_once", requiredPlayers: 2, requiredDestroyed: 2, weight: 0.7 },
  { id: "destroy2_once_p3", label: "Destroy 2 at once", reward: 4, kind: "destroy_at_once", requiredPlayers: 3, requiredDestroyed: 2, weight: 0.6 },
  { id: "destroy2_once_p4", label: "Destroy 2 at once", reward: 4, kind: "destroy_at_once", requiredPlayers: 4, requiredDestroyed: 2, weight: 0.45 },

  // Destroy 3 at once with exact player count (rarer)
  { id: "destroy3_once_p2", label: "Destroy 3 at once", reward: 6, kind: "destroy_at_once", requiredPlayers: 2, requiredDestroyed: 3, weight: 0.32 },
  { id: "destroy3_once_p3", label: "Destroy 3 at once", reward: 6, kind: "destroy_at_once", requiredPlayers: 3, requiredDestroyed: 3, weight: 0.2 },
  { id: "destroy3_once_p4", label: "Destroy 3 at once", reward: 6, kind: "destroy_at_once", requiredPlayers: 4, requiredDestroyed: 3, weight: 0.12 },

  // Successful connections in a row
  { id: "success_conn_2_row", label: "Make 2 links", reward: 3, target: 2, kind: "connection_success_streak", weight: 1.05 },
  { id: "success_conn_3_row", label: "Make 3 links", reward: 4, target: 3, kind: "connection_success_streak", weight: 0.78 },
  { id: "success_conn_4_row", label: "Make 4 links", reward: 5, target: 4, kind: "connection_success_streak", weight: 0.38 },

  // Any-type destroy streak
  { id: "destroy_any_2_row", label: "Destroy any 2", reward: 2, target: 2, kind: "destroy_any_streak", weight: 1.35 },
  { id: "destroy_any_3_row", label: "Destroy any 3", reward: 3, target: 3, kind: "destroy_any_streak", weight: 1.08 },
  { id: "destroy_any_4_row", label: "Destroy any 4", reward: 4, target: 4, kind: "destroy_any_streak", weight: 0.85 },
];

function preload() {
  soundFormats("mp3");
  backgroundMusic = loadSound(GAME_CONFIG.audio.musicPath);
}

function setup() {
  gameCanvas = createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont("Helvetica Neue", "Helvetica", "Arial", "sans-serif");
  textSize(28);
  gameCanvas.elt.style.touchAction = "none";
  attachPointerHandlers();
  recomputeZones();
  createAmbientStars();
  resetGameState();
  tryStartBackgroundMusic();
}

function draw() {
  const now = millis();

  if (now - lastTouchActivityAt >= INACTIVITY_RESET_MS) {
    resetGameState();
    lastTouchActivityAt = now;
  }

  updateConnections(now);
  updateBalls(now);
  handleActiveConnectionHits(now);
  updateParticles(now);
  updateQteSystem(now);

  drawConstellationBackground(now);
  drawTrails();
  drawZones();
  drawConnections(now);
  drawBalls(now);
  drawParticles(now);
  drawPointerHighlights();
  drawQteOverlay(now);
  drawCentralScore();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  recomputeZones();
  createAmbientStars();
}

function attachPointerHandlers() {
  const opts = { passive: false };
  const el = gameCanvas.elt;
  el.addEventListener("pointerdown", onPointerDown, opts);
  el.addEventListener("pointermove", onPointerMove, opts);
  el.addEventListener("pointerup", onPointerUp, opts);
  el.addEventListener("pointercancel", onPointerUp, opts);
  window.addEventListener("pointerup", onPointerUp, opts);
  window.addEventListener("pointercancel", onPointerUp, opts);
}

function onPointerDown(event) {
  event.preventDefault();
  tryStartBackgroundMusic();
  lastTouchActivityAt = millis();

  const pointerId = event.pointerId;
  if (activePointers.has(pointerId)) return;

  const { x, y } = eventToCanvasPoint(event);
  const zone = getZoneAtPoint(x, y);
  if (!zone) return; // touches outside zones are ignored
  if (zoneOccupants[zone] !== null) return; // max one active touch per zone
  noteZoneActivity(zone, millis());

  const openConnection = getOpenConnection();
  if (openConnection) {
    const inJoinWindow = openConnection.state === "forming" && millis() <= openConnection.joinDeadline;
    if (!inJoinWindow) {
      failConnection(openConnection, "late-join-touch");
      return;
    }
  }

  activePointers.set(pointerId, { x, y, zone });
  zoneOccupants[zone] = pointerId;
  registerTouchInConnection(pointerId, zone, x, y);

  if (gameCanvas.elt.setPointerCapture) {
    try {
      gameCanvas.elt.setPointerCapture(pointerId);
    } catch (err) {
      // Safe fallback: capture can fail on some browsers/device combinations.
    }
  }
}

function tryStartBackgroundMusic() {
  if (musicStarted) return;
  if (!backgroundMusic || !backgroundMusic.isLoaded()) return;

  userStartAudio();
  if (getAudioContext().state !== "running") return;
  if (backgroundMusic.isPlaying()) {
    musicStarted = true;
    return;
  }

  backgroundMusic.setVolume(GAME_CONFIG.audio.musicVolume);
  backgroundMusic.loop();
  musicStarted = true;
}

function noteZoneActivity(zone, now) {
  if (!zone || !ZONE_KEYS.includes(zone)) return;
  zoneLastActiveAt[zone] = now;
}

function onPointerMove(event) {
  const pointerId = event.pointerId;
  if (!activePointers.has(pointerId)) return;

  event.preventDefault();
  lastTouchActivityAt = millis();

  // Touch points are intentionally locked at pointer-down in Phase 2B.
}

function onPointerUp(event) {
  const pointerId = event.pointerId;
  if (!activePointers.has(pointerId)) return;

  event.preventDefault();
  lastTouchActivityAt = millis();
  failConnectionsForPointer(pointerId, "released");

  const pointer = activePointers.get(pointerId);
  activePointers.delete(pointerId);
  if (pointer && zoneOccupants[pointer.zone] === pointerId) {
    zoneOccupants[pointer.zone] = null;
  }
}

function eventToCanvasPoint(event) {
  const rect = gameCanvas.elt.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * width;
  const y = ((event.clientY - rect.top) / rect.height) * height;
  return { x, y };
}

function recomputeZones() {
  const base = min(width, height);
  const zoneLength = base * ZONE_MAIN_LENGTH_RATIO;
  const zoneDepth = base * ZONE_DEPTH_RATIO;
  const bevel = base * GAME_CONFIG.zones.bevelRatio;
  const inset = 0;

  const canonicalLocal = [
    { x: -zoneLength * 0.5, y: -zoneDepth * 0.5 },
    { x: zoneLength * 0.5, y: -zoneDepth * 0.5 },
    { x: zoneLength * 0.5 - bevel, y: zoneDepth * 0.5 },
    { x: -zoneLength * 0.5 + bevel, y: zoneDepth * 0.5 },
  ];

  zonePolygons = {
    top: getZonePolygon(canonicalLocal, width * 0.5, inset + zoneDepth * 0.5, 0),
    bottom: getZonePolygon(canonicalLocal, width * 0.5, height - inset - zoneDepth * 0.5, PI),
    left: getZonePolygon(canonicalLocal, inset + zoneDepth * 0.5, height * 0.5, -HALF_PI),
    right: getZonePolygon(canonicalLocal, width - inset - zoneDepth * 0.5, height * 0.5, HALF_PI),
  };

  // Area check (all should be effectively equal after rigid transforms):
  // topArea, bottomArea, leftArea, rightArea are derived from same canonical polygon.
  const topArea = polygonArea(zonePolygons.top);
  const bottomArea = polygonArea(zonePolygons.bottom);
  const leftArea = polygonArea(zonePolygons.left);
  const rightArea = polygonArea(zonePolygons.right);
  zoneMetrics = {
    topBottomHeight: zoneDepth,
    sideZoneInsetY: inset + zoneDepth * 0.5,
    topArea,
    bottomArea,
    leftArea,
    rightArea,
  };
}

function getZonePolygon(localPoints, cx, cy, rotation) {
  const cosR = cos(rotation);
  const sinR = sin(rotation);
  const points = [];
  for (const p of localPoints) {
    points.push({
      x: cx + p.x * cosR - p.y * sinR,
      y: cy + p.x * sinR + p.y * cosR,
    });
  }
  return points;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return abs(area) * 0.5;
}

function getZoneAtPoint(x, y) {
  for (const key of ZONE_KEYS) {
    if (pointInPolygon(x, y, zonePolygons[key])) {
      return key;
    }
  }
  return null;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function registerTouchInConnection(pointerId, zone, x, y) {
  const now = millis();
  let connection = getOpenConnection();

  if (!connection) {
    connection = {
      id: nextConnectionId++,
      state: "forming",
      createdAt: now,
      joinDeadline: now + CONNECTION_JOIN_WINDOW_MS,
      lockedAt: null,
      activationAt: null,
      expiresAt: null,
      finishedAt: null,
      touches: [],
      path: [],
      segments: [],
      hits: 0,
      destroyedCount: 0,
      destroyedTypes: [],
      success: false,
      color: color(255),
    };
    connections.push(connection);
  } else if (!(connection.state === "forming" && now <= connection.joinDeadline)) {
    failConnection(connection, "late-join-touch");
    return;
  }

  if (connection.touches.some((touch) => touch.zone === zone)) {
    return;
  }

  connection.touches.push({
    pointerId,
    zone,
    x,
    y,
    joinedAt: now,
  });
  connection.color = averageConnectionColor(connection.touches);
  refreshConnectionGeometry(connection);
}

function updateConnections(now) {
  for (const connection of connections) {
    if (connection.state === "failed") continue;

    if (connection.state === "forming" || connection.state === "charging" || connection.state === "active") {
      const isValid = refreshConnectionGeometry(connection);
      if (!isValid) {
        failConnection(connection, "touch-invalid");
        continue;
      }
    }

    if (connection.state === "forming" && now > connection.joinDeadline) {
      if (connection.touches.length < 2) {
        failConnection(connection, "solo-timeout");
      } else {
        lockConnection(connection, now);
      }
    } else if (connection.state === "charging" && now >= connection.activationAt) {
      connection.state = "active";
    } else if (connection.state === "active" && now >= connection.expiresAt) {
      finalizeConnection(connection, now);
    }
  }

  connections = connections.filter(
    (connection) =>
      (connection.state !== "finished" || now - connection.finishedAt < CONNECTION_FINISHED_FADE_MS) &&
      (connection.state !== "failed" || now - connection.failedAt < CONNECTION_FINISHED_FADE_MS)
  );
}

function lockConnection(connection, now) {
  connection.state = "charging";
  connection.lockedAt = now;
  connection.activationAt = now + CONNECTION_CHARGE_MS;
  connection.expiresAt = connection.activationAt + CONNECTION_ACTIVE_MS;
  refreshConnectionGeometry(connection);
}

function finalizeConnection(connection, now) {
  connection.state = "finished";
  connection.finishedAt = now;
  connection.success = connection.hits > 0;

  onConnectionResolvedForQte({
    successful: connection.success,
    playerCount: connection.touches.length,
    destroyedCount: connection.destroyedCount || 0,
    destroyedBallTypes: connection.destroyedTypes || [],
    now,
  });

  if (connection.success && connection.path.length > 1) {
    const trailDust = createTrailDust(connection.path);
    successfulTrails.push({
      path: connection.path.map((point) => ({ x: point.x, y: point.y })),
      color: connection.color,
      dust: trailDust,
      createdAt: now,
    });
  }
}

function failConnection(connection, reason) {
  if (connection.state === "finished" || connection.state === "failed") return;
  connection.state = "failed";
  connection.failedReason = reason;
  connection.failedAt = millis();
  score = max(0, score - GAME_CONFIG.scoring.connectionFailPenalty);
  onConnectionFailedForQte({
    reason,
    playerCount: connection.touches.length,
    now: connection.failedAt,
  });
}

function failConnectionsForPointer(pointerId, reason) {
  const now = millis();
  for (const connection of connections) {
    const hasPointer = connection.touches.some((touch) => touch.pointerId === pointerId);
    if (!hasPointer) continue;

    const inCriticalWindow =
      connection.state === "forming" ||
      connection.state === "charging" ||
      (connection.state === "active" && now < connection.expiresAt);

    if (inCriticalWindow) {
      failConnection(connection, reason);
    }
  }
}

function refreshConnectionGeometry(connection) {
  const lockedPoints = [];

  for (const touch of connection.touches) {
    const pointer = activePointers.get(touch.pointerId);
    if (!pointer) {
      return false;
    }
    lockedPoints.push({
      pointerId: touch.pointerId,
      zone: touch.zone,
      x: touch.x,
      y: touch.y,
    });
  }

  connection.path = buildNearestPath(lockedPoints);
  connection.segments = pathToSegments(connection.path);
  return true;
}

function getOpenConnection() {
  for (const connection of connections) {
    if (connection.state === "forming" || connection.state === "charging" || connection.state === "active") {
      return connection;
    }
  }
  return null;
}

function buildNearestPath(points) {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y, zone: points[0].zone }];

  const unvisited = points.map((point) => ({
    x: point.x,
    y: point.y,
    zone: point.zone,
  }));

  const path = [unvisited.shift()];
  while (unvisited.length > 0) {
    const current = path[path.length - 1];
    let nearestIndex = 0;
    let nearestDistanceSq = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const candidate = unvisited[i];
      const distanceSq = squaredDistance(current.x, current.y, candidate.x, candidate.y);
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestIndex = i;
      }
    }
    path.push(unvisited.splice(nearestIndex, 1)[0]);
  }

  return path;
}

function pathToSegments(path) {
  const segments = [];
  for (let i = 0; i < path.length - 1; i++) {
    segments.push({
      x1: path[i].x,
      y1: path[i].y,
      x2: path[i + 1].x,
      y2: path[i + 1].y,
    });
  }
  return segments;
}

function averageConnectionColor(touches) {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const touch of touches) {
    const [r, g, b] = ZONE_SETTINGS[touch.zone].color;
    sumR += r;
    sumG += g;
    sumB += b;
  }

  const divisor = max(touches.length, 1);
  return color(sumR / divisor, sumG / divisor, sumB / divisor);
}

class Ball {
  constructor({ x, y, vx, vy, radius, colorRGB, scoreValue, type }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = radius;
    this.colorRGB = colorRGB;
    this.scoreValue = scoreValue;
    this.type = type;
    this.lastHitFrame = -1;
  }

  update(now) {
    this.applyBehavior(now);
    this.moveWithinPlayArea();
  }

  applyBehavior(_now) {}

  moveWithinPlayArea() {
    let nextX = this.x + this.vx;
    let nextY = this.y;
    if (nextX <= this.r || nextX >= width - this.r || circleTouchesAnyZone(nextX, nextY, this.r)) {
      this.vx *= -1;
      nextX = this.x + this.vx;
    }

    nextY = this.y + this.vy;
    if (nextY <= this.r || nextY >= height - this.r || circleTouchesAnyZone(nextX, nextY, this.r)) {
      this.vy *= -1;
      nextY = this.y + this.vy;
    }

    if (circleTouchesAnyZone(nextX, nextY, this.r)) {
      this.randomizeDirection(this.getSpeed());
      nextX = this.x + this.vx;
      nextY = this.y + this.vy;
    }

    this.x = constrain(nextX, this.r, width - this.r);
    this.y = constrain(nextY, this.r, height - this.r);
  }

  getSpeed() {
    return sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  randomizeDirection(speed) {
    const angle = random(TWO_PI);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
  }

  draw(now) {
    drawBallGlow(this, now);
  }

  onHit(_now) {
    return {
      consumed: true,
      destroyed: true,
      scoreGain: this.scoreValue,
      burstColor: color(this.colorRGB[0], this.colorRGB[1], this.colorRGB[2]),
      burstCount: 16,
      spawnSmallCount: 0,
    };
  }
}

class LargeBall extends Ball {
  constructor(config) {
    super({
      ...config,
      radius: 19,
      colorRGB: [90, 255, 135],
      scoreValue: config.scoreValue || GAME_CONFIG.scoring.largeBase,
      type: "large",
    });
    this.shieldLayers = max(0, config.shieldLayers || 1);
  }

  draw(now) {
    drawBallGlow(this, now, { intensity: 1.2, sparkDensity: 3 });
    if (this.shieldLayers > 0) {
      drawShield(this, now);
    }
  }

  onHit(_now) {
    if (this.shieldLayers > 0) {
      this.shieldLayers -= 1;
      return {
        consumed: true,
        destroyed: false,
        scoreGain: 0,
        burstColor: color(120, 255, 170),
        burstCount: 9,
        spawnSmallCount: 0,
      };
    }
    return super.onHit(_now);
  }
}

class MediumBall extends Ball {
  constructor(config) {
    super({ ...config, radius: 13, colorRGB: [255, 225, 95], scoreValue: GAME_CONFIG.scoring.medium, type: "medium" });
    this.indestructible = !!config.indestructible;
  }

  draw(now) {
    super.draw(now);
    if (this.indestructible) {
      noFill();
      stroke(190, 190, 200, 120);
      strokeWeight(1.4);
      circle(this.x, this.y, this.r * 2.15);
      noStroke();
    }
  }

  applyBehavior(_now) {
    if (random() < 0.013) {
      const speed = this.getSpeed();
      const angle = atan2(this.vy, this.vx) + random(-1.05, 1.05);
      this.vx = cos(angle) * speed;
      this.vy = sin(angle) * speed;
    }
  }

  onHit(_now) {
    if (this.indestructible) {
      return {
        consumed: true,
        destroyed: false,
        scoreGain: 0,
        burstColor: color(205, 205, 185),
        burstCount: 4,
        spawnSmallCount: 0,
      };
    }
    return {
      consumed: true,
      destroyed: true,
      scoreGain: GAME_CONFIG.scoring.medium,
      burstColor: color(255, 230, 120),
      burstCount: 18,
      spawnSmallCount: 2,
    };
  }
}

class SmallBall extends Ball {
  constructor(config) {
    super({ ...config, radius: 8, colorRGB: [190, 110, 255], scoreValue: GAME_CONFIG.scoring.small, type: "small" });
  }

  applyBehavior(_now) {
    const speed = this.getSpeed();
    const angle = atan2(this.vy, this.vx) + random(-0.12, 0.12) + (random() < 0.025 ? random(-0.55, 0.55) : 0);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
  }
}

class TailBall extends Ball {
  constructor(config) {
    super({ ...config, radius: 11, colorRGB: [245, 245, 255], scoreValue: GAME_CONFIG.scoring.tail, type: "tail" });
    this.vulnerableDuration = GAME_CONFIG.progression.tailVulnerableDurationMs;
    this.vulnerableUntil = 0;
    this.nextVulnerableAt = config.now + random(2800, 7000);
    this.tailPoints = [];
  }

  isVulnerable(now) {
    return now < this.vulnerableUntil;
  }

  applyBehavior(now) {
    if (!this.isVulnerable(now) && now >= this.nextVulnerableAt) {
      this.vulnerableUntil = now + this.vulnerableDuration;
      this.nextVulnerableAt = this.vulnerableUntil + random(5000, 12000);
    }

    const speed = this.getSpeed();
    const angle = atan2(this.vy, this.vx) + random(-0.06, 0.06);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;

    this.tailPoints.push({ x: this.x, y: this.y });
    if (this.tailPoints.length > 18) this.tailPoints.shift();
  }

  draw(now) {
    const vulnerable = this.isVulnerable(now);
    drawBallGlow(this, now, {
      intensity: vulnerable ? 1.28 : 0.88,
      sparkDensity: vulnerable ? 4 : 2,
      coolCore: true,
    });
    drawTailTrail(this, now, vulnerable);

    const pulse = vulnerable ? 1 + 0.22 * sin(now * 0.02) : 1 + 0.08 * sin(now * 0.01);
    if (vulnerable) {
      noFill();
      stroke(255, 255, 255, 180);
      strokeWeight(1.8);
      circle(this.x, this.y, this.r * (2.1 + 0.3 * sin(now * 0.03)));
      stroke(255, 255, 255, 70);
      strokeWeight(5.5);
      circle(this.x, this.y, this.r * 2.28 * pulse);
      noStroke();
    }
  }

  onHit(now) {
    if (!this.isVulnerable(now)) {
      return {
        consumed: true,
        destroyed: false,
        scoreGain: 0,
        burstColor: color(255, 255, 255),
        burstCount: 5,
        spawnSmallCount: 0,
      };
    }
    return {
      consumed: true,
      destroyed: true,
      scoreGain: 8,
      burstColor: color(255, 255, 255),
      burstCount: 24,
      spawnSmallCount: 0,
    };
  }
}

function updateBalls(now) {
  difficultyLevel = getDifficultyLevel();

  if (now >= nextBallSpawnAt && balls.length < MAX_BALLS) {
    spawnBallByType(selectRandomBallType(), now);
    nextBallSpawnAt = now + getSpawnIntervalMs() + random(GAME_CONFIG.spawn.spawnJitterMinMs, GAME_CONFIG.spawn.spawnJitterMaxMs);
  }

  for (const ball of balls) {
    ball.update(now);
  }
}

function selectRandomBallType() {
  const roll = random();
  if (roll < 0.30) return "small";
  if (roll < 0.68) return "medium";
  if (roll < 0.90) return "large";
  return "tail";
}

function spawnBallByType(type, now, options = {}) {
  const spawn = findSpawnPosition(options.x, options.y, getBallRadius(type));
  if (!spawn) return null;

  const velocity =
    options.velocity ||
    randomVelocity(getBallSpeedRange(type), getNewBallSpeedMultiplier(type));
  const config = { x: spawn.x, y: spawn.y, vx: velocity.vx, vy: velocity.vy, now };

  let ball = null;
  if (type === "large") {
    const evolution = getLargeBallEvolution();
    ball = new LargeBall({
      ...config,
      shieldLayers: evolution.shieldLayers,
      scoreValue: evolution.scoreValue,
    });
  } else if (type === "medium") {
    const canRollIndestructible = destroyedMediumCount >= GAME_CONFIG.progression.mediumIndestructibleAfter;
    ball = new MediumBall({
      ...config,
      indestructible: canRollIndestructible && random() < GAME_CONFIG.progression.mediumIndestructibleChance,
    });
  }
  else if (type === "tail") ball = new TailBall(config);
  else ball = new SmallBall(config);

  balls.push(ball);
  return ball;
}

function findSpawnPosition(preferredX, preferredY, radius) {
  if (preferredX !== undefined && preferredY !== undefined) {
    for (let i = 0; i < 20; i++) {
      const x = preferredX + random(-26, 26);
      const y = preferredY + random(-26, 26);
      if (canPlaceBall(x, y, radius)) return { x, y };
    }
  }

  const margin = max(18, zoneMetrics.topBottomHeight * 0.36);
  for (let attempt = 0; attempt < 90; attempt++) {
    const x = random(radius + margin, width - radius - margin);
    const y = random(radius + margin, height - radius - margin);
    if (canPlaceBall(x, y, radius)) return { x, y };
  }

  return null;
}

function canPlaceBall(x, y, radius) {
  if (x <= radius || x >= width - radius || y <= radius || y >= height - radius) return false;
  return !circleTouchesAnyZone(x, y, radius);
}

function getBallRadius(type) {
  if (type === "large") return 19;
  if (type === "medium") return 13;
  if (type === "tail") return 11;
  return 8;
}

function getBallSpeedRange(type) {
  if (type === "large") return GAME_CONFIG.ballSpeed.large;
  if (type === "medium") return GAME_CONFIG.ballSpeed.medium;
  if (type === "tail") return GAME_CONFIG.ballSpeed.tail;
  return GAME_CONFIG.ballSpeed.small;
}

function randomVelocity(range, multiplier = 1) {
  const speed = random(range.min, range.max) * multiplier;
  const angle = random(TWO_PI);
  return { vx: cos(angle) * speed, vy: sin(angle) * speed };
}

function getDifficultyLevel() {
  return floor(score / GAME_CONFIG.progression.difficultyScoreStep);
}

function getGlobalSpeedMultiplier() {
  return min(MAX_GLOBAL_SPEED_MULTIPLIER, 1 + getDifficultyLevel() * SPEED_MULTIPLIER_PER_DIFFICULTY);
}

function getSpawnIntervalMs() {
  const interval = BALL_SPAWN_MS + getDifficultyLevel() * SPAWN_INTERVAL_PER_DIFFICULTY;
  return min(interval, MAX_SPAWN_INTERVAL_MS);
}

function getNewBallSpeedMultiplier(type) {
  let multiplier = BASE_BALL_SPEED_MULTIPLIER * getGlobalSpeedMultiplier();
  if (type === "small" && destroyedSmallCount >= GAME_CONFIG.progression.smallSpeedBoostAfter) {
    multiplier *= SMALL_EVOLUTION_SPEED_MULTIPLIER;
  }
  return multiplier;
}

function getLargeBallEvolution() {
  if (destroyedLargeCount >= GAME_CONFIG.progression.largeStageTwoDestroyedCount) {
    return { shieldLayers: 3, scoreValue: GAME_CONFIG.scoring.largeStageTwo };
  }
  if (destroyedLargeCount >= GAME_CONFIG.progression.largeStageOneDestroyedCount) {
    return { shieldLayers: 2, scoreValue: GAME_CONFIG.scoring.largeStageOne };
  }
  return { shieldLayers: 1, scoreValue: GAME_CONFIG.scoring.largeBase };
}

function updateQteSystem(now) {
  updatePlayerCapacity(now);

  if (!qteState.current) {
    if (now >= qteState.nextAt) {
      startNextQte(now);
    }
    return;
  }

  if (qteState.current.expiresAt !== undefined && now >= qteState.current.expiresAt) {
    failQte(now, "timeout");
  }
}

function startNextQte(now) {
  const filteredPool = getEligibleQtePool(score, playerCapacityState.currentPlayerCapacity);
  const candidates = filteredPool.filter((event) => event.id !== qteState.lastType);
  const source = candidates.length > 0 ? candidates : filteredPool;
  const fallback = source.length > 0 ? source : QTE_POOL.filter((event) => event.id !== qteState.lastType);
  const selectedSource = fallback.length > 0 ? fallback : QTE_POOL;
  const selected = pickWeightedQte(selectedSource);

  qteState.current = {
    ...selected,
    startedAt: now,
    expiresAt: now + GAME_CONFIG.qte.activeDurationMs,
    progress: 0,
  };
  console.log(
    `[QTE] started: ${selected.id} (${selected.label}) | capacity=${playerCapacityState.currentPlayerCapacity} recent=${playerCapacityState.recentZones.join(",")}`
  );
}

function pickWeightedQte(pool) {
  let totalWeight = 0;
  for (const event of pool) {
    totalWeight += max(0.01, event.weight || 1);
  }
  let roll = random(totalWeight);
  for (const event of pool) {
    roll -= max(0.01, event.weight || 1);
    if (roll <= 0) return event;
  }
  return pool[pool.length - 1];
}

function completeQte(now) {
  if (!qteState.current) return;
  const completed = qteState.current;
  score += qteState.current.reward;
  qteState.feedback = "Success";
  qteState.feedbackUntil = now + GAME_CONFIG.qte.feedbackDurationMs;
  qteState.lastType = qteState.current.id;
  qteState.current = null;
  qteState.nextAt = now + QTE_INTERVAL_MS;
  console.log(`[QTE] success: ${completed.id} (+${completed.reward})`);
}

function failQte(now, reason) {
  if (!qteState.current) return;
  const failed = qteState.current;
  score = max(0, score - QTE_FAIL_PENALTY);
  qteState.feedback = "Failed -4";
  qteState.feedbackUntil = now + GAME_CONFIG.qte.feedbackDurationMs;
  qteState.lastType = qteState.current.id;
  qteState.current = null;
  qteState.nextAt = now + QTE_INTERVAL_MS;
  console.log(`[QTE] fail: ${failed.id} (reason: ${reason || "unknown"})`);
}

function onConnectionResolvedForQte(eventData) {
  const current = qteState.current;
  if (!current) return;
  const { successful, playerCount, destroyedCount, destroyedBallTypes, now } = eventData;

  if (current.kind === "connection_success_streak") {
    if (!successful) {
      failQte(now, "connection-failed-in-streak");
      return;
    }
    current.progress += 1;
    console.log(`[QTE] progress: ${current.id} ${current.progress}/${current.target}`);
    if (current.progress >= current.target) completeQte(now);
    return;
  }

  if (!successful) return;

  if (current.kind === "connection_count") {
    if (playerCount === current.target) {
      current.progress = current.target;
      completeQte(now);
    } else {
      failQte(now, "wrong-connection-count");
    }
    return;
  }

  if (current.kind === "destroy_at_once") {
    if (playerCount !== current.requiredPlayers) {
      failQte(now, "wrong-player-count-for-simultaneous");
      return;
    }
    if (destroyedCount === current.requiredDestroyed) {
      current.progress = current.requiredDestroyed;
      completeQte(now);
    } else {
      failQte(now, "wrong-destroyed-count-for-simultaneous");
    }
    return;
  }

  if (destroyedCount <= 0) return;

  if (current.kind === "destroy_any_streak") {
    current.progress += destroyedCount;
    console.log(`[QTE] progress: ${current.id} ${current.progress}/${current.target}`);
    if (current.progress >= current.target) completeQte(now);
    return;
  }

  if (current.kind === "destroy_type_streak") {
    const wrongTypeDestroyed = destroyedBallTypes.some((type) => type !== current.ballType);
    if (wrongTypeDestroyed) {
      failQte(now, "wrong-ball-type-destroyed");
      return;
    }

    let matched = 0;
    for (const type of destroyedBallTypes) {
      if (type === current.ballType) matched += 1;
    }
    current.progress += matched;
    console.log(`[QTE] progress: ${current.id} ${current.progress}/${current.target}`);
    if (current.progress >= current.target) completeQte(now);
  }
}

function onConnectionFailedForQte(eventData) {
  const current = qteState.current;
  if (!current) return;
  if (current.kind !== "connection_success_streak") return;
  if (eventData.playerCount < 2) return;
  if (eventData.reason === "solo-timeout") return;
  failQte(eventData.now, `connection-failed:${eventData.reason || "unknown"}`);
}

function updatePlayerCapacity(now) {
  const recentZones = ZONE_KEYS.filter((zone) => now - (zoneLastActiveAt[zone] || 0) <= ACTIVE_ZONE_MEMORY_MS);
  const recentCount = recentZones.length;

  if (recentCount >= 3) {
    if (playerCapacityState.atLeast3Since === null) {
      playerCapacityState.atLeast3Since = now;
    }
  } else {
    playerCapacityState.atLeast3Since = null;
  }

  if (recentCount >= 4) {
    if (playerCapacityState.atLeast4Since === null) {
      playerCapacityState.atLeast4Since = now;
    }
  } else {
    playerCapacityState.atLeast4Since = null;
  }

  let capacity = 2;
  if (
    playerCapacityState.atLeast3Since !== null &&
    now - playerCapacityState.atLeast3Since >= PLAYER3_STABLE_MS
  ) {
    capacity = 3;
  }
  if (
    playerCapacityState.atLeast4Since !== null &&
    now - playerCapacityState.atLeast4Since >= PLAYER4_STABLE_MS
  ) {
    capacity = 4;
  }

  playerCapacityState.recentZones = recentZones;
  playerCapacityState.recentCount = recentCount;
  playerCapacityState.currentPlayerCapacity = capacity;
}

function getQteRequiredPlayers(eventDef) {
  if (eventDef.kind === "connection_count") return eventDef.target;
  if (eventDef.kind === "destroy_at_once") return eventDef.requiredPlayers;
  return null;
}

function isQteAllowedByCapacity(eventDef, capacity) {
  const requiredPlayers = getQteRequiredPlayers(eventDef);
  if (requiredPlayers === null) return true;
  return requiredPlayers <= capacity;
}

function getScoreTier(currentScore) {
  if (currentScore < 20) return "early";
  if (currentScore < 50) return "mid";
  return "late";
}

function isQteAllowedByTier(eventDef, tier) {
  const earlyAllowed = new Set([
    "destroy_any_2_row",
    "connect_exact_2",
    "destroy2_once_p2",
  ]);

  const midAllowed = new Set([
    "destroy_any_2_row",
    "destroy_any_3_row",
    "destroy_3_small_row",
    "destroy_4_medium_row",
    "connect_exact_2",
    "connect_exact_3",
    "destroy2_once_p2",
    "destroy2_once_p3",
    "success_conn_2_row",
    "success_conn_3_row",
  ]);

  if (tier === "early") return earlyAllowed.has(eventDef.id);
  if (tier === "mid") return midAllowed.has(eventDef.id);
  return true;
}

function getEligibleQtePool(currentScore, capacity) {
  const tier = getScoreTier(currentScore);
  let pool = QTE_POOL.filter((eventDef) => isQteAllowedByCapacity(eventDef, capacity));
  pool = pool.filter((eventDef) => isQteAllowedByTier(eventDef, tier));
  return pool.length > 0 ? pool : QTE_POOL.filter((eventDef) => isQteAllowedByCapacity(eventDef, capacity));
}

function handleActiveConnectionHits(now) {
  for (const connection of connections) {
    if (connection.state !== "active") continue;
    if (connection.segments.length === 0) continue;
    const collisionHits = [];

    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      if (ball.lastHitFrame === frameCount) continue;
      let hit = false;
      for (const segment of connection.segments) {
        if (lineIntersectsCircle(segment.x1, segment.y1, segment.x2, segment.y2, ball.x, ball.y, ball.r)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        collisionHits.push({ index: i, ball });
      }
    }

    if (collisionHits.length === 0) continue;

    const removeIndices = [];
    const spawnRequests = [];
    const destroyedTypes = [];
    let destroyedCount = 0;

    for (const hitEntry of collisionHits) {
      const ball = hitEntry.ball;
      ball.lastHitFrame = frameCount;
      const outcome = ball.onHit(now);
      if (!outcome || !outcome.consumed) continue;

      if (outcome.burstCount > 0) {
        spawnBurst(ball.x, ball.y, outcome.burstColor, outcome.burstCount);
      }

      if (!outcome.destroyed) continue;

      connection.hits += 1;
      destroyedCount += 1;
      destroyedTypes.push(ball.type);
      score += outcome.scoreGain;
      registerDestroyedBall(ball);
      removeIndices.push(hitEntry.index);

      if (outcome.spawnSmallCount > 0) {
        spawnRequests.push({
          x: ball.x,
          y: ball.y,
          parentSpeed: ball.getSpeed(),
          count: outcome.spawnSmallCount,
        });
      }
    }

    if (removeIndices.length > 0) {
      removeIndices.sort((a, b) => b - a);
      for (const index of removeIndices) {
        balls.splice(index, 1);
      }
    }

    for (const request of spawnRequests) {
      for (let child = 0; child < request.count; child++) {
        const childVelocity = randomVelocity(
          { min: request.parentSpeed * 0.95, max: request.parentSpeed * 1.18 },
          getNewBallSpeedMultiplier("small")
        );
        spawnBallByType("small", now, { x: request.x, y: request.y, velocity: childVelocity });
      }
    }

    if (destroyedCount > 0) {
      connection.destroyedCount = destroyedCount;
      connection.destroyedTypes = destroyedTypes;
      difficultyLevel = getDifficultyLevel();
      finalizeConnection(connection, now);
    }
  }
}

function registerDestroyedBall(ball) {
  if (ball.type === "large") {
    destroyedLargeCount += 1;
    return;
  }
  if (ball.type === "medium") {
    destroyedMediumCount += 1;
    return;
  }
  if (ball.type === "small") {
    destroyedSmallCount += 1;
  }
}

function lineIntersectsCircle(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segmentLengthSq = dx * dx + dy * dy;

  if (segmentLengthSq === 0) {
    return squaredDistance(x1, y1, cx, cy) <= radius * radius;
  }

  let t = ((cx - x1) * dx + (cy - y1) * dy) / segmentLengthSq;
  t = constrain(t, 0, 1);

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return squaredDistance(closestX, closestY, cx, cy) <= radius * radius;
}

function squaredDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function spawnBurst(x, y, burstColor, particleCount = 16) {
  const now = millis();
  const burstR = red(burstColor);
  const burstG = green(burstColor);
  const burstB = blue(burstColor);

  for (let i = 0; i < particleCount; i++) {
    const angle = random(TWO_PI);
    const speed = random(1.4, 4.3);
    burstParticles.push({
      x,
      y,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      bornAt: now,
      lifeMs: random(350, 780),
      size: random(1, 4),
      baseAlpha: random(120, 220),
      r: burstR,
      g: burstG,
      b: burstB,
    });
  }
}

function updateParticles(now) {
  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const particle = burstParticles[i];
    const age = now - particle.bornAt;
    if (age >= particle.lifeMs) {
      burstParticles.splice(i, 1);
      continue;
    }

    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
  }
}

function createAmbientStars() {
  ambientStars = [];
  ambientLinks = [];
  ambientNodes = [];
  ambientClusters = [];

  const starCount = floor(constrain((width * height) / 5200, 360, 620));
  const palette = [
    [232, 238, 250], // white-blue
    [220, 230, 246], // cool white
    [214, 220, 238], // dim cool
    [226, 216, 196], // slight warm
  ];

  for (let i = 0; i < starCount; i++) {
    const roll = random();
    const size = roll < 0.8 ? random(0.9, 1.3) : roll < 0.95 ? random(1.4, 2.0) : random(2.1, 3.0);
    const alpha = roll < 0.8 ? random(34, 78) : roll < 0.95 ? random(56, 102) : random(82, 132);
    ambientStars.push({
      x: random(width),
      y: random(height),
      size,
      alphaBase: alpha,
      layer: roll < 0.8 ? 1 : roll < 0.95 ? 2 : 3,
      twinkle: random() < 0.45,
      pulse: random(0.00055, 0.0018),
      phase: random(TWO_PI),
      colorRGB: random(palette),
    });
  }

  const nodeCount = floor(constrain((width * height) / 180000, 6, 14));
  for (let i = 0; i < nodeCount; i++) {
    const c = random(palette);
    ambientNodes.push({
      x: random(width),
      y: random(height),
      size: random(1.8, 3.2),
      alpha: random(18, 40),
      colorRGB: c,
      phase: random(TWO_PI),
      pulse: random(0.0008, 0.0018),
    });
  }

  const clusterCount = floor(constrain((width * height) / 120000, 8, 20));
  for (let i = 0; i < clusterCount; i++) {
    const pointCount = floor(random(2, 6));
    const cx = random(width * 0.06, width * 0.94);
    const cy = random(height * 0.06, height * 0.94);
    const spread = random(min(width, height) * 0.03, min(width, height) * 0.055);
    const nodes = [];
    for (let n = 0; n < pointCount; n++) {
      const angle = random(TWO_PI);
      const radius = random(spread * 0.2, spread);
      nodes.push({
        x: constrain(cx + cos(angle) * radius + random(-6, 6), 0, width),
        y: constrain(cy + sin(angle) * radius + random(-6, 6), 0, height),
        size: random(1.0, 2.0),
        alpha: random(54, 110),
        phase: random(TWO_PI),
      });
    }

    const edges = [];
    for (let n = 1; n < nodes.length && n <= 2; n++) {
      edges.push({ a: n - 1, b: n, alpha: random(18, 34) });
    }
    for (let e = 0; e < floor(nodes.length * 0.35); e++) {
      const a = floor(random(nodes.length));
      const b = floor(random(nodes.length));
      if (a !== b) {
        const dx = nodes[a].x - nodes[b].x;
        const dy = nodes[a].y - nodes[b].y;
        const d = sqrt(dx * dx + dy * dy);
        if (d < spread * 1.2) edges.push({ a, b, alpha: random(14, 28) });
      }
    }

    ambientClusters.push({
      nodes,
      edges,
      cool: random() < 0.78,
      pulse: random(0.0005, 0.0016),
      phase: random(TWO_PI),
    });
  }
}

function drawConstellationBackground(now) {
  drawAtmosphereBackground(now);
  drawConstellationMesh(now);
  drawStarDustLayer(now);
  drawAmbientNodes(now);
}

function drawAtmosphereBackground(now) {
  background(5, 8, 18);
  const subtle = 0.94 + 0.06 * sin(now * 0.0004);
  noStroke();
  fill(9, 14, 28, 14 * subtle);
  rect(0, 0, width, height);
}

function drawStarDustLayer(now) {
  noStroke();
  for (const star of ambientStars) {
    const twinkle = star.twinkle ? 0.9 + 0.1 * sin(now * star.pulse + star.phase) : 1;
    const [r, g, b] = star.colorRGB;
    const aura = star.layer === 1 ? 1.25 : star.layer === 2 ? 1.45 : 1.65;
    fill(r, g, b, star.alphaBase * twinkle * 0.2);
    circle(star.x, star.y, star.size * aura);
    fill(r, g, b, star.alphaBase * twinkle);
    circle(star.x, star.y, star.size);
  }
}

function drawConstellationMesh(now) {
  strokeWeight(0.75);
  for (const cluster of ambientClusters) {
    const pulse = 0.93 + 0.07 * sin(now * cluster.pulse + cluster.phase);
    const lineColor = cluster.cool ? [188, 204, 236] : [194, 186, 226];
    const nodeColor = cluster.cool ? [214, 224, 246] : [214, 206, 236];

    for (const edge of cluster.edges) {
      const a = cluster.nodes[edge.a];
      const b = cluster.nodes[edge.b];
      stroke(lineColor[0], lineColor[1], lineColor[2], edge.alpha * pulse);
      line(a.x, a.y, b.x, b.y);
    }

    noStroke();
    for (const node of cluster.nodes) {
      const nodePulse = 0.92 + 0.08 * sin(now * 0.001 + node.phase);
      fill(nodeColor[0], nodeColor[1], nodeColor[2], node.alpha * 0.25 * nodePulse);
      circle(node.x, node.y, node.size * 1.8);
      fill(nodeColor[0], nodeColor[1], nodeColor[2], node.alpha * nodePulse);
      circle(node.x, node.y, node.size);
    }
  }
}

function drawAmbientNodes(now) {
  noStroke();
  for (const node of ambientNodes) {
    const pulse = 0.92 + 0.08 * sin(now * node.pulse + node.phase);
    const [r, g, b] = node.colorRGB;
    fill(r, g, b, node.alpha * 0.22 * pulse);
    circle(node.x, node.y, node.size * 1.9);
    fill(r, g, b, node.alpha * pulse);
    circle(node.x, node.y, node.size);
  }
}

function drawTrails() {
  for (const trail of successfulTrails) {
    drawPersistentTrace(trail);
  }
}

function drawZones() {
  const neutralStroke = [238, 242, 248];
  const activeStroke = [252, 254, 255];
  const radius = constrain(min(width, height) * ZONE_CORNER_RADIUS, 16, 28);

  strokeJoin(ROUND);
  strokeCap(ROUND);
  for (const key of ZONE_KEYS) {
    const polygon = zonePolygons[key];
    const active = zoneOccupants[key] !== null;
    const strokeRGB = active ? activeStroke : neutralStroke;
    const strokeAlpha = active ? 216 : 182;
    const strokeW = active ? ZONE_STROKE_WEIGHT + 0.2 : ZONE_STROKE_WEIGHT;

    noFill();
    drawingContext.save();
    drawingContext.shadowBlur = active ? 8 : 4;
    drawingContext.shadowColor = active
      ? "rgba(255,255,255,0.24)"
      : "rgba(255,255,255,0.12)";

    stroke(strokeRGB[0], strokeRGB[1], strokeRGB[2], strokeAlpha * 0.2);
    strokeWeight(strokeW + 3.4);
    drawRoundedPolygonOutline(polygon, radius);

    stroke(strokeRGB[0], strokeRGB[1], strokeRGB[2], strokeAlpha);
    strokeWeight(strokeW);
    drawRoundedPolygonOutline(polygon, radius);
    drawingContext.restore();
  }
}

function drawRoundedPolygonOutline(points, cornerRadius) {
  if (!points || points.length < 3) return;
  const count = points.length;

  beginShape();
  for (let i = 0; i < count; i++) {
    const prev = points[(i - 1 + count) % count];
    const curr = points[i];
    const next = points[(i + 1) % count];

    const inX = prev.x - curr.x;
    const inY = prev.y - curr.y;
    const outX = next.x - curr.x;
    const outY = next.y - curr.y;
    const inLen = max(0.0001, sqrt(inX * inX + inY * inY));
    const outLen = max(0.0001, sqrt(outX * outX + outY * outY));
    const localRadius = min(cornerRadius, inLen * 0.45, outLen * 0.45);

    const startX = curr.x + (inX / inLen) * localRadius;
    const startY = curr.y + (inY / inLen) * localRadius;
    const endX = curr.x + (outX / outLen) * localRadius;
    const endY = curr.y + (outY / outLen) * localRadius;

    if (i === 0) {
      vertex(startX, startY);
    } else {
      vertex(startX, startY);
    }
    quadraticVertex(curr.x, curr.y, endX, endY);
  }
  endShape(CLOSE);
}

function drawConnections(now) {
  for (const connection of connections) {
    const path = connection.path;
    if (path.length === 0) continue;
    const segments = buildVisualSegments(path, connection.color);

    if (connection.state === "forming") {
      // Prevent pre-charge full-line flash; only touch nodes are visible while forming.
      if (path.length === 1) {
        const p = path[0];
        drawSoloTouchNode(p.x, p.y, p.zone, now);
      } else {
        for (const point of path) drawTouchNode(point.x, point.y, connection.color, "forming", now);
      }
      continue;
    }

    if (connection.state === "charging") {
      const chargeProgress = constrain((now - connection.lockedAt) / CONNECTION_CHARGE_MS, 0, 1);
      drawOrganicConnection(segments, "charging", now, chargeProgress);
      for (const point of path) drawTouchNode(point.x, point.y, connection.color, "charging", now);
      continue;
    }

    if (connection.state === "active") {
      drawOrganicConnection(segments, "active", now, 1);
      for (const point of path) drawTouchNode(point.x, point.y, connection.color, "active", now);
      continue;
    }

    if (connection.state === "finished") {
      const fade = 1 - (now - connection.finishedAt) / CONNECTION_FINISHED_FADE_MS;
      const alpha = max(0, fade * 140);
      const fallbackColor = connection.success ? connection.color : color(255, 70, 70);
      drawConnectionCore(path, fallbackColor, 1.35, alpha * 0.55);
      continue;
    }

    if (connection.state === "failed") {
      const fade = 1 - (now - connection.failedAt) / CONNECTION_FINISHED_FADE_MS;
      const alpha = max(0, fade * 120);
      const failColor = color(255, 90, 90);
      drawConnectionCore(path, failColor, 1.45, alpha * 0.8);
      drawFailedSparks(path, failColor, alpha, now);
    }
  }
}

function drawSoloTouchNode(x, y, zone, now) {
  const soloCfg = GAME_CONFIG.visuals.soloTouch;
  const pulse = soloCfg.pulseBase + soloCfg.pulseAmplitude * sin(frameCount * soloCfg.pulseSpeed + x * 0.01 + y * 0.01); // ~1.0..1.15

  blendMode(ADD);
  noStroke();
  fill(238, 242, 250, soloCfg.coreAlpha);
  circle(x, y, soloCfg.coreRadius * pulse);

  noFill();
  stroke(236, 242, 252, 0);
  strokeWeight(soloCfg.ringStrokeWeight);
  for (let i = 0; i < soloCfg.ringCount; i++) {
    const alpha = max(22, soloCfg.ringAlphaBase - i * soloCfg.ringAlphaFalloff);
    stroke(236, 242, 252, alpha);
    const radius = (soloCfg.ringStartRadius + i * soloCfg.ringSpacing) * pulse;
    circle(x, y, radius * 2);
  }
  blendMode(BLEND);
}

function buildVisualSegments(path, fallbackColor) {
  const segments = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const colorA = getZoneTintColor(a.zone, fallbackColor);
    const colorB = getZoneTintColor(b.zone, fallbackColor);
    segments.push({ a, b, colorA, colorB, index: i });
  }
  return segments;
}

function getZoneTintColor(zone, fallbackColor) {
  if (!zone || !ZONE_SETTINGS[zone]) return fallbackColor;
  const [r, g, b] = ZONE_SETTINGS[zone].color;
  return color(r, g, b);
}

function drawOrganicConnection(segments, state, now, progress = 1) {
  if (state === "charging") {
    const segmentCount = max(1, segments.length);
    const staged = constrain(progress, 0, 1) * segmentCount;
    for (let i = 0; i < segments.length; i++) {
      const segmentProgress = constrain(staged - i, 0, 1);
      drawConnectionSegment(segments[i], state, segments[i].colorA, segments[i].colorB, now, segmentProgress);
    }
    return;
  }

  for (const segment of segments) {
    drawConnectionSegment(segment, state, segment.colorA, segment.colorB, now, progress);
  }
}

function drawConnectionSegment(segment, state, colorA, colorB, now, progress) {
  const mix = 0.5 + 0.5 * sin(now * 0.0018 + segment.index * 0.8);
  const c = lerpColor(colorA, colorB, constrain(mix, 0, 1));
  const chargingPulse = 0.72 + 0.28 * sin(now * 0.021 + segment.index * 0.5);

  let weights;
  let alphas;
  let amp;
  if (state === "active") {
    weights = { haze: 14, mid: 7, main: 3.2, core: 1.3 };
    alphas = { haze: 22, mid: 65, main: 205, core: 245 };
    amp = 2.4;
  } else if (state === "charging") {
    weights = { haze: 11.5, mid: 5.8, main: 2.5, core: 1 };
    alphas = { haze: 16 * chargingPulse, mid: 44 * chargingPulse, main: 128 * chargingPulse, core: 182 * chargingPulse };
    amp = 1.8;
  } else {
    weights = { haze: 10.5, mid: 5.2, main: 2.1, core: 0.9 };
    alphas = { haze: 12, mid: 33, main: 112, core: 165 };
    amp = 1.4;
  }

  if (state === "charging" && progress <= 0.001) {
    return;
  }

  if (state === "charging" && progress < 0.999) {
    const center = {
      x: (segment.a.x + segment.b.x) * 0.5,
      y: (segment.a.y + segment.b.y) * 0.5,
    };
    const aHead = {
      x: lerp(segment.a.x, center.x, progress),
      y: lerp(segment.a.y, center.y, progress),
      zone: segment.a.zone,
    };
    const bHead = {
      x: lerp(segment.b.x, center.x, progress),
      y: lerp(segment.b.y, center.y, progress),
      zone: segment.b.zone,
    };
    const leftSegment = { a: segment.a, b: aHead, index: segment.index };
    const rightSegment = { a: segment.b, b: bHead, index: segment.index + 0.5 };
    drawSegmentStack(leftSegment, c, weights, alphas, amp, now);
    drawSegmentStack(rightSegment, c, weights, alphas, amp, now);
    return;
  }

  drawSegmentStack(segment, c, weights, alphas, amp, now);
}

function drawSegmentStack(segment, mixedColor, weights, alphas, amp, now) {
  drawSegmentLayer(segment, mixedColor, weights.haze, alphas.haze, amp, now, 0.25);
  drawSegmentLayer(segment, mixedColor, weights.mid, alphas.mid, amp, now, 0.62);
  drawSegmentLayer(segment, mixedColor, weights.main, alphas.main, amp, now, 1);
  const hot = lerpColor(mixedColor, color(255), 0.72);
  drawSegmentLayer(segment, hot, weights.core, alphas.core, amp, now, 1.35);
}

function drawSegmentLayer(segment, layerColor, weight, alpha, amplitude, now, wobbleFactor) {
  const x1 = segment.a.x;
  const y1 = segment.a.y;
  const x2 = segment.b.x;
  const y2 = segment.b.y;
  const mx = (x1 + x2) * 0.5;
  const my = (y1 + y2) * 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = max(1, sqrt(dx * dx + dy * dy));
  const nx = -dy / len;
  const ny = dx / len;
  const drift = amplitude * wobbleFactor * sin(now * 0.0021 + segment.index * 1.2 + len * 0.01);
  const cx = mx + nx * drift;
  const cy = my + ny * drift;

  const r = red(layerColor);
  const g = green(layerColor);
  const b = blue(layerColor);

  drawingContext.save();
  blendMode(ADD);
  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  stroke(r, g, b, alpha);
  strokeWeight(weight);
  drawingContext.shadowBlur = weight * 1.4;
  drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
  bezier(x1, y1, cx, cy, cx, cy, x2, y2);
  blendMode(BLEND);
  drawingContext.restore();
}

function drawConnectionCore(path, pathColor, coreWeight, coreAlpha) {
  if (path.length < 2) return;

  const r = red(pathColor);
  const g = green(pathColor);
  const b = blue(pathColor);

  drawingContext.save();
  noFill();
  strokeJoin(ROUND);
  strokeCap(ROUND);
  blendMode(ADD);

  drawingContext.shadowBlur = coreWeight * 9;
  drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, 0.65)`;
  stroke(r, g, b, coreAlpha * 0.24);
  strokeWeight(coreWeight * 3.8);
  drawCurvedPath(path, 0, 0, 1.6);

  drawingContext.shadowBlur = coreWeight * 4.2;
  drawingContext.shadowColor = `rgba(255,255,255,0.45)`;
  stroke(r, g, b, coreAlpha * 0.94);
  strokeWeight(coreWeight);
  drawCurvedPath(path, 0, 0, 1.2);

  stroke(255, 255, 255, min(220, coreAlpha * 0.72));
  strokeWeight(coreWeight * 0.32);
  drawCurvedPath(path, 0, 0, 1.1);
  blendMode(BLEND);
  drawingContext.restore();
}

function drawOrganicRibbon(path, pathColor, weight, alpha, now, amplitude) {
  const r = red(pathColor);
  const g = green(pathColor);
  const b = blue(pathColor);
  stroke(r, g, b, alpha);
  strokeWeight(weight);
  noFill();
  drawCurvedPath(path, now, amplitude, 0.95);
}

function drawCurvedPath(path, now, amplitude, densityScale) {
  beginShape();
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const bPoint = path[i + 1];
    const stepCount = max(4, floor(9 * densityScale));
    for (let step = 0; step <= stepCount; step++) {
      const t = step / stepCount;
      const x = lerp(a.x, bPoint.x, t);
      const y = lerp(a.y, bPoint.y, t);
      const nx = bPoint.y - a.y;
      const ny = -(bPoint.x - a.x);
      const norm = max(1, sqrt(nx * nx + ny * ny));
      const flow = sin(now * 0.0016 + i * 1.8 + t * 5.4);
      const wiggle = amplitude * sin((i * 2.3 + t * 5.6) * 1.33) + flow * amplitude * 0.35;
      curveVertex(x + (nx / norm) * wiggle, y + (ny / norm) * wiggle);
    }
  }
  endShape();
}

function drawTouchNode(x, y, nodeColor, state, now) {
  const r = red(nodeColor);
  const g = green(nodeColor);
  const b = blue(nodeColor);

  let pulse = 1;
  let strength = 0.8;
  if (state === "charging") {
    pulse = 1 + 0.16 * sin(now * 0.024 + x * 0.03);
    strength = 1;
  } else if (state === "active") {
    pulse = 1 + 0.22 * sin(now * 0.03 + y * 0.02);
    strength = 1.3;
  }

  blendMode(ADD);
  noStroke();
  fill(r, g, b, 22 * strength);
  circle(x, y, 52 * pulse);
  fill(r, g, b, 52 * strength);
  circle(x, y, 28 * pulse);
  fill(r, g, b, 130 * strength);
  circle(x, y, 14 * pulse);
  fill(255, 250, 242, 240);
  circle(x, y, 7.1 * pulse);
  fill(255, 255, 255, 190);
  circle(x + 2.2, y - 2.2, 3.2);
  blendMode(BLEND);
}

function drawFailedSparks(path, failColor, alpha, now) {
  const r = red(failColor);
  const g = green(failColor);
  const b = blue(failColor);
  noStroke();
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const bPoint = path[i + 1];
    for (let j = 0; j < 4; j++) {
      const t = (j + 1) / 5;
      const x = lerp(a.x, bPoint.x, t) + sin(now * 0.02 + i * 2.2 + j) * 2.2;
      const y = lerp(a.y, bPoint.y, t) + cos(now * 0.018 + i * 1.7 + j) * 2.2;
      fill(r, g, b, alpha * 0.45);
      circle(x, y, 2.3);
    }
  }
}

function drawSuccessfulTrace(trail) {
  drawConnectionCore(trail.path, trail.color, 0.95, 22);
  drawOrganicRibbon(trail.path, trail.color, 0.75, 16, millis(), 1.4);
  drawTrailDust(trail);
}

function drawTrailDust(trail) {
  const r = red(trail.color);
  const g = green(trail.color);
  const b = blue(trail.color);
  noStroke();
  for (const speck of trail.dust) {
    fill(r, g, b, speck.alpha * 0.42);
    circle(speck.x, speck.y, speck.size * 1.75);
    fill(r, g, b, speck.alpha * 0.65);
    circle(speck.x, speck.y, speck.size * 0.92);
  }
}

function drawBallGlow(ball, now, options = {}) {
  const [r, g, b] = ball.colorRGB;
  const intensity = options.intensity || 1;
  const sparkDensity = options.sparkDensity || 2;
  const coolCore = options.coolCore || false;
  const pulse = (0.86 + 0.14 * sin(now * 0.01 + ball.x * 0.02 + ball.y * 0.015)) * intensity;

  blendMode(ADD);
  noStroke();
  fill(r, g, b, 14 * pulse);
  circle(ball.x, ball.y, ball.r * 7.1);
  fill(r, g, b, 34 * pulse);
  circle(ball.x, ball.y, ball.r * 4.35);
  fill(r, g, b, 88 * pulse);
  circle(ball.x, ball.y, ball.r * 2.2);
  fill(coolCore ? 235 : 255, coolCore ? 245 : 248, 255, 230);
  circle(ball.x, ball.y, ball.r * 1.08);
  fill(255, 255, 255, 150);
  circle(ball.x + ball.r * 0.16, ball.y - ball.r * 0.22, ball.r * 0.37);

  for (let i = 0; i < sparkDensity; i++) {
    const angle = (TWO_PI * i) / sparkDensity + now * 0.0015 + ball.x * 0.004;
    const radius = ball.r * (1.55 + 0.22 * sin(now * 0.005 + i));
    const sx = ball.x + cos(angle) * radius;
    const sy = ball.y + sin(angle) * radius;
    fill(r, g, b, 55);
    circle(sx, sy, 1.45);
  }
  blendMode(BLEND);
}

function drawShield(ball, now) {
  noFill();
  const layers = constrain(ball.shieldLayers || 1, 1, 3);
  const pulse = 1 + 0.06 * sin(now * 0.012);
  const baseDiameter = ball.r * 2.15;

  for (let i = 0; i < layers; i++) {
    const ringDiameter = (baseDiameter + i * ball.r * 0.48) * pulse;
    const alphaMain = 170 - i * 22;
    const alphaGlow = 40 - i * 8;

    stroke(120, 255, 170, alphaMain);
    strokeWeight(2.2 - i * 0.28);
    circle(ball.x, ball.y, ringDiameter);

    stroke(120, 255, 170, alphaGlow);
    strokeWeight(6.4 - i * 0.9);
    circle(ball.x, ball.y, ringDiameter);
  }

  stroke(220, 255, 235, 55);
  strokeWeight(0.8);
  circle(ball.x, ball.y, (baseDiameter + layers * ball.r * 0.38) * pulse);
}

function drawTailTrail(ball, _now, vulnerable) {
  noStroke();
  for (let i = 0; i < ball.tailPoints.length; i++) {
    const p = ball.tailPoints[i];
    const alpha = map(i, 0, ball.tailPoints.length - 1, 8, vulnerable ? 80 : 34);
    const size = map(i, 0, ball.tailPoints.length - 1, 1.2, ball.r * 0.8);
    fill(245, 245, 255, alpha * 0.45);
    circle(p.x, p.y, size * 2.3);
    fill(245, 245, 255, alpha);
    circle(p.x, p.y, size);
  }
}

function drawPersistentTrace(trace) {
  drawSuccessfulTrace(trace);
}

function drawPathNodes(path, pathColor, alpha) {
  const r = red(pathColor);
  const g = green(pathColor);
  const b = blue(pathColor);
  noStroke();

  for (const point of path) {
    fill(r, g, b, alpha * 0.2);
    circle(point.x, point.y, 20);
  }
}

function createTrailDust(path) {
  const dust = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    for (let k = 0; k < 7; k++) {
      const t = random();
      dust.push({
        x: lerp(a.x, b.x, t) + random(-8, 8),
        y: lerp(a.y, b.y, t) + random(-8, 8),
        size: random(0.9, 2.1),
        alpha: random(12, 34),
      });
    }
  }
  return dust;
}

function circleTouchesAnyZone(x, y, radius) {
  for (const key of ZONE_KEYS) {
    if (circleTouchesPolygon(x, y, radius, zonePolygons[key])) {
      return true;
    }
  }
  return false;
}

function circleTouchesPolygon(cx, cy, radius, polygon) {
  if (pointInPolygon(cx, cy, polygon)) return true;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j];
    const b = polygon[i];
    if (distancePointToSegment(cx, cy, a.x, a.y, b.x, b.y) <= radius) {
      return true;
    }
  }
  return false;
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = constrain(t, 0, 1);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

function drawBalls(now) {
  for (const ball of balls) {
    ball.draw(now);
  }
}

function drawParticles(now) {
  noStroke();
  for (const particle of burstParticles) {
    const lifeRatio = 1 - (now - particle.bornAt) / particle.lifeMs;
    fill(particle.r, particle.g, particle.b, particle.baseAlpha * lifeRatio);
    circle(particle.x, particle.y, particle.size);
  }
}

function drawPointerHighlights() {
  for (const [pointerId, pointer] of activePointers.entries()) {
    const zoneColor = ZONE_SETTINGS[pointer.zone].color;
    const pointerColor = color(zoneColor[0], zoneColor[1], zoneColor[2]);
    const state = getPointerConnectionState(pointerId);
    drawTouchNode(pointer.x, pointer.y, pointerColor, state, millis());
  }
}

function getPointerConnectionState(pointerId) {
  let state = "forming";
  for (const connection of connections) {
    if (!connection.touches.some((touch) => touch.pointerId === pointerId)) continue;
    if (connection.state === "active") return "active";
    if (connection.state === "charging") state = "charging";
  }
  return state;
}

function drawCentralScore() {
  const scoreText = `${score}`;
  const digits = scoreText.length;
  const scoreCfg = GAME_CONFIG.visuals.centralScore;
  const baseSize = height * scoreCfg.baseSizeRatio;
  const reducedSize = baseSize - (digits - 1) * height * scoreCfg.perDigitReduceRatio;
  const responsiveSize = constrain(reducedSize, height * scoreCfg.minSizeRatio, height * scoreCfg.maxSizeRatio);

  noStroke();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(responsiveSize);
  fill(210, 210, 208, scoreCfg.opacity);
  text(scoreText, width * 0.5, height * 0.5);
  textStyle(NORMAL);
}

function drawQteOverlay(now) {
  if (qteState.current) {
    drawQTETextForAllSides(qteState.current);
    return;
  }

  if (qteState.feedback && now <= qteState.feedbackUntil) {
    const ok = qteState.feedback.startsWith("Success");
    drawQTETextForAllSides(
      { label: qteState.feedback, progress: 0, target: 0, kind: "feedback" },
      ok ? color(180, 235, 180, 140) : color(220, 140, 140, 140)
    );
  }
}

function drawQTETextForAllSides(eventData, explicitColor = null) {
  const topPoly = zonePolygons.top;
  const bottomPoly = zonePolygons.bottom;
  const leftPoly = zonePolygons.left;
  const rightPoly = zonePolygons.right;
  if (!topPoly || !bottomPoly || !leftPoly || !rightPoly) return;

  const topBounds = polygonBounds(topPoly);
  const bottomBounds = polygonBounds(bottomPoly);
  const leftBounds = polygonBounds(leftPoly);
  const rightBounds = polygonBounds(rightPoly);

  let message = eventData.label;
  if (
    eventData.kind === "destroy_any_streak" ||
    eventData.kind === "destroy_type_streak" ||
    eventData.kind === "connection_success_streak"
  ) {
    message += ` ${eventData.progress}/${eventData.target}`;
  }

  const textColor = explicitColor || color(220, 226, 235, 152);
  const fontSize = constrain(min(width, height) * 0.028, 16, 30);

  fill(textColor);
  drawQTETextTop(message, width * 0.5, topBounds.maxY + 28, fontSize);
  drawQTETextBottom(message, width * 0.5, bottomBounds.minY - 28, fontSize);
  drawQTETextLeft(message, leftBounds.maxX + 28, height * 0.5, fontSize);
  drawQTETextRight(message, rightBounds.minX - 28, height * 0.5, fontSize);
}

function polygonBounds(polygon) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of polygon) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

function drawQTETextTop(message, x, y, fontSize) {
  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(fontSize);
  translate(x, y);
  rotate(PI);
  text(message, 0, 0);
  pop();
}

function drawQTETextBottom(message, x, y, fontSize) {
  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(fontSize);
  translate(x, y);
  rotate(0);
  text(message, 0, 0);
  pop();
}

function drawQTETextLeft(message, x, y, fontSize) {
  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(fontSize);
  translate(x, y);
  rotate(HALF_PI);
  text(message, 0, 0);
  pop();
}

function drawQTETextRight(message, x, y, fontSize) {
  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(fontSize);
  translate(x, y);
  rotate(-HALF_PI);
  text(message, 0, 0);
  pop();
}

function resetGameState() {
  score = 0;
  destroyedLargeCount = 0;
  destroyedMediumCount = 0;
  destroyedSmallCount = 0;
  difficultyLevel = 0;
  connections = [];
  successfulTrails = [];
  balls = [];
  burstParticles = [];
  nextConnectionId = 1;
  nextBallSpawnAt = millis() + getSpawnIntervalMs() * 0.4;
  lastTouchActivityAt = millis();
  qteState.current = null;
  qteState.nextAt = millis() + QTE_INTERVAL_MS;
  qteState.lastType = null;
  qteState.feedback = null;
  qteState.feedbackUntil = 0;
  zoneLastActiveAt = { top: 0, bottom: 0, left: 0, right: 0 };
  playerCapacityState = {
    recentZones: [],
    recentCount: 0,
    currentPlayerCapacity: 2,
    atLeast3Since: null,
    atLeast4Since: null,
  };

  activePointers.clear();
  zoneOccupants = { top: null, bottom: null, left: null, right: null };

  for (let i = 0; i < START_BALLS; i++) {
    spawnBallByType(selectRandomBallType(), millis());
  }
}
