// CANVAS

const canvas =
    document.getElementById("canvas");

const ctx =
    canvas.getContext("2d");

const altitudeGraph =
    document.getElementById(
        "canvas-grafico-1"
    );

const velocityGraph =
    document.getElementById(
        "canvas-grafico-2"
    );

// CONSTANTES FÍSICAS

const G = 9.80665;
const EARTH_RADIUS = 6371000;
const AIR_DENSITY = 1.225;
const SCALE_HEIGHT = 8500;
const AREA = 0.8;
const CHASSIS_MASS = 50;
const STAGE_MASS = 45;
const MAX_DYNAMIC_PRESSURE = 60000;
const MAX_ACCELERATION = 120;
const EPSILON = 1e-6;

// CONFIGURAÇÕES VISUAIS

const SIMULATION_SPEED = 2.5;
const WORLD_SCALE = 0.035;
const CAMERA_FOLLOW_POSITION = 0.62;

// ESTADO

const state = {
    x: 0,
    h: 0,
    vx: 0,
    vy: 0,
    v: 0,
    acceleration: 0,
    q: 0,
    gForce: 1,
    gravity: G,
    centrifugal: 0,
    pitch: 90,
    fuel: 300,
    initialFuel: 300,
    dryMass: 95,
    mass: 395,
    thrust: 15000,
    isp: 250,
    cd: 0.5,
    stages: 1,
    currentStage: 1,
    stageFuel: 300,
    massFlow: 0,
    elapsed: 0,
    maxAltitude: 0,
    running: false,
    finished: false,
    orbital: false,
    twrWarning: false,
    history: {
        t: [],
        h: [],
        v: [],
        a: []
    }
};

let stars = [];

let clouds = [];

let lastFrame = 0;

let cameraAltitude = 0;


// =====================================================
// ATALHOS
// =====================================================

function $(id) {

    return document.getElementById(id);

}


// =====================================================
// AJUSTE DO TAMANHO DOS CANVASES
// =====================================================

function resizeCanvas(canvasElement) {

    const rect =
        canvasElement.getBoundingClientRect();

    const width =
        Math.max(
            1,
            Math.floor(rect.width)
        );

    const height =
        Math.max(
            1,
            Math.floor(rect.height)
        );

    const dpr =
        window.devicePixelRatio || 1;

    canvasElement.width =
        width * dpr;

    canvasElement.height =
        height * dpr;

    const context =
        canvasElement.getContext("2d");

    context.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    return {
        width,
        height
    };
}


// =====================================================
// CONFIGURAÇÃO
// =====================================================

function getConfiguration() {

    const fuel =
        Number(
            $("massa").value
        );

    const thrust =
        Number(
            $("empuxo").value
        );

    const isp =
        $("propelente").value ===
        "líquido"
            ? 450
            : 250;

    const cd =
        Number(
            $("coifa").value
        );

    const stages =
        Number(
            $("estagios").value
        );

    const dryMass =
        CHASSIS_MASS +
        stages * STAGE_MASS;

    const massFlow =
        thrust /
        (isp * G);

    const burnTime =
        fuel /
        massFlow;

    return {

        fuel,

        thrust,

        isp,

        cd,

        stages,

        dryMass,

        massFlow,

        burnTime

    };
}


// =====================================================
// ATUALIZAR CONFIGURAÇÃO
// =====================================================

function updateCalculations() {

    const config =
        getConfiguration();


    $("label-empuxo").textContent =
        config.thrust.toLocaleString(
            "pt-BR"
        ) + " N";


    $("label-massa").textContent =
        config.fuel.toLocaleString(
            "pt-BR"
        ) + " kg";


    $("informacoes-configuracao").innerHTML =

        `Massa seca: <b>${config.dryMass.toFixed(0)} kg</b><br>` +

        `Massa inicial: <b>${(
            config.dryMass +
            config.fuel
        ).toFixed(0)} kg</b><br>` +

        `Vazão: <b>${config.massFlow.toFixed(2)} kg/s</b><br>` +

        `Tempo de queima: <b>${config.burnTime.toFixed(1)} s</b><br>` +

        `Isp: <b>${config.isp} s</b>`;


    if (!state.running) {

        state.fuel =
            config.fuel;

        state.initialFuel =
            config.fuel;

        state.dryMass =
            config.dryMass;

        state.mass =
            config.dryMass +
            config.fuel;

        state.thrust =
            config.thrust;

        state.isp =
            config.isp;

        state.cd =
            config.cd;

        state.stages =
            config.stages;

        state.currentStage = 1;

        state.stageFuel =
            config.fuel /
            config.stages;

        state.massFlow =
            config.massFlow;

        updateHUD();

        draw();
    }
}


