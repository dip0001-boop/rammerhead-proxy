'use strict';

const STORAGE_KEY = 'vault_sessions';

const games = [
{
name: 'Shell Shockers',
description: 'Egg-based multiplayer shooter',
url: 'https://shellshock.io',
icon: '🥚'
},
{
name: 'Krunker',
description: 'Fast-paced browser FPS',
url: 'https://krunker.io',
icon: '🎯'
},
{
name: '1v1.LOL',
description: 'Build and battle',
url: 'https://1v1.lol',
icon: '⚔'
},
{
name: 'Slope',
description: 'Endless downhill runner',
url: 'https://slopegame.io',
icon: '◈'
},
{
name: 'Retro Bowl',
description: 'Classic football management',
url: 'https://retrobowl.me',
icon: '🏈'
},
{
name: 'Drift Hunters',
description: 'Browser drifting game',
url: 'https://drifthunters.io',
icon: '🏎'
},
{
name: 'Minecraft Classic',
description: 'Classic browser Minecraft',
url: 'https://classic.minecraft.net',
icon: '▦'
},
{
name: 'Agar.io',
description: 'Grow and dominate',
url: 'https://agar.io',
icon: '●'
}
];

const $ = (id) => document.getElementById(id);

const dashboardView = $('dashboard-view');
const browserView = $('browser-view');

const sessionUrl = $('session-url');
const bottomUrl = $('bottom-url');

const sessionIdInput = $('session-id');
const sessionPassword = $('session-password');
const passwordWrapper = $('password-wrapper');

const sessionCreateButton = $('session-create-btn');
const sessionGoButton = $('session-go');
const browserGoButton = $('browser-go');

const errorText = $('error-text');
const gamesGrid = $('games-grid');

const bottomBrowser = $('bottom-browser');
const bottomToggle = $('bottom-toggle');

const sessionsTable = $('session-table-body');

let currentSession = localStorage.getItem('vault_current_session') || null;
let currentUrl = null;

/* =========================
SESSION STORAGE
========================= */

function getStoredSessions() {
try {
return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {
return {};
}
}

function saveStoredSessions(sessions) {
localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function generateSessionId() {
const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

```
let id = '';

for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
}

return id;
```

}

function createSession() {
const sessions = getStoredSessions();

```
const id = generateSessionId();

sessions[id] = {
    id,
    created: new Date().toISOString()
};

saveStoredSessions(sessions);

currentSession = id;

localStorage.setItem('vault_current_session', id);

sessionIdInput.value = id;

renderSessions();

return id;
```

}

function selectSession(id) {
const sessions = getStoredSessions();

```
if (!sessions[id]) {
    showError('That session does not exist.');
    return;
}

currentSession = id;

localStorage.setItem('vault_current_session', id);

sessionIdInput.value = id;

hideError();

renderSessions();
```

}

function deleteSession(id) {
const sessions = getStoredSessions();

```
delete sessions[id];

saveStoredSessions(sessions);

if (currentSession === id) {
    currentSession = null;

    localStorage.removeItem('vault_current_session');

    sessionIdInput.value = '';
}

renderSessions();
```

}

function renderSessions() {
if (!sessionsTable) return;

```
const sessions = getStoredSessions();

sessionsTable.innerHTML = '';

const entries = Object.values(sessions);

if (!entries.length) {
    sessionsTable.innerHTML = `
        <tr>
            <td colspan="3">
                No active local sessions.
            </td>
        </tr>
    `;

    return;
}

for (const session of entries) {
    const row = document.createElement('tr');

    const date = new Date(session.created);

    row.innerHTML = `
        <td>${escapeHtml(session.id)}</td>
        <td>${date.toLocaleString()}</td>
        <td>
            <div class="session-action">
                <button data-select-session="${escapeHtml(session.id)}">
                    OPEN
                </button>

                <button data-delete-session="${escapeHtml(session.id)}">
                    DELETE
                </button>
            </div>
        </td>
    `;

    sessionsTable.appendChild(row);
}

sessionsTable.querySelectorAll('[data-select-session]').forEach((button) => {
    button.addEventListener('click', () => {
        selectSession(button.dataset.selectSession);
    });
});

sessionsTable.querySelectorAll('[data-delete-session]').forEach((button) => {
    button.addEventListener('click', () => {
        deleteSession(button.dataset.deleteSession);
    });
});
```

}

/* =========================
RAMMERHEAD URL
========================= */

function getProxyUrl(url) {
if (!currentSession) {
throw new Error('Create or select a session first.');
}

```
const encodedUrl = encodeURIComponent(url);

return `/session/${encodeURIComponent(currentSession)}/${encodedUrl}`;
```

}

function normalizeUrl(value) {
value = value.trim();

```
if (!value) {
    return null;
}

if (/^https?:\/\//i.test(value)) {
    return value;
}

if (
    value.includes('.') &&
    !value.includes(' ')
) {
    return `https://${value}`;
}

return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
```

}

function go(value) {
const url = normalizeUrl(value);

```
if (!url) {
    showError('Enter a URL or search term.');
    return;
}

if (!currentSession) {
    showError('Create a session before browsing.');
    return;
}

hideError();

currentUrl = url;

const proxyUrl = getProxyUrl(url);

window.location.href = proxyUrl;
```

}

function openGame(game) {
if (!currentSession) {
showError('Create a session before opening a game.');
return;
}

```
go(game.url);
```

}

/* =========================
DASHBOARD
========================= */

function showDashboard() {
dashboardView.style.display = '';

```
browserView.style.display = 'none';

window.scrollTo({
    top: 0,
    behavior: 'smooth'
});
```

}

function showBrowser() {
dashboardView.style.display = '';

```
browserView.style.display = '';

browserView.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
});
```

}

function showGames() {
const gamesSection = $('games-section');

```
if (!gamesSection) return;

