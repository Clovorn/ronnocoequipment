# Ronnoco Deal Builder — lead card with Call button

Lead cards on My Deals → Distributor Leads now have a dedicated **Call
button** on the right side of each card. Tapping the button dials the
customer directly without expanding the card. The contact name and
email are still on the left side.

## What changed

Compared to the prior release (which had a small inline phone link):

  - The phone link moved out of the left column and became a prominent
    green button on the right side of the card, sized for fingers
    (44px tall tap target)
  - On desktop/tablet the button shows the phone icon + full number
  - On mobile the button collapses to just the phone icon (to leave
    room for the customer name and email)
  - The email link stays inline on the left (most reps call first; if
    they want to email instead it's still right there)
  - Tap-handling is unchanged: tapping the button dials, tapping
    anywhere else on the card still expands it

## Edge cases

- If the lead has no phone number, the Call button is hidden — the
  card layout just shows the chevron on the right as before
- If the lead has no contact name, the button's accessibility label
  falls back to "Call [business name] at [phone]"
- Keyboard accessibility: Tab focuses the call button independently
  of the card, with a visible green focus ring

## Deploy

The only file that changes is:

    src/components/MyDealsPage.jsx

**Recommended deploy: edit the file directly in GitHub's web UI.**
ZIP uploads keep landing in the repo as binary blobs without being
extracted; the file-edit path is the only one that has worked
reliably.

  1. Navigate to src/components/MyDealsPage.jsx on GitHub
  2. Click the pencil "Edit" icon
  3. Select all in the editor (Cmd-A / Ctrl-A) → Delete
  4. Open MyDealsPage.jsx from this delivery in any text editor
  5. Select all → Copy → Paste into the GitHub editor
  6. Commit straight to main

Netlify rebuilds in ~2 min. Hard-refresh the live app (Cmd-Shift-R)
to clear the service-worker cache and load the new bundle.

## Verification

  1. Log in, go to My Deals → Distributor Leads
  2. Each lead card with a phone number on file shows a green Call
     button on the right
  3. Tap (or click) the button → dialer or Skype opens to the
     customer's number
  4. Tap anywhere else on the card → it still expands normally
  5. Keyboard: Tab onto the card → Tab onto the Call button (focus
     ring visible) → Enter to call

## Build verified locally

Builds clean with `npm install && npm run build` on Vite 5.4:
126 modules, no warnings, bundle hash `index-BxnGvZkP.js`.
