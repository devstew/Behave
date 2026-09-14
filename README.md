# Behave — Firebase setup guide

The Firebase integration is implemented. Behave now uses username/password teacher accounts and stores each teacher's pupils, weekly warnings, dated history, notes, and previous-week report in Cloud Firestore. The React/Vite frontend remains hosted on Vercel. There is no deployed custom backend or Cloud Function.

You still need to create your Firebase project, enable authentication, publish the access rules, configure the web identifiers, create teacher accounts, and redeploy Vercel. Follow the steps below in order.

## 1. Create a free Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Choose **Create a project / Add project**. Name it `Behave` or another name you prefer.
3. Note the **Project ID**, such as `behave-school-12345`. This differs from the project's display name and is used in the commands below.
4. Google Analytics is optional and unnecessary for this app; leaving it disabled simplifies setup.
5. Finish creation and confirm that the project is on **Spark**, the no-cost plan. Keep billing unlinked and do not upgrade to Blaze for this setup.

Only Authentication and Standard Cloud Firestore are needed. Storage, App Hosting, Extensions, and Cloud Functions are not used. [Spark pricing](https://firebase.google.com/pricing) includes no payment method requirement, 1 GiB Firestore storage, 50,000 document reads/day, and 20,000 document writes/day. These quotas are shared by all teachers. Transactions, live listeners, and access-rule lookups consume reads too. Free quotas can interrupt service when exceeded; this is not unlimited hosting.

## 2. Enable password login

1. Open **Build → Authentication → Get started**.
2. In **Sign-in method**, choose **Email/Password**.
3. Enable **Email/Password** and save. Email-link/passwordless sign-in is unnecessary.
4. In **Settings → Authorized domains**, add your actual Vercel hostname, for example `behave-example.vercel.app`, and any custom hostname. Enter hostnames without `https://` or paths. Add `localhost` for local development if absent. Password-only login does not use a redirect, but these are the intended domains for authentication features.

Firebase's password provider requires an email-shaped identifier. Behave maps `teacher_anna` to `teacher_anna@teachers.behave.invalid`. This is an account identifier, not a mailbox. Teachers enter only the username in the login form. No real email, public username directory, or extra backend is required. Forgotten passwords are reset by the administrator using the local tool in step 10. [Firebase password login](https://firebase.google.com/docs/auth/web/password-auth)

Usernames become lowercase, must be 3–32 characters long, start with a Latin letter or digit, and may contain Latin letters, digits, `.`, `_`, and `-`. Dots cannot be consecutive or appear at the end. Examples: `anna`, `teacher_anna`, `teacher.bob`.

## 3. Create Firestore

1. Open **Build → Firestore Database → Create database**.
2. Select **Standard edition**, Native mode if asked, and the default database ID `(default)`.
3. Choose a European region near your teachers, for example Frankfurt (`europe-west3`). The database location is a lasting choice; check it before confirming.
4. Select **Production mode**, which starts with access denied. Do not use open/test-mode rules for pupil data.
5. Complete creation.

## 4. Publish database rules and index exemptions

Open Terminal in the existing Behave folder:

```bash
cd /Users/stevepurzhash/WebstormProjects/Behave
npm install
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your actual project ID. Login opens a browser; select the Google account that owns that project. The CLI is included as a development dependency, so no global installation is necessary. Node.js 24 LTS is recommended for development tools.

Deployment publishes `firestore.rules` and `firestore.indexes.json`. It does not deploy Firebase website hosting or paid functions. Confirm the command reports success, then verify the rules under **Firestore Database → Rules**.

If you prefer console setup, paste the entire `firestore.rules` file into that Rules tab and click **Publish**. Under **Indexes → Single field**, add collection-scope exemptions for collection group `workspaces`, field paths `pupils` and `previousWeekPupils`, disabling their indexes. The CLI handles both tasks more reliably.

The rules require an active, matching `teachers/{UID}` approval document and permit access only to `workspaces/{the same UID}`. Teachers cannot read other teachers' data, list accounts/workspaces, or approve themselves. Any account someone creates through Firebase's public auth API remains unable to access app data without your approval. Setting `active` to boolean `false` blocks subsequent Firestore access immediately. These rules, rather than secrecy of the web API key, protect the data. [Firestore access rules](https://firebase.google.com/docs/firestore/security/get-started)

## 5. Register the web app and configure development

1. Open the gear icon → **Project settings → General**.
2. Under **Your apps**, click the web icon `</>`.
3. Register `Behave web`. Leave Firebase Hosting unchecked because Vercel already hosts the app.
4. Copy `apiKey`, `authDomain`, `projectId`, and `appId` from the displayed `firebaseConfig` object.
5. In your terminal, run:

```bash
cp .env.example .env.local
```

Edit `.env.local`, replacing all placeholders:

```dotenv
VITE_FIREBASE_API_KEY=YOUR_apiKey_VALUE
VITE_FIREBASE_AUTH_DOMAIN=YOUR_authDomain_VALUE
VITE_FIREBASE_PROJECT_ID=YOUR_projectId_VALUE
VITE_FIREBASE_APP_ID=YOUR_appId_VALUE
VITE_USE_FIREBASE_EMULATORS=false
```

The app does not need `storageBucket`, `messagingSenderId`, or `measurementId`. These four web values are public identifiers included in the frontend build. They are different from the private admin credentials below. `.env.local` is ignored by Git. [Firebase web configuration](https://firebase.google.com/docs/projects/learn-more#config-files-objects)

Run `npm run dev` and open the printed URL. Restart the dev server after editing environment variables. When configuration is missing, the app displays a setup screen.

## 6. Download credentials for your local account tool

The admin script runs only on your computer and is not deployed on Vercel.

1. Open **Project settings → Service accounts → Firebase Admin SDK**.
2. Click **Generate new private key** and download the JSON file.
3. Keep it in a private folder outside the repository, such as Downloads. Do not commit it, add it to the frontend, upload it to Vercel, or share it.
4. In the terminal you will use to manage teachers, set:

```bash
export FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/your-downloaded-admin-key.json"
```

Replace the ID and file path. The path must point to the actual downloaded JSON. These exports last for this terminal session; repeat them in a new terminal. They are separate from the frontend's `VITE_FIREBASE_*` variables. [Admin SDK setup](https://firebase.google.com/docs/admin/setup)

The private key grants privileged project access. If exposed, remove that key through Google Cloud's service-account key settings and generate a replacement.

## 7. Create teachers

With the admin variables from step 6 set, run:

```bash
cd /Users/stevepurzhash/WebstormProjects/Behave
npm run teacher -- create teacher_anna "Anna"
npm run teacher -- create teacher_bob "Bob"
```

Each command prompts privately for a password of at least eight characters, then confirmation. Typed passwords are deliberately invisible. Do not include passwords in command arguments or shell history.

The script creates the Firebase Auth account and its approved Firestore profile. Share each teacher's username and initial password privately. Teachers can click **Змінити пароль** in Behave to change it, using their current password. The app does not store readable passwords in Firestore or browser storage.

Verify creation under **Authentication → Users** and **Firestore → Data → teachers → UID**. The approval profile contains `username`, `displayName`, and `active: true`. The teacher's initially empty `workspaces/UID` document is created automatically on first approved login. There is no public signup page.

### Manual account creation alternative

To create accounts without a local admin key, open **Authentication → Users → Add user**. Use `teacher_anna@teachers.behave.invalid` and an initial password. Copy the exact generated UID. In **Firestore → Data**, create collection `teachers` and document ID equal to that UID. Add:

```text
username     string   teacher_anna
displayName  string   Anna
active       boolean  true
```

Do not enter `true` as a string. Repeat per teacher. The profile username must exactly match the lowercase username part of the Auth identifier. The local tool remains the easiest way to reset forgotten passwords while preserving the UID and its data.

## 8. Configure Vercel and redeploy

1. Open the existing Behave project on Vercel → **Settings → Environment Variables**.
2. Add the same four `VITE_FIREBASE_*` keys and real values from `.env.local`, selecting **Production**. Configure Preview only if you intentionally want preview deployments to use this same database.
3. Do not add the private admin JSON, `GOOGLE_APPLICATION_CREDENTIALS`, or the local tool's `FIREBASE_PROJECT_ID`. Do not enable `VITE_USE_FIREBASE_EMULATORS` on Vercel.
4. Commit and push the repository changes using your normal Git workflow, or deploy through your usual Vercel workflow.
5. Redeploy production after saving the variables. Vite reads them at build time, so an existing deployment does not pick up later environment changes.
6. Existing build settings remain **Vite**, build command `npm run build`, output directory `dist`.

[Vite environment variables](https://vite.dev/guide/env-and-mode) · [Vercel environment variables](https://vercel.com/docs/environment-variables)

Stay on the existing free hosting plan if your use meets its terms. Vercel Hobby restricts use to personal, non-commercial projects. [Hobby eligibility](https://vercel.com/docs/plans/hobby)

## 9. Verify and import your old browser data

First verify the setup on your live Vercel URL:

1. Sign in as the first teacher; an empty account is expected.
2. Add a pupil and a warning. Open the note editor, enter a note, and click **Зберегти нотатку**.
3. Wait for **Дані збережені у хмарі ✓**, then refresh. Check the data persists.
4. Sign in as the same teacher on another device and check the same list appears.
5. Sign out, then sign in as a different teacher. Their account must have its own list.
6. Check a wrong password fails.

Old `localStorage` data belongs to a browser/site origin rather than an account. It is never assigned automatically. To import an existing class list:

1. Use the original device, browser profile, and exact hostname where the old app stored it.
2. Sign in to the teacher who should own those records.
3. Before adding any new pupils, use **Імпортувати з цього браузера** in the empty-account import section. Check the displayed username first.
4. Wait for save confirmation and verify the imported pupils, warnings, and notes.

Import is explicit, allowed once per empty account, and refuses to replace an existing cloud list. It leaves the original browser data intact. Data from a different hostname cannot be read by this deployment.

**Завантажити резервну копію** downloads a JSON backup including pupils, history, notes, and the previous-week report. **Імпортувати JSON-файл** restores that backup into an empty account, or accepts the old copied pupil-array JSON format. Save backups privately because they contain pupil data. Clipboard export remains available too.

## 10. Reset, disable, and enable accounts

Set the two admin exports from step 6 in your terminal, then use:

```bash
# Reset a forgotten password; prompts privately and retains the same UID/data.
npm run teacher -- reset teacher_anna

# Immediately block Firestore access without deleting the teacher's data.
npm run teacher -- disable teacher_anna

# Restore the existing disabled account.
npm run teacher -- enable teacher_anna
```

Reset also revokes refresh tokens. Existing ID tokens may remain valid for up to one hour. If immediate access removal is needed, disable the account before resetting it, then enable it afterwards. [Firebase sessions](https://firebase.google.com/docs/auth/admin/manage-sessions)

Do not delete and recreate a teacher to reset a password: a recreated account receives a new UID and will not automatically regain its old workspace. A display name can be changed independently; a username must remain consistent with its Auth identifier.

## Behavior, capacity, and backups

- Each teacher has one workspace document. Edits run in transactions against the latest cloud state, preserving unrelated concurrent edits from other devices.
- Notes remain drafts until **Зберегти нотатку** is pressed. This avoids a write per keystroke. Failed saves retain drafts; save or discard drafts before signing out.
- Pupil data is stored in Firestore, not mirrored into `localStorage`. UI settings remain local. Firebase Auth uses session persistence; use **Вийти** on shared devices.
- An internet connection is required for edits. This app does not implement an offline save queue.
- Dates and Monday boundaries use `Europe/Kyiv`, independent of device timezone. They refresh while the app remains open. Weekly reset happens transactionally on first access/edit in a new week, without a paid scheduled task. Notes and dated history remain. The previous-week report is retained when the last active week was actually the immediately preceding week.
- Small-class capacity: at most 300 pupils/teacher, 120 characters/name, 4,000 characters/note, and a conservative 750 KiB serialized workspace budget beneath Firestore's 1 MiB document limit. Oversized edits/imports fail rather than truncate records. Project-wide daily quotas and storage also apply. [Firestore quotas](https://firebase.google.com/docs/firestore/quotas)
- Backups are manual JSON downloads. No paid automated-backup service is enabled.

## Troubleshooting

| Symptom | Check |
|---|---|
| Setup screen | All four web variables need actual values; restart Vite or rebuild/redeploy Vercel. |
| Wrong login/password | Enter only the username; verify the Auth identifier is exactly `username@teachers.behave.invalid`. |
| Account not activated | `teachers/EXACT_AUTH_UID` must exist, with boolean `active: true` and the correct lowercase username. |
| Permission error | Publish the repository's rules to the correct project and check the approval profile. |
| Empty list after deployment | Explicitly import before adding pupils, using the original browser and hostname. |
| Note missing after refresh | Press **Зберегти нотатку** and wait for confirmation before leaving. |
| Quota error | Inspect **Firestore → Usage**; stay on Spark and wait for reset or reduce usage. |
| Admin credentials error | Set the absolute JSON path in `GOOGLE_APPLICATION_CREDENTIALS` in the same terminal. |
| Username already exists | Manage the existing account instead of recreating it. |
| Emulator cannot find Java | Local rules tests need Java 21+. Hosting and ordinary development do not need Java. |

## Local verification

```bash
npm test
npm run build

# Requires Java 21+. Uses a local demo project, never your live database.
npm run test:rules
```

Tests cover username authentication, teacher isolation, unapproved/disabled access, protected approvals, schema restrictions, concurrent edits/imports, dates, Monday resets, nonnegative warnings, and backup/legacy migration. [Firebase rules testing](https://firebase.google.com/docs/rules/unit-tests)

For a fully local demo, use these `.env.local` values:

```dotenv
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-behave.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-behave
VITE_FIREBASE_APP_ID=demo-behave-web
VITE_USE_FIREBASE_EMULATORS=true
```

Run `npm run emulators` in one terminal and `npm run dev` in another. In the emulator UI at `http://127.0.0.1:4000`, add an Authentication user and matching `teachers/{UID}` approval as described in the manual setup. Emulator data is temporary. Restore real web values and `VITE_USE_FIREBASE_EMULATORS=false` before switching back to real Firebase. Emulator connections are restricted to Vite development mode and unavailable in production builds.
