/**
 * Product classification detail/edit page.
 *
 * Shows classification details and allows updating classification fields
 * (ECCN, USML, license requirement, notes, effective dates).
 *
 * Ref: FEAT-006 EXP-001
 */
"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gql } from "@/lib/graphql";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const CLASSIFICATION_BASES = [
	"TECHNICAL_ASSESSMENT",
	"SELF_CLASSIFICATION",
	"COMMODITY_JURISDICTION",
] as const;
const LICENSE_REQUIREMENTS = ["LICENSE_REQUIRED", "LICENSE_EXCEPTION", "NLR"] as const;

interface Classification {
	id: string;
	productId: string;
	jurisdiction: string;
	classificationBasis: string | null;
	usmlCategory: string | null;
	eccn: string | null;
	licenseRequirement: string | null;
	notes: string | null;
	classifiedBy: string;
	classifiedAt: string;
	reviewedBy: string | null;
	reviewedAt: string | null;
	effectiveFrom: string;
	effectiveTo: string | null;
	version: number;
}

async function fetchClassification(id: string): Promise<Classification | null> {
	try {
		const data = await gql<{ productClassification: Classification }>(
			`query ProductClassification($id: String!) {
        productClassification(id: $id) {
          id productId jurisdiction classificationBasis
          usmlCategory eccn licenseRequirement notes
          classifiedBy classifiedAt reviewedBy reviewedAt
          effectiveFrom effectiveTo version
        }
      }`,
			{ id },
		);
		return data.productClassification;
	} catch {
		return null;
	}
}

function jurisdictionBadge(jurisdiction: string) {
	const bg: Record<string, string> = {
		ITAR: "bg-red-100 text-red-800",
		EAR: "bg-blue-100 text-blue-800",
		NOT_CONTROLLED: "bg-gray-100 text-gray-600",
	};
	const cls = bg[jurisdiction] ?? "bg-gray-100 text-gray-600";
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
		>
			{jurisdiction}
		</span>
	);
}

