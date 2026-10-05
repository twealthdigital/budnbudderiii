(() => {
  "use strict";

  /*
   * ============================================================
   * BUD N' BUDDER — REAL BACKEND AUTHENTICATION
   * ============================================================
   *
   * Backend:
   * http://https://budnbudder-backend.onrender.com/api/auth
   *
   * Authentication uses an HTTP-only cookie set by the backend.
   *
   * IMPORTANT:
   * credentials: "include"
   * must be included on every request that needs cookies.
   * ============================================================
   */

  const API_BASE =
    window.BNB_API_BASE_URL ||
    "http://https://budnbudder-backend.onrender.com/api";

  const AUTH_BASE =
    `${API_BASE}/auth`;

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


  /* ============================================================
     SAFE EXECUTION
  ============================================================ */

  const safe = (fn, ...args) => {
    try {
      return fn(...args);
    } catch (error) {
      console.error("Auth error:", error);
      return null;
    }
  };


  /* ============================================================
     API HELPER
  ============================================================ */

  const apiRequest = async (
    endpoint,
    options = {}
  ) => {
    const response = await fetch(
      `${AUTH_BASE}${endpoint}`,
      {
        credentials: "include",

        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },

        ...options,
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(
        data?.message ||
          "Something went wrong. Please try again."
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  };


  /* ============================================================
     VIEW SWITCHING
  ============================================================ */

  let currentView = "viewSignIn";

  const showAuthView = (viewId) => {
    const views = $$(".auth-view");

    if (!views.length) return;

    views.forEach((view) => {
      const shouldShow =
        view.id === viewId;

      view.hidden = !shouldShow;

      view.classList.toggle(
        "is-active",
        shouldShow
      );
    });

    currentView = viewId;

    clearAllBanners();
    clearAllErrors();

    const panel =
      $(".auth-panel");

    if (panel) {
      panel.scrollTop = 0;
    }
  };


  const initViewSwitching = () => {
    document.addEventListener(
      "click",
      (event) => {
        const trigger =
          event.target.closest(
            "[data-goto]"
          );

        if (!trigger) return;

        const target =
          trigger.dataset.goto;

        if (!target) return;

        event.preventDefault();

        showAuthView(target);
      }
    );

    window.__bnbShowAuthView =
      showAuthView;
  };


  /* ============================================================
     PASSWORD VISIBILITY
  ============================================================ */

  const initPasswordToggles = () => {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "[data-toggle-pw]"
          );

        if (!button) return;

        const targetId =
          button.dataset.togglePw;

        const input =
          document.getElementById(
            targetId
          );

        if (!input) return;

        const showing =
          input.type === "text";

        input.type =
          showing
            ? "password"
            : "text";

        button.setAttribute(
          "aria-label",
          showing
            ? "Show password"
            : "Hide password"
        );
      }
    );
  };


  /* ============================================================
     PASSWORD VALIDATION
  ============================================================ */

  const getPasswordRules = (
    password
  ) => ({
    length:
      password.length >= 8,

    upper:
      /[A-Z]/.test(password),

    lower:
      /[a-z]/.test(password),

    number:
      /[0-9]/.test(password),

    symbol:
      /[^A-Za-z0-9]/.test(password),
  });


  const updatePasswordRequirements = (
    input
  ) => {
    if (!input) return;

    const password =
      input.value || "";

    const rules =
      getPasswordRules(password);

    const panel = $(
      `.pw-requirements[data-for="${input.id}"]`
    );

    if (!panel) return;

    Object.entries(rules).forEach(
      ([rule, passed]) => {
        const item = $(
          `[data-rule="${rule}"]`,
          panel
        );

        if (!item) return;

        item.classList.toggle(
          "is-valid",
          passed
        );

        item.classList.toggle(
          "valid",
          passed
        );
      }
    );
  };


  const validatePassword = (
    input
  ) => {
    if (!input) {
      return false;
    }

    const password =
      input.value.trim();

    const rules =
      getPasswordRules(password);

    updatePasswordRequirements(
      input
    );

    return Object.values(
      rules
    ).every(Boolean);
  };


  const initPasswordRequirementPanels =
    () => {
      const inputs =
        $$(".pw-input");

      inputs.forEach((input) => {
        input.addEventListener(
          "input",
          () => {
            updatePasswordRequirements(
              input
            );
          }
        );

        updatePasswordRequirements(
          input
        );
      });

      return {
        validatePassword,
      };
    };


  /* ============================================================
     ERROR / BANNER HELPERS
  ============================================================ */

  const setFieldError = (
    elementId,
    message
  ) => {
    const element =
      document.getElementById(
        elementId
      );

    if (!element) return;

    element.textContent =
      message || "";

    element.classList.toggle(
      "is-visible",
      Boolean(message)
    );

    element.classList.toggle(
      "visible",
      Boolean(message)
    );
  };


  const clearAllErrors = () => {
    $$(".form-error").forEach(
      (element) => {
        element.textContent = "";

        element.classList.remove(
          "is-visible",
          "visible"
        );
      }
    );
  };


  const showBanner = (
    message,
    type = "error"
  ) => {
    let banner =
      $(".auth-banner");

    if (!banner) {
      banner =
        document.createElement(
          "div"
        );

      banner.className =
        "auth-banner";

      const card =
        $(".auth-card");

      if (card) {
        card.prepend(banner);
      }
    }

    banner.textContent =
      message;

    banner.dataset.type =
      type;

    banner.classList.add(
      "is-visible"
    );

    banner.classList.add(
      "visible"
    );
  };


  const clearBanner = () => {
    const banner =
      $(".auth-banner");

    if (!banner) return;

    banner.textContent = "";

    banner.classList.remove(
      "is-visible",
      "visible"
    );
  };


  const clearAllBanners = () => {
    clearBanner();
  };


  /* ============================================================
     LOADING STATE
  ============================================================ */

  const setLoading = (
    form,
    loading,
    loadingText = "Please wait..."
  ) => {
    if (!form) return;

    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );

    if (!submitButton) return;

    if (loading) {
      if (!submitButton.dataset.originalText) {
        submitButton.dataset.originalText =
          submitButton.innerHTML;
      }

      submitButton.disabled =
        true;

      submitButton.classList.add(
        "is-loading"
      );

      submitButton.innerHTML =
        `<span>${loadingText}</span>`;
    } else {
      submitButton.disabled =
        false;

      submitButton.classList.remove(
        "is-loading"
      );

      if (
        submitButton.dataset.originalText
      ) {
        submitButton.innerHTML =
          submitButton.dataset.originalText;
      }
    }
  };


  /* ============================================================
     EMAIL VALIDATION
  ============================================================ */

  const isValidEmail = (
    email
  ) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email);
  };

    /* ============================================================
     GUEST CART MERGE
     ============================================================ */

  const mergeGuestCartAfterAuth = async () => {
    try {
      if (
        window.BNB &&
        typeof window.BNB.mergeGuestCart === "function"
      ) {
        await window.BNB.mergeGuestCart();
      }
    } catch (error) {
      console.error(
        "Guest cart merge failed:",
        error
      );
    }
  };


  /* ============================================================
     SIGN IN
  ============================================================ */

  const initSignIn = (
    validators = {}
  ) => {
    const form =
      $("#signInForm");

    if (!form) return;

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        clearAllBanners();

        const emailInput =
          $("#signInEmail");

        const passwordInput =
          $("#signInPassword");

        const rememberInput =
          $("#rememberMe");

        const email =
          emailInput?.value
            .trim()
            .toLowerCase();

        const password =
          passwordInput?.value || "";

        const remember =
          Boolean(
            rememberInput?.checked
          );

        let valid = true;

        setFieldError(
          "signInEmailError",
          ""
        );

        setFieldError(
          "signInPasswordError",
          ""
        );

        if (!email) {
          setFieldError(
            "signInEmailError",
            "Email address is required."
          );

          valid = false;
        } else if (
          !isValidEmail(email)
        ) {
          setFieldError(
            "signInEmailError",
            "Please enter a valid email address."
          );

          valid = false;
        }

        /*
         * IMPORTANT:
         * We do NOT enforce the full password
         * complexity rules during login.
         *
         * The backend decides whether the
         * supplied password is correct.
         */

        if (!password) {
          setFieldError(
            "signInPasswordError",
            "Password is required."
          );

          valid = false;
        }

        if (!valid) return;

        setLoading(
          form,
          true,
          "Signing In..."
        );

        try {
          const data =
            await apiRequest(
              "/login",
              {
                method: "POST",

                body: JSON.stringify({
                  email,
                  password,
                  remember,
                }),
              }
            );

          if (!data?.success) {
            throw new Error(
              data?.message ||
                "Unable to sign in."
            );
          }

          /*
           * The backend has now set the
           * HTTP-only authentication cookie.
           *
           * Do NOT store the token in
           * localStorage/sessionStorage.
           */

          showBanner(
  "Login successful. Syncing your cart...",
  "success"
);

await mergeGuestCartAfterAuth();

window.location.href =
  "index.html";

        } catch (error) {
          console.error(
            "Sign in error:",
            error
          );

          const status =
            error.status;

          if (status === 401) {
            setFieldError(
              "signInPasswordError",
              error.message ||
                "Incorrect email or password."
            );
          } else if (
            status === 403
          ) {
            showBanner(
              error.message ||
                "This account is inactive."
            );
          } else {
            showBanner(
              error.message ||
                "Unable to sign in. Please try again."
            );
          }
        } finally {
          setLoading(
            form,
            false
          );
        }
      }
    );
  };


  /* ============================================================
     SIGN UP
  ============================================================ */

  const initSignUp = (
    validators = {}
  ) => {
    const form =
      $("#signUpForm");

    if (!form) return;

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        clearAllBanners();

        const nameInput =
          $("#signUpName");

        const emailInput =
          $("#signUpEmail");

        const passwordInput =
          $("#signUpPassword");

        const confirmInput =
          $("#signUpConfirm");

        const termsInput =
          $("#agreeTerms");

        const fullName =
          nameInput?.value
            .trim()
            .replace(/\s+/g, " ");

        const email =
          emailInput?.value
            .trim()
            .toLowerCase();

        const password =
          passwordInput?.value || "";

        const confirmPassword =
          confirmInput?.value || "";

        let valid = true;

        setFieldError(
          "signUpNameError",
          ""
        );

        setFieldError(
          "signUpEmailError",
          ""
        );

        setFieldError(
          "signUpPasswordError",
          ""
        );

        setFieldError(
          "signUpConfirmError",
          ""
        );

        if (!fullName) {
          setFieldError(
            "signUpNameError",
            "Full name is required."
          );

          valid = false;
        } else {
          const nameParts =
            fullName.split(" ");

          if (
            nameParts.length < 2
          ) {
            setFieldError(
              "signUpNameError",
              "Please enter your first and last name."
            );

            valid = false;
          }
        }

        if (!email) {
          setFieldError(
            "signUpEmailError",
            "Email address is required."
          );

          valid = false;
        } else if (
          !isValidEmail(email)
        ) {
          setFieldError(
            "signUpEmailError",
            "Please enter a valid email address."
          );

          valid = false;
        }

        const passwordValid =
          validatePassword(
            passwordInput
          );

        if (!password) {
          setFieldError(
            "signUpPasswordError",
            "Password is required."
          );

          valid = false;
        } else if (
          !passwordValid
        ) {
          setFieldError(
            "signUpPasswordError",
            "Password does not meet all requirements."
          );

          valid = false;
        }

        if (!confirmPassword) {
          setFieldError(
            "signUpConfirmError",
            "Please confirm your password."
          );

          valid = false;
        } else if (
          password !==
          confirmPassword
        ) {
          setFieldError(
            "signUpConfirmError",
            "Passwords do not match."
          );

          valid = false;
        }

        if (
          !termsInput?.checked
        ) {
          showBanner(
            "You must confirm that you're 21+ and agree to the Terms and Privacy Policy."
          );

          valid = false;
        }

        if (!valid) return;

        /*
         * Convert:
         *
         * "John Michael Doe"
         *
         * into:
         *
         * firstName = "John"
         * lastName = "Michael Doe"
         */

        const nameParts =
          fullName.split(" ");

        const firstName =
          nameParts.shift();

        const lastName =
          nameParts.join(" ");

        setLoading(
          form,
          true,
          "Creating Account..."
        );

        try {
          const data =
            await apiRequest(
              "/register",
              {
                method: "POST",

                body: JSON.stringify({
                  firstName,
                  lastName,
                  email,

                  /*
                   * Your current frontend does
                   * not have a phone field.
                   *
                   * Backend accepts phone as
                   * optional, so send an empty
                   * string.
                   */
                  phone: "",

                  password,
                }),
              }
            );

          if (!data?.success) {
            throw new Error(
              data?.message ||
                "Unable to create account."
            );
          }

          /*
           * Registration automatically
           * authenticates the customer because
           * the backend sets the token cookie.
           */

          showBanner(
  "Account created successfully. Syncing your cart...",
  "success"
);

await mergeGuestCartAfterAuth();

window.location.href =
  "index.html";

        } catch (error) {
          console.error(
            "Sign up error:",
            error
          );

          if (
            error.status === 409
          ) {
            setFieldError(
              "signUpEmailError",
              error.message ||
                "An account with this email already exists."
            );
          } else if (
            error.status === 400
          ) {
            showBanner(
              error.message ||
                "Please check your information."
            );
          } else {
            showBanner(
              error.message ||
                "Unable to create account. Please try again."
            );
          }
        } finally {
          setLoading(
            form,
            false
          );
        }
      }
    );
  };


  /* ============================================================
     FORGOT PASSWORD
     ============================================================ */

  let resetEmail = "";
  let resetCode = "";


  /* ------------------------------------------------------------
     STEP 1 — SEND CODE
  ------------------------------------------------------------ */

  const initForgotPassword =
    () => {
      const emailForm =
        $("#forgotEmailForm");

      const codeForm =
        $("#forgotCodeForm");

      const resetForm =
        $("#forgotResetForm");

      const resendButton =
        $("#resendCodeBtn");


      /* ========================================================
         SEND RESET CODE
      ======================================================== */

      if (emailForm) {
        emailForm.addEventListener(
          "submit",
          async (event) => {
            event.preventDefault();

            clearAllBanners();

            const emailInput =
              $("#forgotEmail");

            const email =
              emailInput?.value
                .trim()
                .toLowerCase();

            setFieldError(
              "forgotEmailError",
              ""
            );

            if (!email) {
              setFieldError(
                "forgotEmailError",
                "Email address is required."
              );

              return;
            }

            if (
              !isValidEmail(email)
            ) {
              setFieldError(
                "forgotEmailError",
                "Please enter a valid email address."
              );

              return;
            }

            setLoading(
              emailForm,
              true,
              "Sending Code..."
            );

            try {
              const data =
                await apiRequest(
                  "/forgot-password/send-code",
                  {
                    method: "POST",

                    body: JSON.stringify({
                      email,
                    }),
                  }
                );

              if (!data?.success) {
                throw new Error(
                  data?.message ||
                    "Unable to send verification code."
                );
              }

              resetEmail =
                email;

              const display =
                $("#forgotEmailDisplay");

              if (display) {
                display.textContent =
                  email;
              }

              const codeInput =
                $("#forgotCode");

              if (codeInput) {
                codeInput.value =
                  "";
              }

              showAuthView(
                "viewForgotCode"
              );

            } catch (error) {
              console.error(
                "Send reset code error:",
                error
              );

              showBanner(
                error.message ||
                  "Unable to send verification code. Please try again."
              );
            } finally {
              setLoading(
                emailForm,
                false
              );
            }
          }
        );
      }


      /* ========================================================
         STEP 2 — VERIFY CODE
      ======================================================== */

      if (codeForm) {
        codeForm.addEventListener(
          "submit",
          async (event) => {
            event.preventDefault();

            clearAllBanners();

            const codeInput =
              $("#forgotCode");

            const code =
              codeInput?.value
                .trim();

            setFieldError(
              "forgotCodeError",
              ""
            );

            if (!code) {
              setFieldError(
                "forgotCodeError",
                "Verification code is required."
              );

              return;
            }

            if (
              !/^\d{6}$/.test(code)
            ) {
              setFieldError(
                "forgotCodeError",
                "Enter the 6-digit verification code."
              );

              return;
            }

            if (!resetEmail) {
              showBanner(
                "Your reset session has expired. Please request a new code."
              );

              showAuthView(
                "viewForgotEmail"
              );

              return;
            }

            setLoading(
              codeForm,
              true,
              "Verifying..."
            );

            try {
              const data =
                await apiRequest(
                  "/forgot-password/verify-code",
                  {
                    method: "POST",

                    body: JSON.stringify({
                      email:
                        resetEmail,
                      code,
                    }),
                  }
                );

              if (!data?.success) {
                throw new Error(
                  data?.message ||
                    "Unable to verify code."
                );
              }

              resetCode =
                code;

              /*
               * Code is valid.
               * Now we need the new password.
               */

              showAuthView(
                "viewForgotReset"
              );

            } catch (error) {
              console.error(
                "Verify reset code error:",
                error
              );

              setFieldError(
                "forgotCodeError",
                error.message ||
                  "Invalid or expired verification code."
              );
            } finally {
              setLoading(
                codeForm,
                false
              );
            }
          }
        );
      }


      /* ========================================================
         STEP 3 — RESET PASSWORD
      ======================================================== */

      if (resetForm) {
        resetForm.addEventListener(
          "submit",
          async (event) => {
            event.preventDefault();

            clearAllBanners();

            const passwordInput =
              $("#forgotNewPassword");

            const confirmInput =
              $("#forgotConfirmPassword");

            const newPassword =
              passwordInput?.value ||
              "";

            const confirmPassword =
              confirmInput?.value ||
              "";

            let valid = true;

            setFieldError(
              "forgotNewPasswordError",
              ""
            );

            setFieldError(
              "forgotConfirmPasswordError",
              ""
            );

            if (!newPassword) {
              setFieldError(
                "forgotNewPasswordError",
                "New password is required."
              );

              valid = false;
            } else if (
              !validatePassword(
                passwordInput
              )
            ) {
              setFieldError(
                "forgotNewPasswordError",
                "Password does not meet all requirements."
              );

              valid = false;
            }

            if (!confirmPassword) {
              setFieldError(
                "forgotConfirmPasswordError",
                "Please confirm your new password."
              );

              valid = false;
            } else if (
              newPassword !==
              confirmPassword
            ) {
              setFieldError(
                "forgotConfirmPasswordError",
                "Passwords do not match."
              );

              valid = false;
            }

            if (
              !resetEmail ||
              !resetCode
            ) {
              showBanner(
                "Your password reset session has expired. Please start again."
              );

              showAuthView(
                "viewForgotEmail"
              );

              return;
            }

            if (!valid) return;

            setLoading(
              resetForm,
              true,
              "Resetting Password..."
            );

            try {
              const data =
                await apiRequest(
                  "/forgot-password/reset",
                  {
                    method: "POST",

                    body: JSON.stringify({
                      email:
                        resetEmail,

                      code:
                        resetCode,

                      newPassword,
                    }),
                  }
                );

              if (!data?.success) {
                throw new Error(
                  data?.message ||
                    "Unable to reset password."
                );
              }

              /*
               * Clear reset information.
               */

              resetEmail = "";
              resetCode = "";

              resetForm.reset();

              showAuthView(
                "viewForgotSuccess"
              );

            } catch (error) {
              console.error(
                "Reset password error:",
                error
              );

              showBanner(
                error.message ||
                  "Unable to reset password. Please try again."
              );
            } finally {
              setLoading(
                resetForm,
                false
              );
            }
          }
        );
      }


      /* ========================================================
         RESEND CODE
      ======================================================== */

      if (resendButton) {
        resendButton.addEventListener(
          "click",
          async () => {
            if (!resetEmail) {
              showAuthView(
                "viewForgotEmail"
              );

              return;
            }

            clearAllBanners();

            resendButton.disabled =
              true;

            const originalText =
              resendButton.textContent;

            resendButton.textContent =
              "Sending...";

            try {
              const data =
                await apiRequest(
                  "/forgot-password/send-code",
                  {
                    method: "POST",

                    body: JSON.stringify({
                      email:
                        resetEmail,
                    }),
                  }
                );

              if (!data?.success) {
                throw new Error(
                  data?.message ||
                    "Unable to resend code."
                );
              }

              showBanner(
                "A new verification code has been sent.",
                "success"
              );

            } catch (error) {
              console.error(
                "Resend code error:",
                error
              );

              showBanner(
                error.message ||
                  "Unable to resend verification code."
              );
            } finally {
              resendButton.disabled =
                false;

              resendButton.textContent =
                originalText;
            }
          }
        );
      }
    };


  /* ============================================================
     CHECK CURRENT AUTHENTICATION
  ============================================================ */

  const getCurrentUser =
    async () => {
      try {
        const data =
          await apiRequest(
            "/me",
            {
              method: "GET",
            }
          );

        if (
          data?.success &&
          data?.user
        ) {
          return data.user;
        }

        return null;
      } catch (error) {
        /*
         * 401 simply means there is
         * currently no authenticated user.
         */
        if (
          error.status !== 401
        ) {
          console.error(
            "Get current user error:",
            error
          );
        }

        return null;
      }
    };


  /* ============================================================
     LOGOUT
  ============================================================ */

  const logout =
    async () => {
      try {
        await apiRequest(
          "/logout",
          {
            method: "POST",
          }
        );

        return true;
      } catch (error) {
        console.error(
          "Logout error:",
          error
        );

        return false;
      }
    };


  /*
   * Make auth helpers available
   * to the rest of the website.
   *
   * Other files can use:
   *
   * window.BNBAuth.getCurrentUser()
   * window.BNBAuth.logout()
   */

  window.BNBAuth = {
    getCurrentUser,
    logout,
    showAuthView,
  };


  /* ============================================================
     INITIALIZATION
  ============================================================ */

  const init = () => {
    safe(
      initViewSwitching
    );

    safe(
      initPasswordToggles
    );

    const validators =
      safe(
        initPasswordRequirementPanels
      ) || {};

    safe(
      initSignIn,
      validators
    );

    safe(
      initSignUp,
      validators
    );

    safe(
      initForgotPassword
    );

    /*
     * Start on Sign In.
     */
    showAuthView(
      "viewSignIn"
    );
  };


  /*
   * Your site uses partials:loaded.
   * Keep compatibility with that system.
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true,
      }
    );
  } else {
    init();
  }

  document.addEventListener(
    "partials:loaded",
    () => {
      /*
       * Don't initialize twice.
       * The DOMContentLoaded initialization
       * is enough for this page.
       */
    },
    {
      once: true,
    }
  );

})();