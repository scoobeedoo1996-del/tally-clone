// app.js - The Brain
let currentCompany = null;
let currentVoucherType = 'Payment';

document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
    document.getElementById('create-ledger-form').addEventListener('submit', handleLedgerSubmit);
    document.getElementById('voucher-form').addEventListener('submit', handleVoucherSubmit);
    document.getElementById('ledger_group').addEventListener('change', toggleSmartLedgerFields);
});

async function loadCompanies() {
    const list = document.getElementById('company-list');
    const { data, error } = await supabaseClient.from('companies').select('*').order('name');
    if (error) return;
    
    // UPDATE: We are now passing the books_start date to the selectCompany function
    list.innerHTML = data.map(c => `
        <div class="company-card" onclick="selectCompany('${c.id}', '${c.name}', '${c.books_beginning_from}', '${c.financial_year_start}')">
            <div class="company-info"><b>${c.name}</b></div>
            <div class="arrow">❯</div>
        </div>
    `).join('');
}

// UPDATE: We now capture the dates and save them to the global currentCompany object
function selectCompany(id, name, booksStart, fyStart) {
    currentCompany = { 
        id: id, 
        name: name,
        books_beginning_from: booksStart,
        financial_year_start: fyStart
    };
    
    document.getElementById('active-company-name').innerText = name;
    
    // Bonus: Update the UI to show the actual financial year!
    document.getElementById('active-company-period').innerText = `Books from: ${booksStart}`;
    
    showDashboard();
}

async function openLedgers() {
    showLedgerScreen();
    const { data } = await supabaseClient.from('groups').select('id, name').order('name');
    
    document.getElementById('ledger_group').innerHTML = data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    
    // NEW: Trigger the check immediately so the UI is correct on load
    toggleSmartLedgerFields(); 
}
function toggleSmartLedgerFields() {
    const groupSelect = document.getElementById('ledger_group');
    const detailsDiv = document.getElementById('smart-ledger-details');

    // Safety check: Ensure the dropdown has options loaded
    if (!groupSelect || groupSelect.selectedIndex === -1) return;

    // Get the text, make it lowercase, and trim spaces to prevent mismatch errors
    const selectedText = groupSelect.options[groupSelect.selectedIndex].text.toLowerCase().trim();

    // Check against the cleaned text
    if (selectedText === 'sundry debtors' || selectedText === 'sundry creditors' || selectedText === 'bank accounts') {
        detailsDiv.style.display = 'block'; // Show fields
    } else {
        detailsDiv.style.display = 'none';  // Hide fields
        
        // Clear inputs safely
        const addr = document.getElementById('ledger_address');
        const pan = document.getElementById('ledger_pan');
        if(addr) addr.value = '';
        if(pan) pan.value = '';
    }
}
async function openVoucherEntry() {
    showVoucherScreen();
    // Default to today's date
    document.getElementById('v_date').valueAsDate = new Date();
    // Call setVoucherType to initialize numbering and ledgers
    await setVoucherType('Payment');
}

async function setVoucherType(type, btn) {
    currentVoucherType = type;
    
    // 1. UI Updates (Header & Labels)
    updateVoucherUI(type);
    
    // 2. Dynamic Numbering (Tally Logic)
    const nextNo = await getNextVoucherNumber(type);
    document.getElementById('v_number').value = nextNo;
    
    // 3. Load Filtered Ledgers
    await loadVoucherLedgers(type);
    
    // 4. Button highlighting
    document.querySelectorAll('.v-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    else {
        // Find button by text if called programmatically
        const buttons = document.querySelectorAll('.v-btn');
        buttons.forEach(b => {
            if(b.innerText.includes(type.substring(0,4))) b.classList.add('active');
        });
    }
}

async function jumpToLedger(ledgerId) {
    console.log("Jumping to ledger ID:", ledgerId);
    if (!ledgerId || ledgerId === 'undefined') {
        alert("Invalid Ledger ID");
        return;
    }

    // 1. Hide everything
    hideAllScreens();

    // 2. Try to show the screen - Check if ID matches exactly!
    const targetScreen = document.getElementById('ledger-statement-screen');
    if (!targetScreen) {
        console.error("Target screen 'ledger-statement-screen' not found in HTML!");
        showDashboard(); // Emergency fallback
        return;
    }
    targetScreen.classList.remove('hidden');

    // 3. Update filters (Using your specific IDs from previous code)
    const select = document.getElementById('stmt_ledger_select');
    const startInput = document.getElementById('stmt_start_date');
    const endInput = document.getElementById('stmt_end_date');

    if (select) select.value = ledgerId;
    if (startInput) startInput.value = currentCompany.books_beginning_from;
    if (endInput) endInput.valueAsDate = new Date();

    // 4. Run the report logic
    try {
        await loadLedgerStatement();
    } catch (err) {
        console.error("Failed to load statement:", err);
        targetScreen.innerHTML += `<p style="color:red">Error loading report: ${err.message}</p>`;
    }
}
