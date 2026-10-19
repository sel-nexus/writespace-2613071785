# WriteSpace

A browser-local blogging demo built with React 18, Vite 5, JavaScript JSX, React Router 6 and Tailwind CSS 3. Public discovery, registration/login, plain-text posts, ownership-aware controls, an administrator dashboard and account management are included.

## Important: demo only

**Never use real passwords or sensitive data.** Passwords are intentionally stored in plaintext in `localStorage`; the built-in administrator is **admin / admin**. Client-side guards are not a security boundary. Anyone with browser developer tools can change local data. This is not a secure or shared multi-user publishing service.

Accounts, posts and sessions live only in the current browser and origin under `writespace_users`, `writespace_posts`, and `writespace_session`. They do not synchronize across devices. Clearing site data removes local records. No backend, API, server database, encryption, recovery service or external authentication is present.

## Run locally

Requires Node.js 20+ and npm. The deployable project is `frontend/`.

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev
```

Defaults: development host `127.0.0.1`, port `5173`; preview port `4173`; test port `5174`. Override `DEV_HOST`, `DEV_PORT`, `PREVIEW_HOST`, `PREVIEW_PORT`, `TEST_HOST`, and `TEST_PORT` using the environment or tier `.env`. These are tooling settings, not secrets or runtime configuration for the built static bundle.

```sh
npm run build
npm run preview
```

`frontend/dist/` is the production static output. No network API configuration is needed.

## Workflows

- Guests can view the landing page and latest three previews, register, or log in. Full readers require a session.
- Registration always creates a `user`; usernames are unique case-insensitively and `admin` is reserved. Login checks the built-in administrator first.
- All signed-in accounts can read and create posts. Ordinary users can edit/delete only their own; administrators can manage all posts.
- Cancel returns to the previous in-app page; direct editor entries fall back to the reader or blog list without saving.
- Administrators can create either account role and delete permitted accounts. Built-in and currently active accounts cannot be deleted. Account deletion retains authored posts.
- The dashboard retains the source's duplicate `Total Users` / `Total users` labels with identical account counts and an explicit clarification. Counts include the built-in administrator.
- Malformed storage reads render safe empty states. Failed writes show errors rather than pretend to persist. If account storage succeeds but session storage fails, registration reports that the account was saved and Login can be retried.

## Verification

```sh
cd frontend
npm test
node node_modules/@playwright/test/cli.js install chromium
# On a minimal Linux host, install Playwright's OS dependencies as well.
npm run test:e2e
npm run build
```

Vitest: **311 tests passed** across identity (103), discovery (84), posts (66), and administration (58). Playwright: **48 desktop/mobile cases verified**; the first full run passed 46 and exposed two viewport-specific test selectors. Corrected identity selectors then passed all 8 identity cases; the other 40 cases were unchanged and had passed. Browser console/page errors fail the shared fixture. E2E starts its own Vite test server on the configured test port.

Independent read-only test review: PASS, score 1.00, zero high-severity failures, round 3. Production Vite build passed. API and backend integration layers are inapplicable. Native browser storage-denial policy was not exercised; unit tests simulate access/quota failures, while browser tests exercise real malformed storage. Vercel cloud deployment and Docker image execution were not performed in this stage.

## Static deployment

### Vercel

Import this repository and select **Root Directory: frontend**, framework Vite, build `npm run build`, output `dist`. `frontend/vercel.json` contains only the required history rewrite. The repository-root copy retains the same rewrite-only contract; it does not configure a root-level build. Direct URLs such as `/blogs`, `/write` and `/users` must resolve to `index.html`.

### Other static hosts / nginx

Serve `frontend/dist` and rewrite unknown paths to `index.html`. `frontend/nginx.conf` provides this fallback without a phantom backend proxy.

```sh
docker build -t writespace ./frontend
docker run --rm -p 8080:80 writespace
```

The Dockerfile builds with Node and serves the bundle with nginx. Container configuration is provided; container execution was not verified here. Liveness is serving `/`; the nginx configuration additionally exposes `/healthz`.

## Source organization

`frontend/src/pages/` contains route pages; `components/` contains navigation, role avatars, cards and guards; `utils/` contains storage, identity, post and account behavior. Tests are feature-grouped under `frontend/tests/` and `frontend/e2e/`. Only React state/effect hooks are used for state; no Context or external state manager is added.

## Design and upstream notes

The canonical WriteSpace PRD was the only design input; HLD/LLD were unavailable, so architecture decisions were labeled inferred in the stage plan. The full-page indigo/violet/pink gradient requested by the PRD is deliberately omitted to comply with the development-stage UI rule. Brand control colors, role emojis, exact empty/error messages, Tailwind-only styling and the static-local contract remain. Preflight screenshots and text-based HTML/accessibility/style captures are saved under `frontend/preflight/` for review.
