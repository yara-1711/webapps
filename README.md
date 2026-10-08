# My Projects

Small browser apps for books, employees, students, medicines, screen time, gym training, and a SQL demo. The home page shows the app names and the dashboard next to Google sign-in. Each app’s records stay hidden until you sign in. Saved lists live in Cloud Firestore, one collection per signed-in person.

Google sign-in and Firestore share one Firebase project, `techcoderlabz-project`. That is the project where Cloud Firestore is enabled.

## Run locally

From this folder:

```bash
python3 -m http.server 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The home page shows every app beside Sign in with Google. Phones and computers both open Google in a popup, because a full-page redirect cannot finish on a phone for this site. Allow popups if the browser blocks the window. Signing out returns you to that sign-in screen.

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/) open project **techcoderlabz-project**.
2. Enable **Authentication → Sign-in method → Google**.
3. Under **Authentication → Settings → Authorized domains**, add every host you serve the site from (`localhost` is already allowed).
4. Create a **Cloud Firestore** database.
5. Publish `firestore.rules` so each signed-in user can read and write only `users/{their uid}/...`.

```bash
firebase deploy --only firestore:rules
```

Data is stored at:

- `users/{uid}/books`
- `users/{uid}/employees`
- `users/{uid}/students`
- `users/{uid}/medicines`
- `users/{uid}/screentime`
- `users/{uid}/gymExercises`
- `users/{uid}/gymCalories`
- `users/{uid}/gymDiet`
- `users/{uid}/databaseStudents`

Opening an app deletes older browser-only lists immediately, keeps that copy in memory for the current page, and uploads it to Firestore after Google sign-in. New employees, books, students, medicines, screen time, gym logs, and database rows are written only to Firestore. The Google session itself is the only value these pages leave in browser storage.

If Google sign-in says the site is not authorized, add the host (including `yara-1711.github.io` for GitHub Pages) under Authentication → Settings → Authorized domains.
