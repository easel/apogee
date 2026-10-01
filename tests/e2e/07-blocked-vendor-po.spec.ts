/**
 * E2E Test: Blocked vendor PO prevention (FEAT-002 / SCM-002)
 *
 * Verifies that the system blocks PO approval for vendors who fail denied-party
 * screening. The compliance screening gate is injected into the approvePurchaseOrder
 * mutation (SCM-001: "PO approval triggers vendor denied-party screening; PO held if flagged").
 *
 * Stub screening logic (compliance-screening-service.ts):
 *   - Names containing "DENIED" → CONFIRMED_MATCH (hold required)
 *   - Names containing "SUSPECT" → POTENTIAL_MATCH (hold required)
 *   - All others → CLEAR
 *
 * Test Scenarios:
 *   1. Approve PO with cleared vendor → succeeds, status = APPROVED
 *   2. Approve PO with flagged vendor (SUSPECT) → blocked, status = ON_HOLD
 *   3. Approve PO with denied vendor (DENIED) → blocked, status = ON_HOLD
 *   4. Verify compliance hold is created when PO is placed on hold
 *
 * US-SCM-VENDOR-04: As a procurement specialist, I want the system to block PO
 * creation for vendors who fail denied-party screening or whose ITAR registration
 * has expired so that compliance is enforced at the point of transaction.
 *
 * Accept: Given a procurement user attempting to create a PO for a non-cleared
 * vendor, when they select the vendor in the UI, then the system blocks creation
 * and displays clear compliance reason.
 *
 * Ref: FEAT-002 SCM-002, issue apogee-b5def64b
 */
import { expect, test } from "@playwright/test";
import { SEED, graphql } from "./helpers/api.js";

test.describe("Blocked vendor PO prevention (SCM-002)", () => {
	test.describe.configure({ mode: "serial" });

	// ── Scenario 1: Approve PO with cleared vendor → succeeds ──
	test("approve PO with cleared vendor transitions to APPROVED", async ({ request }) => {
		const submitResult = await graphql(
			request,
			`
      mutation {
        submitPurchaseOrderForApproval(
          input: { id: "test-cleared-vendor-po", submittedBy: "test-user" }
        ) {
          poId
          newStatus
        }
      }
    `,
		);

		expect(submitResult.errors).toBeUndefined();
		expect(submitResult.data?.submitPurchaseOrderForApproval.newStatus).toBe("PENDING_APPROVAL");

		const approveResult = await graphql(
			request,
			`
      mutation {
        approvePurchaseOrder(
          input: { id: "test-cleared-vendor-po", approverId: "test-approver" }
        ) {
          poId
          newStatus
          screeningOutcome
          holdId
        }
      }
    `,
		);

		expect(approveResult.errors).toBeUndefined();
		expect(approveResult.data?.approvePurchaseOrder.newStatus).toBe("APPROVED");
		expect(approveResult.data?.approvePurchaseOrder.screeningOutcome).toBe("CLEAR");
		expect(approveResult.data?.approvePurchaseOrder.holdId).toBeNull();
	});

	// ── Scenario 2: Approve PO with flagged vendor → blocked, ON_HOLD ──
	test("approve PO with potentially matching vendor places ON_HOLD", async ({ request }) => {
		const submitResult = await graphql(
			request,
			`
      mutation {
        submitPurchaseOrderForApproval(
          input: {
            id: "test-suspect-vendor-po"
            submittedBy: "test-user"
          }
        ) {
          poId
          newStatus
        }
      }
    `,
		);

		expect(submitResult.errors).toBeUndefined();
		expect(submitResult.data?.submitPurchaseOrderForApproval.newStatus).toBe("PENDING_APPROVAL");

		const approveResult = await graphql(
			request,
			`
      mutation {
        approvePurchaseOrder(
          input: {
            id: "test-suspect-vendor-po"
            approverId: "test-approver"
          }
        ) {
          poId
          newStatus
          screeningOutcome
          holdId
        }
      }
    `,
		);

		expect(approveResult.errors).toBeUndefined();
		const approval = approveResult.data?.approvePurchaseOrder;
		expect(approval.newStatus).toBe("ON_HOLD");
		expect(approval.screeningOutcome).toBe("POTENTIAL_MATCH");
		expect(approval.holdId).toBeTruthy();
	});

	// ── Scenario 3: Approve PO with denied vendor → blocked, ON_HOLD ──
	test("approve PO with confirmed match vendor places ON_HOLD", async ({ request }) => {
		const submitResult = await graphql(
			request,
			`
      mutation {
        submitPurchaseOrderForApproval(
          input: {
            id: "test-denied-vendor-po"
            submittedBy: "test-user"
          }
        ) {
          poId
          newStatus
        }
      }
    `,
		);

		expect(submitResult.errors).toBeUndefined();
		expect(submitResult.data?.submitPurchaseOrderForApproval.newStatus).toBe("PENDING_APPROVAL");

		const approveResult = await graphql(
			request,
			`
      mutation {
        approvePurchaseOrder(
          input: { id: "test-denied-vendor-po", approverId: "test-approver" }
        ) {
          poId
          newStatus
          screeningOutcome
          holdId
        }
      }
    `,
		);

		expect(approveResult.errors).toBeUndefined();
		const approval = approveResult.data?.approvePurchaseOrder;
		expect(approval.newStatus).toBe("ON_HOLD");
		expect(approval.screeningOutcome).toBe("CONFIRMED_MATCH");
		expect(approval.holdId).toBeTruthy();
	});

	// ── Scenario 4: Verify compliance hold created with correct reason ──
	test("hold record exists with SCREENING_MATCH reason", async ({ request }) => {
		const holdsResult = await graphql(
			request,
			`
      query {
        complianceHolds(entityId: "${SEED.entities.US}") {
          id
          holdReason
          status
        }
      }
    `,
		);

		expect(holdsResult.errors).toBeUndefined();
		const holds = holdsResult.data?.complianceHolds as Array<{
			holdReason: string;
			status: string;
		}>;

		expect(holds).toBeTruthy();
		// At least one hold should have SCREENING_MATCH reason from our tests above
		const screeningHold = holds.find((h) => h.holdReason === "SCREENING_MATCH");
		expect(screeningHold).toBeTruthy();
		expect(screeningHold?.status).toBe("ACTIVE");
	});
});
