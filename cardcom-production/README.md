# Cardcom production template

Paste-ready files live under **`../templates/cardcom/low-profile/`**.

- HTML (both slots): `templates/cardcom/low-profile/checkout.html`
- RTL CSS: `templates/cardcom/low-profile/rtl/checkout.css`
- LTR CSS: `templates/cardcom/low-profile/ltr/checkout.css`

```bash
source scripts/cardcom-clipboard.zsh
cardcom_export    # fzf menu — HTML first, then CSS
```

Do not add JavaScript. Do not paste `cardcom-preview/`.
