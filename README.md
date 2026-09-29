# Site QA & Dummy Content Auditor (Chrome Extension)

A Chrome Extension (Manifest V3) built with **React 18**, **TypeScript**, and **Tailwind CSS**. It enables web developers, QA testers, and content teams to detect **Lorem Ipsum dummy text**, **unrendered template variables**, **placeholder images**, and **outdated copyright years** (e.g., copyright 2025 or earlier when the current year is 2026).

---

## Key Features

### 1. Single Page Review (Active Tab)
- Instant one-click scan of the currently open webpage.
- Direct **on-page interactive highlighting** with glowing visual pulse indicators.
- One-click **"Locate"** button that smoothly scrolls the active webpage to the exact element.
- Categorized breakdown: Lorem Ipsum, Outdated Copyrights, Developer Placeholders (`TODO`, `TBD`, `[Company Name]`, `{{ variable }}`), Fictional Contacts, and Placeholder Media (`via.placeholder`, `placehold.co`, etc.).

### 2. Full Site Review (Multi-Page Audit & URL Exclusion)
- **Automatic URL Discovery:** Discovers internal links belonging to the same origin with a single click.
- **URL Exclusion Checklist:** Allows you to review discovered pages and **check/uncheck to exclude any URLs** you do not want to audit (e.g. login, legal archives, admin pages).
- **Manual URL Adder:** Enter specific paths or paste URLs to include in the crawl.
- **Background Crawler:** Fetches and audits pages sequentially with progress tracking and live status.
- **Exportable Reports:** Download the entire site audit report in **CSV** (for spreadsheets / clients) or **JSON** format.

### 3. Copyright & Year Mismatch Engine
- Automatically checks for copyright statements (e.g. `© 2024`, `Copyright 2018-2025`, `&copy; 2025`).
- Evaluates against the current target year (**2026** by default).
- Flags outdated years, empty bracketed years like `© [Year]`, and placeholder notices.

### 4. Chrome Side Panel UI
- Built using the Chrome Side Panel API (`chrome.sidePanel`), so the auditor dashboard stays open alongside the webpage without disappearing when you interact with the page.

---

## How to Install and Run in Chrome

### Step 1: Build the Extension
```bash
npm run build
```
This generates the self-contained Manifest V3 extension inside the `dist/` directory.

### Step 2: Load into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right corner.
3. Click the **Load unpacked** button in the top left.
4. Select the `dist` folder located at:
   ```
   C:\Users\Admin\.gemini\antigravity\scratch\site-qa-scanner-extension\dist
   ```
5. The **Site QA & Dummy Content Auditor** extension is now installed!
6. Click the extension icon in Chrome or pin it to your toolbar to open the Side Panel.

---

## Testing with Demo Fixture
A demo site with intentional QA issues is provided in `demo-site/`:
- `demo-site/index.html`: Contains Lorem Ipsum, placeholder image, fake contact email/phone, and outdated `© 2024` copyright.
- `demo-site/about.html`: Contains `TODO` notes, `{{ executive_title }}` template tags, and outdated `2025` copyright.
- `demo-site/clean.html`: A 100% compliant page with valid `© 2026` copyright.

Run the automated test suite anytime with:
```bash
npm test
```
