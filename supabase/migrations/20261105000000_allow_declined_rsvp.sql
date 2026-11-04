-- Allow a guest to decline attendance with zero attendees.
-- Existing RSVP rows are preserved; only the accepted range changes.
alter table public.rsvp_responses
  drop constraint if exists rsvp_responses_person_count_check;

alter table public.rsvp_responses
  add constraint rsvp_responses_person_count_check
  check (person_count >= 0 and person_count <= 10);
