const SERVER_IP = "mazerclub.net"; 
const STATUS_API = `https://api.mcstatus.io/v2/status/java/${SERVER_IP}`;
const PLAYER_API = `http://${SERVER_IP}:62153/v1/players`;
const HISTORY_KEY = "foxmc_terminal_history";

let allPlayers = [];
let activePage = 'players';

/**
 * Live Stock Path Generator
 * Creates a jittery, realistic market line
 */
function generateMarketPath(isUp) {
    let points = [];
    const segments = 15;
    const width = 100;
    const height = 40;
    
    for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * width;
        let y;
        
        if (isUp) {
            y = (height - 5) - (i * (height / segments)) + (Math.random() * 8 - 4);
        } else {
            y = 5 + (i * (height / segments)) + (Math.random() * 8 - 4);
        }
        
        y = Math.max(5, Math.min(35, y));
        points.push(`${x},${y}`);
    }

    const d = `M ${points.join(' L ')}`;
    const fillD = `${d} V 40 H 0 Z`;
    
    return { d, fillD };
}

/**
 * Circular Progress Update
 */
function updateProgress(current, max) {
    const progress = document.getElementById("progress");

    if (!progress) return;

    // calculate from max players
    const percent = max > 0 ? (current / max) * 100 : 0;

    // Convert to degrees
    const deg = percent * 3.6;

    progress.style.background = `
        conic-gradient(
            #ff0000 0deg,
            #ff0000 ${deg}deg,
            #1e293b ${deg}deg,
            #1e293b 360deg
        )
    `;

    progress.innerHTML = `<span>${current}</span>`;
}

/*
 * Calculated as (Current / Max) * 100
 */
function updateStockTrend(currentCount, maxCount) {
    const trendCard = document.getElementById('trendCard');
    const trendText = document.getElementById('trendPercent');
    const trendLine = document.getElementById('trendLine');
    const trendFill = document.getElementById('trendFill');

    if (!trendCard || !trendText || !trendLine || !trendFill) return;

    // Calculate percentage based on MAX players
    const capacityPercent = maxCount > 0 
        ? (currentCount / maxCount) * 100 
        : 0;

    const now = Date.now();

    let history = JSON.parse(
        localStorage.getItem(HISTORY_KEY) || "[]"
    );

    history.push({
        time: now,
        count: currentCount
    });

    history = history.filter(
        h => now - h.time < 3600000
    );

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history)
    );

    // Determine color
    let isUp = true;

    if (history.length > 1) {
        isUp = currentCount >= history[history.length - 2].count;
    }

    // Update SVG Paths
    const paths = generateMarketPath(isUp);

    trendLine.setAttribute('d', paths.d);
    trendFill.setAttribute('d', paths.fillD);
    
    // UI Updates
    trendCard.className = `
        analytics-card ${isUp ? 'trend-up' : 'trend-down'}
    `;

    trendText.innerText = `${capacityPercent.toFixed(1)}%`;
    
    // Update Subtext
    const volatilityText = trendCard.querySelector(
        'span[style*="opacity: 0.6"]'
    );
    if (volatilityText) {
        volatilityText.innerText = `
            CAPACITY: ${currentCount}/${maxCount}
        `;
    }
}

/**
 * Main Data Fetching
 */
async function refreshDashboard() {
    try {
        const [statusRes, playerRes] = await Promise.allSettled([
            fetch(STATUS_API).then(res => res.json()),
            fetch(PLAYER_API).then(res => res.json())
        ]);

        if (
            statusRes.status === 'fulfilled' &&
            statusRes.value.online
        ) {
            const data = statusRes.value;

            const dot = document.getElementById("statusDot");

            document.getElementById("progressCount").innerText = `THANKS FOR ${data.players.online} PLAYERS`;

            document.getElementById('playerCounter').innerText =
                `${data.players.online} / ${data.players.max} ONLINE`;
            
            // Update trend
            updateStockTrend(
                data.players.online,
                data.players.max
            );

            // Update circular progress here
            updateProgress(
                data.players.online,
                data.players.max
            );
        }

        if (playerRes.status === 'fulfilled') {
            allPlayers = playerRes.value.data || [];
            renderPlayerList();
        }
        if(data.online) {
            dot.style.backgroundColor = `green`;
        }
        

    } catch (e) {
        console.error("Terminal Sync Error:", e);
    }
}

/**
 * List Rendering
 */
