# Copy Cardcom Low Profile HTML or CSS to the clipboard, or open a local preview.
#
#   cardcom export     new version (Aviv brand) HTML/CSS to clipboard
#   cardcom tester     start Express + Vite if needed, open the React tester
#   cardcom_export     old version: fzf pick canonical HTML or CSS
#   cardcom_html       old version, HTML only (paste first)
#   cardcom_css        old version, CSS only (paste second)
#   cardcom_open       fzf: open that version's HTML+CSS on localhost (not React)
#
# Enter copies (or opens) and stays in the list. Esc quits.
# Order matters: loading HTML in Cardcom's editor resets the CSS pane.
# Do not F5 Cardcom's preview window; close it and reopen.

CARDCOM_TEMPLATES="/Users/aviv0zeri/work/personal/CardcomTester/templates/cardcom"
CARDCOM_CLIPBOARD_SCRIPT="/Users/aviv0zeri/work/personal/CardcomTester/scripts/cardcom-clipboard.zsh"
CARDCOM_ROOT="/Users/aviv0zeri/work/personal/CardcomTester"

_cardcom_copy() {
    local file="$1" label="$2" check_tags="$3" quiet="${4:-}"

    if [[ ! -f "$file" ]]; then
        [[ "$quiet" == "quiet" ]] || print -P "%F{red}✗%f not found: $file"
        return 1
    fi

    if [[ "$check_tags" == "html" ]]; then
        local bad
        bad=$(grep -oEi '<(embed|object|frameset|frame|iframe|meta|link|style)[[:space:]>]' "$file" | sort -u | tr '\n' ' ')
        if [[ -n "$bad" ]]; then
            if [[ "$quiet" != "quiet" ]]; then
                print -P "%F{red}✗%f $label contains tags Cardcom will reject: $bad"
                print -P "  Not copied."
            fi
            return 1
        fi
    fi

    pbcopy < "$file"

    if [[ "$quiet" != "quiet" ]]; then
        local bytes lines
        bytes=$(wc -c < "$file" | tr -d ' ')
        lines=$(wc -l < "$file" | tr -d ' ')
        print -P "%F{green}✓%f copied %B$label%b to clipboard  (${bytes} bytes, ${lines} lines)"
        print -P "  from ${file/#$HOME/~}"
    fi
}

# TSV: family	lang	kind	relpath	note
_cardcom_catalog() {
    print "rtl	rtl	html	low-profile/checkout.html	RTL slot HTML (Hebrew + Arabic)"
    print "rtl	rtl	css	low-profile/rtl/checkout.css	RTL slot CSS (Hebrew + Arabic)"
    print "ltr	ltr	html	low-profile/checkout.html	LTR slot HTML (English + Russian)"
    print "ltr	ltr	css	low-profile/ltr/checkout.css	LTR slot CSS (English + Russian)"
}

# Called from fzf Enter. $1 = TSV line or a temp file containing it, $2 = status file.
_cardcom_export_line() {
    local line="$1" status_file="$2"
    local family lang kind relpath note file label pane hint

    if [[ -f "$line" ]]; then
        line=$(<"$line")
    fi

    family=$(print -r -- "$line" | cut -f1)
    lang=$(print -r -- "$line" | cut -f2)
    kind=$(print -r -- "$line" | cut -f3)
    relpath=$(print -r -- "$line" | cut -f4)
    note=$(print -r -- "$line" | cut -f5)
    file="$CARDCOM_TEMPLATES/$relpath"

    if [[ "$kind" == "html" ]]; then
        label="$family $lang HTML"
        pane="paste into the iframe HTML pane (this resets CSS)"
        hint="pick the matching CSS next"
        _cardcom_copy "$file" "$label" "html" "quiet" || {
            print -r -- "✗ $label failed" > "$status_file"
            return 1
        }
    else
        label="$family $lang CSS"
        pane="paste into the CSS pane, then reopen Cardcom preview"
        hint="Esc to quit"
        _cardcom_copy "$file" "$label" "css" "quiet" || {
            print -r -- "✗ $label failed" > "$status_file"
            return 1
        }
    fi

    print -r -- "✓ $label on clipboard. $pane. $hint. Esc quits." > "$status_file"
}

