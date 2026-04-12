/**
 * Product Classifications list page.
 *
 * Displays all product classifications sorted by classified date descending.
 *
 * Ref: FEAT-006 EXP-001, issue apogee-188277ed
 */
"use client";
import { gql } from "@/lib/graphql";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ClassificationRow {
	id: string;
	productId: string;
	jurisdiction: string;
	classificationBasis: string | null;
	usmlCategory: string | null;
	eccn: string | null;
	licenseRequirement: string | null;
	notes: string | null;
	effectiveFrom: string;
	effectiveTo: string | null;
	classifiedAt: string;
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

export default function ClassificationsPage() {
	const [rows, setRows] = useState<ClassificationRow[]>([]);

	useEffect(() => {
		gql<{ productClassifications: ClassificationRow[] }>(
			`query ProductClassifications {
				productClassifications {
					id productId jurisdiction classificationBasis
					usmlCategory eccn licenseRequirement notes
					classifiedAt reviewedAt effectiveFrom effectiveTo
				}
			}`,
		)
			.then((data) => setRows(data.productClassifications ?? []))
			.catch(() => {});
	}, []);

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold tracking-tight">Product Classifications</h1>
				<Link href="/compliance/classifications/new">
					<span className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
						+ Add Classification
					</span>
				</Link>
			</div>

			{rows.length === 0 && (
				<div className="rounded-lg border border-dashed p-12 text-center">
					<p className="text-sm text-muted-foreground mb-3">No product classifications found.</p>
					<Link href="/compliance/classifications/new">
						<span className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
							Classify your first product
						</span>
					</Link>
				</div>
			)}

			{rows.length > 0 && (
				<div className="rounded-md border">
					<table className="w-full text-sm">
						<thead className="border-b bg-muted/50">
							<tr>
								<th className="h-10 px-4 text-left font-medium text-muted-foreground">Product</th>
								<th className="h-10 px-4 text-left font-medium text-muted-foreground">
									Jurisdiction
								</th>
								<th className="h-10 px-4 text-left font-medium text-muted-foreground">
									USML / ECCN
								</th>
								<th className="h-10 px-4 text-left font-medium text-muted-foreground">License</th>
								<th className="h-10 px-4 text-left font-medium text-muted-foreground">Effective</th>
								<th className="h-10 px-4 text-left font-medium text-muted-foreground">Status</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => {
								const expired = row.effectiveTo !== null && new Date(row.effectiveTo) < new Date();
								return (
									<tr key={row.id} className="border-b hover:bg-muted/30">
										<td className="px-4 py-2.5">
											<Link
												href={`/compliance/classifications/${row.id}`}
												className="font-mono text-sm hover:underline"
											>
												{row.productId.slice(0, 8)}…
											</Link>
										</td>
										<td className="px-4 py-2.5">{jurisdictionBadge(row.jurisdiction)}</td>
										<td className="px-4 py-2.5 font-mono text-sm">
											{row.usmlCategory ?? row.eccn ?? "—"}
										</td>
										<td className="px-4 py-2.5 text-sm">{row.licenseRequirement ?? "—"}</td>
										<td className="px-4 py-2.5 text-sm">{row.effectiveFrom.slice(0, 10)}</td>
										<td className="px-4 py-2.5">
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
													expired ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-800"
												}`}
											>
												{expired ? "Expired" : "Active"}
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
