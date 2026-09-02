-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_addresses table
CREATE TABLE IF NOT EXISTS public.saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    label TEXT NOT NULL,
    address_text TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create delivery_history table
CREATE TABLE IF NOT EXISTS public.delivery_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    restaurant_name TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    origin_lat DOUBLE PRECISION NOT NULL,
    origin_lng DOUBLE PRECISION NOT NULL,
    dest_lat DOUBLE PRECISION NOT NULL,
    dest_lng DOUBLE PRECISION NOT NULL,
    distance_km DOUBLE PRECISION,
    duration_mins DOUBLE PRECISION,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_history ENABLE ROW LEVEL SECURITY;

-- Allow public/anonymous read & write access for simulator sessions
CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select saved_addresses" ON public.saved_addresses FOR SELECT USING (true);
CREATE POLICY "Allow public insert saved_addresses" ON public.saved_addresses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete saved_addresses" ON public.saved_addresses FOR DELETE USING (true);

CREATE POLICY "Allow public select delivery_history" ON public.delivery_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert delivery_history" ON public.delivery_history FOR INSERT WITH CHECK (true);
