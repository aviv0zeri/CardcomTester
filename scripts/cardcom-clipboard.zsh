# Copy Cardcom Low Profile HTML or CSS to the clipboard.
#
#   cardcom_export     fzf: pick any version, then HTML or CSS
#   cardcom_html       fzf: pick a version's HTML (paste first)
#   cardcom_css        fzf: pick a version's CSS  (paste second)
#
# Order matters: loading HTML in Cardcom's editor resets the CSS pane.
# Do not F5 Cardcom's preview window; close it and reopen.

CARDCOM_TEMPLATES="/Users/aviv0zeri/work/personal/CardcomTester/templates/cardcom"

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

# TSV: family	lang	kind	relpath	note
_cardcom_catalog() {
    print "redirect-normal	hebrew	html	redirect-normal/hebrew/iframe.html	Full-page redirect"
    print "redirect-normal	hebrew	css	redirect-normal/hebrew/checkout.css	Full-page redirect"
    print "redirect-normal	english	html	redirect-normal/english/iframe.html	Full-page redirect"
    print "redirect-normal	english	css	redirect-normal/english/checkout.css	Full-page redirect"
    print "iframe-normal	hebrew	html	iframe-normal/hebrew/iframe.html	Compact iframe-only"
    print "iframe-normal	hebrew	css	iframe-normal/hebrew/checkout.css	Compact iframe-only"
    print "iframe-normal	english	html	iframe-normal/english/iframe.html	Compact iframe-only"
    print "iframe-normal	english	css	iframe-normal/english/checkout.css	Compact iframe-only"
    print "english-full	english	html	redirect-normal/english-full/iframe.html	Saved English redirect snapshot"
    print "english-full	english	css	redirect-normal/english-full/checkout.css	Saved English redirect snapshot"
}

_cardcom_pick() {
    local filter="${1:-}"
    local rows

    if ! command -v fzf >/dev/null; then
        print -P "%F{red}✗%f fzf is not installed (brew install fzf)"
        return 1
    fi

    rows=$(_cardcom_catalog)
    if [[ -n "$filter" ]]; then
        rows=$(print -r -- "$rows" | awk -F '\t' -v k="$filter" '$3 == k')
    fi

    print -r -- "$rows" | fzf \
        --delimiter=$'\t' \
        --with-nth=1,2,3,5 \
        --header 'HTML first, then CSS. Do not F5 Cardcom preview — close and reopen.' \
        --prompt 'Cardcom export > ' \
        --height=40% \
        --reverse \
        --border
}

cardcom_export() {
    local line family lang kind relpath note file pane

    line=$(_cardcom_pick "$1") || return 1
    [[ -n "$line" ]] || return 1

    family=$(print -r -- "$line" | cut -f1)
    lang=$(print -r -- "$line" | cut -f2)
    kind=$(print -r -- "$line" | cut -f3)
    relpath=$(print -r -- "$line" | cut -f4)
    note=$(print -r -- "$line" | cut -f5)
    file="$CARDCOM_TEMPLATES/$relpath"

    if [[ "$kind" == "html" ]]; then
        _cardcom_copy "$file" "$family $lang HTML" "html" || return 1
        print -P "  paste into Cardcom's %Biframe HTML%b pane and save"
        print -P "  %F{yellow}!%f this resets the CSS pane — run %Bcardcom_export%b (or %Bcardcom_css%b) next"
        print -P "  $note"
        return 0
    fi

    _cardcom_copy "$file" "$family $lang CSS" "css" || return 1
    print -P "  paste into Cardcom's %BCSS%b pane, save, then reopen the preview"
    print -P "  $note"
}

cardcom_html() {
    cardcom_export html
}

cardcom_css() {
    cardcom_export css
}
