# HealthCheck Practitioner Payout Model

This document explains how HealthCheck pays a medical practitioner for each
completed consultation on ProConnect. It is written so anyone (a doctor, an
investor, or a teammate) can follow the money without reading the code.

Everything here is implemented in one place: `src/lib/proStats.ts`
(`PAYOUT_CONFIG` and `computeConsultPayout`). Change a number there and the
whole app follows.

> Note on wording: we say "payout" rather than "stipend". A stipend is a flat
> allowance. What we pay is earned per consultation and moves with quality and
> speed, so "payout" is the honest word.

## The idea in one line

A practitioner earns a fair share of the fee the patient actually pays, with a
small lift for good care and quick replies, and a loyalty bonus that grows the
longer they stay.

## Where the money comes from

The payout is funded by the patient consult fee. It is not a subsidy we pay out
of nowhere. This matters: a model that pays doctors from thin air runs out of
money. Tying the payout to a real fee means the platform can keep paying it.

- **Base consult fee: ₦2,000.** What a patient is charged for one standard
  consultation.
- **Platform commission: 25%.** Our cut. It covers servers, payment fees,
  support, and identity checks. The doctor keeps the other 75%.

So before anything else, a consult is worth:

```
₦2,000 × (1 − 0.25) = ₦1,500
```

## The three levers

### 1. Quality multiplier (0.90 to 1.10)

After the consult, the patient can rate it 1 to 5 stars. That rating scales the
payout gently:

| Rating   | Multiplier |
|----------|------------|
| 1★       | 0.90       |
| 2★       | 0.95       |
| 3★       | 1.00       |
| 4★       | 1.05       |
| 5★       | 1.10       |
| Not rated | 1.00      |

The band is deliberately narrow (a 5★ consult earns ~22% more than a 1★ one, not
double). We reward good care without punishing a doctor so hard for one bad
rating that they stop taking hard cases.

An unrated consult is treated as neutral (1.00), never as a penalty. Many
patients simply forget to rate, and that is not the doctor's fault.

### 2. Responsiveness bonus (+₦200)

If the consult is accepted within **10 minutes** of the patient's request, we
add a flat ₦200. Fast replies are what make telemedicine feel worth it, so we
pay for them directly. Miss the window and you still earn the full base; you
just don't get the bonus.

### 3. Loyalty tier uplift (0% to 15%)

The more consultations a practitioner has completed, the higher their tier, and
every future consult is lifted by a fixed percentage:

| Tier    | Completed consults | Uplift |
|---------|--------------------|--------|
| Starter | 0–9                | 0%     |
| Bronze  | 10–39              | +5%    |
| Silver  | 40–99              | +10%   |
| Gold    | 100+               | +15%   |

This rewards doctors who stick with the platform and build a track record,
without making a brand-new doctor's pay feel unfair.

## Putting it together

The full formula for one consultation:

```
payout = round(
  [ baseFee × (1 − commission) × qualityMultiplier  +  responsivenessBonus? ]
  × (1 + tierUplift)
)
```

The quality multiplier scales the fee share only. The responsiveness bonus is a
flat add-on. The tier uplift then lifts the whole thing, so loyal doctors earn
more on both their base and their bonus.

## Worked examples

**A. Brand-new GP, average consult, replied fast**
Rating 3★ (×1.00), accepted in 6 minutes (+₦200), Starter tier (+0%).

```
1,500 × 1.00 = 1,500
+ 200 (fast)  = 1,700
× 1.00 (tier) = ₦1,700
```

**B. Experienced doctor, excellent consult, replied fast**
Rating 5★ (×1.10), accepted in 4 minutes (+₦200), Gold tier (+15%).

```
1,500 × 1.10 = 1,650
+ 200 (fast)  = 1,850
× 1.15 (tier) = ₦2,128 (rounded)
```

**C. Same experienced doctor, good consult, replied slowly**
Rating 4★ (×1.05), accepted after 25 minutes (no bonus), Gold tier (+15%).

```
1,500 × 1.05 = 1,575
+ 0 (slow)    = 1,575
× 1.15 (tier) = ₦1,811 (rounded)
```

