const API_URL = "https://ai-impact-server.vercel.app";

async function AuthenticateUser() {
    try {
        const response = await fetch(`${API_URL}/api/auth/validate-session`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            localStorage.removeItem("impactech_user");
            localStorage.removeItem("impactech_token");

            return {
                success: false,
                user: null
            };
        }

        if (data.user) {
            localStorage.setItem("impactech_user", JSON.stringify(data.user));
        }

        return {
            success: true,
            user: data.user
        };

    } catch (error) {
        console.error("AuthenticateUser error:", error);

        return {
            success: false,
            user: null
        };
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin.html";
        return;
    }

    initCheckoutPage(auth.user);
    console.log("Authenticated user:", auth.user);
});

const checkoutForm = document.getElementById("jobCheckoutForm");
const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');

const cardPaymentBox = document.getElementById("cardPaymentBox");
const bankTransferBox = document.getElementById("bankTransferBox");

const jobIdText = document.getElementById("jobIdText");
const paymentReference = document.getElementById("paymentReference");
const totalAmount = document.getElementById("totalAmount");

const billingCheck = document.querySelector('input[name="useSavedBillingAddress"]');
const billingName = document.querySelector('input[name="billingName"]');
const billingPhone = document.querySelector('input[name="billingPhone"]');
const billingAddress = document.querySelector('textarea[name="billingAddress"]');

const payBtn = document.querySelector(".pay-btn");

const loader = document.createElement("div");
loader.className = "checkout-loader";
loader.innerHTML = `
    <div class="loader-card">
        <div class="loader-ring"></div>
        <h3>Processing...</h3>
        <p>Please wait while we prepare your checkout.</p>
    </div>
`;
document.body.appendChild(loader);

const toast = document.createElement("div");
toast.className = "checkout-toast";
document.body.appendChild(toast);

const params = new URLSearchParams(window.location.search);

const jobId =
    params.get("Id") ||
    params.get("id") ||
    params.get("jobId") ||
    "unknown-job";

const payMeth =
    params.get("payMeth") ||
    params.get("paymentMethod") ||
    "card";

const amount =
    Number(params.get("amount") || params.get("pay") || 0);

let finalAmount = {
    originalUSD: amount,
    displayAmount: `$${amount}`,
    currency: "USD",
    exchangeRate: null,
    country: null
};

async function getJobPaymentDetails() {
    try {
        const response = await fetch(
            `${API_URL}/api/get-job-payment-details/${encodeURIComponent(jobId)}`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to load job payment");
        }

        return data;

    } catch (error) {
        console.error("GET JOB PAYMENT ERROR:", error);
        throw error;
    }
}

async function initCheckoutPage(user) {
    jobIdText.textContent = jobId;
    totalAmount.textContent = "--";

    const jobData = await getJobPaymentDetails();
    const usdAmount = Number(jobData.amount || 0);

    const cleanMethod = String(
        payMeth || jobData.paymentMethod || "card"
    ).toLowerCase();

    if (cleanMethod.includes("bank")) {
        setPaymentMethod("bank_transfer");
    } else {
        setPaymentMethod("card");
    }

    updateBillingState();

    const countryResult = await checkCountryAndLoadNgnRate();

    if (
        countryResult.success &&
        String(countryResult.country || "").toLowerCase() === "nigeria" &&
        countryResult.exchange
    ) {
        const rate =
            Number(countryResult.exchange.flutterwave?.data?.rate) ||
            Number(countryResult.exchange.flutterwave?.data?.exchange_rate) ||
            0;

        if (rate > 0) {
            const amountInNgn = Math.round(usdAmount * rate);

            finalAmount = {
                originalUSD: usdAmount,
                displayAmount: `₦${amountInNgn.toLocaleString()}`,
                currency: "NGN",
                exchangeRate: rate,
                country: "Nigeria"
            };

            totalAmount.textContent = finalAmount.displayAmount;
            return;
        }
    }

    finalAmount = {
        originalUSD: usdAmount,
        displayAmount: `$${usdAmount}`,
        currency: "USD",
        exchangeRate: null,
        country: countryResult.country || null
    };

    totalAmount.textContent = finalAmount.displayAmount;
}

