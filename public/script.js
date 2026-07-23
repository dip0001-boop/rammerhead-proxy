'use strict';

const password = 'banana13!';

const $ = (id) => document.getElementById(id);

const errorText = $('error-text');

function showError(message) {
    if (!errorText) return;

    errorText.textContent = message;
    errorText.style.display = 'block';
}

function clearError() {
    if (!errorText) return;

    errorText.textContent = '';
    errorText.style.display = 'none';
}

function normalizeUrl(value) {
    value = String(value || '').trim();

    if (!value) {
        return '';
    }

    if (!/^https?:\/\//i.test(value)) {
        value = 'https://' + value;
    }

    try {
        return new URL(value).toString();
    } catch {
        return '';
    }
}

function getSessionId() {
    return $('session-id')?.value?.trim() || '';
}

function getSessionPassword() {
    return $('session-password')?.value || password;
}

function getSessionUrl() {
    return normalizeUrl($('session-url')?.value);
}

function buildProxyUrl(url) {
    const sessionId = getSessionId();

    if (!sessionId) {
        showError('Create a session first.');
        return null;
    }

    const encodedUrl = encodeURIComponent(url);

    return `/session/${encodeURIComponent(sessionId)}/${encodedUrl}`;
}

/*
|--------------------------------------------------------------------------
| SESSION CREATION
|--------------------------------------------------------------------------
*/

async function createSession() {
    clearError();

    const sessionIdInput = $('session-id');

    if (!sessionIdInput) {
        return;
    }

    const requestedId =
        sessionIdInput.value.trim() ||
        Math.random().toString(36).slice(2, 12);

    try {
        const response = await fetch(
            `/api/newsession?id=${encodeURIComponent(requestedId)}&pwd=${encodeURIComponent(getSessionPassword())}`
        );

        if (!response.ok) {
            throw new Error('Session creation failed.');
        }

        const data = await response.json().catch(() => null);

        if (data && data.id) {
            sessionIdInput.value = data.id;
        } else {
            sessionIdInput.value = requestedId;
        }

        loadSessions();

    } catch (error) {
        console.error(error);
        showError('Unable to create session.');
    }
}

/*
|--------------------------------------------------------------------------
| OPEN DESTINATION
|--------------------------------------------------------------------------
*/

function openDestination(rawUrl) {
    clearError();

    const url = normalizeUrl(rawUrl);

    if (!url) {
        showError('Enter a valid destination URL.');
        return;
    }

    const sessionId = getSessionId();

    if (!sessionId) {
        showError('Create a session before opening a destination.');
        return;
    }

    const proxyUrl = buildProxyUrl(url);

    if (proxyUrl) {
        window.location.href = proxyUrl;
    }
}

/*
|--------------------------------------------------------------------------
| SESSION LIST
|--------------------------------------------------------------------------
*/

