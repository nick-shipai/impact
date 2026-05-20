document.addEventListener("DOMContentLoaded", () => {
    const planSelect = document.querySelector('select[name="plan"]');
    const serviceSelect = document.querySelector('select[name="service"]');
    const timelineSelect = document.querySelector('select[name="timeline"]');
    const hoursSelect = document.querySelector('select[name="hours"]');

    const addonChecks = document.querySelectorAll('input[name="addon"]');

    const checkoutBtn = document.querySelector(".checkout-now-btn");
    const proceedBtn = document.querySelector(".summary-box .primary");

    const planPrices = {
        "Starter Support - $49": 49,
        "Business Support - $149": 149,
        "Growth Support - $299": 299,
        "Custom Project - Quote Required": 0
    };

    const addonPrices = {
        priority: 30,
        automation: 75,
        social: 60,
        report: 45,
        consultation: 50
    };

    const addonNames = {
        priority: "Priority Delivery",
        automation: "Extra Automation Setup",
        social: "Social Media Content Support",
        report: "Business Report & Workflow Review",
        consultation: "1-on-1 Strategy Consultation"
    };

    const timelineFees = {
        "ASAP": 25,
        "Within 3 Days": 15,
        "Within 1 Week": 0,
        "Within 2 Weeks": 0,
        "Flexible": 0
    };

    const hourFees = {
        "5 Hours": 0,
        "10 Hours": 35,
        "20 Hours": 85,
        "40 Hours": 170,
        "Monthly Support": 250,
        "Not Sure Yet": 0
    };

    const summaryBox = document.querySelector(".summary-box");

    function createLiveSummary() {
        if (!summaryBox) return;

        summaryBox.innerHTML = `
            <h3>Checkout Summary</h3>

            <div class="summary-row">
                <span>Selected Service</span>
                <strong id="summaryService">Not selected</strong>
            </div>

            <div class="summary-row">
                <span>Selected Plan</span>
                <strong id="summaryPlan">Not selected</strong>
            </div>

            <div class="summary-row">
                <span>Plan Price</span>
                <strong id="summaryPlanPrice">$0</strong>
            </div>

            <div class="summary-row">
                <span>Add-ons</span>
                <strong id="summaryAddons">None</strong>
            </div>

            <div class="summary-row">
                <span>Add-ons Total</span>
                <strong id="summaryAddonTotal">$0</strong>
            </div>

            <div class="summary-row">
                <span>Timeline Fee</span>
                <strong id="summaryTimeline">$0</strong>
            </div>

            <div class="summary-row">
                <span>Support Hours Fee</span>
                <strong id="summaryHours">$0</strong>
            </div>

            <div class="summary-total">
                <span>Total</span>
                <strong id="summaryTotal">$0</strong>
            </div>

            <div class="summary-row">
                <span>Deposit 50%</span>
                <strong id="summaryDeposit">$0</strong>
            </div>

            <div class="summary-row">
                <span>Balance Later</span>
                <strong id="summaryBalance">$0</strong>
            </div>

            <a href="#payment" class="primary" id="proceedToPayment">Proceed To Payment</a>
        `;
    }

    createLiveSummary();

    function money(amount) {
        return `$${amount.toFixed(2)}`;
    }

    function getSelectedPlanPrice() {
        const plan = planSelect?.value || "";
        return planPrices[plan] || 0;
    }

    function getSelectedAddons() {
        let selected = [];
        let total = 0;

        addonChecks.forEach(check => {
            if (check.checked) {
                selected.push(addonNames[check.value]);
                total += addonPrices[check.value] || 0;
            }
        });

        return { selected, total };
    }

    function getTimelineFee() {
        const timeline = timelineSelect?.value || "";
        return timelineFees[timeline] || 0;
    }

    function getHourFee() {
        const hours = hoursSelect?.value || "";
        return hourFees[hours] || 0;
    }

    function updateSummary() {
        const service = serviceSelect?.value || "Not selected";
        const plan = planSelect?.value || "Not selected";

        const planPrice = getSelectedPlanPrice();
        const addons = getSelectedAddons();
        const timelineFee = getTimelineFee();
        const hourFee = getHourFee();

        const total = planPrice + addons.total + timelineFee + hourFee;
        const deposit = total / 2;
        const balance = total - deposit;

        document.getElementById("summaryService").textContent = service;
        document.getElementById("summaryPlan").textContent = plan;
        document.getElementById("summaryPlanPrice").textContent = money(planPrice);
        document.getElementById("summaryAddons").textContent =
            addons.selected.length ? addons.selected.join(", ") : "None";
        document.getElementById("summaryAddonTotal").textContent = money(addons.total);
        document.getElementById("summaryTimeline").textContent = money(timelineFee);
        document.getElementById("summaryHours").textContent = money(hourFee);
        document.getElementById("summaryTotal").textContent = money(total);
        document.getElementById("summaryDeposit").textContent = money(deposit);
        document.getElementById("summaryBalance").textContent = money(balance);

        updatePaymentCards(total, deposit);
        saveCheckoutData(total, deposit, balance);
    }

    function updatePaymentCards(total, deposit) {
        const paymentCards = document.querySelectorAll("#payment .service-card");

        if (paymentCards[0]) {
            paymentCards[0].querySelector("h2").textContent = total > 0 ? money(total) : "$49 - $299";
        }

        if (paymentCards[1]) {
            paymentCards[1].querySelector("h2").textContent = total > 0 ? money(deposit) : "50%";
        }

        if (paymentCards[2]) {
            const customText = total > 0 ? "Need changes?" : "$---";
            paymentCards[2].querySelector("h2").textContent = customText;
        }
    }

    function saveCheckoutData(total, deposit, balance) {
        const checkoutData = {
            fullname: document.querySelector('input[name="fullname"]')?.value || "",
            email: document.querySelector('input[name="email"]')?.value || "",
            phone: document.querySelector('input[name="phone"]')?.value || "",
            company: document.querySelector('input[name="company"]')?.value || "",
            country: document.querySelector('input[name="country"]')?.value || "",
            website: document.querySelector('input[name="website"]')?.value || "",
            service: serviceSelect?.value || "",
            plan: planSelect?.value || "",
            timeline: timelineSelect?.value || "",
            hours: hoursSelect?.value || "",
            project: document.querySelector('textarea[name="project"]')?.value || "",
            addons: getSelectedAddons().selected,
            total,
            deposit,
            balance,
            currency: "USD"
        };

        localStorage.setItem("impactechCheckout", JSON.stringify(checkoutData));
    }

    function validateCheckout() {
        const fullname = document.querySelector('input[name="fullname"]');
        const email = document.querySelector('input[name="email"]');
        const service = serviceSelect;
        const plan = planSelect;
        const project = document.querySelector('textarea[name="project"]');

        const requiredFields = [fullname, email, service, plan, project];

        let valid = true;

        requiredFields.forEach(field => {
            if (!field || !field.value.trim()) {
                field.classList.add("input-error");
                valid = false;
            } else {
                field.classList.remove("input-error");
            }
        });

        if (!valid) {
            showToast("Please fill all required checkout details.");
            return false;
        }

        return true;
    }

    function showToast(message) {
        let toast = document.querySelector(".checkout-toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.className = "checkout-toast";
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function scrollToPayment() {
        if (!validateCheckout()) return;

        updateSummary();
        showToast("Checkout details saved. Continue to payment.");

        const payment = document.getElementById("payment");
        if (payment) {
            payment.scrollIntoView({ behavior: "smooth" });
        }
    }

    const allInputs = document.querySelectorAll("input, select, textarea");

    allInputs.forEach(input => {
        input.addEventListener("input", updateSummary);
        input.addEventListener("change", updateSummary);
    });

    addonChecks.forEach(check => {
        check.addEventListener("change", () => {
            const parent = check.closest(".addon-option");

            if (parent) {
                if (check.checked) {
                    parent.classList.add("addon-selected");
                } else {
                    parent.classList.remove("addon-selected");
                }
            }

            updateSummary();
        });
    });

    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", e => {
            e.preventDefault();
            scrollToPayment();
        });
    }

    document.addEventListener("click", e => {
        if (e.target && e.target.id === "proceedToPayment") {
            e.preventDefault();
            scrollToPayment();
        }
    });

    const planButtons = document.querySelectorAll("#plans .service-card .primary");

    planButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            if (!planSelect) return;

            if (index === 0) planSelect.value = "Starter Support - $49";
            if (index === 1) planSelect.value = "Business Support - $149";
            if (index === 2) planSelect.value = "Growth Support - $299";

            updateSummary();

            setTimeout(() => {
                const checkout = document.getElementById("checkout");
                if (checkout) checkout.scrollIntoView({ behavior: "smooth" });
            }, 100);
        });
    });

    const paymentButtons = document.querySelectorAll("#payment .service-card .primary");

    paymentButtons.forEach((btn, index) => {
        btn.addEventListener("click", e => {
            e.preventDefault();

            if (!validateCheckout()) return;

            const saved = JSON.parse(localStorage.getItem("impactechCheckout")) || {};

            if (index === 0) {
                saved.paymentType = "Full Payment";
            }

            if (index === 1) {
                saved.paymentType = "50% Deposit";
            }

            if (index === 2) {
                saved.paymentType = "Custom Quote";
            }

            localStorage.setItem("impactechCheckout", JSON.stringify(saved));

            showToast(`${saved.paymentType} selected. Payment page coming next.`);
        });
    });

    function loadSavedCheckout() {
        const saved = JSON.parse(localStorage.getItem("impactechCheckout"));

        if (!saved) return;

        const fieldMap = {
            fullname: 'input[name="fullname"]',
            email: 'input[name="email"]',
            phone: 'input[name="phone"]',
            company: 'input[name="company"]',
            country: 'input[name="country"]',
            website: 'input[name="website"]',
            project: 'textarea[name="project"]'
        };

        Object.keys(fieldMap).forEach(key => {
            const field = document.querySelector(fieldMap[key]);
            if (field && saved[key]) field.value = saved[key];
        });

        if (serviceSelect && saved.service) serviceSelect.value = saved.service;
        if (planSelect && saved.plan) planSelect.value = saved.plan;
        if (timelineSelect && saved.timeline) timelineSelect.value = saved.timeline;
        if (hoursSelect && saved.hours) hoursSelect.value = saved.hours;

        if (saved.addons && Array.isArray(saved.addons)) {
            addonChecks.forEach(check => {
                const name = addonNames[check.value];

                if (saved.addons.includes(name)) {
                    check.checked = true;
                    check.closest(".addon-option")?.classList.add("addon-selected");
                }
            });
        }

        updateSummary();
    }

    loadSavedCheckout();
    updateSummary();
});
document.addEventListener("DOMContentLoaded", () => {
    const $ = selector => document.querySelector(selector);
    const $$ = selector => document.querySelectorAll(selector);

    const planSelect = $('select[name="plan"]');
    const serviceSelect = $('select[name="service"]');
    const timelineSelect = $('select[name="timeline"]');
    const hoursSelect = $('select[name="hours"]');
    const projectBox = $('textarea[name="project"]');
    const addonChecks = $$('input[name="addon"]');

    const checkoutBtn = $(".checkout-now-btn");
    const planButtons = $$("#plans .service-card .primary");
    const paymentButtons = $$("#payment .service-card .primary");

    const planPrices = {
        "Starter Support - $49": 49,
        "Business Support - $149": 149,
        "Growth Support - $299": 299,
        "Custom Project - Quote Required": 0
    };

    const planLabels = {
        "Starter Support - $49": "Starter Support",
        "Business Support - $149": "Business Support",
        "Growth Support - $299": "Growth Support",
        "Custom Project - Quote Required": "Custom Quote"
    };

    const serviceDefaultByPlan = {
        "Starter Support - $49": "Administrative Support",
        "Business Support - $149": "Virtual Assistance",
        "Growth Support - $299": "AI Automation",
        "Custom Project - Quote Required": ""
    };

    const addonPrices = {
        priority: 30,
        automation: 75,
        social: 60,
        report: 45,
        consultation: 50
    };

    const addonNames = {
        priority: "Priority Delivery",
        automation: "Extra Automation Setup",
        social: "Social Media Content Support",
        report: "Business Report & Workflow Review",
        consultation: "1-on-1 Strategy Consultation"
    };

    const timelineFees = {
        "ASAP": 25,
        "Within 3 Days": 15,
        "Within 1 Week": 0,
        "Within 2 Weeks": 0,
        "Flexible": 0
    };

    const hourFees = {
        "5 Hours": 0,
        "10 Hours": 35,
        "20 Hours": 85,
        "40 Hours": 170,
        "Monthly Support": 250,
        "Not Sure Yet": 0
    };

    function money(amount) {
        return `$${Number(amount || 0).toFixed(2)}`;
    }

    function generateInvoiceId() {
        let current = localStorage.getItem("impactechInvoiceId");

        if (!current) {
            current = `IMP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
            localStorage.setItem("impactechInvoiceId", current);
        }

        return current;
    }

    function selectedPlan() {
        return planSelect?.value || "";
    }

    function selectedService() {
        return serviceSelect?.value || "";
    }

    function selectedTimeline() {
        return timelineSelect?.value || "";
    }

    function selectedHours() {
        return hoursSelect?.value || "";
    }

    function planPrice() {
        return planPrices[selectedPlan()] || 0;
    }

    function selectedAddons() {
        const addons = [];
        let total = 0;

        addonChecks.forEach(check => {
            const box = check.closest(".addon-option");

            if (check.checked) {
                addons.push({
                    key: check.value,
                    name: addonNames[check.value],
                    price: addonPrices[check.value] || 0
                });

                total += addonPrices[check.value] || 0;
                box?.classList.add("addon-selected");
            } else {
                box?.classList.remove("addon-selected");
            }
        });

        return { addons, total };
    }

    function timelineFee() {
        return timelineFees[selectedTimeline()] || 0;
    }

    function hourFee() {
        return hourFees[selectedHours()] || 0;
    }

    function calculateTotal() {
        const addons = selectedAddons();

        const subtotal = planPrice() + addons.total + timelineFee() + hourFee();
        const processingFee = subtotal > 0 ? subtotal * 0.03 : 0;
        const total = subtotal + processingFee;
        const deposit = total * 0.5;
        const balance = total - deposit;

        return {
            plan: selectedPlan(),
            planName: planLabels[selectedPlan()] || "Not selected",
            service: selectedService() || "Not selected",
            timeline: selectedTimeline() || "Not selected",
            hours: selectedHours() || "Not selected",
            planPrice: planPrice(),
            addons: addons.addons,
            addonTotal: addons.total,
            timelineFee: timelineFee(),
            hourFee: hourFee(),
            processingFee,
            subtotal,
            total,
            deposit,
            balance
        };
    }

    function createSummaryBox() {
        const summaryBox = $(".summary-box");
        if (!summaryBox) return;

        summaryBox.innerHTML = `
            <h3>Checkout Summary</h3>

            <div class="summary-row">
                <span>Invoice ID</span>
                <strong id="summaryInvoice">${generateInvoiceId()}</strong>
            </div>

            <div class="summary-row">
                <span>Selected Service</span>
                <strong id="summaryService">Not selected</strong>
            </div>

            <div class="summary-row">
                <span>Selected Plan</span>
                <strong id="summaryPlan">Not selected</strong>
            </div>

            <div class="summary-row">
                <span>Plan Price</span>
                <strong id="summaryPlanPrice">$0.00</strong>
            </div>

            <div class="summary-row">
                <span>Add-ons</span>
                <strong id="summaryAddons">None</strong>
            </div>

            <div class="summary-row">
                <span>Add-ons Total</span>
                <strong id="summaryAddonTotal">$0.00</strong>
            </div>

            <div class="summary-row">
                <span>Timeline Fee</span>
                <strong id="summaryTimeline">$0.00</strong>
            </div>

            <div class="summary-row">
                <span>Hours Fee</span>
                <strong id="summaryHours">$0.00</strong>
            </div>

            <div class="summary-row">
                <span>Processing Fee</span>
                <strong id="summaryProcessing">$0.00</strong>
            </div>

            <div class="summary-total">
                <span>Total</span>
                <strong id="summaryTotal">$0.00</strong>
            </div>

            <div class="summary-row">
                <span>Deposit 50%</span>
                <strong id="summaryDeposit">$0.00</strong>
            </div>

            <div class="summary-row">
                <span>Balance Later</span>
                <strong id="summaryBalance">$0.00</strong>
            </div>

            <a href="#payment" class="primary" id="proceedToPayment">Proceed To Payment</a>
            <button type="button" class="outline reset-checkout-btn" id="resetCheckout">Reset Checkout</button>
        `;
    }

    function updateMainOrderSummary() {
        const data = calculateTotal();
        const orderCard = document.querySelector("section.experience:not(.checkout-section) .experience-card");

        if (!orderCard) return;

        orderCard.innerHTML = `
            <h3>Your Checkout Summary</h3>

            <p><strong>Invoice ID:</strong> ${generateInvoiceId()}</p>
            <p><strong>Selected Service:</strong> ${data.service}</p>
            <p><strong>Selected Plan:</strong> ${data.planName}</p>
            <p><strong>Plan Price:</strong> ${money(data.planPrice)}</p>
            <p><strong>Add-ons:</strong> ${data.addons.length ? data.addons.map(a => a.name).join(", ") : "None"}</p>
            <p><strong>Add-ons Total:</strong> ${money(data.addonTotal)}</p>
            <p><strong>Timeline Fee:</strong> ${money(data.timelineFee)}</p>
            <p><strong>Hours Fee:</strong> ${money(data.hourFee)}</p>
            <p><strong>Processing Fee:</strong> ${money(data.processingFee)}</p>
            <p><strong>Estimated Total:</strong> ${money(data.total)}</p>
            <p><strong>Currency:</strong> USD</p>
            <p><strong>Payment Type:</strong> Full Payment, Deposit, or Custom Quote</p>

            <a href="#payment" class="primary" id="orderContinueBtn">Continue To Payment</a>
        `;
    }

    function updatePaymentCards() {
        const data = calculateTotal();
        const cards = $$("#payment .service-card");

        if (cards[0]) {
            cards[0].querySelector("h2").textContent = data.total > 0 ? money(data.total) : "$49 - $299";
            cards[0].querySelector("p").textContent = "Pay the full checkout total and start your project faster.";
        }

        if (cards[1]) {
            cards[1].querySelector("h2").textContent = data.total > 0 ? money(data.deposit) : "50%";
            cards[1].querySelector("p").textContent = "Pay half now and complete the remaining balance later.";
        }

        if (cards[2]) {
            cards[2].querySelector("h2").textContent = data.plan === "Custom Project - Quote Required" ? "Quote" : "Custom";
            cards[2].querySelector("p").textContent = "Request a special quote if your project needs custom pricing.";
        }
    }

    function updateSummary() {
        const data = calculateTotal();

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        setText("summaryInvoice", generateInvoiceId());
        setText("summaryService", data.service);
        setText("summaryPlan", data.planName);
        setText("summaryPlanPrice", money(data.planPrice));
        setText("summaryAddons", data.addons.length ? data.addons.map(a => a.name).join(", ") : "None");
        setText("summaryAddonTotal", money(data.addonTotal));
        setText("summaryTimeline", money(data.timelineFee));
        setText("summaryHours", money(data.hourFee));
        setText("summaryProcessing", money(data.processingFee));
        setText("summaryTotal", money(data.total));
        setText("summaryDeposit", money(data.deposit));
        setText("summaryBalance", money(data.balance));

        updatePaymentCards();
        updateMainOrderSummary();
        saveCheckout();
    }

    function checkoutData(extra = {}) {
        const data = calculateTotal();

        return {
            invoiceId: generateInvoiceId(),
            fullname: $('input[name="fullname"]')?.value || "",
            email: $('input[name="email"]')?.value || "",
            phone: $('input[name="phone"]')?.value || "",
            company: $('input[name="company"]')?.value || "",
            country: $('input[name="country"]')?.value || "",
            website: $('input[name="website"]')?.value || "",
            service: selectedService(),
            plan: selectedPlan(),
            timeline: selectedTimeline(),
            hours: selectedHours(),
            project: projectBox?.value || "",
            addons: data.addons,
            prices: {
                planPrice: data.planPrice,
                addonTotal: data.addonTotal,
                timelineFee: data.timelineFee,
                hourFee: data.hourFee,
                processingFee: data.processingFee,
                subtotal: data.subtotal,
                total: data.total,
                deposit: data.deposit,
                balance: data.balance
            },
            currency: "USD",
            updatedAt: new Date().toISOString(),
            ...extra
        };
    }

    function saveCheckout(extra = {}) {
        localStorage.setItem("impactechCheckout", JSON.stringify(checkoutData(extra)));
    }

    function loadCheckout() {
        const saved = JSON.parse(localStorage.getItem("impactechCheckout") || "null");
        if (!saved) return;

        const fields = {
            fullname: 'input[name="fullname"]',
            email: 'input[name="email"]',
            phone: 'input[name="phone"]',
            company: 'input[name="company"]',
            country: 'input[name="country"]',
            website: 'input[name="website"]',
            project: 'textarea[name="project"]'
        };

        Object.entries(fields).forEach(([key, selector]) => {
            const field = $(selector);
            if (field && saved[key]) field.value = saved[key];
        });

        if (serviceSelect && saved.service) serviceSelect.value = saved.service;
        if (planSelect && saved.plan) planSelect.value = saved.plan;
        if (timelineSelect && saved.timeline) timelineSelect.value = saved.timeline;
        if (hoursSelect && saved.hours) hoursSelect.value = saved.hours;

        if (Array.isArray(saved.addons)) {
            addonChecks.forEach(check => {
                const exists = saved.addons.some(addon => addon.key === check.value || addon.name === addonNames[check.value]);
                check.checked = exists;
            });
        }
    }

    function resetCheckout() {
        if (!confirm("Reset all checkout details?")) return;

        localStorage.removeItem("impactechCheckout");
        localStorage.removeItem("impactechInvoiceId");

        $$("input, select, textarea").forEach(field => {
            if (field.type === "checkbox") {
                field.checked = false;
            } else {
                field.value = "";
            }

            field.classList.remove("input-error");
        });

        $$(".addon-option").forEach(option => option.classList.remove("addon-selected"));

        generateInvoiceId();
        updateSummary();
        toast("Checkout reset successfully.");
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validateCheckout() {
        let valid = true;

        const required = [
            $('input[name="fullname"]'),
            $('input[name="email"]'),
            serviceSelect,
            planSelect,
            projectBox
        ];

        required.forEach(field => {
            if (!field || !field.value.trim()) {
                field?.classList.add("input-error");
                valid = false;
            } else {
                field.classList.remove("input-error");
            }
        });

        const email = $('input[name="email"]');

        if (email && email.value.trim() && !validateEmail(email.value.trim())) {
            email.classList.add("input-error");
            toast("Please enter a valid email address.");
            return false;
        }

        if (!valid) {
            toast("Please fill full name, email, service, plan, and project description.");
            return false;
        }

        return true;
    }

    function selectPlanByIndex(index) {
        if (!planSelect) return;

        if (index === 0) planSelect.value = "Starter Support - $49";
        if (index === 1) planSelect.value = "Business Support - $149";
        if (index === 2) planSelect.value = "Growth Support - $299";

        const defaultService = serviceDefaultByPlan[planSelect.value];

        if (serviceSelect && defaultService && !serviceSelect.value) {
            serviceSelect.value = defaultService;
        }

        updateSummary();
        toast(`${planLabels[planSelect.value]} selected.`);
    }

    function selectPaymentType(type) {
        if (!validateCheckout()) return;

        saveCheckout({ paymentType: type });
        toast(`${type} selected. We will connect real payment later.`);

        console.log("IMPACTECH CHECKOUT DATA:", checkoutData({ paymentType: type }));
    }

    function buildClientMessage(paymentType = "Not selected") {
        const data = checkoutData({ paymentType });

        const addons = data.addons.length
            ? data.addons.map(a => `${a.name} (${money(a.price)})`).join(", ")
            : "None";

        return `
Hello IMPACTECH ACADEMY,

I want to start a service checkout.

Invoice ID: ${data.invoiceId}
Name: ${data.fullname}
Email: ${data.email}
Phone: ${data.phone}
Company: ${data.company}
Country: ${data.country}
Website/Social Link: ${data.website}

Service: ${data.service}
Plan: ${data.plan}
Timeline: ${data.timeline}
Support Hours: ${data.hours}
Add-ons: ${addons}

Project Details:
${data.project}

Subtotal: ${money(data.prices.subtotal)}
Processing Fee: ${money(data.prices.processingFee)}
Total: ${money(data.prices.total)}
Deposit: ${money(data.prices.deposit)}
Balance: ${money(data.prices.balance)}
Payment Type: ${paymentType}
Currency: USD
        `.trim();
    }

    function copyCheckoutDetails() {
        if (!validateCheckout()) return;

        const message = buildClientMessage("Not selected");

        navigator.clipboard.writeText(message)
            .then(() => toast("Checkout details copied."))
            .catch(() => toast("Could not copy checkout details."));
    }

    function mailCheckoutDetails() {
        if (!validateCheckout()) return;

        const message = buildClientMessage("Not selected");
        const subject = encodeURIComponent("New Service Checkout Request");
        const body = encodeURIComponent(message);

        window.location.href = `mailto:Info.davjohn@gmail.com?subject=${subject}&body=${body}`;
    }

    function toast(message) {
        let box = $(".checkout-toast");

        if (!box) {
            box = document.createElement("div");
            box.className = "checkout-toast";
            document.body.appendChild(box);
        }

        box.textContent = message;
        box.classList.add("show");

        setTimeout(() => {
            box.classList.remove("show");
        }, 3000);
    }

    function addExtraButtons() {
        const actionBox = $(".checkout-action-box");
        if (!actionBox || $(".copy-checkout-btn")) return;

        const tools = document.createElement("div");
        tools.className = "checkout-extra-actions";
        tools.innerHTML = `
            <button type="button" class="outline copy-checkout-btn">Copy Details</button>
            <button type="button" class="outline email-checkout-btn">Email Details</button>
            <button type="button" class="outline reset-checkout-btn-2">Clear Form</button>
        `;

        actionBox.appendChild(tools);
    }

    function bindEvents() {
        $$("input, select, textarea").forEach(field => {
            field.addEventListener("input", updateSummary);
            field.addEventListener("change", updateSummary);
        });

        planButtons.forEach((btn, index) => {
            btn.addEventListener("click", e => {
                e.preventDefault();
                selectPlanByIndex(index);

                document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
            });
        });

        if (checkoutBtn) {
            checkoutBtn.addEventListener("click", e => {
                e.preventDefault();

                if (!validateCheckout()) return;

                saveCheckout();
                toast("Checkout saved. Continue to payment.");

                document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
            });
        }

        document.addEventListener("click", e => {
            if (e.target.id === "proceedToPayment" || e.target.id === "orderContinueBtn") {
                e.preventDefault();

                if (!validateCheckout()) return;

                saveCheckout();
                document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
            }

            if (e.target.id === "resetCheckout" || e.target.classList.contains("reset-checkout-btn-2")) {
                resetCheckout();
            }

            if (e.target.classList.contains("copy-checkout-btn")) {
                copyCheckoutDetails();
            }

            if (e.target.classList.contains("email-checkout-btn")) {
                mailCheckoutDetails();
            }
        });

        paymentButtons.forEach((btn, index) => {
            btn.addEventListener("click", e => {
                e.preventDefault();

                if (index === 0) selectPaymentType("Full Payment");
                if (index === 1) selectPaymentType("50% Deposit");
                if (index === 2) selectPaymentType("Custom Quote");
            });
        });

        if (planSelect) {
            planSelect.addEventListener("change", () => {
                const defaultService = serviceDefaultByPlan[planSelect.value];

                if (serviceSelect && defaultService && !serviceSelect.value) {
                    serviceSelect.value = defaultService;
                }

                updateSummary();
            });
        }
    }

    createSummaryBox();
    addExtraButtons();
    loadCheckout();
    bindEvents();
    updateSummary();
});