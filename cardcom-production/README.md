# Cardcom production template

Paste-ready **static HTML + CSS** for Cardcom’s Low Profile iframe editor.

Cardcom hosts this page and supplies Knockout, wallets, validation, and payment. Do not add JavaScript here.

## Submit to Cardcom

```bash
cardcom_html    # paste into the iframe HTML pane first
cardcom_css     # paste into the CSS pane second
```

HTML first, CSS second. Loading HTML in Cardcom’s editor resets the CSS pane.

Do not press F5 on Cardcom’s preview window — close it and reopen it.

## Files

| File | Paste into |
| --- | --- |
| `iframe.html` | Cardcom iframe HTML pane |
| `checkout.css` | Cardcom CSS pane |

Local visual development is in `../cardcom-preview/`. Nothing from that folder goes to Cardcom.
