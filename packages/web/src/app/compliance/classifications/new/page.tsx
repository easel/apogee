/**
 * Create product classification page.
 *
 * Assigns a USML category or ECCN code to a product, with automatic
 * jurisdiction determination (ITAR for USML, EAR for ECCN).
 *
 * Ref: FEAT-006 EXP-001, issue apogee-188277ed
 */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEntityId } from "@/lib/entity-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const JURISDICTIONS = ["ITAR", "EAR", "NOT_CONTROLLED"] as const;
const CLASSIFICATION_BASES = [
	"TECHNICAL_ASSESSMENT",
	"SELF_CLASSIFICATION",
	"COMMODITY_JURISDICTION",
] as const;
const LICENSE_REQUIREMENTS = ["LICENSE_REQUIRED", "LICENSE_EXCEPTION", "NLR"] as const;

export default function NewProductClassificationPage() {
	const router = useRouter();
	const { entityId } = useEntityId();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const [productId, setProductId] = useState("");
	const [classifiedBy, setClassifiedBy] = useState("");
	const [jurisdiction, setJurisdiction] = useState("NOT_CONTROLLED");
	const [usmlCategory, setUsmlCategory] = useState("");
	const [eccn, setEccn] = useState("");
	const [classificationBasis, setClassificationBasis] = useState("");
	const [licenseRequirement, setLicenseRequirement] = useState("");
	const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
	const [effectiveTo, setEffectiveTo] = useState("");
	const [notes, setNotes] = useState("");

	// Client-side validation
	function validate(): string | null {
		if (!productId.trim()) return "Product ID is required";
		if (!classifiedBy.trim()) return "Classified By is required";
		if (jurisdiction === "ITAR" && !usmlCategory.trim()) {
			return "USML category is required for ITAR jurisdiction";
		}
		if (jurisdiction === "EAR" && !eccn.trim()) {
			return "ECCN is required for EAR jurisdiction";
		}
		if (!effectiveFrom) return "Effective From date is required";
		if (effectiveTo && effectiveTo < effectiveFrom) {
			return "Effective To must be on or after Effective From";
		}
		return null;
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitError(null);

		const err = validate();
		if (err) {
			setSubmitError(err);
			return;
		}

		setLoading(true);
		const input: Record<string, unknown> = {
			productId: productId.trim(),
			jurisdiction,
			effectiveFrom,
			classifiedBy: classifiedBy.trim(),
		};
		if (classificationBasis) input.classificationBasis = classificationBasis;
		if (usmlCategory) input.usmlCategory = usmlCategory.trim().toUpperCase();
		if (eccn) input.eccn = eccn.trim().toUpperCase();
		if (licenseRequirement) input.licenseRequirement = licenseRequirement;
		if (effectiveTo) input.effectiveTo = effectiveTo;
		if (notes.trim()) input.notes = notes.trim();

		try {
			const res = await fetch(`${API_URL}/graphql`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: `mutation CreateProductClassification(
            $input: CreateProductClassificationInput!
          ) {
            createProductClassification(input: $input) {
              id jurisdiction usmlCategory eccn
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
			router.push("/compliance/classifications");
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="max-w-2xl">
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">New Product Classification</h1>
				<p className="text-sm text-muted-foreground mt-1">
					<Link href="/compliance" className="hover:underline">
						Compliance
					</Link>
					{" / "}
					<Link href="/compliance/classifications" className="hover:underline">
						Classifications
					</Link>
					{" / "}
					<span>New</span>
				</p>
			</div>

			{submitError && (
				<div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive mb-6">
					{submitError}
				</div>
			)}

			{entityId && (
				<div className="mb-4 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
					Entity context: <span className="font-mono">{entityId.slice(0, 8)}</span>
				</div>
			)}

			<form onSubmit={onSubmit} className="space-y-5">
				{/* Product ID */}
				<div className="space-y-2">
					<Label htmlFor="productId">Product ID *</Label>
					<Input
						id="productId"
						placeholder="a4..."
						className="font-mono"
						value={productId}
						onChange={(e) => setProductId(e.target.value)}
						required
					/>
				</div>

				{/* Classified By */}
				<div className="space-y-2">
					<Label htmlFor="classifiedBy">Classified By (User ID) *</Label>
					<Input
						id="classifiedBy"
						placeholder="User performing the classification"
						className="font-mono"
						value={classifiedBy}
						onChange={(e) => setClassifiedBy(e.target.value)}
						required
					/>
				</div>

				{/* Classification Basis */}
				<div className="space-y-2">
					<Label htmlFor="classificationBasis">Classification Basis</Label>
					<select
						id="classificationBasis"
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

				{/* Jurisdiction */}
				<div className="space-y-2">
					<Label htmlFor="jurisdiction">Jurisdiction *</Label>
					<select
						id="jurisdiction"
						className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
						value={jurisdiction}
						onChange={(e) => setJurisdiction(e.target.value)}
					>
						{JURISDICTIONS.map((j) => (
							<option key={j} value={j}>
								{j}
							</option>
						))}
					</select>
				</div>

				{/* USML Category or ECCN — context-dependent */}
				{jurisdiction === "ITAR" && (
					<div className="space-y-2">
						<Label htmlFor="usmlCategory">USML Category *</Label>
						<Input
							id="usmlCategory"
							placeholder="e.g. XII, XXI"
							className="uppercase"
							value={usmlCategory}
							onChange={(e) => setUsmlCategory(e.target.value.toUpperCase())}
							required
						/>
						<p className="text-xs text-muted-foreground">
							USML categories use Roman numerals (I–XXI) or alpha codes
						</p>
					</div>
				)}

				{jurisdiction === "EAR" && (
					<div className="space-y-2">
						<Label htmlFor="eccn">ECCN Code *</Label>
						<Input
							id="eccn"
							placeholder="e.g. 5A991, 3A001"
							className="uppercase"
							value={eccn}
							onChange={(e) => setEccn(e.target.value.toUpperCase())}
							required
						/>
						<p className="text-xs text-muted-foreground">Export Control Classification Number</p>
					</div>
				)}

				{/* License Requirement */}
				<div className="space-y-2">
					<Label htmlFor="licenseRequirement">License Requirement</Label>
					<select
						id="licenseRequirement"
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

				{/* Effective From */}
				<div className="space-y-2">
					<Label htmlFor="effectiveFrom">Effective From *</Label>
					<Input
						id="effectiveFrom"
						type="date"
						value={effectiveFrom}
						onChange={(e) => setEffectiveFrom(e.target.value)}
						required
					/>
				</div>

				{/* Effective To (optional) */}
				<div className="space-y-2">
					<Label htmlFor="effectiveTo">Effective To</Label>
					<Input
						id="effectiveTo"
						type="date"
						value={effectiveTo}
						onChange={(e) => setEffectiveTo(e.target.value)}
					/>
				</div>

				{/* Notes */}
				<div className="space-y-2">
					<Label htmlFor="notes">Notes</Label>
					<textarea
						id="notes"
						rows={3}
						className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
						placeholder="Rationale for classification, supporting documentation references..."
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
					/>
				</div>

				<div className="flex gap-3 pt-2">
					<Button type="submit" disabled={loading}>
						{loading ? "Creating…" : "Create Classification"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => router.push("/compliance/classifications")}
					>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
}
