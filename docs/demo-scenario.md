# Flagship Demo Scenario

**Project:** Falcon Medical Center Expansion (26-0147)
**Bid Package:** 26-0147-BP-26 — Division 26 Electrical
**Budget:** $185,000
**Current Drawing Revision:** Rev 3

All four bidders, their formats, and their planted characteristics are defined here. This
document is the design authority for the fixtures in `sample-data/`; the golden files in
`eval/golden/` are the machine-checkable form of the same facts.

## Bidders

| Vendor | Format | Submitted | Planted characteristic |
|---|---|---|---|
| Apex Electrical Contractors | 5-page PDF | $191,850 | Strongest scope coverage, highest raw price |
| Voltage Systems Inc. | Excel workbook | $167,400 | **Lowest submitted price**, excludes permit fees AND lighting fixture allowance |
| Meridian Electric & Controls | Email body pricing + PDF scope letter | $178,950 | **Arithmetic discrepancy** (line items sum to $181,450) and references **outdated Drawing Rev 1** |
| Ironclad Power & Electric | PDF + Revision 1 after Addendum 2 | $184,300 → $179,750 | **Revision tracking**; only bidder including performance/payment bond |

## Planted universal gap

None of the four proposals addresses the **arc-flash study** required by specification
Section 26 05 73. Every bidder is `NotFound` on that scope item — not `Excluded`. This is the
finding a side-by-side price comparison structurally cannot produce, and it is the single most
important beat in the demo.

## Scope matrix (expected after normalization)

| Scope item | Apex | Voltage | Meridian | Ironclad |
|---|---|---|---|---|
| electrical_mobilization_supervision | Included | Included | Included | Included |
| branch_power_rough_in | Included | Included | Included | Included |
| lighting_branch_circuitry | Included | Included | Included | Included |
| lighting_fixtures | Included | **Excluded** | Included | Included |
| electrical_permit_fees | Included | **Excluded** | Included | Included |
| temporary_power | Included | Included | **Unclear** | Included |
| fire_alarm_device_connections | Included | Included | Included | Included |
| feeder_branch_circuit_testing | Included | **Unclear** | Included | Included |
| closeout_documentation | Included | Included | Included | Included |
| performance_payment_bond | Excluded | Excluded | Excluded | **Included** |
| utility_company_charges | Excluded | Excluded | Excluded | Excluded |
| structured_cabling_div27 | Excluded | Excluded | Excluded | Excluded |
| security_access_control_div28 | Excluded | Excluded | Excluded | Excluded |
| arc_flash_study | **NotFound** | **NotFound** | **NotFound** | **NotFound** |

## Allowances carried

| Vendor | Lighting fixture allowance |
|---|---|
| Apex | $42,500 |
| Voltage | none (excluded) |
| Meridian | $38,000 |
| Ironclad | $41,000 |

Meridian's allowance is $4,500 below Apex's for the same fixture scope — surfaced side by side
rather than auto-adjusted, because a lower allowance is a judgment call for the estimator, not
a defect the system should silently price.

## Estimator-entered adjustments

Adjustment dollar values are **estimator-entered**, never AI-derived
(`sample-data/adjustments/26-0147-BP-26.json`, `source: "estimator_entered"`). The charter's AI
safety boundary is explicit: an AI-estimated adjustment must never be presented as if it were
vendor-submitted pricing.

| Adjustment | Value | Applied to |
|---|---|---|
| Lighting fixtures excluded | +$42,500 | Voltage |
| Electrical permit fees excluded | +$4,200 | Voltage |
| Performance/payment bond excluded | +$3,100 | Apex, Voltage, Meridian |
| Arc-flash study not addressed | +$6,500 | all four |

Div 27, Div 28, and utility-company charges are excluded by every bidder but are **not**
adjusted — they are carried in other bid packages, so adding them here would double-count.
The engine records that decision explicitly rather than silently skipping them.

## Expected outcome — the demo's payoff

| Vendor | Submitted | Rank | Adjusted | Rank |
|---|---|---|---|---|
| Voltage Systems | $167,400 | **1st** | $223,700 | **4th** |
| Meridian Electric | $178,950 | 2nd | $188,550 | 2nd |
| Ironclad Power | $179,750 | 3rd | $186,250 | **1st** |
| Apex Electrical | $191,850 | 4th | $201,450 | 3rd |

**The lowest submitted bidder becomes the most expensive once scope is leveled, and the
third-place bidder becomes the recommendation.** That inversion is the product thesis in one
table.

## Expected anomalies

| Code | Severity | Fires for |
|---|---|---|
| `arithmetic_discrepancy` | HIGH | Meridian — stated $178,950 vs. line-item sum $181,450 ($2,500 delta) |
| `stale_drawing_revision` | HIGH | Meridian — references Rev 1; project is at Rev 3 |
| `required_scope_missing_all_bidders` | HIGH | arc-flash study (Section 26 05 73), all four bidders |
| `large_leveling_delta` | HIGH | Voltage — +33.6% once excluded scope is priced |
| `adjusted_over_budget` | MEDIUM | all four, once leveled against the $185,000 budget |
| `unclear_scope_requires_clarification` | MEDIUM | Voltage (testing), Meridian (temporary power) |
| `superseded_revision` | INFO | Ironclad original superseded by Rev 1 (−$4,550) |

### Rules that run but do not fire

`pricing_outlier_low` (>10% below median submitted) is evaluated and stays silent: Voltage is
6.7% below the $179,350 median, under the threshold. This is deliberate and asserted in
`tests/test_anomalies.py`. The interesting signal for Voltage is not its raw price but how far
it moves when leveled, which `large_leveling_delta` catches. A rule that stays quiet on a
given dataset is a result, not a gap — the system should not manufacture findings to look
busy.

Human review remains mandatory before any of this becomes a recommendation.
