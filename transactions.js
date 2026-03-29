// transactions.js - Adaptive Voucher Logic
async function loadVoucherLedgers(type) {
    const mainSelect = document.getElementById('v_main_account');
    const partSelect = document.getElementById('v_particular_ledger');

    const { data: ledgers, error } = await supabaseClient
        .from('ledgers')
        .select('id, name, groups(name)')
        .eq('company_id', currentCompany.id);

    if (error) return;

    // --- TALLY FILTERING LOGIC ---
    let mainFilter = [];
    let partFilter = [];

    if (type === 'Sales' || type === 'CreditNote') {
        // Main: Customers (Debtors), Cash, or Bank
        mainFilter = ledgers.filter(l => ['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        // Particulars: Sales Accounts
        partFilter = ledgers.filter(l => l.groups.name === 'Sales Accounts');
    } 
    else if (type === 'Purchase' || type === 'DebitNote') {
        // Main: Suppliers (Creditors), Cash, or Bank
        mainFilter = ledgers.filter(l => ['Sundry Creditors', 'Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        // Particulars: Purchase Accounts
        partFilter = ledgers.filter(l => l.groups.name === 'Purchase Accounts');
    }
    else if (type === 'Contra') {
        mainFilter = ledgers.filter(l => ['Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        partFilter = mainFilter; 
    }
    else { // Payment or Receipt
        mainFilter = ledgers.filter(l => ['Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        partFilter = ledgers; // Can pay/receive against any ledger
    }

    // Populate Dropdowns
    mainSelect.innerHTML = '<option value="">Select Account</option>' + 
        mainFilter.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    
    partSelect.innerHTML = '<option value="">Select Particulars</option>' + 
        partFilter.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function handleVoucherSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('v-save-btn');
    
    // 1. Capture Inputs
    const vDate = document.getElementById('v_date').value;
    const vMainLedger = document.getElementById('v_main_account').value;
    const vPartLedger = document.getElementById('v_particular_ledger').value;
    const vAmount = parseFloat(document.getElementById('v_amount').value);

    // 2. Professional Validation (Prevents Database Errors)
    if (!vDate) return alert("Please select a date");
    if (!vMainLedger || !vPartLedger) return alert("Please select both ledgers");
    if (isNaN(vAmount) || vAmount <= 0) return alert("Please enter a valid amount");
    if (vMainLedger === vPartLedger) return alert("Main account and Particulars cannot be the same");

    btn.disabled = true;
    btn.innerText = "Processing...";

    // 3. Insert Voucher Header
    const { data: v, error: vErr } = await supabaseClient.from('vouchers').insert([{
        company_id: currentCompany.id,
        voucher_type: currentVoucherType,
        date: vDate, // Ensure this matches your SQL column name exactly
        voucher_number: document.getElementById('v_number').value,
        narration: document.getElementById('v_narration').value
    }]).select();

    if (vErr) { 
        console.error("Voucher Header Error:", vErr);
        alert("Header Error: " + vErr.message);
        btn.disabled = false;
        btn.innerText = "Accept";
        return; 
    }

    // 4. Double Entry Logic (Debits & Credits)
    // Tally Rules:
    // Sales/Receipt/Contra/DebitNote -> Top Account gets Debited
    // Purchase/Payment/CreditNote -> Top Account gets Credited
    let mainDrCr = (['Receipt', 'Sales', 'Contra', 'DebitNote'].includes(currentVoucherType)) ? 'Debit' : 'Credit';
    let partDrCr = (mainDrCr === 'Debit') ? 'Credit' : 'Debit';

    const { error: eErr } = await supabaseClient.from('voucher_entries').insert([
        { 
            voucher_id: v[0].id, 
            ledger_id: vMainLedger, 
            amount: vAmount, 
            entry_type: mainDrCr 
        },
        { 
            voucher_id: v[0].id, 
            ledger_id: vPartLedger, 
            amount: vAmount, 
            entry_type: partDrCr 
        }
    ]);

    if (eErr) {
        console.error("Entry Error:", eErr);
        alert("Accounting Entry Error: " + eErr.message);
    } else {
        alert(`${currentVoucherType} Voucher No. ${document.getElementById('v_number').value} Saved!`);
        showDashboard();
    }

    btn.disabled = false;
    btn.innerText = "Accept";
}