gamesSection.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
});
```

}

function showSessions() {
const sessionsSection = $('sessions-section');

```
if (!sessionsSection) return;

sessionsSection.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
});
```

}

/* =========================
GAMES
========================= */

function renderGames() {
if (!gamesGrid) return;

```
gamesGrid.innerHTML = '';

games.forEach((game) => {
    const card = document.createElement('button');

    card.type = 'button';

    card.className = 'game-card';

    card.innerHTML = `
        <span class="game-icon">${game.icon}</span>
        <h3>${escapeHtml(game.name)}</h3>
        <p>${escapeHtml(game.description)}</p>
    `;

    card.addEventListener('click', () => {
        openGame(game);
    });

    gamesGrid.appendChild(card);
});
```

}

/* =========================
BOTTOM BROWSER BAR
========================= */

function toggleBottomBrowser() {
bottomBrowser.classList.toggle('collapsed');

```
const collapsed = bottomBrowser.classList.contains('collapsed');

bottomToggle.querySelector('span').textContent = collapsed
    ? '⌄'
    : '⌃';
```

}

function syncUrlInputs(value) {
sessionUrl.value = value;

```
bottomUrl.value = value;
```

}

function browserNavigate() {
const value = bottomUrl.value.trim();

```
syncUrlInputs(value);

go(value);
```

}

function browserBack() {
window.history.back();
}

function browserForward() {
window.history.forward();
}

function browserReload() {
window.location.reload();
}

/* =========================
ERROR HANDLING
========================= */

function showError(message) {
errorText.textContent = message;

```
errorText.style.display = 'block';
```

}

function hideError() {
errorText.textContent = '';

```
errorText.style.display = 'none';
```

}

/* =========================
HELPERS
========================= */

function escapeHtml(value) {
return String(value)
.replaceAll('&', '&')
.replaceAll('<', '<')
.replaceAll('>', '>')
.replaceAll('"', '"')
.replaceAll("'", ''');
}

/* =========================
EVENT LISTENERS
========================= */

sessionCreateButton.addEventListener('click', () => {
createSession();
});

sessionGoButton.addEventListener('click', () => {
go(sessionUrl.value);
});

browserGoButton.addEventListener('click', () => {
browserNavigate();
});

sessionUrl.addEventListener('keydown', (event) => {
if (event.key === 'Enter') {
go(sessionUrl.value);
}
});

bottomUrl.addEventListener('keydown', (event) => {
if (event.key === 'Enter') {
browserNavigate();
}
});

bottomToggle.addEventListener('click', () => {
toggleBottomBrowser();
});

$('browser-back')?.addEventListener('click', browserBack);

$('browser-forward')?.addEventListener('click', browserForward);

$('browser-reload')?.addEventListener('click', browserReload);

$('browser-home')?.addEventListener('click', showDashboard);

$('browser-home-button')?.addEventListener('click', showDashboard);

$('view-all-games')?.addEventListener('click', showGames);

document.querySelectorAll('[data-action="browser"]').forEach((button) => {
button.addEventListener('click', showBrowser);
});

document.querySelectorAll('[data-action="games"]').forEach((button) => {
button.addEventListener('click', showGames);
});

document.querySelectorAll('[data-action="sessions"]').forEach((button) => {
button.addEventListener('click', showSessions);
});

$('session-advanced-toggle')?.addEventListener('click', () => {
const container = $('session-advanced-container');

```
const isHidden = container.style.display === 'none';

container.style.display = isHidden ? 'block' : 'none';

$('session-advanced-toggle').textContent = isHidden
    ? '- HIDE ADVANCED OPTIONS'
    : '+ SHOW ADVANCED OPTIONS';
```

});

/* =========================
INITIALIZATION
========================= */

function initialize() {
renderGames();

```
renderSessions();

if (currentSession) {
    const sessions = getStoredSessions();

    if (sessions[currentSession]) {
        sessionIdInput.value = currentSession;
    } else {
        currentSession = null;

        localStorage.removeItem('vault_current_session');
    }
}

bottomBrowser.classList.add('collapsed');
```

}

initialize();