async function setPaymentMethod(method) {
    paymentRadios.forEach(radio => {
        radio.checked = radio.value === method;
    });

    if (method === "bank_transfer") {
        cardPaymentBox.classList.add("hidden");
        bankTransferBox.classList.add("active");

        payBtn.innerHTML = `
            Confirm Bank Transfer
            <i class="fa-solid fa-arrow-right"></i>
        `;

        await generateJobVirtualAccount();

    } else {
        cardPaymentBox.classList.remove("hidden");
        bankTransferBox.classList.remove("active");

        payBtn.innerHTML = `
            Continue Card Payment
            <i class="fa-solid fa-arrow-right"></i>
        `;
    }
}

function renderVirtualAccount(account) {
    generatedVirtualAccount = account;

    const accountBox =
        bankTransferBox.querySelector(".bank-box");

    if (!accountBox) return;

    accountBox.innerHTML = `
        <div class="bank-row">
            <span>Bank Name</span>
            <strong>${account.bankName || "Not available"}</strong>
        </div>

        <div class="bank-row">
            <span>Account Name</span>
            <strong>${account.accountName || "Not available"}</strong>
        </div>

        <div class="bank-row">
            <span>Account Number</span>
            <strong>${account.accountNumber || "Not available"}</strong>
        </div>

        <div class="bank-row">
            <span>Amount</span>
            <strong>₦${Number(account.amount || 0).toLocaleString()}</strong>
        </div>

        <div class="bank-row">
            <span>Payment Reference</span>
            <strong>${account.txRef || jobId}</strong>
        </div>

        <div class="bank-row">
            <span>Expires</span>
            <strong>
                ${
                    account.expiresAtISO
                        ? new Date(account.expiresAtISO).toLocaleString()
                        : "Soon"
                }
            </strong>
        </div>
    `;
}

async function generateJobVirtualAccount() {
    try {
        if (!jobId || jobId === "unknown-job") {
            showToast("Missing job ID.", "error");
            return null;
        }

        payBtn.disabled = true;
        payBtn.innerHTML = `
            Generating Account...
            <i class="fa-solid fa-spinner fa-spin"></i>
        `;

        const response = await fetch(`${API_URL}/api/generate-job-virtual-account`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ jobId })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to generate virtual account");
        }

        renderVirtualAccount(data.virtualAccount);

        showToast(
            data.reused
                ? "Existing virtual account loaded."
                : "Virtual account generated successfully.",
            "success"
        );

        return data.virtualAccount;

    } catch (error) {
        console.error("GENERATE VIRTUAL ACCOUNT ERROR:", error);
        showToast(error.message || "Failed to generate bank account.", "error");
        return null;

    } finally {
        payBtn.disabled = false;
        payBtn.innerHTML = `
            Confirm Bank Transfer
            <i class="fa-solid fa-arrow-right"></i>
        `;
    }
}
function getSelectedPaymentMethod() {
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    return selected ? selected.value : "card";
}

function updateBillingState() {
    const useSaved = billingCheck.checked;

    billingName.disabled = useSaved;
    billingPhone.disabled = useSaved;
    billingAddress.disabled = useSaved;

    if (useSaved) {
        billingName.value = "";
        billingPhone.value = "";
        billingAddress.value = "";

        billingName.placeholder = "Using saved billing name";
        billingPhone.placeholder = "Using saved billing phone";
        billingAddress.placeholder = "Using saved billing address";
    } else {
        billingName.placeholder = "Your full name or company name";
        billingPhone.placeholder = "+234...";
        billingAddress.placeholder = "Street, city, state, country";
    }
}

