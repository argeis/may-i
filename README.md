# May I Scorer

A small installable web app (PWA) for keeping score in the card game **May I**.
No accounts, no server, works offline once installed. Scores are saved on the phone.

## Rules it uses

| Card | Points |
|---|---|
| Ace | 20 |
| King, Queen, Jack | 10 |
| Joker | 50 |
| 2 to 10 | Face value |

Seven rounds. Lowest total wins.

## Install on your phone

The app is published with GitHub Pages at:

**https://argeis.github.io/may-i/**

(Pages must be enabled once in the repo: Settings → Pages → Source: *GitHub Actions*. The workflow in `.github/workflows/pages.yml` deploys on every push to `main`.)

**iPhone (Safari):** open the link, tap the Share button, then **Add to Home Screen**.

**Android (Chrome):** open the link, tap the three-dot menu, then **Add to Home screen** (or **Install app**).

## Using it

1. Enter player names (2 to 8) and tap **Start game**.
2. After each round, tap the green button at the bottom (or any cell) and tap the cards left in that player's hand. Ace, face cards and Joker are pre-valued; the total updates as you go. Switch to **Type total** to key in a number on the app's own pad instead, or tap **Went out (0)**. **Save & next** moves straight on to the next player, so a whole round can be entered without closing the sheet.
3. Standings update live, lowest at the top. After round 7 the winner is shown.
4. Tap any filled cell to correct a score. Past games are kept under the clock icon.

The round labels (2 sets, 1 set + 1 run, …) are the common May I contracts and are only a reminder; they don't affect scoring.

## Development

Plain HTML, CSS and JavaScript. No build step. Serve the folder with any static server, e.g.

```
python3 -m http.server 8080
```

Bump `CACHE` in `sw.js` when you change files so installed copies pick up the update.
