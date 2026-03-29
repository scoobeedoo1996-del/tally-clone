;

// supabaseClient.js
const sbUrl = 'https://oibgebwvdmanddmkewnc.supabase.co';
const sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pYmdlYnd2ZG1hbmRkbWtld25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDQzOTUsImV4cCI6MjA5MDI4MDM5NX0.v3hYRDr7usrVaTPZDfaB3zKbaVko6cfirQ6P1CfKXtc';

// Use 'sbClient' instead of 'supabase' to avoid clashing with the library
window.supabaseClient = supabase.createClient(sbUrl, sbKey);
