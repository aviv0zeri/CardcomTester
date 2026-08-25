# CardCom tester shell

React + Vite app that creates a Cardcom Low Profile session and embeds the hosted payment page.

This is **not** the Cardcom checkout UI. Paste-ready HTML + CSS live in [`../templates/cardcom/`](../templates/cardcom/).

- Run the shell: `npm run dev` → http://localhost:5173
- Three sections: redirect (full page), iframe-only, either (same files, redirect or iframe overlay)

Do not add JavaScript that reaches into the payment iframe.
