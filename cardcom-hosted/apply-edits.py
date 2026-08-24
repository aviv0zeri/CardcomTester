#!/usr/bin/env python3
"""
Apply our design edits to a Cardcom checkout template.

Cardcom's HTML editor holds several templates (the standard page, the iframe
variant, and whatever else the terminal has). Each one needs the same small set
of edits, so do it mechanically rather than by hand.

    python3 apply-edits.py [--no-wallet-row] <pristine-template.html> <output.html>

--no-wallet-row skips the .paymentOptionsRow wrapper. Use it when a wallet button
goes missing: that wrapper is the only edit that changes the DOM shape, and it
activates every .paymentOptionsRow rule in the stylesheet at once, so dropping it
isolates whether the wrapper or something else is at fault.

The input may be a full document or a bare body fragment. The output is always a
body fragment with no <meta>, <link>, or <style> tags, because Cardcom's editor
rejects those on save:

    Tags Not Allow in html: embed, object, frameset, frame, iframe, meta, link and style

Inline style="" attributes are fine. Only the <style> element is banned.

Every edit is additive. Nothing is renamed, reordered, or deleted, and the script
refuses to write output if any data-bind or id from the input went missing.
"""

import re
import sys

FORBIDDEN_TAGS = ('embed', 'object', 'frameset', 'frame', 'iframe', 'meta', 'link', 'style')

# Fields whose .fieldName label the design hides. Without a placeholder these
# render as bare underlines with nothing saying what goes in them.
#
# Keys match either id or data-testid, because the two disagree across Cardcom's
# template variants: the card number input is id="txtCardNumber" but
# data-testid="credit-card-number-text-field".
#
# Only <input> is listed. A <select> takes no placeholder, so the expiry date,
# the instalment count and the terms agreement keep their .fieldName label —
# checkout.css hides a label only on rows that have a placeholder to replace it.
PLACEHOLDERS = {
    # Invoice details block
    'txtCustName': 'שם מלא',
    'txtCompID': 'ת.ז. / ח.פ.',
    'txtCustCity': 'עיר',
    'txtCustAddresLine1': 'כתובת',
    'txtCustAddresLine2': 'מיקוד',
    'txtCustMobilePH': 'טלפון נייד',
    'txtCustLinePH': 'טלפון',
    'txtEmail': 'דוא&quot;ל',
    # Credit card block
    'txtopenSum': 'סכום לתשלום',
    'txtCardNumber': 'מספר כרטיס אשראי',
    'txtCardNumber-number': 'מספר כרטיס אשראי',
    'txtCvv': 'CVV',
    'txtTZ': 'ת.ז. של בעל הכרטיס',
    'txtCardOwnerName': 'שם בעל הכרטיס',
    'txtCardOwnerPhone': 'טלפון נייד',
    'txtCardOwnerEmail': 'דוא&quot;ל',
    # AVS block, present on some terminals only
    'txtAvsCity': 'עיר',
    'txtAvsAddress': 'כתובת',
    'txtAvsZip': 'מיקוד',
}


def body_fragment(src):
    """Strip any document wrapper, honouring PASTE FROM/TO markers if present."""
    m = re.search(r'<!-+ *PASTE FROM HERE *-+>(.*?)<!-+ *PASTE TO HERE *-+>', src, re.S)
    if m:
        return m.group(1).strip() + '\n'
    m = re.search(r'<body[^>]*>(.*)</body>', src, re.S)
    if m:
        return m.group(1).strip() + '\n'
    return src.strip() + '\n'


def close_index(html, start):
    """Index just past the </div> that closes the <div> opening at `start`."""
    depth = 0
    for m in re.finditer(r'<div\b[^>]*>|</div>', html[start:]):
        depth += 1 if m.group(0).startswith('<div') else -1
        if depth == 0:
            return start + m.end()
    raise ValueError('unbalanced <div> starting at %d' % start)


