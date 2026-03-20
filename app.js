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

const createGameForm = document.getElementById("createGameForm");
const gameLabelInput = document.getElementById("gameLabelInput");
const opponentInput = document.getElementById("opponentInput");
const ourScoreInput = document.getElementById("ourScoreInput");
const opponentScoreInput = document.getElementById("opponentScoreInput");
const tryScorersSelect = document.getElementById("tryScorersSelect");
const gamesList = document.getElementById("gamesList");

const reportsContent = document.getElementById("reportsContent");

const tabButtons = [...document.querySelectorAll(".tab-button")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];

let currentUserRole = "player";
let players = [];
let games = [];
let votes = [];

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
  const isCoachOnly = currentUserRole === "coach";
  const playersTabButton = tabButtons.find((btn) => btn.dataset.tab === "playersTab");
  const gamesTabButton = tabButtons.find((btn) => btn.dataset.tab === "gamesTab");
  const reportsTabButton = tabButtons.find((btn) => btn.dataset.tab === "reportsTab");

  playersTabButton.classList.toggle("hidden", !canManage);
  gamesTabButton.classList.toggle("hidden", !canManage);
  reportsTabButton.classList.toggle("hidden", !isCoachOnly);

  addPlayerForm.classList.toggle("hidden", !canManage);
  createGameForm.classList.toggle("hidden", !canManage);
}

function openTab(tabId) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function setMultiSelectOptions(selectEl, allPlayers) {
  selectEl.innerHTML = allPlayers
    .map((player) => `<option value="${player.name}">${player.name}</option>`)
    .join("");
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
      item.appendChild(actions);
    }
    gamesList.appendChild(item);
  });
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
  setMultiSelectOptions(tryScorersSelect, players);
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
  if (currentUserRole !== "coach") {
    reportsContent.innerHTML = '<p class="muted">Reports are visible to coach role only.</p>';
    return;
  }

  const bfTotals = {};
  const ppTotals = {};
  const playerGameStats = {};
  const votesByGame = {};

  players.forEach((player) => {
    bfTotals[player.name] = 0;
    ppTotals[player.name] = 0;
    playerGameStats[player.name] = { tries: 0, gamesWithVotes: 0 };
  });

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
  const ppRows = Object.entries(ppTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => `<li>${name}: ${total}</li>`)
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
    .map(([name, stats]) => `<li>${name}: tries ${stats.tries}, BF appearances ${stats.gamesWithVotes}</li>`)
    .join("");

  reportsContent.innerHTML = `
    <div class="report-grid">
      <div class="report-card">
        <h4>Best & Fairest leaderboard</h4>
        <ol>${bfRows || "<li>No votes yet.</li>"}</ol>
      </div>
      <div class="report-card">
        <h4>Players' Player tallies</h4>
        <ol>${ppRows || "<li>No votes yet.</li>"}</ol>
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
    </div>
  `;
}

async function loadVotesForReports() {
  if (currentUserRole !== "coach") {
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

  const selectedTryScorers = [...tryScorersSelect.selectedOptions].map(
    (option) => option.value
  );
  const ourScore = ourScoreInput.value === "" ? null : Number(ourScoreInput.value);
  const opponentScore =
    opponentScoreInput.value === "" ? null : Number(opponentScoreInput.value);

  await addDoc(collection(db, "games"), {
    label,
    gameDate: "",
    kickoffTime: "",
    kickoffOrder: games.length + 100,
    opponent: opponentInput.value.trim(),
    ourScore,
    opponentScore,
    tryScorers: selectedTryScorers,
    createdAt: serverTimestamp(),
  });

  createGameForm.reset();
  await loadGames();
  showMessage(`Created ${label}.`);
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

    voteForm.reset();
    updatePlayerDropdowns();
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
      await ensureLoggedInUserIsPlayer(user);
      setRoleUI();
      openTab("voteTab");
      await loadPlayers();
      await loadGames();
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
  }
});
