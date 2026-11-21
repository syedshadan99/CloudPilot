-- Worker-generated VM transitions do not have a human actor. Keep the actor
-- foreign key for user actions, while allowing NULL for durable system events.

ALTER TABLE vm_state_events
  ALTER COLUMN actor_id DROP NOT NULL;