def add_placeholders(html):
    """Give every label-less input a placeholder. Skips ones already present."""
    added, missing = [], []
    for key, text in PLACEHOLDERS.items():
        k = re.escape(key)
        pattern = re.compile(
            r'(<input\b(?=[^>]*\b(?:id|data-testid)="%s")(?![^>]*\bplaceholder=)[^>]*?)(\s*/?>)' % k)
        html, n = pattern.subn(
            lambda m: '%s placeholder="%s"%s' % (m.group(1), text, m.group(2)), html)
        if n:
            added.append(key)
        elif not re.search(r'<input\b[^>]*\b(?:id|data-testid)="%s"' % k, html):
            missing.append(key)
    return html, added, missing


def wrap_wallets(html):
    """Wrap the wallet buttons so they lay out as a row instead of a stack."""
    if 'paymentOptionsRow' in html:
        return html, False
    start = html.find('<div class="paypalDiv"')
    last = html.find('<div class="masterPassDiv"')
    if start == -1 or last == -1:
        return html, False
    end = close_index(html, last)
    inner = html[start:end]
    wrapped = ('<div class="paymentOptionsRow">\n' + inner + '\n</div>\n<!-- /.paymentOptionsRow -->')
    return html[:start] + wrapped + html[end:], True


def wrap_checkout_walk(html):
    """
    Wrap the billing block and the payment block so CSS can sit them side by
    side on a wide page and stack them in a narrow iframe.

    A true step-by-step walkthrough (hide payment until billing is done) needs
    JavaScript Cardcom will not let us add. This wrapper is the HTML-only
    substitute: two panes, same forms, no behaviour change.
    """
    if 'checkoutWalk' in html:
        return html, False
    start = html.find('<div class="blockDetails OrderDetails"')
    if start == -1:
        start = html.find('<div class="blockDetails customDetails"')
    if start == -1:
        start = html.find('<div class="blockDetails paymentDetails"')
    pay = html.find('<div class="blockDetails paymentDetails"')
    if start == -1 or pay == -1:
        return html, False
    end = close_index(html, pay)
    inner = html[start:end]
    wrapped = '<div class="checkoutWalk">\n' + inner + '\n</div>\n<!-- /.checkoutWalk -->'
    return html[:start] + wrapped + html[end:], True


def wrap_pay_bar(html):
    """
    Put the pay button and the error list in one wrapper.

    checkout.css pins .payBar with position: sticky so the button stays on
    screen on a long form. The two elements have to share the wrapper: pinned
    separately, a decline scrolls away from the button it is telling the
    customer to press again.
    """
    if 'payBar' in html:
        return html, False
    start = html.find('<div class="submitDiv">')
    err = html.find('<div class="errorDiv"')
    if start == -1 or err == -1 or err < start:
        return html, False
    end = close_index(html, err)
    inner = html[start:end]
    wrapped = '<div class="payBar">\n' + inner + '\n</div>\n<!-- /.payBar -->'
    return html[:start] + wrapped + html[end:], True


def add_total_to_title(html):
    """
    The design hides .productsDetails, which is the only place Cardcom prints the
    total, so echo it into the credit-card title via Cardcom's own binding.
    """
    if 'creditTitleTotal' in html:
        return html, False
    pattern = re.compile(r'(<span data-bind="text: labels\.PayByCreditCard"></span>)')
    html, n = pattern.subn(
        r'\1\n            <span class="creditTitleTotal num" data-bind="text: summaryTotalSign"></span>',
        html, count=1)
    return html, bool(n)


def hide_error_div_by_default(html):
    """
    Knockout drives .errorDiv with a visible: binding, but it is visible until
    Knockout binds. An inline display:none is the correct default; Knockout
    overwrites it. Never do this in CSS with !important or errors stay hidden.
    """
    pattern = re.compile(r'<div class="errorDiv"(?![^>]*\bstyle=)([^>]*)>')
    html, n = pattern.subn(r'<div class="errorDiv"\1 style="display: none;">', html)
    return html, n


