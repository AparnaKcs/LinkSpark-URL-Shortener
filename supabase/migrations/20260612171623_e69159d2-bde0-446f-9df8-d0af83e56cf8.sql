
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles selectable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- URLs
CREATE TABLE public.urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  custom_alias TEXT UNIQUE,
  click_count INTEGER NOT NULL DEFAULT 0,
  last_visited_at TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.urls TO authenticated;
GRANT SELECT ON public.urls TO anon;
GRANT ALL ON public.urls TO service_role;
ALTER TABLE public.urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "URLs readable by anyone" ON public.urls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "URLs insertable by owner" ON public.urls FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "URLs updatable by owner" ON public.urls FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "URLs deletable by owner" ON public.urls FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX urls_user_id_idx ON public.urls(user_id);
CREATE INDEX urls_short_code_idx ON public.urls(short_code);

-- Visits
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id UUID NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  browser TEXT,
  device TEXT,
  os TEXT,
  country TEXT,
  city TEXT
);
GRANT SELECT ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visits readable by url owner" ON public.visits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.urls WHERE urls.id = visits.url_id AND urls.user_id = auth.uid()));
CREATE INDEX visits_url_id_idx ON public.visits(url_id);
CREATE INDEX visits_timestamp_idx ON public.visits(timestamp DESC);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
