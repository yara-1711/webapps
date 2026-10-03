# My Projects

Small browser apps for books, employees, students, medicines, screen time, gym training, and a SQL demo. Every page stays hidden until you sign in with Google. Saved lists live in Cloud Firestore, one collection per signed-in person.

Google sign-in and Firestore share one Firebase project, `rhea-apps-1711` (the config already used on the employee list).

## Run locally

From this folder:

```bash
python3 -m http.server 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). Sign in on the home page, then open a project. Signing out on any page returns you to the Google sign-in screen.

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/) open project **rhea-apps-1711**.
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

Opening an app copies any older browser-only lists into Firestore once, then deletes those browser copies. New employees, books, students, medicines, screen time, gym logs, and database rows are written only to Firestore.

If Google sign-in says the site is not authorized, add the host (including `yara-1711.github.io` for GitHub Pages) under Authentication → Settings → Authorized domains.
