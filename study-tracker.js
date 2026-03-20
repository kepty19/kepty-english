(function () {
    var STORAGE_KEY = 'keptyStudyTrackerV1';
    var USER_KEY = 'keptyUserId';
    var DEFAULT_USER_ID = 'tomohiro.19';
    var FLUSH_INTERVAL_MS = 15000;
    var activeStartMs = null;
    var flushTimer = null;

    function parseJsonSafely(raw, fallbackValue) {
        try {
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallbackValue;
        } catch (e) {
            return fallbackValue;
        }
    }

    function getCurrentUserId() {
        var params = new URLSearchParams(window.location.search || '');
        var idFromUrl = (params.get('id') || '').trim();
        if (idFromUrl) {
            localStorage.setItem(USER_KEY, idFromUrl);
            return idFromUrl;
        }
        var idFromStorage = (localStorage.getItem(USER_KEY) || '').trim();
        if (idFromStorage) {
            return idFromStorage;
        }
        localStorage.setItem(USER_KEY, DEFAULT_USER_ID);
        return DEFAULT_USER_ID;
    }

    function getState() {
        var state = parseJsonSafely(localStorage.getItem(STORAGE_KEY), null);
        if (!state) {
            state = { users: {} };
        }
        if (!state.users || typeof state.users !== 'object') {
            state.users = {};
        }
        return state;
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function ensureUserState(state, userId) {
        if (!state.users[userId] || typeof state.users[userId] !== 'object') {
            state.users[userId] = {
                totalActiveMs: 0,
                dayActivityMs: {}
            };
        }
        var userState = state.users[userId];
        if (!userState.dayActivityMs || typeof userState.dayActivityMs !== 'object') {
            userState.dayActivityMs = {};
        }
        if (typeof userState.totalActiveMs !== 'number' || userState.totalActiveMs < 0) {
            userState.totalActiveMs = 0;
        }
        return userState;
    }

    function toDateKey(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function startOfNextDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
    }

    function splitAndAccumulate(userState, fromMs, toMs) {
        if (!(toMs > fromMs)) {
            return;
        }
        var cursor = fromMs;
        while (cursor < toMs) {
            var cursorDate = new Date(cursor);
            var nextDay = startOfNextDay(cursorDate).getTime();
            var partEnd = Math.min(toMs, nextDay);
            var delta = partEnd - cursor;
            var dayKey = toDateKey(cursorDate);
            userState.dayActivityMs[dayKey] = (userState.dayActivityMs[dayKey] || 0) + delta;
            userState.totalActiveMs += delta;
            cursor = partEnd;
        }
    }

    function getUserSnapshot(userId) {
        var state = getState();
        var userState = ensureUserState(state, userId || getCurrentUserId());
        return {
            userId: userId || getCurrentUserId(),
            totalActiveMs: userState.totalActiveMs,
            dayActivityMs: Object.assign({}, userState.dayActivityMs)
        };
    }

    function flushActiveChunk() {
        if (activeStartMs === null) {
            return;
        }
        var now = Date.now();
        if (now <= activeStartMs) {
            return;
        }
        var userId = getCurrentUserId();
        var state = getState();
        var userState = ensureUserState(state, userId);
        splitAndAccumulate(userState, activeStartMs, now);
        saveState(state);
        activeStartMs = now;
    }

    function shouldCountAsActive() {
        if (document.visibilityState !== 'visible') {
            return false;
        }
        if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
            return false;
        }
        return true;
    }

    function startActiveTimer() {
        if (activeStartMs !== null) {
            return;
        }
        activeStartMs = Date.now();
    }

    function stopActiveTimer() {
        flushActiveChunk();
        activeStartMs = null;
    }

    function onActivityChange() {
        if (shouldCountAsActive()) {
            startActiveTimer();
        } else {
            stopActiveTimer();
        }
    }

    function applyUserIdToMenuLinks() {
        var userId = getCurrentUserId();
        var links = document.querySelectorAll('a[href]');
        links.forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://')) {
                return;
            }
            if (!href.endsWith('.html') && href.indexOf('.html?') === -1) {
                return;
            }
            try {
                var url = new URL(href, window.location.href);
                url.searchParams.set('id', userId);
                link.setAttribute('href', url.pathname.split('/').pop() + url.search);
            } catch (e) {
                // Ignore malformed href values.
            }
        });
    }

    function init() {
        getCurrentUserId();
        applyUserIdToMenuLinks();
        onActivityChange();

        document.addEventListener('visibilitychange', onActivityChange);
        window.addEventListener('focus', onActivityChange);
        window.addEventListener('blur', onActivityChange);
        window.addEventListener('pagehide', stopActiveTimer);
        window.addEventListener('beforeunload', stopActiveTimer);

        flushTimer = setInterval(function () {
            flushActiveChunk();
        }, FLUSH_INTERVAL_MS);

        window.addEventListener('unload', function () {
            if (flushTimer) {
                clearInterval(flushTimer);
            }
        });
    }

    init();

    window.KeptyStudyTracker = {
        getCurrentUserId: getCurrentUserId,
        getUserSnapshot: getUserSnapshot,
        flush: flushActiveChunk
    };
})();