function renderPlayerList() {
    const container = document.getElementById('playerContainer');

    if (!container) return;

    const search = document
        .getElementById('searchInput')
        ?.value
        .toLowerCase() || "";
    
    let filtered = allPlayers.filter(
        p => p.name.toLowerCase().includes(search)
    );

    if (activePage === 'topkills') {
        filtered.sort(
            (a, b) => (b.kills?.v || 0) - (a.kills?.v || 0)
        );
    }

    if (activePage === 'topdeaths') {
        filtered.sort(
            (a, b) => (b.deaths?.v || 0) - (a.deaths?.v || 0)
        );
    }

    container.innerHTML = filtered.map(p => `
        <div class="player-card">
            <img 
                src="https://crafthead.net/helm/${p.name}/64"
                style="
                    width:42px;
                    height:42px;
                    border-radius:8px;
                "
            >

            <div style="flex:1">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                ">
                    <span style="
                        font-weight:800;
                        font-size:14px;
                        letter-spacing:0.5px;
                    ">
                        ${p.name.toUpperCase()}
                    </span>

                    <span style="
                        font-size:8px;
                        color:var(--accent);
                        border:1px solid var(--accent);
                        padding:1px 5px;
                        border-radius:4px;
                    ">
                        ONLINE
                    </span>
                </div>

                <div style="
                    display:flex;
                    gap:12px;
                    margin-top:5px;
                    opacity:0.5;
                    font-size:10px;
                ">
                    <span>KILLS: ${p.kills?.v || 0}</span>
                    <span>DEATHS: ${p.deaths?.v || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * Sidebar & Navigation
 */
function toggleSidebar() {
    document.getElementById('sidebar')
        ?.classList.toggle('sidebar-open');

    document.getElementById('overlay')
        ?.classList.toggle('hidden');
    
    document.querySelector(".hamburger-btn")
        ?.classList.toggle("rotate")
}

// Global Listeners
document.getElementById('searchInput')
    ?.addEventListener('input', renderPlayerList);

// Boot
refreshDashboard();

setInterval(refreshDashboard, 15000); 

// Live Jitter Loop
setInterval(() => {
    const trendCard =
        document.getElementById('trendCard');

    if (!trendCard) return;
    
    const isUp =
        trendCard.classList.contains('trend-up');

    const paths = generateMarketPath(isUp);

    document.getElementById('trendLine')
        ?.setAttribute('d', paths.d);

    document.getElementById('trendFill')
        ?.setAttribute('d', paths.fillD);

}, 3000);

/* =========================
   LANGUAGE TRANSLATION
========================= */

const translations = {
    en: {
        home: "Home",
        store: "Store",
        players: "Players",
        leaderboards: "Leaderboards",
        topKills: "Top Kills",
        topDeaths: "Top Deaths",
        activePlayers: "Active Players",
        connecting: "Connecting...",
        search: "Search Here...",
        gamemode: "Gamemode",

        survivalTitle: "SURVIVAL ECONOMY",
        survivalDesc: "A Minecraft gamemode with Eco-lands (Economy SMP + Lands Claim)",

        luckyTitle: "Lucky Reward",
        luckyDesc: "Lucky Reward is a new gamemode. Kills mobs or players to earn money and lucky item from 50/50 streaks.",

        pvpTitle: "PRACTICE PVP",
        pvpDesc: "A pvp gamemode. There are: Duels 1v1, FFA (Free for all)",

        status: "Status",
        populationIndex: "Population Index",
        volatility: "VOLATILITY: LOW",
        connectionPulse: "Connection Pulse",
        serverPing: "server ping",
        lowPing: "SERVER'S LOW PING",
        playersCount: "players count",
        playersWord: "players",
        thanks: "THANKS FOR N/A PLAYERS",
        operators: "server's operators",

        developed: "Developed by:",
        website: "Website:",
        discord: "Join Discord server:",
        join: "Click to join!",

        contact: "Contact Support",
        telegram: "Telegram Support",
        ownerServer: "Owner's Server",
        adminServer: "Admin's Server",
        staffServer: "Staff's Server",

        copyright: "© 2026 Foxmckingdom · Not affiliated with Mojang · All purchases are final"
    },

    km: {
        home: "ទំព័រដើម",
        store: "ហាង",
        players: "អ្នកលេង",
        leaderboards: "តារាងចំណាត់ថ្នាក់",
        topKills: "អ្នកសម្លាប់ច្រើនជាងគេ",
        topDeaths: "អ្នកស្លាប់ច្រើនជាងគេ",
        activePlayers: "អ្នកលេងកំពុងសកម្ម",
        connecting: "កំពុងភ្ជាប់...",
        search: "ស្វែងរក...",
        gamemode: "របៀបលេង",

        survivalTitle: "សឺវើរសេដ្ឋកិច្ចរស់រាន",
        survivalDesc: "របៀបលេង Minecraft មានប្រព័ន្ធសេដ្ឋកិច្ច និងដីការពារ",

        luckyTitle: "រង្វាន់សំណាង",
        luckyDesc: "សម្លាប់ mobs ឬអ្នកលេង ដើម្បីទទួលបានប្រាក់ និងរង្វាន់សំណាង",

        pvpTitle: "ហ្វឹកហាត់ PVP",
        pvpDesc: "របៀបប្រយុទ្ធ PvP មាន Duel 1v1 និង FFA",

        status: "ស្ថានភាព",
        populationIndex: "សន្ទស្សន៍អ្នកលេង",
        volatility: "ស្ថេរភាព៖ ទាប",
        connectionPulse: "សញ្ញាការតភ្ជាប់",
        serverPing: "ល្បឿនសឺវើរ",
        lowPing: "PING ទាប",
        playersCount: "ចំនួនអ្នកលេង",
        playersWord: "នាក់",
        thanks: "អរគុណសម្រាប់អ្នកលេង",
        operators: "អ្នកគ្រប់គ្រងសឺវើរ",

        developed: "បង្កើតដោយ៖",
        website: "វេបសាយ៖",
        discord: "ចូល Discord៖",
        join: "ចុចដើម្បីចូល!",

        contact: "ទំនាក់ទំនងជំនួយ",
        telegram: "Telegram ជំនួយ",
        ownerServer: "សឺវើររបស់ Owner",
        adminServer: "សឺវើររបស់ Admin",
        staffServer: "សឺវើររបស់ Staff",

        copyright: "© 2026 Foxmckingdom · មិនពាក់ព័ន្ធនឹង Mojang · ការទិញទាំងអស់មិនអាចសងវិញបាន"
    }
};

/* =========================
   APPLY TRANSLATIONS
========================= */

const langSelect = document.getElementById("langSwitcher");

function applyLanguage(lang){

    const t = translations[lang];

    /* NAVIGATION */
    document.querySelectorAll(".nav-link")[0].innerHTML =
        document.querySelectorAll(".nav-link")[0].innerHTML.replace(/Home|ទំព័រដើម/g, t.home);

    /* MAIN TITLE */
    document.getElementById("playerCounter").textContent = t.connecting;
    document.getElementById("searchInput").placeholder = t.search;

    /* SIMPLE TEXT REPLACEMENTS */
    replaceText("Gamemode", t.gamemode);
    replaceText("Status", t.status);
    replaceText("Population Index", t.populationIndex);
    replaceText("VOLATILITY: LOW", t.volatility);
    replaceText("Connection Pulse", t.connectionPulse);
    replaceText("server ping", t.serverPing);
    replaceText("SERVER'S LOW PING", t.lowPing);
    replaceText("players count", t.playersCount);
    replaceText("players", t.playersWord);
    replaceText("THANKS FOR N/A PLAYERS", t.thanks);
    replaceText("server's operators", t.operators);

    /* GAMEMODES */
    replaceText("SURVIVAL ECONOMY", t.survivalTitle);
    replaceText(
        "A Minecraft gamemode with Eco-lands (Economy SMP + Lands Claim)",
        t.survivalDesc
    );

    replaceText("Lucky Reward", t.luckyTitle);
    replaceText(
        "Lucky Reward is a new gamemode. Kills mobs or players to earn money and lucky item from 50/50 streaks.",
        t.luckyDesc
    );

    replaceText("PRACTICE PVP", t.pvpTitle);
    replaceText(
        "A pvp gamemode. There are: Duels 1v1, FFA (Free for all)",
        t.pvpDesc
    );
}

/* HELPER */
function replaceText(oldText, newText){
    document.body.innerHTML = document.body.innerHTML.replaceAll(oldText, newText);
}

/* CHANGE EVENT */
langSelect.addEventListener("change", (e)=>{
    applyLanguage(e.target.value);

    localStorage.setItem("foxmc_lang", e.target.value);
});

/* LOAD SAVED LANG */
const savedLang = localStorage.getItem("foxmc_lang") || "en";
langSelect.value = savedLang;
applyLanguage(savedLang);