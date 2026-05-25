# Changelog

All notable changes to DateSpot are documented here.

## [0.3.0.0] - 2026-05-25

### Added
- **Intro screen** — new animated intro plays a video with a typewriter "DateSpot" reveal on first launch; gracefully falls back to the main app if `expo-video` is unavailable or the video fails to load

### Changed
- **Routing** — onboarding and auth flows now redirect to `/intro` (then `/(tabs)`) instead of `/walkthrough`; `friends` route removed from the root stack (moved to tabs)
- **Skeleton polish** — home category, spot detail, and future spot detail skeletons now use taller, more accurate placeholder rows that match real content heights
- **Sync lazy imports** — `recomputeRatings` and `recomputeStackRatings` are now lazily imported in `restoreFromCloud` to avoid circular module dependency at startup

## [0.2.0.0] - 2026-05-22

### Added
- **Inbox** — new notifications screen shows friend requests, accepted friends, and emoji reactions on visits; bell icon in the friends tab header with an unread badge
- **Emoji reactions** — tap 🔥 ❤️ 😍 👏 on any visit detail to react; reactions are shown with per-emoji counts and a highlighted own-reaction state
- **Cloud sync** — visits, future spots, stacks, and profile data now sync to Supabase; new devices restore all data automatically on login (`lib/sync.ts`)
- **Walkthrough screen** — onboarding flow introduces DateSpot's core concept before the main app loads
- **Occasion type** — visits and future spots now track the occasion (Romantic, Friend Group, Solo); ranking is computed per-occasion so Date Night and Friend spots maintain separate ordered lists
- **Activity type expansion** — new categories: Bars, Cafes, Indoors, Shopping; legacy "drinks" data migrated to "bars"
- **Tier rating system for stacks** — S/A/B/C/F tier labels with optional notes and cover photo
- **Future spot detail screen** — full edit screen for want-to-visit spots with occasion and activity type pickers
- **Tier browse screen** — dedicated screen listing all visits in a given tier
- `updateFutureSpotTypes` — update occasion/activity type on a saved future spot
- Friends profile lookup now shows real visit counts (batched single query, not N+1)

### Changed
- Ranking now handles ties correctly — spots with the same score share a `rank_order` value and display the same rating
- Map screen UI overhauled with improved pin labels, category filters, and detail sheet layout
- Spot detail screen redesigned with reaction row and improved layout
- Friends tab redesigned with sliding pills (Friends / Activity), activity feed cards, and FriendsSheet modal
- `recomputeRatings` now partitions by `occasion_type` so ratings are computed per occasion dimension
- `friendlyDate` correctly parses ISO timestamps (split on `T` before `-`)

### Fixed
- `accept_friend_request` RPC now verifies `auth.uid()` matches the intended recipient — prevents unauthorized acceptance
- Reactions table restricted to authenticated users (was publicly readable by anonymous users)
- Duplicate reaction notifications prevented — upsert replaces repeat inserts
- Ghost stacks in cloud: deleting a visit that auto-removes a 1-member stack now deletes the stack from the cloud too
- Cloud restore now preserves `activity_type`, `occasion_type`, and `address` for future spots
- SQLite migrations wrapped in a transaction — crash mid-migration no longer leaves schema partially applied
- Inbox unknown notification types no longer fall through to ReactionRow (rendered as null instead)
- `searchProfiles` sanitizes query input to prevent PostgREST filter injection
- `syncFutureSpotToCloud` now syncs `address`, `activity_type`, and `occasion_type` fields
- Category pill no longer overflows on comparison cards
- Friends tab empty state no longer shows skeleton when user has no friends

## [0.1.4.1] - 2026-05-21

### Fixed
- "Too hard to compare" now correctly ties both spots at the same score — items with identical `rank_order` are grouped and assigned a shared rating, so neither place drops when the user can't decide
- Category pill (e.g. "ENTERTAINMENT") no longer pushes the rating badge off the comparison card — label now shrinks instead of overflowing
- Friends tab no longer shows the loading skeleton when the user has no friends — the empty state appears immediately instead

## [0.1.4.0] - 2026-05-21

### Added
- Friends tab now shows a full activity feed with unified cards — consistent height, rating pill, emoticon avatar, Like and "Add to list" action buttons per card
- Like friend activity: tap the heart on any friend's card to save it to your likes (persisted in SQLite, survives restart)
- FriendsSheet component: open any friend's profile from their activity card — shows their visit history and top spots
- SlidingPills component replaces static segment controls across Friends, Lists, and other tabs — animated pill slides to the selected item
- TabSlideWrapper drives directional slide animation when switching between sub-views within a tab
- Recommended spots section in Friends tab surfaces places your friends have liked that you haven't visited yet

### Changed
- Friends tab redesigned with design-spec tokens — consistent spacing, cream card backgrounds, hairline dividers between rows, no card borders
- Lists tab updated to use SlidingPills for the "My Lists / Friends' Lists" toggle with slide-in animation
- Map tab and Spots screen layout updated with tab slide transitions
- `ratingColor` is now app-wide — imported from `lib/visits` instead of duplicated per screen

