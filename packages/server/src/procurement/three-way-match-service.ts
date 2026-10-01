/**
 * Three-Way Match Service — document-level matching of PO, goods receipt,
 * and vendor invoice.
 *
 * Orchestrates the per-line `performThreeWayMatch` from gr-service and
 * aggregates results with configurable percentage tolerance.
 *
 * Match levels:
 *   - MATCHED                — all lines within tolerance
 *   - VARIANCE_WITHIN_TOLERANCE — some variance but within configured % tolerance
 *   - VARIANCE_EXCEEDS_TOLERANCE  — variance exceeds configured threshold
 *
 * Ref: FEAT-002 SCM-001 (3-way match), issue apogee-0b7993d5
 */

import type { UUID } from "@apogee/shared";
import {
	type BillLineSnapshot,
	type GoodsReceiptLineSnapshot,
	type POLineSnapshot,
	type ThreeWayMatchLineResult,
	performThreeWayMatch,
} from "./gr-service.js";

// ─── Domain types ──────────────────────────────────────────────────────────────

export type ThreeWayMatchLevel =
	| "MATCHED"
	| "VARIANCE_WITHIN_TOLERANCE"
	| "VARIANCE_EXCEEDS_TOLERANCE";

export interface ThreeWayMatchResult {
	purchaseOrderId: UUID;
	goodsReceiptId?: UUID;
	vendorBillId?: UUID;
	level: ThreeWayMatchLevel;
	/** Per-line results — one entry per PO line that was matched. */
	lines: readonly ThreeWayMatchLineResult[];
	/** Percentage tolerance used (e.g. 2 for 2%). */
	tolerancePercent: number;
	/** Total quantities: ordered vs accepted. */
	totalQuantityOrdered: string;
	totalQuantityReceived: string;
	/** Price variance across all billed lines (NUMERIC(19,6) format), null if no bill. */
	totalPriceVariance: string | null;
	/** Number of lines with discrepancies. */
	discrepantLineCount: number;
}

export interface ThreeWayMatchOptions {
	/** Percentage tolerance for price and quantity variances (default: 2%). */
	tolerancePercent?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function toBig(num: string): bigint {
	const neg = num.startsWith("-");
	const [intPart = "0", decPart = ""] = num.replace("-", "").split(".");
	const val = BigInt(intPart) * 1_000_000n + BigInt(decPart.padEnd(6, "0").slice(0, 6));
	return neg ? -val : val;
}

function formatMicro(micro: bigint): string {
	const neg = micro < 0n;
	const absVal = neg ? -micro : micro;
	const intPart = absVal / 1_000_000n;
	const decPart = absVal % 1_000_000n;
	return `${neg ? "-" : ""}${intPart}.${decPart.toString().padStart(6, "0")}`;
}

/** Compute percentage as (numerator / denominator) × 100 in basis-point precision. */
function percentBps(numerator: bigint, denominator: bigint): bigint {
	if (denominator === 0n) return 0n;
	return (numerator * 10_000n) / denominator;
}

// ─── Document-level match ──────────────────────────────────────────────────────

/**
 * Run a three-way match across all PO/GR/invoice lines.
 *
 * @param poLines     Lines from the purchase order
 * @param grLines     Goods receipt lines (matched to PO lines via poLineId)
 * @param billLines   Vendor bill/invoice lines (matched to PO lines via poLineId)
 * @param options     Matching options (tolerance, etc.)
 */
export function matchPurchaseOrder(
	poLines: readonly POLineSnapshot[],
	grLines: readonly GoodsReceiptLineSnapshot[],
	billLines: readonly BillLineSnapshot[],
	options: ThreeWayMatchOptions = {},
): ThreeWayMatchResult {
	const tolerancePercent = options.tolerancePercent ?? 2;
	let totalQtyOrdered = 0n;
	let totalQtyReceived = 0n;
	let totalPriceVarianceAbs = 0n;
	let discrepantCount = 0;

	const lineResults: ThreeWayMatchLineResult[] = [];

	for (const poLine of poLines) {
		totalQtyOrdered += toBig(poLine.quantityOrdered);

		const matchingGR = grLines.filter((gr) => gr.purchaseOrderLineId === poLine.id);
		const matchingBill = billLines.find((bl) => bl.purchaseOrderLineId === poLine.id) ?? null;

		const result = performThreeWayMatch(poLine, matchingGR, matchingBill);
		lineResults.push(result);

		totalQtyReceived += toBig(result.totalQuantityReceived);

		if (result.overallMatch === "DISCREPANCY") {
			discrepantCount++;
		}

		if (result.priceVariance !== null) {
			const varMicro = toBig(abs(result.priceVariance));
			totalPriceVarianceAbs += varMicro;
		}
	}

	// Determine overall match level
	const toleranceBps = BigInt(Math.round(tolerancePercent * 100));
	let level: ThreeWayMatchLevel;

	if (discrepantCount === 0) {
		level = "MATCHED";
	} else if (totalQtyOrdered > 0n) {
		const varianceBps = percentBps(totalPriceVarianceAbs, totalQtyOrdered);
		level =
			varianceBps <= toleranceBps ? "VARIANCE_WITHIN_TOLERANCE" : "VARIANCE_EXCEEDS_TOLERANCE";
	} else {
		level = "VARIANCE_EXCEEDS_TOLERANCE";
	}

	const firstPoId = poLines[0]?.purchaseOrderId ?? ("" as UUID);

	return {
		purchaseOrderId: firstPoId,
		level,
		lines: lineResults,
		tolerancePercent,
		totalQuantityOrdered: formatMicro(totalQtyOrdered),
		totalQuantityReceived: formatMicro(totalQtyReceived),
		totalPriceVariance: totalPriceVarianceAbs > 0n ? formatMicro(totalPriceVarianceAbs) : null,
		discrepantLineCount: discrepantCount,
	};
}

function abs(str: string): string {
	return str.startsWith("-") ? str.slice(1) : str;
}
