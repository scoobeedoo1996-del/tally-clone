
// supabaseClient.js
const SUPABASE_URL = 'https://oibgebwvdmanddmkewnc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pYmdlYnd2ZG1hbmRkbWtld25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDQzOTUsImV4cCI6MjA5MDI4MDM5NX0.v3hYRDr7usrVaTPZDfaB3zKbaVko6cfirQ6P1CfKXtc';

// Check if the global supabase exists before using it
if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("Supabase library not loaded!");
}
