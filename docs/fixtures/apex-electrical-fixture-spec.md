\# Apex Electrical Contractors  
\#\# First Golden Fixture Specification v0.1

\*\*Purpose:\*\* Define the first representative subcontractor proposal used to discover the bid schema and build the first end-to-end vertical slice.

\*\*Synthetic status:\*\* All names, prices, contacts, and project details are fictional.

\#\# Related Project

\- General Contractor: Crestmark Construction Partners  
\- Project: Falcon Medical Center Expansion  
\- Project Number: 26-0147  
\- Bid Package: 26-0147-BP-26  
\- Trade: Division 26 \- Electrical  
\- Current Drawing Revision: Rev 3  
\- Electrical Budget: $185,000

\#\# Vendor Profile

\*\*Apex Electrical Contractors\*\*

Working characteristics:

\- Established regional commercial electrical subcontractor  
\- Strong healthcare experience  
\- Professional proposal formatting  
\- Thorough scope narrative  
\- Not the lowest bidder in the final comparison  
\- High scope completeness

Synthetic contact:

Jordan Wells    
Senior Estimator    
Apex Electrical Contractors    
\`jordan.wells@apex-electrical-demo.example\`

\#\# Initial Fixture Objective

The first Apex fixture should be deliberately easier than the later vendors. It is the representative document used to prove the architecture, not to maximize extraction difficulty.

The proposal should contain enough structure to test:

\- project/vendor matching  
\- PDF text extraction  
\- base-bid extraction  
\- line/scope extraction  
\- explicit inclusion detection  
\- explicit exclusion detection  
\- allowance extraction  
\- alternate extraction  
\- source citations  
\- SHA-256 document hashing  
\- AI inference lineage  
\- schema validation  
\- golden-answer testing

\#\# Required Proposal Facts

These values are the authoritative golden answers for the first fixture.

\#\#\# Commercial Summary

\- Proposal Date: August 7, 2026  
\- Base Bid: \*\*$191,850.00\*\*  
\- Bid Validity: 30 calendar days  
\- Anticipated duration: 18 weeks from mobilization, subject to approved project schedule  
\- Bond: Excluded from base bid, available as an alternate/add if requested

\#\#\# Allowance

\- Lighting fixture allowance: \*\*$42,500.00\*\*, included in base bid

\#\#\# Alternate

\- Alternate A1: Upgrade selected patient-room fixtures to owner-selected premium package  
\- Add: \*\*$8,750.00\*\*  
\- Alternate is NOT included in the base bid

\#\# Scope Items

The PDF should clearly state the following.

\#\#\# Included

1\. Electrical mobilization and supervision  
2\. Branch power rough-in  
3\. Lighting branch circuitry  
4\. Lighting fixtures within the stated $42,500 allowance  
5\. Electrical permit fees  
6\. Temporary power required for Apex's own work  
7\. Fire alarm device connections shown within the electrical bid documents  
8\. Testing of installed feeders and branch circuits  
9\. Standard closeout documentation for Apex's electrical scope  
10\. Normal working-hours coordination with Crestmark

\#\#\# Explicitly Excluded

1\. Structured cabling / Division 27 systems  
2\. Security / access control / Division 28 systems  
3\. Utility-company charges and fees  
4\. Performance and payment bond

The explicit bond exclusion is important because it gives the first vertical slice one clear exclusion without making Apex appear incomplete in the core electrical scope.

\#\# Important Non-Finding

The Apex proposal should \*\*not mention an arc-flash study\*\*.

This omission is intentional. It becomes meaningful only later when the system compares all four vendors against the project specification and discovers that Section 26 05 73 is absent from every proposal.

For the Apex-only vertical slice, do not label the arc-flash study as an exclusion. It should be \`NotFound\` if the scope taxonomy already includes that item.

This distinction is important:

\`Excluded\` means the vendor explicitly says it is not included.

\`NotFound\` means the proposal does not establish whether it is included.

\#\# Proposed PDF Structure

The generated fixture should be a professional text-based PDF of approximately 4-6 pages. Do not create a 17-page PDF yet just to satisfy the eventual scenario. The first vertical slice should optimize for correctness and fast iteration.

Suggested layout:

\#\#\# Page 1 \- Cover / Proposal Summary

\- Apex logo/wordmark placeholder  
\- Date  
\- Crestmark Construction Partners  
\- Falcon Medical Center Expansion  
\- Project 26-0147  
\- Bid Package 26-0147-BP-26  
\- Base Bid: $191,850.00  
\- 30-day validity

\#\#\# Page 2 \- Scope of Work

Detailed included electrical scope.

\#\#\# Page 3 \- Allowances and Alternates

Lighting allowance and Alternate A1.

\#\#\# Page 4 \- Clarifications and Exclusions

Explicitly list structured cabling, security/access control, utility fees, and bond exclusion.

\#\#\# Page 5 \- Commercial / Schedule Terms

Schedule assumptions, coordination, signature block.

\#\# Citation Targets

The fixture should be authored so citations can be asserted predictably.

Minimum expected golden citations:

\- Base Bid \-\> Page 1, "Proposal Summary"  
\- Lighting allowance \-\> Page 3, "Allowances"  
\- Alternate A1 \-\> Page 3, "Alternates"  
\- Bond exclusion \-\> Page 4, "Exclusions"  
\- Electrical permit fees included \-\> Page 2, "Scope of Work"

Exact citation representation may evolve during schema discovery, but the PDF must make these source locations unambiguous.

\#\# First Golden Record

The initial \`eval/golden/apex.json\` should assert at least:

\`\`\`json  
{  
  "vendor": "Apex Electrical Contractors",  
  "project\_number": "26-0147",  
  "bid\_package": "26-0147-BP-26",  
  "base\_bid": 191850.00,  
  "allowances": \[  
    {  
      "name": "Lighting fixture allowance",  
      "amount": 42500.00,  
      "included\_in\_base\_bid": true  
    }  
  \],  
  "alternates": \[  
    {  
      "id": "A1",  
      "amount": 8750.00,  
      "included\_in\_base\_bid": false  
    }  
  \],  
  "scope\_assertions": {  
    "electrical\_permit\_fees": "Included",  
    "performance\_payment\_bond": "Excluded",  
    "arc\_flash\_study": "NotFound"  
  }  
}  
\`\`\`

Claude Code may refine the schema names, but it must preserve the meaning of these golden facts.

\#\# First Vertical Slice Acceptance Criteria

One command should eventually:

1\. Read a synthetic incoming-email fixture referring to this proposal.  
2\. Hash the proposal using SHA-256.  
3\. Extract PDF text deterministically.  
4\. Resolve Crestmark project 26-0147 and Apex as the bidder.  
5\. Invoke the AI provider abstraction for structured bid interpretation.  
6\. Validate the structured response against the current Bid schema.  
7\. Save the Bid, SourceDocument, SourceCitation, and AIInference records.  
8\. Print or return base bid, allowance, alternate, included permit fees, excluded bond, and NotFound arc-flash status with source lineage.  
9\. Run deterministic/golden tests proving the expected values above.

\#\# Constraint

Do not expand the Apex fixture into the entire four-vendor demo until this single-document vertical slice is working and tested.  
