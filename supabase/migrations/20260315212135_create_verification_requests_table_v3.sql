DO $$
BEGIN
    -- Create verification_requests table
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'verification_requests') THEN
        CREATE TABLE verification_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
            npo_details JSONB NOT NULL,
            admin_notes TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );

        -- Enable RLS
        ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

        -- Policies
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own requests' AND tablename = 'verification_requests') THEN
            CREATE POLICY "Users can view their own requests" ON verification_requests
                FOR SELECT USING (auth.uid() = user_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own requests' AND tablename = 'verification_requests') THEN
            CREATE POLICY "Users can create their own requests" ON verification_requests
                FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
    END IF;

    -- Add verification_status to profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='verification_status') THEN
        ALTER TABLE profiles ADD COLUMN verification_status TEXT DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));
    END IF;
END $$;
;
