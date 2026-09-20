"use client";

import { BanknoteIcon, CheckCircle2Icon, ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { FieldShell, SubmitButton, TextField, focusFirstInvalid, useFormAction } from "@/components/shared/form";
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
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { recordPaymentAction } from "@/lib/actions/drivers";
import { PAYMENT_CHANNELS, type PaymentChannel } from "@/lib/domain/pricing";
import { formatCurrency } from "@/lib/i18n/format";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

/**
 * Records the cash a driver hands over.
 *
 * It opens with the whole amount filled in, because clearing it is what almost
 * always happens — a smaller figure is there for a part payment. The one thing
 * this has to get right is the race: two people settling the same driver at
 * once must not both subtract from the same total, so the write is conditional
 * on the balance the operator was shown. When that check trips, the form
 * refetches and re-seeds itself rather than leaving a stale number on screen
 * with "try again" written underneath it.
 */
export function PaymentDialog({
  driverId,
  driverName,
  cashHeld,
  due,
  currency,
}: {
  driverId: string;
  driverName: string;
  cashHeld: number;
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
        {/* Keyed on the amount too: when a stale form refetches, the new figure
            arrives as a new key and the fields re-seed from it. */}
        <PaymentForm
          key={`${round}:${due}`}
          driverId={driverId}
          driverName={driverName}
          cashHeld={cashHeld}
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
  cashHeld,
  due,
  currency,
  onDone,
}: {
  driverId: string;
  driverName: string;
  cashHeld: number;
  due: number;
  currency: string;
  onDone: () => void;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const t = dict.admin.drivers.balance;
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction<ActionState<{ due: number }>>(recordPaymentAction, idleState);
  const [amount, setAmount] = useState(due.toFixed(3));
  const [channel, setChannel] = useState<PaymentChannel>("cash");
  const [showDetails, setShowDetails] = useState(false);

  const stale = state.status === "error" && state.error === "balanceChanged";

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.data && state.data.due <= 0 ? t.cleared : t.recorded);
      onDone();
      return;
    }
    if (state.status !== "error") return;
    // Somebody else moved the balance, or a ride landed mid-form. Pull the real
    // figure down; the new value remounts this form with the right amount in
    // it, so the operator confirms rather than retypes.
    if (stale) router.refresh();
    else focusFirstInvalid(formRef.current);
  }, [state, stale, onDone, router, t.cleared, t.recorded]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const error = (name: string) => resolveMessage(dict, fieldErrors?.[name]);
  const formError =
    state.status === "error" && state.error && !stale ? resolveMessage(dict, state.error) : undefined;

  const entered = Number(amount.replace(",", "."));
  const valid = Number.isFinite(entered) && entered > 0;
  const after = valid ? Math.max(0, round3(due - entered)) : due;
  const clears = valid && after <= 0;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="expectedDue" value={due.toFixed(3)} />
      <input type="hidden" name="channel" value={channel} />

      {stale ? (
        <p className="flex items-start gap-2 rounded-lg bg-status-warning/10 px-3 py-2.5 text-sm">
          <RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden="true" />
          <span>{t.staleRefreshed}</span>
        </p>
      ) : null}
      {formError ? (
        <p className="rounded-lg bg-status-critical/10 px-3 py-2.5 text-sm text-status-critical">{formError}</p>
      ) : null}

      {/* What the driver is carrying, and the slice of it that is ours. The
          second number is the one being settled; the first is why. */}
      <div className="rounded-xl border bg-muted/40 p-3">
        <p className="text-sm font-medium">{driverName}</p>
        <dl className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t.cashHeld}</dt>
            <dd className="tabular mt-0.5 text-sm font-medium">{formatCurrency(locale, cashHeld, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.due}</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold">{formatCurrency(locale, due, currency)}</dd>
          </div>
        </dl>
      </div>

      <FieldShell label={t.amount} error={error("amount")}>
        {(control) => (
          <InputGroup>
            <InputGroupInput
              {...control}
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tabular text-start text-lg font-semibold rtl:text-end"
            />
            <InputGroupAddon align="inline-end">
              <span className="text-muted-foreground">{currency}</span>
              <InputGroupButton onClick={() => setAmount(due.toFixed(3))}>{t.payAll}</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      </FieldShell>

      {/* Three options: a segmented control is one tap, a dropdown is three. */}
      <FieldShell label={t.channel} error={error("channel")}>
        {() => (
          <ToggleGroup
            type="single"
            value={channel}
            onValueChange={(next) => next && setChannel(next as PaymentChannel)}
            variant="outline"
            className="w-full"
          >
            {PAYMENT_CHANNELS.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="flex-1 data-[state=on]:bg-brand data-[state=on]:text-asphalt"
              >
                {t.channels[option]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </FieldShell>

      {/* Optional, and rarely filled in, so they stay out of the way until
          somebody actually has a receipt number to record. */}
      {showDetails ? (
        <div className="space-y-4">
          <TextField
            name="reference"
            label={t.reference}
            hint={t.referenceHint}
            error={error("reference")}
            autoComplete="off"
          />
          <TextField name="note" label={t.note} error={error("note")} autoComplete="off" />
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-muted-foreground hover:bg-transparent"
          onClick={() => setShowDetails(true)}
        >
          <ChevronDownIcon />
          {t.addDetails}
        </Button>
      )}

      <Separator />

      <p
        className={`tabular flex items-center gap-2 text-sm ${clears ? "font-medium text-status-good" : "text-muted-foreground"}`}
      >
        {clears ? <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
        {clears ? t.clearsAccount : t.leftAfter.replace("{amount}", formatCurrency(locale, after, currency))}
      </p>

      <DialogFooter>
        <SubmitButton pending={pending} pendingLabel={dict.common.saving} disabled={!valid}>
          {t.submit}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
