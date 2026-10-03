/*
 * Shared Firebase setup for every app.
 * Google sign-in and Cloud Firestore both use techcoderlabz-project.
 * That is the project where the Firestore API is enabled. rhea-apps-1711
 * has Auth only, so writes there never leave the browser.
 */
(function () {
    var firebaseConfig = {
        apiKey: "AIzaSyCectC2gNXIYpL8Rt4QeOsQuW5oEF2Tf4k",
        authDomain: "techcoderlabz-project.firebaseapp.com",
        projectId: "techcoderlabz-project",
        storageBucket: "techcoderlabz-project.firebasestorage.app",
        messagingSenderId: "750937809509",
        appId: "1:750937809509:web:b3561297b5d8ea282b5c8c",
        measurementId: "G-J13K9JQ058"
    };

    var googleClientId = "750937809509-cdin14jif4vbcmi9ai9v0e6d86ai4b1i.apps.googleusercontent.com";
    var googleButtonsReady = false;

    var legacyHold = captureAndClearBrowserCopies();

    var auth = null;
    var db = null;
    var readyCallback = null;
    var appStarted = false;

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function clean(data) {
        var out = {};
        Object.keys(data || {}).forEach(function (key) {
            if (data[key] !== undefined) {
                out[key] = data[key];
            }
        });
        return out;
    }

    function friendlyAuthError(error) {
        var code = error && error.code;
        if (code === "auth/unauthorized-domain") {
            return "This site is not an authorized domain for Google sign-in. Add it in Firebase Authentication → Settings → Authorized domains.";
        }
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
            return "The Google window was closed before sign-in finished.";
        }
        if (code === "auth/operation-not-allowed") {
            return "Google sign-in is turned off for this Firebase project. Enable it under Authentication → Sign-in method.";
        }
        if (code === "auth/popup-blocked") {
            return "This browser blocked the Google window. Allow popups, or open the site in Safari or Chrome and try again.";
        }
        if (code === "auth/web-storage-unsupported") {
            return "This browser is blocking site storage, so Google sign-in cannot finish. Turn off private browsing or open the page in Safari or Chrome.";
        }
        if (code === "auth/network-request-failed") {
            return "Network problem while contacting Google. Check your connection and try again.";
        }
        var message = (error && error.message) || "";
        if (message.indexOf("missing initial state") !== -1) {
            return "This browser blocked the sign-in handoff. Open the page in Safari or Chrome itself, not inside another app, then tap Sign in with Google again.";
        }
        return message || "Could not sign in with Google.";
    }

    function friendlyDataError(error) {
        if (!error) {
            return "";
        }
        if (error.code === "permission-denied") {
            return "You are signed in, but Firestore refused this request. In techcoderlabz-project, publish rules that allow a signed-in user to read and write only users/{their uid}.";
        }
        if (error.code === "unavailable") {
            return "Firestore is unavailable right now. Check your connection and try again.";
        }
        return error.message || "Could not reach Firestore.";
    }

    function userCollection(name) {
        var user = firebase.auth().currentUser;
        if (!user) {
            throw new Error("Sign in with Google before using Firestore.");
        }
        return firebase.firestore().collection("users").doc(user.uid).collection(name);
    }

    function captureAndClearBrowserCopies() {
        var hold = { employees: [], sql: {} };
        var appKeys = ["employees", "myBookTracker", "myMedicineTracker", "myScreenTimeTracker"];
        var i;
        try {
            var employeesRaw = localStorage.getItem("employees");
            if (employeesRaw) {
                var parsed = JSON.parse(employeesRaw);
                if (Array.isArray(parsed)) hold.employees = parsed;
            }
        } catch (error) {
            hold.employees = [];
        }
        appKeys.forEach(function (key) {
            try {
                if (key !== "employees") {
                    var saved = localStorage.getItem(key);
                    if (saved) hold.sql[key] = saved;
                }
                localStorage.removeItem(key);
            } catch (error) {
                return;
            }
        });
        var doomed = [];
        try {
            for (i = 0; i < localStorage.length; i++) {
                var name = localStorage.key(i);
                if (name && name.indexOf("firestore") !== -1) doomed.push(name);
            }
            doomed.forEach(function (name) { localStorage.removeItem(name); });
        } catch (error) {
            return hold;
        }
        return hold;
    }

    function writeRows(collectionName, rows) {
        if (!rows.length) {
            return Promise.resolve();
        }
        var col = userCollection(collectionName);
        var batch = firebase.firestore().batch();
        rows.forEach(function (row) {
            batch.set(col.doc(), clean(Object.assign({}, row, { createdAt: Date.now() })));
        });
        return batch.commit();
    }

    function loadSqlJs() {
        if (typeof initSqlJs === "function") {
            return Promise.resolve();
        }
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error("Could not read the old browser database.")); };
            document.head.appendChild(script);
        });
    }

    function migrateSqlDump(storageKey, table, fields, collectionName) {
        var saved = legacyHold.sql[storageKey];
        if (!saved) {
            return Promise.resolve();
        }
        return loadSqlJs().then(function () {
            return initSqlJs({
            locateFile: function (file) {
                return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + file;
            }
            });
        }).then(function (SQL) {
            var binary = atob(saved);
            var data = new Uint8Array(binary.length);
            var i;
            for (i = 0; i < binary.length; i++) {
                data[i] = binary.charCodeAt(i);
            }
            var database = new SQL.Database(data);
            var result = database.exec("SELECT " + fields.join(", ") + " FROM " + table);
            var rows = [];
            if (result.length > 0) {
                result[0].values.forEach(function (value) {
                    var row = {};
                    fields.forEach(function (field, index) {
                        row[field] = value[index];
                    });
                    if (row.rating != null) row.rating = Number(row.rating) || 0;
                    if (row.minutes != null) row.minutes = Number(row.minutes) || 0;
                    rows.push(row);
                });
            }
            return writeRows(collectionName, rows);
        }).catch(function (error) {
            showDataError(error);
            return Promise.resolve();
        });
    }

    function adoptLegacyStorage() {
        var employees = legacyHold.employees || [];
        legacyHold.employees = [];
        var employeeWrite = employees.length ? writeRows("employees", employees) : Promise.resolve();
        return employeeWrite.then(function () {
            return migrateSqlDump("myBookTracker", "books", ["title", "author", "status", "rating"], "books");
        }).then(function () {
            return migrateSqlDump("myMedicineTracker", "medicines", ["name", "dosage", "schedule", "status"], "medicines");
        }).then(function () {
            return migrateSqlDump("myScreenTimeTracker", "screentime", ["name", "minutes", "usedOn", "category"], "screentime");
        }).catch(function (error) {
            showDataError(error);
        });
    }

    function showAuthError(message) {
        var el = document.getElementById("authError");
        if (!el) {
            return;
        }
        el.textContent = message || "";
        el.hidden = !message;
    }

    function setChecking(isChecking) {
        var checking = document.getElementById("authChecking");
        if (checking) {
            checking.hidden = !isChecking;
        }
    }

    function isLobby() {
        return document.body && document.body.getAttribute("data-lobby") === "home";
    }

    function paintLobby(signedIn) {
        if (!isLobby()) {
            return;
        }
        document.body.classList.toggle("is-signed-in", !!signedIn);
        var login = document.getElementById("loginScreen");
        var app = document.getElementById("appRoot");
        if (login) {
            login.hidden = true;
        }
        if (app) {
            app.hidden = false;
        }
        if (!signedIn) {
            var slot = document.getElementById("sessionSlot");
            if (slot) {
                slot.innerHTML = "";
            }
        }
    }

    function showLogin() {
        setChecking(false);
        if (isLobby()) {
            paintLobby(false);
            return;
        }
        var login = document.getElementById("loginScreen");
        var app = document.getElementById("appRoot");
        if (login) {
            login.hidden = false;
        }
        if (app) {
            app.hidden = true;
        }
    }

    function showApp(user) {
        setChecking(false);
        if (isLobby()) {
            paintLobby(true);
        } else {
            var login = document.getElementById("loginScreen");
            var app = document.getElementById("appRoot");
            if (login) {
                login.hidden = true;
            }
            if (app) {
                app.hidden = false;
            }
        }
        renderSession(user);
        if (!appStarted && typeof readyCallback === "function") {
            appStarted = true;
            adoptLegacyStorage().then(function () {
                readyCallback(user);
            });
        }
    }

    function renderSession(user) {
        var slot = document.getElementById("sessionSlot");
        if (!slot || !user) {
            return;
        }
        var name = user.displayName || user.email || "Signed in";
        var photo = user.photoURL
            ? '<img class="session-photo" alt="" src="' + escapeHtml(user.photoURL) + '">'
            : "";
        slot.innerHTML =
            '<div class="session">' +
            photo +
            '<span class="session-name">Google · ' + escapeHtml(name) + "</span>" +
            '<button type="button" class="logout-button" id="logoutButton">Log out</button>' +
            "</div>";
        document.getElementById("logoutButton").addEventListener("click", function () {
            auth.signOut().then(function () {
                location.reload();
            });
        });
    }

    function mountShell() {
        if (!document.getElementById("authChecking")) {
            var checking = document.createElement("div");
            checking.id = "authChecking";
            checking.className = "auth-checking";
            checking.textContent = "Checking your Google sign-in…";
            document.body.prepend(checking);
        }

        bindGoogleButton();
        if (isLobby() || document.getElementById("loginScreen")) {
            return;
        }

        var screen = document.createElement("div");
        screen.id = "loginScreen";
        screen.className = "login-screen";
        screen.hidden = true;
        var pageName = document.title || "this app";
        var onIndex = /index\.html$/.test(location.pathname) || /\/$/.test(location.pathname);
        screen.innerHTML =
            '<div class="login-card">' +
            '<p class="login-kicker">Google account</p>' +
            "<h1>Sign in to continue</h1>" +
            "<p>Sign in with Google to open <strong>" + escapeHtml(pageName) + "</strong>. " +
            "Your lists stay with this Google account.</p>" +
            '<button type="button" class="google-button" id="googleSignInButton">' +
            '<svg viewBox="0 0 48 48" aria-hidden="true" width="18" height="18">' +
            '<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>' +
            '<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>' +
            '<path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>' +
            '<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.4 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/>' +
            "</svg>" +
            "Sign in with Google" +
            "</button>" +
            '<p id="authError" class="auth-error" hidden></p>' +
            (onIndex ? "" : '<a class="login-back" href="index.html">← All projects</a>') +
            "</div>";
        document.body.prepend(screen);
        bindGoogleButton();
    }

    function googleButtons() {
        return Array.prototype.slice.call(document.querySelectorAll(".google-button"));
    }

    function bindGoogleButton() {
        googleButtons().forEach(function (button) {
            if (button.getAttribute("data-bound") === "1") {
                return;
            }
            button.setAttribute("data-bound", "1");
            button.addEventListener("click", signInWithGoogle);
        });
    }

    function prefersRedirect() {
        var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        var ua = navigator.userAgent || "";
        return !!coarse || /Android|iPhone|iPad|iPod|Mobile|FBAN|FBAV|Instagram/i.test(ua);
    }

    function signInWithGoogle() {
        showAuthError("");
        googleButtons().forEach(function (button) {
            button.disabled = true;
        });
        var provider = new firebase.auth.GoogleAuthProvider();
        var attempt = prefersRedirect()
            ? auth.signInWithRedirect(provider)
            : auth.signInWithPopup(provider).catch(function (error) {
                var code = error && error.code;
                if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment" || code === "auth/cancelled-popup-request") {
                    return auth.signInWithRedirect(provider);
                }
                if (code === "auth/popup-closed-by-user") {
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            if (!auth.currentUser) {
                                showAuthError(friendlyAuthError(error));
                            }
                            resolve();
                        }, 700);
                    });
                }
                showAuthError(friendlyAuthError(error));
            });
        Promise.resolve(attempt).catch(function (error) {
            showAuthError(friendlyAuthError(error));
        }).finally(function () {
            googleButtons().forEach(function (button) {
                button.disabled = false;
            });
        });
    }

    function onGoogleCredential(response) {
        if (!auth || !response || !response.credential) {
            showAuthError("Google did not finish sign-in. Try the button again.");
            return;
        }
        showAuthError("");
        var credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
        auth.signInWithCredential(credential).catch(function (error) {
            showAuthError(friendlyAuthError(error));
        });
    }

    function loadGoogleScript() {
        if (window.google && google.accounts && google.accounts.id) {
            return Promise.resolve();
        }
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error("Google sign-in failed to load.")); };
            document.head.appendChild(script);
        });
    }

    function ensureGoogleSlots() {
        googleButtons().forEach(function (button) {
            var previous = button.previousElementSibling;
            if (previous && previous.classList.contains("google-slot")) {
                return;
            }
            var slot = document.createElement("div");
            slot.className = "google-slot";
            var wide = button.closest && button.closest(".login-card, .intro-panel");
            var width = wide ? 300 : (window.innerWidth < 560 ? 200 : 230);
            slot.setAttribute("data-google-width", String(width));
            button.parentNode.insertBefore(slot, button);
        });
    }

    function mountGoogleButtons() {
        if (googleButtonsReady || !auth) {
            return;
        }
        ensureGoogleSlots();
        loadGoogleScript().then(function () {
            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: onGoogleCredential,
                auto_select: false,
                itp_support: true,
                use_fedcm_for_button: true,
                context: "signin"
            });
            var placed = 0;
            document.querySelectorAll(".google-slot").forEach(function (slot) {
                if (slot.getAttribute("data-rendered") === "1") {
                    return;
                }
                var width = Number(slot.getAttribute("data-google-width")) || 240;
                google.accounts.id.renderButton(slot, {
                    type: "standard",
                    theme: "outline",
                    size: "large",
                    text: "signin_with",
                    shape: "pill",
                    width: width,
                    logo_alignment: "left"
                });
                slot.setAttribute("data-rendered", "1");
                if (slot.childElementCount) {
                    placed += 1;
                    var button = slot.nextElementSibling;
                    if (button && button.classList.contains("google-button")) {
                        button.hidden = true;
                    }
                }
            });
            if (placed) {
                googleButtonsReady = true;
            }
        }).catch(function () {
            googleButtonsReady = false;
        });
    }

    function ensureFirebase() {
        if (!window.firebase) {
            throw new Error("Firebase failed to load.");
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
    }

    function start(onReady) {
        readyCallback = onReady;
        mountShell();
        try {
            ensureFirebase();
        } catch (error) {
            setChecking(false);
            showLogin();
            showAuthError(error.message);
            return;
        }

        var persistence = firebase.auth.Auth.Persistence;
        auth.setPersistence(persistence.LOCAL).catch(function () {
            return auth.setPersistence(persistence.SESSION);
        }).then(function () {
            return auth.getRedirectResult();
        }).catch(function (error) {
            showAuthError(friendlyAuthError(error));
        }).finally(function () {
            mountGoogleButtons();
        });

        auth.onAuthStateChanged(function (user) {
            if (user) {
                showAuthError("");
                showApp(user);
            } else {
                appStarted = false;
                showLogin();
            }
        });
    }

    function watch(collectionName, onChange) {
        try {
            return userCollection(collectionName).onSnapshot(function (snap) {
                var rows = snap.docs.map(function (doc) {
                    return Object.assign({ id: doc.id }, doc.data());
                });
                onChange(rows, null);
            }, function (error) {
                onChange([], error);
            });
        } catch (error) {
            onChange([], error);
            return function () {};
        }
    }

    function add(collectionName, data) {
        return userCollection(collectionName).add(clean(Object.assign({}, data, {
            createdAt: Date.now()
        })));
    }

    function update(collectionName, id, data) {
        return userCollection(collectionName).doc(id).update(clean(data));
    }

    function remove(collectionName, id) {
        return userCollection(collectionName).doc(id).delete();
    }

    function showDataError(error) {
        var banner = document.getElementById("dataBanner");
        var root = document.getElementById("appRoot");
        if (!banner && root) {
            banner = document.createElement("div");
            banner.id = "dataBanner";
            banner.className = "data-banner";
            root.prepend(banner);
        }
        if (!banner) {
            return;
        }
        var message = friendlyDataError(error);
        banner.textContent = message;
        banner.hidden = !message;
    }

    window.AppAuth = {
        start: start,
        watch: watch,
        add: add,
        update: update,
        remove: remove,
        escape: escapeHtml,
        showDataError: showDataError,
        friendlyDataError: friendlyDataError
    };
})();