So a real consult on ProConnect pays roughly **₦1,500 to ₦2,150** depending on
quality, speed, and loyalty. That is a defensible, funded number, not the flat
₦500 stipend we flagged earlier as too low and unbacked.

## The tuning dials

Everything above lives in `PAYOUT_CONFIG` in `src/lib/proStats.ts`:

| Constant              | Value  | Meaning                                        |
|-----------------------|--------|------------------------------------------------|
| `baseConsultFee`      | 2000   | Patient fee per consult (₦)                    |
| `platformCommission`  | 0.25   | Platform's share                               |
| `responsivenessBonus` | 200    | Flat bonus for a fast accept (₦)               |
| `fastAcceptSeconds`   | 600    | "Fast" cutoff (10 minutes)                     |
| `qualityMin`          | 0.90   | Multiplier at 1★                               |
| `qualityMax`          | 1.10   | Multiplier at 5★                               |
| `tierUplift`          | 0–0.15 | Loyalty uplift by tier                         |

If the economics need to change (higher fee, lower commission, bigger bonus),
change the number here and the dashboard, the payments screen, and the earnings
total all move together.

## Fraud protection

Per-consult money is an obvious target for gaming: a practitioner could
accept a request and end it immediately with no real care, or a practitioner
and a patient could collude to farm trivial back-and-forth consults for a
share of the payout. Two layers guard against this, implemented entirely in
`complete_consultation()` and a new `practitioner_payouts` ledger table.
**This entire system is invisible to the practitioner.** The Payments screen
shows exactly what it always showed — an estimated "Earned to date" figure
and an "Available to withdraw" figure — with no new labels, badges, or
explanations. Only the number behind "Available to withdraw" is now silently
capped by these checks; "Earned to date" still shows the full estimated
payout regardless. A practitioner has no way to tell, from the app, that any
of this is happening.

**Layer 1 — minimum engagement gate.** A completed consultation only earns a
stipend if it shows real back-and-forth: at least 3 messages from *each*
side, at least 2 minutes between accept and completion, and either 150+
characters of combined message text or an actual photo/voice note exchanged.
Fails any of these → the consult still completes normally for the patient,
it just earns nothing. This kills instant accept-and-end farming outright,
since faking a real conversation that fast isn't practical.

**Layer 2 — escrow with pattern detection.** A consult that clears Layer 1
doesn't pay out immediately — it sits in a 48-hour escrow window before
becoming withdrawable. During that window, two aggregate signals (invisible
to any single consultation) can flag it for review instead of releasing it
automatically:
- **Velocity:** 6+ engagement-passing consults by the same practitioner
  within a rolling hour (no human can genuinely give 6 real consults that
  fast).
- **Repeat pairing:** the same patient and practitioner completing 3+
  consults with each other within 24 hours (the collusion pattern —
  one patient repeatedly "booking" the same practitioner for quick payouts).

Flagged consults are held exactly the same way as unreleased escrow, both
just silently excluded from the withdrawable total — there is no separate
"flagged" state visible anywhere, so there's no way to tell the two apart
from outside the database.

**Grandfathering:** consultations completed before this system existed were
backfilled as already-available, so nobody's already-earned money vanished
when this shipped.

**Deliberately not built yet (documented so it isn't forgotten, not because
it's unimportant):**
- A daily cap on payable consults, to bound worst-case damage regardless of
  how someone gets past Layers 1–2.
- Light random admin review of transcripts, paired with a real consequence
  (clawback + deverification) for confirmed farming — practitioners are
  already identity-verified via NIN + licence, so this is a stronger
  deterrent than any algorithm, and it's the only layer that can catch a
  practitioner who gives real patients genuinely poor, rushed care without
  triggering any of the above (that's a care-quality problem, not a
  money-farming one, and no engagement metric can see the difference from
  the outside).
- Identity/device correlation across "different" patient and practitioner
  accounts, for organised collusion rings. Shelved until real usage shows
  Layers 1–2 aren't enough — no sense building it blind.

## Honest caveats

- These figures assume the patient fee is actually collected. Payment
  collection and payout settlement are a separate piece of work.
- The numbers are a starting point for the test phase, not a final price list.
  They should be revisited against real usage, real costs, and what doctors tell
  us feels fair.
- This is a payment model, not clinical or financial advice. It says nothing
  about how care should be delivered.