// =====================================================
// RESET
// =====================================================

function resetState() {

    const config =
        getConfiguration();


    state.x = 0;

    state.h = 0;

    state.vx = 0;

    state.vy = 0;

    state.v = 0;

    state.acceleration = 0;

    state.q = 0;

    state.gForce = 1;

    state.gravity = G;

    state.centrifugal = 0;

    state.pitch = 90;


    state.fuel =
        config.fuel;

    state.initialFuel =
        config.fuel;

    state.dryMass =
        config.dryMass;

    state.mass =
        config.dryMass +
        config.fuel;

    state.thrust =
        config.thrust;

    state.isp =
        config.isp;

    state.cd =
        config.cd;

    state.stages =
        config.stages;

    state.currentStage = 1;

    state.stageFuel =
        config.fuel /
        config.stages;

    state.massFlow =
        config.massFlow;


    state.elapsed = 0;

    state.maxAltitude = 0;

    state.running = false;

    state.finished = false;

    state.orbital = false;

    state.twrWarning = false;


    state.history = {

        t: [],

        h: [],

        v: [],

        a: []

    };


    cameraAltitude = 0;
}


// =====================================================
// LANÇAMENTO
// =====================================================

function launch() {

    resetState();

    if (state.thrust / state.mass < G) {
        endGame(
            "⚠️ TWR INSUFICIENTE",
            "O empuxo precisa superar o peso do foguete para sair do solo. Aumente o empuxo ou reduza a massa de combustível."
        );
        return;
    }

    state.running = true;

    setControlsDisabled(true);

    $("lançar").disabled = true;

    $("message").style.display = "none";

    initScenery();

    lastFrame =
        performance.now();

    requestAnimationFrame(loop);
}


// =====================================================
// LOOP
// =====================================================

function loop(now) {

    if (!state.running) {
        return;
    }


    let dt =
        (now - lastFrame) /
        1000;

    lastFrame = now;


    dt =
        Math.min(
            dt,
            0.04
        );


    dt *=
        SIMULATION_SPEED;


    physics(dt);

    updateCamera();

    draw();

    updateHUD();

    drawGraphs();


    if (state.running) {

        requestAnimationFrame(
            loop
        );
    }
}


// =====================================================
// CÂMERA
// =====================================================

function updateCamera() {

    const rect =
        canvas.getBoundingClientRect();

    const visibleWorldHeight =
        rect.height /
        WORLD_SCALE;


    const target =
        state.h -
        visibleWorldHeight *
        (1 -
            CAMERA_FOLLOW_POSITION);


    cameraAltitude =
        Math.max(
            0,
            target
        );
}


// =====================================================
// FÍSICA
// =====================================================

