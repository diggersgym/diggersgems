# CloudPlay — Setup Guide

Follow these steps to get your app running. Takes about 20 minutes total.

---

## Step 1 — Get a free GitHub account

1. Go to **github.com** and sign up for a free account
2. Verify your email

---

## Step 2 — Create a new GitHub repository

1. Click the **+** icon → **New repository**
2. Name it `cloudplay` (or anything you like)
3. Set it to **Public**
4. Click **Create repository**

---

## Step 3 — Upload your app files

1. In your new repo, click **uploading an existing file**
2. Drag and drop ALL the files you downloaded (keeping the folder structure):
   ```
   index.html
   manifest.json
   css/style.css
   js/config.js
   js/app.js
   icons/  (see Step 3b)
   ```
3. Click **Commit changes**

### Step 3b — Icons (quick option)

You need two icon images for the home screen icon.
- Create a simple 192×192 PNG and a 512×512 PNG (any image works — can be a music note)
- Name them `icon-192.png` and `icon-512.png`
- Upload them inside an `icons/` folder in your repo

Or skip icons for now — the app works without them, it just won't have a custom icon.

---

## Step 4 — Enable GitHub Pages

1. In your repo, go to **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Select branch: **main**, folder: **/ (root)**
4. Click **Save**
5. Wait ~2 minutes. Your app URL will appear: `https://YOUR-USERNAME.github.io/cloudplay`

---

## Step 5 — Set up Google API credentials

### 5a — Create a Google Cloud project

1. Go to **console.cloud.google.com**
2. Click **Select a project** → **New Project**
3. Name it `CloudPlay` → **Create**

### 5b — Enable Google Drive API

1. Go to **APIs & Services** → **Library**
2. Search for **Google Drive API** → click it → **Enable**

### 5c — Create an API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **API key**
3. Copy the key — this is your `API_KEY`
4. (Optional but recommended) Click **Restrict key** → restrict to Drive API

### 5d — Create an OAuth 2.0 Client ID

1. Click **+ Create Credentials** → **OAuth client ID**
2. If prompted, configure the consent screen first:
   - Choose **External**
   - Fill in app name: `CloudPlay`
   - Add your email as developer contact
   - Save and continue through all steps
3. Back at Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `CloudPlay`
   - Under **Authorised JavaScript origins**, add:
     ```
     https://YOUR-USERNAME.github.io
     ```
   - Click **Create**
4. Copy the **Client ID** — looks like `123456789.apps.googleusercontent.com`

---

## Step 6 — Add your credentials to the app

1. Open `js/config.js` in your GitHub repo (click the file, then the pencil icon to edit)
2. Replace the placeholder values:
   ```javascript
   CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
   API_KEY: 'YOUR_API_KEY_HERE',
   ```
3. Optionally set `ROOT_FOLDER_ID` to a specific Drive folder ID
4. Click **Commit changes**

---

## Step 7 — Add to your iPhone

1. Open **Safari** on your iPhone
2. Go to your GitHub Pages URL: `https://YOUR-USERNAME.github.io/cloudplay`
3. Tap the **Share** button (box with arrow)
4. Tap **Add to Home Screen**
5. Tap **Add**

The app icon will appear on your home screen. Open it and sign in with Google!

---

## Sharing with others

Just send them your GitHub Pages URL. They open it in Safari, sign in with their own Google account, and access their own Drive. Or if you want them to access YOUR Drive, they sign in and you share the folder with them in Google Drive settings.

---

## Troubleshooting

**"Not authorized" error** — Make sure you added your GitHub Pages URL to the OAuth authorized origins

**App loads but shows no files** — Check that your music files are in Google Drive and are in a supported format (mp3, m4a, mp4, etc.)

**Slow loading** — First load scans all of Drive. Set `ROOT_FOLDER_ID` to a specific folder to speed this up significantly.

**Token expired** — Sign out and sign back in