async function loadSessions() {
    const tableBody = $('session-table-body');

    if (!tableBody) {
        return;
    }

    try {
        const response = await fetch(
            `/api/sessions?pwd=${encodeURIComponent(getSessionPassword())}`
        );

        if (!response.ok) {
            return;
        }

        const sessions = await response.json();

        tableBody.innerHTML = '';

        if (!Array.isArray(sessions) || sessions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3">No active sessions.</td>
                </tr>
            `;

            return;
        }

        sessions.forEach((session) => {
            const id =
                typeof session === 'string'
                    ? session
                    : session.id || session.sessionId;

            if (!id) {
                return;
            }

            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${escapeHtml(id)}</td>
                <td>ACTIVE</td>
                <td>
                    <div class="session-action">
                        <button type="button" data-open-session="${escapeHtml(id)}">
                            OPEN
                        </button>

                        <button type="button" data-delete-session="${escapeHtml(id)}">
                            DELETE
                        </button>
                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Could not load sessions:', error);
    }
}

async function deleteSession(id) {
    try {
        await fetch(
            `/api/session/${encodeURIComponent(id)}?pwd=${encodeURIComponent(getSessionPassword())}`,
            {
                method: 'DELETE'
            }
        );

        loadSessions();

    } catch (error) {
        console.error('Could not delete session:', error);
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/*
|--------------------------------------------------------------------------
| SECTIONS
|--------------------------------------------------------------------------
*/

const dashboard = document.querySelector('.vault-dashboard');
const browserSection = $('browser-section');
const gamesSection = $('games-section');
const gatewaySection = $('gateway-section');

function hideSections() {
    if (dashboard) dashboard.style.display = 'none';
    if (browserSection) browserSection.style.display = 'none';
    if (gamesSection) gamesSection.style.display = 'none';
    if (gatewaySection) gatewaySection.style.display = 'none';
}

function setActiveNav(id) {
    document.querySelectorAll('.bottom-nav-item').forEach((button) => {
        button.classList.remove('active');
    });

    const button = $(id);

    if (button) {
        button.classList.add('active');
    }
}

function showHome() {
    hideSections();

    if (dashboard) {
        dashboard.style.display = 'block';
    }

    setActiveNav('nav-home');
}

function showBrowser() {
    hideSections();

    if (browserSection) {
        browserSection.style.display = 'block';
    }

    setActiveNav('nav-browser');
}

function showGames() {
    hideSections();

    if (gamesSection) {
        gamesSection.style.display = 'block';
    }

    setActiveNav('nav-games');
}

function showGateway() {
    hideSections();

    if (gatewaySection) {
        gatewaySection.style.display = 'block';
    }

    setActiveNav('nav-gateway');
}

/*
|--------------------------------------------------------------------------
| GAMES
|--------------------------------------------------------------------------
*/

const games = [
    {
        name: 'Shell Shockers',
        url: 'https://shellshock.io/',
        description: 'Multiplayer egg shooter'
    },
    {
        name: 'Krunker',
        url: 'https://krunker.io/',
        description: 'Fast browser FPS'
    },
    {
        name: 'Agar.io',
        url: 'https://agar.io/',
        description: 'Grow and compete'
    },
    {
        name: 'Slither.io',
        url: 'https://slither.io/',
        description: 'Classic multiplayer snake'
    },
    {
        name: '2048',
        url: 'https://play2048.co/',
        description: 'Puzzle game'
    },
    {
        name: 'Tetris',
        url: 'https://tetris.com/play-tetris',
        description: 'Classic block puzzle'
    }
];

function renderGames() {
    const grid = $('games-grid');

    if (!grid) {
        return;
    }

    grid.innerHTML = '';

    games.forEach((game) => {
        const card = document.createElement('button');

        card.type = 'button';
        card.className = 'game-card';

        card.innerHTML = `
            <strong>${escapeHtml(game.name)}</strong>
            <small>${escapeHtml(game.description)}</small>
        `;

        card.addEventListener('click', () => {
            openDestination(game.url);
        });

        grid.appendChild(card);
    });
}

/*
|--------------------------------------------------------------------------
| EVENT HANDLERS
|--------------------------------------------------------------------------
*/

$('session-create-btn')?.addEventListener('click', createSession);

$('session-go')?.addEventListener('click', () => {
    openDestination(getSessionUrl());
});

$('dashboard-go')?.addEventListener('click', () => {
    openDestination($('dashboard-url')?.value);
});

$('browser-go')?.addEventListener('click', () => {
    openDestination($('browser-url')?.value);
});

$('dashboard-url')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        openDestination(event.target.value);
    }
});

$('browser-url')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        openDestination(event.target.value);
    }
});

$('open-browser-card')?.addEventListener('click', showBrowser);

$('open-games-card')?.addEventListener('click', showGames);

$('games-back')?.addEventListener('click', showHome);

$('nav-home')?.addEventListener('click', showHome);

$('nav-browser')?.addEventListener('click', showBrowser);

$('nav-games')?.addEventListener('click', showGames);

$('nav-gateway')?.addEventListener('click', showGateway);

document.querySelectorAll('.quick-link').forEach((button) => {
    button.addEventListener('click', () => {
        openDestination(button.dataset.url);
    });
});

$('session-table-body')?.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open-session]');
    const deleteButton = event.target.closest('[data-delete-session]');

    if (openButton) {
        const id = openButton.dataset.openSession;

        $('session-id').value = id;

        showBrowser();
    }

    if (deleteButton) {
        deleteSession(deleteButton.dataset.deleteSession);
    }
});

$('session-advanced-toggle')?.addEventListener('click', () => {
    const container = $('session-advanced-container');
    const button = $('session-advanced-toggle');

    if (!container || !button) {
        return;
    }

    const isHidden = container.style.display === 'none';

    container.style.display = isHidden ? 'block' : 'none';

    button.textContent = isHidden
        ? '- HIDE ADVANCED OPTIONS'
        : '+ SHOW ADVANCED OPTIONS';
});

/*
|--------------------------------------------------------------------------
| INITIALIZATION
|--------------------------------------------------------------------------
*/

renderGames();
loadSessions();
showHome();