function physics(dt) {

    state.elapsed += dt;


    // Gravidade

    state.gravity =
        G *
        Math.pow(
            EARTH_RADIUS /
            (
                EARTH_RADIUS +
                state.h
            ),
            2
        );


    // Densidade

    const density =
        AIR_DENSITY *
        Math.exp(
            -state.h /
            SCALE_HEIGHT
        );


    // Velocidade

    state.v = Math.sqrt(state.vx ** 2 + state.vy ** 2);


    // Pressão dinâmica

    state.q =
        0.5 *
        density *
        state.v ** 2;


    // Combustível

    const requestedFuel = state.massFlow * dt;
    const fuelBurned = Math.min(state.fuel, requestedFuel);
    const burnFraction = requestedFuel > EPSILON
        ? fuelBurned / requestedFuel
        : 0;

    state.fuel = Math.max(0, state.fuel - fuelBurned);


    updateStage();


    // Massa

    // Usa a massa média durante o passo para evitar um salto artificial
    // de aceleração no instante em que o combustível é consumido.
    state.mass = state.dryMass + state.fuel + fuelBurned * 0.5;


    // Inclinação

    updatePitch();


    const pitchRad =
        state.pitch *
        Math.PI /
        180;


    // Empuxo

    let thrustX = 0;

    let thrustY = 0;


    if (fuelBurned > EPSILON) {
        const effectiveThrust = state.thrust * burnFraction;

        thrustX =
            effectiveThrust *
            Math.cos(
                pitchRad
            );

        thrustY =
            effectiveThrust *
            Math.sin(
                pitchRad
            );
    }


    // Arrasto

    const drag =
        state.q *
        state.cd *
        AREA;


    const dragX = state.v > EPSILON
        ? drag * state.vx / state.v
        : 0;

    const dragY = state.v > EPSILON
        ? drag * state.vy / state.v
        : 0;


    // Centrífuga

    state.centrifugal =
        state.vx ** 2 /
        (
            EARTH_RADIUS +
            state.h
        );


    // Aceleração X

    const ax =
        (
            thrustX -
            dragX
        ) /
        state.mass;


    // Aceleração Y

    let ay =
        (
            thrustY -
            dragY
        ) /
        state.mass
        -
        state.gravity
        +
        state.centrifugal;


    // No solo

    if (
        state.h <= 0 &&
        ay < 0
    ) {

        ay = 0;

        state.vy = 0;

        state.h = 0;

        state.twrWarning =
            state.thrust /
            state.mass <
            G;

    } else {

        state.twrWarning = false;
    }


    // Aceleração total

    state.acceleration =
        Math.sqrt(
            ax ** 2 +
            ay ** 2
        );


    // G Force

    state.gForce =
        (
            state.acceleration +
            state.gravity
        ) /
        G;


    // Velocidades

    state.vx +=
        ax * dt;

    state.vy +=
        ay * dt;


    // Posição

    state.x +=
        state.vx * dt;

    state.h +=
        state.vy * dt;


    if (state.h < 0) {

        state.h = 0;

        state.vy = 0;

        if (state.fuel <= EPSILON) {
            endGame(
                "🛬 POUSO CONCLUÍDO",
                `O foguete retornou ao solo após atingir ${(
                    state.maxAltitude / 1000
                ).toFixed(2)} km de altitude máxima.`
            );
            return;
        }
    }


    // Máxima altitude

    state.maxAltitude =
        Math.max(
            state.maxAltitude,
            state.h
        );


    // Histórico

    if (
        state.history.t.length === 0 ||
        state.elapsed -
        state.history.t[
            state.history.t.length - 1
        ] >= 0.08
    ) {

        state.history.t.push(
            state.elapsed
        );

        state.history.h.push(
            state.h
        );

        state.history.v.push(
            state.v
        );

        state.history.a.push(
            state.acceleration
        );
    }


    // MAX Q

    if (
        state.q >
        MAX_DYNAMIC_PRESSURE
    ) {
        endGame(
            "💥 MAX-Q: FALHA ESTRUTURAL",

            "A pressão dinâmica ficou alta demais. Tente uma coifa com menor arrasto ou reduza o empuxo."
        );
        return;
    }


    // G extremo

    if (
        state.acceleration >
        MAX_ACCELERATION
    ) {
        endGame(
            "💥 FORÇA G EXTREMA",
            "A aceleração ficou alta demais para a estrutura do foguete."
        )
        return;
    }


    // Escape

    if (state.v > 11200) {
        endGame(
            "🚀 ESCAPOU DA TERRA",
            "A velocidade ultrapassou aproximadamente 11,2 km/s."
        );
        return;
    }


    // Órbita

    if (
        state.h > 100000 &&
        state.centrifugal >=
        state.gravity &&
        state.vx > 7000 &&
        !state.orbital
    ) {

        state.orbital = true;

        endGame(
            "🌍 ÓRBITA ALCANÇADA!",

            `O foguete atingiu ${Math.floor(
                state.vx
            )} m/s de velocidade horizontal em grande altitude.`
        );

        return;
    }


    // Combustível acabou

    if (
        state.fuel <= 0 &&
        state.vy < 0 &&
        state.elapsed > 2
    ) {

        const km =
            (
                state.maxAltitude /
                1000
            ).toFixed(2);


        if (
            state.maxAltitude >=
            100000
        ) {

            endGame(
                "🎯 SUCESSO DE SONDAGEM",

                `O foguete atingiu ${km} km de altitude máxima.`
            );

        } else {

            endGame(
                "📉 VOO SUBORBITAL",

                `O foguete atingiu um apogeu de ${km} km e iniciou a queda.`
            );
        }
    }
}