_cardcom_pick() {
    local filter="${1:-}"
    local rows status_file sel pos

    if ! command -v fzf >/dev/null; then
        print -P "%F{red}✗%f fzf is not installed (brew install fzf)"
        return 1
    fi

    rows=$(_cardcom_catalog)
    if [[ -n "$filter" ]]; then
        rows=$(print -r -- "$rows" | awk -F '\t' -v k="$filter" '$3 == k')
    fi

    status_file=$(mktemp)
    print -r -- "Enter copies and stays here. Esc quits. HTML first, then CSS. Do not F5 Cardcom preview." > "$status_file"

    pos=1
    while true; do
        sel=$(
            print -r -- "$rows" | command fzf \
                --delimiter=$'\t' \
                --with-nth=1,2,3,5 \
                --header "$(cat "$status_file")" \
                --prompt 'Cardcom export > ' \
                --height=40% \
                --reverse \
                --border \
                --cycle \
                --bind "start:pos($pos)" \
                --bind "enter:execute-silent:zsh --norcs ${CARDCOM_CLIPBOARD_SCRIPT} --export-line {f} ${status_file}" \
                --bind "enter:+transform-header:cat ${status_file}" \
                --bind "double-click:execute-silent:zsh --norcs ${CARDCOM_CLIPBOARD_SCRIPT} --export-line {f} ${status_file}" \
                --bind "double-click:+transform-header:cat ${status_file}"
        ) || break

        [[ -z "$sel" ]] && break

        # Enter still closed fzf (default accept). Copy and reopen the list.
        _cardcom_export_line "$sel" "$status_file"
        pos=$(print -r -- "$rows" | grep -n -F -x -- "$sel" | head -1 | cut -d: -f1)
        pos=${pos:-1}
    done

    rm -f "$status_file"
    return 0
}

cardcom_export() {
    _cardcom_pick "$1"
}

cardcom_html() {
    cardcom_export html
}

cardcom_css() {
    cardcom_export css
}

_cardcom_brand_catalog() {
    print "new	both	html	low-profile/_brand/checkout.html	New version HTML (both slots)"
    print "new	rtl	css	low-profile/rtl/checkout.css	New version CSS · RTL (he+ar)"
    print "new	ltr	css	low-profile/ltr/checkout.css	New version CSS · LTR (en+ru)"
}

_cardcom_brand_copy_css() {
    local dir="$1" label="$2" quiet="${3:-}"
    local base="$CARDCOM_TEMPLATES/low-profile/${dir}/checkout.css"
    local skin="$CARDCOM_TEMPLATES/low-profile/_brand/brand-skin.css"
    local tmp

    if [[ ! -f "$base" || ! -f "$skin" ]]; then
        [[ "$quiet" == "quiet" ]] || print -P "%F{red}✗%f missing $base or $skin"
        return 1
    fi

    tmp=$(mktemp)
    cat "$base" "$skin" > "$tmp"
    pbcopy < "$tmp"
    if [[ "$quiet" != "quiet" ]]; then
        local bytes lines
        bytes=$(wc -c < "$tmp" | tr -d ' ')
        lines=$(wc -l < "$tmp" | tr -d ' ')
        print -P "%F{green}✓%f copied %B$label%b to clipboard  (${bytes} bytes, ${lines} lines)"
        print -P "  ${dir}/checkout.css + _brand/brand-skin.css"
    fi
    rm -f "$tmp"
}

_cardcom_brand_export_line() {
    local line="$1" status_file="$2"
    local family lang kind relpath note file label pane hint

    if [[ -f "$line" ]]; then
        line=$(<"$line")
    fi

    family=$(print -r -- "$line" | cut -f1)
    lang=$(print -r -- "$line" | cut -f2)
    kind=$(print -r -- "$line" | cut -f3)
    relpath=$(print -r -- "$line" | cut -f4)
    note=$(print -r -- "$line" | cut -f5)
    file="$CARDCOM_TEMPLATES/$relpath"

    if [[ "$kind" == "html" ]]; then
        label="new version HTML"
        pane="paste into the iframe HTML pane (this resets CSS)"
        hint="pick the matching CSS next"
        _cardcom_copy "$file" "$label" "html" "quiet" || {
            print -r -- "✗ $label failed" > "$status_file"
            return 1
        }
    else
        label="new version CSS · $lang"
        pane="paste into the CSS pane, then reopen Cardcom preview"
        hint="Esc to quit"
        _cardcom_brand_copy_css "$lang" "$label" "quiet" || {
            print -r -- "✗ $label failed" > "$status_file"
            return 1
        }
    fi

    print -r -- "✓ $label on clipboard. $pane. $hint. Esc quits." > "$status_file"
}

