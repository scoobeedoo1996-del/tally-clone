const companyListDiv = document.getElementById('company-list');

async function loadCompanies() {
    // Show loading state
    companyListDiv.innerHTML = '<p style="padding: 20px;">Fetching companies...</p>';

    // Fetch from Supabase (the table you already created!)
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error(error);
        companyListDiv.innerHTML = '<p>Error loading companies.</p>';
        return;
    }

    // Display Companies
    if (data.length === 0) {
        companyListDiv.innerHTML = '<p style="padding: 20px;">No companies found. Tap + to add one.</p>';
    } else {
        companyListDiv.innerHTML = data.map(company => `
            <div class="company-card" onclick="selectCompany('${company.id}')">
                <div>
                    <div style="font-weight: bold; font-size: 1.1em;">${company.name}</div>
                    <div style="font-size: 0.8em; color: gray;">FY Start: ${company.financial_year_start}</div>
                </div>
                <span>❯</span>
            </div>
        `).join('');
    }
}

function selectCompany(id) {
    alert("Company Selected! ID: " + id);
    // Future step: Navigate to Gateway of Tally
}

// Initialize
loadCompanies();
