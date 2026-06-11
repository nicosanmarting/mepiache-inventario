/* ===========================
   Mepiache Inventario - Configuración de Supabase
   ---------------------------------------------
   Este archivo NO se sube a GitHub (ver .gitignore).
   Contiene la URL del proyecto y la "anon public key",
   que están pensadas para usarse en el frontend (la
   seguridad real la dan las políticas RLS en la base
   de datos, definidas en sql/schema.sql).
   =========================== */

const SUPABASE_URL = 'https://jivccnpqangjckoxakyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdmNjbnBxYW5namNrb3hha3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzk4OTUsImV4cCI6MjA5NjYxNTg5NX0.cAX8k5XdiTvDnBFbZCpEMCYSGdpzqntQvQtzjv5ne0o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
