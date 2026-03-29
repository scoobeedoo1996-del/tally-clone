
// supabaseClient.js
const supabaseUrl = 'https://oibgebwvdmanddmkewnc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pYmdlYnd2ZG1hbmRkbWtld25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDQzOTUsImV4cCI6MjA5MDI4MDM5NX0.v3hYRDr7usrVaTPZDfaB3zKbaVko6cfirQ6P1CfKXtc';

// Use 'window.' to ensure it's globally accessible across all your new modular files
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