PREVIEW_SHELL = """<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>Cardcom checkout preview — %(title)s</title>
<!--
  GENERATED by apply-edits.py --preview. Do not edit; re-run the script.
  Local viewing only. Cardcom never sees this file, which is why it is allowed
  the <meta>, <link> and wrapper <div> that Cardcom's editor rejects.

  This approximates, but cannot reproduce, the live page. Knockout is not
  running, so every data-bind is inert: labels are blank, the total is blank,
  and rows Cardcom would hide are visible. The wallet SDKs are not running
  either, so preview.css paints stand-in artwork where Google, Apple and PayPal
  would draw their own buttons. Judge layout here, never behaviour.
-->
<link rel="stylesheet" href="%(css)s">
<link rel="stylesheet" href="%(preview_css)s">
</head>
<body>
<div class="preview-shell">
%(body)s
</div>
</body>
</html>
"""


def write_preview(path, body, css, preview_css, title):
    open(path, 'w', encoding='utf-8').write(PREVIEW_SHELL % {
        'title': title, 'css': css, 'preview_css': preview_css, 'body': body})


def audit(before, after):
    """Confirm the edits were purely additive."""
    def bindings(s):
        return sorted(re.findall(r'data-bind="([^"]*)"', s))

    def ids(s):
        return sorted(re.findall(r'\bid="([^"]+)"', s))

    problems = []
    lost_b = set(bindings(before)) - set(bindings(after))
    lost_i = set(ids(before)) - set(ids(after))
    if lost_b:
        problems.append('lost data-bind: %s' % sorted(lost_b))
    if lost_i:
        problems.append('lost id: %s' % sorted(lost_i))
    found = re.findall(r'<(%s)\b[^>]*>' % '|'.join(FORBIDDEN_TAGS), after, re.I)
    if found:
        problems.append('Cardcom will reject these tags: %s' % sorted(set(found)))
    return problems, len(bindings(before)), len(ids(before))


def main():
    argv = sys.argv[1:]
    args = [a for a in argv if not a.startswith('--')]
    no_wallet_row = '--no-wallet-row' in argv
    preview = None
    for a in argv:
        if a.startswith('--preview='):
            preview = a.split('=', 1)[1]

    if len(args) != 2:
        print(__doc__.strip())
        return 2

    src = open(args[0], encoding='utf-8').read()
    original = body_fragment(src)

    html = original
    html, placeholders, missing = add_placeholders(html)
    wallets = False
    if not no_wallet_row:
        html, wallets = wrap_wallets(html)
    html, walk = wrap_checkout_walk(html)
    html, paybar = wrap_pay_bar(html)
    html, total = add_total_to_title(html)
    html, errors = hide_error_div_by_default(html)

    problems, n_bind, n_ids = audit(original, html)

    print('in  %s  (%d chars)' % (args[0], len(original)))
    print('  placeholders added   : %d of %d' % (len(placeholders), len(PLACEHOLDERS)))
    if missing:
        print('  fields not in this template (fine, they are optional): %s' % missing)
    if no_wallet_row:
        print('  wallet row wrapper   : SKIPPED (--no-wallet-row)')
    else:
        print('  wallet row wrapper   : %s' % ('added' if wallets else 'skipped, already present or markup differs'))
    print('  checkout walk wrapper: %s' % ('added' if walk else 'skipped, already present or markup differs'))
    print('  pay bar wrapper      : %s' % ('added' if paybar else 'skipped, already present or markup differs'))
    print('  total in title       : %s' % ('added' if total else 'skipped, already present or markup differs'))
    print('  errorDiv default     : %d hidden inline' % errors)
    print('  preserved            : %d data-bind, %d id' % (n_bind, n_ids))

    if problems:
        print('\nREFUSING TO WRITE:')
        for p in problems:
            print('  - %s' % p)
        return 1

    open(args[1], 'w', encoding='utf-8').write(html)
    print('\nout %s  (%d chars) — paste this whole file into Cardcom' % (args[1], len(html)))

    if preview:
        # The exact stylesheet Cardcom gets, so the preview cannot flatter it.
        write_preview(preview, html, 'paste/checkout.full.css', 'preview.css', args[0])
        print('    %s — open in a browser to check layout only' % preview)
    return 0


if __name__ == '__main__':
    sys.exit(main())
