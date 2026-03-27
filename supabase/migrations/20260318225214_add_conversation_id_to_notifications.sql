ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS related_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;
;
