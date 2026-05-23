# v30 — Minimal login screen

Single file change.

## What changed

LoginScreen is now a single centered card on a light page:
- Ronnoco logo at the top (centered)
- White card with email + password inputs + Sign in button
- That's it

Removed:
- The two-panel layout (dark navy brand panel on the left)
- "Deal Builder" eyebrow
- "The single source of truth for every machine we sell." headline
- The supporting paragraph about searching/pricing/quoting/POs
- The version stamp at the bottom-left
- "Sign in" eyebrow
- "Welcome back." heading
- "This is an internal Ronnoco tool. Contact your administrator..." footnote

## What's in this bundle
```
src/components/LoginScreen.jsx   # rewritten, ~85 lines (was 133)
```

No DB changes, no env-var changes, no dependency changes.

Drop the file, push, Netlify rebuilds in ~2 minutes.
