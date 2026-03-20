# Blue Mountains OzTag State Cup Team Portal

This project is a Firebase-backed site with:

- Google and email/password login
- Role-based access (`player`, `coach`, `admin`)
- Voting page for Best & Fairest (3, 2, 1) and Players' Player
- Player manager page
- Game manager page (score, opponent, try scorers)
- Coach-only reports page (leaderboards and game/player stats)

## 1) Firebase setup

1. Create a Firebase project.
2. In **Authentication**, enable:
   - `Google`
   - `Email/Password`
3. In **Firestore**, create a database.
4. Update `firebase-config.js` with your Firebase web config.
5. Apply the rules in `firestore.rules`.

## 2) Run locally

Use any static server. Example:

```bash
npx serve .
```

Open the local URL shown in your terminal.

## 3) Data model

- `users/{uid}`
  - `email`, `displayName`, `role` (`player` by default)
- `players/{playerId}`
  - `name`, `active`, `createdAt`
- `games/{gameId}`
  - `label`, `opponent`, `ourScore`, `opponentScore`, `tryScorers`, `createdAt`
- `votes/{gameId_uid}`
  - `gameId`, `userId`, `bestAndFairest`, `playersPlayer`, `createdAt`

## 4) Roles

- `player`: can log in and vote.
- `coach`: can manage players/games and view reports.
- `admin`: can manage players/games.

New users are created as `player`. Promote users by editing their `users/{uid}.role`
document in Firestore.

## 5) Notes

- Best & Fairest requires unique selections for 3/2/1 points.
- Users can only vote once per game.
- Reports page is coach-only in the UI and Firestore rules.