_cardcom_brand_pick() {
    local filter="${1:-}"
    local rows status_file sel pos

    if ! command -v fzf >/dev/null; then
        print -P "%F{red}✗%f fzf is not installed (brew install fzf)"
        return 1
    fi

    rows=$(_cardcom_brand_catalog)
    if [[ -n "$filter" ]]; then
        rows=$(print -r -- "$rows" | awk -F '\t' -v k="$filter" '$3 == k')
    fi

    status_file=$(mktemp)
    print -r -- "New version. Enter copies and stays here. Esc quits. HTML first, then CSS. Do not F5 Cardcom preview." > "$status_file"

    pos=1
    while true; do
        sel=$(
            print -r -- "$rows" | command fzf \
                --delimiter=$'\t' \
                --with-nth=1,2,3,5 \
                --header "$(cat "$status_file")" \
                --prompt 'cardcom export > ' \
                --height=40% \
                --reverse \
                --border \
                --cycle \
                --bind "start:pos($pos)" \
                --bind "enter:execute-silent:zsh --norcs ${CARDCOM_CLIPBOARD_SCRIPT} --export-brand-line {f} ${status_file}" \
                --bind "enter:+transform-header:cat ${status_file}" \
                --bind "double-click:execute-silent:zsh --norcs ${CARDCOM_CLIPBOARD_SCRIPT} --export-brand-line {f} ${status_file}" \
                --bind "double-click:+transform-header:cat ${status_file}"
        ) || break

        [[ -z "$sel" ]] && break

        _cardcom_brand_export_line "$sel" "$status_file"
        pos=$(print -r -- "$rows" | grep -n -F -x -- "$sel" | head -1 | cut -d: -f1)
        pos=${pos:-1}
    done

    rm -f "$status_file"
    return 0
}

cardcom() {
    local sub="${1:-}"
    case "$sub" in
        export)
            shift
            _cardcom_brand_pick "$1"
            ;;
        tester)
            cardcom_tester
            ;;
        *)
            print -P "usage:"
            print -P "  cardcom export    # new version (Aviv brand) HTML/CSS"
            print -P "  cardcom tester    # start Express + Vite, open the React tester"
            print -P "  cardcom_export    # old version (canonical paste)"
            return 1
            ;;
    esac
}

_cardcom_preview_catalog() {
    print "he	he	low-profile/he	Low Profile Hebrew"
    print "en	en	low-profile/en	Low Profile English"
    print "ar	ar	low-profile/ar	Low Profile Arabic"
    print "ru	ru	low-profile/ru	Low Profile Russian"
}

_cardcom_preview_ok() {
    curl -sf --max-time 0.5 "$1/cardcom-preview/open.html" | grep -q "open.js"
}

