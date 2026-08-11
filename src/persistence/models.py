"""Canonical SQLAlchemy models for the vertical slice.

Scope is deliberately limited to what the Apex fixture needs (see
docs/architecture-review.md Section 5 and Architecture-Amendments-v1.0.md
Amendment 5 -- schema is discovered from real fixture data, not designed
in the abstract). Source Truth (SourceDocument), Derived/AI Interpretation
(AIInference), and Human Decision (review_status) are kept as structurally
distinct tables/fields rather than blended, per the charter's AI Safety
Boundary and Amendment 2's lineage requirement.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class SourceDocument(Base):
    """A document as physically received -- immutable, hashed for provenance (Amendment 3)."""

    __tablename__ = "source_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    sha256: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Project(Base):
    __tablename__ = "projects"

    project_number: Mapped[str] = mapped_column(String, primary_key=True)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    customer: Mapped[str] = mapped_column(String, nullable=False)
    drawing_revision: Mapped[str] = mapped_column(String, nullable=False)


class BidPackage(Base):
    __tablename__ = "bid_packages"

    bid_package_number: Mapped[str] = mapped_column(String, primary_key=True)
    project_number: Mapped[str] = mapped_column(String, ForeignKey("projects.project_number"), nullable=False)
    csi_division: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)


class Vendor(Base):
    __tablename__ = "vendors"

    vendor_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    trade: Mapped[str] = mapped_column(String, nullable=False)
    contact_name: Mapped[str] = mapped_column(String, nullable=True)
    contact_email: Mapped[str] = mapped_column(String, nullable=True)


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_number: Mapped[str] = mapped_column(String, ForeignKey("projects.project_number"), nullable=False)
    bid_package_number: Mapped[str] = mapped_column(String, ForeignKey("bid_packages.bid_package_number"), nullable=False)
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.vendor_id"), nullable=False)
    source_document_id: Mapped[str] = mapped_column(String, ForeignKey("source_documents.id"), nullable=False)
    base_bid: Mapped[float] = mapped_column(Float, nullable=False)
    proposal_date: Mapped[str] = mapped_column(String, nullable=True)
    bid_validity_days: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    allowances: Mapped[list["Allowance"]] = relationship(back_populates="bid", cascade="all, delete-orphan")
    alternates: Mapped[list["Alternate"]] = relationship(back_populates="bid", cascade="all, delete-orphan")
    scope_assertions: Mapped[list["ScopeAssertion"]] = relationship(back_populates="bid", cascade="all, delete-orphan")
    citations: Mapped[list["SourceCitation"]] = relationship(back_populates="bid", cascade="all, delete-orphan")


class Allowance(Base):
    __tablename__ = "allowances"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bid_id: Mapped[str] = mapped_column(String, ForeignKey("bids.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    included_in_base_bid: Mapped[bool] = mapped_column(Boolean, nullable=False)

    bid: Mapped[Bid] = relationship(back_populates="allowances")


class Alternate(Base):
    __tablename__ = "alternates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bid_id: Mapped[str] = mapped_column(String, ForeignKey("bids.id"), nullable=False)
    alt_id: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    included_in_base_bid: Mapped[bool] = mapped_column(Boolean, nullable=False)

    bid: Mapped[Bid] = relationship(back_populates="alternates")


class ScopeAssertion(Base):
    """Included / Excluded / Unclear / NotFound -- never collapse NotFound into Excluded."""

    __tablename__ = "scope_assertions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bid_id: Mapped[str] = mapped_column(String, ForeignKey("bids.id"), nullable=False)
    scope_item_key: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)  # Included | Excluded | Unclear | NotFound

    bid: Mapped[Bid] = relationship(back_populates="scope_assertions")


class SourceCitation(Base):
    __tablename__ = "source_citations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bid_id: Mapped[str] = mapped_column(String, ForeignKey("bids.id"), nullable=False)
    field_name: Mapped[str] = mapped_column(String, nullable=False)
    source_document_id: Mapped[str] = mapped_column(String, ForeignKey("source_documents.id"), nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    section_label: Mapped[str] = mapped_column(String, nullable=False)

    bid: Mapped[Bid] = relationship(back_populates="citations")


class AIInference(Base):
    """Lightweight AI lineage record (Amendment 2).

    Answers "why does the platform think this?" independent of where the
    interpreted value ended up living. Deliberately not folded into Bid.
    """

    __tablename__ = "ai_inferences"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    related_entity_type: Mapped[str] = mapped_column(String, nullable=False)
    related_entity_id: Mapped[str] = mapped_column(String, nullable=False)
    task: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    prompt_version: Mapped[str] = mapped_column(String, nullable=False)
    source_document_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    structured_output: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence_tier: Mapped[str] = mapped_column(String, nullable=False)  # HIGH | REVIEW | LOW
    review_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
