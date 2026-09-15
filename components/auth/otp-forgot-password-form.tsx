"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const RESEND_COOLDOWN_SECONDS = 30;

function errorMessage(error: unknown, fallback: string) {
  const err = error as { message?: string; error?: { message?: string } };
  return err?.error?.message ?? err?.message ?? fallback;
}

async function sendResetCode(email: string) {
  await authClient.emailOtp.requestPasswordReset({
    email,
    fetchOptions: { throw: true },
  });
}

export function OtpForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [step, setStep] = React.useState<"email" | "code" | "password">(
    "email",
  );
  const [pending, startTransition] = React.useTransition();
  const [resendIn, setResendIn] = React.useState(0);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  function requestCode(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await sendResetCode(email);
        toast.add({
          title: "Check your email for the reset code.",
          type: "success",
        });
        setStep("code");
        setResendIn(RESEND_COOLDOWN_SECONDS);
      } catch (error) {
        toast.add({
          title: errorMessage(error, "Couldn't send the reset code"),
          type: "error",
        });
      }
    });
  }

  function resendCode() {
    startTransition(async () => {
      try {
        await sendResetCode(email);
        toast.add({ title: "Code resent", type: "success" });
        setResendIn(RESEND_COOLDOWN_SECONDS);
      } catch (error) {
        toast.add({
          title: errorMessage(error, "Couldn't resend the code"),
          type: "error",
        });
      }
    });
  }

  function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await authClient.emailOtp.checkVerificationOtp({
          email,
          type: "forget-password",
          otp,
          fetchOptions: { throw: true },
        });
        setStep("password");
      } catch (error) {
        toast.add({
          title: errorMessage(error, "That code isn't valid"),
          type: "error",
        });
      }
    });
  }

  function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.add({ title: "Passwords don't match", type: "error" });
      return;
    }
    startTransition(async () => {
      try {
        await authClient.emailOtp.resetPassword({
          email,
          otp,
          password,
          fetchOptions: { throw: true },
        });
        toast.add({
          title: "Password reset successfully",
          type: "success",
        });
        router.push("/auth/sign-in");
      } catch (error) {
        toast.add({
          title: errorMessage(error, "Couldn't reset your password"),
          type: "error",
        });
      }
    });
  }

  const descriptions: Record<typeof step, string> = {
    email: "Enter your email to receive a one-time reset code",
    code: `Enter the code sent to ${email}`,
    password: "Choose a new password",
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Forgot Password</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          {descriptions[step]}
        </CardDescription>
      </CardHeader>

      {step === "email" && (
        <form onSubmit={requestCode}>
          <CardContent className="grid gap-6">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Email</span>
              <Input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
              />
            </label>
            <Button type="submit" className="w-full" loading={pending}>
              Send reset code
            </Button>
          </CardContent>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verifyCode}>
          <CardContent className="grid gap-6">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Code</span>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={pending}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </label>
            <Button type="submit" className="w-full" loading={pending}>
              Verify code
            </Button>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 text-foreground underline"
                disabled={pending}
                onClick={() => {
                  setStep("email");
                  setOtp("");
                }}
              >
                Use a different email
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 text-foreground underline"
                disabled={pending || resendIn > 0}
                onClick={resendCode}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </Button>
            </div>
          </CardContent>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={resetPassword}>
          <CardContent className="grid gap-6">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">New Password</span>
              <Input
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Confirm Password</span>
              <Input
                type="password"
                required
                minLength={8}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={pending}
              />
            </label>
            <Button type="submit" className="w-full" loading={pending}>
              Reset password
            </Button>
          </CardContent>
        </form>
      )}

      <CardFooter className="justify-center gap-1.5 text-muted-foreground text-sm">
        <ArrowLeftIcon className="size-3" />
        <Link href="/auth/sign-in" className="text-foreground underline">
          <Button variant="link" size="sm" className="px-0 text-foreground underline">
            Back to sign in
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
