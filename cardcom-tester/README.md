# CardCom tester shell

React + Vite app that creates a Cardcom Low Profile session and embeds the hosted payment page.

This is **not** the Cardcom checkout UI. Static HTML + CSS for Cardcom live in [`../cardcom-hosted/`](../cardcom-hosted/).

- Run the shell: `npm run dev` → http://localhost:5173
- Hosted files (via API): http://localhost:3000/cardcom-hosted/

Do not add JavaScript that reaches into the payment iframe.
