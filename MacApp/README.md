# AdScope for macOS

This native SwiftUI shell starts the existing local Next.js + Playwright app and displays it in a native macOS window. The scraper, SQLite database, Meta credentials, and saved ads remain local.

From the repository root:

```bash
npm install
./scripts/build-macos-app.sh
open "dist/AdScope.app"
```

The app expects the repository's `node_modules` folder and uses port `3000`. It can also attach to an already-running local server on that port.
