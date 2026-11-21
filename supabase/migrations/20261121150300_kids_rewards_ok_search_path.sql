-- Fix advisor warning: pin search_path on the _ok helper.
alter function kids_rewards._ok(jsonb) set search_path = '';
