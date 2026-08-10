"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { MaintenanceSettings, Society } from "@/types/database";
import {
  maintenanceSettingsSchema,
  societySettingsSchema,
  type MaintenanceSettingsInput,
  type SocietySettingsInput,
} from "@/lib/validations/society";
import {
  saveMaintenanceSettingsAction,
  saveSocietySettingsAction,
} from "@/lib/actions/settings";
import { BILLING_FREQUENCIES, billingFrequencyLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SettingsFormsProps {
  society: Society | null;
  maintenance: MaintenanceSettings | null;
}

export function SettingsForms({ society, maintenance }: SettingsFormsProps) {
  const router = useRouter();
  const [savingSociety, setSavingSociety] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const societyForm = useForm<SocietySettingsInput>({
    resolver: zodResolver(societySettingsSchema),
    defaultValues: {
      name: society?.name || "",
      address: society?.address || "",
      city: society?.city || "",
      state: society?.state || "",
      pin_code: society?.pin_code || "",
      phone: society?.phone || "",
      email: society?.email || "",
      registration_number: society?.registration_number || "",
      bank_name: society?.bank_name || "",
      account_number: society?.account_number || "",
      ifsc: society?.ifsc || "",
      upi_id: society?.upi_id || "",
      logo_url: society?.logo_url || "",
    },
  });

  const frequency = Number(maintenance?.billing_frequency_months || 1);

  const maintenanceForm = useForm<MaintenanceSettingsInput>({
    resolver: zodResolver(maintenanceSettingsSchema),
    defaultValues: {
      billing_frequency_months: frequency,
      default_amount: Number(maintenance?.default_amount || 1500),
      due_day: Number(maintenance?.due_day || 10),
      late_fee: Number(maintenance?.late_fee || 100),
    },
  });

  const watchedFrequency = Number(maintenanceForm.watch("billing_frequency_months") || 1);

  async function onSaveSociety(values: SocietySettingsInput) {
    setSavingSociety(true);
    const result = await saveSocietySettingsAction(values);
    setSavingSociety(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  async function onSaveMaintenance(values: MaintenanceSettingsInput) {
    setSavingMaintenance(true);
    const result = await saveMaintenanceSettingsAction(values);
    setSavingMaintenance(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Society Settings"
          description="Basic society profile, contact, and bank details."
        />
        <CardContent>
          <form className="space-y-4" onSubmit={societyForm.handleSubmit(onSaveSociety)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Society Name" error={societyForm.formState.errors.name?.message} {...societyForm.register("name")} />
              <Input label="Logo URL" hint="Upload to Supabase Storage and paste public URL" {...societyForm.register("logo_url")} />
              <Input label="Address" className="sm:col-span-2" {...societyForm.register("address")} />
              <Input label="City" {...societyForm.register("city")} />
              <Input label="State" {...societyForm.register("state")} />
              <Input label="PIN Code" {...societyForm.register("pin_code")} />
              <Input label="Phone" {...societyForm.register("phone")} />
              <Input label="Email" type="email" {...societyForm.register("email")} />
              <Input label="Registration Number" {...societyForm.register("registration_number")} />
              <Input label="Bank Name" {...societyForm.register("bank_name")} />
              <Input label="Account Number" {...societyForm.register("account_number")} />
              <Input label="IFSC" {...societyForm.register("ifsc")} />
              <Input label="UPI ID" {...societyForm.register("upi_id")} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingSociety}>Save Society Settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Maintenance Settings"
          description="Set how often maintenance is charged: monthly, every 3 months, or every 6 months."
        />
        <CardContent>
          <form className="space-y-4" onSubmit={maintenanceForm.handleSubmit(onSaveMaintenance)}>
            <Select
              label="Billing Frequency"
              options={[...BILLING_FREQUENCIES]}
              error={maintenanceForm.formState.errors.billing_frequency_months?.message}
              {...maintenanceForm.register("billing_frequency_months")}
            />
            <p className="text-sm text-slate-500">
              Selected: <span className="font-medium text-slate-700">{billingFrequencyLabel(watchedFrequency)}</span>.
              Amount below is for one full billing period (not per month).
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label={
                  watchedFrequency === 3
                    ? "Amount (for 3 months)"
                    : watchedFrequency === 6
                      ? "Amount (for 6 months)"
                      : "Amount (for 1 month)"
                }
                type="number"
                {...maintenanceForm.register("default_amount")}
              />
              <Input label="Due Day (1-28)" type="number" {...maintenanceForm.register("due_day")} />
              <Input label="Late Fee" type="number" {...maintenanceForm.register("late_fee")} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingMaintenance}>Save Maintenance Settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
