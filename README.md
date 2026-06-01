# Chronically Curious

A daily health and pain tracker. Track back pain, sleep, exercise, alcohol, food, screen time, and more — and see correlations over time.

## Deploy to Vercel (free, ~15 minutes)

### Step 1 — Put the code on GitHub

1. Go to **github.com** and sign in (or create a free account)
2. Click the **+** in the top right → **New repository**
3. Name it `chronically-curious`
4. Leave it **Public** (required for free Vercel hosting)
5. Click **Create repository**
6. On the next page, click **uploading an existing file**
7. Drag ALL the files from this folder into the upload area:
   - `index.html`
   - `vite.config.js`
   - `package.json`
   - `vercel.json`
   - `.gitignore`
   - The entire `src/` folder (src/App.jsx and src/main.jsx)
   - The entire `public/` folder (manifest.json, icon-192.png, icon-512.png)
8. Click **Commit changes**

### Step 2 — Deploy on Vercel

1. Go to **vercel.com** and sign in with your GitHub account
2. Click **Add New → Project**
3. Find `chronically-curious` in the list → click **Import**
4. Vercel auto-detects it as a Vite project — don't change anything
5. Click **Deploy**
6. Wait ~60 seconds — you'll get a URL like `chronically-curious.vercel.app` 🎉

### Step 3 — Add to iPhone home screen

1. Open your Vercel URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

It now lives on your home screen and opens full-screen like a native app.

### Step 4 — Share with friends

Just send them your Vercel URL. They open it in Safari, add to home screen, and have their own private copy of the app (data is stored on each person's own phone).

## Making updates

Whenever you want to update the app, upload the new `src/App.jsx` to GitHub (go to the file → click the pencil icon → paste new content → commit). Vercel automatically redeploys within 30 seconds.