function validateCheckout() {
    const method = getSelectedPaymentMethod();

    if (!jobId || jobId === "unknown-job") {
        showToast("Missing job ID. Please go back and try again.", "error");
        return false;
    }

    if (method === "bank_transfer") {
        return true;
    }

    if (method === "card") {
        const cardName = document.querySelector('input[name="cardName"]');
        const cardNumber = document.querySelector('input[name="cardNumber"]');
        const expiryDate = document.querySelector('input[name="expiryDate"]');
        const cvv = document.querySelector('input[name="cvv"]');

        if (!cardName.value.trim()) {
            cardName.focus();
            showToast("Please enter cardholder name.", "error");
            return false;
        }

        if (!cardNumber.value.trim()) {
            cardNumber.focus();
            showToast("Please enter card number.", "error");
            return false;
        }

        if (!expiryDate.value.trim()) {
            expiryDate.focus();
            showToast("Please enter expiry date.", "error");
            return false;
        }

        if (!cvv.value.trim()) {
            cvv.focus();
            showToast("Please enter CVV.", "error");
            return false;
        }
    }

    return true;
}

function getCheckoutData() {
    return {
        jobId,
        paymentMethod: getSelectedPaymentMethod(),

        amount: finalAmount.currency === "NGN"
            ? finalAmount.displayAmount
            : Number(amount),

        originalUSD: finalAmount.originalUSD,
        currency: finalAmount.currency,
        exchangeRate: finalAmount.exchangeRate,
        country: finalAmount.country,

        useSavedBillingAddress: billingCheck.checked,
        billing: {
            billingName: billingName.value.trim(),
            billingPhone: billingPhone.value.trim(),
            billingAddress: billingAddress.value.trim()
        }
    };
}

function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `checkout-toast show ${type}`;

    setTimeout(() => {
        toast.className = "checkout-toast";
    }, 3000);
}

function showLoader() {
    loader.classList.add("show");
}

function hideLoader() {
    loader.classList.remove("show");
}

async function checkCountryAndLoadNgnRate() {
    try {
        const locationRes = await fetch(`${API_URL}/api/get-ip-location`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const locationData = await locationRes.json().catch(() => ({}));

        if (!locationRes.ok || !locationData.success) {
            return {
                success: false,
                country: null,
                exchange: null
            };
        }

        const country =
            String(locationData.country || "")
                .trim()
                .toLowerCase();

        if (country === "nigeria") {
            const exchangeRes = await fetch(`${API_URL}/api/usd-exchage-rate-to-ngn`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const exchangeData = await exchangeRes.json().catch(() => ({}));

            return {
                success: true,
                country: "Nigeria",
                exchange: exchangeData
            };
        }

        return {
            success: true,
            country: locationData.country,
            exchange: null
        };

    } catch (error) {
        console.error("COUNTRY CHECK ERROR:", error);

        return {
            success: false,
            country: null,
            exchange: null
        };
    }
}

paymentRadios.forEach(radio => {
    radio.addEventListener("change", () => {
        setPaymentMethod(radio.value);
    });
});

billingCheck.addEventListener("change", updateBillingState);

checkoutForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const checkoutData = getCheckoutData();

    if (checkoutData.paymentMethod === "bank_transfer") {
        if (!generatedVirtualAccount) {
            const account = await generateJobVirtualAccount();

            if (!account) {
                return;
            }
        }

        showToast("Use the generated account number to complete payment.", "success");
        return;
    }

    if (!validateCheckout()) return;

    showLoader();

    payBtn.disabled = true;
    payBtn.innerHTML = `
        Processing...
        <i class="fa-solid fa-spinner fa-spin"></i>
    `;

    try {
        console.log("CHECKOUT DATA:", checkoutData);

        setTimeout(() => {
            hideLoader();

            showToast("Card payment is ready to process.", "success");

            payBtn.disabled = false;
            setPaymentMethod(checkoutData.paymentMethod);

        }, 1500);

    } catch (error) {
        hideLoader();

        payBtn.disabled = false;
        setPaymentMethod(checkoutData.paymentMethod);

        showToast(error.message || "Payment failed. Please try again.", "error");
        console.error("CHECKOUT ERROR:", error);
    }
});