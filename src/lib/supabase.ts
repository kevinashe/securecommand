import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export type UserRole = 'super_admin' | 'company_admin' | 'site_manager' | 'security_officer';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  company_code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  company_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  site_id: string;
  guard_id: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  site_id: string;
  reported_by: string;
  shift_id: string | null;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  media_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface SOSAlert {
  id: string;
  guard_id: string;
  site_id: string | null;
  shift_id: string | null;
  latitude: number | null;
  longitude: number | null;
  message: string | null;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Equipment {
  id: string;
  company_id: string;
  site_id: string | null;
  name: string;
  description: string | null;
  serial_number: string | null;
  assigned_to: string | null;
  status: 'available' | 'assigned' | 'maintenance' | 'retired';
  purchase_date: string | null;
  last_maintenance_date: string | null;
  created_at: string;
  updated_at: string;
}
