import * as React from "react";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ------------------------------
// Schema
// ------------------------------
const LeaveSchema = z
    .object({
        userId: z.number().int().positive(),
        leaveType: z.string().min(1, "Leave type is required"),
        startDate: z.date({ required_error: "Start date is required" }),
        endDate: z.date({ required_error: "End date is required" }),
        reason: z.string().min(5, "Please provide a brief reason"),
        // Client sets status to pending; admin updates later
        status: z.literal("pending").default("pending"),
    })
    .refine((v) => v.endDate >= v.startDate, {
        message: "End date cannot be earlier than start date",
        path: ["endDate"],
    });

export type LeaveFormValues = z.infer<typeof LeaveSchema>;

// ------------------------------
// Props
// ------------------------------
type Props = {
    userId?: number | null; // will be injected by Profile page
    defaultValues?: Partial<LeaveFormValues>;
    onSubmitted?: (payload: LeaveFormValues) => void;
    onCancel?: () => void;
};

// ------------------------------
// Component
// ------------------------------
export default function LeaveApplicationForm({
    userId,
    defaultValues,
    onSubmitted,
    onCancel,
}: Props) {
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<LeaveFormValues>({
        resolver: zodResolver(LeaveSchema),
        mode: "onChange",
        defaultValues: {
            userId: userId ?? 0,
            leaveType: defaultValues?.leaveType ?? "",
            startDate: defaultValues?.startDate ?? new Date(),
            endDate: defaultValues?.endDate ?? new Date(),
            reason: defaultValues?.reason ?? "",
            status: "pending",
        },
    });

    const {
        register,
        setValue,
        watch,
        handleSubmit,
        formState: { errors, isValid },
    } = form;

    const startDate = watch("startDate");
    const endDate = watch("endDate");
    const [openStart, setOpenStart] = useState(false);
    const [openEnd, setOpenEnd] = useState(false);


    const submit = async (values: LeaveFormValues) => {
        setSubmitting(true);
        // post leave application to backend, connect endpoint later
        try {
            // TODO: hook this to your backend
            // await fetch("/api/leave-applications", {
            //   method: "POST",
            //   headers: { "Content-Type": "application/json" },
            //   body: JSON.stringify({
            //     ...values,
            //     // server expects: status: "pending"
            //   }),
            // });

            onSubmitted?.(values);
        } catch (e) {
            console.error("leave submit failed:", e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleSubmit(submit)}>
            {/* Leave Type */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Leave Type</label>
                <input
                    type="text"
                    placeholder="Sick/Weather/Family/Personal..."
                    className="w-full rounded-md border px-3 py-2 text-sm shadow-sm bg-background"
                    {...form.register("leaveType", { required: "Leave type is required" })}
                />
                {errors.leaveType && (
                    <p className="text-xs text-destructive">{errors.leaveType.message}</p>
                )}
            </div>

            {/* Start Date */}

            <div className="space-y-2">
                <label className="text-sm font-medium">Start date</label>
                <Popover modal={false} open={openStart} onOpenChange={setOpenStart}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP") : "Pick a date"}
                        </Button>
                    </PopoverTrigger>
                    {/* z-index above Dialog (50 by default) */}
                    <PopoverContent align="start" sideOffset={8} className="p-0 z-[60]">
                        <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(d) => {
                                if (!d) return;
                                setValue("startDate", d, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                                // optional: if endDate < startDate, sync it
                                const currentEnd = watch("endDate");
                                if (currentEnd && d > currentEnd) {
                                    setValue("endDate", d, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                                }
                                setOpenStart(false);
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message as string}</p>}
            </div>


            {/* End Date */}
            <div className="space-y-2">
                <label className="text-sm font-medium">End date</label>
                <Popover modal={false} open={openEnd} onOpenChange={setOpenEnd}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : "Pick a date"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" sideOffset={8} className="p-0 z-[60]">
                        <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(d) => {
                                if (!d) return;
                                setValue("endDate", d, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                                setOpenEnd(false);
                            }}
                            disabled={(date) => (startDate ? date < startDate : false)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message as string}</p>}
            </div>


            {/* Reason */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <Textarea
                    rows={4}
                    placeholder="Short description"
                    {...register("reason")}
                />
                {errors.reason && (
                    <p className="text-xs text-destructive">{errors.reason.message}</p>
                )}
            </div>

            {/* Hidden status (pending) */}
            <input type="hidden" value="pending" {...register("status")} />
            {/* Hidden userId to keep payload aligned */}
            <input type="hidden" value={userId ?? 0} {...register("userId", { valueAsNumber: true })} />

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={!isValid || submitting}>
                    {submitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting…
                        </>
                    ) : (
                        "Submit"
                    )}
                </Button>
            </div>
        </form>
    );
}
