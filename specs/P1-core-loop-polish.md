# P1 — Core Loop Polish

These sharpen the primary logging and map experience. Build after P0 bugs are fixed.

---

## 4. Calendar picker for date entry

**Problem:** The current date entry in the logging flow (step 2) does not use a proper calendar. Users expect to tap a day on a month grid.

**Expected behavior:** Step 2 opens a **calendar picker** — a full month grid where users can:
- Tap a day to select it
- Swipe or tap arrows to move between months
- See the selected date highlighted

**Notes:**
- This was mentioned twice in the interview — it's a strong signal
- "Calendar picker" = date picker in day/calendar view (not a text input, not a scroll wheel)
- The selected date should display clearly above or within the step before the user advances
- Default to today's date pre-selected when the picker opens

---

## 5. Spot name at top, tap to edit

**Problem:** When logging, users are auto-prompted to change the spot name. This interrupts flow and implies the name is wrong.

**Expected behavior:**
- The spot name appears at the top of the logging screen (always visible)
- It is **not** auto-focused or auto-prompted for editing
- The user can tap the name to edit it if they want to
- Tapping away or confirming closes the edit inline

**Notes:**
- Treat the name like a header the user passively sees, not a form field they must interact with
- This change applies across all entry points into logging (search, card tap, map tap)

---

## 6. Map auto-switches view after logging

**Problem:** After a user finishes logging a spot, the map stays on whatever view it was on. The user has to manually switch to see their newly logged spot.

**Expected behavior:**
- If the user logged a **Been To** spot → switch the map to the **Been To** view
- If the user logged a **Want to Go** spot → switch the map to the **Want to Go** view

**Notes:**
- This should happen immediately after the logging flow completes (on the final confirmation step)
- The map should also center on or highlight the newly logged spot if possible
- Do not switch the map view mid-logging — only on completion

---

## 7. Notes as a real tab in logging

**Problem:** The notes field is buried or styled differently from other logging tabs like "Price Range" and "What kind of date?"

**Expected behavior:**
- "Notes" appears as a **tab** in the logging flow with equal visual weight to other tabs
- The placeholder text inside the notes input is: **"What made it memorable?"**
- No other changes to notes behavior

---

## 8. Highlighted map pin name stays black

**Problem:** When a spot is highlighted/selected on the map, the pin label text changes to the highlight color instead of staying black.

**Expected behavior:** The pin label (spot name) stays **black** at all times — highlighted or not. Only the pin marker itself should change color on selection.

---

## 9. Loading spinner in search bar

**Problem:** When the user types in the search bar during logging, there is no loading indicator. The results appear after a delay with no feedback.

**Expected behavior:**
- Show a spinner inside or adjacent to the search bar while a search is in flight
- Hide the spinner once results appear or if the input is cleared
- Standard activity indicator — no custom animation needed here
