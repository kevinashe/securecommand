/*
  # Add missing foreign keys to chat_messages table

  1. Changes
    - Add foreign key from `chat_messages.sender_id` to `profiles.id`
    - Add foreign key from `chat_messages.recipient_id` to `profiles.id`
  
  2. Reason
    - These foreign keys were missing, causing PostgREST join queries to fail with 400 errors
    - Enables proper relational queries between chat_messages and profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_messages_sender_id_fkey'
    AND table_name = 'chat_messages'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_messages_recipient_id_fkey'
    AND table_name = 'chat_messages'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES profiles(id);
  END IF;
END $$;
