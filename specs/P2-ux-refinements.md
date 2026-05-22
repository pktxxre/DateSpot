# P2 — UX Refinements

These elevate the feel of the app once the core loop is solid. Build after P1.

---

## 10. Drill transition for logging flow

**Problem:** The logging steps don't feel like a cohesive single flow — transitions between steps are visually inconsistent.

**Expected behavior:**
- Each step-to-step transition uses a **drill** animation (step pushes in from center, zooming forward like drilling into the next screen)
- All logging step pages must be the **same size** before this is implemented — mismatched page sizes will make the drill look broken

**Notes:**
- Normalize page sizes first, then add the animation
- The back transition should feel like drilling back out (reverse drill / zoom-out)

---

## 11. Bulge animation on This or That

**Problem:** The This or That comparison step (step 4) has no feedback when the user makes a selection.

**Expected behavior:**
- When the user taps one of the two spots, that card **slightly expands** (a subtle bulge/scale-up effect)
- At the same moment the next comparison pair appears immediately (no delay — same behavior as now, just with the bulge added)
- The animation is fast and subtle — it should feel like a satisfying tap, not a dramatic effect

**Implementation notes:**
- Use a spring scale animation on the selected card (e.g., scale from 1.0 → 1.06 → 1.0, with the next pair loading at the peak or on release)
- The unselected card does not animate

---

## 12. Been To map pin hierarchy

**Problem:** The Been To map shows all pins at equal visual priority regardless of how highly a spot is rated.

**Expected behavior:**
- Higher-ranked spots render **on top of** lower-ranked spots when pins overlap
- The visual logic should match the Top Spots map, where ranking determines z-order
- Pins for lower-ranked spots should be visually behind higher-ranked ones in overlap zones

**Notes:**
- This is a z-index / render-order change for the Been To map layer
- No change to pin size or color needed — just stacking order

---

## 13. Headspace reminder in step 4 (This or That)

**Problem:** When comparing two spots in step 4, users don't have context for how to think about the comparison. They might compare an outdoorsy hike to a fancy restaurant without a shared frame of reference.

**Expected behavior:**
- Add a line of **meta-text** beneath the "Step 4 of 5" indicator
- The text sets the scene for the user, something like: **"Which would you want to take someone on a date?"**
- This text is small and secondary — it should not compete with the spot cards visually

**Notes:**
- The exact copy can be refined, but the intent is to remind the user they're rating for date potential, not general quality
- This is especially important because it doesn't make sense to compare a casual café to a special occasion restaurant without a shared lens

---

## 14. Onboarding polish

### Password field
- The password input field should be **empty** with no background placeholder text visible inside the input box

### Name fields
- Change "What should we call you?" to ask for the user's **real first name and last name**
- Last name is **no longer optional** — both fields are required
- Update field labels and validation accordingly

---

## 15. Stack cover photo

**Problem:** Stacks have no visual identity beyond their name.

**Expected behavior:**
- Users can upload a **cover photo** for a stack
- If no cover photo is uploaded, the stack displays the **first letter of the stack name** as its cover (large, centered, styled)

**Notes:**
- The letter fallback should be consistent with the app's design system (same font weight, background color treatment as other avatar/placeholder elements)
- The upload flow should be accessible from the stack detail view or stack creation flow

---

## 16. Emoticon profile pictures

**Problem:** Users who skip the profile photo upload have no visual identity.

**Expected behavior:**
- When a user has no profile photo, assign them a **random ASCII face** from this set:

```
:D  :P  d:  :)  :>  :3  :O  :o  >:)  xD  o.o  O.o  o.O  ^.^  ^^  ^_^  ._.  :v  v:
```

- The assigned face should be consistent per user (same face every time they appear), not randomized on each render
- Displayed in the same space where a profile photo would appear
- Use a monospace or display font so the characters render correctly

**Notes:**
- Assign at account creation or on first load when photo is null — store the assigned face in the user profile