// =====================================================
// ESTÁGIOS
// =====================================================

function updateStage() {

    if (state.stages <= 1) {

        return;
    }


    const consumed =
        state.initialFuel -
        state.fuel;


    const nextStage =
        Math.min(
            state.stages,
            Math.floor(
                consumed /
                state.stageFuel
            ) + 1
        );


    if (
        nextStage >
        state.currentStage
    ) {

        state.currentStage =
            nextStage;


        state.dryMass =
            Math.max(
                CHASSIS_MASS,
                state.dryMass -
                STAGE_MASS
            );
    }
}


// =====================================================
// TRAJETÓRIA
// =====================================================

function updatePitch() {

    const profile =
        $("perfil-voo").value;


    if (
        profile ===
        "sondagem"
    ) {

        state.pitch = 90;

        return;
    }


    const start = 2000;

    const end = 85000;


    if (state.h > start) {

        const p =
            Math.min(
                1,
                (
                    state.h -
                    start
                ) /
                (
                    end -
                    start
                )
            );


        state.pitch =
            90 -
            90 *
            Math.pow(
                p,
                0.8
            );
    }
}


// =====================================================
// CONTROLES
// =====================================================

function setControlsDisabled(
    disabled
) {

    [
        "perfil-voo",
        "coifa",
        "estagios",
        "propelente",
        "empuxo",
        "massa"
    ].forEach(id => {

        $(id).disabled =
            disabled;
    });
}


// =====================================================
// HUD
// =====================================================

function updateHUD() {

    $("altitude").textContent =
        (
            state.h / 1000
        ).toFixed(2);


    $("velo-y").textContent =
        Math.floor(
            state.vy
        );


    $("velo-x").textContent =
        Math.floor(
            state.vx
        );


    $("inclinação").textContent =
        state.pitch.toFixed(1);


    $("gforce").textContent =
        state.gForce.toFixed(2);


    $("pressao").textContent =
        Math.floor(
            state.q
        );


    $("pressao").style.color =
        state.q > 35000
            ? "#ff3b4f"
            : "#ff4d5e";


    $("combustivel").textContent =
        Math.max(
            0,
            state.fuel
        ).toFixed(0);


    $("estagio-atual").textContent =
        `${state.currentStage}/${state.stages}`;


    $("gravidade-local").textContent =
        state.gravity.toFixed(2);


    $("aceleracao").textContent =
        state.acceleration.toFixed(2);


    $("tempo-voo").textContent =
        state.elapsed.toFixed(1);


    // Temperatura aproximada
    const temperature =
        15 -
        Math.min(
            70,
            state.h *
            0.0008
        );

    $("temperatura").textContent =
        temperature.toFixed(1);
}


// =====================================================
// FINAL DO VOO
// =====================================================

function endGame(
    title,
    description
) {

    if (state.finished) {
        return;
    }

    state.running = false;

    state.finished = true;


    $("msg-title").textContent =
        title;


    $("msg-desc").textContent =
        description;


    $("message").style.display =
        "flex";


    $("lançar").disabled =
        false;


    setControlsDisabled(false);


    draw();

    updateHUD();

    drawGraphs();
}


// =====================================================
// REINICIAR
// =====================================================

