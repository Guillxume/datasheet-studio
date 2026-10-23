# Storybook

Visual workshop for `@guillxume/ui` components — runs the stories from `src/**/*.stories.@(ts|tsx)`.

## Local development

```bash
pnpm dev
```

Opens at <http://localhost:6006>.

## Testing on a real device (camera, touch input, etc.)

Some components — `<ScannerInput>`'s camera fallback in particular — require a **secure context** (HTTPS or `localhost`) to access browser APIs like `navigator.mediaDevices.getUserMedia`. Hitting Storybook from your phone over the LAN at `http://192.168.x.x:6006` is *not* a secure context, and the camera APIs refuse to load on plain HTTP non-localhost origins. **No permission prompt appears** — the API just isn't reachable.

The Storybook deployed to GitHub Pages is served over HTTPS, so open <https://guillxume.github.io/datasheet-studio/> on the device to try these components there. To test local changes on a device, expose the dev server through any HTTPS tunnel; Vite then needs the tunnel's host in `server.allowedHosts` (`.storybook/main.ts`, `viteFinal`).
