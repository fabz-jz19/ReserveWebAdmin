# Partner Onboarding Analytics

This document defines the current analytics model for the public partner onboarding flow in [public/partner-onboarding.html](/Users/noellettejeremiefabien/Documents/Reserve/ReserveWebAdmin/public/partner-onboarding.html).

## Purpose

The onboarding analytics were simplified to answer two questions clearly:

1. How many users completed each onboarding step?
2. How many users completed the full onboarding flow?

Older event types such as field interaction, scroll depth, and timing should be treated as historical only. They are not the recommended source for funnel reporting.

## Effective Model

Use this event set as the current source of truth:

- `partner_onboarding_view`
- `partner_onboarding_start`
- `partner_onboarding_step_complete`
- `partner_onboarding_submit_success`

## Event Definitions

### `partner_onboarding_view`

Fires when the onboarding page loads.

Use it for:
- total onboarding page visits
- top-of-funnel visit volume

Parameters:
- `flow_id`
- `firebase_env`
- `page_path`

Example use:
- Count how many sessions landed on `/partner-onboarding`

### `partner_onboarding_start`

Fires once when the user starts the onboarding flow from an entry CTA.

Use it for:
- measuring how many visitors begin the flow
- comparing visits vs starts
- comparing CTA source performance

Parameters:
- `flow_id`
- `firebase_env`
- `cta_source`

Example use:
- Count how many users moved from viewing the page to starting onboarding

### `partner_onboarding_step_complete`

Fires once per step, per onboarding flow.

This is the main funnel event.

Use it for:
- step completion counts
- funnel drop-off analysis
- identifying the exact step where users stop progressing

Parameters:
- `flow_id`
- `firebase_env`
- `step_index`
- `step_name`
- `max_step_reached`
- `completion_reason`

Important behavior:
- A step is counted only once for a given onboarding flow
- Going back and redoing the same step does not create a second completion for that step

Example use:
- Count users who completed step 4
- Compare step 4 completions vs step 5 completions to see drop-off

### `partner_onboarding_submit_success`

Fires once when the full onboarding is submitted successfully.

Use it for:
- final completed onboarding count
- onboarding completion rate

Parameters:
- `flow_id`
- `firebase_env`
- `completed_all_steps`
- `completed_step_count`
- `photo_count`
- `branch_count`

Important behavior:
- This event is sent only after a successful submit
- This is the final conversion event for the flow

Example use:
- Count how many users completed the full onboarding

## Step Mapping

`step_index` maps to the onboarding steps as follows:

1. `overview`
2. `category`
3. `basic_information`
4. `mobile_verification`
5. `business_profile`
6. `working_hours`
7. `media_operations`
8. `payment_details`
9. `review`

## Reporting Guidance

### Recommended Funnel KPIs

Use these metrics:

- Visits:
  - event = `partner_onboarding_view`
- Starts:
  - event = `partner_onboarding_start`
- Completed step N:
  - event = `partner_onboarding_step_complete`
  - filter by `step_index = N`
- Full submissions:
  - event = `partner_onboarding_submit_success`

### Recommended Funnel Questions

Examples:

- How many users viewed the onboarding page?
- How many users started onboarding?
- How many users completed step 1?
- How many users completed step 2?
- How many users completed step 3?
- How many users completed the full flow?

### Recommended GA4 Breakdown

For `partner_onboarding_step_complete`, break down by:

- `step_index`
or
- `step_name`

This gives a clean step-by-step completion table.

## Historical Data Note

Older reports may still show event names such as:

- `partner_onboarding_step_timing`
- `partner_onboarding_scroll_depth`
- `partner_onboarding_step_view`
- `partner_onboarding_field_interaction`
- `partner_onboarding_field_completed`
- `partner_onboarding_validation_error`

These events are historical and should not be used as the main onboarding funnel going forward.

Best practice:

- define a reporting cutoff date for the simplified analytics model
- use the simplified event set for all new funnel reporting after that date
- treat older analytics as directional context only

## Notes for Implementation

The funnel-only allowlist is defined in the onboarding page script:

- `partner_onboarding_view`
- `partner_onboarding_start`
- `partner_onboarding_step_complete`
- `partner_onboarding_submit_success`

The implementation also deduplicates:

- flow start
- step completion per step
- final successful submission

This keeps the funnel cleaner than the older analytics model.
