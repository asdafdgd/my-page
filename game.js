const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreBoard = document.getElementById('score-board');
const highScoreSpan = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');
const scoreHistory = document.getElementById('score-history');

// 이미지 로드
const playerImg = new Image();
playerImg.src = '도로롱.png';

const superJumpImg = new Image();
superJumpImg.src = '슈퍼점프.png';

let isGameRunning = false;
let score = 0;
let highScore = 0;
let animationId;
let gameHistory = [];

// 게임 설정
const GRAVITY = 0.6;
const JUMP_POWER = -12;
const FAST_LANDING_FORCE = 2.0;
const OBSTACLE_SPEED = 6;
const PLAYER_SIZE = 50;
const OBSTACLE_WIDTH = 30;
const OBSTACLE_HEIGHT = 40;

// 슈퍼점프 설정
const SUPER_JUMP_COOLDOWN = 15000;
const SUPER_JUMP_DURATION = 3000;
const EFFECT_DURATION = 1000; // 1초 연출
let lastSuperJumpTime = 0;
let isEffectActive = false;
let effectStartTime = 0;

class Player {
    constructor() {
        this.x = 50;
        this.y = canvas.height - PLAYER_SIZE;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.dy = 0;
        this.isJumping = false;
        this.isFastLanding = false;
        this.isSuperJumping = false;
        this.superJumpStartTime = 0;
    }

    draw() {
        if (this.y + this.height > 0) {
            if (playerImg.complete) {
                ctx.drawImage(playerImg, this.x, this.y, this.width, this.height);
                if (this.isSuperJumping) {
                    ctx.strokeStyle = '#4CAF50';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
                }
            } else {
                ctx.fillStyle = this.isSuperJumping ? '#4CAF50' : '#ff0000';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        } else {
            this.drawOffScreenIndicator();
        }
    }

    drawOffScreenIndicator() {
        const centerX = this.x + this.width / 2;
        ctx.save();
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('▲', centerX, 20);
        const heightFromGround = Math.round(canvas.height - this.y - this.height);
        ctx.fillText(`${heightFromGround}m`, centerX, 40);
        ctx.restore();
    }

    update() {
        if (isEffectActive) return; // 연출 중에는 물리 업데이트 정지

        let currentGravity = this.isFastLanding ? GRAVITY * 4 : GRAVITY;
        if (this.isSuperJumping) {
            const now = Date.now();
            if (now - this.superJumpStartTime < SUPER_JUMP_DURATION) {
                currentGravity = this.isFastLanding ? GRAVITY * 3 : 0.15;
            } else {
                this.isSuperJumping = false;
            }
        }
        this.dy += currentGravity;
        this.y += this.dy;
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.dy = 0;
            this.isJumping = false;
            this.isFastLanding = false;
            this.isSuperJumping = false;
        }
    }

    jump(isSuper = false) {
        if (!this.isJumping && !isEffectActive) {
            const now = Date.now();
            if (isSuper) {
                if (now - lastSuperJumpTime >= SUPER_JUMP_COOLDOWN) {
                    startSuperJumpEffect(); // 연출 시작
                }
            } else {
                this.dy = JUMP_POWER;
                this.isJumping = true;
                this.isFastLanding = false;
            }
        }
    }

    fastLand() {
        if (this.isJumping && !isEffectActive) {
            this.isFastLanding = true;
        }
    }

    applySuperJumpPhysic() {
        this.dy = -22; 
        this.isJumping = true;
        this.isSuperJumping = true;
        this.superJumpStartTime = Date.now();
        lastSuperJumpTime = Date.now();
    }
}

class Obstacle {
    constructor() {
        this.x = canvas.width;
        this.width = OBSTACLE_WIDTH;
        this.height = OBSTACLE_HEIGHT + Math.random() * 30;
        this.y = canvas.height - this.height;
        this.type = Math.floor(Math.random() * 2);
    }

    draw() {
        ctx.fillStyle = '#333';
        if (this.type === 0) {
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else {
            ctx.beginPath();
            ctx.moveTo(this.x, canvas.height);
            ctx.lineTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, canvas.height);
            ctx.closePath();
            ctx.fill();
        }
    }

    update() {
        if (isEffectActive) return; // 연출 중에는 이동 정지
        this.x -= OBSTACLE_SPEED + (score / 1200);
    }
}

let player = new Player();
let obstacles = [];
let frameCount = 0;

function spawnObstacle() {
    if (isEffectActive) return; // 연출 중에는 생성 정지
    const minGap = PLAYER_SIZE * 2;
    let canSpawn = true;
    if (obstacles.length > 0) {
        const lastObstacle = obstacles[obstacles.length - 1];
        if (canvas.width - (lastObstacle.x + lastObstacle.width) < minGap) {
            canSpawn = false;
        }
    }
    if (canSpawn && frameCount % (80 + Math.floor(Math.random() * 60)) === 0) {
        obstacles.push(new Obstacle());
    }
}

function checkCollision(p, obs) {
    if (isEffectActive) return false; // 연출 중에는 충돌 체크 정지
    const padding = 10;
    if (p.y + p.height < 0) return false;
    if (obs.type === 0) {
        return (
            p.x + padding < obs.x + obs.width &&
            p.x + p.width - padding > obs.x &&
            p.y + padding < obs.y + obs.height &&
            p.y + p.height - padding > obs.y
        );
    } else {
        const triangleLeft = obs.x;
        const triangleRight = obs.x + obs.width;
        return (
            p.x + p.width - padding > triangleLeft &&
            p.x + padding < triangleRight &&
            p.y + p.height - padding > obs.y
        );
    }
}

