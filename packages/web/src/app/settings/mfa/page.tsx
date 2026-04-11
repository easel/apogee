"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { useEffect, useState } from "react";

type EnrollmentState = "disconnected" | "not_enrolled" | "enrolled";

interface SetupResponse {
	uri: string;
}

export default function MfaEnrollmentPage() {
	const [state, setState] = useState<EnrollmentState>("disconnected");
	const [setupUri, setSetupUri] = useState<string | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(false);

	// Check enrollment status on mount
	useEffect(() => {
		checkEnrollment();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function checkEnrollment() {
		try {
			// No dedicated endpoint — try setup; 409 means already enrolled
			const res = await fetch("/auth/mfa/setup", { credentials: "include" });
			if (res.status === 409) {
				setState("enrolled");
				return;
			}
			if (res.ok) {
				const data = (await res.json()) as SetupResponse;
				setSetupUri(data.uri);
				setState("not_enrolled");
				// Generate QR data URL
				try {
					const QRCode = await import("qrcode");
					const url = await QRCode.default.toDataURL(data.uri, { margin: 1 });
					setQrDataUrl(url);
				} catch {
					// QR library unavailable, show URI as text fallback
				}
			}
		} catch {
			// Server unreachable
		}
	}

	async function handleConfirm(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const res = await fetch("/auth/mfa/setup/confirm", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: code.trim() }),
			});
			const data = (await res.json()) as { ok?: boolean; error?: string };
			if (res.ok && data.ok) {
				setSuccess(true);
				setState("enrolled");
			} else {
				setError(data.error ?? "Verification failed");
			}
		} catch {
			setError("Network error — try again");
		} finally {
			setLoading(false);
		}
	}

	function handleReset() {
		setSetupUri(null);
		setQrDataUrl(null);
		setCode("");
		setError(null);
		setSuccess(false);
		setState("disconnected");
	}

	if (state === "enrolled" && !success) {
		return (
			<div className="max-w-lg mx-auto py-8">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5 text-green-500" />
							MFA Already Enrolled
						</CardTitle>
						<CardDescription>
							Two-factor authentication is already active on your account.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (success) {
		return (
			<div className="max-w-lg mx-auto py-8">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5 text-green-500" />
							MFA Enrollment Complete
						</CardTitle>
						<CardDescription>
							Your account is now protected with two-factor authentication. Sign-out and sign-in to
							test it.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={handleReset} variant="outline">
							Enroll another account
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (state === "disconnected") {
		return (
			<div className="max-w-lg mx-auto py-8">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Shield className="h-5 w-5" />
							Enable Two-Factor Authentication
						</CardTitle>
						<CardDescription>
							Protect your account with a time-based one-time password (TOTP).
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={checkEnrollment} className="w-full">
							Start MFA Setup
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="max-w-lg mx-auto py-8">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Enable Two-Factor Authentication
					</CardTitle>
					<CardDescription>
						Scan the QR code with your authenticator app, then enter the 6-digit verification code.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* QR Code */}
					<div className="flex flex-col items-center">
						{qrDataUrl ? (
							<img src={qrDataUrl} alt="MFA QR code" className="border rounded-lg" />
						) : setupUri ? (
							<div className="text-center space-y-2">
								<AlertTriangle className="h-5 w-5 text-amber-500 mx-auto" />
								<p className="text-sm">
									QR generation unavailable. Enter this URI manually in your authenticator:
								</p>
								<code className="text-xs break-all bg-muted px-2 py-1 rounded block">
									{setupUri}
								</code>
							</div>
						) : (
							<Button onClick={checkEnrollment} variant="outline">
								Generate QR Code
							</Button>
						)}
					</div>

					{/* Verification form */}
					<form onSubmit={handleConfirm} className="space-y-4">
						<div>
							<label htmlFor="mfa-code" className="block text-sm font-medium mb-1">
								Verification Code
							</label>
							<Input
								id="mfa-code"
								maxLength={6}
								inputMode="numeric"
								pattern="[0-9]{6}"
								value={code}
								onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
								placeholder="123456"
								autoComplete="one-time-code"
								required
							/>
						</div>

						{error && (
							<div className="flex items-center gap-2 text-sm text-red-600">
								<AlertTriangle className="h-4 w-4" />
								{error}
							</div>
						)}

						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? "Verifying…" : "Verify & Enable MFA"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
