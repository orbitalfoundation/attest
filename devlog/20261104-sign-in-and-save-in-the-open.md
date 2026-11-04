# Sign in and save, in the open

Anselm (2026-11-04): "i showed attest and people really struggled with 'how do i login?' 'how do
i bookmark something' - they were very confused. my maxim about the tiny hamburger starting folded
seems to be an issue - overall the project was very unclear." Then: "can you fix this, commit,
push, deploy". This session (Claude Fable 5.1, attest room) did the work; screenshots of the live
site before the change are in `~/snap/chromium/common/shots/live-{home,login,tools}.png`.

What the screenshots showed: on a phone the home page is a full-screen hero with a button that
says "Start", the only other way in is the folded ☰, and nothing on the first screen says
"bookmark" or "save". The tools page is titled "save from anywhere" and puts the no-setup route
(paste a link at /save) at the bottom under "Or without a bookmarklet".

Changed:
- `menu.js`, `style.css`: the bar is now visible pills plus the ☰. Signed out: "Sign in". Signed
  in: "@handle" and "Save a page". The ☰ keeps the rest. The login page gets the bar too, with the
  Sign in pill hidden there.
- Home: button reads "Sign in or create account"; the hero is 82svh so "How it works" shows at the
  bottom of the first screen; step 1 is "Create an account", step 2 is "Bookmark as you read" and
  names /save and /tools; a line says what the ☰ holds.
- Login: one line at the top of the card says which button a newcomer wants.
- Tools: titled "bookmark a page"; first section is the paste-a-link route; the Shortcut paragraph
  at the bottom no longer repeats it. The menu, docs hub card and title say "bookmark a page".
- FAQ: opens with "How do I sign in?" and "How do I bookmark a page?".
- Changes page entry.

The maxim itself (floating controls, no header, menu folded) stays; the correction is that the one
or two actions a visitor came for are never folded. Written to harness memory as feedback.
