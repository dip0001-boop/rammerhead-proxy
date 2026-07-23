'use strict';

/* -----------------------------
   PASSWORD SYSTEM
----------------------------- */

const password = 'bannana13!';

const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 60 * 60 * 1000;

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


/* -----------------------------
   LOGIN SYSTEM
----------------------------- */

function getLoginAttempts() {
    return Number(
        localStorage.getItem('vault-login-attempts') || 0
    );
}

function setLoginAttempts(attempts) {
    localStorage.setItem(
        'vault-login-attempts',
        String(attempts)
    );
}

function getLockoutTime() {
    return Number(
        localStorage.getItem('vault-lockout-time') || 0
    );
}

function isLockedOut() {
    const lockoutTime = getLockoutTime();

    if (!lockoutTime) {
        return false;
    }

    if (Date.now() < lockoutTime) {
        return true;
    }

    localStorage.removeItem('vault-lockout-time');

    setLoginAttempts(0);

    return false;
}

function getRemainingLockoutTime() {
    const remaining =
        getLockoutTime() - Date.now();

    if (remaining <= 0) {
        return 0;
    }

    return Math.ceil(
        remaining / 60000
    );
}

function isLoggedIn() {
    return (
        sessionStorage.getItem(
            'vault-authenticated'
        ) === 'true'
    );
}

function login() {
    const input = $('password-input');

    if (!input) {
        console.error(
            'Password input not found.'
        );

        return;
    }

    clearError();

    if (isLockedOut()) {
        showError(
            `Too many incorrect attempts. Try again in ${getRemainingLockoutTime()} minutes.`
        );

        return;
    }

    const enteredPassword =
        input.value;

    if (
        enteredPassword === password
    ) {
        sessionStorage.setItem(
            'vault-authenticated',
            'true'
        );

        setLoginAttempts(0);

        localStorage.removeItem(
            'vault-lockout-time'
        );

        showDashboard();

        input.value = '';

        return;
    }

    const attempts =
        getLoginAttempts() + 1;

    setLoginAttempts(attempts);

    if (
        attempts >= MAX_ATTEMPTS
    ) {
        localStorage.setItem(
            'vault-lockout-time',
            String(
                Date.now() +
                LOCKOUT_TIME
            )
        );

        showError(
            'Too many incorrect attempts. Access locked for 1 hour.'
        );

        input.value = '';

        return;
    }

    const attemptsRemaining =
        MAX_ATTEMPTS - attempts;

    showError(
        `Incorrect password. ${attemptsRemaining} attempt(s) remaining.`
    );

    input.value = '';
}

function showLogin() {
    const loginScreen =
        $('login-screen');

    const app =
        $('app');

    if (loginScreen) {
        loginScreen.style.display =
            'flex';
    }

    if (app) {
        app.style.display =
            'none';
    }
}

function showDashboard() {
    const loginScreen =
        $('login-screen');

    const app =
        $('app');

    if (loginScreen) {
        loginScreen.style.display =
            'none';
    }

    if (app) {
        app.style.display =
            'block';
    }
}

function checkAuthentication() {
    if (isLockedOut()) {
        showLogin();

        showError(
            `Too many incorrect attempts. Try again in ${getRemainingLockoutTime()} minutes.`
        );

        return;
    }

    if (isLoggedIn()) {
        showDashboard();
    } else {
        showLogin();
    }
}


/* -----------------------------
   URL HELPERS
----------------------------- */

function normalizeUrl(value) {
    value =
        String(value || '')
            .trim();

    if (!value) {
        return '';
    }

    if (
        !/^https?:\/\//i.test(value)
    ) {
        value =
            'https://' + value;
    }

    try {
        return new URL(value).toString();
    } catch {
        return '';
    }
}

function getSessionId() {
    return (
        $('session-id')
            ?.value
            ?.trim() || ''
    );
}

function getPassword() {
    return password;
}

function getSessionUrl() {
    return normalizeUrl(
        $('session-url')?.value
    );
}

function buildProxyUrl(url) {
    const sessionId =
        getSessionId();

    if (!sessionId) {
        showError(
            'Create a session first.'
        );

        return null;
    }

    return `/session/${encodeURIComponent(
        sessionId
    )}/${encodeURIComponent(url)}`;
}


/* -----------------------------
   RAMMERHEAD SESSION API
----------------------------- */

