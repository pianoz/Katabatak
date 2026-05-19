-- Allow any authenticated user to read all creatures (global bestiary for GMs)
CREATE POLICY "authenticated users can view creatures"
ON creatures
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert their own creatures
CREATE POLICY "authenticated users can create creatures"
ON creatures
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Allow users to update and delete their own creatures
CREATE POLICY "users can manage their own creatures"
ON creatures
FOR ALL
TO authenticated
USING (created_by = auth.uid());
