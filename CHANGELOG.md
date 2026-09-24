# Changelog

All notable changes to Naija DevKit are documented here.

## [0.0.1] — 2026-09-24

Initial public release for the Africoders Hackathon / Challenge.

### Added

- Mobile-first code editor and developer workspace
- HTML, CSS, JavaScript, TypeScript, Python, Markdown, JSON, and text file support
- Local file storage with IndexedDB
- Create, import, search, rename, download, share, and organize files
- Folder support and long-press file actions on mobile
- HTML preview in a sandboxed iframe
- Markdown preview
- Mobile helper chips for common code and Markdown syntax
- File filters and recent-file navigation
- JSON export/import backup and restore
- Snippets tool
- Regex tester
- JSON formatter and minifier
- Scratch HTML runner
- PWA installation through the Web App Manifest
- Service Worker caching and offline navigation fallback
- Optional Gemini AI assistant experiment, under development

### Notes

- The core editor, local file tools, previews, and backup workflow are designed to work without a network connection.
- The AI assistant is experimental and requires a configured Gemini API key and network access when used.
- Browser storage can be affected by device storage pressure, so users should export backups for important work.
- This release is an early foundation. Future releases will focus on production hardening, stronger project workflows, and the extensions engine.

[0.0.1]: https://github.com/aydanmoussa74-a11y/naija-devkit/releases/tag/v0.0.1
