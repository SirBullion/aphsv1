document.addEventListener("DOMContentLoaded", () => {
  const year = new Date().getFullYear().toString();
  document.querySelectorAll(".js-current-year").forEach((node) => {
    node.textContent = year;
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function normalizeAuPhone(value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return "";

    const hasLetters = /[A-Za-z]/.test(trimmed);
    if (hasLetters) return null;

    const compact = trimmed.replace(/[\s\-()]/g, "");
    const digitsOnly = compact.replace(/[^\d]/g, "");
    if (!digitsOnly) return null;

    if (compact.startsWith("+61")) {
      return "+61" + digitsOnly.replace(/^61/, "");
    }
    if (compact.startsWith("61")) {
      return "+61" + digitsOnly.replace(/^61/, "");
    }
    if (digitsOnly.startsWith("0")) {
      return "+61" + digitsOnly.slice(1);
    }
    return "+61" + digitsOnly;
  }

  function isAuPhoneLengthValid(normalizedPhone) {
    if (!normalizedPhone || !normalizedPhone.startsWith("+61")) return false;
    const nationalNumber = normalizedPhone.slice(3);
    return /^\d+$/.test(nationalNumber) && nationalNumber.length >= 8 && nationalNumber.length <= 9;
  }

  function setStatus(statusNode, message, type) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.className = type ? "form-status " + type : "form-status";
  }

  function hasTurnstileToken(form) {
    const turnstileResponse = form.querySelector('input[name="cf-turnstile-response"]');
    return !!(turnstileResponse && turnstileResponse.value && turnstileResponse.value.trim());
  }

  document.querySelectorAll(".site-header").forEach((header) => {
    const toggle = header.querySelector(".nav-toggle");
    const nav = header.querySelector(".site-nav");
    if (!toggle || !nav) return;
    let lastScrollY = window.scrollY;

    const closeMenu = () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 960) {
        closeMenu();
      }
    });

    window.addEventListener(
      "scroll",
      () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY < lastScrollY) {
          closeMenu();
        }
        lastScrollY = currentScrollY;
      },
      { passive: true }
    );
  });

  document.querySelectorAll("form[data-ajax-form]").forEach((form) => {
    const status = document.getElementById(form.dataset.statusId || "");
    const submitButton = form.querySelector('button[type="submit"]');
    const emailInput = form.querySelector('input[type="email"]');
    const phoneInput = form.querySelector('input[type="tel"]');

    if (emailInput) {
      emailInput.addEventListener("input", () => {
        emailInput.setCustomValidity("");
      });
      emailInput.addEventListener("blur", () => {
        const value = emailInput.value.trim();
        if (!value) return;
        if (!emailRegex.test(value)) {
          emailInput.setCustomValidity("Email is not valid. Please enter a valid email address.");
        } else {
          emailInput.setCustomValidity("");
        }
        emailInput.reportValidity();
      });
    }

    if (phoneInput) {
      phoneInput.addEventListener("input", () => {
        phoneInput.setCustomValidity("");
      });
      phoneInput.addEventListener("blur", () => {
        const value = phoneInput.value.trim();
        if (!value) return;
        const normalized = normalizeAuPhone(value);
        if (!normalized) {
          phoneInput.setCustomValidity("Phone number must contain numbers only.");
          phoneInput.reportValidity();
          return;
        }
        phoneInput.value = normalized;
        if (!isAuPhoneLengthValid(normalized)) {
          phoneInput.setCustomValidity("Phone number length is not valid. Use 8-9 digits after +61.");
        } else {
          phoneInput.setCustomValidity("");
        }
        phoneInput.reportValidity();
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (form.querySelector(".cf-turnstile") && !hasTurnstileToken(form)) {
        setStatus(status, "Please verify you are human.", "is-error");
        return;
      }

      if (emailInput) {
        const email = emailInput.value.trim();
        if (!emailRegex.test(email)) {
          emailInput.setCustomValidity("Email is not valid. Please enter a valid email address.");
          emailInput.reportValidity();
          return;
        }
        emailInput.setCustomValidity("");
      }

      if (phoneInput) {
        const normalizedPhone = normalizeAuPhone(phoneInput.value);
        if (!normalizedPhone) {
          phoneInput.setCustomValidity("Phone number must contain numbers only.");
          phoneInput.reportValidity();
          return;
        }
        phoneInput.value = normalizedPhone;
        if (!isAuPhoneLengthValid(normalizedPhone)) {
          phoneInput.setCustomValidity("Phone number length is not valid. Use 8-9 digits after +61.");
          phoneInput.reportValidity();
          return;
        }
        phoneInput.setCustomValidity("");
      }

      if (!form.reportValidity()) {
        return;
      }

      setStatus(status, "", "");

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const response = await fetch(form.action, {
          method: form.method || "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });

        if (!response.ok) {
          let errorMessage = "Something went wrong. Please try again or contact us directly.";
          let payload = null;
          try {
            payload = await response.json();
          } catch (parseError) {
            payload = null;
          }

          if (payload) {
            if (Array.isArray(payload.errors) && payload.errors.length > 0) {
              // Prefer specific backend error messages so users can fix the issue.
              const emailError = payload.errors.find((err) => err.field === "email");
              const phoneError = payload.errors.find((err) => err.field === "phone");
              if (emailError) {
                errorMessage = "Email is not valid. Please enter a valid email address.";
              } else if (phoneError) {
                errorMessage = "Phone number is not valid. Please check the number and try again.";
              } else {
                const turnstileError = payload.errors.find((err) => {
                  if (!err) return false;
                  const field = typeof err.field === "string" ? err.field.toLowerCase() : "";
                  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
                  return field.includes("turnstile") || message.includes("turnstile") || message.includes("captcha");
                });
                if (turnstileError) {
                  errorMessage = "Please verify you are human.";
                  throw new Error(errorMessage);
                }
                const firstMessage = payload.errors.find((err) => err && typeof err.message === "string");
                if (firstMessage && firstMessage.message.trim()) {
                  errorMessage = firstMessage.message.trim();
                }
              }
            } else if (typeof payload.error === "string" && payload.error.trim()) {
              errorMessage = payload.error.trim();
            } else if (typeof payload.message === "string" && payload.message.trim()) {
              errorMessage = payload.message.trim();
            }
          }

          throw new Error(errorMessage);
        }

        form.reset();
        setStatus(
          status,
          form.dataset.successMessage || "Thanks. Your submission has been received.",
          "is-success"
        );
      } catch (error) {
        setStatus(
          status,
          error && error.message
            ? error.message
            : "Something went wrong. Please try again or contact us directly.",
          "is-error"
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  });
});
