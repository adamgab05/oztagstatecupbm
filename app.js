import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  increment,
  query,
  where,
  writeBatch,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const messageSection = document.getElementById("messageSection");
const logoutButton = document.getElementById("logoutButton");
const userRoleBadge = document.getElementById("userRoleBadge");
const siteHeader = document.getElementById("siteHeader");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const googleButton = document.getElementById("googleButton");

const voteForm = document.getElementById("voteForm");
const voteGameSelect = document.getElementById("voteGameSelect");
const bf3 = document.getElementById("bf3");
const bf2 = document.getElementById("bf2");
const bf1 = document.getElementById("bf1");
const playersPlayer = document.getElementById("playersPlayer");

const addPlayerForm = document.getElementById("addPlayerForm");
const playerNameInput = document.getElementById("playerNameInput");
const playersList = document.getElementById("playersList");
const roleManagerSection = document.getElementById("roleManagerSection");
const userRolesList = document.getElementById("userRolesList");
const runMigrationBtn = document.getElementById("runMigrationBtn");

const createGameForm = document.getElementById("createGameForm");
const gameLabelInput = document.getElementById("gameLabelInput");
const gameDateInput = document.getElementById("gameDateInput");
const gameTimeInput = document.getElementById("gameTimeInput");
const opponentInput = document.getElementById("opponentInput");
const ourScoreInput = document.getElementById("ourScoreInput");
const opponentScoreInput = document.getElementById("opponentScoreInput");
const tryScorerPicker = document.getElementById("tryScorerPicker");
const addTryScorerButton = document.getElementById("addTryScorerButton");
const tryScorersList = document.getElementById("tryScorersList");
const saveGameButton = document.getElementById("saveGameButton");
const cancelEditGameButton = document.getElementById("cancelEditGameButton");
const gamesList = document.getElementById("gamesList");
const gamesPublicList = document.getElementById("gamesPublicList");

const reportsContent = document.getElementById("reportsContent");
const rebuildPublicStatsButton = document.getElementById(
  "rebuildPublicStatsButton"
);
const mergeAdamAliasButton = document.getElementById("mergeAdamAliasButton");

const profileForm = document.getElementById("profileForm");
const profileEmailInput = document.getElementById("profileEmail");
const profileDisplayNameInput = document.getElementById("profileDisplayName");
const deleteReauthEmailWrap = document.getElementById("deleteReauthEmail");
const deleteAccountPasswordInput = document.getElementById("deleteAccountPassword");
const deleteReauthGoogleNote = document.getElementById("deleteReauthGoogleNote");
const deleteAccountButton = document.getElementById("deleteAccountButton");

const tabButtons = [...document.querySelectorAll(".tab-button")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];

let currentUserRole = "player";
let players = [];
let games = [];
let votes = [];
let myVotes = []; 
let gamePublicStats = {};
let userProfiles = [];
let editingGameId = null;
let gameFormTryScorers = [];
let emailPrefixCanonicalMap = new Map();

const roleRank = {
  player: 1,
  coach: 2,
  admin: 3,
};

const scheduledFixtures = [
  { label: "Game 1", gameDate: "2026-03-20", kickoffTime: "3:15pm", kickoffOrder: 1 },
  { label: "Game 2", gameDate: "2026-03-20", kickoffTime: "4:45pm", kickoffOrder: 2 },
  { label: "Game 3", gameDate: "2026-03-20", kickoffTime: "6:15pm", kickoffOrder: 3 },
  { label: "Game 4", gameDate: "2026-03-21", kickoffTime: "2:30pm", kickoffOrder: 4 },
  { label: "Game 5", gameDate: "2026-03-21", kickoffTime: "4:00pm", kickoffOrder: 5 },
  { label: "Game 6", gameDate: "2026-03-21", kickoffTime: "5:30pm", kickoffOrder: 6 },
];

function showMessage(text, type = "success") {
  messageSection.textContent = text;
  messageSection.className = `message ${type}`;
  messageSection.classList.remove("hidden");
}

function clearMessage() {
  messageSection.className = "message hidden";
  messageSection.textContent = "";
}

function setAuthenticatedUI(isAuthenticated) {
  authSection.classList.toggle("hidden", isAuthenticated);
  appSection.classList.toggle("hidden", !isAuthenticated);
  logoutButton.classList.toggle("hidden", !isAuthenticated);
  userRoleBadge.classList.toggle("hidden", !isAuthenticated);
  siteHeader.classList.toggle("hidden", !isAuthenticated);
}

function setOptions(selectEl, playersListArray) {
  const first = '<option value="">Select player...</option>';
  const options = playersListArray
    .map((player) => `<option value="${player.name}">${player.name}</option>`)
    .join("");
  selectEl.innerHTML = first + options;
}

function isAtLeastRole(minRole) {
  return roleRank[currentUserRole] >= roleRank[minRole];
}

function setRoleUI() {
  userRoleBadge.textContent = `Role: ${currentUserRole}`;
  const canManage = isAtLeastRole("coach");
  const isAdmin = currentUserRole === "admin";
  
  const playersTabButton = tabButtons.find((btn) => btn.dataset.tab === "playersTab");
  const gamesTabButton = tabButtons.find((btn) => btn.dataset.tab === "gamesTab");
  const reportsTabButton = tabButtons.find((btn) => btn.dataset.tab === "reportsTab");

  playersTabButton.classList.toggle("hidden", !canManage);
  gamesTabButton.classList.toggle("hidden", !canManage);
  reportsTabButton.classList.remove("hidden");

  addPlayerForm.classList.toggle("hidden", !canManage);
  createGameForm.classList.toggle("hidden", !canManage);
  roleManagerSection.classList.toggle("hidden", !isAdmin);
  runMigrationBtn.classList.toggle("hidden", !isAdmin);

  if (rebuildPublicStatsButton) {
    rebuildPublicStatsButton.classList.toggle("hidden", !canManage);
  }
  if (mergeAdamAliasButton) {
    mergeAdamAliasButton.classList.toggle("hidden", !canManage);
  }

  const activeTabButton = tabButtons.find((button) => button.classList.contains("active"));
  if (activeTabButton && activeTabButton.classList.contains("hidden")) {
    openTab("voteTab");
  }
}

