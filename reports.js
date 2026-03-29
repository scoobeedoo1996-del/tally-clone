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
    document.getElementById('stmt_start_date').valueAsDate = new Date();
    document.getElementById('stmt_end_date').valueAsDate = new Date();
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
    if (!ledgerId || !startDate || !endDate) return;

    // 1. Fetch Ledger Master Data
    const { data: ledger } = await supabaseClient
        .from('ledgers')
        .select('opening_balance, opening_balance_type')
        .eq('id', ledgerId).single();

    // 2. Fetch ALL entries for this ledger BEFORE the startDate
    const { data: prevEntries } = await supabaseClient
        .from('voucher_entries')
        .select('amount, is_debit, vouchers!inner(voucher_date)')
        .eq('ledger_id', ledgerId)
        .lt('vouchers.voucher_date', startDate);

    // Calculate "Period Opening Balance"
    let runningBal = parseFloat(ledger.opening_balance) || 0;
    let isRunningDr = ledger.opening_balance_type === 'Dr';

    prevEntries.forEach(e => {
        if (e.is_debit === isRunningDr) {
            runningBal += parseFloat(e.amount);
        } else {
            runningBal -= parseFloat(e.amount);
            if (runningBal < 0) {
                runningBal = Math.abs(runningBal);
                isRunningDr = !isRunningDr;
            }
        }
    });

    const periodOpening = { amount: runningBal, type: isRunningDr ? 'Dr' : 'Cr' };

    // 3. Fetch entries WITHIN the period (Your existing logic)
    const { data: currentEntries } = await supabaseClient
        .from('voucher_entries')
        .select(`
            amount, is_debit,
            vouchers!inner ( id, voucher_date, voucher_type, voucher_number, narration )
        `)
        .eq('ledger_id', ledgerId)
        .gte('vouchers.voucher_date', startDate)
        .lte('vouchers.voucher_date', endDate)
        .order('vouchers(voucher_date)', { ascending: true });

    // Fetch related ledger names for "Particulars"
    const vIds = currentEntries.map(e => e.vouchers.id);
    const { data: relatives } = await supabaseClient
        .from('voucher_entries')
        .select('voucher_id, ledgers(name)')
        .in('voucher_id', vIds)
        .neq('ledger_id', ledgerId);

    const formattedVouchers = currentEntries.map(e => {
        const other = relatives.find(r => r.voucher_id === e.vouchers.id);
        return {
            ...e.vouchers,
            myEntry: { is_debit: e.is_debit, amount: e.amount },
            particulars: other ? other.ledgers.name : 'Unknown'
        };
    });

    renderTallyStyleTable(periodOpening, formattedVouchers);
}
function renderTallyStyleTable(opening, vouchers) {
    const tbody = document.getElementById('statement-body');
    const tfoot = document.getElementById('statement-footer');
    
    let curDebit = 0;
    let curCredit = 0;

    // Opening Balance Row
    let html = `
        <tr class="balance-row">
            <td>${document.getElementById('stmt_start_date').value}</td>
            <td colspan="3"><b>Opening Balance</b></td>
            <td class="text-right">${opening.type === 'Dr' ? opening.amount.toFixed(2) : ''}</td>
            <td class="text-right">${opening.type === 'Cr' ? opening.amount.toFixed(2) : ''}</td>
        </tr>
    `;

    // Transaction Rows
    vouchers.forEach(v => {
        const dr = v.myEntry.is_debit ? v.myEntry.amount : 0;
        const cr = !v.myEntry.is_debit ? v.myEntry.amount : 0;
        curDebit += dr;
        curCredit += cr;

        html += `
            <tr>
                <td>${v.voucher_date}</td>
                <td>${v.myEntry.is_debit ? 'To' : 'By'} <b>${v.particulars}</b></td>
                <td>${v.voucher_type}</td>
                <td>${v.voucher_number}</td>
                <td class="text-right">${dr > 0 ? dr.toFixed(2) : ''}</td>
                <td class="text-right">${cr > 0 ? cr.toFixed(2) : ''}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    // Footer Calculation
    const totalDr = (opening.type === 'Dr' ? opening.amount : 0) + curDebit;
    const totalCr = (opening.type === 'Cr' ? opening.amount : 0) + curCredit;
    const closingAmt = Math.abs(totalDr - totalCr);
    const closingType = totalDr > totalCr ? 'Dr' : 'Cr';

    tfoot.innerHTML = `
        <tr class="total-row">
            <th colspan="4" class="text-right">Current Total:</th>
            <th class="text-right">${curDebit.toFixed(2)}</th>
            <th class="text-right">${curCredit.toFixed(2)}</th>
        </tr>
        <tr class="balance-row">
            <th colspan="4" class="text-right">Closing Balance (${closingType}):</th>
            <th class="text-right">${closingType === 'Dr' ? closingAmt.toFixed(2) : ''}</th>
            <th class="text-right">${closingType === 'Cr' ? closingAmt.toFixed(2) : ''}</th>
        </tr>
    `;
}
