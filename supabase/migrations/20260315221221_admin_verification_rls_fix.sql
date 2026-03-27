-- Allow admins to view all verification requests
CREATE POLICY "Admins can view all verification requests" ON "public"."verification_requests"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Allow admins to update verification requests
CREATE POLICY "Admins can update verification requests" ON "public"."verification_requests"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);
;
