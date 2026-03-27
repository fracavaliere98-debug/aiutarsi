CREATE POLICY "Volunteers can leave activities" 
ON public.activity_participants 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);;
