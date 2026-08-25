# Cardcom production template

Paste-ready files now live under **`../templates/cardcom/`**.

- Redirect (full page): `templates/cardcom/redirect-normal/{hebrew,english}/`
- Iframe only (compact): `templates/cardcom/iframe-normal/{hebrew,english}/`

```bash
source scripts/cardcom-clipboard.zsh
cardcom_export    # fzf menu — HTML first, then CSS
```

Do not add JavaScript. Do not paste `cardcom-preview/`. See the repo root README for how each version is used on Cardcom.
