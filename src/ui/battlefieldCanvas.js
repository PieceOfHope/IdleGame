const UNIT_LEFT_PCT = {
  ally: 0.18,
  player: 0.36,
  enemy0: 0.66,
  enemy1: 0.79,
  enemy2: 0.92,
};

const SPRITE_RADIUS = 24;
const HP_BAR_WIDTH = 44;
const HP_BAR_HEIGHT = 6;
const HP_BAR_GAP = 10;
const LABEL_GAP = 10;
const ANCHOR_Y_RATIO = 0.55;

const COLORS = {
  panel: '#181b22',
  panelAlt: '#1f232c',
  border: '#2a2f3a',
  textMuted: '#9aa0ab',
  danger: '#d9534f',
  accent: '#f2b84b',
  ally: '#4a9eff',
};

const ATTACK_DURATION_MS = 220;
const HIT_DURATION_MS = 300;
const DEFEAT_DURATION_MS = 320;
const APPEAR_DURATION_MS = 250;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0;
    this.maxLife = 900;
  }

  update(dtMs) {
    this.life += dtMs;
    return this.life < this.maxLife;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    const y = this.y - t * 34;
    const opacity = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    ctx.save();
    ctx.globalAlpha = Math.max(0, opacity);
    ctx.fillStyle = this.color;
    ctx.font = '700 13px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(this.text, this.x, y);
    ctx.restore();
  }
}

class BurstParticle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 1.2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 0;
    this.maxLife = 400 + Math.random() * 200;
    this.size = 2 + Math.random() * 2;
  }

  update(dtMs) {
    this.x += this.vx * dtMs * 0.06;
    this.y += this.vy * dtMs * 0.06;
    this.life += dtMs;
    return this.life < this.maxLife;
  }

  draw(ctx) {
    const opacity = 1 - this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, opacity);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class UnitVisual {
  constructor(key, emoji, label, glowColor, initialVisible) {
    this.key = key;
    this.emoji = emoji;
    this.label = label;
    this.glowColor = glowColor;
    this.hpPct = 1;
    this.visible = initialVisible;
    this.visibleT = initialVisible ? 1 : 0;
    this.attackT = null;
    this.hitT = null;
    this.defeatT = null;
  }
}

