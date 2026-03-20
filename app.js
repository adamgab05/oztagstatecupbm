import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
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
let gamePublicStats = {};
let userProfiles = [];
let editingGameId = null;
let gameFormTryScorers = [];

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

function setOptions(selectEl, players) {
  const first = '<option value="">Select player...</option>';
  const options = players
    .map(
      (player) =>
        `<option value="${player.name}">${player.name}</option>`
    )
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

  const activeTabButton = tabButtons.find((button) => button.classList.contains("active"));
  if (activeTabButton && activeTabButton.classList.contains("hidden")) {
    openTab("voteTab");
  }
}

function sanitizeFieldKey(value) {
  return value.replace(/[.#$/[\]]/g, "_");
}

async function decrementPlayersPlayerPublicTally(gameId, voteData) {
  const playersPlayerName = voteData?.playersPlayer;
  if (!playersPlayerName || !gameId) {
    return;
  }
  const key = sanitizeFieldKey(playersPlayerName);
  const statRef = doc(db, "gamePublicStats", gameId);
  const statSnapshot = await getDoc(statRef);
  if (!statSnapshot.exists()) {
    return;
  }
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

function hasPasswordProvider(user) {
  return user?.providerData?.some((p) => p.providerId === "password");
}

function hasGoogleProvider(user) {
  return user?.providerData?.some((p) => p.providerId === "google.com");
}

function populateProfileFields(user) {
  profileEmailInput.value = user.email || "";
  const display =
    (user.displayName || "").trim() ||
    (user.email || "").split("@")[0] ||
    "";
  profileDisplayNameInput.value = display;

  const pwd = hasPasswordProvider(user);
  const google = hasGoogleProvider(user);
  deleteReauthEmailWrap.classList.toggle("hidden", !pwd);
  deleteReauthGoogleNote.classList.toggle("hidden", !google || pwd);
  deleteAccountPasswordInput.value = "";
}

async function deleteFirestoreDataForUser(uid) {
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
  if (hasPasswordProvider(user) && user.email) {
    const password = deleteAccountPasswordInput.value;
    if (!password) {
      throw new Error("Enter your password to delete your account.");
    }
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return;
  }
  if (hasGoogleProvider(user)) {
    await reauthenticateWithPopup(auth, googleProvider);
    return;
  }
  throw new Error("This account cannot be re-authenticated from this screen.");
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

        await updateDoc(doc(db, "players", player.id), { name: trimmedName });
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
  await decrementPlayersPlayerPublicTally(game.id, voteData);
  await deleteDoc(voteDoc.ref);

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
  return Object.entries(tallies)
    .map(([key, count]) => ({
      name: displayNames[key] || key.replace(/_/g, " "),
      count,
    }))
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
  await setDoc(
    playerRef,
    {
      name: getProfileDisplayName(profile),
      active: true,
      userId: profile.id,
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

async function ensureLoggedInUserIsPlayer(user) {
  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const fullName =
    (profileData.displayName || "").trim() ||
    (user.displayName || "").trim() ||
    (user.email || "").split("@")[0] ||
    "Unknown Player";

  const playerRef = doc(db, "players", user.uid);
  const playerSnapshot = await getDoc(playerRef);
  if (!playerSnapshot.exists()) {
    await setDoc(playerRef, {
      name: fullName,
      active: true,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    return;
  }

  const playerData = playerSnapshot.data();
  if (playerData.name !== fullName) {
    await setDoc(
      playerRef,
      {
        name: fullName,
        active: true,
      },
      { merge: true }
    );
  }
}

async function seedPlayersIfEmpty() {
  return;
}

function getLinkedPlayerUids(playerList) {
  const uids = new Set();
  playerList.forEach((p) => {
    uids.add(p.id);
    if (p.userId) {
      uids.add(p.userId);
    }
  });
  return uids;
}

/**
 * Ensures every Firestore user has a matching players/{uid} doc (coach/admin can write).
 * Fixes users who appear in User Role Manager but never got a roster row (e.g. failed first-login sync).
 */
async function syncMissingPlayersFromUserProfiles() {
  if (!isAtLeastRole("coach")) {
    return;
  }

  const linkedUids = getLinkedPlayerUids(players);
  const usersSnapshot = await getDocs(collection(db, "users"));

  const pending = [];
  usersSnapshot.docs.forEach((userDoc) => {
    const uid = userDoc.id;
    if (linkedUids.has(uid)) {
      return;
    }
    const data = userDoc.data();
    const profile = { id: uid, ...data };
    linkedUids.add(uid);
    pending.push(
      setDoc(
        doc(db, "players", uid),
        {
          name: getProfileDisplayName(profile),
          active: true,
          userId: uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    );
  });

  if (pending.length > 0) {
    await Promise.all(pending);
  }
}

async function loadPlayers() {
  await seedPlayersIfEmpty();
  let snapshot = await getDocs(collection(db, "players"));
  players = snapshot.docs
    .map((entry) => ({
      id: entry.id,
      ...entry.data(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  await syncMissingPlayersFromUserProfiles();

  snapshot = await getDocs(collection(db, "players"));
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

async function loadGames() {
  await seedGamesIfEmpty();
  await ensureScheduledGames();
  const snapshot = await getDocs(collection(db, "games"));
  games = snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data(),
  }))
  .sort((a, b) => (a.kickoffOrder || 999) - (b.kickoffOrder || 999));

  voteGameSelect.innerHTML = `<option value="">Select a game...</option>${games
    .map((game) => `<option value="${game.id}">${game.label}</option>`)
    .join("")}`;

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
        bfTotals[bf.threePoints] = (bfTotals[bf.threePoints] || 0) + 3;
        playerGameStats[bf.threePoints] = playerGameStats[bf.threePoints] || { tries: 0, gamesWithVotes: 0 };
        playerGameStats[bf.threePoints].gamesWithVotes += 1;
      }
      if (bf.twoPoints) {
        bfTotals[bf.twoPoints] = (bfTotals[bf.twoPoints] || 0) + 2;
        playerGameStats[bf.twoPoints] = playerGameStats[bf.twoPoints] || { tries: 0, gamesWithVotes: 0 };
        playerGameStats[bf.twoPoints].gamesWithVotes += 1;
      }
      if (bf.onePoint) {
        bfTotals[bf.onePoint] = (bfTotals[bf.onePoint] || 0) + 1;
        playerGameStats[bf.onePoint] = playerGameStats[bf.onePoint] || { tries: 0, gamesWithVotes: 0 };
        playerGameStats[bf.onePoint].gamesWithVotes += 1;
      }
      if (vote.playersPlayer) {
        ppTotals[vote.playersPlayer] = (ppTotals[vote.playersPlayer] || 0) + 1;
      }
      votesByGame[vote.gameId] = (votesByGame[vote.gameId] || 0) + 1;
    });
  } else {
    Object.values(gamePublicStats).forEach((stats) => {
      const tallies = stats.playersPlayerTallies || {};
      const displayNames = stats.displayNames || {};
      Object.entries(tallies).forEach(([key, value]) => {
        const name = displayNames[key] || key.replace(/_/g, " ");
        ppTotals[name] = (ppTotals[name] || 0) + Number(value || 0);
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
      if (!playerGameStats[name]) {
        playerGameStats[name] = { tries: 0, gamesWithVotes: 0 };
      }
      playerGameStats[name].tries += 1;
    });
  });

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
  const ppRows = Object.entries(ppTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => `<li>${name}: ${total}</li>`)
    .join("");
  const sortedPpEntries = Object.entries(ppTotals).sort((a, b) => b[1] - a[1]);
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
        <h4>Best & Fairest leaderboard</h4>
        <ol>${bfRows || "<li>No votes yet.</li>"}</ol>
      </div>
      <div class="report-card">
        <h4>Best & Fairest graph</h4>
        <div class="chart">${bfChartRows || "<p class='muted'>No votes yet.</p>"}</div>
      </div>` : ""}
      <div class="report-card">
        <h4>Players' Player tallies</h4>
        <ol>${ppRows || "<li>No votes yet.</li>"}</ol>
      </div>
      <div class="report-card">
        <h4>Players' Player graph</h4>
        <div class="chart">${ppChartRows || "<p class='muted'>No votes yet.</p>"}</div>
      </div>
      <div class="report-card">
        <h4>Game scores</h4>
        <ul>${gameRows || "<li>No games yet.</li>"}</ul>
      </div>
      <div class="report-card">
        <h4>Player stats by game</h4>
        <ul>${playerStatsByGameRows || "<li>No game stats yet.</li>"}</ul>
      </div>
      <div class="report-card">
        <h4>Player stats summary</h4>
        <ul>${playerStatRows || "<li>No player stats yet.</li>"}</ul>
      </div>
      <div class="report-card">
        <h4>Try scorers graph</h4>
        <div class="chart">${triesChartRows || "<p class='muted'>No player stats yet.</p>"}</div>
      </div>
    </div>
  `;
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

async function recordPublicPlayersPlayerTally(gameId, playerName) {
  const key = sanitizeFieldKey(playerName);
  const statRef = doc(db, "gamePublicStats", gameId);
  try {
    await updateDoc(statRef, {
      [`playersPlayerTallies.${key}`]: increment(1),
      [`displayNames.${key}`]: playerName,
      totalVotes: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(
      statRef,
      {
        playersPlayerTallies: { [key]: 1 },
        displayNames: { [key]: playerName },
        totalVotes: 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
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

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const user = auth.currentUser;
  if (!user) {
    return;
  }
  const name = profileDisplayNameInput.value.trim();
  if (!name) {
    showMessage("Please enter your full name.", "error");
    return;
  }
  try {
    await updateProfile(user, { displayName: name });
    await setDoc(
      doc(db, "users", user.uid),
      { displayName: name },
      { merge: true }
    );
    await setDoc(
      doc(db, "players", user.uid),
      {
        name,
        active: true,
        userId: user.uid,
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

deleteAccountButton.addEventListener("click", async () => {
  clearMessage();
  const user = auth.currentUser;
  if (!user) {
    return;
  }
  const ok = window.confirm(
    "Delete your account permanently? This cannot be undone. Your votes and profile will be removed."
  );
  if (!ok) {
    return;
  }
  try {
    await reauthenticateForSensitiveAction(user);
    await deleteFirestoreDataForUser(user.uid);
    await deleteUser(user);
    showMessage("Account deleted.");
  } catch (error) {
    const code = error?.code || "";
    if (code === "auth/requires-recent-login") {
      showMessage("Please sign out and sign in again, then try deleting your account.", "error");
    } else {
      showMessage(error.message || String(error), "error");
    }
  }
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
    const existingVote = await getDoc(voteRef);

    if (existingVote.exists()) {
      showMessage(
        "You have already voted for this game. Only one vote per game is allowed.",
        "error"
      );
      return;
    }

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
    updatePlayerDropdowns();
    await loadPublicGameStats();
    showMessage("Vote submitted successfully.");
  } catch (error) {
    showMessage(error.message, "error");
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
      // Non-blocking: voting/games should still load even if player sync fails.
      showMessage(`Player sync warning: ${error.message}`, "error");
    }

    setRoleUI();
    openTab("voteTab");
    populateProfileFields(user);

    try {
      await loadPlayers();
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
    gamePublicStats = {};
    userProfiles = [];
  }
});