export default function ClassificationDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const router = useRouter();
	const [cls, setCls] = useState<Classification | null>(null);
	const [loading, setLoading] = useState(true);
	const [editMode, setEditMode] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Edit form state
	const [classificationBasis, setClassificationBasis] = useState("");
	const [usmlCategory, setUsmlCategory] = useState("");
	const [eccn, setEccn] = useState("");
	const [licenseRequirement, setLicenseRequirement] = useState("");
	const [effectiveTo, setEffectiveTo] = useState("");
	const [notes, setNotes] = useState("");
	const [reviewedBy, setReviewedBy] = useState("");

	// Fetch classification
	useEffect(() => {
		params.then(async ({ id }) => {
			const data = await fetchClassification(id);
			setCls(data);
			setLoading(false);
		});
	}, [params]);

	// Reset form when entering edit mode
	function enterEditMode() {
		if (!cls) return;
		setClassificationBasis(cls.classificationBasis ?? "");
		setUsmlCategory(cls.usmlCategory ?? "");
		setEccn(cls.eccn ?? "");
		setLicenseRequirement(cls.licenseRequirement ?? "");
		setEffectiveTo(cls.effectiveTo ?? "");
		setNotes(cls.notes ?? "");
		setReviewedBy("");
		setSubmitError(null);
		setEditMode(true);
	}

	function validate(): string | null {
		if (effectiveTo && effectiveTo < (cls?.effectiveFrom ?? "")) {
			return "Effective To must be on or after Effective From";
		}
		if (cls?.jurisdiction === "ITAR" && !usmlCategory.trim()) {
			return "USML category is required for ITAR jurisdiction";
		}
		if (cls?.jurisdiction === "EAR" && !eccn.trim()) {
			return "ECCN is required for EAR jurisdiction";
		}
		return null;
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!cls) return;
		setSubmitError(null);

		const err = validate();
		if (err) {
			setSubmitError(err);
			return;
		}

		setSaving(true);
		const input: Record<string, unknown> = { id: cls.id };
		if (classificationBasis) input.classificationBasis = classificationBasis;
		if (usmlCategory) input.usmlCategory = usmlCategory.trim().toUpperCase();
		if (eccn) input.eccn = eccn.trim().toUpperCase();
		if (licenseRequirement) input.licenseRequirement = licenseRequirement;
		if (notes.trim()) input.notes = notes.trim();
		if (effectiveTo) input.effectiveTo = effectiveTo;
		if (reviewedBy.trim()) {
			input.reviewedBy = reviewedBy.trim();
			input.reviewedAt = new Date().toISOString();
		}

		try {
			const res = await fetch(`${API_URL}/graphql`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: `mutation UpdateProductClassification(
            $input: UpdateProductClassificationInput!
          ) {
            updateProductClassification(input: $input) {
              id jurisdiction usmlCategory eccn version
            }
          }`,
					variables: { input },
				}),
			});
			const json = await res.json();
			if (json.errors) {
				setSubmitError(json.errors[0]?.message ?? "An error occurred");
				return;
			}
			const updated = await fetchClassification(cls.id);
			setCls(updated);
			setEditMode(false);
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}

	if (!cls) {
		return (
			<div>
				<h1 className="text-2xl font-bold tracking-tight mb-2">Classification not found</h1>
				<Link href="/compliance/classifications">
					<Button variant="outline">Back to Classifications</Button>
				</Link>
			</div>
		);
	}

	const expired = cls.effectiveTo !== null && new Date(cls.effectiveTo) < new Date();

	return (
		<div className="max-w-3xl">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Product Classification</h1>
					<p className="text-sm text-muted-foreground mt-1">
						<Link href="/compliance" className="hover:underline">
							Compliance
						</Link>
						{" / "}
						<Link href="/compliance/classifications" className="hover:underline">
							Classifications
						</Link>
						{" / "}
						<span className="font-mono">{cls.id.slice(0, 8)}</span>
						<span className="ml-2 text-xs text-muted-foreground">v{cls.version}</span>
					</p>
				</div>
				{!editMode && (
					<Button onClick={enterEditMode} variant="outline">
						Edit
					</Button>
				)}
			</div>

			{submitError && (
				<div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive mb-6">
					{submitError}
				</div>
			)}

			{editMode ? (
				<form onSubmit={onSubmit} className="space-y-5">
					{/* Jurisdiction (view-only) */}
					<div className="space-y-2">
						<Label>Jurisdiction</Label>
						<p className="text-sm">{jurisdictionBadge(cls.jurisdiction)}</p>
					</div>

					{/* Classification Basis */}
					<div className="space-y-2">
						<Label htmlFor="edit-classificationBasis">Classification Basis</Label>
						<select
							id="edit-classificationBasis"
							className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
							value={classificationBasis}
							onChange={(e) => setClassificationBasis(e.target.value)}
						>
							<option value="">— Select —</option>
							{CLASSIFICATION_BASES.map((b) => (
								<option key={b} value={b}>
									{b.replace(/_/g, " ")}
								</option>
							))}
						</select>
					</div>

					{/* USML or ECCN (context-dependent) */}
					{cls.jurisdiction === "ITAR" && (
						<div className="space-y-2">
							<Label htmlFor="edit-usmlCategory">USML Category *</Label>
							<Input
								id="edit-usmlCategory"
								placeholder="e.g. XII"
								className="uppercase"
								value={usmlCategory}
								onChange={(e) => setUsmlCategory(e.target.value.toUpperCase())}
								required
							/>
						</div>
					)}

					{cls.jurisdiction === "EAR" && (
						<div className="space-y-2">
							<Label htmlFor="edit-eccn">ECCN Code *</Label>
							<Input
								id="edit-eccn"
								placeholder="e.g. 5A991"
								className="uppercase"
								value={eccn}
								onChange={(e) => setEccn(e.target.value.toUpperCase())}
								required
							/>
						</div>
					)}

					{/* License Requirement */}
					<div className="space-y-2">
						<Label htmlFor="edit-licenseRequirement">License Requirement</Label>
						<select
							id="edit-licenseRequirement"
							className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
							value={licenseRequirement}
							onChange={(e) => setLicenseRequirement(e.target.value)}
						>
							<option value="">— Select —</option>
							{LICENSE_REQUIREMENTS.map((l) => (
								<option key={l} value={l}>
									{l.replace(/_/g, " ")}
								</option>
							))}
						</select>
					</div>

					{/* Effective To */}
					<div className="space-y-2">
						<Label htmlFor="edit-effectiveTo">Effective To</Label>
						<Input
							id="edit-effectiveTo"
							type="date"
							value={effectiveTo}
							onChange={(e) => setEffectiveTo(e.target.value)}
						/>
					</div>

					{/* Reviewed By */}
					<div className="space-y-2">
						<Label htmlFor="edit-reviewedBy">Reviewed By (User ID)</Label>
						<Input
							id="edit-reviewedBy"
							placeholder="User ID for review audit trail"
							className="font-mono"
							value={reviewedBy}
							onChange={(e) => setReviewedBy(e.target.value)}
						/>
					</div>

					{/* Notes */}
					<div className="space-y-2">
						<Label htmlFor="edit-notes">Notes</Label>
						<textarea
							id="edit-notes"
							rows={3}
							className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>

					<div className="flex gap-3 pt-2">
						<Button type="submit" disabled={saving}>
							{saving ? "Saving…" : "Save Changes"}
						</Button>
						<Button type="button" variant="outline" onClick={() => setEditMode(false)}>
							Cancel
						</Button>
					</div>
				</form>
			) : (
				<div className="space-y-6">
					{/* Status bar */}
					<div className="flex items-center gap-3">
						{jurisdictionBadge(cls.jurisdiction)}
						{expired ? (
							<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
								Expired
							</span>
						) : (
							<span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
								Active
							</span>
						)}
					</div>

					{/* Details */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<Label>Product ID</Label>
							<p className="font-mono text-sm">{cls.productId}</p>
						</div>
						<div className="space-y-1">
							<Label>Classification Basis</Label>
							<p className="text-sm">
								{cls.classificationBasis ? cls.classificationBasis.replace(/_/g, " ") : "—"}
							</p>
						</div>
						<div className="space-y-1">
							<Label>USML Category</Label>
							<p className="font-mono text-sm">{cls.usmlCategory ?? "—"}</p>
						</div>
						<div className="space-y-1">
							<Label>ECCN</Label>
							<p className="font-mono text-sm">{cls.eccn ?? "—"}</p>
						</div>
						<div className="space-y-1">
							<Label>License Requirement</Label>
							<p className="text-sm">
								{cls.licenseRequirement ? cls.licenseRequirement.replace(/_/g, " ") : "—"}
							</p>
						</div>
						<div className="space-y-1">
							<Label>Effective From</Label>
							<p className="text-sm">{cls.effectiveFrom.slice(0, 10)}</p>
						</div>
						<div className="space-y-1">
							<Label>Effective To</Label>
							<p className="text-sm">{cls.effectiveTo?.slice(0, 10) ?? "—"}</p>
						</div>
						<div className="space-y-1">
							<Label>Version</Label>
							<p className="text-sm">{cls.version}</p>
						</div>
					</div>

					{cls.notes && (
						<div className="space-y-1">
							<Label>Notes</Label>
							<p className="text-sm whitespace-pre-wrap">{cls.notes}</p>
						</div>
					)}

					{/* Audit trail */}
					<div className="rounded-lg border p-4 bg-muted/20 space-y-2">
						<h3 className="text-sm font-medium">Audit Trail</h3>
						<div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
							<div>Classified by</div>
							<div className="font-mono">{cls.classifiedBy}</div>
							<div>Classified at</div>
							<div>{new Date(cls.classifiedAt).toLocaleString()}</div>
							{cls.reviewedBy && (
								<>
									<div>Reviewed by</div>
									<div className="font-mono">{cls.reviewedBy}</div>
									<div>Reviewed at</div>
									<div>{cls.reviewedAt ? new Date(cls.reviewedAt).toLocaleString() : "—"}</div>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
