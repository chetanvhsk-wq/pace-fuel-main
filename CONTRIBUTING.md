# Contributing to PaceFuel

Thanks for taking the time to contribute. Here's how to do it cleanly.

---

## Setup

```bash
git clone https://github.com/your-username/pace-fuel.git
cd pace-fuel
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm run dev
```

---

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/description` | `feat/sleep-tracker` |
| Bug fix | `fix/description` | `fix/food-log-crash` |
| Refactor | `refactor/description` | `refactor/ai-service` |
| Docs | `docs/description` | `docs/firestore-schema` |

---

## Commit Messages

Use conventional commits:

```
feat: add AI meditation script generator
fix: resolve step counter reset on app background
refactor: consolidate Gemini API retry logic
docs: update Firebase setup instructions
```

---

## Code Style

- TypeScript strict mode — no `any` unless absolutely unavoidable
- Functional components only, no class components
- Tailwind for styling — no inline `style` objects unless dynamic values require it
- Keep components under ~300 lines; extract sub-components when it grows
- AI calls go through `src/services/aiService.ts` — don't call Gemini directly from pages

---

## Pull Request Checklist

- [ ] `npm run lint` passes (no TS errors)
- [ ] `npm run build` succeeds
- [ ] No hardcoded API keys or Firebase credentials
- [ ] New features are documented in the PR description
- [ ] `.env.example` updated if new env vars are added

---

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/device info
- Any relevant console errors

---

## Questions

Open a Discussion on GitHub — not an issue.
