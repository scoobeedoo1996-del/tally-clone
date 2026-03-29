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
async function openTrialBalance() {
    hideAllScreens();
    document.getElementById('trialbalance-screen').classList.remove('hidden');
    document.getElementById('tb_date').valueAsDate = new Date();
    await loadTrialBalance();
}

async function loadTrialBalance() {
    const asOnDate = document.getElementById('tb_date').value;
    const tbody = document.getElementById('tb-body');
    const tfoot = document.getElementById('tb-footer');
    
    if (!asOnDate) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Calculating balances...</td></tr>';

    // 1. Fetch all Ledgers and their Group names
    const { data: ledgers } = await supabaseClient
        .from('ledgers')
        .select('id, name, opening_balance, opening_balance_type, group_id');

    // 2. Fetch all Voucher Entries up to asOnDate
    const { data: entries } = await supabaseClient
        .from('voucher_entries')
        .select('ledger_id, amount, is_debit, vouchers!inner(voucher_date)')
        .lte('vouchers.voucher_date', asOnDate);

    // 3. Calculate Closing Balance for each Ledger
    const ledgerBalances = ledgers.map(l => {
        let bal = parseFloat(l.opening_balance) || 0;
        let isDr = l.opening_balance_type === 'Dr';

        const myEntries = entries.filter(e => e.ledger_id === l.id);
        myEntries.forEach(e => {
            const amt = parseFloat(e.amount);
            if (e.is_debit === isDr) {
                bal += amt;
            } else {
                bal -= amt;
                if (bal < 0) {
                    bal = Math.abs(bal);
                    isDr = !isDr;
                }
            }
        });
        return { name: l.name, amount: bal, type: isDr ? 'Dr' : 'Cr' };
    });

    // 4. Render Rows
    let totalDr = 0;
    let totalCr = 0;
    let html = '';

    ledgerBalances.forEach(lb => {
        if (lb.amount === 0) return; // Skip zero balances
        
        const dr = lb.type === 'Dr' ? lb.amount : 0;
        const cr = lb.type === 'Cr' ? lb.amount : 0;
        totalDr += dr;
        totalCr += cr;

        html += `
            <tr>
                <td>${lb.name}</td>
                <td class="text-right">${dr > 0 ? dr.toFixed(2) : ''}</td>
                <td class="text-right">${cr > 0 ? cr.toFixed(2) : ''}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // 5. Footer - The "Difference" Check
    const difference = Math.abs(totalDr - totalCr);
    
    tfoot.innerHTML = `
        <tr class="total-row" style="background: #e2e8f0; font-weight: bold;">
            <td>Grand Total</td>
            <td class="text-right">${totalDr.toFixed(2)}</td>
            <td class="text-right">${totalCr.toFixed(2)}</td>
        </tr>
        ${difference > 0.01 ? `
        <tr style="color: red; background: #fee2e2;">
            <td><b>Difference in Opening Balances:</b></td>
            <td colspan="2" class="text-right"><b>${difference.toFixed(2)}</b></td>
        </tr>` : ''}
    `;
}
async function openPL() {
    hideAllScreens();
    document.getElementById('pl-screen').classList.remove('hidden');
    // Default to current Financial Year (e.g., April to Now)
    const now = new Date();
    document.getElementById('pl_start_date').value = now.getFullYear() + "-04-01";
    document.getElementById('pl_end_date').valueAsDate = now;
    await loadPLStatement();
}

async function loadPLStatement() {
    const start = document.getElementById('pl_start_date').value;
    const end = document.getElementById('pl_end_date').value;
    const container = document.getElementById('pl-content');

    if (!start || !end) return;
    container.innerHTML = "Calculating Profit & Loss...";

    // 1. Fetch Ledgers with their Group names
    const { data: ledgers } = await supabaseClient
        .from('ledgers')
        .select('id, name, opening_balance, opening_balance_type, groups(name, nature)')
        .eq('company_id', currentCompany.id);

    // 2. Fetch Voucher Entries in period
    const { data: entries } = await supabaseClient
        .from('voucher_entries')
        .select('ledger_id, amount, is_debit, vouchers!inner(voucher_date)')
        .gte('vouchers.voucher_date', start)
        .lte('vouchers.voucher_date', end);

    // 3. Helper to calculate a single ledger's net movement
    const getBalance = (ledger) => {
        let bal = 0; 
        const myEntries = entries.filter(e => e.ledger_id === ledger.id);
        myEntries.forEach(e => {
            // For P&L (Income/Expense), we usually just look at current movement
            // Income: Credit increases, Debit decreases
            // Expense: Debit increases, Credit decreases
            const isRevenueNature = ['Income', 'Sales'].includes(ledger.groups.nature);
            if (e.is_debit === (isRevenueNature ? false : true)) bal += parseFloat(e.amount);
            else bal -= parseFloat(e.amount);
        });
        return bal;
    };

    // 4. Categorize and Calculate
    const categories = {
        directIncome: { label: "Sales & Direct Incomes", total: 0, items: [] },
        directExpense: { label: "Purchases & Direct Expenses", total: 0, items: [] },
        indirectIncome: { label: "Indirect Incomes", total: 0, items: [] },
        indirectExpense: { label: "Indirect Expenses", total: 0, items: [] }
    };

    ledgers.forEach(l => {
        const bal = getBalance(l);
        if (bal === 0) return;

        const group = l.groups.name;
        if (group === 'Sales Accounts' || group === 'Direct Incomes') {
            categories.directIncome.items.push({ name: l.name, bal });
            categories.directIncome.total += bal;
        } else if (group === 'Purchase Accounts' || group === 'Direct Expenses') {
            categories.directExpense.items.push({ name: l.name, bal });
            categories.directExpense.total += bal;
        } else if (group === 'Indirect Incomes') {
            categories.indirectIncome.items.push({ name: l.name, bal });
            categories.indirectIncome.total += bal;
        } else if (group === 'Indirect Expenses') {
            categories.indirectExpense.items.push({ name: l.name, bal });
            categories.indirectExpense.total += bal;
        }
    });

    // 5. Build HTML
    const grossProfit = categories.directIncome.total - categories.directExpense.total;
    const netProfit = (grossProfit + categories.indirectIncome.total) - categories.indirectExpense.total;

    container.innerHTML = `
        ${renderPLGroup(categories.directIncome)}
        ${renderPLGroup(categories.directExpense)}
        <div class="pl-row pl-total-row">
            <span>GROSS PROFIT</span>
            <span class="${grossProfit >= 0 ? 'text-profit' : 'text-loss'}">₹ ${grossProfit.toFixed(2)}</span>
        </div>
        ${renderPLGroup(categories.indirectIncome)}
        ${renderPLGroup(categories.indirectExpense)}
        <div class="pl-row pl-total-row" style="background: #1e293b; color: white;">
            <span>NET PROFIT</span>
            <span style="color: ${netProfit >= 0 ? '#4ade80' : '#f87171'}">₹ ${netProfit.toFixed(2)}</span>
        </div>
    `;
}

function renderPLGroup(group) {
    if (group.items.length === 0) return '';
    let html = `<div class="pl-row pl-group-head"><span>${group.label}</span><span></span></div>`;
    group.items.forEach(i => {
        html += `<div class="pl-row pl-ledger-row"><span>${i.name}</span><span>${i.bal.toFixed(2)}</span></div>`;
    });
    return html;
}
