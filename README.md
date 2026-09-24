# Naija DevKit

> A local-first, offline-ready mobile code editor and developer workspace built for low-resource, mobile-first environments.

## Overview

Naija DevKit is a lightweight mobile developer workspace for writing code, managing files, and previewing projects directly from a phone. It is designed for situations where people do not always have a laptop, a stable internet connection, or enough power to rely on heavy developer tools.

The idea came from a simple problem: most dev tools are built for desktop environments and assume a fast, always-on internet connection. In real life, power cuts, unstable data, and limited hardware are normal. I built Naija DevKit to work with those conditions instead of fighting them.

This project is built for Android-first and low-resource workflows. Files stay on the device, the app works offline, and the user can continue writing, previewing, and exporting work without needing to depend on a remote server.

## Problem Statement

Modern developer tools are often heavy, expensive, and built around desktop assumptions. That creates a barrier for young builders, students, and developers in environments where access to a laptop, reliable internet, or stable power is limited.

Naija DevKit tries to change that by making the phone a serious development workspace. It keeps work local, reduces friction, and respects user privacy and bandwidth constraints.

## Demo

![Naija DevKit banner](https://files.catbox.moe/5cxkqn.png)

![Naija DevKit demo GIF](https://files.catbox.moe/jcvlbm.gif)

[Live Demo](https://aydanmoussa74-a11y.github.io/naija-devkit/)

[Real Demo Video](https://files.catbox.moe/tpjebe.mp4)

[Video Ad](https://files.catbox.moe/b21666.mp4)

[Code Screenshot](https://files.catbox.moe/8gcdbw.jpg)

## Key Features

- Mobile-first code editor
- Local file management on-device
- HTML, CSS, JavaScript, Markdown, JSON, and text editing
- Live HTML preview
- Markdown preview
- Offline-first PWA workflow
- IndexedDB-based persistence
- JSON export/import backup system
- Snippets and helper tools
- Regex tools
- JSON prettify/minify tools
- Local scratch runner for HTML
- File filters and workspace organization
- Search across saved files
- Optional AI assistant experiment (Gemini-based, under development)

## Architecture

Naija DevKit is a static browser app rather than a traditional backend-heavy service.

### Main Structure

- `index.html` — landing page
- `app.html` — main mobile workspace shell
- `styles.css` — app styling and mobile layout
- `landing.css` — landing page styling
- `ndk-core.js` — state, file storage, IndexedDB, session logic
- `ndk-ui.js` — screens, navigation, editor UI, workspace UI
- `ndk-more.js` — preview, tools, local backups, AI experiment
- `ndk-patch.js` — folders, long-press actions, mobile input handling
- `sw.js` — offline caching and navigation fallback
- `manifest.json` — PWA metadata and install configuration

### How it works

The app stores files locally using IndexedDB, so the user can keep working without a remote database. The UI is designed around a mobile viewport and touch-friendly interactions. The workspace keeps an editor, file list, preview, and tools in a single app flow without depending on heavy frameworks or external build steps.

## Local-First & Offline-First Philosophy

This project follows a local-first approach:

- files stay on the device
- no server-side storage is required for the main workflow
- the app still works when the network drops
- the app is installable as a PWA
- service worker caching provides a fallback experience
- users can export a backup at any time

This matters because local-first tools are more resilient, more private, and more accessible in places with weak connectivity or limited device resources. For African developers and low-resource environments, this is not just a feature — it is a practical necessity.

## Getting Started

### Prerequisites

- A modern browser such as Chrome, Edge, or Android browser
- A phone or desktop browser to run the app
- Optional: a Gemini API key if you want to test the AI experiment

### PWA Usage

The easiest way to use Naija DevKit is through the live app:

- Open: https://aydanmoussa74-a11y.github.io/naija-devkit/
- In Chrome on Android, tap the browser menu and choose "Install app" or "Add to Home screen"
- Use the installed app like a normal mobile app

### Local Usage

If you want to run it locally:

```bash
git clone https://github.com/aydanmoussa74-a11y/naija-devkit.git
cd naija-devkit
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Running Without a Backend

This project does not require a backend, database, or package install. It is built as a static frontend with local browser storage.

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Storage: IndexedDB
- Offline support: Service Worker
- PWA: Web App Manifest
- Hosting: GitHub Pages
- AI experiment: Gemini API (under development)
- Tools: Browser APIs, local storage, mobile viewport APIs

## Key Challenges

### 1. Storage eviction on mid-range phones

Android Chrome can sometimes clear browser storage when the device is under memory pressure. Because files are stored locally, I had to think carefully about backup and recovery. That is why the project includes an Export/Import JSON backup flow as a safety net.

### 2. Building an IDE in a small mobile viewport

Fitting an editor view, file drawer, preview flow, and action tools into a phone screen without making the interface cluttered was difficult. This required careful use of CSS, viewport-safe sizing, dynamic layout sizing, and mobile-friendly touch interactions.

### 3. Full development cycle from a phone

This project was built and debugged mostly from a mobile-first workflow. That meant planning the architecture carefully, writing the app in a lightweight way, and relying on browser-based tools rather than a full desktop development pipeline.

## Lessons Learned

- Local-first architecture is freedom. It keeps the app working even when the network is weak or unavailable.
- Constraints can lead to better software. Removing heavy dependencies pushed the project toward a lighter, faster, more accessible approach.
- Mobile devices can be serious workspaces. Smartphones are not just consumption devices — they can be practical tools when software is designed around them.
- Simpler systems are easier to trust. A small static PWA with local storage is easier to reason about and far more forgiving in low-resource environments.
- Real-world constraints improve design. When the tool must work without a perfect environment, the product becomes more resilient.

## Future Roadmap

### Short-term

- [ ] Improve file and folder management
- [ ] Better mobile editor polish
- [ ] More developer utilities
- [ ] Better backup and restore flows
- [ ] More language support and syntax handling
- [ ] Improved preview controls
- [ ] Better offline UX messaging

### Medium-term

- [ ] Extensions engine for reusable tools and plugins
- [ ] More project templates
- [ ] Better export/import workflow
- [ ] More local-first automation tools
- [ ] Improved AI helper with safer prompts and local context
- [ ] Better project organization for larger codebases

### Long-term

- [ ] Autonomous coding agent for local workflows
- [ ] Agent-based task execution on-device
- [ ] Deploying agent workflows for preview and publishing
- [ ] End-to-end project generation from prompts
- [ ] Local-first infrastructure for building and testing apps on mobile
- [ ] More advanced developer tooling for AI-assisted coding
- [ ] Optional cloud sync and backup infrastructure
- [ ] Expanded system architecture for mobile-native dev environments

## AI Assistant

The AI assistant in Naija DevKit is currently an experiment under development.

It is not presented as a finished production feature. The current flow uses Gemini when a user adds an API key, but the main app still works as a local-first, offline-capable editor even without AI.

This experimentation is part of the larger long-term vision: a more capable mobile development environment that can assist with code tasks, file understanding, and project workflows while keeping the app lightweight and privacy-aware.

## About Me

My name is Zayd, I’m 15, and I build tools that focus on accessibility, local-first software, and mobile-first developer experiences.

I’m a young builder working on practical software ideas with a strong focus on African realities, low-resource environments, and real-world usability. My GitHub profile is here:

[GitHub](https://github.com/aydanmoussa74-a11y)

## Credits

- Gemini — AI experimentation and prompt/testing workflow
- TrebEdit — mobile code editing workflow support
- Acode — inspiration and mobile coding environment comparison
- GitHub Copilot — coding assistance during the build process
- Canva — banner and visual design support
- Africoders Build Challenge — opportunity and challenge context
- Open-source community and browser/platform tooling

## License

MIT

## Final Note

Naija DevKit is still a work in progress, but the goal is clear: build a real, usable developer workspace that works on phones, respects local-first principles, and makes software development more accessible in low-resource environments.

This project is not trying to be a bloated desktop clone. It is trying to be a useful tool for the reality people actually live in.

---
