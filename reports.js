// reports.js - Handling Day Book and Financial Statements

async function openDayBook() {
    hideAllScreens();
    document.getElementById('daybook-screen').classList.remove('hidden');
    // Default to today's date
    document.getElementById('db_date_filter').valueAsDate = new Date();
    await loadDayBookData();
}

function hideDayBookScreen() {
    showDashboard();
}

async function loadDayBookData() {
    const listContainer = document.getElementById('daybook-list');
    const filterDate = document.getElementById('db_date_filter').value;
    
    listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Loading transactions...</p>';

    if (!currentCompany) return;

    // Fetch Vouchers AND their nested entries and ledger names in one query
    const { data, error } = await supabaseClient
        .from('vouchers')
        .select(`
            id, voucher_type, voucher_number, voucher_date, narration,
            voucher_entries ( amount, is_debit, ledgers ( name ) )
        `)
        .eq('company_id', currentCompany.id)
        .eq('voucher_date', filterDate)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Day Book Error:", error);
        listContainer.innerHTML = `<p style="color:red; text-align:center;">Failed to load data: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #64748b;">No transactions found for this date.</p>';
        return;
    }

    // Generate HTML for each voucher
    let html = data.map(v => {
        // Tally Logic: Determine which ledger to display as the "Primary" name
        // For Receipts/Sales, the primary party is Credited (is_debit = false)
        // For Payments/Purchases, the primary party is Debited (is_debit = true)
        let displayEntry;
        if (['Receipt', 'Sales'].includes(v.voucher_type)) {
            displayEntry = v.voucher_entries.find(e => e.is_debit === false) || v.voucher_entries[0];
        } else {
            displayEntry = v.voucher_entries.find(e => e.is_debit === true) || v.voucher_entries[0];
        }

        const ledgerName = (displayEntry && displayEntry.ledgers) ? displayEntry.ledgers.name : 'Unknown Ledger';
        const amount = (displayEntry) ? displayEntry.amount : 0;
        const colorClass = `type-${v.voucher_type.toLowerCase()}`;

        return `
            <div class="db-card" style="border-left-color: var(--${v.voucher_type.toLowerCase()}-color, #64748b);">
                <div class="db-row db-header">
                    <span class="db-ledger">${ledgerName}</span>
                    <span class="db-amount">₹ ${parseFloat(amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div class="db-row db-sub">
                    <span class="db-type ${colorClass}">${v.voucher_type}</span>
                    <span class="db-vno">Vch No: ${v.voucher_number}</span>
                </div>
                ${v.narration ? `<div class="db-narration">Narration: ${v.narration}</div>` : ''}
            </div>
        `;
    }).join('');

    listContainer.innerHTML = html;
}
// --- LEDGER STATEMENT LOGIC ---

async function openLedgerStatement() {
    hideAllScreens();
    document.getElementById('statement-screen').classList.remove('hidden');
    
    // Load all ledgers into the dropdown
    const { data: ledgers } = await supabaseClient
        .from('ledgers')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .order('name');
        
    const select = document.getElementById('stmt_ledger_select');
    select.innerHTML = '<option value="">-- Select Ledger --</option>' + 
        ledgers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        
    document.getElementById('statement-body').innerHTML = '';
    document.getElementById('statement-footer').innerHTML = '';
}

// Helper to set dates quickly (Like Tally shortcuts)
function setTallyPeriod(type) {
    const startInput = document.getElementById('stmt_start_date');
    const endInput = document.getElementById('stmt_end_date');
    const now = new Date();

    if (type === 'today') {
        startInput.valueAsDate = now;
        endInput.valueAsDate = now;
    } else if (type === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        startInput.valueAsDate = firstDay;
        endInput.valueAsDate = now;
    }
    loadLedgerStatement();
}

async function loadLedgerStatement() {
    const ledgerId = document.getElementById('stmt_ledger_select').value;
    const startDate = document.getElementById('stmt_start_date').value;
    const endDate = document.getElementById('stmt_end_date').value;
    
    const tbody = document.getElementById('statement-body');
    const tfoot = document.getElementById('statement-footer');
    
    if (!ledgerId || !startDate || !endDate) return;
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Filtering records...</td></tr>';

    // 1. Get Ledger Info
    const { data: ledgerData } = await supabaseClient
        .from('ledgers')
        .select('opening_balance, opening_balance_type')
        .eq('id', ledgerId)
        .single();

    // 2. Optimized Query: Fetch only entries for THIS ledger within THIS period
    // We join with 'vouchers' to filter by the voucher_date
    const { data: entries, error } = await supabaseClient
        .from('voucher_entries')
        .select(`
            amount, is_debit,
            vouchers!inner ( id, voucher_date, voucher_type, voucher_number, narration )
        `)
        .eq('ledger_id', ledgerId)
        .gte('vouchers.voucher_date', startDate)
        .lte('vouchers.voucher_date', endDate)
        .order('vouchers(voucher_date)', { ascending: true });

    if (error) {
        console.error("Statement Error:", error);
        return;
    }

    // 3. For "Particulars", we need the OTHER side of these vouchers
    // We fetch all entries related to the vouchers we just found
    const vIds = entries.map(e => e.vouchers.id);
    const { data: allRelatedEntries } = await supabaseClient
        .from('voucher_entries')
        .select('voucher_id, ledger_id, ledgers(name)')
        .in('voucher_id', vIds)
        .neq('ledger_id', ledgerId); // Get the "Opposite" ledger

    // 4. Transform data for the render function
    const formattedVouchers = entries.map(e => {
        const opposite = allRelatedEntries.find(re => re.voucher_id === e.vouchers.id);
        return {
            voucher_date: e.vouchers.voucher_date,
            voucher_type: e.vouchers.voucher_type,
            voucher_number: e.vouchers.voucher_number,
            voucher_entries: [
                { ledger_id: ledgerId, is_debit: e.is_debit, amount: e.amount },
                { ledger_id: 'other', ledgers: { name: opposite ? opposite.ledgers.name : 'Unknown' } }
            ]
        };
    });

    renderStatementTable(ledgerData, formattedVouchers, ledgerId);
}

function renderStatementTable(ledgerData, vouchers, targetLedgerId) {
    const tbody = document.getElementById('statement-body');
    const tfoot = document.getElementById('statement-footer');
    
    let totalDebit = 0;
    let totalCredit = 0;

    // Process Opening Balance
    let opBal = parseFloat(ledgerData.opening_balance) || 0;
    let isOpDebit = ledgerData.opening_balance_type === 'Dr';
    
    if (opBal > 0) {
        if (isOpDebit) totalDebit += opBal; else totalCredit += opBal;
    }

    let rowsHtml = `
        <tr class="balance-row">
            <td></td>
            <td><b>Opening Balance</b></td>
            <td></td>
            <td></td>
            <td class="text-right">${isOpDebit && opBal > 0 ? opBal.toFixed(2) : ''}</td>
            <td class="text-right">${!isOpDebit && opBal > 0 ? opBal.toFixed(2) : ''}</td>
        </tr>
    `;

    // Process Transactions
    vouchers.forEach(v => {
        // Find the entry for OUR target ledger
        const myEntry = v.voucher_entries.find(e => e.ledger_id === targetLedgerId);
        // Find the "other" side of the entry (Particulars)
        const otherEntry = v.voucher_entries.find(e => e.ledger_id !== targetLedgerId) || v.voucher_entries[0];
        
        const amount = parseFloat(myEntry.amount);
        let drAmount = '', crAmount = '';

        if (myEntry.is_debit) {
            drAmount = amount.toFixed(2);
            totalDebit += amount;
        } else {
            crAmount = amount.toFixed(2);
            totalCredit += amount;
        }

        // Tally formatting: If we are Debited, the other account is Credited (Starts with "To")
        // If we are Credited, the other account is Debited (Starts with "By")
        const prefix = myEntry.is_debit ? "To " : "By ";

        rowsHtml += `
            <tr>
                <td>${v.voucher_date}</td>
                <td>${prefix} <b>${otherEntry.ledgers.name}</b></td>
                <td>${v.voucher_type}</td>
                <td>${v.voucher_number}</td>
                <td class="text-right">${drAmount}</td>
                <td class="text-right">${crAmount}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;

    // Calculate Closing Balance
    let closingBal = Math.abs(totalDebit - totalCredit);
    let closingType = totalDebit > totalCredit ? 'Dr' : 'Cr';
    
    // To balance the footer visually, we put the closing balance on the "lighter" side
    let drFooterBal = totalDebit < totalCredit ? closingBal.toFixed(2) : '';
    let crFooterBal = totalCredit < totalDebit ? closingBal.toFixed(2) : '';
    let grandTotal = Math.max(totalDebit, totalCredit).toFixed(2);

    tfoot.innerHTML = `
        <tr class="balance-row">
            <th colspan="4" class="text-right">Closing Balance (${closingType}):</th>
            <th class="text-right">${drFooterBal}</th>
            <th class="text-right">${crFooterBal}</th>
        </tr>
        <tr>
            <th colspan="4" class="text-right">Total:</th>
            <th class="text-right fw-bold">${grandTotal}</th>
            <th class="text-right fw-bold">${grandTotal}</th>
        </tr>
    `;
}