// 전투화면 전용 캔버스 렌더러 - 아군/플레이어/몬스터(최대 3마리) 스프라이트, HP바,
// 공격/피격/처치 연출과 파티클을 직접 그린다. 나머지 UI(스탯/업그레이드 등)는 여전히 DOM이 담당한다.
export function createBattlefieldRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  const units = {
    ally: new UnitVisual('ally', '🧙', '아군', COLORS.ally, true),
    player: new UnitVisual('player', '🥷', '플레이어', COLORS.accent, true),
    enemy0: new UnitVisual('enemy0', '👹', '몬스터', COLORS.danger, true),
    enemy1: new UnitVisual('enemy1', '👹', '몬스터', COLORS.danger, false),
    enemy2: new UnitVisual('enemy2', '👹', '몬스터', COLORS.danger, false),
  };

  let particles = [];
  let width = 0;
  let height = 0;
  let lastTime = performance.now();
  let rafId = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvas);
  resize();

  function unitPos(key) {
    return { x: width * UNIT_LEFT_PCT[key], y: height * ANCHOR_Y_RATIO };
  }

  function drawUnit(unit, now) {
    if (unit.visibleT <= 0.001) return;

    const { x, y } = unitPos(unit.key);
    let scale = 0.8 + 0.2 * unit.visibleT;
    let offsetY = (1 - unit.visibleT) * 14;
    const appearAlpha = unit.visibleT;

    if (unit.attackT !== null) {
      const t = (now - unit.attackT) / ATTACK_DURATION_MS;
      if (t < 1) {
        const bounce = Math.sin(Math.min(1, t) * Math.PI);
        scale += bounce * 0.15;
        offsetY -= bounce * 5;
      } else {
        unit.attackT = null;
      }
    }

    let shakeX = 0;
    let flashAlpha = 0;
    if (unit.hitT !== null) {
      const t = (now - unit.hitT) / HIT_DURATION_MS;
      if (t < 1) {
        shakeX = Math.sin(Math.min(1, t) * Math.PI * 4) * 4 * (1 - t);
        flashAlpha = 1 - t;
      } else {
        unit.hitT = null;
      }
    }

    if (unit.defeatT !== null) {
      const t = (now - unit.defeatT) / DEFEAT_DURATION_MS;
      if (t < 1) {
        scale += Math.sin(Math.min(1, t) * Math.PI) * 0.3;
      } else {
        unit.defeatT = null;
      }
    }

    ctx.save();
    ctx.globalAlpha = appearAlpha;
    ctx.translate(x + shakeX, y + offsetY);
    ctx.scale(scale, scale);

    const hpY = -SPRITE_RADIUS - HP_BAR_GAP;
    ctx.fillStyle = COLORS.panelAlt;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    roundRect(ctx, -HP_BAR_WIDTH / 2, hpY - HP_BAR_HEIGHT / 2, HP_BAR_WIDTH, HP_BAR_HEIGHT, 3);
    ctx.fill();
    ctx.stroke();
    const hpFillW = HP_BAR_WIDTH * Math.max(0, Math.min(1, unit.hpPct));
    if (hpFillW > 0) {
      ctx.fillStyle = COLORS.danger;
      roundRect(ctx, -HP_BAR_WIDTH / 2, hpY - HP_BAR_HEIGHT / 2, hpFillW, HP_BAR_HEIGHT, 3);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0, 0, SPRITE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = unit.glowColor;
    ctx.shadowColor = unit.glowColor;
    ctx.shadowBlur = unit.key === 'ally' ? 14 : 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = appearAlpha * flashAlpha * 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, SPRITE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.danger;
      ctx.fill();
      ctx.restore();
    }

    ctx.font = '24px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.emoji, 0, 2);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = appearAlpha;
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '11px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unit.label, x + shakeX, y + offsetY + SPRITE_RADIUS + LABEL_GAP);
    ctx.restore();
  }

  function update(dtMs) {
    for (const unit of Object.values(units)) {
      const target = unit.visible ? 1 : 0;
      const step = dtMs / APPEAR_DURATION_MS;
      if (unit.visibleT < target) unit.visibleT = Math.min(target, unit.visibleT + step);
      else if (unit.visibleT > target) unit.visibleT = Math.max(target, unit.visibleT - step);
    }
    particles = particles.filter((p) => p.update(dtMs));
  }

  function draw(now) {
    ctx.clearRect(0, 0, width, height);
    drawUnit(units.ally, now);
    drawUnit(units.player, now);
    drawUnit(units.enemy0, now);
    drawUnit(units.enemy1, now);
    drawUnit(units.enemy2, now);
    for (const p of particles) p.draw(ctx);
  }

  function frame(time) {
    const dtMs = Math.min(100, time - lastTime);
    lastTime = time;
    update(dtMs);
    draw(time);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return {
    setSnapshot({ playerHpPct, monsterHpPct, extraEnemyCount }) {
      units.player.hpPct = playerHpPct;
      units.enemy0.hpPct = monsterHpPct;
      units.enemy1.visible = extraEnemyCount >= 1;
      units.enemy2.visible = extraEnemyCount >= 2;
    },
    triggerAttack(key) {
      const unit = units[key];
      if (unit) unit.attackT = performance.now();
    },
    triggerHit(key) {
      const unit = units[key];
      if (unit) unit.hitT = performance.now();
    },
    triggerDefeat(key, goldReward) {
      const unit = units[key];
      if (!unit) return;
      unit.defeatT = performance.now();
      const { x, y } = unitPos(key);
      particles.push(new FloatingText(x, y - SPRITE_RADIUS, `+${goldReward}`, COLORS.accent));
      for (let i = 0; i < 8; i += 1) particles.push(new BurstParticle(x, y, COLORS.danger));
    },
    spawnText(key, text, color) {
      const { x, y } = unitPos(key);
      particles.push(new FloatingText(x, y - SPRITE_RADIUS, text, color));
    },
    destroy() {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    },
  };
}
