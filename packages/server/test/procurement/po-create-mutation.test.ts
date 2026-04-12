/**
 * Tests for createPurchaseOrder GraphQL mutation.
 *
 * Ref: FEAT-002 SCM-001, issue apogee-e7620b0c
 */

import { describe, it, expect } from "bun:test";
import { buildSchema } from "../../src/schema.js";
import { graphql } from "graphql";

describe("createPurchaseOrder mutation", () => {
	const schema = buildSchema();

	it("rejects when database is not configured", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreatePO($input: CreatePurchaseOrderInput!) {
					createPurchaseOrder(input: $input) {
						id poNumber status
					}
				}
			`,
			variableValues: {
				input: {
					entityId: "a0000000-0000-0000-0000-000000000001",
					vendorId: "b0000000-0000-0000-0000-000000000001",
					poNumber: "PO-001",
					poDate: "2026-04-11",
					currencyCode: "USD",
					lineItems: [
						{
							lineNumber: 1,
							description: "Test item",
							quantityOrdered: "10.0000",
							unitOfMeasure: "EA",
							unitPrice: "100.000000",
							currencyCode: "USD",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
		expect(result.errors?.[0]?.message).toContain("Database not configured");
	});

	it("rejects line items with mismatching currency", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreatePO($input: CreatePurchaseOrderInput!) {
					createPurchaseOrder(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					entityId: "a0000000-0000-0000-0000-000000000001",
					vendorId: "b0000000-0000-0000-0000-000000000001",
					poNumber: "PO-001",
					poDate: "2026-04-11",
					currencyCode: "USD",
					lineItems: [
						{
							lineNumber: 1,
							description: "Test item",
							quantityOrdered: "10.0000",
							unitOfMeasure: "EA",
							unitPrice: "100.000000",
							currencyCode: "EUR",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});

	it("rejects empty line items", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreatePO($input: CreatePurchaseOrderInput!) {
					createPurchaseOrder(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					entityId: "a0000000-0000-0000-0000-000000000001",
					vendorId: "b0000000-0000-0000-0000-000000000001",
					poNumber: "PO-001",
					poDate: "2026-04-11",
					currencyCode: "USD",
					lineItems: [],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});

	it("rejects negative/zero quantity", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreatePO($input: CreatePurchaseOrderInput!) {
					createPurchaseOrder(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					entityId: "a0000000-0000-0000-0000-000000000001",
					vendorId: "b0000000-0000-0000-0000-000000000001",
					poNumber: "PO-001",
					poDate: "2026-04-11",
					currencyCode: "USD",
					lineItems: [
						{
							lineNumber: 1,
							description: "Test item",
							quantityOrdered: "0.0000",
							unitOfMeasure: "EA",
							unitPrice: "100.000000",
							currencyCode: "USD",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});

	it("rejects duplicate line numbers", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreatePO($input: CreatePurchaseOrderInput!) {
					createPurchaseOrder(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					entityId: "a0000000-0000-0000-0000-000000000001",
					vendorId: "b0000000-0000-0000-0000-000000000001",
					poNumber: "PO-001",
					poDate: "2026-04-11",
					currencyCode: "USD",
					lineItems: [
						{
							lineNumber: 1,
							description: "Item A",
							quantityOrdered: "10.0000",
							unitOfMeasure: "EA",
							unitPrice: "100.000000",
							currencyCode: "USD",
						},
						{
							lineNumber: 1,
							description: "Item B",
							quantityOrdered: "5.0000",
							unitOfMeasure: "EA",
							unitPrice: "50.000000",
							currencyCode: "USD",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});
});
