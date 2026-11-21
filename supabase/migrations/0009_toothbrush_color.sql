-- 0009_toothbrush_color.sql — צבע מברשת השיניים של כל דייר (אופציונלי, hex בצורת #RRGGBB).
-- הפרופיל כבר נקרא על ידי חברי אותו בית (profiles_select) ונערך רק על ידי הבעלים (profiles_update_own).

alter table public.profiles
  add column if not exists toothbrush_color text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_toothbrush_color_check') then
    alter table public.profiles
      add constraint profiles_toothbrush_color_check
      check (toothbrush_color is null or toothbrush_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;
