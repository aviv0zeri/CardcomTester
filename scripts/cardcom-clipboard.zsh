# Copy production Cardcom files to the clipboard.
#
#   cardcom_html    iframe HTML  -> Cardcom iframe HTML pane (first)
#   cardcom_css     checkout CSS -> Cardcom CSS pane (second)
#
# Order matters: loading HTML in Cardcom's editor resets the CSS pane.
# Do not F5 Cardcom's preview window; close it and reopen.

CARDCOM_DIR="/Users/aviv0zeri/work/personal/CardcomTester/cardcom-production"

_cardcom_copy() {
    local file="$1" label="$2" check_tags="$3"

    if [[ ! -f "$file" ]]; then
        print -P "%F{red}✗%f not found: $file"
        return 1
    fi

    if [[ "$check_tags" == "html" ]]; then
        local bad
        bad=$(grep -oEi '<(embed|object|frameset|frame|iframe|meta|link|style)[[:space:]>]' "$file" | sort -u | tr '\n' ' ')
        if [[ -n "$bad" ]]; then
            print -P "%F{red}✗%f $label contains tags Cardcom will reject: $bad"
            print -P "  Not copied."
            return 1
        fi
    fi

    pbcopy < "$file"

    local bytes lines
    bytes=$(wc -c < "$file" | tr -d ' ')
    lines=$(wc -l < "$file" | tr -d ' ')
    print -P "%F{green}✓%f copied %B$label%b to clipboard  (${bytes} bytes, ${lines} lines)"
    print -P "  from ${file/#$HOME/~}"
}

cardcom_css() {
    _cardcom_copy "$CARDCOM_DIR/checkout.css" "iframe CSS" "css" || return 1
    print -P "  paste into the %BCSS%b pane, save, then reopen Cardcom's preview"
}

cardcom_html() {
    _cardcom_copy "$CARDCOM_DIR/iframe.html" "iframe HTML" "html" || return 1
    print -P "  paste into the %Biframe HTML%b pane and save"
    print -P "  %F{yellow}!%f this resets the CSS pane — run %Bcardcom_css%b next"
}
