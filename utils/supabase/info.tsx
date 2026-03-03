/**
 * BRUTAL — API configuration
 * 
 * The frontend talks to the Hono server, which talks to Supabase.
 * The frontend does NOT talk to Supabase directly.
 * 
 * API_BASE is empty string because the server serves both the API 
 * and the static files from the same origin. So fetch("/health") 
 * goes to the same Railway URL that served the HTML.
 */

// Keep these for backwards compatibility with components that import them
// but they should NOT be used for API calls anymore
export const projectId = "cmyuwzikhamtxlsvxqkx"
export const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteXV3emlraGFtdHhsc3Z4cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzMxNjEsImV4cCI6MjA4ODA0OTE2MX0.QTt7SEe-MtydQNGZ3TjZJDIo1Szavmh3VgjsH1JPakk"

// This is what all API calls should use
// Empty string = same origin = relative URLs
// fetch(`${API_BASE}/health`) → fetch("/health")
export const API_BASE = ""
