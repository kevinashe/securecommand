/*
  # Fix Chat Messages RLS for Group Chat

  1. Changes
    - Drop existing SELECT policy that restricts group chat access
    - Create new SELECT policy that allows all company members to view:
      - Messages they sent
      - Messages sent to them
      - Group messages (recipient_id IS NULL) in their company
  
  2. Security
    - Users can only view messages within their own company
    - Group chat is accessible to all company members
    - Direct messages remain private between sender and recipient
*/

DROP POLICY IF EXISTS "Users can view messages in their company" ON chat_messages;

CREATE POLICY "Users can view messages in their company"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() 
    OR recipient_id = auth.uid()
    OR (
      recipient_id IS NULL 
      AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.company_id = chat_messages.company_id
      )
    )
  );
