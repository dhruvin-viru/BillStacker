# BillStacker | Invoice & PDF Utility SaaS Platform

BillStacker is a premium SaaS platform built with React, Tailwind CSS, Firebase, Express, and `pdf-lib`. It allows users to generate professional dynamic invoices, track invoice histories with comprehensive dashboard analytics, combine multiple PDFs in a custom merge queue, and compress heavy PDFs for easy emailing.

The codebase is structured to run as a single unified repository, with the React frontend served by Vite and the backend API grouped under `/api` to deploy seamlessly as **Vercel Serverless Functions**.

---

## Key Features

1. **Dashboard & Analytics**:
   - Aggregate KPIs: Total Revenue, Collected, Outstanding, and Overdue balances.
   - Filter, search, and sort past invoices.
   - Dynamic quick actions: Toggle statuses (Paid, Pending, Overdue), Edit invoices, and Delete.
2. **Invoice Builder**:
   - Live interactive A4 sheet preview updating in real time.
   - Custom branding with company logo upload (Firebase Storage with local fallback).
   - Add/remove line items, adjust tax rates, and apply discounts.
   - One-click PDF compilation and download (vector client-side rendering).
3. **Firebase & LocalStorage Sandbox**:
   - Full live Firebase Firestore and Storage support.
   - **Zero-config mock fallback**: If Firebase credentials are not provided, it automatically redirects all data operations to `localStorage` and handles files in base64. The application is 100% functional out of the box.
4. **PDF Merger**:
   - Drag-and-drop staging queue.
   - Reorder queue items (Move Up/Down) before compilation.
   - Merge files on the server using `pdf-lib` and download instantly.
5. **PDF Reducer**:
   - Single-file compression optimizer.
   - Displays exact compression metrics: original size, compressed size, space saved percentage, and bytes freed.

---

## Project Structure

```
invoice-saas/
├── package.json              # Project dependencies & startup scripts
├── vite.config.js            # Frontend React bundler & API proxy configuration
├── tailwind.config.js        # Design tokens & color variables config
├── postcss.config.js         # CSS compiler plugins configuration
├── vercel.json               # Route redirection rules for Vercel Serverless Functions
├── .env                      # Local environment configurations (Firebase credentials)
├── index.html                # App entry document
├── api/                      # Backend Serverless Logic
│   ├── index.js              # Express app & serverless wrapper entrypoint
│   ├── routes.js             # API routes (multer multipart upload + handlers)
│   └── pdf-utils.js          # pdf-lib PDF merging & reduction helpers
└── src/                      # Frontend Client Logic
    ├── main.jsx              # React mounting file
    ├── App.jsx               # Dashboard shell & navigation layout
    ├── index.css             # Tailwind base directives & custom scroll/glass styles
    ├── firebase.js           # Database wrapper with cloud/local fallback detection
    └── components/           # UI and Tab panels
        ├── Dashboard.jsx     # Analytics widgets & history log
        ├── InvoiceBuilder.jsx# Forms + live preview container
        ├── PdfMerger.jsx     # Merge file manager queue
        ├── PdfReducer.jsx    # Compressor stats screen
        └── ui/               # Modular presentation primitives (Buttons, Inputs, Tables, Modals, Toasts)
```

---

## Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (installed automatically with Node)

### Installation
1. Navigate to the project folder:
   ```bash
   cd invoice-saas
   ```
2. Install the node packages:
   ```bash
   npm install
   ```

### Start Development Servers
Run the unified dev script:
```bash
npm run dev
```
This script will concurrently launch two processes:
- **Frontend Vite Client**: Runs on [http://localhost:3000](http://localhost:3000)
- **Backend Express API**: Runs on [http://localhost:5000](http://localhost:5000) (requests to `/api` are automatically proxied from port 3000 to port 5000).

---

## Database Configuration (Firebase)

By default, BillStacker runs in **Sandbox Mode** using `localStorage`. To link your live cloud instance:

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Cloud Firestore** and **Firebase Storage** in your console.
3. Generate a Web App inside your project settings and copy the configuration object.
4. Rename `.env.example` to `.env` and fill in the values:
   ```env
   VITE_FIREBASE_API_KEY=your_copied_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```
5. Restart your development server. BillStacker will automatically detect the variables, initialize Firebase, and save logos to Storage and invoice data to Firestore.

---

## Vercel Deployment

This repository is optimized for Vercel.

1. **Push to GitHub**: Initialize a git repository, commit all files, and push to a remote GitHub repository.
2. **Deploy on Vercel**:
   - Go to [Vercel](https://vercel.com/) and click **Add New Project**.
   - Import your GitHub repository.
   - Under **Build & Development Settings**, Vercel will automatically detect Vite. Leave settings as default.
   - If using Firebase, add the environment variables (`VITE_FIREBASE_API_KEY`, etc.) inside the **Environment Variables** section.
   - Click **Deploy**.
3. **How it Works**:
   - Vercel builds and hosts the static files in `/dist`.
   - Vercel intercepts the `/api/*` requests based on `vercel.json` rewrites and forwards them to `api/index.js` which is executed as a Node.js Serverless Function.
