/**
 * GraphQL MFA enforcement config mutation tests.
 *
 * Ref: SD-004-authn-provider-abstraction.md §9
 * Issue: apogee-8339569b
 */

import { describe, expect, it } from "bun:test";
import { graphql } from "graphql";
import { buildSchema } from "../../src/schema.js";

describe("MFA enforcement config — GraphQL", () => {
	const schema = buildSchema();

	describe("updateMfaEnforcementConfig — validation", () => {
		it("rejects non-admin roles", async () => {
			const result = await graphql({
				schema,
				source: `
					mutation UpdateMfaEnforcementConfig($input: UpdateMfaEnforcementConfigInput!) {
						updateMfaEnforcementConfig(input: $input) {
							id
							requiredForAll
							requiredForRoles
							updatedAt
						}
					}
				`,
				variableValues: {
					input: { requiredForRoles: ["user", "viewer"] },
				},
			});

			expect(result.errors).toBeDefined();
			expect(result.errors?.length).toBeGreaterThan(0);
			expect(result.errors?.[0]?.message).toContain("not an admin role");
		});

		it("rejects when DB is not configured", async () => {
			const result = await graphql({
				schema,
				source: `
					mutation UpdateMfaEnforcementConfig($input: UpdateMfaEnforcementConfigInput!) {
						updateMfaEnforcementConfig(input: $input) {
							id
							requiredForAll
							requiredForRoles
							updatedAt
						}
					}
				`,
				variableValues: {
					input: { requiredForRoles: ["platform.admin", "procurement.admin"] },
				},
			});

			expect(result.errors).toBeDefined();
			expect(result.errors?.[0]?.message).toContain("Database not configured");
		});

		it("rejects requiredForAll when DB is not configured", async () => {
			const result = await graphql({
				schema,
				source: `
					mutation UpdateMfaEnforcementConfig($input: UpdateMfaEnforcementConfigInput!) {
						updateMfaEnforcementConfig(input: $input) {
							requiredForAll
						}
					}
				`,
				variableValues: {
					input: { requiredForAll: true },
				},
			});

			// Without DB it throws — that's expected; we just want to ensure
			// the input type resolves and mutation is wired.
			expect(result.errors).toBeDefined();
			expect(result.errors?.[0]?.message).toContain("Database not configured");
		});
	});

	describe("mfaEnforcementConfig query", () => {
		it("returns null when no DB is configured", async () => {
			const result = await graphql({
				schema,
				source: `
					query MfaEnforcementConfig {
						mfaEnforcementConfig {
							id
							requiredForAll
							requiredForRoles
							updatedAt
						}
					}
				`,
			});

			expect(result.errors).toBeUndefined();
			const data = result.data as Record<string, unknown>;
			expect(data.mfaEnforcementConfig).toBeNull();
		});
	});
});