function startSuperJumpEffect() {
    isEffectActive = true;
    effectStartTime = Date.now();
}

function drawSuperJumpEffect() {
    const now = Date.now();
    const elapsed = now - effectStartTime;
    const progress = elapsed / EFFECT_DURATION;

    if (progress >= 1) {
        isEffectActive = false;
        player.applySuperJumpPhysic();
        return;
    }

    // 1. 투명도 40% 검정 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. 슈퍼점프 이미지 이동 (빠르게 진입 후 천천히 드리프트)
    if (superJumpImg.complete) {
        const targetHeight = 250;
        const scale = targetHeight / superJumpImg.naturalHeight;
        const imgWidth = superJumpImg.naturalWidth * scale;
        const imgHeight = targetHeight;

        let x;
        if (progress < 0.2) {
            // 처음 0.2초 동안 (전체 연출의 20%) 오른쪽 끝에서 왼쪽 끝(0)으로 매우 빠르게 이동
            const fastProgress = progress / 0.2;
            x = canvas.width * (1 - fastProgress);
        } else {
            // 나머지 0.8초 동안 아주 느린 속도로 계속 왼쪽으로 이동 (드리프트 효과)
            const slowProgress = (progress - 0.2) / 0.8;
            x = 0 - (slowProgress * 40); // 40px 정도 더 느리게 이동
        }
        
        const y = (canvas.height - imgHeight) / 2;
        ctx.drawImage(superJumpImg, x, y, imgWidth, imgHeight);
    }

    // "SUPER JUMP!" 텍스트 연출 (이미지가 멈춘 후 혹은 동시에 출력)
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SUPER JUMP!!', canvas.width / 2, canvas.height / 2 + 120);
}

function drawUI() {
    const now = Date.now();
    const timeLeft = Math.max(0, SUPER_JUMP_COOLDOWN - (now - lastSuperJumpTime));
    
    ctx.font = 'bold 16px Arial';
    
    ctx.textAlign = 'left';
    if (timeLeft === 0) {
        ctx.fillStyle = '#4CAF50';
        ctx.fillText('슈퍼점프: READY', 10, 30);
    } else {
        ctx.fillStyle = '#FF5722';
        ctx.fillText(`슈퍼점프 쿨타임: ${(timeLeft / 1000).toFixed(1)}s`, 10, 30);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.fillText('점프: Space / ↑', canvas.width - 10, 25);
    ctx.fillText('슈퍼점프: Shift', canvas.width - 10, 45);
    ctx.fillText('빠른 착지: ↓', canvas.width - 10, 65);
}

function updateGame() {
    if (!isGameRunning) return;
    
    // 일반 게임 화면 그리기 (지워지지 않게 먼저 그림)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.stroke();

    player.update();
    player.draw();
    
    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].draw();
    }

    if (!isEffectActive) {
        spawnObstacle();
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update();
            if (checkCollision(player, obstacles[i])) {
                gameOver();
                return;
            }
            if (obstacles[i].x + obstacles[i].width < 0) {
                obstacles.splice(i, 1);
                score += 10;
                updateScoreUI();
            }
        }
        frameCount++;
    } else {
        // 연출 효과 그리기 (오버레이)
        drawSuperJumpEffect();
    }

    drawUI();
    animationId = requestAnimationFrame(updateGame);
}

function updateScoreUI() {
    scoreBoard.innerHTML = `점수: ${score} | 최고 점수: <span id="high-score">${highScore}</span>`;
}

function gameOver() {
    isGameRunning = false;
    cancelAnimationFrame(animationId);
    const date = new Date().toLocaleTimeString();
    gameHistory.unshift({ score, date });
    if (gameHistory.length > 5) gameHistory.pop();
    updateDashboard();
    if (score > highScore) {
        highScore = score;
    }
    startBtn.style.display = 'inline-block';
    startBtn.innerText = '다시 시작';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
}

function updateDashboard() {
    scoreHistory.innerHTML = '';
    gameHistory.forEach(record => {
        const li = document.createElement('li');
        li.innerText = `[${record.date}] 점수: ${record.score}`;
        scoreHistory.appendChild(li);
    });
}

function startGame() {
    score = 0;
    frameCount = 0;
    obstacles = [];
    player = new Player();
    lastSuperJumpTime = 0;
    isEffectActive = false;
    isGameRunning = true;
    startBtn.style.display = 'none';
    updateScoreUI();
    updateGame();
}

window.addEventListener('keydown', (e) => {
    if (!isGameRunning || isEffectActive) return;
    if (e.shiftKey || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        player.jump(true);
        e.preventDefault();
    } else if (e.code === 'Space' || e.code === 'ArrowUp') {
        player.jump(false);
        e.preventDefault();
    } else if (e.code === 'ArrowDown') {
        player.fastLand();
        e.preventDefault();
    }
});

canvas.addEventListener('mousedown', () => {
    if (isGameRunning && !isEffectActive) player.jump(false);
});

startBtn.addEventListener('click', startGame);
updateScoreUI();
