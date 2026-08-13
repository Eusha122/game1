# PopQuiz

Mobile-first Firebase quiz maker. Routes:

- `/setquestion` — create a quiz
- `/{username}` — take a quiz
- `/{username}/results` — creator's local dashboard of completed attempts

## Firebase setup

1. Create a Firebase project and enable **Cloud Firestore**.
2. Copy your Web app settings into `firebase-config.js`.
3. Start in development with any static server, or deploy with Firebase Hosting:

   ```sh
   npm install -g firebase-tools
   firebase login
   firebase init hosting firestore
   firebase deploy
   ```

4. Copy `firestore.rules` into the Firestore Rules editor and publish them for this prototype.

The supplied rule is deliberately open so anyone can play and save an attempt. Before a public production release, add Firebase Authentication and owner-only write/read rules.

The creator dashboard uses an owner key stored in the browser that published the quiz. This keeps casual visitors from opening the dashboard; Firebase Auth is required for durable, cross-device dashboard access.
