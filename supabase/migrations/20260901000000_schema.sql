-- Church Seating Management Database Schema & Seed Script
-- Supabase PostgreSQL Migration

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'usher', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_status AS ENUM ('scheduled', 'active', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE seat_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'HELD', 'BLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE seat_type AS ENUM ('standard', 'vip', 'accessible', 'companion');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'usher',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CHURCHES & AUDITORIUMS
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auditoriums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_seats INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SECTIONS, ROWS, AND SEATS
CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auditorium_id UUID NOT NULL REFERENCES public.auditoriums(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    row_name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    row_id UUID NOT NULL REFERENCES public.rows(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    seat_type seat_type NOT NULL DEFAULT 'standard',
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    x_pos INT NOT NULL DEFAULT 0,
    y_pos INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(row_id, seat_number)
);

-- 5. SERVICES & SERVICE SEATS
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    service_time TIMESTAMPTZ NOT NULL,
    status service_status NOT NULL DEFAULT 'scheduled',
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
    status seat_status NOT NULL DEFAULT 'AVAILABLE',
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ,
    held_by UUID REFERENCES public.profiles(id),
    held_until TIMESTAMPTZ,
    reservation_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id, seat_id)
);

-- 6. USHER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.usher_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    usher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id, usher_id, section_id)
);

-- 7. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. INDEXES FOR REALTIME & FAST QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_service_seats_service_status ON public.service_seats(service_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_row ON public.seats(row_id);
CREATE INDEX IF NOT EXISTS idx_rows_section ON public.rows(section_id);
CREATE INDEX IF NOT EXISTS idx_sections_auditorium ON public.sections(auditorium_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_service ON public.activity_logs(service_id);

-- 9. CONCURRENCY SAFE STORED PROCEDURE FOR ATOMIC SEAT ASSIGNMENT
-- Uses SELECT ... FOR UPDATE to lock rows and guarantee no two ushers assign the same seat concurrently.
CREATE OR REPLACE FUNCTION public.assign_service_seats(
    p_service_id UUID,
    p_seat_ids UUID[],
    p_usher_id UUID,
    p_usher_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_seat_id UUID;
    v_current_status seat_status;
    v_assigned_count INT := 0;
    v_failed_seats UUID[] := ARRAY[]::UUID[];
BEGIN
    -- Loop through target seats and acquire Row Exclusive Lock
    FOREACH v_seat_id IN ARRAY p_seat_ids LOOP
        SELECT status INTO v_current_status
        FROM public.service_seats
        WHERE service_id = p_service_id AND seat_id = v_seat_id
        FOR UPDATE;

        IF v_current_status = 'AVAILABLE' OR v_current_status = 'HELD' THEN
            UPDATE public.service_seats
            SET status = 'OCCUPIED',
                assigned_by = p_usher_id,
                assigned_at = NOW(),
                held_by = NULL,
                held_until = NULL,
                updated_at = NOW()
            WHERE service_id = p_service_id AND seat_id = v_seat_id;
            
            v_assigned_count := v_assigned_count + 1;
        ELSE
            v_failed_seats := array_append(v_failed_seats, v_seat_id);
        END IF;
    END LOOP;

    -- Log activity if at least 1 seat assigned
    IF v_assigned_count > 0 THEN
        INSERT INTO public.activity_logs (service_id, user_id, user_name, action, details)
        VALUES (
            p_service_id,
            p_usher_id,
            p_usher_name,
            'SEAT_ASSIGNED',
            format('Assigned %s seat(s)', v_assigned_count)
        );
    END IF;

    IF array_length(v_failed_seats, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'assigned_count', v_assigned_count,
            'message', 'Some seats were no longer available',
            'failed_seats', v_failed_seats
        );
    ELSE
        RETURN jsonb_build_object(
            'success', TRUE,
            'assigned_count', v_assigned_count,
            'message', 'Successfully assigned all seats'
        );
    END IF;
END;
$$;

-- 10. ATOMIC SEAT HOLD STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.hold_service_seats(
    p_service_id UUID,
    p_seat_ids UUID[],
    p_usher_id UUID,
    p_usher_name TEXT,
    p_hold_minutes INT DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_seat_id UUID;
    v_current_status seat_status;
    v_held_until TIMESTAMPTZ := NOW() + (p_hold_minutes || ' minutes')::INTERVAL;
    v_held_count INT := 0;
BEGIN
    FOREACH v_seat_id IN ARRAY p_seat_ids LOOP
        SELECT status INTO v_current_status
        FROM public.service_seats
        WHERE service_id = p_service_id AND seat_id = v_seat_id
        FOR UPDATE;

        IF v_current_status = 'AVAILABLE' THEN
            UPDATE public.service_seats
            SET status = 'HELD',
                held_by = p_usher_id,
                held_until = v_held_until,
                updated_at = NOW()
            WHERE service_id = p_service_id AND seat_id = v_seat_id;
            
            v_held_count := v_held_count + 1;
        END IF;
    END LOOP;

    IF v_held_count > 0 THEN
        INSERT INTO public.activity_logs (service_id, user_id, user_name, action, details)
        VALUES (
            p_service_id,
            p_usher_id,
            p_usher_name,
            'SEAT_HELD',
            format('Placed hold on %s seat(s) for %s mins', v_held_count, p_hold_minutes)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', (v_held_count = array_length(p_seat_ids, 1)),
        'held_count', v_held_count,
        'held_until', v_held_until
    );
END;
$$;

-- 11. EXPIRED HOLDS RELEASE FUNCTION
CREATE OR REPLACE FUNCTION public.release_expired_holds(p_service_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_released_count INT;
BEGIN
    WITH released AS (
        UPDATE public.service_seats
        SET status = 'AVAILABLE',
            held_by = NULL,
            held_until = NULL,
            updated_at = NOW()
        WHERE service_id = p_service_id 
          AND status = 'HELD' 
          AND held_until <= NOW()
        RETURNING id
    )
    SELECT count(*) INTO v_released_count FROM released;

    IF v_released_count > 0 THEN
        INSERT INTO public.activity_logs (service_id, user_id, user_name, action, details)
        VALUES (
            p_service_id,
            NULL,
            'System Auto-Release',
            'SEAT_HOLD_EXPIRED',
            format('Released %s expired seat hold(s)', v_released_count)
        );
    END IF;

    RETURN v_released_count;
END;
$$;

-- 12. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoriums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read seating data & service status
CREATE POLICY "Allow public read on seating setup" ON public.churches FOR SELECT USING (true);
CREATE POLICY "Allow public read on auditoriums" ON public.auditoriums FOR SELECT USING (true);
CREATE POLICY "Allow public read on sections" ON public.sections FOR SELECT USING (true);
CREATE POLICY "Allow public read on rows" ON public.rows FOR SELECT USING (true);
CREATE POLICY "Allow public read on seats" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Allow public read on services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Allow public read on service_seats" ON public.service_seats FOR SELECT USING (true);
CREATE POLICY "Allow authenticated updates on service_seats" ON public.service_seats FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow read activity_logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (true);