function sanitizeFieldKey(value) {
  return value.replace(/[.#$/[\]]/g, "_");
}

function normalizeRole(roleValue) {
  const normalized = String(roleValue || "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "coach" || normalized === "player") {
    return normalized;
  }
  return "player";
}

function getProfileDisplayName(profile) {
  return (profile.displayName || "").trim() || (profile.email || "").split("@")[0] || profile.id;
}

function normalizePersonName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function canonicalizePlayerName(name) {
  const normalized = normalizePersonName(name);
  if (!normalized) return "";

  // Hard alias: collapse common short-name variant.
  // This is needed because votes/tallies sometimes stored the email prefix (e.g. "Adam")
  // rather than the full player label ("Adam Gabriel").
  const adamAliasNorm = normalizePersonName("Adam");
  if (normalized === adamAliasNorm) {
    const adamGabriel = players.find(
      (p) => normalizePersonName(p.name) === normalizePersonName("Adam Gabriel")
    );
    return adamGabriel ? adamGabriel.name : "Adam Gabriel";
  }

  // If we have an email-prefix canonical map (coach/admin), prefer it.
  if (emailPrefixCanonicalMap && emailPrefixCanonicalMap.size > 0) {
    const byEmailPrefix = emailPrefixCanonicalMap.get(normalized);
    if (byEmailPrefix) return byEmailPrefix;
  }

  // Prefer matching email prefix (because duplicates are often stored as the email prefix).
  const emailCandidates = players
    .filter((p) => normalizePersonName(p.emailPrefix) === normalized)
    .map((p) => p.name)
    .filter(Boolean);

  if (emailCandidates.length > 0) {
    // Choose the most "name-like" value (typically the full name has spaces and is longer).
    return emailCandidates.sort((a, b) => String(b).length - String(a).length)[0];
  }

  const byName = players.find(
    (p) => normalizePersonName(p.name) === normalized
  );
  if (byName) return byName.name;

  return String(name).trim();
}

function openTab(tabId) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function setTryScorerPickerOptions(allPlayers) {
  tryScorerPicker.innerHTML = `<option value="">Select player...</option>${allPlayers
    .map((player) => `<option value="${player.name}">${player.name}</option>`)
    .join("")}`;
}

function renderTryScorersList() {
  tryScorersList.innerHTML = "";
  if (gameFormTryScorers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "meta";
    empty.textContent = "No try scorers added.";
    tryScorersList.appendChild(empty);
    return;
  }

  gameFormTryScorers.forEach((name) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `<strong>${name}</strong>`;

    const actions = document.createElement("div");
    actions.className = "list-actions";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn danger small";
    remove.textContent = "- Remove";
    remove.addEventListener("click", () => {
      gameFormTryScorers = gameFormTryScorers.filter((entry) => entry !== name);
      renderTryScorersList();
    });
    actions.appendChild(remove);
    row.appendChild(actions);
    tryScorersList.appendChild(row);
  });
}

function syncTryScorersWithPlayers() {
  const validNames = new Set(players.map((player) => player.name));
  gameFormTryScorers = gameFormTryScorers.filter((name) => validNames.has(name));
  renderTryScorersList();
}

function clearTryScorersFormState() {
  gameFormTryScorers = [];
  tryScorerPicker.value = "";
  renderTryScorersList();
}

function addTryScorerFromPicker() {
  const selectedName = tryScorerPicker.value;
  if (!selectedName) {
    showMessage("Select a player before adding a try scorer.", "error");
    return;
  }
  if (gameFormTryScorers.includes(selectedName)) {
    showMessage("That try scorer has already been added.", "error");
    return;
  }

  gameFormTryScorers.push(selectedName);
  tryScorerPicker.value = "";
  renderTryScorersList();
}

function renderPlayers() {
  playersList.innerHTML = "";
  players.forEach((player) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const info = document.createElement("div");
    info.innerHTML = `<strong>${player.name}</strong><div class="meta">${player.active ? "Active" : "Inactive"}</div>`;
    item.appendChild(info);

    if (isAtLeastRole("coach")) {
      const actions = document.createElement("div");
      actions.className = "list-actions";
      const editButton = document.createElement("button");
      editButton.className = "btn secondary small";
      editButton.textContent = "Edit";
      editButton.type = "button";
      editButton.addEventListener("click", async () => {
        const newName = window.prompt("Update player name:", player.name);
        if (!newName) {
          return;
        }
        const trimmedName = newName.trim();
        if (!trimmedName) {
          showMessage("Player name cannot be empty.", "error");
          return;
        }
        const duplicate = players.some(
          (entry) =>
            entry.id !== player.id &&
            entry.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicate) {
          showMessage("That player name already exists.", "error");
          return;
        }

        // MODIFIED: Update the player collection
        await updateDoc(doc(db, "players", player.id), { name: trimmedName });
        
        // MODIFIED: Simultaneously update the users collection so they stay in perfect sync
        const targetUserId = player.userId || player.id; 
        if (targetUserId) {
          try {
            await setDoc(doc(db, "users", targetUserId), { displayName: trimmedName }, { merge: true });
          } catch (e) {
            // Ignore if the user document doesn't exist yet
          }
        }

        await loadPlayers();
        await loadGames();
        showMessage(`Updated player to ${trimmedName}.`);
      });
      actions.appendChild(editButton);

      const removeButton = document.createElement("button");
      removeButton.className = "btn danger small";
      removeButton.textContent = "Delete";
      removeButton.type = "button";
      removeButton.addEventListener("click", async () => {
        await deleteDoc(doc(db, "players", player.id));
        await loadPlayers();
        await loadGames();
        showMessage(`Removed ${player.name}.`);
      });
      actions.appendChild(removeButton);
      item.appendChild(actions);
    }
    playersList.appendChild(item);
  });
}

function formatGameMeta(game) {
  const ourScore = Number.isInteger(game.ourScore) ? game.ourScore : "-";
  const opponentScore = Number.isInteger(game.opponentScore) ? game.opponentScore : "-";
  const opponent = game.opponent || "TBC";
  const dateTime =
    game.gameDate && game.kickoffTime
      ? `${game.gameDate} ${game.kickoffTime}`
      : "Schedule TBC";
  return `${dateTime} | ${ourScore} - ${opponentScore} vs ${opponent}`;
}

function renderGames() {
  gamesList.innerHTML = "";
  games.forEach((game) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const info = document.createElement("div");
    const tryScorers = Array.isArray(game.tryScorers) ? game.tryScorers.join(", ") : "";
    info.innerHTML = `<strong>${game.label}</strong><div class="meta">${formatGameMeta(game)}${tryScorers ? ` | Try scorers: ${tryScorers}` : ""}</div>`;
    item.appendChild(info);

    if (isAtLeastRole("coach")) {
      const actions = document.createElement("div");
      actions.className = "list-actions";
      const editButton = document.createElement("button");
      editButton.className = "btn secondary small";
      editButton.textContent = "Edit";
      editButton.type = "button";
      editButton.addEventListener("click", () => {
        editingGameId = game.id;
        gameLabelInput.value = game.label || "";
        gameDateInput.value = game.gameDate || "";
        gameTimeInput.value = toTimeInputValue(game.kickoffTime || "");
        opponentInput.value = game.opponent || "";
        ourScoreInput.value =
          Number.isInteger(game.ourScore) ? String(game.ourScore) : "";
        opponentScoreInput.value =
          Number.isInteger(game.opponentScore) ? String(game.opponentScore) : "";

        gameFormTryScorers = [...new Set(game.tryScorers || [])];
        renderTryScorersList();
        tryScorerPicker.value = "";

        saveGameButton.textContent = "Save changes";
        cancelEditGameButton.classList.remove("hidden");
        showMessage(`Editing ${game.label}.`);
      });
      actions.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn danger small";
      deleteButton.textContent = "Delete";
      deleteButton.type = "button";
      deleteButton.addEventListener("click", async () => {
        await deleteDoc(doc(db, "games", game.id));
        await loadGames();
        showMessage(`Deleted ${game.label}.`);
      });
      actions.appendChild(deleteButton);

      if (currentUserRole === "admin") {
        const resetVotesButton = document.createElement("button");
        resetVotesButton.className = "btn secondary small";
        resetVotesButton.textContent = "Reset all votes";
        resetVotesButton.type = "button";
        resetVotesButton.addEventListener("click", async () => {
          const confirmed = window.confirm(
            `Reset all votes for ${game.label}? This cannot be undone.`
          );
          if (!confirmed) {
            return;
          }
          try {
            await resetVotesForGame(game);
            await loadPublicGameStats();
            await loadVotesForReports();
            await loadMyVotes();
            renderVoteGameSelect();
            showMessage(`Votes reset for ${game.label}.`);
          } catch (error) {
            showMessage(`Unable to reset votes: ${error.message}`, "error");
          }
        });
        actions.appendChild(resetVotesButton);

        const resetSingleVoteButton = document.createElement("button");
        resetSingleVoteButton.className = "btn secondary small";
        resetSingleVoteButton.textContent = "Reset user vote";
        resetSingleVoteButton.type = "button";
        resetSingleVoteButton.addEventListener("click", async () => {
          try {
            const userEmail = await pickVoterForGame(game);
            if (!userEmail) {
              return;
            }
            const result = await resetSingleVoteForGame(game, userEmail);
            await loadPublicGameStats();
            await loadVotesForReports();
            await loadMyVotes();
            renderVoteGameSelect();
            if (result.deleted) {
              showMessage(`Vote reset for ${userEmail} in ${game.label}.`);
            } else {
              showMessage(`No vote found for ${userEmail} in ${game.label}.`, "error");
            }
          } catch (error) {
            showMessage(`Unable to reset user vote: ${error.message}`, "error");
          }
        });
        actions.appendChild(resetSingleVoteButton);
      }
      item.appendChild(actions);
    }
    gamesList.appendChild(item);
  });
}