async function createSession() {
    clearError();

    try {
        const response =
            await fetch(
                `/newsession?pwd=${encodeURIComponent(
                    getPassword()
                )}`
            );

        if (!response.ok) {
            throw new Error(
                'Session creation failed.'
            );
        }

        const id =
            (
                await response.text()
            ).trim();

        if (!id) {
            throw new Error(
                'No session ID returned.'
            );
        }

        $('session-id').value =
            id;

        await editSession(id);

        loadSessions();

    } catch (error) {
        console.error(error);

        showError(
            'Unable to create session. Check the password.'
        );
    }
}

async function editSession(id) {
    const shuffling =
        $('session-shuffling')
            ?.checked
            ? '1'
            : '0';

    const httpProxy =
        $('session-httpproxy')
            ?.value
            ?.trim() || '';

    const params =
        new URLSearchParams({
            id,
            pwd: getPassword(),
            enableShuffling:
                shuffling
        });

    if (httpProxy) {
        params.set(
            'httpProxy',
            httpProxy
        );
    }

    const response =
        await fetch(
            `/editsession?${params.toString()}`
        );

    if (!response.ok) {
        throw new Error(
            'Could not configure session.'
        );
    }
}

function openDestination(rawUrl) {
    clearError();

    const url =
        normalizeUrl(rawUrl);

    if (!url) {
        showError(
            'Enter a valid destination URL.'
        );

        return;
    }

    if (!getSessionId()) {
        showError(
            'Create a session before opening a destination.'
        );

        return;
    }

    const proxyUrl =
        buildProxyUrl(url);

    if (proxyUrl) {
        window.location.href =
            proxyUrl;
    }
}


/* -----------------------------
   SESSION TABLE
----------------------------- */

