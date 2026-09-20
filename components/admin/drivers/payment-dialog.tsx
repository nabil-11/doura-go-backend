"use client";

import { BanknoteIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { FieldShell, FormAlert, SubmitButton, TextField, focusFirstInvalid, useFormAction } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordPaymentAction } from "@/lib/actions/drivers";
import { PAYMENT_CHANNELS } from "@/lib/domain/pricing";
import { formatCurrency } from "@/lib/i18n/format";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

/**
 * Records the cash a driver hands over. It opens with the whole balance filled
 * in, because clearing it is what almost always happens — a smaller figure is
 * there for a part payment.
 */
export function PaymentDialog({
  driverId,
  driverName,
  due,
  currency,
}: {
  driverId: string;
  driverName: string;
  due: number;
  currency: string;
}) {
  const dict = useDictionary();
  const t = dict.admin.drivers.balance;
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setRound((value) => value + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button className="w-full">
          <BanknoteIcon />
          {t.clear}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.settleTitle}</DialogTitle>
          <DialogDescription>{t.settleDescription}</DialogDescription>
        </DialogHeader>
        <PaymentForm
          key={round}
          driverId={driverId}
          driverName={driverName}
          due={due}
          currency={currency}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  driverId,
  driverName,
  due,
  currency,
  onDone,
}: {
  driverId: string;
  driverName: string;
  due: number;
  currency: string;
  onDone: () => void;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const t = dict.admin.drivers.balance;
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction<ActionState<{ due: number }>>(recordPaymentAction, idleState);
  const [amount, setAmount] = useState(due.toFixed(3));

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.data && state.data.due <= 0 ? t.cleared : t.recorded);
      onDone();
    } else if (state.status === "error") {
      focusFirstInvalid(formRef.current);
    }
  }, [state, onDone, t.cleared, t.recorded]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const error = (name: string) => resolveMessage(dict, fieldErrors?.[name]);
  const formError = state.status === "error" && state.error ? resolveMessage(dict, state.error) : undefined;

  const entered = Number(amount.replace(",", "."));
  const after = Number.isFinite(entered) ? Math.max(0, due - entered) : due;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="expectedDue" value={due.toFixed(3)} />

      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="text-muted-foreground">{driverName}</span>
        <span className="tabular ms-2 font-semibold">{formatCurrency(locale, due, currency)}</span>
      </p>

      <FieldShell label={t.amount} error={error("amount")}>
        {(control) => (
          <InputGroup>
            <InputGroupInput
              {...control}
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tabular text-start rtl:text-end"
            />
            <InputGroupAddon align="inline-end">
              <span className="text-muted-foreground">{currency}</span>
              <InputGroupButton onClick={() => setAmount(due.toFixed(3))}>{t.payAll}</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      </FieldShell>

      <FieldShell label={t.channel} error={error("channel")}>
        {(control) => (
          <Select name="channel" defaultValue="cash">
            <SelectTrigger {...control} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {PAYMENT_CHANNELS.map((channel) => (
                <SelectItem key={channel} value={channel}>
                  {t.channels[channel]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldShell>

      <TextField name="reference" label={t.reference} hint={t.referenceHint} error={error("reference")} autoComplete="off" />
      <TextField name="note" label={t.note} error={error("note")} autoComplete="off" />

      <p className="tabular text-sm text-muted-foreground">
        {t.leftAfter.replace("{amount}", formatCurrency(locale, after, currency))}
      </p>

      <DialogFooter>
        <SubmitButton pending={pending} pendingLabel={dict.common.saving}>
          {t.submit}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
