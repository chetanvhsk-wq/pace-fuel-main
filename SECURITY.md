# Security Policy

## Sensitive Files — Never Commit These

| File | Why |
|---|---|
| `.env` | Contains your Gemini API key |
| `firebase-applet-config.json` | Contains Firebase project credentials |
| `google-services.json` | Android Firebase credentials |
| `android/local.properties` | Local SDK paths |

The `.gitignore` already excludes `.env*` (except `.env.example`). Double-check before every push.

---

## Firebase Security

Firestore rules in `firestore.rules` enforce:
- Users can only read/write their own data (`request.auth.uid == resource.data.userId`)
- All documents require authentication — no unauthenticated writes
- Input validation on required fields and enum values

Always deploy updated rules after changes:

```bash
firebase deploy --only firestore:rules
```

---

## API Keys

- Gemini API key: set via `.env` or the in-app Online Setup modal at runtime
- Never hardcode keys in source files
- Rotate your key if it's accidentally committed — go to [Google AI Studio](https://aistudio.google.com) → Manage Keys

---

## Reporting a Vulnerability

Open a private GitHub Security Advisory on the repo page (Security tab → Advisories → New draft advisory). Don't open a public issue for security bugs.