_cardcom_preview_port_free() {
    ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

_cardcom_preview_base() {
    local port pid i py
    py=$(command -v python3) || py=/usr/bin/python3

    for port in 3000 8092 8093 8094 8081 8100; do
        if _cardcom_preview_ok "http://127.0.0.1:${port}"; then
            print -r -- "http://127.0.0.1:${port}"
            return 0
        fi
    done

    for port in 8092 8093 8094 8081 8100; do
        _cardcom_preview_port_free "$port" || continue
        print -P "%F{yellow}…%f starting local preview server on :${port}" >&2
        setopt localoptions nohup
        nohup "$py" -m http.server "$port" --bind 127.0.0.1 --directory "$CARDCOM_ROOT" >/dev/null 2>&1 &
        pid=$!
        disown "$pid" 2>/dev/null
        for i in {1..30}; do
            sleep 0.1
            if _cardcom_preview_ok "http://127.0.0.1:${port}"; then
                print -r -- "http://127.0.0.1:${port}"
                return 0
            fi
            kill -0 "$pid" 2>/dev/null || break
        done
    done

    print -P "%F{red}✗%f could not start preview server (port 8080 may already be taken)" >&2
    return 1
}

_cardcom_open_line() {
    local line="$1" status_file="$2"
    local family lang vpath base url

    if [[ -f "$line" ]]; then
        line=$(<"$line")
    fi

    family=$(print -r -- "$line" | cut -f1)
    lang=$(print -r -- "$line" | cut -f2)
    vpath=$(print -r -- "$line" | cut -f3)
    base=$(_cardcom_preview_base) || {
        print -r -- "✗ preview server failed" > "$status_file"
        return 1
    }
    url="${base}/cardcom-preview/open.html?v=${vpath}"
    open "$url"
    print -r -- "✓ opened $family $lang. Compare with Cardcom. Esc quits." > "$status_file"
}

cardcom_open() {
    local rows status_file sel pos

    if ! command -v fzf >/dev/null; then
        print -P "%F{red}✗%f fzf is not installed (brew install fzf)"
        return 1
    fi

    rows=$(_cardcom_preview_catalog)
    status_file=$(mktemp)
    if ! _cardcom_preview_base >/dev/null; then
        print -P "%F{red}✗%f could not start a local preview server"
        rm -f "$status_file"
        return 1
    fi
    print -r -- "Enter opens that version's HTML+CSS on localhost (not React). Esc quits." > "$status_file"

    pos=1
    while true; do
        sel=$(
            print -r -- "$rows" | command fzf \
                --delimiter=$'\t' \
                --with-nth=1,2,4 \
                --header "$(cat "$status_file")" \
                --prompt 'Cardcom open > ' \
                --height=40% \
                --reverse \
                --border \
                --cycle \
                --bind "start:pos($pos)" \
                --bind "enter:execute-silent:zsh --norcs ${CARDCOM_CLIPBOARD_SCRIPT} --open-line {f} ${status_file}" \
                --bind "enter:+transform-header:cat ${status_file}" \
                --bind "double-click:execute-silent:zsh --norcs ${CARDCOM_CLIPBOARD_SCRIPT} --open-line {f} ${status_file}" \
                --bind "double-click:+transform-header:cat ${status_file}"
        ) || break

        [[ -z "$sel" ]] && break

        _cardcom_open_line "$sel" "$status_file"
        pos=$(print -r -- "$rows" | grep -n -F -x -- "$sel" | head -1 | cut -d: -f1)
        pos=${pos:-1}
    done

    rm -f "$status_file"
    return 0
}

_cardcom_api_ok() {
    curl -sf --max-time 0.5 "http://127.0.0.1:3000/test" | grep -q "Server works"
}

_cardcom_vite_ok() {
    curl -sf --max-time 1 -o /dev/null "http://127.0.0.1:5173/"
}

_cardcom_kill_listen() {
    local port="$1" pids
    pids=$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || true
    [[ -n "$pids" ]] || return 0
    print -P "%F{yellow}…%f stopping hung process on :${port}"
    kill $pids 2>/dev/null || true
    sleep 0.4
    pids=$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || true
    [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
}

_cardcom_wait_ok() {
    local i
    for i in {1..80}; do
        "$1" && return 0
        sleep 0.2
    done
    return 1
}

cardcom_tester() {
    local env_file="$CARDCOM_ROOT/server/.env"
    local api_log="${TMPDIR:-/tmp}/cardcom-api.log"
    local vite_log="${TMPDIR:-/tmp}/cardcom-vite.log"

    if [[ ! -f "$env_file" ]]; then
        print -P "%F{yellow}!%f missing $env_file (CARDCOM_USERNAME, CARDCOM_TERMINAL)"
        print -P "  Live Cardcom Redirect will fail until that file exists."
    fi

    if _cardcom_api_ok; then
        print -P "%F{green}✓%f API already on :3000"
    elif ! _cardcom_preview_port_free 3000; then
        print -P "%F{red}✗%f :3000 is in use but is not the Express API"
        print -P "  A python preview on 3000 is not enough. Stop it, then retry."
        return 1
    else
        if [[ ! -d "$CARDCOM_ROOT/server/node_modules" ]]; then
            print -P "%F{red}✗%f server/node_modules missing (cd server && npm install)"
            return 1
        fi
        print -P "%F{yellow}…%f starting Express API on :3000"
        setopt localoptions nohup
        (
            cd "$CARDCOM_ROOT/server" || exit 1
            exec nohup node index.js >> "$api_log" 2>&1
        ) &
        disown $! 2>/dev/null
        if ! _cardcom_wait_ok _cardcom_api_ok; then
            print -P "%F{red}✗%f API did not start. See $api_log"
            return 1
        fi
        print -P "%F{green}✓%f API on :3000"
    fi

    if _cardcom_vite_ok; then
        print -P "%F{green}✓%f Vite already on :5173"
    else
        if ! _cardcom_preview_port_free 5173; then
            _cardcom_kill_listen 5173
        fi
        if [[ ! -d "$CARDCOM_ROOT/cardcom-tester/node_modules" ]]; then
            print -P "%F{red}✗%f cardcom-tester/node_modules missing (cd cardcom-tester && npm install)"
            return 1
        fi
        print -P "%F{yellow}…%f starting Vite on :5173"
        setopt localoptions nohup
        (
            cd "$CARDCOM_ROOT/cardcom-tester" || exit 1
            exec nohup npm run dev -- --host 127.0.0.1 --port 5173 >> "$vite_log" 2>&1
        ) &
        disown $! 2>/dev/null
        if ! _cardcom_wait_ok _cardcom_vite_ok; then
            print -P "%F{red}✗%f Vite did not start. See $vite_log"
            return 1
        fi
        print -P "%F{green}✓%f Vite on :5173"
    fi

    open "http://127.0.0.1:5173/"
    print -P "%F{green}✓%f opened Cardcom tester. Use Cardcom for a live session, Local for this design."
}

if [[ "$ZSH_EVAL_CONTEXT" == "toplevel" && "$1" == "--export-line" ]]; then
    _cardcom_export_line "$2" "$3"
    exit 0
fi

if [[ "$ZSH_EVAL_CONTEXT" == "toplevel" && "$1" == "--export-brand-line" ]]; then
    _cardcom_brand_export_line "$2" "$3"
    exit 0
fi

if [[ "$ZSH_EVAL_CONTEXT" == "toplevel" && "$1" == "--open-line" ]]; then
    _cardcom_open_line "$2" "$3"
    exit 0
fi
