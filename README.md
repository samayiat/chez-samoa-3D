# Chez Samoa 3D 🍳

A 3D browser cooking / restaurant game built with React, Vite, Three.js
([@react-three/fiber](https://github.com/pmndrs/react-three-fiber) +
[drei](https://github.com/pmndrs/drei)).

## ▶️ Play now

**https://samayiat.github.io/chez-samoa-3D/**

It's an installable PWA — you can add it to your phone's home screen and it
launches full-screen like a native app (see below).

## 📲 Install on your phone

**Android (Chrome):** open the link above → tap the **⋮** menu → **Install app**
(or **Add to Home screen**). You may also get an automatic "Install" banner.

**iPhone / iPad (Safari):** open the link → tap the **Share** button →
**Add to Home Screen**. (On iOS, installing must be done from Safari — Chrome
on iOS can't install web apps.)

Once installed, tap the chef-hat icon on your home screen to play full-screen.

## 🎮 Controls

| Action           | Keyboard                     | Xbox gamepad              |
| ---------------- | ---------------------------- | ------------------------- |
| Move             | `W` `A` `S` `D` / Arrow keys | Left stick / D-pad        |
| Interact / confirm | `E` or `Space`             | `A`                       |
| Punch            | `J` (or click the 3D scene)  | `X` / `RB` / `RT`         |
| Pause            | `Esc`                        | `Start`                   |
| Mute             | `M`                          | `Back` / `View`           |

On the title & results screens, `A` starts/advances and `B` returns to the title.

Gamepad support uses the standard [Gamepad API](https://developer.mozilla.org/docs/Web/API/Gamepad_API)
mapping — just plug in (or connect over Bluetooth) an Xbox controller and press a
button to wake it. Wired Xbox pads and the Xbox Wireless Controller over Bluetooth
both report the standard mapping in Chrome/Edge.

> Note: movement is stick/keyboard-based, so it plays best on a laptop/desktop or
> with a controller. On-screen touch controls for phones are still a TODO.

## 🛠️ Develop locally

```bash
npm install
npm run dev      # http://localhost:3000/chez-samoa-3D/
npm run build    # production build → dist/
npm run preview  # serve the production build
```

Requires Node.js 20.19+ or 22.12+ (Vite 7).

## 🚀 Deployment

The live site is served from the **`gh-pages`** branch (GitHub Pages). To publish
a new build:

```bash
npm run build
npm run deploy   # builds and force-pushes dist/ to the gh-pages branch
```

The Vite `base` is set to `/chez-samoa-3D/` in [vite.config.ts](vite.config.ts) so
assets resolve correctly under the Pages sub-path. PWA behavior comes from
[`public/manifest.webmanifest`](public/manifest.webmanifest) and the service worker
in [`public/sw.js`](public/sw.js).

> Tip: to switch to fully automated CI deploys, grant the GitHub CLI the `workflow`
> scope (`gh auth refresh -s workflow`) and re-add a GitHub Actions Pages workflow.