async function resetVotesForGame(game) {
  const voteQuery = query(
    collection(db, "votes"),
    where("gameId", "==", game.id)
  );
  const voteSnapshot = await getDocs(voteQuery);

  if (!voteSnapshot.empty) {
    const batch = writeBatch(db);
    voteSnapshot.docs.forEach((entry) => {
      batch.delete(entry.ref);
    });
    await batch.commit();
  }

  await setDoc(
    doc(db, "gamePublicStats", game.id),
    {
      playersPlayerTallies: {},
      displayNames: {},
      totalVotes: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function resetSingleVoteForGame(game, userEmail) {
  const voteQuery = query(
    collection(db, "votes"),
    where("gameId", "==", game.id),
    where("voterEmail", "==", userEmail)
  );
  const voteSnapshot = await getDocs(voteQuery);
  if (voteSnapshot.empty) {
    return { deleted: false };
  }

  const voteDoc = voteSnapshot.docs[0];
  const voteData = voteDoc.data();
  await deleteDoc(voteDoc.ref);

  const playersPlayerName = voteData.playersPlayer;
  if (playersPlayerName) {
    const key = sanitizeFieldKey(playersPlayerName);
    const statRef = doc(db, "gamePublicStats", game.id);
    const statSnapshot = await getDoc(statRef);
    if (statSnapshot.exists()) {
      const statData = statSnapshot.data();
      const tallies = { ...(statData.playersPlayerTallies || {}) };
      const current = Number(tallies[key] || 0);
      if (current <= 1) {
        delete tallies[key];
      } else {
        tallies[key] = current - 1;
      }
      const totalVotes = Math.max(0, Number(statData.totalVotes || 0) - 1);
      await setDoc(
        statRef,
        {
          playersPlayerTallies: tallies,
          totalVotes,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  return { deleted: true };
}

async function pickVoterForGame(game) {
  const voteQuery = query(
    collection(db, "votes"),
    where("gameId", "==", game.id)
  );
  const voteSnapshot = await getDocs(voteQuery);
  if (voteSnapshot.empty) {
    showMessage(`No votes found for ${game.label}.`, "error");
    return null;
  }

  const voterEmails = [...new Set(
    voteSnapshot.docs
      .map((entry) => (entry.data().voterEmail || "").trim().toLowerCase())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  if (voterEmails.length === 0) {
    showMessage(`No voter emails stored for ${game.label}.`, "error");
    return null;
  }

  return showVoterSelectDialog(game.label, voterEmails);
}

function showVoterSelectDialog(gameLabel, voterEmails) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(10, 20, 30, 0.45)";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.zIndex = "1000";

    const dialog = document.createElement("div");
    dialog.className = "card";
    dialog.style.width = "min(460px, 92vw)";
    dialog.style.margin = "0";
    dialog.innerHTML = `
      <h3 style="margin-top:0;">Reset user vote</h3>
      <p class="muted">Select voter for <strong>${gameLabel}</strong>.</p>
      <label for="resetVoterSelect">Voter</label>
      <select id="resetVoterSelect">
        ${voterEmails.map((email) => `<option value="${email}">${email}</option>`).join("")}
      </select>
      <div class="list-actions" style="margin-top:12px;">
        <button type="button" class="btn secondary" id="cancelResetVoteButton">Cancel</button>
        <button type="button" class="btn danger" id="confirmResetVoteButton">Reset vote</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
    };

    dialog.querySelector("#cancelResetVoteButton").addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    dialog.querySelector("#confirmResetVoteButton").addEventListener("click", () => {
      const selected = dialog.querySelector("#resetVoterSelect").value;
      cleanup();
      resolve(selected || null);
    });
  });
}

function getPlayersPlayerTalliesForGame(gameId) {
  const stats = gamePublicStats[gameId] || {};
  const tallies = stats.playersPlayerTallies || {};
  const displayNames = stats.displayNames || {};

  // Canonicalize names to avoid duplicates caused by whitespace/case differences.
  const merged = {};
  Object.entries(tallies).forEach(([key, count]) => {
    const rawName = displayNames[key] || key.replace(/_/g, " ");
    const canonicalName = canonicalizePlayerName(rawName);
    if (!canonicalName) return;
    merged[canonicalName] = (merged[canonicalName] || 0) + Number(count || 0);
  });

  return Object.entries(merged)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function renderGamesPublic() {
  gamesPublicList.innerHTML = "";
  games.forEach((game) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const tallies = getPlayersPlayerTalliesForGame(game.id);
    const talliesText = tallies.length
      ? tallies.map((entry) => `${entry.name}: ${entry.count}`).join(", ")
      : "No votes yet";
    const tryScorers = Array.isArray(game.tryScorers) ? game.tryScorers.join(", ") : "";
    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${game.label}</strong>
      <div class="meta">${formatGameMeta(game)}</div>
      <div class="meta">Try scorers: ${tryScorers || "None"}</div>
      <div class="meta">Players' Player (anonymous): ${talliesText}</div>
    `;
    item.appendChild(info);
    gamesPublicList.appendChild(item);
  });
}

function renderUserRoles() {
  userRolesList.innerHTML = "";
  if (currentUserRole !== "admin") {
    return;
  }

  userProfiles
    .slice()
    .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""))
    .forEach((profile) => {
      const effectiveRole = normalizeRole(profile.role);
      const item = document.createElement("div");
      item.className = "list-item";
      const info = document.createElement("div");
      const displayName = getProfileDisplayName(profile);
      info.innerHTML = `
        <strong>${displayName}</strong>
        <div class="meta">${profile.email || "No email"} | role: ${effectiveRole}</div>
      `;
      item.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "list-actions";

      const makeCoachButton = document.createElement("button");
      makeCoachButton.className = "btn secondary small";
      makeCoachButton.type = "button";
      makeCoachButton.textContent = "Make coach";
      makeCoachButton.disabled = effectiveRole === "coach";
      makeCoachButton.addEventListener("click", async () => {
        try {
          await setDoc(doc(db, "users", profile.id), { role: "coach" }, { merge: true });
          await ensurePlayerDocFromProfile(profile);
          await loadUserProfiles();
          await loadPlayers();
          showMessage(`${displayName} is now a coach.`);
        } catch (error) {
          showMessage(`Unable to assign coach role: ${error.message}`, "error");
        }
      });

      const makePlayerButton = document.createElement("button");
      makePlayerButton.className = "btn secondary small";
      makePlayerButton.type = "button";
      makePlayerButton.textContent = "Make player";
      makePlayerButton.disabled = effectiveRole === "player";
      makePlayerButton.addEventListener("click", async () => {
        try {
          await setDoc(doc(db, "users", profile.id), { role: "player" }, { merge: true });
          await ensurePlayerDocFromProfile(profile);
          await loadUserProfiles();
          await loadPlayers();
          showMessage(`${displayName} is now a player.`);
        } catch (error) {
          showMessage(`Unable to assign player role: ${error.message}`, "error");
        }
      });

      actions.appendChild(makeCoachButton);
      actions.appendChild(makePlayerButton);
      item.appendChild(actions);
      userRolesList.appendChild(item);
    });
}

async function ensurePlayerDocFromProfile(profile) {
  const playerRef = doc(db, "players", profile.id);
  const emailPrefix =
    (profile.email || "").split("@")[0]?.trim().toLowerCase() || "";
  await setDoc(
    playerRef,
    {
      name: getProfileDisplayName(profile),
      active: true,
      userId: profile.id,
      emailPrefix: emailPrefix || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function resetGameFormMode() {
  editingGameId = null;
  createGameForm.reset();
  clearTryScorersFormState();
  saveGameButton.textContent = "Create game";
  cancelEditGameButton.classList.add("hidden");
}

function toTimeInputValue(kickoffTime) {
  const normalized = kickoffTime.toLowerCase().trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
  if (!match) {
    return "";
  }
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3];

  if (period === "pm" && hour < 12) {
    hour += 12;
  }
  if (period === "am" && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function toDisplayTime(timeValue) {
  if (!timeValue) {
    return "";
  }
  const [h, m] = timeValue.split(":");
  if (h === undefined || m === undefined) {
    return "";
  }
  let hour = Number(h);
  const suffix = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return `${hour}:${m}${suffix}`;
}

async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  const authDisplayName = (user.displayName || "").trim();

  if (!snapshot.exists()) {
    const fallbackName = (user.email || "").split("@")[0] || "Unknown Player";
    await setDoc(userRef, {
      email: user.email || "",
      displayName: authDisplayName || fallbackName,
      role: "player",
      isPlayer: true,
      createdAt: serverTimestamp(),
    });
    currentUserRole = "player";
    return;
  }

  const data = snapshot.data();
  const existingName = (data.displayName || "").trim();
  let resolvedName = existingName || authDisplayName;

  if (!resolvedName) {
    const enteredName = window.prompt("Please enter your full name:");
    resolvedName = (enteredName || "").trim();
  }

  if (!resolvedName) {
    const fallbackName = (user.email || "").split("@")[0] || "Unknown Player";
    resolvedName = fallbackName;
  }

  const updates = {};
  if (data.displayName !== resolvedName) {
    updates.displayName = resolvedName;
  }
  if (data.email !== (user.email || "")) {
    updates.email = user.email || "";
  }
  if (data.isPlayer !== true) {
    updates.isPlayer = true;
  }

  if (Object.keys(updates).length > 0) {
    await setDoc(userRef, updates, { merge: true });
  }

  currentUserRole = data.role || "player";
}

// MODIFIED: Reverses the sync logic to preserve manual edits
async function ensureLoggedInUserIsPlayer(user) {
  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const emailPrefix =
    (user.email || "").split("@")[0]?.trim().toLowerCase() || "";

  const playerRef = doc(db, "players", user.uid);
  const playerSnapshot = await getDoc(playerRef);

  // SCENARIO 1: The user already has a linked player record by their UID.
  if (playerSnapshot.exists()) {
    const playerData = playerSnapshot.data();
    
    // If the coach manually updated the player's name in the Manager, sync that 
    // BACK to the user profile instead of overwriting the player record with the email alias!
    if (playerData.name && playerData.name !== profileData.displayName) {
      await setDoc(profileRef, { displayName: playerData.name }, { merge: true });
    }

    // Ensure emailPrefix is present for email-based canonicalization.
    await setDoc(
      playerRef,
      {
        emailPrefix,
        userId: user.uid,
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  // SCENARIO 2: No player record linked to this UID yet. We need to find or create one.
  const fallbackName =
    (profileData.displayName || "").trim() ||
    (user.displayName || "").trim() ||
    (user.email || "").split("@")[0] ||
    "Unknown Player";

  const playersCol = collection(db, "players");
  const allPlayersSnapshot = await getDocs(playersCol);

  const existingPlayerDoc = allPlayersSnapshot.docs.find(doc => 
    (doc.data().name || "").trim().toLowerCase() === fallbackName.toLowerCase()
  );

  if (existingPlayerDoc) {
    // Link the existing manually created player record to this user's UID
    await updateDoc(existingPlayerDoc.ref, { userId: user.uid, active: true });

    // Also store emailPrefix so future merges are stable.
    if (emailPrefix) {
      await setDoc(
        existingPlayerDoc.ref,
        { emailPrefix, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    
    // Sync the user profile name to match the coach's spelling just to be safe
    if (existingPlayerDoc.data().name !== profileData.displayName) {
      await setDoc(profileRef, { displayName: existingPlayerDoc.data().name }, { merge: true });
    }
  } else {
    // Create a brand new player record
    await setDoc(playerRef, {
      name: fallbackName,
      active: true,
      userId: user.uid,
      emailPrefix: emailPrefix || null,
      createdAt: serverTimestamp(),
    });
  }
}

async function seedPlayersIfEmpty() {
  return;
}

async function loadPlayers() {
  await seedPlayersIfEmpty();
  const snapshot = await getDocs(collection(db, "players"));
  players = snapshot.docs
    .map((entry) => ({
      id: entry.id,
      ...entry.data(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  renderPlayers();
  setTryScorerPickerOptions(players);
  syncTryScorersWithPlayers();
}

async function seedGamesIfEmpty() {
  const gamesSnapshot = await getDocs(collection(db, "games"));
  if (!gamesSnapshot.empty) {
    return;
  }

  for (const fixture of scheduledFixtures) {
    await addDoc(collection(db, "games"), {
      label: fixture.label,
      gameDate: fixture.gameDate,
      kickoffTime: fixture.kickoffTime,
      kickoffOrder: fixture.kickoffOrder,
      opponent: "TBC",
      ourScore: 0,
      opponentScore: 0,
      tryScorers: [],
      createdAt: serverTimestamp(),
    });
  }
}

async function ensureScheduledGames() {
  const snapshot = await getDocs(collection(db, "games"));
  const existingKeys = new Set(
    snapshot.docs.map((entry) => {
      const data = entry.data();
      return `${data.label || ""}|${data.gameDate || ""}|${data.kickoffTime || ""}`;
    })
  );

  for (const fixture of scheduledFixtures) {
    const key = `${fixture.label}|${fixture.gameDate}|${fixture.kickoffTime}`;
    if (existingKeys.has(key)) {
      continue;
    }

    await addDoc(collection(db, "games"), {
      label: fixture.label,
      gameDate: fixture.gameDate,
      kickoffTime: fixture.kickoffTime,
      kickoffOrder: fixture.kickoffOrder,
      opponent: "TBC",
      ourScore: 0,
      opponentScore: 0,
      tryScorers: [],
      createdAt: serverTimestamp(),
    });
  }
}

async function loadMyVotes() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const q = query(collection(db, "votes"), where("userId", "==", user.uid));
    const snapshot = await getDocs(q);
    myVotes = snapshot.docs.map((entry) => entry.data().gameId);
  } catch (error) {
    console.warn("Could not load user votes:", error);
  }
}

function renderVoteGameSelect() {
  const options = games.map((game) => {
    const hasVoted = myVotes.includes(game.id);
    return `<option value="${game.id}" ${hasVoted ? 'disabled' : ''}>${game.label}${hasVoted ? ' (Voted)' : ''}</option>`;
  });
  voteGameSelect.innerHTML = `<option value="">Select a game...</option>${options.join("")}`;
}

async function loadGames() {
  if (isAtLeastRole("coach")) {
    await seedGamesIfEmpty();
    await ensureScheduledGames();
  }
  
  const snapshot = await getDocs(collection(db, "games"));
  games = snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data(),
  }))
  .sort((a, b) => (a.kickoffOrder || 999) - (b.kickoffOrder || 999));

  renderVoteGameSelect();
  renderGames();
}

function updatePlayerDropdowns() {
  const gameId = voteGameSelect.value;
  const selectedGame = games.find((game) => game.id === gameId);
  if (!selectedGame) {
    setOptions(bf3, []);
    setOptions(bf2, []);
    setOptions(bf1, []);
    setOptions(playersPlayer, []);
    return;
  }

  setOptions(bf3, players);
  setOptions(bf2, players);
  setOptions(bf1, players);
  setOptions(playersPlayer, players);
}

function validateVotes(values) {
  const bfChoices = [values.bf3, values.bf2, values.bf1];
  if (bfChoices.some((choice) => !choice)) {
    return "Best & Fairest requires all 3, 2, and 1 point selections.";
  }
  if (new Set(bfChoices).size !== 3) {
    return "Best & Fairest 3/2/1 votes must be for different players.";
  }
  if (!values.playersPlayer) {
    return "Please choose a Players' Player.";
  }
  return null;
}

function renderReports() {
  const canSeeBestAndFairest = isAtLeastRole("coach");

  const bfTotals = {};
  const ppTotals = {};
  const playerGameStats = {};
  const votesByGame = {};

  players.forEach((player) => {
    bfTotals[player.name] = 0;
    ppTotals[player.name] = 0;
    playerGameStats[player.name] = { tries: 0, gamesWithVotes: 0 };
  });

  if (canSeeBestAndFairest) {
    votes.forEach((vote) => {
      const bf = vote.bestAndFairest || {};
      if (bf.threePoints) {
        const canonical = canonicalizePlayerName(bf.threePoints);
        if (!canonical) return;
        bfTotals[canonical] = (bfTotals[canonical] || 0) + 3;
        playerGameStats[canonical] =
          playerGameStats[canonical] || { tries: 0, gamesWithVotes: 0 };
        playerGameStats[canonical].gamesWithVotes += 1;
      }
      if (bf.twoPoints) {
        const canonical = canonicalizePlayerName(bf.twoPoints);
        if (!canonical) return;
        bfTotals[canonical] = (bfTotals[canonical] || 0) + 2;
        playerGameStats[canonical] =
          playerGameStats[canonical] || { tries: 0, gamesWithVotes: 0 };
        playerGameStats[canonical].gamesWithVotes += 1;
      }
      if (bf.onePoint) {
        const canonical = canonicalizePlayerName(bf.onePoint);
        if (!canonical) return;
        bfTotals[canonical] = (bfTotals[canonical] || 0) + 1;
        playerGameStats[canonical] =
          playerGameStats[canonical] || { tries: 0, gamesWithVotes: 0 };
        playerGameStats[canonical].gamesWithVotes += 1;
      }
      if (vote.playersPlayer) {
        const canonical = canonicalizePlayerName(vote.playersPlayer);
        if (!canonical) return;
        ppTotals[canonical] = (ppTotals[canonical] || 0) + 1;
      }
      votesByGame[vote.gameId] = (votesByGame[vote.gameId] || 0) + 1;
    });
  } else {
    Object.values(gamePublicStats).forEach((stats) => {
      const tallies = stats.playersPlayerTallies || {};
      const displayNames = stats.displayNames || {};
      Object.entries(tallies).forEach(([key, value]) => {
        const rawName = displayNames[key] || key.replace(/_/g, " ");
        const canonical = canonicalizePlayerName(rawName);
        if (!canonical) return;
        ppTotals[canonical] = (ppTotals[canonical] || 0) + Number(value || 0);
      });
    });
    games.forEach((game) => {
      votesByGame[game.id] = gamePublicStats[game.id]?.totalVotes || 0;
    });
    players.forEach((player) => {
      playerGameStats[player.name] = playerGameStats[player.name] || { tries: 0, gamesWithVotes: 0 };
    });
  }

  games.forEach((game) => {
    (game.tryScorers || []).forEach((name) => {
      const canonical = canonicalizePlayerName(name);
      if (!canonical) return;
      if (!playerGameStats[canonical]) {
        playerGameStats[canonical] = { tries: 0, gamesWithVotes: 0 };
      }
      playerGameStats[canonical].tries += 1;
    });
  });

  const defaultPpGameId = games[0]?.id || "";

  function renderPpPerGameChart(gameId) {
    const stats = gamePublicStats?.[gameId] || {};
    const tallies = stats.playersPlayerTallies || {};
    const displayNames = stats.displayNames || {};

    const merged = {};
    Object.entries(tallies).forEach(([key, count]) => {
      const rawName = displayNames[key] || key.replace(/_/g, " ");
      const canonical = canonicalizePlayerName(rawName);
      if (!canonical) return;
      merged[canonical] = (merged[canonical] || 0) + Number(count || 0);
    });

    // Ensure the chart includes every player, even if they received 0 votes.
    players.forEach((p) => {
      const canonical = canonicalizePlayerName(p.name);
      if (!canonical) return;
      merged[canonical] = Number(merged[canonical] || 0);
    });

    const entries = Object.entries(merged)
      .map(([name, total]) => ({ name, total: Number(total || 0) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    if (entries.length === 0) {
      return "<p class='muted'>No votes yet.</p>";
    }

    const max = entries[0].total || 1;
    return entries
      .map((e) => {
        const widthPercent = Math.max(
          4,
          Math.round((e.total / max) * 100)
        );
        return `
          <div class="bar-row">
            <span class="bar-label">${e.name}</span>
            <div class="bar-track"><div class="bar-fill accent" style="width:${widthPercent}%"></div></div>
            <span class="bar-value">${e.total}</span>
          </div>
        `;
      })
      .join("");
  }

  const ppPerGameOptionsHtml = games
    .map((g) => `<option value="${g.id}">${g.label}</option>`)
    .join("");

  const bfRows = Object.entries(bfTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, points]) => `<li>${name}: ${points} pts</li>`)
    .join("");
  const sortedBfEntries = Object.entries(bfTotals).sort((a, b) => b[1] - a[1]);
  const maxPoints = sortedBfEntries[0]?.[1] || 1;
  const bfChartRows = sortedBfEntries
    .slice(0, 12)
    .map(([name, points]) => {
      const widthPercent = Math.max(4, Math.round((points / maxPoints) * 100));
      return `
        <div class="bar-row">
          <span class="bar-label">${name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${widthPercent}%"></div></div>
          <span class="bar-value">${points}</span>
        </div>
      `;
    })
    .join("");
  const mergedPpTotals = {};
  Object.entries(ppTotals).forEach(([name, total]) => {
    const canonical = canonicalizePlayerName(name) || String(name || "").trim();
    if (!canonical) return;
    mergedPpTotals[canonical] = (mergedPpTotals[canonical] || 0) + Number(total || 0);
  });

  const ppRows = Object.entries(mergedPpTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => `<li>${name}: ${total}</li>`)
    .join("");

  const sortedPpEntries = Object.entries(mergedPpTotals).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const maxPp = sortedPpEntries[0]?.[1] || 1;
  const ppChartRows = sortedPpEntries
    .slice(0, 12)
    .map(([name, total]) => {
      const widthPercent = Math.max(4, Math.round((total / maxPp) * 100));
      return `
        <div class="bar-row">
          <span class="bar-label">${name}</span>
          <div class="bar-track"><div class="bar-fill accent" style="width:${widthPercent}%"></div></div>
          <span class="bar-value">${total}</span>
        </div>
      `;
    })
    .join("");
  const gameRows = games
    .map((game) => `<li>${game.label} - ${formatGameMeta(game)}</li>`)
    .join("");
  const playerStatsByGameRows = games
    .map((game) => {
      const scorers = (game.tryScorers || []).join(", ") || "None";
      const voteCount = votesByGame[game.id] || 0;
      return `<li>${game.label}: votes ${voteCount}, try scorers ${scorers}</li>`;
    })
    .join("");
  const playerStatRows = Object.entries(playerGameStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, stats]) => {
      const bfText = canSeeBestAndFairest ? `, BF appearances ${stats.gamesWithVotes}` : "";
      return `<li>${name}: tries ${stats.tries}${bfText}</li>`;
    })
    .join("");
  const sortedTries = Object.entries(playerGameStats)
    .sort((a, b) => b[1].tries - a[1].tries)
    .slice(0, 12);
  const maxTries = sortedTries[0]?.[1]?.tries || 1;
  const triesChartRows = sortedTries
    .map(([name, stats]) => {
      const widthPercent = Math.max(4, Math.round((stats.tries / maxTries) * 100));
      return `
        <div class="bar-row">
          <span class="bar-label">${name}</span>
          <div class="bar-track"><div class="bar-fill tries" style="width:${widthPercent}%"></div></div>
          <span class="bar-value">${stats.tries}</span>
        </div>
      `;
    })
    .join("");

  reportsContent.innerHTML = `
    <div class="report-grid">
      ${canSeeBestAndFairest ? `
      <div class="report-card">
        <h4>Best & Fairest graph</h4>
        <div class="chart">${bfChartRows || "<p class='muted'>No votes yet.</p>"}</div>
      </div>` : ""}
      <div class="report-card">
        <h4>Players' Player graph</h4>
        <div class="chart">${ppChartRows || "<p class='muted'>No votes yet.</p>"}</div>
      </div>
      <div class="report-card">
        <h4>Players' Player per game</h4>
        <label for="ppPerGameSelect" class="muted small">Select game</label>
        <select id="ppPerGameSelect" class="select">
          ${ppPerGameOptionsHtml}
        </select>
        <div id="ppPerGameChart" class="chart" style="margin-top:10px;">
          ${renderPpPerGameChart(defaultPpGameId)}
        </div>
      </div>
      <div class="report-card">
        <h4>Try scorers graph</h4>
        <div class="chart">${triesChartRows || "<p class='muted'>No player stats yet.</p>"}</div>
      </div>
    </div>
  `;

  const perGameSelect = document.getElementById("ppPerGameSelect");
  const perGameChart = document.getElementById("ppPerGameChart");
  if (perGameSelect && perGameChart) {
    perGameSelect.addEventListener("change", () => {
      perGameChart.innerHTML = renderPpPerGameChart(perGameSelect.value);
    });
  }
}

function hasPasswordProvider(user) {
  return user?.providerData?.some((p) => p.providerId === "password");
}

function hasGoogleProvider(user) {
  return user?.providerData?.some((p) => p.providerId === "google.com");
}

function populateProfileFields(user) {
  if (!profileEmailInput || !profileDisplayNameInput) return;

  profileEmailInput.value = user.email || "";
  profileDisplayNameInput.value =
    (user.displayName || "").trim() ||
    (user.email || "").split("@")[0] ||
    "";

  if (deleteReauthEmailWrap) {
    deleteReauthEmailWrap.classList.toggle("hidden", !hasPasswordProvider(user));
  }
  if (deleteReauthGoogleNote) {
    deleteReauthGoogleNote.classList.toggle(
      "hidden",
      !hasGoogleProvider(user) || hasPasswordProvider(user)
    );
  }
  if (deleteAccountPasswordInput) {
    deleteAccountPasswordInput.value = "";
  }
}

async function decrementPlayersPlayerPublicTally(gameId, voteData) {
  const playersPlayerName = voteData?.playersPlayer;
  if (!playersPlayerName || !gameId) {
    return;
  }

  const canonicalName = canonicalizePlayerName(playersPlayerName);
  if (!canonicalName) return;
  const key = sanitizeFieldKey(canonicalName);
  const statRef = doc(db, "gamePublicStats", gameId);
  const statSnapshot = await getDoc(statRef);

  if (!statSnapshot.exists()) return;
  const statData = statSnapshot.data();

  const tallies = { ...(statData.playersPlayerTallies || {}) };
  const current = Number(tallies[key] || 0);

  if (current <= 1) {
    delete tallies[key];
  } else {
    tallies[key] = current - 1;
  }

  const totalVotes = Math.max(0, Number(statData.totalVotes || 0) - 1);

  await setDoc(
    statRef,
    {
      playersPlayerTallies: tallies,
      totalVotes,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function deleteFirestoreDataForUser(uid) {
  // Delete all votes made by this user, while keeping the public tallies consistent.
  const voteQuery = query(collection(db, "votes"), where("userId", "==", uid));
  const voteSnapshot = await getDocs(voteQuery);

  for (const voteDoc of voteSnapshot.docs) {
    const data = voteDoc.data();
    await decrementPlayersPlayerPublicTally(data.gameId, data);
    await deleteDoc(voteDoc.ref);
  }

  await deleteDoc(doc(db, "users", uid));
  await deleteDoc(doc(db, "players", uid));
}

async function reauthenticateForSensitiveAction(user) {
  // For password accounts, prompt + reauthenticate with password credential.
  if (hasPasswordProvider(user) && user.email) {
    const password = deleteAccountPasswordInput?.value || "";
    if (!password) {
      throw new Error("Enter your password to delete your account.");
    }
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return;
  }

  // For Google accounts, use the Google popup reauth flow.
  if (hasGoogleProvider(user)) {
    await reauthenticateWithPopup(auth, googleProvider);
    return;
  }

  throw new Error("This account cannot be re-authenticated from this screen.");
}

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const user = auth.currentUser;
    if (!user) return;

    const name = profileDisplayNameInput?.value?.trim() || "";
    if (!name) {
      showMessage("Please enter your full name.", "error");
      return;
    }

    try {
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, "users", user.uid), { displayName: name }, { merge: true });
      await setDoc(
        doc(db, "players", user.uid),
        {
          name,
          active: true,
          userId: user.uid,
          emailPrefix: (user.email || "").split("@")[0]?.trim().toLowerCase() || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await loadPlayers();
      showMessage("Profile saved.");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  if (deleteAccountButton) {
    deleteAccountButton.addEventListener("click", async () => {
      clearMessage();
      const user = auth.currentUser;
      if (!user) return;

      const ok = window.confirm(
        "Delete your account permanently? This cannot be undone. Your votes and profile will be removed."
      );
      if (!ok) return;

      try {
        await reauthenticateForSensitiveAction(user);
        await deleteFirestoreDataForUser(user.uid);
        await deleteUser(user);
        showMessage("Account deleted.");
      } catch (error) {
        const code = error?.code || "";
        if (code === "auth/requires-recent-login") {
          showMessage(
            "Please sign out and sign in again, then try deleting your account.",
            "error"
          );
        } else {
          showMessage(error.message || String(error), "error");
        }
      }
    });
  }
}

async function loadVotesForReports() {
  if (!isAtLeastRole("coach")) {
    votes = [];
    renderReports();
    return;
  }
  const snapshot = await getDocs(collection(db, "votes"));
  votes = snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data(),
  }));
  renderReports();
}

async function loadPublicGameStats() {
  const snapshot = await getDocs(collection(db, "gamePublicStats"));
  gamePublicStats = {};
  snapshot.docs.forEach((entry) => {
    gamePublicStats[entry.id] = entry.data();
  });
  renderGamesPublic();
}

async function loadUserProfiles() {
  if (currentUserRole !== "admin") {
    userProfiles = [];
    renderUserRoles();
    return;
  }

  const snapshot = await getDocs(collection(db, "users"));
  userProfiles = snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data(),
  }));
  renderUserRoles();
}

async function backfillPlayerEmailPrefixes() {
  if (!isAtLeastRole("coach")) return;
  if (!players || players.length === 0) return;

  // Coach/admin can read `users` docs; players cannot.
  const usersSnapshot = await getDocs(collection(db, "users"));
  const prefixByUid = new Map(
    usersSnapshot.docs.map((docEntry) => {
      const data = docEntry.data() || {};
      const prefix = (data.email || "")
        .split("@")[0]
        ?.trim()
        .toLowerCase();
      return [docEntry.id, prefix || ""];
    })
  );

  const updates = [];
  players.forEach((player) => {
    const linkedUid = player.userId || player.id;
    const prefix = prefixByUid.get(linkedUid) || "";
    if (!prefix) return;
    if ((player.emailPrefix || "")?.toLowerCase() === prefix) return;
    updates.push(
      setDoc(
        doc(db, "players", player.id),
        { emailPrefix: prefix, updatedAt: serverTimestamp() },
        { merge: true }
      )
    );
  });

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

async function buildEmailPrefixCanonicalMap() {
  emailPrefixCanonicalMap = new Map();

  if (!isAtLeastRole("coach")) return;
  if (!players || players.length === 0) return;

  const usersSnapshot = await getDocs(collection(db, "users"));
  const users = usersSnapshot.docs.map((docEntry) => ({
    uid: docEntry.id,
    ...(docEntry.data() || {}),
  }));

  users.forEach((user) => {
    const prefix = (user.email || "").split("@")[0]?.trim().toLowerCase();
    const prefixNorm = normalizePersonName(prefix);
    if (!prefixNorm) return;

    // Candidates may exist under different shapes:
    // - linked by userId (normal)
    // - saved as email-prefix string (name == prefix)
    // - have emailPrefix backfilled (emailPrefix == prefix)
    const candidates = players
      .filter((p) => {
        const pNameNorm = normalizePersonName(p.name);
        const pEmailPrefixNorm = normalizePersonName(p.emailPrefix);
        return (
          p.userId === user.uid ||
          p.id === user.uid ||
          pNameNorm === prefixNorm ||
          pEmailPrefixNorm === prefixNorm
        );
      })
      .filter((p) => p.active !== false);

    if (!candidates || candidates.length === 0) return;

    const nonPrefixCandidates = candidates.filter(
      (p) => normalizePersonName(p.name) !== prefixNorm
    );

    const list = nonPrefixCandidates.length > 0 ? nonPrefixCandidates : candidates;
    // Prefer the most "full name-like" label:
    // - more length
    // - if length ties, more spaces
    list.sort((a, b) => {
      const aName = String(a.name || "");
      const bName = String(b.name || "");
      if (bName.length !== aName.length) return bName.length - aName.length;
      const aSpaces = (aName.match(/\s/g) || []).length;
      const bSpaces = (bName.match(/\s/g) || []).length;
      return bSpaces - aSpaces;
    });

    const canonicalName = String(list[0].name || "").trim();
    if (canonicalName) {
      emailPrefixCanonicalMap.set(prefixNorm, canonicalName);
    }
  });
}

async function rebuildGamePublicStatsByEmailPrefix() {
  if (!isAtLeastRole("coach")) return;

  messageSection.className = "message hidden";
  messageSection.textContent = "";
  showMessage("Rebuilding public player tallies (this can take a moment)...", "success");

  await buildEmailPrefixCanonicalMap();

  const votesSnapshot = await getDocs(collection(db, "votes"));

  const aggByGame = new Map();
  votesSnapshot.docs.forEach((voteDoc) => {
    const vote = voteDoc.data() || {};
    const gameId = vote.gameId;
    const rawPlayer = vote.playersPlayer;
    if (!gameId || !rawPlayer) return;

    if (!aggByGame.has(gameId)) {
      aggByGame.set(gameId, {
        playersPlayerTallies: {},
        displayNames: {},
        totalVotes: 0,
      });
    }

    const agg = aggByGame.get(gameId);
    agg.totalVotes = Number(agg.totalVotes || 0) + 1;

    const canonicalName = canonicalizePlayerName(rawPlayer) || String(rawPlayer).trim();
    if (!canonicalName) return;

    const key = sanitizeFieldKey(canonicalName);
    agg.playersPlayerTallies[key] =
      Number(agg.playersPlayerTallies[key] || 0) + 1;
    agg.displayNames[key] = canonicalName;
  });

  // Overwrite each gamePublicStats doc with the rebuilt aggregates.
  const tasks = [];
  aggByGame.forEach((agg, gameId) => {
    tasks.push(
      setDoc(
        doc(db, "gamePublicStats", gameId),
        {
          playersPlayerTallies: agg.playersPlayerTallies,
          displayNames: agg.displayNames,
          totalVotes: agg.totalVotes,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      )
    );
  });

  await Promise.all(tasks);
}

async function autoRebuildPublicStatsOnce() {
  if (!isAtLeastRole("coach")) return;
  if (sessionStorage.getItem("rebuildPublicStatsDone") === "1") return;

  try {
    await rebuildGamePublicStatsByEmailPrefix();
    sessionStorage.setItem("rebuildPublicStatsDone", "1");
  } catch (error) {
    showMessage(`Rebuild failed: ${error.message}`, "error");
  }
}

async function recordPublicPlayersPlayerTally(gameId, playerName) {
  const canonicalName = canonicalizePlayerName(playerName) || "";
  if (!canonicalName) return;
  const key = sanitizeFieldKey(canonicalName);
  const statRef = doc(db, "gamePublicStats", gameId);
  try {
    await updateDoc(statRef, {
      [`playersPlayerTallies.${key}`]: increment(1),
      [`displayNames.${key}`]: canonicalName,
      totalVotes: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(
      statRef,
      {
        playersPlayerTallies: { [key]: 1 },
        displayNames: { [key]: canonicalName },
        totalVotes: 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

async function mergeDuplicatePlayer(primaryName, duplicateName) {
  if (!primaryName || !duplicateName || primaryName === duplicateName) {
    showMessage("Names must be valid and different.", "error");
    return;
  }

  const batch = writeBatch(db);
  console.log(`Starting merge: ${duplicateName} -> ${primaryName}`);

  const normalizeName = (s) => String(s || "").trim().toLowerCase();
  const dupNorm = normalizeName(duplicateName);
  const primaryNorm = normalizeName(primaryName);

  const votesSnapshot = await getDocs(collection(db, "votes"));
  votesSnapshot.docs.forEach((voteDoc) => {
    const data = voteDoc.data() || {};
    let needsUpdate = false;
    const updates = {};

    const three = data.bestAndFairest?.threePoints;
    const two = data.bestAndFairest?.twoPoints;
    const one = data.bestAndFairest?.onePoint;

    if (normalizeName(three) === dupNorm) {
      updates["bestAndFairest.threePoints"] = primaryName;
      needsUpdate = true;
    }
    if (normalizeName(two) === dupNorm) {
      updates["bestAndFairest.twoPoints"] = primaryName;
      needsUpdate = true;
    }
    if (normalizeName(one) === dupNorm) {
      updates["bestAndFairest.onePoint"] = primaryName;
      needsUpdate = true;
    }
    if (normalizeName(data.playersPlayer) === dupNorm) {
      updates.playersPlayer = primaryName;
      needsUpdate = true;
    }

    if (needsUpdate) batch.update(voteDoc.ref, updates);
  });

  const gamesSnapshot = await getDocs(collection(db, "games"));
  gamesSnapshot.docs.forEach((gameDoc) => {
    const gameData = gameDoc.data() || {};
    const tryScorers = Array.isArray(gameData.tryScorers)
      ? gameData.tryScorers
      : [];

    const updatedScorers = tryScorers.map((name) => {
      if (normalizeName(name) === dupNorm) return primaryName;
      return name;
    });

    const changed = updatedScorers.some((name, idx) => {
      const original = tryScorers[idx];
      return normalizeName(original) !== normalizeName(name);
    });

    if (changed) {
      batch.update(gameDoc.ref, {
        tryScorers: [...new Set(updatedScorers)],
      });
    }
  });

  const statsSnapshot = await getDocs(collection(db, "gamePublicStats"));
  const primKey = sanitizeFieldKey(primaryName);

  statsSnapshot.docs.forEach((statDoc) => {
    const statData = statDoc.data() || {};
    const tallies = { ...(statData.playersPlayerTallies || {}) };
    const displayNames = { ...(statData.displayNames || {}) };

    // Find all tally keys whose display name matches the duplicate (after normalization).
    const dupKeysFromDisplay = Object.keys(displayNames).filter(
      (k) => normalizeName(displayNames[k]) === dupNorm
    );

    // Fallback: if displayNames are missing/incomplete, try the direct key derived from the raw input.
    const fallbackDupKey = sanitizeFieldKey(duplicateName);
    const dupKeys =
      dupKeysFromDisplay.length > 0
        ? dupKeysFromDisplay
        : fallbackDupKey in tallies
          ? [fallbackDupKey]
          : [];

    if (dupKeys.length === 0) {
      return;
    }

    let movedVotes = 0;
    dupKeys.forEach((k) => {
      movedVotes += Number(tallies[k] || 0);
      delete tallies[k];
      delete displayNames[k];
    });

    if (!tallies[primKey]) tallies[primKey] = 0;
    tallies[primKey] = Number(tallies[primKey] || 0) + movedVotes;
    displayNames[primKey] = primaryName;

    batch.update(statDoc.ref, {
      playersPlayerTallies: tallies,
      displayNames: displayNames,
    });
  });

  const playersSnapshot = await getDocs(collection(db, "players"));
  playersSnapshot.docs.forEach((playerDoc) => {
    const playerData = playerDoc.data() || {};
    if (normalizeName(playerData.name) === dupNorm) {
      // Avoid deleting the primary if they already share the same name string normalization.
      if (normalizeName(playerData.name) === primaryNorm && primaryName === playerData.name) return;
      batch.delete(playerDoc.ref);
    }
  });

  try {
    await batch.commit();
    showMessage(`Successfully merged ${duplicateName} into ${primaryName}`);
  } catch (error) {
    showMessage(`Batch commit failed: ${error.message}`, "error");
  }
}

runMigrationBtn.addEventListener("click", async () => {
  const primary = window.prompt("Enter the exact name of the player you want to KEEP:");
  if (!primary) return;
  
  const duplicate = window.prompt(`Enter the EXACT name of the duplicate player to merge into "${primary}" and delete:`);
  
  if (primary && duplicate) {
    if (window.confirm(`Are you sure you want to merge "${duplicate}" into "${primary}"? This cannot be undone.`)) {
      await mergeDuplicatePlayer(primary.trim(), duplicate.trim());
      await loadPlayers();
      await loadGames();
      await loadPublicGameStats();
      await loadVotesForReports();
    }
  }
});

if (rebuildPublicStatsButton) {
  rebuildPublicStatsButton.addEventListener("click", async () => {
    clearMessage();
    try {
      await rebuildGamePublicStatsByEmailPrefix();
      sessionStorage.setItem("rebuildPublicStatsDone", "1");
      await loadPublicGameStats();
      await loadVotesForReports();
      showMessage("Public stats rebuilt successfully.");
    } catch (error) {
      showMessage(`Rebuild failed: ${error.message}`, "error");
    }
  });
}

if (mergeAdamAliasButton) {
  mergeAdamAliasButton.addEventListener("click", async () => {
    clearMessage();
    try {
      await mergePublicStatsAlias("Adam Gabriel", "Adam");
      await loadPublicGameStats();
      await loadVotesForReports();
      showMessage("Merged “Adam” into “Adam Gabriel” in public graphs.");
    } catch (error) {
      showMessage(
        `Merge failed: ${error.message || String(error)}`,
        "error"
      );
    }
  });
}

async function mergePublicStatsAlias(primaryName, duplicateName) {
  if (!primaryName || !duplicateName || primaryName === duplicateName) return;

  const primaryNorm = normalizePersonName(primaryName);
  const duplicateNorm = normalizePersonName(duplicateName);

  const statsSnapshot = await getDocs(collection(db, "gamePublicStats"));
  const tasks = [];

  statsSnapshot.docs.forEach((statDoc) => {
    const statData = statDoc.data() || {};
    const tallies = { ...(statData.playersPlayerTallies || {}) };
    const displayNames = { ...(statData.displayNames || {}) };

    // Find tally keys whose display label matches the duplicate.
    const dupKeys = Object.keys(tallies).filter((key) => {
      const label = displayNames[key] || key.replace(/_/g, " ");
      return normalizePersonName(label) === duplicateNorm;
    });

    if (dupKeys.length === 0) return;

    // Find (or create) the primary tally key.
    let primKeys = Object.keys(tallies).filter((key) => {
      const label = displayNames[key] || key.replace(/_/g, " ");
      return normalizePersonName(label) === primaryNorm;
    });
    primKeys = primKeys.length ? primKeys : [];

    const primKey = primKeys.length ? primKeys[0] : sanitizeFieldKey(primaryName);
    const movedTotal = dupKeys.reduce((sum, k) => sum + Number(tallies[k] || 0), 0);

    // Remove duplicate keys.
    dupKeys.forEach((k) => {
      delete tallies[k];
      delete displayNames[k];
    });

    // Add into primary.
    tallies[primKey] = Number(tallies[primKey] || 0) + movedTotal;
    displayNames[primKey] = primaryName;

    tasks.push(
      setDoc(
        statDoc.ref,
        {
          playersPlayerTallies: tallies,
          displayNames,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      )
    );
  });

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("Signed in successfully.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const fullName = document.getElementById("registerFullName").value.trim();
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  if (!fullName) {
    showMessage("Please enter your full name.", "error");
    return;
  }

  try {
    const credentials = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credentials.user, { displayName: fullName });
    showMessage("Account created and signed in.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

googleButton.addEventListener("click", async () => {
  clearMessage();
  try {
    await signInWithPopup(auth, googleProvider);
    showMessage("Signed in with Google.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showMessage("Signed out.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

voteGameSelect.addEventListener("change", () => {
  updatePlayerDropdowns();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openTab(button.dataset.tab);
  });
});

addPlayerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  if (!isAtLeastRole("coach")) {
    showMessage("You do not have permission to manage players.", "error");
    return;
  }

  const name = playerNameInput.value.trim();
  if (!name) {
    showMessage("Player name is required.", "error");
    return;
  }

  const duplicate = players.some(
    (player) => player.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    showMessage("That player already exists.", "error");
    return;
  }

  await addDoc(collection(db, "players"), {
    name,
    active: true,
    createdAt: serverTimestamp(),
  });
  playerNameInput.value = "";
  await loadPlayers();
  showMessage(`Added ${name}.`);
});

createGameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  if (!isAtLeastRole("coach")) {
    showMessage("You do not have permission to manage games.", "error");
    return;
  }

  const label = gameLabelInput.value.trim();
  if (!label) {
    showMessage("Game label is required.", "error");
    return;
  }

  const uniqueTryScorers = [...new Set(gameFormTryScorers)];
  const ourScore = ourScoreInput.value === "" ? null : Number(ourScoreInput.value);
  const opponentScore =
    opponentScoreInput.value === "" ? null : Number(opponentScoreInput.value);
  const gameDate = gameDateInput.value || "";
  const kickoffTime = toDisplayTime(gameTimeInput.value);

  if (editingGameId) {
    await updateDoc(doc(db, "games", editingGameId), {
      label,
      gameDate,
      kickoffTime,
      opponent: opponentInput.value.trim(),
      ourScore,
      opponentScore,
      tryScorers: uniqueTryScorers,
      updatedAt: serverTimestamp(),
    });
    showMessage(`Updated ${label}.`);
  } else {
    await addDoc(collection(db, "games"), {
      label,
      gameDate,
      kickoffTime,
      kickoffOrder: games.length + 100,
      opponent: opponentInput.value.trim(),
      ourScore,
      opponentScore,
      tryScorers: uniqueTryScorers,
      createdAt: serverTimestamp(),
    });
    showMessage(`Created ${label}.`);
  }

  resetGameFormMode();
  await loadGames();
});

cancelEditGameButton.addEventListener("click", () => {
  resetGameFormMode();
  showMessage("Edit cancelled.");
});

addTryScorerButton.addEventListener("click", () => {
  clearMessage();
  addTryScorerFromPicker();
});

voteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const user = auth.currentUser;
  if (!user) {
    showMessage("You must be logged in to vote.", "error");
    return;
  }

  const formValues = {
    gameId: voteGameSelect.value,
    bf3: bf3.value,
    bf2: bf2.value,
    bf1: bf1.value,
    playersPlayer: playersPlayer.value,
  };

  if (!formValues.gameId) {
    showMessage("Please select a game.", "error");
    return;
  }

  const validationError = validateVotes(formValues);
  if (validationError) {
    showMessage(validationError, "error");
    return;
  }

  try {
    const voteDocId = `${formValues.gameId}_${user.uid}`;
    const voteRef = doc(db, "votes", voteDocId);
    
    await setDoc(voteRef, {
      gameId: formValues.gameId,
      userId: user.uid,
      voterEmail: user.email || "",
      bestAndFairest: {
        threePoints: formValues.bf3,
        twoPoints: formValues.bf2,
        onePoint: formValues.bf1,
      },
      playersPlayer: formValues.playersPlayer,
      createdAt: serverTimestamp(),
    });
    await recordPublicPlayersPlayerTally(formValues.gameId, formValues.playersPlayer);

    voteForm.reset();

    myVotes.push(formValues.gameId);
    renderVoteGameSelect();
    updatePlayerDropdowns();

    await loadPublicGameStats();
    showMessage("Vote submitted successfully.");
  } catch (error) {
    if (error.code === 'permission-denied') {
      showMessage(
        "You have already voted for this game. Only one vote per game is allowed.",
        "error"
      );
    } else {
      showMessage(error.message, "error");
    }
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    setAuthenticatedUI(true);
    try {
      await ensureUserProfile(user);
    } catch (error) {
      showMessage(`Unable to sync user profile: ${error.message}`, "error");
    }

    try {
      await ensureLoggedInUserIsPlayer(user);
    } catch (error) {
      showMessage(`Player sync warning: ${error.message}`, "error");
    }

    setRoleUI();
    openTab("voteTab");
    populateProfileFields(user);

    try {
      await loadPlayers();
      await backfillPlayerEmailPrefixes();
      await autoRebuildPublicStatsOnce();
      await loadMyVotes();
      await loadGames();
      await loadPublicGameStats();
      await loadUserProfiles();
      updatePlayerDropdowns();
      await loadVotesForReports();
    } catch (error) {
      showMessage(`Unable to load data: ${error.message}`, "error");
    }
  } else {
    setAuthenticatedUI(false);
    currentUserRole = "player";
    players = [];
    games = [];
    votes = [];
    myVotes = [];
    gamePublicStats = {};
    userProfiles = [];
  }
});
