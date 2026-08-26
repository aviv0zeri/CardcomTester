/* Original Canaan paste inlined this in the HTML pane.
   Cardcom custom-design HTML does not allow executable <script>.
   Kept here for the audit. Not loaded by Cardcom or by local open.js (innerHTML inject).
*/
(function() {
    var validationRules = {
        txtCardOwnerName: {
            validate: function(value) {
                var words = value.trim().split(/\s+/).filter(function(w) { return w.length > 0; });
                return words.length >= 2;
            },
            errorMessage: 'יש להזין שם מלא (שם פרטי ושם משפחה)'
        },
        txtCardNumber: {
            validate: function(value) {
                var cleaned = value.replace(/\s|-/g, '');
                return cleaned.length >= 13 && cleaned.length <= 19 && /^\d+$/.test(cleaned);
            },
            errorMessage: 'מספר כרטיס לא תקין'
        },
        txtCvv: {
            validate: function(value) {
                return value.length >= 3 && value.length <= 4 && /^\d+$/.test(value);
            },
            errorMessage: 'CVV לא תקין'
        },
        txtTZ: {
            validate: function(value) {
                var id = value.trim();
                if (!/^\d{5,9}$/.test(id)) return false;
                while (id.length < 9) id = '0' + id;
                var sum = 0;
                for (var i = 0; i < 9; i++) {
                    var n = Number(id.charAt(i)) * ((i % 2) + 1);
                    if (n > 9) n -= 9;
                    sum += n;
                }
                return sum % 10 === 0;
            },
            errorMessage: 'תעודת זהות לא תקינה'
        },
        txtCardOwnerPhone: {
            validate: function(value) {
                var p = value.replace(/[\s-]/g, '');
                return /^0\d{8,9}$/.test(p);
            },
            errorMessage: 'מספר טלפון לא תקין'
        }
    };

    var fieldValidationState = {
        txtCardOwnerName: false,
        txtCardNumber: false,
        txtCvv: false,
        txtTZ: false,
        txtCardOwnerPhone: false,
        expiration: true
    };

    function isFieldShown(id) {
        var el = document.getElementById(id);
        if (!el) return false;
        return (el.offsetParent !== null) || (el.offsetWidth > 0) || (el.getClientRects().length > 0);
    }
    function fieldRequiredOK(id) {
        if (!isFieldShown(id)) return true;
        return fieldValidationState[id] === true;
    }

    function updateSubmitButtonState() {
        var submitBtn = document.querySelector('.submitDiv .buttonDiv input[type="button"]');
        if (!submitBtn) return;

        var allValid = fieldValidationState.txtCardOwnerName &&
                       fieldValidationState.txtCardNumber &&
                       fieldValidationState.txtCvv &&
                       fieldValidationState.expiration &&
                       fieldRequiredOK('txtTZ') &&
                       fieldRequiredOK('txtCardOwnerPhone');

        var errorElements = document.querySelectorAll('.validation-error');
        var hasVisibleErrors = false;
        for (var i = 0; i < errorElements.length; i++) {
            if (errorElements[i].offsetParent !== null || errorElements[i].offsetWidth > 0) {
                hasVisibleErrors = true;
                break;
            }
        }

        if (allValid && !hasVisibleErrors) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('button-disabled');
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.add('button-disabled');
        }
    }

    function setValidState(input) {
        input.classList.remove('validation-error');
        input.classList.add('validation-success');
        var errorDiv = document.getElementById(input.id + 'Error');
        if (errorDiv) errorDiv.style.display = 'none';
        if (fieldValidationState.hasOwnProperty(input.id)) fieldValidationState[input.id] = true;
        updateSubmitButtonState();
    }

    function setInvalidState(input, message) {
        input.classList.remove('validation-success');
        input.classList.add('validation-error');
        var errorDiv = document.getElementById(input.id + 'Error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = input.id + 'Error';
            errorDiv.className = 'field-error-message';
            input.parentNode.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        if (fieldValidationState.hasOwnProperty(input.id)) fieldValidationState[input.id] = false;
        updateSubmitButtonState();
    }

    function clearValidationState(input) {
        input.classList.remove('validation-error', 'validation-success');
        var errorDiv = document.getElementById(input.id + 'Error');
        if (errorDiv) errorDiv.style.display = 'none';
        if (fieldValidationState.hasOwnProperty(input.id)) fieldValidationState[input.id] = false;
        updateSubmitButtonState();
    }

    function interceptSubmit() {
        var submitBtn = document.querySelector('.submitDiv .buttonDiv input[type="button"]');
        if (!submitBtn) return;
        submitBtn.addEventListener('click', function(e) {
            if (this.disabled) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            var input = document.getElementById('txtCardOwnerName');
            if (!input) return;
            var value = input.value.trim();
            var words = value.split(/\s+/).filter(function(w) { return w.length > 0; });
            if (words.length < 2) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                setInvalidState(input, 'יש להזין שם מלא (שם פרטי ושם משפחה)');
                input.focus();
                return false;
            }
        }, true);
    }

    function init() {
        var submitBtn = document.querySelector('.submitDiv .buttonDiv input[type="button"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('button-disabled');
        }
        interceptSubmit();
        updateSubmitButtonState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
