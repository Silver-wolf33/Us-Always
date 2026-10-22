/* Us, Always — frontend-only starter app.
   Data is stored in this browser's localStorage. For multi-device access, add a backend/database later. */
(() => {
        "use strict";

        const API_BASE = "http://localhost:3000/api";
        const TOKEN_KEY = "usAlwaysToken_v1";

        const STORAGE_KEY = "usAlwaysApp_v1";
        const AUTH_KEY = "usAlwaysAuth_v1";
        const SESSION_KEY = "usAlwaysSession_v1";
        const $ = (selector, root = document) => root.querySelector(selector);

        // Frontend-only demo authentication. Replace with server-side auth before publishing.
        let authMode = "login";
        const authScreen = $("#authScreen");
        const appShell = $("#appShell");
        const authForm = $("#authForm");
        const authError = $("#authError");

        function setAuthMode(mode) {
            authMode = mode;
            const isRegister = mode === "register";
            const isReset = mode === "reset";
            const isLogin = mode === "login";
            $("#authTitle").innerHTML = isRegister ?
                "Create our <em>space.</em>" :
                isReset ?
                "A fresh <em>start.</em>" :
                "Welcome <em>back.</em>";
            $("#authSubtitle").textContent = isRegister ?
                "One little account for your shared universe." :
                isReset ?
                "Verify your recovery secret to choose a new password." :
                "Our memories, our plans, our little universe.";
            $("#authSubmit").innerHTML = isRegister ?
                "Save our little space <span>♡</span>" :
                isReset ?
                "Save new password <span>♡</span>" :
                "Open our little world <span>♡</span>";
            $("#authSwitchLine").hidden = isReset;
            $("#authForgotLine").hidden = !isLogin;
            $("#authResetBack").hidden = !isReset;
            $("#authRecoveryField").hidden = isLogin;
            $("#authRecovery").required = !isLogin;
            $("#authRecovery").autocomplete = "off";
            $("#authRecoveryHint").textContent = isRegister ?
                "Save this secret somewhere safe. It is required to reset your password." :
                "Enter the recovery secret you created when you registered.";
            $("#authPasswordLabel").textContent = isReset ? "New password" : "Password";
            $("#authPassword").placeholder = isReset ?
                "Choose a new password" :
                "At least 10 characters";
            $("#authPassword").autocomplete =
                isRegister || isReset ? "new-password" : "current-password";
            $("#authPassword").value = "";
            $("#authRecovery").value = "";
            $("#authError").textContent = "";
            $("#authError").classList.remove("success");
            $("#authPhone").autocomplete = "tel";
        }
        async function apiRequest(path, options = {}) {
            const headers = {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            };
            if (options.token) headers.Authorization = `Bearer ${options.token}`;

            const response = await fetch(`${API_BASE}${path}`, {
                method: options.method || "GET",
                headers,
                ...(options.body !== undefined ?
                    { body: JSON.stringify(options.body) } :
                    {}),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    payload.error ||
                    payload.message ||
                    "The request could not be completed.",
                );
            }
            return payload;
        }

        function hasUsefulData(value) {
            return Boolean(
                value &&
                ((Array.isArray(value.dates) && value.dates.length) ||
                    (Array.isArray(value.moments) && value.moments.length) ||
                    (Array.isArray(value.interests) && value.interests.length) ||
                    (Array.isArray(value.counters) &&
                        value.counters.some(
                            (item) => Number(item.count) > 0 || !item.builtIn,
                        ))),
            );
        }

        async function syncDataFromServer(token) {
            const remote = await apiRequest("/data", { token });
            const local = (() => {
                try {
                    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
                } catch {
                    return null;
                }
            })();

            // Keep existing browser data if the cloud account is still empty.
            const chosen = hasUsefulData(remote) ?
                remote :
                hasUsefulData(local) ?
                local :
                defaultData();
            data = {...defaultData(), ...(chosen || {}) };

            if (!Array.isArray(data.counters) || data.counters.length === 0) {
                data.counters = defaultData().counters;
            }
            if (!Array.isArray(data.dates)) data.dates = [];
            if (!Array.isArray(data.moments)) data.moments = [];
            if (!Array.isArray(data.interests)) data.interests = [];

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            await apiRequest("/data", { method: "PUT", token, body: data });
        }

        function unlockApp() {
            authScreen.classList.add("auth-leaving");
            window.setTimeout(() => {
                authScreen.hidden = true;
                appShell.hidden = false;
            }, 420);
            localStorage.setItem(SESSION_KEY, "unlocked");
        }
        $("#authSwitch").addEventListener("click", () =>
            setAuthMode(authMode === "login" ? "register" : "login"),
        );
        $("#authForgot").addEventListener("click", () => setAuthMode("reset"));
        $("#authResetCancel").addEventListener("click", () => setAuthMode("login"));
        authForm.addEventListener("submit", async(event) => {
            event.preventDefault();

            const phone = $("#authPhone")
                .value.trim()
                .replace(/[\\s()-]/g, "");
            const password = $("#authPassword").value;
            const recovery = $("#authRecovery").value.trim();
            const submit = $("#authSubmit");

            authError.textContent = "";
            authError.classList.remove("success");

            if (phone.length < 6) {
                authError.textContent = "Please enter a valid mobile number.";
                return;
            }

            if (password.length < 10) {
                authError.textContent =
                    "Please use a password with at least 10 characters.";
                return;
            }

            if (authMode !== "login" && recovery.length < 8) {
                authError.textContent =
                    "Your recovery secret must be at least 8 characters.";
                return;
            }

            submit.disabled = true;
            const originalButtonText = submit.innerHTML;
            submit.textContent = "Please wait…";

            try {
                if (authMode === "register") {
                    const result = await apiRequest("/auth/register", {
                        method: "POST",
                        body: { phone, password, recoverySecret: recovery },
                    });

                    await syncDataFromServer(result.token);
                    localStorage.setItem(TOKEN_KEY, result.token);
                    localStorage.removeItem(AUTH_KEY);
                    authError.classList.add("success");
                    authError.textContent = "Your shared space is ready. Welcome in ♡";
                    renderAll();
                    unlockApp();
                } else if (authMode === "reset") {
                    await apiRequest("/auth/reset-password", {
                        method: "POST",
                        body: { phone, recoverySecret: recovery, newPassword: password },
                    });

                    setAuthMode("login");
                    $("#authPhone").value = phone;
                    authError.classList.add("success");
                    authError.textContent =
                        "Password updated. Log in with your new password ♡";
                } else {
                    const result = await apiRequest("/auth/login", {
                        method: "POST",
                        body: { phone, password },
                    });

                    await syncDataFromServer(result.token);
                    localStorage.setItem(TOKEN_KEY, result.token);
                    localStorage.removeItem(AUTH_KEY);
                    renderAll();
                    unlockApp();
                }
            } catch (error) {
                authError.classList.remove("success");
                authError.textContent =
                    error.message ||
                    "Could not connect to the server. Make sure the backend is running.";
            } finally {
                submit.disabled = false;
                submit.innerHTML = originalButtonText;
            }
        });
        $("#logoutButton").addEventListener("click", () => {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(TOKEN_KEY);
            appShell.hidden = true;
            authScreen.hidden = false;
            authScreen.classList.remove("auth-leaving");
            authForm.reset();
            setAuthMode("login");
        });
        if (
            localStorage.getItem(SESSION_KEY) === "unlocked" &&
            localStorage.getItem(TOKEN_KEY)
        ) {
            authScreen.hidden = true;
            appShell.hidden = false;
        } else {
            appShell.hidden = true;
            setAuthMode(localStorage.getItem(AUTH_KEY) ? "login" : "register");
        }
        const $$ = (selector, root = document) => [
            ...root.querySelectorAll(selector),
        ];
        const todayISO = () => {
            const d = new Date();
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 10);
        };
        const uid = () =>
            `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const escapeHTML = (value = "") =>
            String(value).replace(
                /[&<>"']/g,
                (char) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[char],
            );
        const formatDate = (
            value,
            options = { day: "numeric", month: "short", year: "numeric" },
        ) => {
            if (!value) return "Date not set";
            const d = new Date(`${value}T12:00:00`);
            return Number.isNaN(d.getTime()) ?
                "Date not set" :
                d.toLocaleDateString("en-GB", options);
        };
        const defaultData = () => ({
            counters: [{
                    id: "kisses",
                    name: "Kisses",
                    emoji: "💋",
                    description: "A tiny kiss, a big smile",
                    count: 0,
                    builtIn: true,
                },
                {
                    id: "hugs",
                    name: "Hugs",
                    emoji: "🫂",
                    description: "Safe place, warm arms",
                    count: 0,
                    builtIn: true,
                },
                {
                    id: "cuddles",
                    name: "Cuddles",
                    emoji: "🐻",
                    description: "Five more minutes, please",
                    count: 0,
                    builtIn: true,
                },
                {
                    id: "compliments",
                    name: "Compliments",
                    emoji: "🌷",
                    description: "Reminders of what we adore",
                    count: 0,
                    builtIn: true,
                },
                {
                    id: "handholds",
                    name: "Hand-holds",
                    emoji: "🤝",
                    description: "Walking side by side",
                    count: 0,
                    builtIn: true,
                },
                {
                    id: "dates",
                    name: "Date nights",
                    emoji: "🕯️",
                    description: "Little adventures together",
                    count: 0,
                    builtIn: true,
                },
            ],
            dates: [],
            moments: [],
            interests: [],
        });
        let data;
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            data =
                saved && Array.isArray(saved.counters) ?
                {...defaultData(), ...saved } :
                defaultData();
        } catch {
            data = defaultData();
        }
        let activeDateFilter = "all";
        let pendingConfirm = null;
        let toastTimer;

        function save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (error) {
                showToast("Browser storage is full. Try removing a few large photos.");
                console.error(error);
            }

            renderAll();

            const token = localStorage.getItem(TOKEN_KEY);
            if (token) {
                apiRequest("/data", { method: "PUT", token, body: data }).catch(
                    (error) => {
                        console.error("Cloud save failed:", error);
                        showToast(
                            "Saved in this browser, but cloud sync failed. Check your connection or photo size.",
                        );
                    },
                );
            }
        }

        function showToast(message) {
            const toast = $("#toast");
            toast.textContent = message;
            toast.classList.add("show");
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
        }

        function askConfirm(title, message, action, buttonText = "Yes, remove") {
            $("#modalTitle").textContent = title;
            $("#modalText").textContent = message;
            $("#modalConfirm").textContent = buttonText;
            pendingConfirm = action;
            $("#modalBackdrop").hidden = false;
        }

        function closeConfirm() {
            $("#modalBackdrop").hidden = true;
            pendingConfirm = null;
        }

        const pageNames = {
            home: "Dashboard",
            love: "Love Counter",
            dates: "Date Planner",
            moments: "Our Moments",
            interests: "Little Things",
        };

        function goToPage(page) {
            if (!pageNames[page]) page = "home";
            $$(".page").forEach((el) =>
                el.classList.toggle("active", el.id === `page-${page}`),
            );
            $$(".nav-link").forEach((el) =>
                el.classList.toggle("active", el.dataset.page === page),
            );
            $("#pageCrumb").textContent = pageNames[page];
            $("#sidebar").classList.remove("open");
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        document.addEventListener("click", (event) => {
            const pageButton = event.target.closest("[data-page], [data-go]");
            if (!pageButton) return;
            event.preventDefault();
            goToPage(pageButton.dataset.page || pageButton.dataset.go);
        });
        $("#menuToggle").addEventListener("click", () =>
            $("#sidebar").classList.toggle("open"),
        );
        document.addEventListener("click", (event) => {
            if (
                window.innerWidth <= 850 &&
                $("#sidebar").classList.contains("open") &&
                !event.target.closest("#sidebar") &&
                !event.target.closest("#menuToggle")
            ) {
                $("#sidebar").classList.remove("open");
            }
        });

        const quotes = [
            "If I had to choose again, I'd still choose you.",
            "You are my favorite notification and my favorite person.",
            "Home is less a place and more a person. For me, it's you.",
            "A thousand ordinary days with you, please.",
            "You make the small things feel like the whole world.",
            "Still crushing on you. Very much. A little embarrassingly.",
        ];
        $("#newQuote").addEventListener("click", () => {
            const quote = $("#dailyQuote");
            let next = quotes[Math.floor(Math.random() * quotes.length)];
            if (quotes.length > 1 && next === quote.textContent)
                next = quotes[(quotes.indexOf(next) + 1) % quotes.length];
            quote.textContent = next;
        });

        function renderCounters() {
            const grid = $("#counterGrid");
            grid.innerHTML = data.counters
                .map(
                    (c) => `
      <article class="counter-card">
        ${c.builtIn ? "" : `<button class="delete-category" data-delete-counter="${escapeHTML(c.id)}" aria-label="Delete ${escapeHTML(c.name)}">✕</button>`}
        <span class="counter-emoji">${escapeHTML(c.emoji || "♡")}</span>
        <h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.description || "A little bit of love")}</p>
        <div class="counter-value-row"><strong class="counter-value">${Number(c.count) || 0}</strong>
          <div class="counter-controls"><button data-counter="${escapeHTML(c.id)}" data-delta="-1" aria-label="Decrease ${escapeHTML(c.name)}" ${c.count <= 0 ? "disabled" : ""}>−</button><button class="plus-button" data-counter="${escapeHTML(c.id)}" data-delta="1" aria-label="Increase ${escapeHTML(c.name)}">+</button></div>
        </div>
      </article>`,
      )
      .join("");
    const total = data.counters.reduce(
      (sum, c) => sum + (Number(c.count) || 0),
      0,
    );
    $("#totalLove").textContent = total.toLocaleString();
    $("#homeKisses").textContent = (
      data.counters.find((c) => c.id === "kisses")?.count || 0
    ).toLocaleString();
    $("#homeHugs").textContent = (
      data.counters.find((c) => c.id === "hugs")?.count || 0
    ).toLocaleString();
  }
  $("#counterGrid").addEventListener("click", (event) => {
    const control = event.target.closest("[data-counter]");
    if (control) {
      const counter = data.counters.find(
        (c) => c.id === control.dataset.counter,
      );
      if (!counter) return;
      counter.count = Math.max(
        0,
        (Number(counter.count) || 0) + Number(control.dataset.delta),
      );
      save();
      if (Number(control.dataset.delta) > 0)
        showToast(
          `${counter.emoji || "♡"} One more ${counter.name.toLowerCase()}!`,
        );
      return;
    }
    const del = event.target.closest("[data-delete-counter]");
    if (del)
      askConfirm(
        "Remove this category?",
        "The category and its count will be deleted.",
        () => {
          data.counters = data.counters.filter(
            (c) => c.id !== del.dataset.deleteCounter,
          );
          save();
          showToast("Category removed.");
        },
      );
  });
  $("#categoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#categoryName").value.trim();
    if (!name) return;
    if (
      data.counters.some((c) => c.name.toLowerCase() === name.toLowerCase())
    ) {
      showToast("That category already exists.");
      return;
    }
    data.counters.push({
      id: uid(),
      name,
      emoji: "💗",
      description: "Your own special kind of love",
      count: 0,
      builtIn: false,
    });
    $("#categoryName").value = "";
    save();
    showToast("Your new love category is ready! ♡");
  });

  function dateStatus(item) {
    if (item.status === "completed" || item.status === "cancelled")
      return item.status;
    return item.date < todayISO() ? "past" : "upcoming";
  }
  function effectiveStatus(item) {
    const status = dateStatus(item);
    return status === "past" ? "upcoming" : status;
  }
  function renderDates() {
    const upcoming = data.dates.filter(
      (d) => effectiveStatus(d) === "upcoming",
    ).length;
    $("#upcomingCount").textContent = upcoming;
    $("#completedCount").textContent = data.dates.filter(
      (d) => d.status === "completed",
    ).length;
    $("#cancelledCount").textContent = data.dates.filter(
      (d) => d.status === "cancelled",
    ).length;
    const next = data.dates
      .filter((d) => effectiveStatus(d) === "upcoming")
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    $("#homeNextDate").textContent = next
      ? formatDate(next.date, { day: "numeric", month: "short" })
      : "Not yet";
    $("#homeNextDateNote").textContent = next
      ? next.title
      : "Let's plan something lovely";
    const nextBox = $("#nextDateContent");
    if (!next) {
      nextBox.className = "empty-state compact-empty";
      nextBox.innerHTML = `<span>☕</span><strong>No date planned just yet</strong><p>A little coffee date? A long walk? You choose.</p><button class="text-button" data-go="dates">Make a plan <span>→</span></button>`;
    } else {
      nextBox.className = "next-date-content";
      nextBox.innerHTML = `<div class="next-date-date"><span>♡</span><div><strong>${escapeHTML(next.title)}</strong><small>${formatDate(next.date)}${next.time ? " · " + escapeHTML(next.time) : ""}</small></div></div><p>${escapeHTML(next.details || "Something lovely is on the calendar.")}</p><button class="text-button" data-go="dates">See date details <span>→</span></button>`;
    }
    const list = $("#dateList");
    let items = [...data.dates].sort((a, b) => a.date.localeCompare(b.date));
    if (activeDateFilter !== "all")
      items = items.filter((d) => effectiveStatus(d) === activeDateFilter);
    if (!items.length) {
      list.innerHTML = `<div class="panel empty-state"><span>♡</span><strong>No ${activeDateFilter === "all" ? "plans" : activeDateFilter + " plans"} here yet</strong><p>Add a little plan above. The best dates start with an idea.</p></div>`;
      return;
    }
    list.innerHTML = items
      .map((item) => {
        const status = effectiveStatus(item);
        const d = new Date(`${item.date}T12:00:00`);
        const month = Number.isNaN(d.getTime())
          ? "DATE"
          : d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
        const day = Number.isNaN(d.getTime()) ? "—" : d.getDate();
        const statusText =
          status === "upcoming"
            ? "Upcoming"
            : status === "completed"
              ? "Completed"
              : "Cancelled";
        const cancelInfo =
          item.status === "cancelled" && item.cancelReason
            ? `<p><strong>Why it got cancelled:</strong> ${escapeHTML(item.cancelReason)}</p>`
            : "";
        return `<article class="date-item"><div class="date-calendar"><small>${month}</small><strong>${day}</strong></div><div class="date-item-main"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.details || "A little plan for the two of us.")}</p>${cancelInfo}<div class="date-meta">${formatDate(item.date)}${item.time ? " · " + escapeHTML(item.time) : ""}${item.reminder ? " · ♡ reminder on" : ""}</div></div><div class="date-item-side"><span class="status-pill status-${status}">● ${statusText}</span><div class="date-actions">${status !== "completed" ? `<button class="small-action" data-date-action="complete" data-id="${escapeHTML(item.id)}">Done ✓</button>` : `<button class="small-action" data-date-action="reopen" data-id="${escapeHTML(item.id)}">Reopen</button>`}${status !== "cancelled" ? `<button class="small-action cancel-action" data-date-action="cancel" data-id="${escapeHTML(item.id)}">Cancel</button>` : `<button class="small-action" data-date-action="reopen" data-id="${escapeHTML(item.id)}">Restore</button>`}<button class="small-action" data-date-action="delete" data-id="${escapeHTML(item.id)}" aria-label="Delete plan">✕</button></div></div></article>`;
      })
      .join("");
  }
  $("#dateForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#dateTitle").value.trim(),
      date = $("#dateWhen").value;
    if (!title || !date) return;
    data.dates.push({
      id: uid(),
      title,
      date,
      time: $("#dateTime").value,
      details: $("#dateDetails").value.trim(),
      reminder: $("#dateReminder").checked,
      status: "upcoming",
      cancelReason: "",
    });
    event.target.reset();
    $("#dateReminder").checked = true;
    save();
    showToast("Date plan saved. Something to look forward to! 🌷");
  });
  $("#dateFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeDateFilter = button.dataset.filter;
    $$("#dateFilters button").forEach((b) =>
      b.classList.toggle("selected", b === button),
    );
    renderDates();
  });
  $("#dateList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-date-action]");
    if (!button) return;
    const item = data.dates.find((d) => d.id === button.dataset.id);
    if (!item) return;
    const action = button.dataset.dateAction;
    if (action === "complete") {
      item.status = "completed";
      save();
      showToast("Date marked as completed. What a lovely memory! ✨");
    } else if (action === "reopen") {
      item.status = "upcoming";
      item.cancelReason = "";
      save();
      showToast("Plan restored to upcoming.");
    } else if (action === "cancel") {
      const reason = window.prompt(
        "Why was this date cancelled? (Optional — leave blank if you prefer)",
      );
      if (reason === null) return;
      item.status = "cancelled";
      item.cancelReason = reason.trim();
      save();
      showToast("It's okay. There can be a new plan. 💗");
    } else if (action === "delete") {
      askConfirm(
        "Delete this date plan?",
        "This plan will be removed from your list.",
        () => {
          data.dates = data.dates.filter((d) => d.id !== item.id);
          save();
          showToast("Date plan deleted.");
        },
      );
    }
  });

  function renderMoments() {
    const recent = [...data.moments]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    $("#homeMoments").textContent = data.moments.length;
    $("#recentMoments").innerHTML = recent.length
      ? recent.map(momentCard).join("")
      : `<div class="empty-state"><span>♡</span><p>Your favorite moments will live here.</p><button class="text-button" data-go="moments">Add the first one →</button></div>`;
    const query = ($("#momentSearch")?.value || "").trim().toLowerCase();
    const moments = [...data.moments]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((m) =>
        `${m.title} ${m.description}`.toLowerCase().includes(query),
      );
    $("#galleryCount").textContent =
      `${data.moments.length} ${data.moments.length === 1 ? "memory" : "memories"}, and counting`;
    $("#momentGallery").innerHTML = moments.length
      ? moments.map(momentCard).join("")
      : `<div class="panel empty-state"><span>📷</span><strong>${query ? "No matching memories" : "Your gallery is waiting"}</strong><p>${query ? "Try another search." : "Upload a photo above to save your first little story."}</p></div>`;
  }
  function momentCard(m) {
    return `<article class="moment-card"><img src="${m.image}" alt="${escapeHTML(m.title)}" loading="lazy"><div class="moment-card-body"><div class="moment-date">${formatDate(m.date)}</div><h3>${escapeHTML(m.title)}</h3><p>${escapeHTML(m.description || "A little moment, kept forever. ♡")}</p></div><div class="card-actions"><button class="subtle-delete" data-delete-moment="${escapeHTML(m.id)}">Remove memory ×</button></div></article>`;
  }
  $("#momentPhoto").addEventListener("change", () => {
    const file = $("#momentPhoto").files[0];
    $("#fileName").textContent = file
      ? file.name
      : "JPG, PNG or WEBP · up to 4 MB";
  });
  $("#momentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const file = $("#momentPhoto").files[0];
    if (!file) {
      showToast("Choose a photo first.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast("That photo is over 4 MB. Please choose a smaller image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      data.moments.push({
        id: uid(),
        title: $("#momentTitle").value.trim(),
        date: $("#momentDate").value || todayISO(),
        description: $("#momentDescription").value.trim(),
        image: reader.result,
      });
      try {
        save();
        event.target.reset();
        $("#fileName").textContent = "JPG, PNG or WEBP · up to 4 MB";
        showToast("A new memory tucked safely into your gallery. 📸");
      } catch (error) {
        console.error(error);
        showToast("Couldn't save this image. Try a smaller photo.");
      }
    };
    reader.onerror = () => showToast("Sorry, this photo couldn't be read.");
    reader.readAsDataURL(file);
  });
  $("#momentSearch").addEventListener("input", renderMoments);
  $("#momentGallery").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-moment]");
    if (!button) return;
    const item = data.moments.find((m) => m.id === button.dataset.deleteMoment);
    askConfirm(
      "Remove this memory?",
      `“${item?.title || "This memory"}” will be removed from this browser.`,
      () => {
        data.moments = data.moments.filter(
          (m) => m.id !== button.dataset.deleteMoment,
        );
        save();
        showToast("Memory removed.");
      },
    );
  });
  $("#recentMoments").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-moment]");
    if (!button) return;
    const item = data.moments.find((m) => m.id === button.dataset.deleteMoment);
    askConfirm(
      "Remove this memory?",
      `“${item?.title || "This memory"}” will be removed from this browser.`,
      () => {
        data.moments = data.moments.filter(
          (m) => m.id !== button.dataset.deleteMoment,
        );
        save();
        showToast("Memory removed.");
      },
    );
  });

  function renderInterests() {
    $("#interestCount").textContent =
      `${data.interests.length} little ${data.interests.length === 1 ? "thing" : "things"}`;
    const list = $("#interestList");
    if (!data.interests.length) {
      list.innerHTML = `<div class="panel empty-state"><span>✳</span><strong>A bucket list with room for anything</strong><p>Add a shared interest, a tiny challenge, or a dream for someday.</p></div>`;
      return;
    }
    list.innerHTML = [...data.interests]
      .sort((a, b) => Number(a.done) - Number(b.done))
      .map(
        (item) => `
      <article class="interest-item ${item.done ? "done" : ""}"><input class="interest-check" type="checkbox" data-interest-toggle="${escapeHTML(item.id)}" aria-label="Mark ${escapeHTML(item.title)} complete" ${item.done ? "checked" : ""}><div class="interest-item-main"><h3>${escapeHTML(item.title)}</h3>${item.note ? `<p>${escapeHTML(item.note)}</p>` : ""}<span class="interest-type">${escapeHTML(item.type)}</span></div><button class="interest-delete" data-interest-delete="${escapeHTML(item.id)}" aria-label="Delete interest">×</button></article>`,
      )
      .join("");
  }
  $("#interestForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#interestTitle").value.trim();
    if (!title) return;
    data.interests.push({
      id: uid(),
      title,
      type: $("#interestType").value,
      note: $("#interestNote").value.trim(),
      done: false,
    });
    event.target.reset();
    save();
    showToast("Added to your little bucket list! ✳");
  });
  $("#interestList").addEventListener("change", (event) => {
    const input = event.target.closest("[data-interest-toggle]");
    if (!input) return;
    const item = data.interests.find(
      (i) => i.id === input.dataset.interestToggle,
    );
    if (item) {
      item.done = input.checked;
      save();
      showToast(
        item.done
          ? "One little dream, checked off! ✨"
          : "Added back to the list.",
      );
    }
  });
  $("#interestList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-interest-delete]");
    if (!button) return;
    const item = data.interests.find(
      (i) => i.id === button.dataset.interestDelete,
    );
    askConfirm(
      "Remove this little thing?",
      `“${item?.title || "This idea"}” will be removed from your list.`,
      () => {
        data.interests = data.interests.filter(
          (i) => i.id !== button.dataset.interestDelete,
        );
        save();
        showToast("List item removed.");
      },
    );
  });

  function checkReminders() {
    const now = new Date();
    const today = todayISO();
    const upcoming = data.dates
      .filter((d) => d.reminder && d.status === "upcoming" && d.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const due = upcoming.find((d) => {
      const days = Math.round(
        (new Date(`${d.date}T12:00:00`) - new Date(`${today}T12:00:00`)) /
          86400000,
      );
      return days >= 0 && days <= 2;
    });
    if (due) {
      const days = Math.round(
        (new Date(`${due.date}T12:00:00`) - new Date(`${today}T12:00:00`)) /
          86400000,
      );
      showToast(
        days === 0
          ? `♡ Today is your plan: ${due.title}`
          : `♡ Coming up in ${days} day${days === 1 ? "" : "s"}: ${due.title}`,
      );
    }
  }

  $("#modalCancel").addEventListener("click", closeConfirm);
  $("#modalConfirm").addEventListener("click", () => {
    const action = pendingConfirm;
    closeConfirm();
    if (typeof action === "function") action();
  });
  $("#modalBackdrop").addEventListener("click", (event) => {
    if (event.target === $("#modalBackdrop")) closeConfirm();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeConfirm();
      $("#sidebar").classList.remove("open");
    }
  });

  function renderAll() {
    renderCounters();
    renderDates();
    renderMoments();
    renderInterests();
  }
  $("#todayLabel").textContent =
    new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }) + " · just us";
  $("#dateWhen").min = todayISO();
  $("#momentDate").value = todayISO();
  renderAll();
  checkReminders();

  const startupToken = localStorage.getItem(TOKEN_KEY);
  if (startupToken && localStorage.getItem(SESSION_KEY) === "unlocked") {
    syncDataFromServer(startupToken)
      .then(() => renderAll())
      .catch((error) => {
        console.warn("Saved session could not be restored:", error);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
        appShell.hidden = true;
        authScreen.hidden = false;
        authScreen.classList.remove("auth-leaving");
        setAuthMode("login");
        showToast("Please log in again to reconnect your account.");
      });
  }
})();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => {
        console.log("Us, Always: Service Worker registered!");
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  });
}