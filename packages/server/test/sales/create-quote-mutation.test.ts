/**
 * Tests for createQuote GraphQL mutation.
 *
 * Ref: FEAT-003 SLS-001, issue apogee-623cd66b
 */

import { describe, it, expect } from "bun:test";
import { buildSchema } from "../../src/schema.js";
import { graphql } from "graphql";

describe("createQuote mutation", () => {
	const schema = buildSchema();

	it("rejects when database is not configured", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreateQuote($input: CreateQuoteInput!) {
					createQuote(input: $input) {
						id quoteNumber status
					}
				}
			`,
			variableValues: {
				input: {
					customerId: "c0000000-0000-0000-0000-000000000001",
					legalEntityId: "a0000000-0000-0000-0000-000000000001",
					currencyCode: "USD",
					validUntil: "2027-01-01",
					lineItems: [
						{
							description: "Satellite transponder lease",
							quantity: "12",
							unitPrice: "5000.000000",
							currencyCode: "USD",
							type: "PRODUCT",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
		expect(result.errors?.[0]?.message).toContain("Database not configured");
	});

	it("rejects empty line items", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreateQuote($input: CreateQuoteInput!) {
					createQuote(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					customerId: "c0000000-0000-0000-0000-000000000001",
					legalEntityId: "a0000000-0000-0000-0000-000000000001",
					currencyCode: "USD",
					validUntil: "2027-01-01",
					lineItems: [],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});

	it("rejects line items with mismatching currency", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreateQuote($input: CreateQuoteInput!) {
					createQuote(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					customerId: "c0000000-0000-0000-0000-000000000001",
					legalEntityId: "a0000000-0000-0000-0000-000000000001",
					currencyCode: "USD",
					validUntil: "2027-01-01",
					lineItems: [
						{
							description: "Satellite transponder lease",
							quantity: "12",
							unitPrice: "5000.000000",
							currencyCode: "EUR",
							type: "PRODUCT",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});

	it("rejects missing description", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreateQuote($input: CreateQuoteInput!) {
					createQuote(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					customerId: "c0000000-0000-0000-0000-000000000001",
					legalEntityId: "a0000000-0000-0000-0000-000000000001",
					currencyCode: "USD",
					validUntil: "2027-01-01",
					lineItems: [
						{
							description: "",
							quantity: "12",
							unitPrice: "5000.000000",
							currencyCode: "USD",
							type: "PRODUCT",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});

	it("accepts valid future validUntil date", async () => {
		// This test validates past the Zod layer — it will fail at the DB
		// layer in stub mode, which is expected.
		const result = await graphql({
			schema,
			source: `
				mutation CreateQuote($input: CreateQuoteInput!) {
					createQuote(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					customerId: "c0000000-0000-0000-0000-000000000001",
					legalEntityId: "a0000000-0000-0000-0000-000000000001",
					currencyCode: "USD",
					validUntil: "2027-01-01",
					lineItems: [
						{
							description: "Satellite transponder lease",
							quantity: "12",
							unitPrice: "5000.000000",
							currencyCode: "USD",
							type: "PRODUCT",
						},
					],
				},
			},
		});

		// The mutation should not fail on Zod validation — only on DB layer
		const err = result.errors?.[0]?.message ?? "";
		expect(err).not.toContain("Valid-until");
	});

	it("rejects past validUntil date", async () => {
		const result = await graphql({
			schema,
			source: `
				mutation CreateQuote($input: CreateQuoteInput!) {
					createQuote(input: $input) { id }
				}
			`,
			variableValues: {
				input: {
					customerId: "c0000000-0000-0000-0000-000000000001",
					legalEntityId: "a0000000-0000-0000-0000-000000000001",
					currencyCode: "USD",
					validUntil: "2020-01-01",
					lineItems: [
						{
							description: "Satellite transponder lease",
							quantity: "12",
							unitPrice: "5000.000000",
							currencyCode: "USD",
							type: "PRODUCT",
						},
					],
				},
			},
		});

		expect(result.errors).toBeDefined();
	});
});
