(function () {
    'use strict';

    const mod = (n, m) => ((n % m) + m) % m;

    const baseDictionary =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~-';

    const shuffledIndicator = '_rhs';

    function generateDictionary() {
        let str = '';

        const split = baseDictionary.split('');

        while (split.length > 0) {
            str += split.splice(
                Math.floor(Math.random() * split.length),
                1
            )[0];
        }

        return str;
    }

    class StrShuffler {
        constructor(dictionary = generateDictionary()) {
            this.dictionary = dictionary;
        }

        shuffle(str) {
            if (str.startsWith(shuffledIndicator)) {
                return str;
            }

            let shuffledStr = '';

            for (let i = 0; i < str.length; i++) {
                const char = str.charAt(i);
                const idx = baseDictionary.indexOf(char);

                if (char === '%' && str.length - i >= 3) {
                    shuffledStr += char;
                    shuffledStr += str.charAt(++i);
                    shuffledStr += str.charAt(++i);
                } else if (idx === -1) {
                    shuffledStr += char;
                } else {
                    shuffledStr += this.dictionary.charAt(
                        mod(idx + i, baseDictionary.length)
                    );
                }
            }

            return shuffledIndicator + shuffledStr;
        }
    }

    function setError(message) {
        const element = document.getElementById('error-text');

        if (message) {
            element.style.display = 'block';
            element.textContent = 'Error: ' + message;
        } else {
            element.style.display = 'none';
            element.textContent = '';
        }
    }

    function getPassword() {
        const element =
            document.getElementById('session-password');

        return element ? element.value : '';
    }

    function get(url, callback) {
        const password = getPassword();

        if (password) {
            url += url.includes('?')
                ? '&pwd=' + encodeURIComponent(password)
                : '?pwd=' + encodeURIComponent(password);
        }

        const request = new XMLHttpRequest();

        request.open('GET', url, true);

        request.onload = function () {
            if (request.status === 200) {
                if (callback) {
                    callback(request.responseText);
                }
            } else {
                setError(
                    'Server returned HTTP ' +
                    request.status
                );
            }
        };

        request.onerror = function () {
            setError('Cannot communicate with the server');
        };

        request.send();
    }

    const api = {

        needpassword(callback) {
            get('/needpassword', value => {
                callback(value === 'true');
            });
        },

        newsession(callback) {
            get('/newsession', callback);
        },

        editsession(
            id,
            httpProxy,
            enableShuffling,
            callback
        ) {
            let url =
                '/editsession?id=' +
                encodeURIComponent(id);

            if (httpProxy) {
                url +=
                    '&httpProxy=' +
                    encodeURIComponent(httpProxy);
            }

            url +=
                '&enableShuffling=' +
                (enableShuffling ? '1' : '0');

            get(url, function (response) {
                if (response !== 'Success') {
                    setError(
                        'Unexpected server response: ' +
                        response
                    );

                    return;
                }

                if (callback) {
                    callback();
                }
            });
        },

        sessionexists(id, callback) {
            get(
                '/sessionexists?id=' +
                encodeURIComponent(id),
                function (response) {
                    if (response === 'exists') {
                        callback(true);
                    } else if (response === 'not found') {
                        callback(false);
                    } else {
                        setError(
                            'Unexpected server response'
                        );
                    }
                }
            );
        },

        deletesession(id, callback) {
            get(
                '/deletesession?id=' +
                encodeURIComponent(id),
                function (response) {
                    if (
                        response !== 'Success' &&
                        response !== 'not found'
                    ) {
                        setError(
                            'Unexpected server response'
                        );

                        return;
                    }

                    if (callback) {
                        callback();
                    }
                }
            );
        },

        shuffleDict(id, callback) {
            get(
                '/api/shuffleDict?id=' +
                encodeURIComponent(id),
                function (response) {
                    try {
                        callback(JSON.parse(response));
                    } catch {
                        setError(
                            'Invalid shuffle dictionary'
                        );
                    }
                }
            );
        }
    };

    const localStorageKey =
        'rammerhead_sessionids';

    const localStorageKeyDefault =
        'rammerhead_default_sessionid';

    const sessionIdsStore = {

        get() {
            const rawData =
                localStorage.getItem(localStorageKey);

            if (!rawData) {
                return [];
            }

            try {
                const data = JSON.parse(rawData);

                return Array.isArray(data)
                    ? data
                    : [];
            } catch {
                return [];
            }
        },

        set(data) {
            localStorage.setItem(
                localStorageKey,
                JSON.stringify(data)
            );
        },

        getDefault() {
            const id =
                localStorage.getItem(
                    localStorageKeyDefault
                );

            if (!id) {
                return null;
            }

            return this.get().find(
                session => session.id === id
            ) || null;
        },

        setDefault(id) {
            localStorage.setItem(
                localStorageKeyDefault,
                id
            );
        }
    };

    function renderSessionTable(data) {
        const tbody =
            document.getElementById(
                'session-table-body'
            );

        tbody.innerHTML = '';

        if (data.length === 0) {
            const row =
                document.createElement('tr');

            const cell =
                document.createElement('td');

            cell.colSpan = 3;

            cell.textContent =
                'No active sessions';

            row.appendChild(cell);

            tbody.appendChild(row);

            return;
        }

        data.forEach((session, index) => {

            const row =
                document.createElement('tr');

            const idCell =
                document.createElement('td');

            idCell.textContent =
                session.id;

            const dateCell =
                document.createElement('td');

            dateCell.textContent =
                session.createdOn;

            const actionCell =
                document.createElement('td');

            const actions =
                document.createElement('div');

            actions.className =
                'session-action';

            const useButton =
                document.createElement('button');

            useButton.textContent =
                'USE';

            useButton.onclick = function () {
                sessionIdsStore.setDefault(
                    session.id
                );

                loadSettings(session);
            };

            const deleteButton =
                document.createElement('button');

            deleteButton.textContent =
                'DELETE';

            deleteButton.onclick = function () {
                api.deletesession(
                    session.id,
                    function () {
                        data.splice(index, 1);

                        sessionIdsStore.set(data);

                        renderSessionTable(data);
                    }
                );
            };

            actions.appendChild(useButton);

            actions.appendChild(deleteButton);

            actionCell.appendChild(actions);

            row.appendChild(idCell);

            row.appendChild(dateCell);

            row.appendChild(actionCell);

            tbody.appendChild(row);
        });
    }

    function loadSettings(session) {
        document.getElementById(
            'session-id'
        ).value = session.id;

        document.getElementById(
            'session-httpproxy'
        ).value = session.httpproxy || '';

        document.getElementById(
            'session-shuffling'
        ).checked =
            typeof session.enableShuffling === 'boolean'
                ? session.enableShuffling
                : true;
    }

    function loadSessions() {
        const sessions =
            sessionIdsStore.get();

        const defaultSession =
            sessionIdsStore.getDefault();

        if (defaultSession) {
            loadSettings(defaultSession);
        }

        renderSessionTable(sessions);
    }

    function addSession(id) {
        const data =
            sessionIdsStore.get();

        data.unshift({
            id,
            createdOn:
                new Date().toLocaleString()
        });

        sessionIdsStore.set(data);

        renderSessionTable(data);
    }

    function editSession(
        id,
        httpProxy,
        enableShuffling
    ) {
        const data =
            sessionIdsStore.get();

        const session =
            data.find(
                item => item.id === id
            );

        if (session) {
            session.httpproxy =
                httpProxy;

            session.enableShuffling =
                enableShuffling;

            sessionIdsStore.set(data);
        }
    }

    function go() {
        setError();

        const id =
            document.getElementById(
                'session-id'
            ).value.trim();

        const httpProxy =
            document.getElementById(
                'session-httpproxy'
            ).value.trim();

        const enableShuffling =
            document.getElementById(
                'session-shuffling'
            ).checked;

        let url =
            document.getElementById(
                'session-url'
            ).value.trim();

        if (!url) {
            url = 'https://www.google.com/';
        }

        if (!id) {
            setError(
                'Create a session first'
            );

            return;
        }

        if (
            !url.startsWith('http://') &&
            !url.startsWith('https://')
        ) {
            url = 'https://' + url;
        }

        api.sessionexists(
            id,
            function (exists) {

                if (!exists) {
                    setError(
                        'Session does not exist'
                    );

                    return;
                }

                api.editsession(
                    id,
                    httpProxy,
                    enableShuffling,
                    function () {

                        editSession(
                            id,
                            httpProxy,
                            enableShuffling
                        );

                        api.shuffleDict(
                            id,
                            function (dictionary) {

                                let destination;

                                if (
                                    !enableShuffling ||
                                    !dictionary
                                ) {
                                    destination =
                                        '/' +
                                        id +
                                        '/' +
                                        url;
                                } else {
                                    const shuffler =
                                        new StrShuffler(
                                            dictionary
                                        );

                                    destination =
                                        '/' +
                                        id +
                                        '/' +
                                        shuffler.shuffle(
                                            url
                                        );
                                }

                                window.location.href =
                                    destination;
                            }
                        );
                    }
                );
            }
        );
    }

    window.addEventListener(
        'DOMContentLoaded',
        function () {

            loadSessions();

            api.needpassword(
                function (needed) {
                    if (needed) {
                        document.getElementById(
                            'password-wrapper'
                        ).style.display = 'block';
                    }
                }
            );

            document.getElementById(
                'session-advanced-toggle'
            ).onclick = function () {

                const container =
                    document.getElementById(
                        'session-advanced-container'
                    );

                const isHidden =
                    container.style.display === 'none';

                container.style.display =
                    isHidden
                        ? 'block'
                        : 'none';

                this.textContent =
                    isHidden
                        ? '- HIDE ADVANCED OPTIONS'
                        : '+ SHOW ADVANCED OPTIONS';
            };

            document.getElementById(
                'session-create-btn'
            ).onclick = function () {

                setError();

                api.newsession(
                    function (id) {

                        addSession(id);

                        sessionIdsStore.setDefault(
                            id
                        );

                        document.getElementById(
                            'session-id'
                        ).value = id;
                    }
                );
            };

            document.getElementById(
                'session-go'
            ).onclick = go;

            document.getElementById(
                'session-url'
            ).addEventListener(
                'keydown',
                function (event) {
                    if (event.key === 'Enter') {
                        go();
                    }
                }
            );
        }
    );

})();
