-- Aggiorna la funzione handle_new_user per cercare sia 'full_name' che 'name'
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, npo_name, company_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'displayName'), 
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'avatar'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'VOLUNTEER'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'npo_name', NEW.raw_user_meta_data->>'npoName'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', NEW.raw_user_meta_data->>'companyName')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronizza i profili esistenti che hanno full_name NULL recuperando dai metadati di auth.users
UPDATE public.profiles p
SET full_name = COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'displayName')
FROM auth.users u
WHERE p.id = u.id AND p.full_name IS NULL AND (u.raw_user_meta_data->>'full_name' IS NOT NULL OR u.raw_user_meta_data->>'name' IS NOT NULL);
;
