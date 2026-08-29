-- Additive, backward-compatible: adds 'llm' as a food.source value for
-- natural-language-logging candidates confirmed into the catalog (same
-- pattern as 'off' for barcode-confirmed candidates in
-- 0013_confirm_off_food.sql). Existing rows/constraints are untouched.
alter type food_source add value if not exists 'llm';