function loadSessions() {
    const tableBody =
        $('session-table-body');

    if (!tableBody) {
        return;
    }

    const id =
        getSessionId();

    if (!id) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3">
                    Create a session to begin.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td>
                ${escapeHtml(id)}
            </td>

            <td>
                ACTIVE
            </td>

            <td>
                <div class="session-action">

                    <button
                        type="button"
                        data-open-session="${escapeHtml(id)}"
                    >
                        OPEN
                    </button>

                    <button
                        type="button"
                        data-delete-session="${escapeHtml(id)}"
                    >
                        DELETE
                    </button>

                </div>
            </td>
        </tr>
    `;
}

async function deleteSession(id) {
    try {
        await fetch(
            `/deletesession?id=${encodeURIComponent(
                id
            )}&pwd=${encodeURIComponent(
                getPassword()
            )}`
        );

        if (
            $('session-id')
                ?.value === id
        ) {
            $('session-id').value =
                '';
        }

        loadSessions();

    } catch (error) {
        console.error(
            'Could not delete session:',
            error
        );
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll(
            '&',
            '&amp;'
        )
        .replaceAll(
            '<',
            '&lt;'
        )
        .replaceAll(
            '>',
            '&gt;'
        )
        .replaceAll(
            '"',
            '&quot;'
        )
        .replaceAll(
            "'",
            '&#039;'
        );
}


/* -----------------------------
   UI SECTIONS
----------------------------- */

const dashboard =
    document.querySelector(
        '.vault-dashboard'
    );

const browserSection =
    $('browser-section');

const gamesSection =
    $('games-section');

const gatewaySection =
    $('gateway-section');

function hideSections() {
    if (dashboard) {
        dashboard.style.display =
            'none';
    }

    if (browserSection) {
        browserSection.style.display =
            'none';
    }

    if (gamesSection) {
        gamesSection.style.display =
            'none';
    }

    if (gatewaySection) {
        gatewaySection.style.display =
            'none';
    }
}

function setActiveNav(id) {
    document
        .querySelectorAll(
            '.bottom-nav-item'
        )
        .forEach((button) => {
            button.classList.remove(
                'active'
            );
        });

    $(id)?.classList.add(
        'active'
    );
}

function showHome() {
    hideSections();

    if (dashboard) {
        dashboard.style.display =
            'block';
    }

    setActiveNav(
        'nav-home'
    );
}

function showBrowser() {
    hideSections();

    if (browserSection) {
        browserSection.style.display =
            'block';
    }

    setActiveNav(
        'nav-browser'
    );
}

function showGames() {
    hideSections();

    if (gamesSection) {
        gamesSection.style.display =
            'block';
    }

    setActiveNav(
        'nav-games'
    );
}

function showGateway() {
    hideSections();

    if (gatewaySection) {
        gatewaySection.style.display =
            'block';
    }

    setActiveNav(
        'nav-gateway'
    );
}


/* -----------------------------
   GAMES
----------------------------- */

const games = [
    {
        name:
            'Shell Shockers',

        url:
            'https://shellshock.io/',

        description:
            'Multiplayer egg shooter'
    },

    {
        name:
            'Krunker',

        url:
            'https://krunker.io/',

        description:
            'Fast browser FPS'
    },

    {
        name:
            'Agar.io',

        url:
            'https://agar.io/',

        description:
            'Grow and compete'
    },

    {
        name:
            'Slither.io',

        url:
            'https://slither.io/',

        description:
            'Classic multiplayer snake'
    },

    {
        name:
            '2048',

        url:
            'https://play2048.co/',

        description:
            'Puzzle game'
    },

    {
        name:
            'Tetris',

        url:
            'https://tetris.com/play-tetris',

        description:
            'Classic block puzzle'
    }
];

function renderGames() {
    const grid =
        $('games-grid');

    if (!grid) {
        return;
    }

    grid.innerHTML =
        '';

    games.forEach(
        (game) => {
            const card =
                document.createElement(
                    'button'
                );

            card.type =
                'button';

            card.className =
                'game-card';

            card.innerHTML = `
                <strong>
                    ${escapeHtml(
                        game.name
                    )}
                </strong>

                <small>
                    ${escapeHtml(
                        game.description
                    )}
                </small>
            `;

            card.addEventListener(
                'click',
                () => {
                    openDestination(
                        game.url
                    );
                }
            );

            grid.appendChild(
                card
            );
        }
    );
}


/* -----------------------------
   EVENTS
----------------------------- */

$('login-btn')
    ?.addEventListener(
        'click',
        login
    );

$('password-input')
    ?.addEventListener(
        'keydown',
        (event) => {
            if (
                event.key ===
                'Enter'
            ) {
                login();
            }
        }
    );

$('session-create-btn')
    ?.addEventListener(
        'click',
        createSession
    );

$('session-go')
    ?.addEventListener(
        'click',
        () => {
            openDestination(
                getSessionUrl()
            );
        }
    );

$('dashboard-go')
    ?.addEventListener(
        'click',
        () => {
            openDestination(
                $('dashboard-url')
                    ?.value
            );
        }
    );

$('browser-go')
    ?.addEventListener(
        'click',
        () => {
            openDestination(
                $('browser-url')
                    ?.value
            );
        }
    );

$('dashboard-url')
    ?.addEventListener(
        'keydown',
        (event) => {
            if (
                event.key ===
                'Enter'
            ) {
                openDestination(
                    event.target.value
                );
            }
        }
    );

$('browser-url')
    ?.addEventListener(
        'keydown',
        (event) => {
            if (
                event.key ===
                'Enter'
            ) {
                openDestination(
                    event.target.value
                );
            }
        }
    );

$('open-browser-card')
    ?.addEventListener(
        'click',
        showBrowser
    );

$('open-games-card')
    ?.addEventListener(
        'click',
        showGames
    );

$('games-back')
    ?.addEventListener(
        'click',
        showHome
    );

$('nav-home')
    ?.addEventListener(
        'click',
        showHome
    );

$('nav-browser')
    ?.addEventListener(
        'click',
        showBrowser
    );

$('nav-games')
    ?.addEventListener(
        'click',
        showGames
    );

$('nav-gateway')
    ?.addEventListener(
        'click',
        showGateway
    );

document
    .querySelectorAll(
        '.quick-link'
    )
    .forEach(
        (button) => {
            button.addEventListener(
                'click',
                () => {
                    openDestination(
                        button.dataset.url
                    );
                }
            );
        }
    );

$('session-table-body')
    ?.addEventListener(
        'click',
        (event) => {
            const openButton =
                event.target.closest(
                    '[data-open-session]'
                );

            const deleteButton =
                event.target.closest(
                    '[data-delete-session]'
                );

            if (openButton) {
                $('session-id').value =
                    openButton.dataset
                        .openSession;

                showBrowser();
            }

            if (deleteButton) {
                deleteSession(
                    deleteButton.dataset
                        .deleteSession
                );
            }
        }
    );

$('session-advanced-toggle')
    ?.addEventListener(
        'click',
        () => {
            const container =
                $('session-advanced-container');

            const button =
                $('session-advanced-toggle');

            if (
                !container ||
                !button
            ) {
                return;
            }

            const isHidden =
                container.style.display ===
                'none';

            container.style.display =
                isHidden
                    ? 'block'
                    : 'none';

            button.textContent =
                isHidden
                    ? '- HIDE ADVANCED OPTIONS'
                    : '+ SHOW ADVANCED OPTIONS';
        }
    );


/* -----------------------------
   START
----------------------------- */

checkAuthentication();

renderGames();

loadSessions();

showHome();
