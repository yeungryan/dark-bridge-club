# S07 · Four profiles plus PIN
**Milestone:** M1 · **Depends on:** S06 · **Size:** S · **Package:** `server`, `client`

## Purpose
Know who's who, so history and rivalries work, with almost no friction (P5).

## Behaviour
- Exactly **4 profiles**, created in advance: **Darren, Adrian, Ryan, Kim** (the order of the D-A-R-K crest). Each has a name and a fixed personal color. *(Avatars are picked each session, see S24, not stored on the profile.)*
- Each profile also stores its **usual partner** (Darren ↔ Kim, Adrian ↔ Ryan), used as the default in the partner pick (S05).
- **First visit on a device:** open the private link → tap your name → enter your 4-digit PIN → the server issues a long-lived device token (an HttpOnly cookie, about 1 year).
- **Later visits:** straight to the table.
- PINs are stored hashed. 5 wrong attempts → that profile is locked for 10 minutes.
- **The same profile on two devices:** the newest connection takes the seat, and the older device shows "Continued on another device."
- Admin (you): can reset a friend's PIN.

## Acceptance criteria
- [ ] Getting from the link to the table on a new phone takes ≤ 3 taps plus the PIN.
- [ ] A wrong PIN never shows whether the profile exists.
- [ ] A second device takes over the seat cleanly mid-deal.

## Out of scope
Email, OAuth, more than four profiles.