function resetSim() {

    state.running = false;

    state.finished = false;


    $("message").style.display =
        "none";


    $("lançar").disabled =
        false;


    setControlsDisabled(false);


    resetState();

    updateCalculations();

    drawGraphs();

    draw();
}


// =====================================================
// CENÁRIO
// =====================================================

function initScenery() {

    stars = [];

    clouds = [];


    // Estrelas

    for (
        let i = 0;
        i < 120;
        i++
    ) {

        stars.push({

            x:
                Math.random() *
                canvas.clientWidth,

            y:
                Math.random() *
                canvas.clientHeight,

            size:
                Math.random() *
                2 +
                0.5
        });
    }


    // Nuvens distribuídas por altitude

    const cloudAltitudes = [

        300,
        600,
        900,
        1300,
        1700,
        2200,
        2800,
        3500,
        4500,
        5500,
        7000,
        9000
    ];


    cloudAltitudes.forEach(
        altitude => {

            clouds.push({

                x:
                    Math.random() *
                    canvas.clientWidth,

                altitude:

                    altitude,

                w:
                    50 +
                    Math.random() *
                    100,

                h:
                    15 +
                    Math.random() *
                    20
            });
        }
    );
}


// =====================================================
// DESENHO
// =====================================================

function draw() {

    const rect =
        canvas.getBoundingClientRect();

    const width =
        rect.width;

    const height =
        rect.height;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    // Cor do céu

    const altitudeFactor =
        Math.min(
            state.h /
            50000,
            1
        );


    const r =
        Math.floor(
            5 +
            3 *
            (1 -
                altitudeFactor)
        );


    const g =
        Math.floor(
            25 +
            25 *
            (1 -
                altitudeFactor)
        );


    const b =
        Math.floor(
            55 +
            90 *
            altitudeFactor
        );


    ctx.fillStyle =
        `rgb(${r}, ${g}, ${b})`;


    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    drawStars();

    drawClouds();

    drawGround();

    drawRocket();


    if (state.twrWarning) {

        ctx.fillStyle =
            "#ff4d5e";

        ctx.font =
            "bold 16px Courier New";

        ctx.textAlign =
            "center";


        ctx.fillText(
            "TWR < 1: FOGUETE MUITO PESADO!",
            width / 2,
            40
        );
    }
}


// =====================================================
// ESTRELAS
// =====================================================

function drawStars() {

    if (state.h < 12000) {

        return;
    }


    ctx.fillStyle =
        "rgba(255,255,255,0.85)";


    stars.forEach(star => {

        let x =
            (
                star.x -
                state.x *
                0.02
            ) %
            canvas.clientWidth;


        if (x < 0) {

            x +=
                canvas.clientWidth;
        }


        const y =
            (
                star.y +
                state.h *
                0.01
            ) %
            canvas.clientHeight;


        ctx.fillRect(
            x,
            y,
            star.size,
            star.size
        );
    });
}


// =====================================================
// NUVENS
// =====================================================