### Fixed
- Activity card row height standardized — previously inconsistent heights caused visual jitter when scrolling
- Card backgrounds unified to cream — mixed whites and off-whites resolved

## [0.1.3.0] - 2026-05-20

### Added
- Friends tab now loads and displays accepted friends' recent spot activity — after accepting a request the feed populates immediately on next focus
- When a friend accepts your request, you receive a "Friends now!" notification in the inbox
- Profile screen friends count is now live — reflects accepted friendships and updates when you navigate to the tab

### Fixed
- Accepting or declining a friend request in the inbox now persists correctly — leaving and returning to Notifications no longer resets the row back to the Accept/Decline buttons
- Friend request rows initialize their state from the database on every load, so "Friends now!" and "Declined" survive navigation

### Changed
- `lib/friends.ts` — added `getFriends()`, `getFriendActivity()`, and `notifyFriendAccepted()` to power the friends feed and accepted-request notifications
- `lib/notifications.ts` — notifications now carry `actorId` and `friendStatus` so the inbox can render correct state without extra round-trips

## [0.1.2.1] - 2026-05-19

### Changed
- Logging steps now slide in with a drill/push transition instead of appearing instantly
- Draft pin no longer appears on the map while logging is in progress
- Newly saved spots sprout onto the map with a pop animation (scale up, brief overshoot, settle) immediately after the Done screen is dismissed
- Sprout animation uses the JS thread so react-native-maps snapshots the correct scale before freezing the marker; prevents the pin from going invisible after animation
- Animation state is properly cancelled if the log flow is reset mid-animation, preventing stale timers and tracksViewChanges staying true

## [0.1.2.0] - 2026-05-19

### Added
- Stack creation modal now includes a cover photo picker below the name field — tap to upload from your library; the selected image becomes the stack's cover photo
- Stacks without a cover photo now show a letter placeholder tile (first character of the stack name) in the tier list — styled with an orange tint border matching the New Stack button
- Occasion type (Romantic / Friend / Solo) is now a distinct field from activity type in the log flow, allowing both dimensions to be tracked independently
- Activity type gains new categories: Bars, Cafes, Indoors, and Shopping (replaces Drinks)
- Map screen pans to the newly saved pin location after a log is completed

### Changed
- Stack cover photo falls back to the first spot's photo if no stack-level photo is set, preserving existing behavior
- Seed venue type filter on the map now uses expanded categories matching the new activity type list

## [0.1.1.0] - 2026-05-17

### Added
- All Date Spots screen now shows a shimmer skeleton while spots load — chip rows, price filters, and spot rows all animate in sync
- Stack detail screen shows a horizontal photo strip of all photos from the selected visits, placed below the spots list
- Stack detail photo strip is edge-to-edge with rounded thumbnails

### Changed
- Compare step (logging flow) cards have fixed height so names, pills, and labels stay at consistent eye level across all comparison rounds
- Compare step rating pill now uses transparent background with colored border and text (matching the map view style)
- New spot in compare step shows a grey "?" pill before its first comparison, then updates live as ratings are assigned
- Stack list card removes the trash icon, creation date, and score — showing only name and spot journey
- Stack creation modal slides up without a dark overlay behind the card
- Stack detail hero removes the creation date; average rating pill switches to transparent background with colored border and text
- All Spots list truncates long venue names to a single line with ellipsis so row heights stay uniform

### Fixed
- Real category chips and price filter row are hidden during skeleton load, preventing overlap with skeleton UI

## [0.1.0.0] - 2026-05-08

### Added
- Full app scaffold: Expo SDK 54, Apple Maps (react-native-maps), SQLite local storage
- Map screen with live pin colours, FAB log button, and tap-to-detail callout
- Log flow (5-step bottom sheet): location pin drop, venue name, activity type, price, ranking, notes, and photos
- Beli-style pairwise ranking engine — triage new spot against existing spots, produces 0.1–10.0 rating
- Photo upload to Supabase Storage with lazy-require expo-image-picker (works in Expo Go and compiled binary)
- Home screen with Favorites tab (top 3 per category with full-bleed banner images) and All Spots tab (sort by date / best / worst)
- Category banner images for food, drinks, outdoors, pretty view, entertainment, and other
- Spot detail screen with photos, rating pill, mini-map widget, edit and delete actions
- Profile screen with avatar, username, bio, and edit flow
- Settings screen (change email/phone/password, privacy, log out, delete account)
- Unified color system via `lib/theme.ts` replacing per-screen color objects
- Draft persistence: in-progress log flow survives app backgrounding via AsyncStorage
- Supabase Storage integration for photo upload and deletion

### Fixed
- `friendlyDate` now parses dates as local time, preventing wrong Today/Yesterday in UTC-west timezones
- `openLog` deep-link param now fires only once per navigation (useRef latch prevents sheet re-opening on tab refocus)
- Settings back button touch area covers the full circle (removed absolutelypositioned title intercepting touches)
- expo-image-picker loaded via lazy require to prevent route crash when native pod not compiled
- Activity chip background and photo icon alignment in log details step

### Changed
- Culture removed from activity type options; spots are now categorised as food, drinks, outdoors, view, entertainment, or other
