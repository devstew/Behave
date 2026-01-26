# Behave

A simple, serverless React app to track pupil behavior and weekly warnings. Data is stored locally in the browser using `localStorage`.

## Features
- Add / delete pupils
- Increment / decrement warnings (never below zero)
- Loader splash on first load
- Emoji-rich, red‑toned UI
- LocalStorage persistence (no backend)

## Local setup
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy to Vercel
1. Go to Vercel → Add New → Project
2. Import this GitHub repo
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy

## Tech
- React 18
- Vite 5
