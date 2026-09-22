# Naija DevKit

Offline-first developer workspace for Android. Vanilla HTML, CSS, and JavaScript. No build step.

Live (after GitHub Pages is enabled on `main`):  
https://aydanmoussa74-a11y.github.io/naija-devkit/

## Enable Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / root
4. Open the URL once online so the service worker can cache the shell

## What is stored where

- Service worker cache: app shell only
- IndexedDB `naija-devkit`: snippets and notes
- `localStorage`: API keys and editor prefs
- Export `naija-devkit-backup.json` for disaster recovery
