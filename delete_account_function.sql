-- Create a function to delete the current user's account
-- This will delete both the profile and the auth user
CREATE OR REPLACE FUNCTION delete_current_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current user's ID
  current_user_id := auth.uid();
  
  -- Make sure we have a user ID
  IF current_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  
  -- Delete the user's profile (this will cascade delete related data)
  DELETE FROM profiles WHERE id = current_user_id;
  
  -- Delete the auth user
  DELETE FROM auth.users WHERE id = current_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_current_user_account() TO authenticated;
