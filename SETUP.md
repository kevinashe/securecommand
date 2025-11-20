# Security Guard Management System - Setup Guide

## Demo Account Setup

The system requires demo accounts to be created in Supabase Auth. Since these cannot be created via SQL directly, you need to create them through the Supabase Dashboard or API.

### Demo Accounts to Create

Create the following accounts in your Supabase Auth dashboard:

1. **Super Admin**
   - Email: `superadmin@demo.com`
   - Password: `demo123`
   - Metadata:
     ```json
     {
       "full_name": "Super Admin",
       "role": "super_admin"
     }
     ```

2. **Company Admin**
   - Email: `admin@demo.com`
   - Password: `demo123`
   - Metadata:
     ```json
     {
       "full_name": "Company Admin",
       "role": "company_admin",
       "company_id": "11111111-1111-1111-1111-111111111111"
     }
     ```

3. **Dispatcher**
   - Email: `dispatch@demo.com`
   - Password: `demo123`
   - Metadata:
     ```json
     {
       "full_name": "Dispatcher Manager",
       "role": "site_manager",
       "company_id": "11111111-1111-1111-1111-111111111111"
     }
     ```

4. **Security Officer**
   - Email: `officer@demo.com`
   - Password: `demo123`
   - Metadata:
     ```json
     {
       "full_name": "Security Officer",
       "role": "security_officer",
       "company_id": "11111111-1111-1111-1111-111111111111"
     }
     ```

### How to Create Users in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add user** > **Create new user**
4. Enter the email and password
5. Click **Create user**
6. After creation, click on the user to edit
7. Scroll to **User Metadata** section
8. Add the metadata fields as shown above
9. Save changes

### Alternative: Using Supabase CLI or API

You can also create users programmatically using the Supabase Management API or by implementing a signup flow in the application.

## Features Implemented

- Multi-tenant architecture with role-based access control
- Real-time dashboard with statistics
- Shift scheduling and management
- Incident reporting with severity levels
- SOS alert system with real-time updates
- Messaging system between team members
- GPS location tracking (browser-based)
- Edge Function for daily reports
- Comprehensive database schema with RLS policies

## System Roles

- **Super Admin**: Full system access, manages all companies
- **Company Admin**: Manages company sites, guards, and operations
- **Site Manager**: Manages specific sites and their operations
- **Security Officer**: Field operations, reporting, and check-ins

## Database Tables

- profiles, companies, sites, shifts
- patrol_routes, checkpoints, check_ins
- incidents, equipment, sos_alerts
- messages, subscriptions, invoices, payments
- gps_tracking

All tables have comprehensive Row Level Security policies based on user roles.

## Edge Functions

- **daily-reports**: Generates daily activity reports with statistics

## Next Steps

1. Create the demo user accounts as described above
2. Log in with any of the demo accounts
3. Explore the different views based on user role
4. Test creating shifts, incidents, and sending messages

## Notes

- The system uses browser geolocation for GPS features
- Real-time updates use Supabase real-time subscriptions
- All data is secured with Row Level Security policies
- The demo company ID is: `11111111-1111-1111-1111-111111111111`
