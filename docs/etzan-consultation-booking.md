# ETZAN consultations and appointment booking

## Customer flow

- `/consultations`: choose one of the four consultation services, then select an available provider, date, and time.
- `/my-consultations`: look up a booking using its request UUID and the email used at booking. The page shows review/payment state, the confirmed Zoom link, and eligible cancellation/rescheduling actions.
- `/pay-request`: complete the prepaid charge through the existing Moyasar Payment Intent flow. Card data remains in the Moyasar hosted form; the platform stores payment references and status only.
- `/payment-result`: verifies the returned payment with Moyasar on the server and displays the Zoom join link only after verified payment.

## Provider and administrator flow

- `/platform-admin/availability`: consultants publish their own slots; administrators and platform managers can publish slots for active consultant accounts. Overlapping availability for the same provider is rejected.
- The same page lists bookings for the signed-in consultant (or all bookings for an administrator), shows payment and Zoom status, and allows the provider to mark a completed session or request cancellation.
- `/platform-admin/requests`: administrators and platform managers review new consultation requests, set the price in SAR, approve/reject, and process refunds for paid cancellation requests.
- A consultant cancellation or customer cancellation of a paid appointment enters `cancellation_requested`. The slot remains unavailable until the payment refund succeeds. The refund API then releases the slot back to the availability calendar.

## Booking and payment state

1. A booking request atomically places a 90-minute temporary hold on the selected slot and records the service, provider, duration, contact details, and video delivery mode.
2. A manager approves/rejects the request. Approval requires the Zoom integration to provision the meeting and sets the SAR price and `awaiting_payment` state.
3. Moyasar creates a Payment Intent only for an approved request with a live temporary slot hold.
4. The callback and webhook independently verify the provider payment, amount, currency, and intent description. The booking is marked `approved` and the slot `booked` only after Moyasar reports `paid`.
5. The customer receives the video join link only after payment confirmation.
6. Paid customer rescheduling atomically holds a new slot, updates the existing Zoom meeting time, changes the booking, and releases the previous slot. It does not create a second charge when the service remains unchanged.

Key request states: `pending_review`, `awaiting_payment`, `approved`, `cancellation_requested`, `cancelled`, `completed`, `rejected`, and `refunded`.

## Notifications

Consultation notices are written to MongoDB collection `platform_notifications`. Email delivery uses the Resend API and is idempotent across the payment callback and webhook. If Resend is not configured, the in-app database record is retained with `email_not_configured`; no email is sent.

Configure these server environment variables:

- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: sender address verified with Resend.
- `NEXT_PUBLIC_APP_URL`: canonical HTTPS site origin used in notification links.
- `MOYASAR_SECRET_KEY` and `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`: Moyasar payment credentials.
- `MOYASAR_WEBHOOK_SECRET`: secret token used to authenticate payment webhooks.
- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID`, and optionally `ZOOM_TIMEZONE`: Zoom Server-to-Server OAuth and meeting host settings.

## Privacy and safeguards

- Customer lookup requires both the unguessable request UUID and the email used at booking.
- Cancellation during an in-flight payment is blocked until the payment state is known.
- Cancellation after the scheduled start and rescheduling after the current start are blocked.
- Paid cancellation does not reopen the slot until the provider refund endpoint confirms the refund.
- Zoom links are withheld from unpaid requests.
- The consultation form explicitly warns customers not to submit beneficiary health details or identifying clinical information.
- These are scheduling and professional-support services, not emergency response or automated diagnosis.
