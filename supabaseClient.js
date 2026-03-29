
// 1. Put your actual keys here
const SUPABASE_URL = 'https://oibgebwvdmanddmkewnc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pYmdlYnd2ZG1hbmRkbWtld25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDQzOTUsImV4cCI6MjA5MDI4MDM5NX0.v3hYRDr7usrVaTPZDfaB3zKbaVko6cfirQ6P1CfKXtc';

// 2. We use the global 'supabase' variable from the HTML file to create our client.
// Notice we DO NOT put 'const supabase =' here!
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