function drawClouds() {

    if (state.h > 12000) {

        return;
    }


    ctx.save();


    ctx.globalAlpha =
        Math.max(
            0,
            1 -
            state.h /
            12000
        );


    clouds.forEach(cloud => {

        const y =
            canvas.clientHeight -
            45 -
            (
                cloud.altitude -
                cameraAltitude
            ) *
            WORLD_SCALE;


        let x =
            cloud.x -
            state.x *
            0.02;


        x =
            x %
            (
                canvas.clientWidth +
                cloud.w +
                100
            );


        if (x < -cloud.w) {

            x +=
                canvas.clientWidth +
                cloud.w +
                100;
        }


        if (
            y < -100 ||
            y >
            canvas.clientHeight +
            100
        ) {

            return;
        }


        ctx.fillStyle =
            "rgba(220,240,255,0.45)";


        ctx.strokeStyle =
            "rgba(220,240,255,0.65)";


        ctx.lineWidth = 1;


        // Corpo

        ctx.beginPath();

        ctx.ellipse(
            x,
            y,
            cloud.w * 0.5,
            cloud.h,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.stroke();


        // Parte superior

        ctx.beginPath();

        ctx.ellipse(
            x +
            cloud.w * 0.25,
            y -
            cloud.h * 0.45,
            cloud.w * 0.3,
            cloud.h * 0.9,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.stroke();


        ctx.beginPath();

        ctx.ellipse(
            x -
            cloud.w * 0.2,
            y -
            cloud.h * 0.25,
            cloud.w * 0.25,
            cloud.h * 0.7,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.stroke();

    });


    ctx.restore();
}


// =====================================================
// SOLO
// =====================================================

function drawGround() {

    const groundAltitude = 0;


    const groundY =
        canvas.clientHeight -
        45 -
        (
            groundAltitude -
            cameraAltitude
        ) *
        WORLD_SCALE;


    if (
        groundY >
        canvas.clientHeight +
        20
    ) {

        return;
    }


    ctx.fillStyle =
        "#07101d";


    ctx.fillRect(
        0,
        groundY,
        canvas.clientWidth,
        canvas.clientHeight -
        groundY
    );


    ctx.strokeStyle =
        "#00d4ff";

    ctx.lineWidth = 2;


    ctx.beginPath();

    ctx.moveTo(
        0,
        groundY
    );

    ctx.lineTo(
        canvas.clientWidth,
        groundY
    );

    ctx.stroke();
}


// =====================================================
// FOGUETE
// =====================================================

function drawRocket() {

    const cx =
        canvas.clientWidth /
        2;


    const relativeAltitude =
        state.h -
        cameraAltitude;


    const rocketY =
        canvas.clientHeight -
        45 -
        relativeAltitude *
        WORLD_SCALE;


    ctx.save();


    ctx.translate(
        cx,
        rocketY
    );


    // Inclinação

    const renderAngle =
        state.h > 1

            ? Math.PI / 2 -
              state.pitch *
              Math.PI /
              180

            : 0;


    ctx.rotate(
        renderAngle
    );


    const stages =
        state.stages;


    const bodyWidth = 28;


    const bodyHeight =
        110 +
        (stages - 1) *
        30;


    // =================================================
    // CHAMA
    // =================================================

    if (
        state.running &&
        state.fuel > 0
    ) {

        const flameLength =
            28 +
            Math.random() *
            28;


        const gradient =
            ctx.createLinearGradient(
                0,
                bodyHeight / 2,
                0,
                bodyHeight / 2 +
                flameLength
            );


        gradient.addColorStop(
            0,
            "#ffffff"
        );


        gradient.addColorStop(
            0.35,
            "#00d4ff"
        );


        gradient.addColorStop(
            1,
            "rgba(0,212,255,0)"
        );


        ctx.fillStyle =
            gradient;


        ctx.beginPath();


        ctx.moveTo(
            -7,
            bodyHeight / 2 - 4
        );


        ctx.lineTo(
            0,
            bodyHeight / 2 +
            flameLength
        );


        ctx.lineTo(
            7,
            bodyHeight / 2 - 4
        );


        ctx.closePath();


        ctx.fill();
    }


    // =================================================
    // CORPO
    // =================================================

    const stageHeight =
        bodyHeight /
        stages;


    for (
        let i = 0;
        i < stages;
        i++
    ) {

        const y =
            -bodyHeight / 2 +
            i *
            stageHeight;


        ctx.fillStyle =
            i + 1 ===
            state.currentStage

                ? "#f3f8ff"

                : "#b8c7d6";


        ctx.strokeStyle =
            "#00d4ff";


        ctx.lineWidth = 2;


        ctx.beginPath();


        ctx.roundRect(
            -bodyWidth / 2,
            y,
            bodyWidth,
            stageHeight - 3,
            5
        );


        ctx.fill();

        ctx.stroke();


        ctx.fillStyle =
            "#00d4ff";


        ctx.fillRect(
            -bodyWidth / 2,
            y +
            stageHeight -
            7,
            bodyWidth,
            3
        );
    }


    // =================================================
    // COIFA
    // =================================================

    const top =
        -bodyHeight / 2;


    const cd =
        Number(
            $("coifa").value
        );


    ctx.fillStyle =
        "#f5f8ff";


    ctx.strokeStyle =
        "#00d4ff";


    ctx.lineWidth = 2;


    ctx.beginPath();


    // OGIVA

    if (cd === 0.30) {

        ctx.moveTo(
            -bodyWidth / 2,
            top
        );


        ctx.quadraticCurveTo(
            0,
            top - 48,
            bodyWidth / 2,
            top
        );
    }


    // CÔNICA

    else if (cd === 0.50) {

        ctx.moveTo(
            -bodyWidth / 2,
            top
        );


        ctx.lineTo(
            0,
            top - 35
        );


        ctx.lineTo(
            bodyWidth / 2,
            top
        );
    }


    // PLANA

    else {

        ctx.rect(
            -bodyWidth / 2,
            top - 10,
            bodyWidth,
            10
        );
    }


    ctx.closePath();

    ctx.fill();

    ctx.stroke();


    // =================================================
    // ALETAS
    // =================================================

    ctx.fillStyle =
        "#00d4ff";


    ctx.beginPath();


    ctx.moveTo(
        -bodyWidth / 2,
        bodyHeight / 2 -
        30
    );


    ctx.lineTo(
        -bodyWidth / 2 -
        18,
        bodyHeight / 2 +
        10
    );


    ctx.lineTo(
        -bodyWidth / 2,
        bodyHeight / 2
    );


    ctx.closePath();

    ctx.fill();


    ctx.beginPath();


    ctx.moveTo(
        bodyWidth / 2,
        bodyHeight / 2 -
        30
    );


    ctx.lineTo(
        bodyWidth / 2 +
        18,
        bodyHeight / 2 +
        10
    );


    ctx.lineTo(
        bodyWidth / 2,
        bodyHeight / 2
    );


    ctx.closePath();

    ctx.fill();


    // =================================================
    // JANELA
    // =================================================

    ctx.fillStyle =
        "#071426";


    ctx.beginPath();


    ctx.arc(
        0,
        top + 17,
        5,
        0,
        Math.PI * 2
    );


    ctx.fill();


    ctx.restore();
}


// =====================================================
// GRÁFICO
// =====================================================

function niceCeiling(value) {

    if (value <= 0) {
        return 1;
    }

    const exponent = Math.floor(Math.log10(value));
    const fraction = value / Math.pow(10, exponent);
    const niceFraction = fraction <= 1
        ? 1
        : fraction <= 2
            ? 2
            : fraction <= 5
                ? 5
                : 10;

    return niceFraction * Math.pow(10, exponent);
}


function formatGraphValue(value, unit) {

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k ${unit}`;
    }

    if (value >= 100 || Number.isInteger(value)) {
        return `${Math.round(value)} ${unit}`;
    }

    return `${value.toFixed(1)} ${unit}`;
}


function drawGraph(
    canvasElement,
    title,
    values,
    divisor,
    unit
) {

    const rect = canvasElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width <= 0 || height <= 0) {
        return;
    }

    const graph = canvasElement.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    graph.setTransform(dpr, 0, 0, dpr, 0, 0);
    graph.clearRect(0, 0, width, height);

    graph.fillStyle = "#050d19";
    graph.fillRect(0, 0, width, height);

    const plotLeft = 42;
    const plotRight = width - 10;
    const plotTop = 30;
    const plotBottom = height - 27;
    const plotW = Math.max(1, plotRight - plotLeft);
    const plotH = Math.max(1, plotBottom - plotTop);

    // O eixo começa sempre em zero e sobe em passos "bonitos".
    // Isso evita que a curva pareça crescer ou encolher a cada frame.
    const scaled = values.map(value => Math.max(0, value / divisor));
    const maxValue = niceCeiling(Math.max(1, ...scaled));
    const midValue = maxValue / 2;

    const maxTime = Math.max(
        1,
        state.history.t[state.history.t.length - 1] || 0
    );

    // Grade e eixos
    graph.lineWidth = 1;
    graph.strokeStyle = "rgba(0,212,255,0.14)";
    graph.fillStyle = "#7290a8";
    graph.font = "9px Share Tech, sans-serif";
    graph.textAlign = "right";
    graph.textBaseline = "middle";

    [0, 0.5, 1].forEach(fraction => {
        const y = plotBottom - fraction * plotH;

        graph.beginPath();
        graph.moveTo(plotLeft, y);
        graph.lineTo(plotRight, y);
        graph.stroke();

        const value = fraction === 0
            ? 0
            : fraction === 0.5
                ? midValue
                : maxValue;

        graph.fillText(
            formatGraphValue(value, unit),
            plotLeft - 5,
            y
        );
    });

    [0, 0.5, 1].forEach(fraction => {
        const x = plotLeft + fraction * plotW;

        graph.beginPath();
        graph.moveTo(x, plotTop);
        graph.lineTo(x, plotBottom);
        graph.stroke();

        graph.fillText(
            `${(fraction * maxTime).toFixed(1)} s`,
            x,
            plotBottom + 14
        );
    });

    graph.strokeStyle = "rgba(0,212,255,0.7)";
    graph.lineWidth = 1;
    graph.beginPath();
    graph.moveTo(plotLeft, plotTop);
    graph.lineTo(plotLeft, plotBottom);
    graph.lineTo(plotRight, plotBottom);
    graph.stroke();

    graph.textAlign = "left";
    graph.textBaseline = "alphabetic";
    graph.fillStyle = "#00d4ff";
    graph.font = "bold 11px Share Tech, sans-serif";
    graph.fillText(title, 6, 16);

    if (values.length < 2) {
        graph.fillStyle = "#61758a";
        graph.font = "10px Share Tech, sans-serif";
        graph.fillText("Aguardando lançamento...", plotLeft + 8, height / 2);
        return;
    }

    graph.save();
    graph.beginPath();
    graph.rect(plotLeft, plotTop, plotW, plotH);
    graph.clip();

    graph.strokeStyle = "#00d4ff";
    graph.lineWidth = 2;
    graph.lineJoin = "round";
    graph.lineCap = "round";
    graph.beginPath();

    scaled.forEach((value, i) => {
        const x = plotLeft + (state.history.t[i] / maxTime) * plotW;
        const y = plotBottom - Math.min(1, value / maxValue) * plotH;

        if (i === 0) {
            graph.moveTo(x, y);
        } else {
            graph.lineTo(x, y);
        }
    });

    graph.stroke();
    graph.restore();
}


// =====================================================
// GRÁFICOS
// =====================================================

function drawGraphs() {

    drawGraph(
        altitudeGraph,
        "ALTITUDE × TEMPO",
        state.history.h,
        1000,
        "km"
    );


    drawGraph(
        velocityGraph,
        "VELOCIDADE × TEMPO",
        state.history.v,
        1,
        "m/s"
    );
}


// =====================================================
// EVENTOS
// =====================================================

$("perfil-voo")
    .addEventListener(
        "change",
        updateCalculations
    );


$("coifa")
    .addEventListener(
        "change",
        updateCalculations
    );


$("estagios")
    .addEventListener(
        "change",
        updateCalculations
    );


$("propelente")
    .addEventListener(
        "change",
        updateCalculations
    );


$("empuxo")
    .addEventListener(
        "input",
        updateCalculations
    );


$("massa")
    .addEventListener(
        "input",
        updateCalculations
    );


// =====================================================
// BOTÕES
// =====================================================

$("lançar")
    .addEventListener(
        "click",
        launch
    );


$("reset")
    .addEventListener(
        "click",
        resetSim
    );


$("messageClose")
    .addEventListener(
        "click",
        resetSim
    );


// =====================================================
// REDIMENSIONAMENTO
// =====================================================

window.addEventListener(
    "resize",
    () => {

        resizeCanvas(canvas);

        resizeCanvas(
            altitudeGraph
        );

        resizeCanvas(
            velocityGraph
        );

        initScenery();

        draw();

        drawGraphs();
    }
);


// =====================================================
// INICIALIZAÇÃO
// =====================================================

resizeCanvas(canvas);

resizeCanvas(
    altitudeGraph
);

resizeCanvas(
    velocityGraph
);

initScenery();

updateCalculations();

drawGraphs();

draw();