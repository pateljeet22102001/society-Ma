"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { confirmPasswordAction } from "@/lib/actions/auth";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PasswordConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void | Promise<void>;
}

export function PasswordConfirmDialog({ open, onClose, onConfirmed }: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setLoading(true);
    setError(undefined);
    const result = await confirmPasswordAction(password);
    setLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setPassword("");
    onClose();
    toast.success(result.message);
    await onConfirmed();
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirm your identity" description="Enter your current password. Confirmation remains valid for 10 minutes.">
      <form onSubmit={(event) => { event.preventDefault(); void confirm(); }} className="space-y-4">
        <Input label="Current Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} leftIcon={<Lock className="h-4 w-4" />} error={error} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Confirm</Button>
        </div>
      </form>
    </Modal>
  );
}
